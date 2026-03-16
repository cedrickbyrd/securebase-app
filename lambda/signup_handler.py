"""
signup_handler.py – SecureBase self-service signup Lambda.

Endpoint: POST /signup

Validates the incoming payload, prevents duplicate email registrations,
stores a new customer record in Aurora, creates a Cognito user, sends a
SES email-verification link, and asynchronously triggers the account
provisioner Lambda.

Environment variables (resolved from SSM/Secrets Manager at init):
  DB_SECRET_ARN       – Secrets Manager ARN for Aurora credentials
  COGNITO_USER_POOL   – Cognito User Pool ID
  SES_SENDER_EMAIL    – Verified SES sender address
  PROVISIONER_FUNCTION – Lambda function name for account_provisioner
  PORTAL_URL          – Base URL for email verification links
  LOG_LEVEL           – (optional) DEBUG|INFO|WARNING|ERROR
"""

import json
import logging
import os
import re
import uuid
from datetime import datetime

import boto3
import psycopg2
from botocore.exceptions import ClientError

# ── Logging ───────────────────────────────────────────────────────────────
log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO))
logger = logging.getLogger(__name__)

# ── AWS clients (module-level for Lambda reuse) ───────────────────────────
secrets_client = boto3.client("secretsmanager")
cognito_client  = boto3.client("cognito-idp")
ses_client      = boto3.client("ses")
lambda_client   = boto3.client("lambda")

# ── Constants ─────────────────────────────────────────────────────────────
VALID_TIERS    = {"standard", "fintech", "healthcare", "government"}
VALID_REGIONS  = {
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-west-1", "eu-central-1", "ap-southeast-1",
}
MIN_PASSWORD_LEN = 12

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
}


# ── Helpers ───────────────────────────────────────────────────────────────

def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body),
    }


def _get_db_credentials() -> dict:
    """Fetch Aurora credentials from Secrets Manager."""
    secret_arn = os.environ["DB_SECRET_ARN"]
    secret = secrets_client.get_secret_value(SecretId=secret_arn)
    return json.loads(secret["SecretString"])


def _get_db_connection():
    creds = _get_db_credentials()
    return psycopg2.connect(
        host=creds["host"],
        port=int(creds.get("port", 5432)),
        dbname=creds["dbname"],
        user=creds["username"],
        password=creds["password"],
        connect_timeout=5,
        sslmode="require",
    )


def _validate_payload(body: dict) -> list[str]:
    """Return a list of validation error messages (empty = valid)."""
    errors = []
    for field in ("first_name", "last_name", "email", "password", "company_name"):
        if not body.get(field, "").strip():
            errors.append(f"{field} is required.")

    email = body.get("email", "")
    if email and not EMAIL_RE.match(email):
        errors.append("email is not a valid email address.")

    password = body.get("password", "")
    if password and len(password) < MIN_PASSWORD_LEN:
        errors.append(f"password must be at least {MIN_PASSWORD_LEN} characters.")

    tier = body.get("tier", "standard")
    if tier not in VALID_TIERS:
        errors.append(f"tier must be one of: {', '.join(sorted(VALID_TIERS))}.")

    region = body.get("region", "us-east-1")
    if region not in VALID_REGIONS:
        errors.append(f"region '{region}' is not supported.")

    return errors


def _email_exists(conn, email: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM customers WHERE email = %s LIMIT 1", (email,))
        return cur.fetchone() is not None


def _create_customer_record(conn, customer_id: str, body: dict) -> None:
    """Insert a new customer row (pending_verification status)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO customers (
                id, first_name, last_name, email, company_name, company_size,
                industry, phone, tier, aws_region, mfa_required, status, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, 'pending_verification', NOW()
            )
            """,
            (
                customer_id,
                body["first_name"].strip(),
                body["last_name"].strip(),
                body["email"].strip().lower(),
                body["company_name"].strip(),
                body.get("company_size", ""),
                body.get("industry", ""),
                body.get("phone", ""),
                body.get("tier", "standard"),
                body.get("region", "us-east-1"),
                bool(body.get("mfa_required", True)),
            ),
        )
    conn.commit()


def _create_cognito_user(email: str, password: str, customer_id: str) -> None:
    user_pool_id = os.environ["COGNITO_USER_POOL"]
    cognito_client.admin_create_user(
        UserPoolId=user_pool_id,
        Username=email,
        TemporaryPassword=password,
        UserAttributes=[
            {"Name": "email", "Value": email},
            {"Name": "email_verified", "Value": "false"},
            {"Name": "custom:customer_id", "Value": customer_id},
        ],
        MessageAction="SUPPRESS",  # we send our own email
    )
    # Force password so the user doesn't need to change it on first login
    cognito_client.admin_set_user_password(
        UserPoolId=user_pool_id,
        Username=email,
        Password=password,
        Permanent=True,
    )


def _send_verification_email(email: str, first_name: str, customer_id: str) -> None:
    portal_url   = os.environ.get("PORTAL_URL", "https://portal.securebase.io")
    sender_email = os.environ["SES_SENDER_EMAIL"]
    verify_url   = f"{portal_url}/verify-email?customer_id={customer_id}&email={email}"

    ses_client.send_email(
        Source=sender_email,
        Destination={"ToAddresses": [email]},
        Message={
            "Subject": {"Data": "Verify your SecureBase account"},
            "Body": {
                "Html": {
                    "Data": f"""
                    <p>Hi {first_name},</p>
                    <p>Thanks for signing up for SecureBase. Please verify your email address to
                    start your environment provisioning.</p>
                    <p><a href="{verify_url}" style="background:#4f46e5;color:#fff;
                    padding:12px 24px;border-radius:6px;text-decoration:none;">
                    Verify Email Address</a></p>
                    <p>If you didn't create this account, you can safely ignore this email.</p>
                    <p>— The SecureBase Team</p>
                    """
                },
                "Text": {
                    "Data": (
                        f"Hi {first_name},\n\n"
                        "Verify your SecureBase account by visiting:\n"
                        f"{verify_url}\n\n"
                        "— The SecureBase Team"
                    )
                },
            },
        },
    )


def _trigger_provisioner_async(customer_id: str, payload: dict) -> None:
    """Invoke the provisioner Lambda asynchronously (Event invocation type)."""
    provisioner_fn = os.environ.get("PROVISIONER_FUNCTION", "securebase-account-provisioner")
    lambda_client.invoke(
        FunctionName=provisioner_fn,
        InvocationType="Event",
        Payload=json.dumps({
            "customer_id": customer_id,
            "email": payload["email"].strip().lower(),
            "first_name": payload["first_name"].strip(),
            "last_name": payload["last_name"].strip(),
            "company_name": payload["company_name"].strip(),
            "tier": payload.get("tier", "standard"),
            "region": payload.get("region", "us-east-1"),
            "mfa_required": bool(payload.get("mfa_required", True)),
        }),
    )


# ── Handler ───────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    """
    POST /signup handler.

    Accepts JSON body with customer sign-up details, validates, persists,
    sends verification email, and asynchronously triggers provisioning.
    """
    logger.info("signup_handler invoked: requestId=%s", context.aws_request_id)

    # Handle OPTIONS pre-flight
    if event.get("httpMethod") == "OPTIONS":
        return _resp(204, {})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "Request body must be valid JSON."})

    # Validate payload
    errors = _validate_payload(body)
    if errors:
        return _resp(422, {"errors": errors})

    customer_id = str(uuid.uuid4())
    email       = body["email"].strip().lower()
    first_name  = body["first_name"].strip()

    conn = None
    try:
        conn = _get_db_connection()

        if _email_exists(conn, email):
            return _resp(409, {"error": "An account with this email already exists."})

        _create_customer_record(conn, customer_id, body)

        try:
            _create_cognito_user(email, body["password"], customer_id)
        except ClientError as err:
            code = err.response["Error"]["Code"]
            if code == "UsernameExistsException":
                return _resp(409, {"error": "An account with this email already exists."})
            logger.error("Cognito error: %s", err)
            raise

        _send_verification_email(email, first_name, customer_id)

        # Trigger provisioner (best-effort; don't fail the signup on Lambda invoke error)
        try:
            _trigger_provisioner_async(customer_id, body)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not invoke provisioner (non-fatal): %s", exc)

        logger.info("Signup complete: customer_id=%s email=%s", customer_id, email)
        return _resp(201, {
            "message": "Account created. Please verify your email to continue.",
            "customer_id": customer_id,
        })

    except Exception as exc:
        logger.exception("Unexpected error in signup_handler: %s", exc)
        return _resp(500, {"error": "Internal server error. Please try again later."})
    finally:
        if conn:
            conn.close()
