"""
account_provisioner.py

Lambda function for automated AWS account provisioning in the SecureBase
multi-tenant platform. Handles the full lifecycle of creating and configuring
a new customer's AWS account via AWS Organizations.
"""

import json
import logging
import os
import time
import traceback
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

import db

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- AWS clients (module-level for Lambda warm-start reuse) ---
try:
    ssm = boto3.client("ssm")
    orgs = boto3.client("organizations")
    codebuild = boto3.client("codebuild")
    ses = boto3.client("ses", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    cognito = boto3.client("cognito-idp")
except Exception:
    logger.exception("Failed to initialize AWS clients at module load")
    raise

# OU name used when moving new accounts. Defaults to "Workloads" but should be
# overridden via the PROVISIONER_OU_NAME environment variable to match the
# tier-based OUs created by Terraform (Healthcare, Fintech, GovFederal, Standard).
# TODO: Accept customer tier in the event payload and map to the appropriate OU name
# before calling move_to_ou(), e.g.:
#   _TIER_TO_OU = {
#       "healthcare":  "Healthcare",
#       "fintech":     "Fintech",
#       "gov-federal": "GovFederal",
#       "standard":    "Standard",
#   }
# This would eliminate the generic "Workloads" fallback and align with the
# tier-based OUs defined in the Terraform org module.
PROVISIONER_OU_NAME = os.environ.get("PROVISIONER_OU_NAME", "Workloads")

# Maximum email local-part length is 64 chars (RFC 5321); account name prefix.
_MAX_ACCOUNT_NAME_LEN = 40
_MAX_EMAIL_LOCAL_LEN = 64


def get_param(name):
    """Retrieve a parameter value from AWS SSM Parameter Store."""
    return ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


def update_step(job_id, step, status, error=None):
    """Upsert a single onboarding step record in the database."""
    now = datetime.now(timezone.utc).isoformat()
    db.execute_write(
        "INSERT INTO onboarding_steps(job_id, step_key, status, error_message, updated_at) "
        "VALUES(:j, :k, :s, :e, :t) "
        "ON CONFLICT(job_id, step_key) DO UPDATE SET "
        "status=EXCLUDED.status, error_message=EXCLUDED.error_message, updated_at=EXCLUDED.updated_at",
        {"j": job_id, "k": step, "s": status, "e": error, "t": now},
    )


def update_job(job_id, status, account_id=None):
    """Update the overall status (and optionally the AWS account ID) of an onboarding job."""
    now = datetime.now(timezone.utc).isoformat()
    db.execute_write(
        "UPDATE onboarding_jobs SET overall_status=:s, aws_account_id=:a, updated_at=:t WHERE id=:j",
        {"j": job_id, "s": status, "a": account_id, "t": now},
    )


def email_verified(email, pool_id):
    """Return True if the Cognito user's email attribute is verified."""
    try:
        resp = cognito.admin_get_user(UserPoolId=pool_id, Username=email)
        attrs = {a["Name"]: a["Value"] for a in resp.get("UserAttributes", [])}
        return attrs.get("email_verified", "false").lower() == "true"
    except ClientError:
        return False


def create_org_account(org_name):
    """
    Request creation of a new AWS Organizations account for the given org name.

    The generated account email follows the pattern ``aws+<name>@securebase.tximhotep.com``.
    The local part (before the @) is validated to not exceed RFC 5321's 64-character limit.

    Returns the CreateAccountStatus request ID (not the final account ID).
    """
    raw_name = f"securebase-{org_name.lower().replace(' ', '-')}"
    name = raw_name[:_MAX_ACCOUNT_NAME_LEN]
    email_local = f"aws+{name}"

    if len(email_local) > _MAX_EMAIL_LOCAL_LEN:
        email_local = email_local[:_MAX_EMAIL_LOCAL_LEN]
        logger.warning(
            "create_org_account: email local-part truncated to %d chars (org_name=%r)",
            _MAX_EMAIL_LOCAL_LEN,
            org_name,
        )

    email = f"{email_local}@securebase.tximhotep.com"
    logger.info("create_org_account: requesting account name=%r email=%r", name, email)

    retries = 0
    max_retries = 5
    backoff = 2
    while True:
        try:
            resp = orgs.create_account(
                Email=email,
                AccountName=name,
                IamUserAccessToBilling="DENY",
            )
            request_id = resp["CreateAccountStatus"]["Id"]
            logger.info("create_org_account: request submitted, request_id=%s", request_id)
            return request_id
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("TooManyRequestsException", "ThrottlingException") and retries < max_retries:
                retries += 1
                logger.warning(
                    "create_org_account: throttled (attempt %d/%d), retrying in %ds",
                    retries,
                    max_retries,
                    backoff,
                )
                time.sleep(backoff)
                backoff = min(backoff * 2, 60)
            else:
                logger.error(
                    "create_org_account: permanent error code=%s message=%s",
                    code,
                    exc.response["Error"].get("Message", ""),
                )
                raise


def wait_for_account(request_id, timeout=300):
    """
    Poll AWS Organizations until the account creation request reaches a terminal state.

    Returns the new AWS account ID on success, or raises on failure/timeout.
    """
    deadline = time.time() + timeout
    backoff = 5
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        resp = orgs.describe_create_account_status(CreateAccountRequestId=request_id)
        status = resp["CreateAccountStatus"]
        state = status["State"]
        logger.info(
            "wait_for_account: attempt=%d request_id=%s state=%s",
            attempt,
            request_id,
            state,
        )
        if state == "SUCCEEDED":
            account_id = status["AccountId"]
            logger.info("wait_for_account: succeeded, account_id=%s", account_id)
            return account_id
        if state == "FAILED":
            reason = status.get("FailureReason", "unknown")
            raise RuntimeError(f"Account creation failed: {reason}")
        time.sleep(backoff)
        backoff = min(backoff * 2, 30)
    raise TimeoutError("Account creation timed out.")


def move_to_ou(account_id):
    """
    Move the newly created account from the organization root into the target OU.

    The target OU name is controlled by the PROVISIONER_OU_NAME environment variable
    (default: "Workloads"). The OU is created if it does not already exist.
    """
    root_id = orgs.list_roots()["Roots"][0]["Id"]
    ous = orgs.list_organizational_units_for_parent(ParentId=root_id)["OrganizationalUnits"]
    ou = next((o for o in ous if o["Name"] == PROVISIONER_OU_NAME), None)
    if not ou:
        logger.info("move_to_ou: creating OU name=%r under root=%s", PROVISIONER_OU_NAME, root_id)
        ou = orgs.create_organizational_unit(
            ParentId=root_id, Name=PROVISIONER_OU_NAME
        )["OrganizationalUnit"]
    logger.info(
        "move_to_ou: moving account_id=%s to ou=%s (%s)",
        account_id,
        ou["Id"],
        ou["Name"],
    )
    orgs.move_account(
        AccountId=account_id,
        SourceParentId=root_id,
        DestinationParentId=ou["Id"],
    )


def trigger_terraform(payload, project):
    """
    Start a CodeBuild build to apply Terraform for the new customer account.

    Returns the CodeBuild build ID.
    """
    env_vars = [
        {"name": "TF_VAR_customer_account_id", "value": payload["awsAccountId"], "type": "PLAINTEXT"},
        {"name": "TF_VAR_customer_name", "value": payload["orgName"], "type": "PLAINTEXT"},
        {"name": "TF_VAR_aws_region", "value": payload["awsRegion"], "type": "PLAINTEXT"},
        {"name": "TF_VAR_mfa_enabled", "value": str(payload["mfaEnabled"]).lower(), "type": "PLAINTEXT"},
        {"name": "TF_VAR_guardrails_level", "value": payload["guardrailsLevel"], "type": "PLAINTEXT"},
        {"name": "TF_VAR_job_id", "value": payload["jobId"], "type": "PLAINTEXT"},
    ]
    resp = codebuild.start_build(
        projectName=project,
        environmentVariablesOverride=env_vars,
    )
    build_id = resp["build"]["id"]
    logger.info("trigger_terraform: started build_id=%s project=%s", build_id, project)
    return build_id


def wait_for_build(build_id, timeout=900):
    """Poll CodeBuild until the build reaches a terminal state."""
    deadline = time.time() + timeout
    backoff = 15
    while time.time() < deadline:
        build = codebuild.batch_get_builds(ids=[build_id])["builds"][0]
        status = build["buildStatus"]
        logger.info("wait_for_build: build_id=%s status=%s", build_id, status)
        if status == "SUCCEEDED":
            return
        if status in ("FAILED", "FAULT", "TIMED_OUT", "STOPPED"):
            raise RuntimeError(f"Build {status}: {build_id}")
        time.sleep(backoff)
        backoff = min(backoff * 1.5, 60)
    raise TimeoutError("CodeBuild timed out.")


def send_welcome(email, first_name, org_name, account_id, sender):
    """
    Send a welcome email to the customer via SES.

    Errors are intentionally non-fatal (welcome email failure should not
    roll back a successful provisioning), but are logged at WARNING level
    with full traceback so they are visible in CloudWatch Logs.
    """
    ses.send_email(
        Source=sender,
        Destination={"ToAddresses": [email]},
        Message={
            "Subject": {"Data": f"Your SecureBase environment is live, {first_name}!"},
            "Body": {
                "Text": {
                    "Data": (
                        f"Hi {first_name},\n\n"
                        f"Your AWS landing zone for {org_name} is ready.\n"
                        f"AWS Account ID: {account_id}\n\n"
                        "https://securebase.tximhotep.com/dashboard\n\n"
                        "— SecureBase"
                    )
                }
            },
        },
    )


def _run_provisioning(job_id, customer_id, email, org_name, aws_region,
                      mfa_enabled, guardrails_level, pool_id, cb_project, ses_sender):
    """
    Execute all provisioning steps for a new customer account.

    Separated from handler() for clarity and testability.
    Returns a result dict suitable for use as the Lambda response.
    """
    # Step: account_created
    update_step(job_id, "account_created", "in_progress")
    try:
        req_id = create_org_account(org_name)
        aws_account_id = wait_for_account(req_id)
    except Exception as exc:
        logger.error(
            "Provisioning failed at account_created: job_id=%s error=%s",
            job_id, exc,
        )
        update_step(job_id, "account_created", "failed", str(exc))
        update_job(job_id, "failed")
        return {"status": "failed", "step": "account_created", "error": str(exc)}
    update_step(job_id, "account_created", "completed")

    # Step: org_linked
    update_step(job_id, "org_linked", "in_progress")
    try:
        move_to_ou(aws_account_id)
    except Exception as exc:
        logger.error(
            "Provisioning failed at org_linked: job_id=%s account_id=%s error=%s",
            job_id, aws_account_id, exc,
        )
        update_step(job_id, "org_linked", "failed", str(exc))
        update_job(job_id, "failed")
        return {"status": "failed", "step": "org_linked", "error": str(exc)}
    update_step(job_id, "org_linked", "completed")

    update_job(job_id, "in_progress", aws_account_id)
    db.execute_write(
        "UPDATE customers SET aws_account_id=:a WHERE id=:c",
        {"a": aws_account_id, "c": customer_id},
    )

    # Step: terraform_applied
    update_step(job_id, "terraform_applied", "in_progress")
    try:
        build_id = trigger_terraform(
            {
                "awsAccountId": aws_account_id,
                "orgName": org_name,
                "awsRegion": aws_region,
                "mfaEnabled": mfa_enabled,
                "guardrailsLevel": guardrails_level,
                "jobId": job_id,
            },
            cb_project,
        )
        wait_for_build(build_id)
    except Exception as exc:
        logger.error(
            "Provisioning failed at terraform_applied: job_id=%s account_id=%s error=%s",
            job_id, aws_account_id, exc,
        )
        update_step(job_id, "terraform_applied", "failed", str(exc))
        update_job(job_id, "failed")
        return {"status": "failed", "step": "terraform_applied", "error": str(exc)}
    update_step(job_id, "terraform_applied", "completed")

    # Mark guardrails and IAM roles as completed (managed by Terraform)
    update_step(job_id, "guardrails_active", "completed")
    update_step(job_id, "iam_roles_created", "completed")

    # Step: welcome_sent (non-fatal)
    update_step(job_id, "welcome_sent", "in_progress")
    try:
        rows = db.execute(
            "SELECT first_name FROM customers WHERE id=:c", {"c": customer_id}
        )
        first_name = rows[0][0] if rows else "there"
        send_welcome(email, first_name, org_name, aws_account_id, ses_sender)
    except Exception as exc:
        logger.warning(
            "send_welcome failed (non-fatal): job_id=%s error=%s\n%s",
            job_id, exc, traceback.format_exc(),
        )
    update_step(job_id, "welcome_sent", "completed")

    update_job(job_id, "completed", aws_account_id)
    db.execute_write(
        "UPDATE customers SET onboarding_status='completed' WHERE id=:c",
        {"c": customer_id},
    )
    logger.info("Provisioning complete: job_id=%s account_id=%s", job_id, aws_account_id)
    return {"status": "completed", "awsAccountId": aws_account_id}


def handler(event, context):
    """
    Lambda entry point for account provisioning.

    Expected event fields:
        jobId       (str)  - Onboarding job identifier
        customerId  (str)  - Internal customer UUID
        email       (str)  - Customer email address
        orgName     (str)  - Organisation / company name
        awsRegion   (str)  - Target AWS region
        mfaEnabled  (bool) - Optional; default True
        guardrailsLevel (str) - Optional; default "standard"
    """
    # --- Input validation ---
    required_fields = ["jobId", "customerId", "email", "orgName", "awsRegion"]
    missing = [f for f in required_fields if not event.get(f)]
    if missing:
        logger.error("handler: missing required event fields: %s", missing)
        return {"status": "failed", "error": f"Missing required fields: {missing}"}

    job_id = event["jobId"]
    customer_id = event["customerId"]
    email = event["email"]
    org_name = event["orgName"]
    aws_region = event["awsRegion"]
    mfa_enabled = event.get("mfaEnabled", True)
    guardrails_level = event.get("guardrailsLevel", "standard")

    logger.info(
        "Provisioner start: job_id=%s customer_id=%s org_name=%r region=%s",
        job_id, customer_id, org_name, aws_region,
    )

    pool_id = get_param("/securebase/cognito/user_pool_id")
    cb_project = get_param("/securebase/codebuild/project_name")
    ses_sender = get_param("/securebase/ses/from_address")

    update_job(job_id, "in_progress")

    # --- Email verification gate ---
    update_step(job_id, "email_verified", "in_progress")
    if not email_verified(email, pool_id):
        logger.info(
            "handler: email not yet verified, deferring: job_id=%s email=%s",
            job_id, email,
        )
        update_step(job_id, "email_verified", "pending")
        return {"status": "waiting_for_email_verification"}
    update_step(job_id, "email_verified", "completed")

    return _run_provisioning(
        job_id, customer_id, email, org_name, aws_region,
        mfa_enabled, guardrails_level, pool_id, cb_project, ses_sender,
    )

