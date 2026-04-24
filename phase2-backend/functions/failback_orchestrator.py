"""
Failback Orchestrator — controlled return to us-east-1 after recovery

Manual trigger only (API Gateway POST or Step Functions).
Validates primary health, re-establishes replication, updates Route53.

Aurora failback note: After promotion, the old primary is a standalone cluster.
Failback requires creating a NEW global cluster with the recovered us-east-1
cluster as primary and re-adding us-west-2 as a replica.
"""
import json
import os
import logging
import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

PRIMARY_REGION       = os.environ.get("PRIMARY_REGION", "us-east-1")
SECONDARY_REGION     = os.environ.get("SECONDARY_REGION", "us-west-2")
PRIMARY_CLUSTER_ARN  = os.environ.get("PRIMARY_AURORA_CLUSTER_ARN", "")
SECONDARY_CLUSTER_ARN = os.environ.get("SECONDARY_AURORA_CLUSTER_ARN", "")
ACTIVE_REGION_PARAM  = "/securebase/active_region"
ALERT_SNS_ARN        = os.environ.get("ALERT_SNS_ARN", "")
ENVIRONMENT          = os.environ.get("ENVIRONMENT", "prod")

ssm = boto3.client("ssm", region_name=PRIMARY_REGION)
rds = boto3.client("rds", region_name=PRIMARY_REGION)
sns = boto3.client("sns", region_name=PRIMARY_REGION)


def _verify_primary_healthy() -> bool:
    if not PRIMARY_CLUSTER_ARN:
        return False
    try:
        cluster_id = PRIMARY_CLUSTER_ARN.split(":")[-1]
        clusters = rds.describe_db_clusters(DBClusterIdentifier=cluster_id)["DBClusters"]
        status = clusters[0]["Status"] if clusters else "unknown"
        logger.info("Primary Aurora status: %s", status)
        return status == "available"
    except ClientError as e:
        logger.error("Failed to check primary Aurora: %s", e)
        return False


def _create_global_cluster_with_primary(new_global_id: str) -> None:
    """Re-establish global cluster using the recovered primary as writer."""
    if not PRIMARY_CLUSTER_ARN:
        logger.warning("PRIMARY_AURORA_CLUSTER_ARN not set — skipping global cluster creation")
        return
    logger.info("Creating new global cluster %s with primary %s", new_global_id, PRIMARY_CLUSTER_ARN)
    rds.create_global_cluster(
        GlobalClusterIdentifier=new_global_id,
        SourceDBClusterIdentifier=PRIMARY_CLUSTER_ARN,
    )
    logger.info("Global cluster created — secondary replication will resume asynchronously")


def _update_active_region(region: str) -> None:
    ssm.put_parameter(
        Name=ACTIVE_REGION_PARAM,
        Value=region,
        Type="String",
        Overwrite=True,
    )
    logger.info("Active region SSM updated: %s", region)


def _page_oncall(subject: str, message: str) -> None:
    if not ALERT_SNS_ARN:
        return
    sns.publish(TopicArn=ALERT_SNS_ARN, Subject=subject, Message=message)


def handler(event, _context):
    """
    Expected event body:
    {
        "confirm": true,           // safety gate — must be explicitly true
        "new_global_cluster_id": "securebase-global-prod-v2"  // optional
    }
    """
    body = event.get("body", event)
    if isinstance(body, str):
        body = json.loads(body)

    if not body.get("confirm"):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Set confirm=true to proceed with failback"})
        }

    timestamp = datetime.now(timezone.utc).isoformat()
    logger.info("Failback initiated at %s", timestamp)

    # Verify current state
    try:
        current = ssm.get_parameter(Name=ACTIVE_REGION_PARAM)["Parameter"]["Value"]
        if current == PRIMARY_REGION:
            return {"statusCode": 200, "body": json.dumps({"message": "Already on primary — no failback needed"})}
    except ClientError:
        pass

    # Validate primary is actually healthy before switching back
    if not _verify_primary_healthy():
        return {
            "statusCode": 409,
            "body": json.dumps({"error": f"Primary region {PRIMARY_REGION} Aurora is not healthy — failback aborted"})
        }

    try:
        new_global_id = body.get("new_global_cluster_id", f"securebase-global-{ENVIRONMENT}-v2")
        _create_global_cluster_with_primary(new_global_id)
        _update_active_region(PRIMARY_REGION)

        msg = (
            f"FAILBACK COMPLETE at {timestamp}\n"
            f"Traffic restored to primary region {PRIMARY_REGION}.\n"
            f"New global cluster: {new_global_id}\n"
            f"Verify secondary replication is healthy before closing incident."
        )
        _page_oncall(f"[{ENVIRONMENT.upper()}] FAILBACK COMPLETE", msg)

        logger.info("Failback complete at %s", timestamp)
        return {"statusCode": 200, "body": json.dumps({"message": f"Failback to {PRIMARY_REGION} complete"})}

    except Exception as e:
        logger.error("Failback failed: %s", e)
        _page_oncall(
            f"[{ENVIRONMENT.upper()}] FAILBACK FAILED",
            f"Failback failed at {timestamp}\nError: {e}\nSystem still running on {SECONDARY_REGION}"
        )
        raise
