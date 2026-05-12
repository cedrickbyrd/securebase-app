"""
Admin observability metrics Lambda.

GET /admin/metrics
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

import boto3
from botocore.exceptions import BotoCoreError, ClientError

try:
    from aws_xray_sdk.core import patch_all

    patch_all()
except Exception:  # pragma: no cover - local environments may not ship X-Ray SDK
    pass

logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

cloudwatch = boto3.client("cloudwatch")
dynamodb = boto3.resource("dynamodb")

API_NAME = os.environ.get("API_GATEWAY_NAME", "SecureBase-API")
API_STAGE = os.environ.get("API_GATEWAY_STAGE", os.environ.get("ENVIRONMENT", "dev"))
CUSTOMERS_TABLE = os.environ.get("CUSTOMERS_TABLE", "")
SLOW_LATENCY_THRESHOLD_MS = float(os.environ.get("SLOW_LATENCY_THRESHOLD_MS", "1000"))


def _headers() -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
    }


def _response(status_code: int, body: Any) -> Dict[str, Any]:
    return {"statusCode": status_code, "headers": _headers(), "body": json.dumps(body)}


def _require_admin_context(event: Dict[str, Any]) -> None:
    authorizer = (event.get("requestContext") or {}).get("authorizer") or {}
    claims = authorizer.get("claims") if isinstance(authorizer, dict) else None
    claims = claims or authorizer
    if not isinstance(claims, dict):
        raise PermissionError("Missing authorizer context")

    role = str(claims.get("role") or claims.get("userRole") or claims.get("user_role") or "").lower()
    if role != "admin":
        raise PermissionError("Admin role required")


def _metric_query(query_id: str, namespace: str, metric_name: str, stat: str, dimensions: List[Dict[str, str]]) -> Dict[str, Any]:
    return {
        "Id": query_id,
        "MetricStat": {
            "Metric": {
                "Namespace": namespace,
                "MetricName": metric_name,
                "Dimensions": dimensions,
            },
            "Period": 60,
            "Stat": stat,
        },
        "ReturnData": True,
    }


def _build_metric_queries() -> List[Dict[str, Any]]:
    api_dimensions = [
        {"Name": "ApiName", "Value": API_NAME},
        {"Name": "Stage", "Value": API_STAGE},
    ]

    return [
        _metric_query("lambda_invocations", "AWS/Lambda", "Invocations", "Sum", []),
        _metric_query("lambda_errors", "AWS/Lambda", "Errors", "Sum", []),
        _metric_query("lambda_duration_p50", "AWS/Lambda", "Duration", "p50", []),
        _metric_query("lambda_duration_p95", "AWS/Lambda", "Duration", "p95", []),
        _metric_query("lambda_duration_p99", "AWS/Lambda", "Duration", "p99", []),
        _metric_query("api_requests", "AWS/ApiGateway", "Count", "Sum", api_dimensions),
        _metric_query("api_5xx", "AWS/ApiGateway", "5XXError", "Sum", api_dimensions),
    ]


def _window() -> Tuple[datetime, datetime]:
    end = datetime.utcnow()
    start = end - timedelta(hours=1)
    return start, end


def _get_metric_data() -> Dict[str, Dict[str, Any]]:
    start, end = _window()
    response = cloudwatch.get_metric_data(
        MetricDataQueries=_build_metric_queries(),
        StartTime=start,
        EndTime=end,
        ScanBy="TimestampDescending",
        MaxDatapoints=1000,
    )

    results: Dict[str, Dict[str, Any]] = {}
    for metric in response.get("MetricDataResults", []):
        values = metric.get("Values", [])
        timestamps = metric.get("Timestamps", [])
        latest = values[0] if values else 0.0
        results[metric["Id"]] = {
            "latest": float(latest) if latest is not None else 0.0,
            "series": [float(value) for value in reversed(values)],
            "timestamps": [ts.isoformat() for ts in reversed(timestamps)],
        }
    return results


def _safe_percentage(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 4)


def _customer_overview() -> Dict[str, Any]:
    if not CUSTOMERS_TABLE:
        return {"activeTenants": 0}

    try:
        table = dynamodb.Table(CUSTOMERS_TABLE)
        scan = table.scan(ProjectionExpression="#status", ExpressionAttributeNames={"#status": "status"})
        active = sum(1 for item in scan.get("Items", []) if item.get("status") == "active")
        return {"activeTenants": active}
    except (BotoCoreError, ClientError):
        return {"activeTenants": 0}


def _build_health(infra: Dict[str, Any]) -> Dict[str, Any]:
    error_rate = infra.get("errorRate", 0.0)
    p95 = infra.get("apiLatency", {}).get("p95", 0.0)

    services = [
        {"name": "API Gateway", "status": "degraded" if p95 > SLOW_LATENCY_THRESHOLD_MS else "healthy"},
        {"name": "Lambda", "status": "degraded" if error_rate > 1.0 else "healthy"},
        {"name": "CloudWatch", "status": "healthy"},
    ]
    return {"lastUpdated": datetime.utcnow().isoformat(), "services": services}


def _build_payload(metric_data: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    lambda_invocations = metric_data.get("lambda_invocations", {}).get("latest", 0.0)
    lambda_errors = metric_data.get("lambda_errors", {}).get("latest", 0.0)
    api_requests = metric_data.get("api_requests", {}).get("latest", 0.0)
    api_5xx = metric_data.get("api_5xx", {}).get("latest", 0.0)

    infra = {
        "lambdaInvocations": round(lambda_invocations),
        "apiRequestCount": round(api_requests),
        "apiLatency": {
            "p50": round(metric_data.get("lambda_duration_p50", {}).get("latest", 0.0), 2),
            "p95": round(metric_data.get("lambda_duration_p95", {}).get("latest", 0.0), 2),
            "p99": round(metric_data.get("lambda_duration_p99", {}).get("latest", 0.0), 2),
        },
        "errorRate": round(_safe_percentage(lambda_errors + api_5xx, lambda_invocations + api_requests), 2),
        "lambdaErrorRate": round(_safe_percentage(lambda_errors, lambda_invocations), 2),
        "api5xxRate": round(_safe_percentage(api_5xx, api_requests), 2),
        "cloudwatch": metric_data,
    }

    overview = {
        **_customer_overview(),
        "totalRevenue": 0,
        "uptimePercentage": round(100 - infra["errorRate"], 2),
        "openSupportTickets": 0,
    }

    payload = {
        "overview": overview,
        "infrastructure": infra,
        "security": {"complianceScores": {"soc2": 0, "fedramp": 0, "hipaa": 0}, "failedAuthAttempts": 0, "securityEvents24h": 0},
        "customers": {"newSignups30d": 0, "churnRate": 0, "mrrTrend": [], "npsScore": 0},
        "costs": {"awsSpendMtd": 0, "costPerTenant": 0, "savingsVsOnDemand": 0, "topServicesByCost": []},
        "operations": {"activeDeployments": 0, "failedPipelines": 0, "pendingTerraformChanges": 0, "lambdaColdStarts": 0},
        "alerts": [],
        "health": {},
        "window": {"hours": 1},
        "lastUpdated": datetime.utcnow().isoformat(),
    }
    payload["health"] = _build_health(payload["infrastructure"])
    return payload


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    if event.get("httpMethod") == "OPTIONS":
        return _response(200, {"ok": True})

    path = event.get("path", "")
    if path != "/admin/metrics":
        return _response(404, {"error": "Not found"})

    try:
        # API Gateway CUSTOM authorizer must inject claims; this is a defense-in-depth check.
        _require_admin_context(event)
        metric_data = _get_metric_data()
        return _response(200, _build_payload(metric_data))
    except PermissionError as exc:
        return _response(401, {"error": str(exc)})
    except Exception as exc:  # pragma: no cover - defensive guard
        logger.error("admin_metrics error: %s", exc, exc_info=True)
        return _response(500, {"error": "Internal server error"})
