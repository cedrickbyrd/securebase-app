"""
onboarding_status.py – SecureBase onboarding status Lambda.

Endpoint: GET /onboarding/status?customer_id=<uuid>

Returns the current onboarding job and its step statuses for the given
customer. The frontend polls this endpoint every 8 seconds to render the
OnboardingProgress component.

Environment variables:
  DB_SECRET_ARN  – Secrets Manager ARN for Aurora credentials
  LOG_LEVEL      – (optional) DEBUG|INFO|WARNING|ERROR
"""

import json
import logging
import os

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor

# ── Logging ───────────────────────────────────────────────────────────────
log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO))
logger = logging.getLogger(__name__)

secrets_client = boto3.client("secretsmanager")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
}

STEP_ORDER = [
    "email_verified",
    "account_created",
    "account_active",
    "ou_assigned",
    "terraform_running",
    "guardrails_applied",
    "welcome_sent",
]


def _resp(status: int, body) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=str),
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


def _get_customer_id_from_token(event: dict) -> str | None:
    """
    Extract customer_id from query params.  Falls back to JWT claim if
    the Authorization header is present (future enhancement – optional).
    """
    params = event.get("queryStringParameters") or {}
    return params.get("customer_id")


def _fetch_job(conn, customer_id: str) -> dict | None:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, customer_id, status, error_message, created_at, updated_at
            FROM onboarding_jobs
            WHERE customer_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (customer_id,),
        )
        return cur.fetchone()


def _fetch_steps(conn, job_id: str) -> list[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT step_key, status, started_at, completed_at, error_message
            FROM onboarding_steps
            WHERE job_id = %s
            """,
            (job_id,),
        )
        rows = cur.fetchall()

    # Sort by canonical step order
    step_map = {r["step_key"]: dict(r) for r in rows}
    ordered  = []
    for key in STEP_ORDER:
        if key in step_map:
            ordered.append(step_map[key])
    # Append any unrecognised steps at the end
    for key, val in step_map.items():
        if key not in STEP_ORDER:
            ordered.append(val)
    return ordered


def lambda_handler(event, context):
    """GET /onboarding/status?customer_id=<uuid>"""
    logger.info("onboarding_status invoked: requestId=%s", context.aws_request_id)

    if event.get("httpMethod") == "OPTIONS":
        return _resp(204, {})

    customer_id = _get_customer_id_from_token(event)
    if not customer_id:
        return _resp(400, {"error": "customer_id query parameter is required."})

    conn = None
    try:
        conn = _get_db_connection()
        job  = _fetch_job(conn, customer_id)
        if not job:
            return _resp(404, {"error": "No onboarding job found for this customer."})

        job_id = str(job["id"])
        steps  = _fetch_steps(conn, job_id)

        payload = {
            "job_id":        job_id,
            "customer_id":   customer_id,
            "status":        job["status"],
            "error_message": job.get("error_message"),
            "created_at":    job["created_at"],
            "updated_at":    job.get("updated_at"),
            "steps":         steps,
        }
        return _resp(200, payload)

    except Exception as exc:  # noqa: BLE001
        logger.exception("Error fetching onboarding status: %s", exc)
        return _resp(500, {"error": "Internal server error."})
    finally:
        if conn:
            conn.close()
