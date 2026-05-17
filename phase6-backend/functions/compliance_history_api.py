"""
Phase 6.2 — Compliance History API Lambda.

Exposes a tenant-facing REST endpoint for retrieving daily compliance score
trend data stored by ``compliance_score_recalculator``.

Handler:
    ``compliance_history_api.lambda_handler``

Endpoints (via API Gateway proxy integration):
    GET /tenant/compliance/history
        Query parameters (all optional):
            framework   SOC2 | HIPAA | FedRAMP   (default: all three returned)
            days        integer 1–365              (default: 90)

Response body:
    {
        "customer_id": "<uuid>",
        "framework": "SOC2" | "all",
        "days": 90,
        "history": [
            {
                "date":               "YYYY-MM-DD",
                "framework":          "SOC2",
                "score":              95.5,
                "controls_total":     16,
                "controls_passing":   15,
                "controls_failing":   1,
                "critical_violations": 0,
                "high_violations":    1,
                "medium_violations":  0,
                "low_violations":     0,
                "calculated_at":      "2026-05-13T02:05:00+00:00"
            },
            ...
        ],
        "summary": {
            "latest_score":    95.5,
            "min_score":       88.0,
            "max_score":       100.0,
            "avg_score":       97.1,
            "score_delta_7d":  2.5,
            "trend":           "improving" | "stable" | "degrading"
        }
    }

Authentication:
    API key via ``X-API-Key`` header.  The caller is the portal (after the
    auth Lambda has issued a session token).  For Phase 6 the API key is
    passed directly through API Gateway using the ``api_key_required`` flag
    in the Terraform wiring.

Environment Variables:
    COMPLIANCE_SCORES_TABLE   DynamoDB table (default: securebase-compliance-scores)
    AWS_DEFAULT_REGION        AWS region (default: us-east-1)
    LOG_LEVEL                 DEBUG | INFO | WARNING | ERROR (default: INFO)

Author: SecureBase Engineering
Phase: 6.2 — Compliance Automation
Python: 3.11
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Logging — structured JSON for CloudWatch Logs Insights
# ---------------------------------------------------------------------------

LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='%(message)s',
)
logger = logging.getLogger(__name__)


def _log(level: str, message: str, **kwargs: Any) -> None:
    """Emit a structured JSON log record."""
    record: Dict[str, Any] = {
        'level': level.upper(),
        'message': message,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs,
    }
    getattr(logger, level.lower(), logger.info)(json.dumps(record))


# ---------------------------------------------------------------------------
# AWS SDK clients
# ---------------------------------------------------------------------------

dynamodb = boto3.resource('dynamodb')

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COMPLIANCE_SCORES_TABLE = os.environ.get(
    'COMPLIANCE_SCORES_TABLE', 'securebase-compliance-scores'
)
CONTROL_VIOLATIONS_TABLE = os.environ.get(
    'CONTROL_VIOLATIONS_TABLE', 'control_violation_log'
)

VALID_FRAMEWORKS = {'SOC2', 'HIPAA', 'FedRAMP', 'CIS'}

MAX_DAYS = 365
DEFAULT_DAYS = 90
BADGE_THRESHOLDS = {
    'passing': 90.0,
    'at_risk': 75.0,
}


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------


class DecimalEncoder(json.JSONEncoder):
    """Encode Decimal values returned by DynamoDB as floats."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def _response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """Build an API Gateway proxy integration response."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
        },
        'isBase64Encoded': False,
        'body': json.dumps(body, cls=DecimalEncoder),
    }


def _error(status_code: int, message: str) -> Dict[str, Any]:
    """Build a standard error response."""
    return _response(status_code, {'error': message})


# ---------------------------------------------------------------------------
# Auth: extract customer_id from X-API-Key (or pass-through from authoriser)
# ---------------------------------------------------------------------------


def _get_customer_id(event: Dict[str, Any]) -> Optional[str]:
    """Extract the authenticated customer_id from the API Gateway event.

    API Gateway attaches the customer_id to ``requestContext.authorizer``
    after the auth Lambda validates the X-API-Key header.  Falls back to
    reading it directly from headers for simple integration tests.

    Returns:
        customer_id string, or None if not found.
    """
    # Primary path: set by the custom Lambda authoriser
    ctx = event.get('requestContext', {})
    authorizer = ctx.get('authorizer', {})
    if authorizer.get('customer_id'):
        return str(authorizer['customer_id'])

    # Fallback: path parameter or query string (for direct test invocations)
    qs = event.get('queryStringParameters') or {}
    if qs.get('customer_id'):
        return str(qs['customer_id'])

    return None


# ---------------------------------------------------------------------------
# DynamoDB query
# ---------------------------------------------------------------------------


def _query_history(
    customer_id: str,
    framework: Optional[str],
    days: int,
) -> List[Dict[str, Any]]:
    """Query DynamoDB for compliance score history.

    Args:
        customer_id: Tenant UUID.
        framework:   Optional framework filter ('SOC2', 'HIPAA', 'FedRAMP').
                     When None, all frameworks are returned.
        days:        Number of calendar days to look back (inclusive of today).

    Returns:
        List of score snapshots sorted by date descending.
    """
    table = dynamodb.Table(COMPLIANCE_SCORES_TABLE)
    pk = f'CUSTOMER#{customer_id}'
    cutoff_date = (
        datetime.now(timezone.utc) - timedelta(days=days - 1)
    ).strftime('%Y-%m-%d')

    items: List[Dict[str, Any]] = []

    try:
        if framework:
            # Narrow SK range: FRAMEWORK#<fw>#DATE#<cutoff> to FRAMEWORK#<fw>#DATE#z
            sk_start = f'FRAMEWORK#{framework}#DATE#{cutoff_date}'
            sk_end = f'FRAMEWORK#{framework}#DATE#z'
            response = table.query(
                KeyConditionExpression=(
                    Key('PK').eq(pk) & Key('SK').between(sk_start, sk_end)
                ),
                ScanIndexForward=False,  # newest first
            )
            items = response.get('Items', [])

            # Paginate if necessary
            while 'LastEvaluatedKey' in response:
                response = table.query(
                    KeyConditionExpression=(
                        Key('PK').eq(pk) & Key('SK').between(sk_start, sk_end)
                    ),
                    ScanIndexForward=False,
                    ExclusiveStartKey=response['LastEvaluatedKey'],
                )
                items.extend(response.get('Items', []))
        else:
            # Fetch all frameworks: SK begins with 'FRAMEWORK#'
            # Use FilterExpression to push the date window filter to DynamoDB,
            # reducing unnecessary data transfer for large tenants.
            from boto3.dynamodb.conditions import Attr  # noqa: PLC0415

            sk_prefix = 'FRAMEWORK#'
            response = table.query(
                KeyConditionExpression=(
                    Key('PK').eq(pk) & Key('SK').begins_with(sk_prefix)
                ),
                FilterExpression=Attr('score_date').gte(cutoff_date),
                ScanIndexForward=False,
            )
            items = response.get('Items', [])

            while 'LastEvaluatedKey' in response:
                response = table.query(
                    KeyConditionExpression=(
                        Key('PK').eq(pk) & Key('SK').begins_with(sk_prefix)
                    ),
                    FilterExpression=Attr('score_date').gte(cutoff_date),
                    ScanIndexForward=False,
                    ExclusiveStartKey=response['LastEvaluatedKey'],
                )
                items.extend(response.get('Items', []))

    except ClientError as exc:
        _log('error', 'DynamoDB query failed',
             customer_id=customer_id, error=str(exc))
        raise

    return items


def _query_control_violations(
    customer_id: str,
    framework: Optional[str],
    days: int,
) -> List[Dict[str, Any]]:
    """Query control-level violation history for the tenant."""
    table = dynamodb.Table(CONTROL_VIOLATIONS_TABLE)
    pk = f'CUSTOMER#{customer_id}'
    cutoff_date = (
        datetime.now(timezone.utc) - timedelta(days=days - 1)
    ).strftime('%Y-%m-%d')
    items: List[Dict[str, Any]] = []

    try:
        response = table.query(
            KeyConditionExpression=(
                Key('PK').eq(pk) & Key('SK').begins_with('CONTROL#')
            ),
            FilterExpression=Attr('recorded_date').gte(cutoff_date),
            ScanIndexForward=False,
        )
        items = response.get('Items', [])

        while 'LastEvaluatedKey' in response:
            response = table.query(
                KeyConditionExpression=(
                    Key('PK').eq(pk) & Key('SK').begins_with('CONTROL#')
                ),
                FilterExpression=Attr('recorded_date').gte(cutoff_date),
                ScanIndexForward=False,
                ExclusiveStartKey=response['LastEvaluatedKey'],
            )
            items.extend(response.get('Items', []))
    except ClientError:
        raise

    if framework:
        return [item for item in items if item.get('framework') == framework]
    return items


# ---------------------------------------------------------------------------
# Summary calculation
# ---------------------------------------------------------------------------


def _build_summary(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build a statistical summary from the score history items.

    Args:
        items: List of DynamoDB score items.

    Returns:
        Dict with latest_score, min_score, max_score, avg_score,
        score_delta_7d, and trend.
    """
    if not items:
        return {
            'latest_score': None,
            'min_score': None,
            'max_score': None,
            'avg_score': None,
            'score_delta_7d': None,
            'trend': 'stable',
        }

    scores = [float(item.get('score', 0)) for item in items]
    latest = scores[0] if scores else 0.0
    min_score = round(min(scores), 2)
    max_score = round(max(scores), 2)
    avg_score = round(sum(scores) / len(scores), 2)

    # Trend baselines: compare the latest score to ~7-day and ~30-day history points.
    seven_days_ago = (
        datetime.now(timezone.utc) - timedelta(days=7)
    ).strftime('%Y-%m-%d')
    thirty_days_ago = (
        datetime.now(timezone.utc) - timedelta(days=30)
    ).strftime('%Y-%m-%d')

    # Find the score closest to (but not after) each baseline date.
    older_items_30d = [
        item for item in items
        if item.get('score_date', '') <= thirty_days_ago
    ]
    score_delta_30d: Optional[float] = None
    if older_items_30d:
        baseline_item = max(older_items_30d, key=lambda x: x.get('score_date', ''))
        score_delta_30d = round(latest - float(baseline_item.get('score', 0)), 2)

    older_items_7d = [
        item for item in items
        if item.get('score_date', '') <= seven_days_ago
    ]
    score_delta_7d: Optional[float] = None
    if older_items_7d:
        baseline_item_7d = max(older_items_7d, key=lambda x: x.get('score_date', ''))
        score_delta_7d = round(latest - float(baseline_item_7d.get('score', 0)), 2)

    if score_delta_30d is None:
        trend = 'stable'
    elif score_delta_30d > 2.0:
        trend = 'improving'
    elif score_delta_30d < -2.0:
        trend = 'degrading'
    else:
        trend = 'stable'

    return {
        'latest_score': round(latest, 2),
        'min_score': min_score,
        'max_score': max_score,
        'avg_score': avg_score,
        'score_delta_7d': score_delta_7d,
        'score_delta_30d': score_delta_30d,
        'trend': trend,
    }


def _badge_for_score(score: Optional[float]) -> str:
    if score is None:
        return 'Failing'
    if score >= BADGE_THRESHOLDS['passing']:
        return 'Passing'
    if score >= BADGE_THRESHOLDS['at_risk']:
        return 'At Risk'
    return 'Failing'


def _group_framework_history(history: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for item in history:
        framework = item.get('framework')
        grouped.setdefault(framework, []).append(item)

    framework_map: Dict[str, Dict[str, Any]] = {}
    for framework, items in grouped.items():
        sorted_items = sorted(items, key=lambda x: x.get('score_date', ''), reverse=True)
        summary = _build_summary(sorted_items)
        framework_map[framework] = {
            'history': [_format_item(i) for i in sorted_items],
            'summary': summary,
            'badge': _badge_for_score(summary.get('latest_score')),
        }
    return framework_map


def _build_overall_history(history: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not history:
        return {'history': [], 'summary': _build_summary([]), 'badge': _badge_for_score(None)}

    by_date: Dict[str, List[float]] = {}
    for item in history:
        by_date.setdefault(item.get('score_date'), []).append(float(item.get('score', 0)))

    aggregate = []
    for date_key, scores in by_date.items():
        aggregate.append({'score_date': date_key, 'score': sum(scores) / max(len(scores), 1)})

    aggregate.sort(key=lambda x: x['score_date'], reverse=True)
    summary = _build_summary(aggregate)
    return {
        'history': [{'date': i['score_date'], 'framework': 'overall', 'score': round(i['score'], 2)} for i in aggregate],
        'summary': summary,
        'badge': _badge_for_score(summary.get('latest_score')),
    }


def _build_control_breakdown(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for item in items:
        key = f"{item.get('framework')}::{item.get('control_id')}"
        grouped.setdefault(key, []).append(item)

    output: List[Dict[str, Any]] = []
    for _, entries in grouped.items():
        entries_sorted = sorted(entries, key=lambda x: x.get('recorded_date', ''), reverse=True)
        latest = entries_sorted[0]
        non_compliant_dates = [
            e.get('recorded_date')
            for e in entries_sorted
            if e.get('status') == 'NON_COMPLIANT' and e.get('recorded_date')
        ]
        days_failing = 0
        if non_compliant_dates:
            first_seen = min(non_compliant_dates)
            first_dt = datetime.strptime(first_seen, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            days_failing = (datetime.now(timezone.utc) - first_dt).days + 1

        output.append({
            'framework': latest.get('framework'),
            'control_id': latest.get('control_id'),
            'description': latest.get('control_name') or latest.get('control_description'),
            'severity': latest.get('severity'),
            'status': latest.get('status'),
            'days_failing': days_failing if latest.get('status') == 'NON_COMPLIANT' else 0,
            'recorded_date': latest.get('recorded_date'),
        })

    severity_rank = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFORMATIONAL': 4}
    output.sort(
        key=lambda x: (
            severity_rank.get(str(x.get('severity', 'MEDIUM')).upper(), 5),
            x.get('framework', ''),
            x.get('control_id', ''),
        )
    )
    return output


# ---------------------------------------------------------------------------
# Format a DynamoDB item as a history entry
# ---------------------------------------------------------------------------


def _format_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Strip DynamoDB key fields and coerce types for the API response."""
    return {
        'date': item.get('score_date'),
        'framework': item.get('framework'),
        'score': float(item.get('score', 0)),
        'controls_total': int(item.get('controls_total', 0)),
        'controls_passing': int(item.get('controls_passing', 0)),
        'controls_failing': int(item.get('controls_failing', 0)),
        'critical_violations': int(item.get('critical_violations', 0)),
        'high_violations': int(item.get('high_violations', 0)),
        'medium_violations': int(item.get('medium_violations', 0)),
        'low_violations': int(item.get('low_violations', 0)),
        'calculated_at': item.get('calculated_at'),
    }


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda entry point — return compliance score history for a tenant.

    Args:
        event:   API Gateway proxy integration event.
        context: Lambda context object.

    Returns:
        API Gateway proxy integration response dict.
    """
    request_id = getattr(context, 'aws_request_id', str(uuid.uuid4()))
    http_method = event.get('httpMethod', 'GET')

    # Handle OPTIONS pre-flight (CORS)
    if http_method == 'OPTIONS':
        return _response(200, {})

    if http_method != 'GET':
        return _error(405, 'Method not allowed')

    _log('info', 'compliance_history_api invoked', request_id=request_id)

    # ------------------------------------------------------------------
    # Auth: require customer_id from the authoriser context
    # ------------------------------------------------------------------
    customer_id = _get_customer_id(event)
    if not customer_id:
        _log('warning', 'Missing customer_id — unauthenticated request',
             request_id=request_id)
        return _error(401, 'Unauthorized: missing or invalid API key')

    # ------------------------------------------------------------------
    # Parse query string parameters
    # ------------------------------------------------------------------
    qs = event.get('queryStringParameters') or {}

    framework_param: Optional[str] = qs.get('framework')
    if framework_param:
        framework_param = framework_param.upper()
        if framework_param not in VALID_FRAMEWORKS:
            return _error(
                400,
                f"Invalid framework '{framework_param}'. "
                f"Allowed values: {', '.join(sorted(VALID_FRAMEWORKS))}",
            )

    days_str = qs.get('days', str(DEFAULT_DAYS))
    try:
        days = int(days_str)
        if days < 1 or days > MAX_DAYS:
            raise ValueError()
    except (ValueError, TypeError):
        return _error(400, f"'days' must be an integer between 1 and {MAX_DAYS}")

    # ------------------------------------------------------------------
    # Query DynamoDB
    # ------------------------------------------------------------------
    try:
        raw_items = _query_history(customer_id, framework_param, days)
    except ClientError as exc:
        _log('error', 'DynamoDB error in compliance_history_api',
             customer_id=customer_id, error=str(exc), request_id=request_id)
        return _error(503, 'Service temporarily unavailable')

    # ------------------------------------------------------------------
    # Build response
    # ------------------------------------------------------------------
    history = [_format_item(item) for item in raw_items]
    summary = _build_summary(raw_items)
    frameworks = _group_framework_history(raw_items)
    overall = _build_overall_history(raw_items)

    try:
        control_items = _query_control_violations(customer_id, framework_param, days)
    except ClientError as exc:
        _log('warning', 'Control violation query failed',
             customer_id=customer_id, error=str(exc), request_id=request_id)
        control_items = []
    control_breakdown = _build_control_breakdown(control_items)

    _log('info', 'compliance_history_api responded',
         customer_id=customer_id,
         framework=framework_param or 'all',
         days=days,
         items_returned=len(history),
         request_id=request_id)

    return _response(200, {
        'customer_id': customer_id,
        'framework': framework_param or 'all',
        'days': days,
        'history': history,
        'summary': summary,
        'frameworks': frameworks,
        'overall': overall,
        'control_violations': control_breakdown,
        'framework_badge': _badge_for_score(summary.get('latest_score')),
    })
