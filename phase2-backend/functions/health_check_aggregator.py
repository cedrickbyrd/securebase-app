"""
Health Check Aggregator — EventBridge → CloudWatch custom metrics

Runs every 60s. Checks Aurora, DynamoDB, API Gateway in both regions.
Publishes SecureBase/RegionHealth custom metrics consumed by DR failover alarms.
"""
import json
import os
import logging
import time
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

PRIMARY_REGION   = os.environ.get("PRIMARY_REGION", "us-east-1")
SECONDARY_REGION = os.environ.get("SECONDARY_REGION", "us-west-2")
AURORA_CLUSTER   = os.environ.get("AURORA_CLUSTER_ID", "")
API_GW_ID        = os.environ.get("API_GATEWAY_ID", "9xyetu7zq3")
SECONDARY_API_GW_ID = os.environ.get("SECONDARY_API_GW_ID", "")
ENVIRONMENT      = os.environ.get("ENVIRONMENT", "prod")

cw = boto3.client("cloudwatch", region_name=PRIMARY_REGION)


def _check_aurora(region: str) -> bool:
    try:
        rds = boto3.client("rds", region_name=region)
        clusters = rds.describe_db_clusters(DBClusterIdentifier=AURORA_CLUSTER)["DBClusters"]
        status = clusters[0]["Status"] if clusters else "unknown"
        healthy = status == "available"
        logger.info("Aurora %s [%s]: %s", region, AURORA_CLUSTER, status)
        return healthy
    except ClientError as e:
        logger.error("Aurora health check failed [%s]: %s", region, e)
        return False


def _check_dynamodb(region: str) -> bool:
    try:
        ddb = boto3.client("dynamodb", region_name=region)
        ddb.list_tables(Limit=1)
        logger.info("DynamoDB %s: healthy", region)
        return True
    except ClientError as e:
        logger.error("DynamoDB health check failed [%s]: %s", region, e)
        return False


def _check_api_gateway(region: str, rest_api_id: str) -> bool:
    if not rest_api_id:
        logger.warning("API Gateway ID not configured [%s] — skipping API Gateway check", region)
        return True
    try:
        apigw = boto3.client("apigateway", region_name=region)
        apigw.get_rest_api(restApiId=rest_api_id)
        logger.info("API Gateway %s: healthy", region)
        return True
    except ClientError as e:
        logger.error("API Gateway health check failed [%s]: %s", region, e)
        return False


def _publish(region: str, service: str, healthy: bool) -> None:
    cw.put_metric_data(
        Namespace="SecureBase/RegionHealth",
        MetricData=[{
            "MetricName": "ServiceHealth",
            "Dimensions": [
                {"Name": "Region",      "Value": region},
                {"Name": "Service",     "Value": service},
                {"Name": "Environment", "Value": ENVIRONMENT},
            ],
            "Value":     1.0 if healthy else 0.0,
            "Unit":      "None",
            "Timestamp": time.time(),
        }],
    )


def handler(event, _context):
    results = {}

    for region in [PRIMARY_REGION, SECONDARY_REGION]:
        checks = {
            "aurora":      _check_aurora(region) if AURORA_CLUSTER else True,
            "dynamodb":    _check_dynamodb(region),
            "api_gateway": _check_api_gateway(
                region,
                API_GW_ID if region == PRIMARY_REGION else SECONDARY_API_GW_ID,
            ),
        }

        for service, healthy in checks.items():
            _publish(region, service, healthy)

        region_healthy = all(checks.values())
        _publish(region, "overall", region_healthy)
        results[region] = {"healthy": region_healthy, "checks": checks}
        logger.info("Region %s health: %s", region, "OK" if region_healthy else "DEGRADED")

    return {"statusCode": 200, "body": json.dumps(results)}
