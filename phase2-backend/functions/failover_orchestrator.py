"""
Failover Orchestrator — Phase 5.3 Multi-Region DR
Automates promotion of the Aurora Global Database secondary cluster to primary,
updates Route 53 DNS weights, and notifies the alerting pipeline.

Trigger: EventBridge rule on Route53 health check failure, or manual invocation.

Environment Variables:
  GLOBAL_CLUSTER_ID        - Aurora Global Database cluster identifier
  SECONDARY_CLUSTER_ARN    - ARN of the secondary Aurora cluster (us-west-2)
  HOSTED_ZONE_ID           - Route 53 hosted zone ID
  PRIMARY_DNS_RECORD       - DNS record name (api.securebase.tximhotep.com)
  PRIMARY_HEALTH_CHECK_ID  - Route 53 health check ID for primary region
  ALERT_SNS_TOPIC_ARN      - Critical SNS topic ARN to notify on failover
  ENVIRONMENT              - Environment name (dev, staging, prod)
  DR_STATE_TABLE           - DynamoDB table name for DR state tracking
  LOG_LEVEL                - Log level (default: INFO)
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

ENVIRONMENT          = os.environ.get("ENVIRONMENT", "dev")
GLOBAL_CLUSTER_ID    = os.environ.get("GLOBAL_CLUSTER_ID", "")
SECONDARY_CLUSTER_ARN = os.environ.get("SECONDARY_CLUSTER_ARN", "")
HOSTED_ZONE_ID       = os.environ.get("HOSTED_ZONE_ID", "")
PRIMARY_DNS_RECORD   = os.environ.get("PRIMARY_DNS_RECORD", "api.securebase.tximhotep.com")
PRIMARY_HEALTH_CHECK_ID = os.environ.get("PRIMARY_HEALTH_CHECK_ID", "")
ALERT_SNS_TOPIC_ARN  = os.environ.get("ALERT_SNS_TOPIC_ARN", "")
DR_STATE_TABLE       = os.environ.get("DR_STATE_TABLE", f"securebase-{ENVIRONMENT}-dr-state")

# Maximum seconds to wait for Aurora detach/promote to complete
AURORA_PROMOTE_TIMEOUT_SECONDS = 600
AURORA_POLL_INTERVAL_SECONDS   = 20

rds  = boto3.client("rds")
r53  = boto3.client("route53")
sns  = boto3.client("sns")
ddb  = boto3.resource("dynamodb")


# ---------------------------------------------------------------------------
# Public handler
# ---------------------------------------------------------------------------

def lambda_handler(event: dict, context) -> dict:
    """
    Main entry point.  Accepts:
    - EventBridge rule payload (source: "aws.route53", detail-type: "Health Check Status Change")
    - Manual invocation with {"action": "failover"} or {"action": "dry_run"}
    """
    logger.info("Failover orchestrator invoked: %s", json.dumps(event))

    action = _resolve_action(event)
    logger.info("Resolved action: %s", action)

    if action == "dry_run":
        return _dry_run()

    if action == "failover":
        return _execute_failover()

    return _respond(200, "No action taken", {"reason": "action_not_recognized", "action": action})


# ---------------------------------------------------------------------------
# Dry run
# ---------------------------------------------------------------------------

def _dry_run() -> dict:
    checks = {}
    try:
        hc = r53.get_health_check_status(HealthCheckId=PRIMARY_HEALTH_CHECK_ID)
        checks["primary_health_status"] = [
            obs.get("StatusReport", {}).get("Status") for obs in hc.get("HealthCheckObservations", [])
        ]
    except Exception as exc:
        checks["primary_health_check_error"] = str(exc)

    try:
        resp = rds.describe_global_clusters(GlobalClusterIdentifier=GLOBAL_CLUSTER_ID)
        clusters = resp.get("GlobalClusters", [])
        checks["global_cluster_found"] = bool(clusters)
        if clusters:
            members = clusters[0].get("GlobalClusterMembers", [])
            checks["cluster_members"] = [
                {"arn": m["DBClusterArn"], "writer": m["IsWriter"]} for m in members
            ]
    except Exception as exc:
        checks["global_cluster_error"] = str(exc)

    return _respond(200, "Dry run complete", checks)


# ---------------------------------------------------------------------------
# Execute failover
# ---------------------------------------------------------------------------

def _execute_failover() -> dict:
    failover_id = f"fo-{int(time.time())}"
    _record_dr_event(failover_id, "STARTED", "Failover orchestrator initiated")
    _notify(f"[{ENVIRONMENT.upper()}] FAILOVER STARTED — promoting secondary Aurora cluster",
            f"Failover ID: {failover_id}\nTarget cluster: {SECONDARY_CLUSTER_ARN}")

    try:
        # Step 1: Remove secondary cluster from global DB (promotes it to standalone writer)
        logger.info("Step 1: Detaching secondary cluster from global DB")
        rds.remove_from_global_cluster(
            GlobalClusterIdentifier=GLOBAL_CLUSTER_ID,
            DbClusterIdentifier=SECONDARY_CLUSTER_ARN,
        )

        # Step 2: Wait for promotion to complete
        logger.info("Step 2: Waiting for secondary cluster to become available as standalone writer")
        _wait_for_cluster_available(SECONDARY_CLUSTER_ARN)

        # Step 3: Update Route 53 to route all traffic to us-west-2
        logger.info("Step 3: Updating Route 53 records to secondary region")
        _flip_route53_to_secondary()

        _record_dr_event(failover_id, "COMPLETED", "Failover completed successfully")
        _notify(
            f"[{ENVIRONMENT.upper()}] FAILOVER COMPLETED — traffic now on us-west-2",
            f"Failover ID: {failover_id}\nAction required: investigate primary region, then run failback.",
        )
        return _respond(200, "Failover completed", {"failover_id": failover_id})

    except Exception as exc:
        logger.exception("Failover failed: %s", exc)
        _record_dr_event(failover_id, "FAILED", str(exc))
        _notify(
            f"[{ENVIRONMENT.upper()}] FAILOVER FAILED — MANUAL INTERVENTION REQUIRED",
            f"Failover ID: {failover_id}\nError: {exc}",
        )
        return _respond(500, "Failover failed", {"error": str(exc), "failover_id": failover_id})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_action(event: dict) -> str:
    # Manual invocation
    if "action" in event:
        return event["action"]
    # EventBridge Route 53 health check state change
    source = event.get("source", "")
    detail = event.get("detail", {})
    if source == "aws.route53":
        status = detail.get("status", "")
        if status in ("FAILURE", "LAST_FAILURE_DURATION_IN_SECONDS_EXCEEDED"):
            return "failover"
    return "noop"


def _wait_for_cluster_available(cluster_arn: str) -> None:
    deadline = time.time() + AURORA_PROMOTE_TIMEOUT_SECONDS
    while time.time() < deadline:
        resp = rds.describe_db_clusters(DBClusterIdentifier=cluster_arn)
        status = resp["DBClusters"][0].get("Status", "")
        logger.info("Cluster status: %s", status)
        if status == "available":
            return
        time.sleep(AURORA_POLL_INTERVAL_SECONDS)
    raise TimeoutError(
        f"Cluster {cluster_arn} did not become available within {AURORA_PROMOTE_TIMEOUT_SECONDS}s"
    )


def _flip_route53_to_secondary() -> None:
    """
    Set the primary failover record health check to disabled so Route 53
    immediately falls over to the secondary record.  In a real deployment the
    secondary record's health check will pass, completing the failover.
    """
    if not HOSTED_ZONE_ID or not PRIMARY_DNS_RECORD:
        logger.warning("Route 53 config not set — skipping DNS update")
        return

    r53.update_health_check(
        HealthCheckId=PRIMARY_HEALTH_CHECK_ID,
        Disabled=True,
    )
    logger.info("Primary health check disabled — Route 53 failover active")


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


def _record_dr_event(failover_id: str, status: str, detail: str) -> None:
    try:
        table = ddb.Table(DR_STATE_TABLE)
        table.put_item(Item={
            "pk":          f"FAILOVER#{failover_id}",
            "sk":          f"STATUS#{status}",
            "failover_id": failover_id,
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
