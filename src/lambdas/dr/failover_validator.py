"""
Failover Validator — Phase 6 / Track 2 (Sub-task 2.1 / 2.2)

Validates that a failover has completed successfully by checking:
  - Aurora Global replication lag is below target
  - DynamoDB Global Table replicas are healthy in the secondary region
  - API health endpoint in secondary region returns 200
  - Active region SSM parameter has been updated

Can be invoked:
  1. By dr_drill.py after triggering a drill failover
  2. Manually by on-call engineers to verify a production failover
  3. By the failover_orchestrator after completing a failover

Environment variables:
    PRIMARY_REGION              (default: us-east-1)
    SECONDARY_REGION            (default: us-west-2)
    AURORA_GLOBAL_CLUSTER_ID    e.g. securebase-prod-global
    AURORA_CLUSTER_ID           Primary Aurora cluster identifier
    DYNAMODB_TABLE_NAMES        Comma-separated list of tables to check
    SECONDARY_HEALTH_URL        HTTPS URL of /health in secondary region
    ALERT_SNS_ARN               SNS topic for failure alerts
    ENVIRONMENT                 prod | staging | dev
"""
import json
import os
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

import boto3
import urllib.request
import urllib.error
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

PRIMARY_REGION       = os.environ.get("PRIMARY_REGION", "us-east-1")
SECONDARY_REGION     = os.environ.get("SECONDARY_REGION", "us-west-2")
GLOBAL_CLUSTER_ID    = os.environ.get("AURORA_GLOBAL_CLUSTER_ID", "")
AURORA_CLUSTER_ID    = os.environ.get("AURORA_CLUSTER_ID", "")
_TABLE_NAMES_ENV     = os.environ.get("DYNAMODB_TABLE_NAMES", "")
DYNAMODB_TABLE_NAMES = [t.strip() for t in _TABLE_NAMES_ENV.split(",") if t.strip()] or [
    "securebase-tenants",
    "securebase-controls-state",
    "securebase-tenant-metrics",
]
SECONDARY_HEALTH_URL = os.environ.get("SECONDARY_HEALTH_URL", "")
ALERT_SNS_ARN        = os.environ.get("ALERT_SNS_ARN", "")
ENVIRONMENT          = os.environ.get("ENVIRONMENT", "prod")

ACTIVE_REGION_PARAM  = "/securebase/active_region"

# Thresholds
REPLICATION_LAG_WARN_MS = 1_000   # 1 s — warn
REPLICATION_LAG_FAIL_MS = 5_000   # 5 s — fail
HEALTH_TIMEOUT_S        = 10


def _aws(service: str, region: str = PRIMARY_REGION, **kwargs):
    return boto3.client(service, region_name=region, **kwargs)


# ── Validation checks ──────────────────────────────────────────────────────────

def check_active_region(ssm) -> Dict[str, Any]:
    """Verify SSM active_region has been updated to secondary."""
    try:
        current = ssm.get_parameter(Name=ACTIVE_REGION_PARAM)["Parameter"]["Value"]
        ok = current == SECONDARY_REGION
        return {
            "check": "active_region_ssm",
            "passed": ok,
            "current_value": current,
            "expected": SECONDARY_REGION,
            "message": f"active_region={current}" + ("" if ok else f" (expected {SECONDARY_REGION})"),
        }
    except ClientError as exc:
        return {"check": "active_region_ssm", "passed": False, "error": str(exc)}


def check_aurora_replication_lag(cw) -> Dict[str, Any]:
    """Check Aurora Global DB replication lag metric."""
    if not GLOBAL_CLUSTER_ID:
        return {"check": "aurora_replication_lag", "passed": True, "skipped": True,
                "message": "AURORA_GLOBAL_CLUSTER_ID not set — skipped"}
    now = datetime.now(timezone.utc)
    try:
        result = cw.get_metric_statistics(
            Namespace="AWS/RDS",
            MetricName="AuroraGlobalDBReplicationLag",
            Dimensions=[{"Name": "DBClusterIdentifier", "Value": AURORA_CLUSTER_ID or GLOBAL_CLUSTER_ID}],
            StartTime=now - timedelta(minutes=5),
            EndTime=now,
            Period=60,
            Statistics=["Maximum"],
        )
        datapoints = result.get("Datapoints", [])
        if not datapoints:
            return {"check": "aurora_replication_lag", "passed": True,
                    "message": "No datapoints in last 5 min — cluster may be standalone writer post-failover"}
        lag_ms = max(d["Maximum"] for d in datapoints)
        passed = lag_ms <= REPLICATION_LAG_WARN_MS
        return {
            "check":   "aurora_replication_lag",
            "passed":  lag_ms <= REPLICATION_LAG_FAIL_MS,
            "warning": not passed,
            "lag_ms":  lag_ms,
            "threshold_warn_ms": REPLICATION_LAG_WARN_MS,
            "threshold_fail_ms": REPLICATION_LAG_FAIL_MS,
            "message": f"lag={lag_ms:.0f}ms",
        }
    except ClientError as exc:
        return {"check": "aurora_replication_lag", "passed": False, "error": str(exc)}


def check_dynamodb_replicas(ddb) -> Dict[str, Any]:
    """Verify each DynamoDB table has an ACTIVE replica in the secondary region."""
    results = []
    all_ok = True
    for table_name in DYNAMODB_TABLE_NAMES:
        try:
            desc = ddb.describe_table(TableName=table_name)
            replicas = desc.get("Table", {}).get("Replicas", [])
            secondary_replica = next(
                (r for r in replicas if r.get("RegionName") == SECONDARY_REGION), None
            )
            if secondary_replica is None:
                results.append({
                    "table": table_name,
                    "passed": False,
                    "message": f"No replica found in {SECONDARY_REGION}",
                })
                all_ok = False
            else:
                status = secondary_replica.get("ReplicaStatus", "UNKNOWN")
                ok = status == "ACTIVE"
                if not ok:
                    all_ok = False
                results.append({
                    "table":   table_name,
                    "passed":  ok,
                    "status":  status,
                    "message": f"replica status={status}",
                })
        except ClientError as exc:
            results.append({"table": table_name, "passed": False, "error": str(exc)})
            all_ok = False

    return {
        "check":   "dynamodb_replicas",
        "passed":  all_ok,
        "tables":  results,
        "message": f"{sum(r['passed'] for r in results)}/{len(results)} tables ACTIVE in {SECONDARY_REGION}",
    }


def check_secondary_health_endpoint() -> Dict[str, Any]:
    """HTTP GET SECONDARY_HEALTH_URL and verify 200 response."""
    if not SECONDARY_HEALTH_URL:
        return {"check": "secondary_health_endpoint", "passed": True, "skipped": True,
                "message": "SECONDARY_HEALTH_URL not set — skipped"}
    url = SECONDARY_HEALTH_URL.rstrip("/")
    if not url.endswith("/health"):
        url = url + "/health"
    try:
        req = urllib.request.Request(url, method="GET")
        req.add_header("User-Agent", "SecureBase-FailoverValidator/1.0")
        with urllib.request.urlopen(req, timeout=HEALTH_TIMEOUT_S) as resp:
            status = resp.getcode()
            body   = resp.read(256).decode("utf-8", errors="replace")
        passed = status == 200
        return {
            "check":   "secondary_health_endpoint",
            "passed":  passed,
            "http_status": status,
            "url":     url,
            "message": f"HTTP {status}",
        }
    except urllib.error.HTTPError as exc:
        return {"check": "secondary_health_endpoint", "passed": False,
                "http_status": exc.code, "url": url, "error": str(exc)}
    except Exception as exc:  # pylint: disable=broad-except
        return {"check": "secondary_health_endpoint", "passed": False,
                "url": url, "error": str(exc)}


def _notify(sns, subject: str, message: str) -> None:
    if not ALERT_SNS_ARN:
        return
    try:
        sns.publish(TopicArn=ALERT_SNS_ARN, Subject=subject, Message=message)
    except ClientError as exc:
        logger.warning("SNS notification failed: %s", exc)


# ── Handler ────────────────────────────────────────────────────────────────────

def handler(event, _context):
    logger.info("Failover validator triggered: %s", json.dumps(event))

    ssm = _aws("ssm")
    cw  = _aws("cloudwatch")
    ddb = _aws("dynamodb")
    sns = _aws("sns")

    checks = [
        check_active_region(ssm),
        check_aurora_replication_lag(cw),
        check_dynamodb_replicas(ddb),
        check_secondary_health_endpoint(),
    ]

    passed  = all(c.get("passed", False) for c in checks)
    warnings = [c for c in checks if c.get("warning")]
    failed   = [c for c in checks if not c.get("passed", False) and not c.get("skipped")]

    summary = {
        "validated_at":   datetime.now(timezone.utc).isoformat(),
        "environment":    ENVIRONMENT,
        "primary_region": PRIMARY_REGION,
        "secondary_region": SECONDARY_REGION,
        "overall_passed": passed,
        "checks":         checks,
        "failed_checks":  [c["check"] for c in failed],
        "warning_checks": [c["check"] for c in warnings],
    }

    if not passed:
        subject = f"[{ENVIRONMENT.upper()}] ❌ Failover validation FAILED"
        body    = json.dumps({"failed_checks": summary["failed_checks"],
                              "details": failed}, indent=2, default=str)
        _notify(sns, subject, body)
        logger.error("Failover validation FAILED. Failed checks: %s", summary["failed_checks"])
    else:
        logger.info("Failover validation PASSED. Warnings: %s", [c["check"] for c in warnings])

    return {
        "statusCode": 200 if passed else 500,
        "body": json.dumps(summary, default=str),
    }
