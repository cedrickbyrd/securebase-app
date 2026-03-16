"""
verify_email.py – SecureBase email-verification Lambda.

POST /verify-email  { "token": "<jobId>", "email": "..." }
GET  /verify-email?token=<jobId>&email=<email>  (link click from SES email)

Marks Cognito email_verified=true, updates the DB, then re-invokes
account_provisioner so provisioning resumes.

All DB access via Aurora Data API (rds-data) — no psycopg2 needed.
Config via SSM Parameter Store.
"""

import json
import logging
import os

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ssm      = boto3.client("ssm")
cognito  = boto3.client("cognito-idp")
lambda_  = boto3.client("lambda")
rds      = boto3.client("rds-data")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "https://securebase.tximhotep.com"),
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
}
PORTAL_URL = os.environ.get("PORTAL_URL", "https://securebase.tximhotep.com")


def resp(status, body):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps(body)}


def get_param(name):
    return ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


def db_exec(sql, params, rarn, sarn, db):
    return rds.execute_statement(
        resourceArn=rarn, secretArn=sarn, database=db,
        sql=sql, parameters=params
    )


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return resp(204, {})

    method = event.get("httpMethod", "POST")

    # Parse token (jobId) and email from body or query string
    if method == "GET":
        params = event.get("queryStringParameters") or {}
        job_id = params.get("token", "").strip()
        email  = params.get("email", "").strip().lower()
    else:
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return resp(400, {"error": "Invalid JSON."})
        job_id = body.get("token", "").strip()
        email  = body.get("email", "").strip().lower()

    if not job_id or not email:
        return resp(400, {"error": "token and email are required."})

    # Load SSM config
    try:
        rarn        = get_param("/securebase/db/resource_arn")
        sarn        = get_param("/securebase/db/secret_arn")
        db          = get_param("/securebase/db/name")
        pool_id     = get_param("/securebase/cognito/user_pool_id")
        provisioner = get_param("/securebase/provisioner/function")
    except ClientError as e:
        logger.error("SSM error: %s", e)
        return resp(500, {"error": "Configuration error."})

    db_args = (rarn, sarn, db)

    # Validate job exists and belongs to this email
    try:
        rows = db_exec(
            """
            SELECT j.id, j.customer_id, c.email, c.first_name, c.org_name,
                   c.aws_region, c.mfa_enabled, c.guardrails_level
            FROM onboarding_jobs j
            JOIN customers c ON c.id = j.customer_id
            WHERE j.id = :job_id AND LOWER(c.email) = :email
            LIMIT 1
            """,
            [{"name":"job_id","value":{"stringValue":job_id}},
             {"name":"email",  "value":{"stringValue":email}}],
            *db_args
        )["records"]
    except ClientError as e:
        logger.error("DB error: %s", e)
        return resp(500, {"error": "Database error."})

    if not rows:
        return resp(404, {"error": "Verification token not found or email mismatch."})

    row         = rows[0]
    customer_id = row[1]["stringValue"]
    db_email    = row[2]["stringValue"]
    first_name  = row[3]["stringValue"]
    org_name    = row[4]["stringValue"]
    aws_region  = row[5]["stringValue"]
    mfa_enabled = row[6]["booleanValue"]
    guardrails  = row[7]["stringValue"]

    # Mark email verified in Cognito
    try:
        cognito.admin_update_user_attributes(
            UserPoolId=pool_id,
            Username=db_email,
            UserAttributes=[{"Name": "email_verified", "Value": "true"}],
        )
        logger.info("Cognito email_verified=true for %s", db_email)
    except ClientError as e:
        logger.error("Cognito update failed: %s", e)
        return resp(500, {"error": "Failed to verify email."})

    # Mark verified in DB
    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        db_exec(
            "UPDATE customers SET email_verified=TRUE, email_verified_at=:ts WHERE id=:cid",
            [{"name":"ts", "value":{"stringValue":now}},
             {"name":"cid","value":{"stringValue":customer_id}}],
            *db_args
        )
    except ClientError as e:
        logger.error("DB update failed: %s", e)

    # Re-invoke provisioner (async)
    try:
        lambda_.invoke(
            FunctionName=provisioner,
            InvocationType="Event",
            Payload=json.dumps({
                "jobId":          job_id,
                "customerId":     customer_id,
                "email":          db_email,
                "orgName":        org_name,
                "awsRegion":      aws_region,
                "mfaEnabled":     mfa_enabled,
                "guardrailsLevel":guardrails,
            }),
        )
        logger.info("Provisioner re-invoked for job %s", job_id)
    except Exception as e:
        logger.warning("Provisioner invoke failed (non-fatal): %s", e)

    if method == "GET":
        # Browser redirect to onboarding progress page
        return {
            "statusCode": 302,
            "headers": {
                **CORS_HEADERS,
                "Location": f"{PORTAL_URL}/onboarding?jobId={job_id}&email={db_email}",
            },
            "body": "",
        }

    return resp(200, {
        "message": "Email verified. Provisioning will begin shortly.",
        "jobId": job_id,
    })