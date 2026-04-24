"""
Failover Orchestrator — automated us-east-1 → us-west-2 failover

Triggered by CloudWatch alarm via EventBridge when primary region health
drops below threshold. Promotes Aurora secondary, updates active-region
SSM parameter, and pages on-call.

SAFE GUARD: Requires SSM /securebase/dr/failover_enabled = "true" to proceed.
Manual override prevents accidental automated failover in dev.
"""
import json
import os
import logging
import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

PRIMARY_REGION        = os.environ.get("PRIMARY_REGION", "us-east-1")
SECONDARY_REGION      = os.environ.get("SECONDARY_REGION", "us-west-2")
GLOBAL_CLUSTER_ID     = os.environ.get("AURORA_GLOBAL_CLUSTER_ID", "")
SECONDARY_CLUSTER_ARN = os.environ.get("SECONDARY_AURORA_CLUSTER_ARN", "")
ROUTE53_HEALTH_CHECK  = os.environ.get("ROUTE53_HEALTH_CHECK_ID", "")
ACTIVE_REGION_PARAM   = "/securebase/active_region"
FAILOVER_ENABLED_PARAM = "/securebase/dr/failover_enabled"
ALERT_SNS_ARN         = os.environ.get("ALERT_SNS_ARN", "")
ENVIRONMENT           = os.environ.get("ENVIRONMENT", "prod")

ssm  = boto3.client("ssm", region_name=PRIMARY_REGION)
rds  = boto3.client("rds", region_name=PRIMARY_REGION)
sns  = boto3.client("sns", region_name=PRIMARY_REGION)


def _failover_enabled() -> bool:
    try:
        val = ssm.get_parameter(Name=FAILOVER_ENABLED_PARAM)["Parameter"]["Value"]
        return val.lower() == "true"
    except ClientError:
        return False


def _promote_aurora() -> None:
    if not GLOBAL_CLUSTER_ID or not SECONDARY_CLUSTER_ARN:
        logger.warning("Aurora global cluster config missing — skipping promotion")
        return
    logger.info("Removing secondary cluster from global cluster to promote...")
    rds.remove_from_global_cluster(
        GlobalClusterIdentifier=GLOBAL_CLUSTER_ID,
        DbClusterIdentifier=SECONDARY_CLUSTER_ARN,
    )
    logger.info("Aurora secondary promoted to standalone writer")


def _update_active_region(region: str) -> None:
    ssm.put_parameter(
        Name=ACTIVE_REGION_PARAM,
        Value=region,
        Type="String",
        Overwrite=True,
    )
    logger.info("Active region SSM updated: %s", region)


def _page_oncall(message: str) -> None:
    if not ALERT_SNS_ARN:
        logger.warning("No alert SNS ARN — on-call page skipped")
        return
    sns.publish(
        TopicArn=ALERT_SNS_ARN,
        Subject=f"[{ENVIRONMENT.upper()}] FAILOVER INITIATED — {SECONDARY_REGION}",
        Message=message,
    )


def handler(event, _context):
    logger.info("Failover orchestrator triggered: %s", json.dumps(event))

    if not _failover_enabled():
        logger.warning("Automated failover disabled (SSM %s != 'true') — skipping", FAILOVER_ENABLED_PARAM)
        return {"statusCode": 200, "body": "failover disabled"}

    # Idempotency: check current active region
    try:
        current = ssm.get_parameter(Name=ACTIVE_REGION_PARAM)["Parameter"]["Value"]
        if current == SECONDARY_REGION:
            logger.info("Already failed over to %s — no action needed", SECONDARY_REGION)
            return {"statusCode": 200, "body": "already failed over"}
    except ClientError:
        pass

    timestamp = datetime.now(timezone.utc).isoformat()
    try:
        _promote_aurora()
        _update_active_region(SECONDARY_REGION)

        msg = (
            f"FAILOVER COMPLETE at {timestamp}\n"
            f"Primary region {PRIMARY_REGION} appears degraded.\n"
            f"Traffic routed to {SECONDARY_REGION}.\n"
            f"Aurora secondary promoted to standalone writer.\n\n"
            f"Next steps:\n"
            f"1. Verify {SECONDARY_REGION} is handling traffic\n"
            f"2. Investigate {PRIMARY_REGION} root cause\n"
            f"3. Run failback_orchestrator when primary recovers\n"
            f"Runbook: https://github.com/cedrickbyrd/securebase-app/blob/main/DR_RUNBOOK.md"
        )
        _page_oncall(msg)

        logger.info("Failover to %s completed at %s", SECONDARY_REGION, timestamp)
        return {"statusCode": 200, "body": f"failed over to {SECONDARY_REGION}"}

    except Exception as e:
        logger.error("Failover failed: %s", e)
        _page_oncall(f"FAILOVER FAILED at {timestamp}\nError: {e}\nMANUAL INTERVENTION REQUIRED")
        raise
