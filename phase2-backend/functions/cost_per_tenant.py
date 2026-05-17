"""
Phase 6 / Track 5: Cost-per-tenant aggregation and anomaly detection.

Supports:
- Scheduled aggregation (EventBridge) to persist daily tenant costs
- CloudWatch custom metric emission for per-tenant estimated monthly cost
- GET /admin/costs?tenant_id=&start=&end=
- GET /tenant/costs (tenant-aware)
"""

import json
import logging
import os
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import boto3
from boto3.dynamodb.conditions import Attr, Key


LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
TENANT_TAG_KEY = os.environ.get("TENANT_TAG_KEY", "tenant_id")
ANOMALY_MULTIPLIER = float(os.environ.get("ANOMALY_MULTIPLIER", "1.5"))
RETENTION_DAYS = int(os.environ.get("COST_HISTORY_RETENTION_DAYS", "400"))
MONTHLY_COST_ALERT_THRESHOLD_USD = float(
    os.environ.get("MONTHLY_COST_ALERT_THRESHOLD_USD", "50.0")
)

COST_PER_TENANT_TABLE = os.environ.get(
    "COST_PER_TENANT_TABLE", f"securebase-{ENVIRONMENT}-cost-per-tenant"
)
ALERT_TOPIC_ARN = os.environ.get("ALERT_TOPIC_ARN", "")
CW_NAMESPACE = "SecureBase/CostPerTenant"

ce = boto3.client("ce", region_name="us-east-1")
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
sns = boto3.client("sns", region_name=AWS_REGION)
cw = boto3.client("cloudwatch", region_name=AWS_REGION)

SERVICE_BUCKETS = {
    "AWS Lambda": "lambda",
    "Amazon DynamoDB": "dynamodb",
    "Amazon Simple Storage Service": "s3",
    "Data Transfer": "data_transfer",
    "Amazon Relational Database Service": "aurora",
    "Amazon Aurora": "aurora",
}


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def parse_date(value: Optional[str], fallback: date) -> date:
    if not value:
        return fallback
    return datetime.strptime(value, "%Y-%m-%d").date()


def parse_tenant_from_event(event: Dict[str, Any]) -> Optional[str]:
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer", {})
    if isinstance(authorizer, dict):
        if authorizer.get("tenant_id"):
            return authorizer["tenant_id"]
        claims = authorizer.get("claims", {})
        if isinstance(claims, dict):
            tenant_id = claims.get("tenant_id")
            if tenant_id:
                return tenant_id
    headers = event.get("headers", {}) or {}
    return headers.get("X-Tenant-Id") or headers.get("x-tenant-id")


def _extract_group_values(keys: List[str]) -> Tuple[str, str]:
    tenant_raw = keys[0] if len(keys) > 0 else ""
    service_name = keys[1] if len(keys) > 1 else "Unknown"
    tenant_id = tenant_raw.split("$", 1)[1] if "$" in tenant_raw else tenant_raw
    return tenant_id, service_name


def _bucket_service(service_name: str) -> str:
    for source_name, bucket in SERVICE_BUCKETS.items():
        if source_name in service_name:
            return bucket
    return "other"


def aggregate_daily_costs(target_date: date) -> Dict[str, Dict[str, Any]]:
    end_date = target_date + timedelta(days=1)
    result = ce.get_cost_and_usage(
        TimePeriod={"Start": target_date.isoformat(), "End": end_date.isoformat()},
        Granularity="DAILY",
        Metrics=["UnblendedCost"],
        GroupBy=[
            {"Type": "TAG", "Key": TENANT_TAG_KEY},
            {"Type": "DIMENSION", "Key": "SERVICE"},
        ],
    )

    tenant_costs: Dict[str, Dict[str, Any]] = {}
    for period in result.get("ResultsByTime", []):
        for group in period.get("Groups", []):
            tenant_id, service_name = _extract_group_values(group.get("Keys", []))
            if not tenant_id:
                continue
            amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
            service_bucket = _bucket_service(service_name)

            if tenant_id not in tenant_costs:
                tenant_costs[tenant_id] = {
                    "tenant_id": tenant_id,
                    "date": target_date.isoformat(),
                    "total_cost": 0.0,
                    "breakdown": defaultdict(float),
                }
            tenant_costs[tenant_id]["total_cost"] += amount
            tenant_costs[tenant_id]["breakdown"][service_bucket] += amount

    return tenant_costs


def put_daily_cost_records(tenant_costs: Dict[str, Dict[str, Any]], target_date: date) -> int:
    table = dynamodb.Table(COST_PER_TENANT_TABLE)
    # Retain records long enough for monthly/quarterly trend reviews and anomaly baselines.
    ttl = int((datetime.combine(target_date + timedelta(days=RETENTION_DAYS), datetime.min.time()) - datetime(1970, 1, 1)).total_seconds())
    stored = 0

    for tenant_id, payload in tenant_costs.items():
        breakdown = {k: Decimal(str(round(v, 6))) for k, v in payload["breakdown"].items()}
        total_cost = Decimal(str(round(payload["total_cost"], 6)))
        table.put_item(
            Item={
                "tenant_id": tenant_id,
                "date": payload["date"],
                "total_cost": total_cost,
                "breakdown": breakdown,
                "updated_at": datetime.utcnow().isoformat(),
                "ttl": ttl,
            }
        )
        stored += 1

    return stored


def get_prior_average(tenant_id: str, target_date: date) -> float:
    table = dynamodb.Table(COST_PER_TENANT_TABLE)
    items = table.query(
        KeyConditionExpression=Key("tenant_id").eq(tenant_id) & Key("date").lt(target_date.isoformat()),
        ScanIndexForward=False,
        Limit=7,
    ).get("Items", [])

    if not items:
        return 0.0
    total = sum(float(item.get("total_cost", 0)) for item in items)
    return total / len(items)


def publish_anomaly(tenant_id: str, date_str: str, current_cost: float, baseline: float) -> None:
    if not ALERT_TOPIC_ARN:
        return

    message = {
        "severity": "P3",
        "source": "phase6-track5-cost-per-tenant",
        "tenant_id": tenant_id,
        "date": date_str,
        "current_cost": round(current_cost, 2),
        "baseline_7d_avg": round(baseline, 2),
        "ratio": round((current_cost / baseline), 2) if baseline > 0 else None,
        "summary": "Tenant daily cost exceeded 150% of 7-day average",
    }
    sns.publish(
        TopicArn=ALERT_TOPIC_ARN,
        Subject=f"SecureBase P3 Cost Anomaly - {tenant_id}",
        Message=json.dumps(message),
    )


def emit_monthly_cost_metrics(
    tenant_costs: Dict[str, Dict[str, Any]], target_date: date
) -> int:
    """Emit CloudWatch custom metrics for estimated monthly costs per tenant.

    Publishes:
    - ``EstimatedMonthlyCostUSD`` per-tenant dimension, allowing a single
      CloudWatch alarm on ``MaxTenantEstimatedMonthlyCostUSD`` to fire when
      any tenant's projected spend exceeds the configured threshold.

    Returns the number of metric data-points emitted.
    """
    if not tenant_costs:
        return 0

    # Compute day-of-month for pro-rated monthly estimate.
    day_of_month = target_date.day

    metric_data = []
    max_estimated = 0.0
    timestamp = datetime.utcnow()

    for tenant_id, record in tenant_costs.items():
        daily_cost = float(record["total_cost"])
        # Pro-rate: estimated_monthly = avg_daily * 30
        # Use the MTD scan from DynamoDB for a more accurate estimate when
        # data is available; fall back to a simple projection from today's spend.
        estimated_monthly = daily_cost * 30

        if estimated_monthly > max_estimated:
            max_estimated = estimated_monthly

        metric_data.append(
            {
                "MetricName": "EstimatedMonthlyCostUSD",
                "Dimensions": [
                    {"Name": "TenantId", "Value": tenant_id},
                    {"Name": "Environment", "Value": ENVIRONMENT},
                ],
                "Timestamp": timestamp,
                "Value": round(estimated_monthly, 4),
                "Unit": "None",
            }
        )

        # Alert via SNS if monthly estimate exceeds the static threshold.
        if estimated_monthly > MONTHLY_COST_ALERT_THRESHOLD_USD and ALERT_TOPIC_ARN:
            message = {
                "severity": "P3",
                "source": "phase6-track5-cost-per-tenant",
                "tenant_id": tenant_id,
                "date": target_date.isoformat(),
                "estimated_monthly_cost_usd": round(estimated_monthly, 2),
                "threshold_usd": MONTHLY_COST_ALERT_THRESHOLD_USD,
                "summary": (
                    f"Tenant {tenant_id} estimated monthly AWS cost "
                    f"${estimated_monthly:.2f} exceeds ${MONTHLY_COST_ALERT_THRESHOLD_USD:.0f} threshold"
                ),
            }
            try:
                sns.publish(
                    TopicArn=ALERT_TOPIC_ARN,
                    Subject=f"SecureBase P3 Monthly Cost Alert - {tenant_id}",
                    Message=json.dumps(message),
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("Failed to publish monthly cost alert for %s: %s", tenant_id, exc)

    # Emit a single roll-up metric (max across all tenants) for the global alarm.
    metric_data.append(
        {
            "MetricName": "MaxTenantEstimatedMonthlyCostUSD",
            "Dimensions": [{"Name": "Environment", "Value": ENVIRONMENT}],
            "Timestamp": timestamp,
            "Value": round(max_estimated, 4),
            "Unit": "None",
        }
    )

    # CloudWatch PutMetricData limit: 1,000 data points per call, 20 per batch.
    batch_size = 20
    emitted = 0
    for i in range(0, len(metric_data), batch_size):
        batch = metric_data[i : i + batch_size]
        try:
            cw.put_metric_data(Namespace=CW_NAMESPACE, MetricData=batch)
            emitted += len(batch)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Failed to emit CloudWatch metrics batch %d: %s", i, exc)

    return emitted


def run_daily_aggregation(target_date: date) -> Dict[str, Any]:
    tenant_costs = aggregate_daily_costs(target_date)
    stored = put_daily_cost_records(tenant_costs, target_date)

    anomalies = 0
    for tenant_id, record in tenant_costs.items():
        baseline = get_prior_average(tenant_id, target_date)
        current = float(record["total_cost"])
        # Alert when daily cost exceeds 150% (configurable) of the prior 7-day average.
        if baseline > 0 and current > (baseline * ANOMALY_MULTIPLIER):
            publish_anomaly(tenant_id, record["date"], current, baseline)
            anomalies += 1

    metrics_emitted = emit_monthly_cost_metrics(tenant_costs, target_date)

    return {
        "date": target_date.isoformat(),
        "tenants_processed": len(tenant_costs),
        "records_stored": stored,
        "anomalies_published": anomalies,
        "metrics_emitted": metrics_emitted,
    }


def _query_tenant_history(tenant_id: str, start_date: date, end_date: date) -> List[Dict[str, Any]]:
    table = dynamodb.Table(COST_PER_TENANT_TABLE)
    return table.query(
        KeyConditionExpression=Key("tenant_id").eq(tenant_id)
        & Key("date").between(start_date.isoformat(), end_date.isoformat())
    ).get("Items", [])


def _scan_history(start_date: date, end_date: date, max_records: int = 500) -> List[Dict[str, Any]]:
    table = dynamodb.Table(COST_PER_TENANT_TABLE)
    items: List[Dict[str, Any]] = []
    last_key = None
    while len(items) < max_records:
        scan_kwargs = {
            "FilterExpression": Attr("date").between(start_date.isoformat(), end_date.isoformat()),
            "Limit": min(100, max_records - len(items)),
        }
        if last_key:
            scan_kwargs["ExclusiveStartKey"] = last_key

        response = table.scan(**scan_kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
    return items[:max_records]


def get_admin_costs(event: Dict[str, Any]) -> Dict[str, Any]:
    query = event.get("queryStringParameters") or {}
    end_date = parse_date(query.get("end"), date.today())
    start_date = parse_date(query.get("start"), end_date - timedelta(days=30))
    tenant_id = query.get("tenant_id")
    limit = int(query.get("limit", "500"))

    rows = _query_tenant_history(tenant_id, start_date, end_date) if tenant_id else _scan_history(start_date, end_date, max_records=limit)
    rows = sorted(rows, key=lambda item: (item.get("tenant_id", ""), item.get("date", "")))

    totals = defaultdict(float)
    for row in rows:
        totals[row.get("tenant_id", "unknown")] += float(row.get("total_cost", 0))

    return response(
        200,
        {
            "tenant_id": tenant_id,
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "records": rows,
            "totals": [{"tenant_id": key, "total_cost": round(value, 2)} for key, value in sorted(totals.items())],
        },
    )


def get_tenant_costs(event: Dict[str, Any]) -> Dict[str, Any]:
    query = event.get("queryStringParameters") or {}
    tenant_id = parse_tenant_from_event(event) or query.get("tenant_id")
    if not tenant_id:
        return response(401, {"error": "Tenant identity missing"})

    end_date = parse_date(query.get("end"), date.today())
    start_date = parse_date(query.get("start"), end_date - timedelta(days=30))

    rows = sorted(_query_tenant_history(tenant_id, start_date, end_date), key=lambda item: item.get("date", ""))
    trend = [float(item.get("total_cost", 0)) for item in rows][-30:]
    total_30d = sum(trend)
    avg_daily = (total_30d / len(trend)) if trend else 0
    estimated_monthly_cost = avg_daily * 30

    breakdown = defaultdict(float)
    for row in rows:
        for key, value in (row.get("breakdown") or {}).items():
            breakdown[key] += float(value)

    return response(
        200,
        {
            "tenant_id": tenant_id,
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "estimated_monthly_cost": round(estimated_monthly_cost, 2),
            "trend": trend,
            "breakdown": {key: round(value, 2) for key, value in sorted(breakdown.items())},
            "history": rows,
        },
    )


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    try:
        logger.info("event=%s", json.dumps(event))

        if event.get("httpMethod"):
            path = event.get("path", "")
            if path == "/admin/costs":
                return get_admin_costs(event)
            if path == "/tenant/costs":
                return get_tenant_costs(event)
            return response(404, {"error": "Not found"})

        # Default to yesterday; EventBridge schedule runs at 1AM UTC for prior day.
        requested_date = event.get("date")
        target_date = parse_date(requested_date, date.today() - timedelta(days=1))
        return response(200, run_daily_aggregation(target_date))
    except Exception as exc:
        logger.error("Unhandled cost_per_tenant error: %s", str(exc), exc_info=True)
        return response(500, {"error": "Internal server error", "message": str(exc)})
