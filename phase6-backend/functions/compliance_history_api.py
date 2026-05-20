"""Tenant compliance history API (Phase 6.2 Track 3)."""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO), format='%(message)s')
logger = logging.getLogger(__name__)

dynamodb = boto3.resource('dynamodb')

COMPLIANCE_SCORES_TABLE = os.environ.get('COMPLIANCE_SCORES_TABLE', 'securebase-compliance-scores')
CONTROL_VIOLATIONS_TABLE = os.environ.get('CONTROL_VIOLATIONS_TABLE', 'control_violation_log')
PORTAL_CORS_ORIGIN = os.environ.get('PORTAL_CORS_ORIGIN', 'https://portal.securebase.tximhotep.com')

ALLOWED_FRAMEWORKS = ('SOC2', 'HIPAA', 'FedRAMP')
ALLOWED_DAYS = {30, 60, 90}
DEFAULT_DAYS = 90


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def _log(level: str, message: str, **kwargs: Any) -> None:
    payload = {
        'level': level.upper(),
        'message': message,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs,
    }
    getattr(logger, level.lower(), logger.info)(json.dumps(payload))


def _response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': PORTAL_CORS_ORIGIN,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        },
        'isBase64Encoded': False,
        'body': json.dumps(body, cls=DecimalEncoder),
    }


def _error(status_code: int, message: str) -> Dict[str, Any]:
    return _response(status_code, {'error': message})


def _to_iso_utc_now() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _canonical_framework(value: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not value:
        return None, None

    raw = value.strip().upper()
    if raw == 'ALL':
        return None, None

    if raw == 'SOC2':
        return 'SOC2', None
    if raw == 'HIPAA':
        return 'HIPAA', None
    if raw == 'FEDRAMP':
        return 'FedRAMP', None

    return None, "Invalid framework. Allowed values: SOC2, HIPAA, FedRAMP, all"


def _parse_days(value: Optional[str]) -> Tuple[int, Optional[str]]:
    if not value:
        return DEFAULT_DAYS, None

    try:
        days = int(value)
    except (TypeError, ValueError):
        return 0, "Invalid days. Allowed values: 30, 60, 90"

    if days not in ALLOWED_DAYS:
        return 0, "Invalid days. Allowed values: 30, 60, 90"

    return days, None


def _extract_tenant_id(event: Dict[str, Any]) -> Optional[str]:
    authorizer = (event.get('requestContext') or {}).get('authorizer') or {}

    for key in ('customer_id', 'tenant_id', 'sub'):
        value = authorizer.get(key)
        if value:
            return str(value)

    claims = authorizer.get('claims') or {}
    if isinstance(claims, dict) and claims.get('sub'):
        return str(claims['sub'])

    return None


def _query_items(table_name: str, key_expr: Any, days: int, date_field: str, framework: Optional[str]) -> List[Dict[str, Any]]:
    table = dynamodb.Table(table_name)
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days - 1)).strftime('%Y-%m-%d')

    filters = Attr(date_field).gte(cutoff_date)
    if framework:
        filters = filters & Attr('framework').eq(framework)

    response = table.query(
        KeyConditionExpression=key_expr,
        FilterExpression=filters,
        ScanIndexForward=False,
    )
    items = response.get('Items', [])

    while 'LastEvaluatedKey' in response:
        response = table.query(
            KeyConditionExpression=key_expr,
            FilterExpression=filters,
            ScanIndexForward=False,
            ExclusiveStartKey=response['LastEvaluatedKey'],
        )
        items.extend(response.get('Items', []))

    return items


def _query_scores(tenant_id: str, days: int, framework: Optional[str]) -> List[Dict[str, Any]]:
    key_expr = Key('PK').eq(f'CUSTOMER#{tenant_id}') & Key('SK').begins_with('FRAMEWORK#')
    return _query_items(COMPLIANCE_SCORES_TABLE, key_expr, days, 'score_date', framework)


def _query_violations(tenant_id: str, days: int, framework: Optional[str]) -> List[Dict[str, Any]]:
    key_expr = Key('PK').eq(f'CUSTOMER#{tenant_id}') & Key('SK').begins_with('CONTROL#')
    return _query_items(CONTROL_VIOLATIONS_TABLE, key_expr, days, 'recorded_date', framework)


def _score_status(score: Optional[float]) -> str:
    if score is None:
        return 'Failing'
    if score >= 80:
        return 'Passing'
    if score >= 60:
        return 'At Risk'
    return 'Failing'


def _score_at_or_before(items: List[Dict[str, Any]], date_floor: str) -> Optional[float]:
    candidates = [i for i in items if (i.get('score_date') or '') <= date_floor]
    if not candidates:
        return None
    baseline = max(candidates, key=lambda i: i.get('score_date') or '')
    return float(baseline.get('score', 0))


def _trend_from_delta(delta_30d: Optional[float]) -> str:
    if delta_30d is None:
        return 'Stable'
    if delta_30d >= 3:
        return 'Improving'
    if delta_30d <= -3:
        return 'Declining'
    return 'Stable'


def _normalize_severity(value: Optional[str]) -> str:
    normalized = str(value or 'MEDIUM').strip().upper()
    return {
        'CRITICAL': 'Critical',
        'HIGH': 'High',
        'MEDIUM': 'Medium',
        'LOW': 'Low',
    }.get(normalized, 'Medium')


def _build_framework_payload(
    framework: str,
    score_items: List[Dict[str, Any]],
    violation_items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    fw_scores = [item for item in score_items if item.get('framework') == framework]
    fw_scores = sorted(fw_scores, key=lambda i: i.get('score_date') or '')

    current_score = float(fw_scores[-1].get('score', 0)) if fw_scores else None

    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime('%Y-%m-%d')
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%d')

    score_7d_ago = _score_at_or_before(fw_scores, seven_days_ago)
    score_30d_ago = _score_at_or_before(fw_scores, thirty_days_ago)

    score_delta_7d = None
    if current_score is not None and score_7d_ago is not None:
        score_delta_7d = round(current_score - score_7d_ago, 2)

    score_delta_30d = None
    if current_score is not None and score_30d_ago is not None:
        score_delta_30d = round(current_score - score_30d_ago, 2)

    history = [
        {
            'date': item.get('score_date'),
            'score': round(float(item.get('score', 0)), 2),
        }
        for item in fw_scores
        if item.get('score_date')
    ]

    fw_violations = [item for item in violation_items if item.get('framework') == framework]
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for item in fw_violations:
        control_id = str(item.get('control_id') or item.get('controlId') or 'UNKNOWN')
        rule_name = str(item.get('rule_name') or item.get('config_rule_name') or item.get('rule') or 'unknown-rule')
        grouped.setdefault(f'{control_id}::{rule_name}', []).append(item)

    violations: List[Dict[str, Any]] = []
    for entries in grouped.values():
        entries = sorted(entries, key=lambda i: i.get('recorded_date') or '')
        latest = entries[-1]
        non_compliant = [e for e in entries if str(e.get('status') or '').upper() == 'NON_COMPLIANT']

        days_failing = 0
        if non_compliant:
            first_non_compliant_date = non_compliant[0].get('recorded_date')
            if first_non_compliant_date:
                first_dt = datetime.strptime(first_non_compliant_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
                days_failing = max((datetime.now(timezone.utc) - first_dt).days + 1, 1)

        violations.append({
            'control_id': latest.get('control_id') or latest.get('controlId'),
            'control_name': latest.get('control_name') or latest.get('control_description') or latest.get('controlName'),
            'rule_name': latest.get('rule_name') or latest.get('config_rule_name') or latest.get('rule') or 'unknown-rule',
            'severity': _normalize_severity(latest.get('severity')),
            'status': str(latest.get('status') or 'UNKNOWN').upper(),
            'days_failing': days_failing,
        })

    severity_rank = {'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}
    violations.sort(key=lambda v: (severity_rank.get(v['severity'], 4), v.get('control_id') or ''))

    return {
        'current_score': round(current_score, 2) if current_score is not None else None,
        'score_delta_7d': score_delta_7d,
        'status': _score_status(current_score),
        'trend': _trend_from_delta(score_delta_30d),
        'history': history,
        'violations': violations,
    }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    request_id = getattr(context, 'aws_request_id', str(uuid.uuid4()))
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return _response(200, {})

    if method != 'GET':
        return _error(405, 'Method not allowed')

    tenant_id = _extract_tenant_id(event)
    if not tenant_id:
        _log('warning', 'Unauthorized compliance history request', request_id=request_id)
        return _error(401, 'Unauthorized')

    qs = event.get('queryStringParameters') or {}
    framework_filter, framework_error = _canonical_framework(qs.get('framework'))
    if framework_error:
        return _error(400, framework_error)

    days, days_error = _parse_days(qs.get('days'))
    if days_error:
        return _error(400, days_error)

    try:
        score_items = _query_scores(tenant_id, days, framework_filter)
        violation_items = _query_violations(tenant_id, days, framework_filter)
    except ClientError as exc:
        _log('error', 'Compliance history DynamoDB query failed', request_id=request_id, error=str(exc))
        return _error(503, 'Service temporarily unavailable')

    frameworks_to_return = [framework_filter] if framework_filter else list(ALLOWED_FRAMEWORKS)
    payload = {
        fw: _build_framework_payload(fw, score_items, violation_items)
        for fw in frameworks_to_return
    }

    _log(
        'info',
        'Compliance history generated',
        request_id=request_id,
        tenant_id=tenant_id,
        framework=framework_filter or 'all',
        days=days,
    )

    return _response(200, {
        'tenant_id': tenant_id,
        'generated_at': _to_iso_utc_now(),
        'frameworks': payload,
    })
