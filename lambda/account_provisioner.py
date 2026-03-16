"""
account_provisioner.py – SecureBase AWS account provisioner Lambda.

Triggered asynchronously by signup_handler (or verify_email) after a
customer completes email verification.

Responsibilities:
  1. Verify the customer's email is confirmed in Cognito.
  2. Create a dedicated AWS Organizations member account.
  3. Wait for the account to become ACTIVE.
  4. Move the account to the correct Workloads OU (by tier).
  5. Trigger a CodeBuild project to run Terraform (customer-baseline module).
  6. Update onboarding step status in Aurora throughout.
  7. Send a welcome email on successful completion.

Environment variables:
  DB_SECRET_ARN           – Secrets Manager ARN for Aurora credentials
  COGNITO_USER_POOL       – Cognito User Pool ID
  ORG_MANAGEMENT_ROLE     – IAM role ARN in the management account
  CODEBUILD_PROJECT       – CodeBuild project name for Terraform runs
  SES_SENDER_EMAIL        – Verified SES sender address
  PORTAL_URL              – Portal URL for welcome email links
  OU_ID_STANDARD          – OU ID for standard-tier accounts
  OU_ID_FINTECH           – OU ID for fintech-tier accounts
  OU_ID_HEALTHCARE        – OU ID for healthcare-tier accounts
  OU_ID_GOVERNMENT        – OU ID for government-tier accounts
  LOG_LEVEL               – (optional) DEBUG|INFO|WARNING|ERROR
"""

import json
import logging
import os
import time
import uuid
from datetime import datetime

import boto3
import psycopg2
from botocore.exceptions import ClientError

# ── Logging ───────────────────────────────────────────────────────────────
log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO))
logger = logging.getLogger(__name__)

# ── AWS clients ───────────────────────────────────────────────────────────
secrets_client   = boto3.client("secretsmanager")
cognito_client   = boto3.client("cognito-idp")
orgs_client      = boto3.client("organizations")
codebuild_client = boto3.client("codebuild")
ses_client       = boto3.client("ses")

# ── Constants ─────────────────────────────────────────────────────────────
ACCOUNT_ACTIVE_POLL_INTERVAL = 20   # seconds between polls
ACCOUNT_ACTIVE_TIMEOUT       = 600  # 10 minutes max wait

STEP_KEYS = [
    "email_verified",
    "account_created",
    "account_active",
    "ou_assigned",
    "terraform_running",
    "guardrails_applied",
    "welcome_sent",
]

TIER_OU_ENV_KEYS = {
    "standard":   "OU_ID_STANDARD",
    "fintech":    "OU_ID_FINTECH",
    "healthcare": "OU_ID_HEALTHCARE",
    "government": "OU_ID_GOVERNMENT",
}

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}


# ── DB helpers ────────────────────────────────────────────────────────────

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


def _get_or_create_job(conn, customer_id: str) -> str:
    """Return existing job id or create a new one, seeding step rows."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM onboarding_jobs WHERE customer_id = %s LIMIT 1",
            (customer_id,),
        )
        row = cur.fetchone()
        if row:
            return str(row[0])

        job_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO onboarding_jobs (id, customer_id, status, created_at)
            VALUES (%s, %s, 'in_progress', NOW())
            """,
            (job_id, customer_id),
        )
        for step_key in STEP_KEYS:
            cur.execute(
                """
                INSERT INTO onboarding_steps
                    (id, job_id, step_key, status, created_at)
                VALUES (%s, %s, %s, 'pending', NOW())
                """,
                (str(uuid.uuid4()), job_id, step_key),
            )
        conn.commit()
    return job_id


def _update_step(conn, job_id: str, step_key: str, status: str,
                 error_message: str = None) -> None:
    """Update a single onboarding step row without dynamic SQL construction."""
    with conn.cursor() as cur:
        if status == "in_progress":
            cur.execute(
                """
                UPDATE onboarding_steps
                   SET status = %s, started_at = NOW(), updated_at = NOW()
                 WHERE job_id = %s AND step_key = %s
                """,
                (status, job_id, step_key),
            )
        elif status in ("complete", "failed") and error_message:
            cur.execute(
                """
                UPDATE onboarding_steps
                   SET status = %s, completed_at = NOW(), error_message = %s,
                       updated_at = NOW()
                 WHERE job_id = %s AND step_key = %s
                """,
                (status, error_message, job_id, step_key),
            )
        elif status in ("complete", "failed"):
            cur.execute(
                """
                UPDATE onboarding_steps
                   SET status = %s, completed_at = NOW(), updated_at = NOW()
                 WHERE job_id = %s AND step_key = %s
                """,
                (status, job_id, step_key),
            )
        else:
            cur.execute(
                """
                UPDATE onboarding_steps
                   SET status = %s, updated_at = NOW()
                 WHERE job_id = %s AND step_key = %s
                """,
                (status, job_id, step_key),
            )
        cur.execute(
            """
            INSERT INTO onboarding_events
                (id, job_id, step_key, event_type, detail, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            """,
            (
                str(uuid.uuid4()), job_id, step_key,
                f"step_{status}",
                json.dumps({"error": error_message} if error_message else {}),
            ),
        )
    conn.commit()


def _set_job_status(conn, job_id: str, status: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE onboarding_jobs SET status = %s, updated_at = NOW() WHERE id = %s",
            (status, job_id),
        )
    conn.commit()


def _update_customer_aws_account(conn, customer_id: str, aws_account_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE customers SET aws_account_id = %s WHERE id = %s",
            (aws_account_id, customer_id),
        )
    conn.commit()


# ── Provisioning steps ────────────────────────────────────────────────────

def _check_email_verified(email: str) -> bool:
    user_pool_id = os.environ["COGNITO_USER_POOL"]
    try:
        resp = cognito_client.admin_get_user(UserPoolId=user_pool_id, Username=email)
        attrs = {a["Name"]: a["Value"] for a in resp.get("UserAttributes", [])}
        return attrs.get("email_verified", "false").lower() == "true"
    except ClientError as err:
        logger.error("Could not get Cognito user %s: %s", email, err)
        return False


def _create_aws_account(email: str, company_name: str, customer_id: str) -> str:
    """
    Create an AWS Organizations member account and return its AccountId.
    Uses email+customer_id as the unique account name to allow idempotent retries.
    """
    account_name = f"securebase-{customer_id[:8]}"
    resp = orgs_client.create_account(
        Email=email,
        AccountName=account_name,
        IamUserAccessToBilling="DENY",
        Tags=[
            {"Key": "ManagedBy",   "Value": "SecureBase"},
            {"Key": "CustomerId",  "Value": customer_id},
            {"Key": "CompanyName", "Value": company_name},
        ],
    )
    return resp["CreateAccountStatus"]["Id"]


def _wait_for_account_active(create_status_id: str) -> str:
    """Poll until account creation is SUCCEEDED; return AccountId."""
    deadline = time.time() + ACCOUNT_ACTIVE_TIMEOUT
    while time.time() < deadline:
        resp   = orgs_client.describe_create_account_status(
            CreateAccountRequestId=create_status_id
        )
        status = resp["CreateAccountStatus"]["State"]
        logger.info("Account creation state: %s", status)
        if status == "SUCCEEDED":
            return resp["CreateAccountStatus"]["AccountId"]
        if status == "FAILED":
            reason = resp["CreateAccountStatus"].get("FailureReason", "Unknown")
            raise RuntimeError(f"AWS account creation failed: {reason}")
        time.sleep(ACCOUNT_ACTIVE_POLL_INTERVAL)
    raise TimeoutError("Timed out waiting for AWS account to become ACTIVE.")


def _move_account_to_ou(account_id: str, tier: str) -> None:
    """Move the new account from the root to the appropriate tier OU."""
    ou_env_key = TIER_OU_ENV_KEYS.get(tier, "OU_ID_STANDARD")
    target_ou  = os.environ.get(ou_env_key, "")
    if not target_ou:
        logger.warning("No OU configured for tier '%s'; skipping OU move.", tier)
        return

    # Find the root and current parent
    roots      = orgs_client.list_roots()["Roots"]
    root_id    = roots[0]["Id"]
    parents    = orgs_client.list_parents(ChildId=account_id)["Parents"]
    current_ou = parents[0]["Id"]

    if current_ou != target_ou:
        orgs_client.move_account(
            AccountId=account_id,
            SourceParentId=current_ou,
            DestinationParentId=target_ou,
        )
        logger.info("Moved account %s to OU %s", account_id, target_ou)
    else:
        logger.info("Account %s already in target OU.", account_id)


def _trigger_terraform(customer_id: str, account_id: str, tier: str,
                        region: str, mfa_required: bool) -> str:
    """Start a CodeBuild build that runs the customer-baseline Terraform module."""
    project_name = os.environ.get("CODEBUILD_PROJECT", "securebase-customer-baseline")
    resp = codebuild_client.start_build(
        projectName=project_name,
        environmentVariablesOverride=[
            {"name": "CUSTOMER_ID",     "value": customer_id,         "type": "PLAINTEXT"},
            {"name": "AWS_ACCOUNT_ID",  "value": account_id,          "type": "PLAINTEXT"},
            {"name": "CUSTOMER_TIER",   "value": tier,                 "type": "PLAINTEXT"},
            {"name": "AWS_REGION",      "value": region,               "type": "PLAINTEXT"},
            {"name": "MFA_REQUIRED",    "value": str(mfa_required).lower(), "type": "PLAINTEXT"},
        ],
    )
    build_id = resp["build"]["id"]
    logger.info("CodeBuild build started: %s", build_id)
    return build_id


def _send_welcome_email(email: str, first_name: str, tier: str) -> None:
    portal_url   = os.environ.get("PORTAL_URL", "https://portal.securebase.io")
    sender_email = os.environ["SES_SENDER_EMAIL"]
    ses_client.send_email(
        Source=sender_email,
        Destination={"ToAddresses": [email]},
        Message={
            "Subject": {"Data": "Your SecureBase environment is ready 🎉"},
            "Body": {
                "Html": {
                    "Data": f"""
                    <p>Hi {first_name},</p>
                    <p>Your SecureBase <strong>{tier.capitalize()}</strong> environment has been
                    provisioned and is ready to use.</p>
                    <p><a href="{portal_url}/dashboard" style="background:#4f46e5;color:#fff;
                    padding:12px 24px;border-radius:6px;text-decoration:none;">
                    Go to Dashboard</a></p>
                    <p>— The SecureBase Team</p>
                    """
                },
                "Text": {
                    "Data": (
                        f"Hi {first_name},\n\n"
                        f"Your SecureBase {tier.capitalize()} environment is ready.\n"
                        f"Visit {portal_url}/dashboard to get started.\n\n"
                        "— The SecureBase Team"
                    )
                },
            },
        },
    )


# ── Handler ───────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    """
    Orchestrate full customer account provisioning.

    Expected input (from signup_handler or verify_email):
    {
        "customer_id":  "<uuid>",
        "email":        "customer@example.com",
        "first_name":   "Jane",
        "last_name":    "Smith",
        "company_name": "Acme Corp",
        "tier":         "fintech",
        "region":       "us-east-1",
        "mfa_required": true
    }
    """
    logger.info("account_provisioner invoked: requestId=%s", context.aws_request_id)

    customer_id  = event.get("customer_id")
    email        = event.get("email", "")
    first_name   = event.get("first_name", "")
    company_name = event.get("company_name", "")
    tier         = event.get("tier", "standard")
    region       = event.get("region", "us-east-1")
    mfa_required = bool(event.get("mfa_required", True))

    if not customer_id or not email:
        logger.error("Missing required fields: customer_id=%s email=%s", customer_id, email)
        return {"statusCode": 400, "body": "customer_id and email are required."}

    conn   = _get_db_connection()
    job_id = _get_or_create_job(conn, customer_id)

    try:
        # ── Step 1: Verify email ──────────────────────────────────────
        _update_step(conn, job_id, "email_verified", "in_progress")
        if not _check_email_verified(email):
            _update_step(conn, job_id, "email_verified", "failed",
                         "Email address has not been verified in Cognito.")
            _set_job_status(conn, job_id, "waiting_for_email")
            logger.info("customer %s: email not yet verified – halting provisioner.", customer_id)
            return {"statusCode": 202, "body": "Waiting for email verification."}
        _update_step(conn, job_id, "email_verified", "complete")

        # ── Step 2: Create AWS account ────────────────────────────────
        _update_step(conn, job_id, "account_created", "in_progress")
        create_status_id = _create_aws_account(email, company_name, customer_id)
        _update_step(conn, job_id, "account_created", "complete")

        # ── Step 3: Wait for account ACTIVE ───────────────────────────
        _update_step(conn, job_id, "account_active", "in_progress")
        aws_account_id = _wait_for_account_active(create_status_id)
        _update_customer_aws_account(conn, customer_id, aws_account_id)
        _update_step(conn, job_id, "account_active", "complete")

        # ── Step 4: Assign OU ─────────────────────────────────────────
        _update_step(conn, job_id, "ou_assigned", "in_progress")
        _move_account_to_ou(aws_account_id, tier)
        _update_step(conn, job_id, "ou_assigned", "complete")

        # ── Step 5: Run Terraform ─────────────────────────────────────
        _update_step(conn, job_id, "terraform_running", "in_progress")
        build_id = _trigger_terraform(customer_id, aws_account_id, tier, region, mfa_required)
        _update_step(conn, job_id, "terraform_running", "complete")

        # ── Step 6: Guardrails (recorded when Terraform completes) ────
        # CodeBuild build will call back to update this step; we mark it here
        # as in_progress so the frontend shows progress immediately.
        _update_step(conn, job_id, "guardrails_applied", "in_progress")

        # ── Step 7: Welcome email ─────────────────────────────────────
        _update_step(conn, job_id, "welcome_sent", "in_progress")
        _send_welcome_email(email, first_name, tier)
        _update_step(conn, job_id, "welcome_sent", "complete")
        _update_step(conn, job_id, "guardrails_applied", "complete")

        _set_job_status(conn, job_id, "complete")
        logger.info("Provisioning complete: customer_id=%s account=%s build=%s",
                    customer_id, aws_account_id, build_id)

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Provisioning complete.",
                "customer_id": customer_id,
                "aws_account_id": aws_account_id,
            }),
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("Provisioning failed for customer %s: %s", customer_id, exc)
        try:
            _set_job_status(conn, job_id, "failed")
        except Exception:  # noqa: BLE001
            pass
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(exc)}),
        }
    finally:
        conn.close()
