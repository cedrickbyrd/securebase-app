"""
verify_email.py – SecureBase email-verification Lambda.

Endpoint: POST /verify-email

Marks the Cognito user as email_verified=true and re-invokes the
account_provisioner Lambda so provisioning resumes after the customer
clicks the verification link in their welcome email.

Environment variables:
  DB_SECRET_ARN        – Secrets Manager ARN for Aurora credentials
  COGNITO_USER_POOL    – Cognito User Pool ID
  PROVISIONER_FUNCTION – Lambda function name for account_provisioner
  LOG_LEVEL            – (optional) DEBUG|INFO|WARNING|ERROR

Expected request body:
  { "token": "<verification_token>", "customer_id": "<uuid>", "email": "..." }

  OR query-string parameters customer_id and email can be used when the
  link is a GET redirect from the verification email.
"""

import json
import logging
import os

import boto3
import psycopg2
from botocore.exceptions import ClientError
from psycopg2.extras import RealDictCursor

# ── Logging ───────────────────────────────────────────────────────────────
log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO))
logger = logging.getLogger(__name__)

secrets_client = boto3.client("secretsmanager")
cognito_client = boto3.client("cognito-idp")
lambda_client  = boto3.client("lambda")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
}


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body),
    }


def _get_db_connection():
    secret_arn = os.environ["DB_SECRET_ARN"]
    secret = secrets_client.get_secret_value(SecretId=secret_arn)
    creds  = json.loads(secret["SecretString"])
    return psycopg2.connect(
        host=creds["host"],
        port=int(creds.get("port", 5432)),
        dbname=creds["dbname"],
        user=creds["username"],
        password=creds["password"],
        connect_timeout=5,
        sslmode="require",
    )


def _get_customer(conn, customer_id: str) -> dict | None:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, email, first_name, last_name, company_name,
                   tier, aws_region, mfa_required
            FROM customers
            WHERE id = %s
            LIMIT 1
            """,
            (customer_id,),
        )
        return cur.fetchone()


def _mark_email_verified_in_db(conn, customer_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE customers SET email_verified = TRUE, status = 'active' WHERE id = %s",
            (customer_id,),
        )
    conn.commit()


def _confirm_cognito_email(email: str) -> None:
    user_pool_id = os.environ["COGNITO_USER_POOL"]
    try:
        cognito_client.admin_update_user_attributes(
            UserPoolId=user_pool_id,
            Username=email,
            UserAttributes=[{"Name": "email_verified", "Value": "true"}],
        )
        logger.info("Cognito email_verified set for %s", email)
    except ClientError as err:
        logger.error("Failed to update Cognito user %s: %s", email, err)
        raise


def _trigger_provisioner(customer: dict) -> None:
    provisioner_fn = os.environ.get("PROVISIONER_FUNCTION", "securebase-account-provisioner")
    lambda_client.invoke(
        FunctionName=provisioner_fn,
        InvocationType="Event",
        Payload=json.dumps({
            "customer_id":  str(customer["id"]),
            "email":        customer["email"],
            "first_name":   customer.get("first_name", ""),
            "last_name":    customer.get("last_name", ""),
            "company_name": customer.get("company_name", ""),
            "tier":         customer.get("tier", "standard"),
            "region":       customer.get("aws_region", "us-east-1"),
            "mfa_required": bool(customer.get("mfa_required", True)),
        }),
    )
    logger.info("account_provisioner invoked for customer %s", customer["id"])


# ── Handler ───────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    """
    POST /verify-email  (or GET /verify-email?customer_id=...&email=...)

    Marks Cognito email_verified and restarts the provisioner.
    """
    logger.info("verify_email invoked: requestId=%s", context.aws_request_id)

    if event.get("httpMethod") == "OPTIONS":
        return _resp(204, {})

    http_method = event.get("httpMethod", "POST")

    # Support both GET (link click) and POST (API call)
    if http_method == "GET":
        params      = event.get("queryStringParameters") or {}
        customer_id = params.get("customer_id")
        email       = params.get("email", "")
    else:
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return _resp(400, {"error": "Request body must be valid JSON."})
        customer_id = body.get("customer_id")
        email       = body.get("email", "")

    if not customer_id:
        return _resp(400, {"error": "customer_id is required."})

    conn = None
    try:
        conn     = _get_db_connection()
        customer = _get_customer(conn, customer_id)
        if not customer:
            return _resp(404, {"error": "Customer not found."})

        # Prefer the email from the DB record (authoritative) over query params
        verified_email = customer["email"]

        _confirm_cognito_email(verified_email)
        _mark_email_verified_in_db(conn, customer_id)

        # Re-invoke provisioner (it will re-check and continue from where it stopped)
        try:
            _trigger_provisioner(customer)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not invoke provisioner (non-fatal): %s", exc)

        logger.info("Email verified for customer %s (%s)", customer_id, verified_email)

        if http_method == "GET":
            # Redirect the browser to the onboarding progress page
            portal_url = os.environ.get("PORTAL_URL", "https://portal.securebase.io")
            return {
                "statusCode": 302,
                "headers": {**CORS_HEADERS, "Location": f"{portal_url}/onboarding"},
                "body": "",
            }

        return _resp(200, {
            "message": "Email verified. Provisioning will begin shortly.",
            "customer_id": customer_id,
        })

    except Exception as exc:  # noqa: BLE001
        logger.exception("Error in verify_email: %s", exc)
        return _resp(500, {"error": "Internal server error."})
    finally:
        if conn:
            conn.close()
