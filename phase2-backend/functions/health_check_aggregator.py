"""
Health Check Aggregator — Phase 5.3 Multi-Region DR
Aggregates health signals from all SecureBase services in both regions
and publishes custom Route 53 / CloudWatch health metrics.

Trigger: EventBridge scheduled rule every 60 seconds.

Environment Variables:
  ENVIRONMENT             - Environment name
  PRIMARY_REGION          - Primary AWS region (us-east-1)
  SECONDARY_REGION        - Secondary AWS region (us-west-2)
  PRIMARY_API_URL         - Primary API health endpoint URL
  SECONDARY_API_URL       - Secondary API health endpoint URL
  DR_STATE_TABLE          - DynamoDB table for DR state
  ALERT_SNS_TOPIC_ARN     - SNS topic for critical alerts
  CLOUDWATCH_NAMESPACE    - Namespace for custom metrics (default: SecureBase/{env}/DR)
  LOG_LEVEL               - Log level (default: INFO)
"""

import json
import os
import time
import logging
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional

import boto3

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
logger = logging.getLogger(__name__)
logger.setLevel(LOG_LEVEL)

ENVIRONMENT       = os.environ.get("ENVIRONMENT", "dev")
PRIMARY_REGION    = os.environ.get("PRIMARY_REGION", "us-east-1")
SECONDARY_REGION  = os.environ.get("SECONDARY_REGION", "us-west-2")
PRIMARY_API_URL   = os.environ.get("PRIMARY_API_URL", "")
SECONDARY_API_URL = os.environ.get("SECONDARY_API_URL", "")
DR_STATE_TABLE    = os.environ.get("DR_STATE_TABLE", f"securebase-{ENVIRONMENT}-dr-state")
ALERT_SNS_TOPIC_ARN = os.environ.get("ALERT_SNS_TOPIC_ARN", "")
CW_NAMESPACE      = os.environ.get("CLOUDWATCH_NAMESPACE", f"SecureBase/{ENVIRONMENT}/DR")

# Consecutive failures required before triggering a critical alert
ALERT_THRESHOLD = int(os.environ.get("ALERT_THRESHOLD", "3"))

cloudwatch = boto3.client("cloudwatch", region_name=PRIMARY_REGION)
dynamodb   = boto3.resource("dynamodb")
sns_client = boto3.client("sns")


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

def lambda_handler(event: dict, context) -> dict:
    logger.info("Health check aggregator running: %s", datetime.now(timezone.utc).isoformat())

    results = {}

    # Check both regions
    results["primary"]   = _check_api(PRIMARY_API_URL,   PRIMARY_REGION)
    results["secondary"] = _check_api(SECONDARY_API_URL, SECONDARY_REGION)

    # Publish custom CloudWatch metrics
    _publish_metrics(results)

    # Record state in DynamoDB for trend tracking
    _record_health_snapshot(results)

    # Alert if primary is down (may trigger failover orchestrator via EventBridge)
    if not results["primary"]["healthy"]:
        _maybe_alert(results)

    logger.info("Health check results: %s", json.dumps(results))
    return {
        "statusCode": 200,
        "body": json.dumps({"results": results, "timestamp": datetime.now(timezone.utc).isoformat()}),
    }


# ---------------------------------------------------------------------------
# HTTP health check
# ---------------------------------------------------------------------------

def _check_api(url: str, region: str) -> dict:
    if not url:
        return {"healthy": False, "region": region, "error": "URL not configured", "latency_ms": -1}

    start = time.monotonic()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SecureBase-HealthCheck/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            latency_ms = int((time.monotonic() - start) * 1000)
            body = resp.read(512).decode("utf-8", errors="replace")
            status_code = resp.status
            healthy = 200 <= status_code < 300
            return {
                "healthy":    healthy,
                "region":     region,
                "status_code": status_code,
                "latency_ms": latency_ms,
                "body_snippet": body[:100],
            }
    except urllib.error.HTTPError as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        return {
            "healthy":    False,
            "region":     region,
            "status_code": exc.code,
            "latency_ms": latency_ms,
            "error":      str(exc),
        }
    except Exception as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        return {
            "healthy":    False,
            "region":     region,
            "latency_ms": latency_ms,
            "error":      str(exc),
        }


# ---------------------------------------------------------------------------
# CloudWatch metrics
# ---------------------------------------------------------------------------

def _publish_metrics(results: dict) -> None:
    metric_data = []
    timestamp   = datetime.now(timezone.utc)

    for role, result in results.items():
        region   = result.get("region", role)
        healthy  = 1 if result.get("healthy") else 0
        latency  = result.get("latency_ms", -1)

        metric_data.append({
            "MetricName": "HealthCheckStatus",
            "Dimensions": [
                {"Name": "Region", "Value": region},
                {"Name": "Role",   "Value": role},
                {"Name": "Environment", "Value": ENVIRONMENT},
            ],
            "Timestamp": timestamp,
            "Value":     healthy,
            "Unit":      "Count",
        })

        if latency >= 0:
            metric_data.append({
                "MetricName": "HealthCheckLatency",
                "Dimensions": [
                    {"Name": "Region", "Value": region},
                    {"Name": "Role",   "Value": role},
                    {"Name": "Environment", "Value": ENVIRONMENT},
                ],
                "Timestamp": timestamp,
                "Value":     latency,
                "Unit":      "Milliseconds",
            })

    try:
        cloudwatch.put_metric_data(Namespace=CW_NAMESPACE, MetricData=metric_data)
        logger.debug("Published %d metrics", len(metric_data))
    except Exception as exc:
        logger.error("Failed to publish CloudWatch metrics: %s", exc)


# ---------------------------------------------------------------------------
# DynamoDB state tracking
# ---------------------------------------------------------------------------

def _record_health_snapshot(results: dict) -> None:
    try:
        table = dynamodb.Table(DR_STATE_TABLE)
        ts    = datetime.now(timezone.utc).isoformat()
        table.put_item(Item={
            "pk":        f"HEALTH#{ENVIRONMENT}",
            "sk":        f"SNAPSHOT#{ts}",
            "timestamp": ts,
            "environment": ENVIRONMENT,
            "results":   json.dumps(results),
            "primary_healthy": results.get("primary", {}).get("healthy", False),
            "secondary_healthy": results.get("secondary", {}).get("healthy", False),
            "ttl": int(time.time()) + (7 * 24 * 3600),  # Retain 7 days
        })
    except Exception as exc:
        logger.warning("Could not record health snapshot (non-fatal): %s", exc)


# ---------------------------------------------------------------------------
# Alerting
# ---------------------------------------------------------------------------

def _maybe_alert(results: dict) -> None:
    """Alert only if primary has been unhealthy for ALERT_THRESHOLD consecutive checks."""
    try:
        table       = dynamodb.Table(DR_STATE_TABLE)
        response    = table.query(
            KeyConditionExpression="pk = :pk AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={
                ":pk":     f"HEALTH#{ENVIRONMENT}",
                ":prefix": "SNAPSHOT#",
            },
            ScanIndexForward=False,
            Limit=ALERT_THRESHOLD,
        )
        items = response.get("Items", [])
        consecutive_failures = sum(
            1 for item in items
            if not item.get("primary_healthy", True)
        )
    except Exception:
        consecutive_failures = 1  # Fail open: alert if we can't read state

    if consecutive_failures >= ALERT_THRESHOLD:
        _send_alert(results)


def _send_alert(results: dict) -> None:
    if not ALERT_SNS_TOPIC_ARN:
        logger.warning("ALERT_SNS_TOPIC_ARN not configured — cannot send alert")
        return
    try:
        sns_client.publish(
            TopicArn=ALERT_SNS_TOPIC_ARN,
            Subject=f"[{ENVIRONMENT.upper()}] PRIMARY REGION HEALTH CHECK FAILING",
            Message=(
                f"SecureBase {ENVIRONMENT} primary region is unhealthy.\n\n"
                f"Primary: {json.dumps(results.get('primary', {}), indent=2)}\n"
                f"Secondary: {json.dumps(results.get('secondary', {}), indent=2)}\n\n"
                "Automatic Route 53 failover should activate within 90 seconds.\n"
                "If failover does not activate, manually invoke the failover_orchestrator Lambda."
            ),
        )
    except Exception as exc:
        logger.error("Alert notification failed: %s", exc)
