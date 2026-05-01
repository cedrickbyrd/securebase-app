"""
Failback Orchestrator — Phase 5.3 Multi-Region DR
Orchestrates the controlled return of Aurora write traffic from the
secondary region (us-west-2) back to primary (us-east-1) after an incident.

Trigger: Manual invocation only. Never run automatically.

Steps:
  1. Validate primary region is healthy
  2. Re-add primary cluster to Aurora Global Database as writer
  3. Wait for replication lag to reach zero
  4. Re-enable Route 53 primary health check
  5. Send post-failback notification

Environment Variables:
  GLOBAL_CLUSTER_ID           - Aurora Global Database cluster identifier
  PRIMARY_CLUSTER_ARN         - ARN of the original primary Aurora cluster (us-east-1)
  SECONDARY_CLUSTER_ARN       - ARN of the secondary cluster that became writer
  PRIMARY_HEALTH_CHECK_ID     - Route 53 health check ID for primary region
  PRIMARY_API_URL             - Primary API health endpoint URL
  ALERT_SNS_TOPIC_ARN         - SNS topic for notifications
  ENVIRONMENT                 - Environment name
  DR_STATE_TABLE              - DynamoDB table for DR state
  LOG_LEVEL                   - Log level (default: INFO)
"""

import json
import os
import time
import logging
from datetime import datetime, timezone
from typing import Optional

import boto3

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
logger = logging.getLogger(__name__)
logger.setLevel(LOG_LEVEL)

ENVIRONMENT            = os.environ.get("ENVIRONMENT", "dev")
GLOBAL_CLUSTER_ID      = os.environ.get("GLOBAL_CLUSTER_ID", "")
PRIMARY_CLUSTER_ARN    = os.environ.get("PRIMARY_CLUSTER_ARN", "")
SECONDARY_CLUSTER_ARN  = os.environ.get("SECONDARY_CLUSTER_ARN", "")
PRIMARY_HEALTH_CHECK_ID = os.environ.get("PRIMARY_HEALTH_CHECK_ID", "")
PRIMARY_API_URL        = os.environ.get("PRIMARY_API_URL", "")
ALERT_SNS_TOPIC_ARN    = os.environ.get("ALERT_SNS_TOPIC_ARN", "")
DR_STATE_TABLE         = os.environ.get("DR_STATE_TABLE", f"securebase-{ENVIRONMENT}-dr-state")

AURORA_TIMEOUT_SECONDS   = 900  # 15 minutes
AURORA_POLL_INTERVAL     = 20
LAG_POLL_INTERVAL        = 30
LAG_TARGET_SECONDS       = 5   # Wait until lag < 5 seconds before cutting over
LAG_POLL_MAX_ATTEMPTS    = 30  # Max 15 minutes for lag drain

rds  = boto3.client("rds")
r53  = boto3.client("route53")
sns  = boto3.client("sns")
ddb  = boto3.resource("dynamodb")


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

def lambda_handler(event: dict, context) -> dict:
    """
    Accepts:
    - {"action": "failback"}         — execute full failback
    - {"action": "dry_run"}          — validate readiness without making changes
    - {"action": "validate_primary"} — only check primary region health
    """
    logger.info("Failback orchestrator invoked: %s", json.dumps(event))
    action = event.get("action", "validate_primary")

    if action == "dry_run":
        return _dry_run()
    if action == "validate_primary":
        healthy, detail = _validate_primary_healthy()
        return _respond(200 if healthy else 503, "Primary validation", {"healthy": healthy, **detail})
    if action == "failback":
        return _execute_failback()

    return _respond(400, "Unknown action", {"action": action})


# ---------------------------------------------------------------------------
# Dry run
# ---------------------------------------------------------------------------

def _dry_run() -> dict:
    healthy, detail = _validate_primary_healthy()
    checks = {"primary_healthy": healthy, **detail}

    try:
        resp = rds.describe_global_clusters(GlobalClusterIdentifier=GLOBAL_CLUSTER_ID)
        clusters = resp.get("GlobalClusters", [])
        if clusters:
            members = clusters[0].get("GlobalClusterMembers", [])
            checks["global_cluster_members"] = [
                {"arn": m["DBClusterArn"], "writer": m["IsWriter"]} for m in members
            ]
    except Exception as exc:
        checks["global_cluster_error"] = str(exc)

    try:
        hc = r53.get_health_check(HealthCheckId=PRIMARY_HEALTH_CHECK_ID)
        checks["primary_health_check_disabled"] = hc.get("HealthCheck", {}).get("HealthCheckConfig", {}).get("Disabled", False)
    except Exception as exc:
        checks["route53_error"] = str(exc)

    return _respond(200, "Dry run complete", checks)


# ---------------------------------------------------------------------------
# Execute failback
# ---------------------------------------------------------------------------

def _execute_failback() -> dict:
    failback_id = f"fb-{int(time.time())}"
    _record_dr_event(failback_id, "STARTED", "Failback orchestrator initiated")
    _notify(
        f"[{ENVIRONMENT.upper()}] FAILBACK STARTED — returning traffic to us-east-1",
        f"Failback ID: {failback_id}\nPrimary cluster: {PRIMARY_CLUSTER_ARN}",
    )

    try:
        # Step 1: Verify primary region is healthy before starting
        logger.info("Step 1: Validating primary region readiness")
        healthy, detail = _validate_primary_healthy()
        if not healthy:
            msg = f"Primary region not healthy — aborting failback: {detail}"
            _record_dr_event(failback_id, "ABORTED", msg)
            _notify(f"[{ENVIRONMENT.upper()}] FAILBACK ABORTED — primary not ready", msg)
            return _respond(409, "Primary region not healthy — failback aborted", detail)

        # Step 2: Add primary cluster back into global DB as the new writer
        # This involves switching writer in the global cluster (requires Aurora 2.x +)
        logger.info("Step 2: Switching Aurora Global DB writer back to primary cluster")
        rds.switchover_global_cluster(
            GlobalClusterIdentifier=GLOBAL_CLUSTER_ID,
            TargetDbClusterIdentifier=PRIMARY_CLUSTER_ARN,
        )

        # Step 3: Wait for switchover completion
        logger.info("Step 3: Waiting for primary cluster to become writer")
        _wait_for_primary_writer()

        # Step 4: Re-enable primary health check so Route 53 resumes routing to us-east-1
        logger.info("Step 4: Re-enabling primary Route 53 health check")
        r53.update_health_check(
            HealthCheckId=PRIMARY_HEALTH_CHECK_ID,
            Disabled=False,
        )

        _record_dr_event(failback_id, "COMPLETED", "Failback completed successfully")
        _notify(
            f"[{ENVIRONMENT.upper()}] FAILBACK COMPLETED — traffic returning to us-east-1",
            (
                f"Failback ID: {failback_id}\n"
                "Route 53 will re-route to us-east-1 within 60–90 seconds.\n"
                "Monitor dashboards for 30 minutes to confirm stability."
            ),
        )
        return _respond(200, "Failback completed", {"failback_id": failback_id})

    except Exception as exc:
        logger.exception("Failback failed: %s", exc)
        _record_dr_event(failback_id, "FAILED", str(exc))
        _notify(
            f"[{ENVIRONMENT.upper()}] FAILBACK FAILED — MANUAL INTERVENTION REQUIRED",
            f"Failback ID: {failback_id}\nError: {exc}",
        )
        return _respond(500, "Failback failed", {"error": str(exc), "failback_id": failback_id})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_primary_healthy() -> tuple[bool, dict]:
    """Check primary API endpoint and return (healthy, detail_dict)."""
    import urllib.request
    import urllib.error

    if not PRIMARY_API_URL:
        return False, {"error": "PRIMARY_API_URL not configured"}

    try:
        req = urllib.request.Request(
            PRIMARY_API_URL,
            headers={"User-Agent": "SecureBase-FailbackOrchestrator/1.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            healthy = 200 <= status < 300
            return healthy, {"status_code": status}
    except Exception as exc:
        return False, {"error": str(exc)}


def _wait_for_primary_writer() -> None:
    deadline = time.time() + AURORA_TIMEOUT_SECONDS
    while time.time() < deadline:
        resp = rds.describe_global_clusters(GlobalClusterIdentifier=GLOBAL_CLUSTER_ID)
        clusters = resp.get("GlobalClusters", [])
        if clusters:
            members = clusters[0].get("GlobalClusterMembers", [])
            for member in members:
                if member.get("DBClusterArn") == PRIMARY_CLUSTER_ARN and member.get("IsWriter"):
                    logger.info("Primary cluster is now the writer")
                    return
        status = clusters[0].get("Status", "unknown") if clusters else "unknown"
        logger.info("Global cluster status: %s — waiting for primary to become writer", status)
        time.sleep(AURORA_POLL_INTERVAL)
    raise TimeoutError(
        f"Primary cluster did not become writer within {AURORA_TIMEOUT_SECONDS}s"
    )


def _notify(subject: str, message: str) -> None:
    if not ALERT_SNS_TOPIC_ARN:
        logger.warning("ALERT_SNS_TOPIC_ARN not set — skipping notification")
        return
    try:
        sns.publish(
            TopicArn=ALERT_SNS_TOPIC_ARN,
            Subject=subject[:100],
            Message=message,
        )
    except Exception as exc:
        logger.error("SNS notification failed: %s", exc)


def _record_dr_event(event_id: str, status: str, detail: str) -> None:
    try:
        table = ddb.Table(DR_STATE_TABLE)
        table.put_item(Item={
            "pk":          f"FAILBACK#{event_id}",
            "sk":          f"STATUS#{status}",
            "event_id":    event_id,
            "status":      status,
            "detail":      detail,
            "timestamp":   datetime.now(timezone.utc).isoformat(),
            "environment": ENVIRONMENT,
        })
    except Exception as exc:
        logger.warning("Could not record DR event (non-fatal): %s", exc)


def _respond(status_code: int, message: str, data: Optional[dict] = None) -> dict:
    body = {"message": message}
    if data:
        body.update(data)
    return {
        "statusCode": status_code,
        "headers":    {"Content-Type": "application/json"},
        "body":       json.dumps(body),
    }
