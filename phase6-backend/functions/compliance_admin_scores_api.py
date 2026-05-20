"""
Phase 6.2 — Admin Compliance Scores API Lambda.

Exposes a cross-tenant compliance score overview to the SecureBase admin panel.

Handler:
    ``compliance_admin_scores_api.lambda_handler``

Endpoints (via API Gateway proxy integration):
    GET /admin/compliance/scores

Authentication:
    Admin JWT only — validates ``role: admin`` claim in the API Gateway
    authorizer context.  Tenant-scoped tokens receive a 401 response.

Response body:
    {
        "generated_at": "2026-05-17T10:00:00Z",
        "tenants": [
            {
                "tenant_id": "<uuid>",
                "tenant_display_name": "Customer #1",
                "SOC2":    { "score": 84, "status": "Passing", "last_calculated": "…" },
                "HIPAA":   { "score": 71, "status": "At Risk",  "last_calculated": "…" },
                "FedRAMP": { "score": 90, "status": "Passing",  "last_calculated": "…" }
            }
        ]
    }

Status values:
    Passing  — score ≥ 80
    At Risk  — score ≥ 60 and < 80
    Critical — score < 60

Environment Variables:
    COMPLIANCE_SCORES_TABLE   DynamoDB table name (default: securebase-compliance-scores)
    AWS_DEFAULT_REGION        AWS region (default: us-east-1)
    LOG_LEVEL                 DEBUG | INFO | WARNING | ERROR (default: INFO)

Author: SecureBase Engineering
Phase: 6.2 — Compliance Automation (Track 4)
Python: 3.11
"""

import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

# Import shared database utilities from the Lambda layer.
sys.path.insert(0, '/opt/python')
from db_utils import (
    query_many,
    DatabaseError,
)

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
FRAMEWORKS = ('SOC2', 'HIPAA', 'FedRAMP')

SCORE_STATUS_PASSING = 'Passing'
SCORE_STATUS_AT_RISK = 'At Risk'
SCORE_STATUS_CRITICAL = 'Critical'


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------


class DecimalEncoder(json.JSONEncoder):
    """Encode Decimal values returned by DynamoDB as floats."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def _headers() -> Dict[str, str]:
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }


def _response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """Build an API Gateway proxy integration response."""
    return {
        'statusCode': status_code,
        'headers': _headers(),
        'isBase64Encoded': False,
        'body': json.dumps(body, cls=DecimalEncoder),
    }


def _error(status_code: int, message: str) -> Dict[str, Any]:
    """Build a standard error response."""
    return _response(status_code, {'error': message})


# ---------------------------------------------------------------------------
# Auth: require admin role from API Gateway authorizer context
# ---------------------------------------------------------------------------


def _require_admin(event: Dict[str, Any]) -> None:
    """Validate that the caller has the ``admin`` role.

    Reads the role claim from the API Gateway custom authorizer context
    (``requestContext.authorizer``).  Raises ``PermissionError`` if the role
    is missing or is not ``admin``.

    Args:
        event: Raw API Gateway proxy event dict.

    Raises:
        PermissionError: If the admin role claim is absent or does not equal 'admin'.
    """
    authorizer: Dict[str, Any] = (
        (event.get('requestContext') or {}).get('authorizer') or {}
    )
    # Cognito user pool authorizers nest claims under 'claims'; custom
    # authorizers surface them at the top level.
    claims: Dict[str, Any] = authorizer.get('claims') or authorizer

    if not isinstance(claims, dict):
        raise PermissionError('Missing authorizer context')

    role = str(
        claims.get('role')
        or claims.get('userRole')
        or claims.get('user_role')
        or ''
    ).lower()

    if role != 'admin':
        raise PermissionError('Admin role required')


# ---------------------------------------------------------------------------
# Score status derivation
# ---------------------------------------------------------------------------


def _score_status(score: float) -> str:
    """Map a numeric score to a human-readable status string.

    Args:
        score: Compliance score between 0 and 100.

    Returns:
        'Passing' if score ≥ 80, 'At Risk' if ≥ 60, 'Critical' otherwise.
    """
    if score >= 80:
        return SCORE_STATUS_PASSING
    if score >= 60:
        return SCORE_STATUS_AT_RISK
    return SCORE_STATUS_CRITICAL


# ---------------------------------------------------------------------------
# DynamoDB: fetch latest score per framework for a single tenant
# ---------------------------------------------------------------------------


def _get_latest_scores(customer_id: str) -> Dict[str, Optional[Dict[str, Any]]]:
    """Query DynamoDB for the most recent compliance score per framework.

    Args:
        customer_id: Tenant UUID.

    Returns:
        Dict mapping framework name → score snapshot dict (or None if not found).
        Example::

            {
                'SOC2':    {'score': 84.0, 'last_calculated': '2026-05-17T02:04:00+00:00'},
                'HIPAA':   {'score': 71.0, 'last_calculated': '2026-05-17T02:04:00+00:00'},
                'FedRAMP': None,
            }
    """
    table = dynamodb.Table(COMPLIANCE_SCORES_TABLE)
    pk = f'CUSTOMER#{customer_id}'
    result: Dict[str, Optional[Dict[str, Any]]] = {fw: None for fw in FRAMEWORKS}

    for framework in FRAMEWORKS:
        try:
            response = table.query(
                KeyConditionExpression=(
                    Key('PK').eq(pk)
                    & Key('SK').begins_with(f'FRAMEWORK#{framework}#DATE#')
                ),
                ScanIndexForward=False,  # newest first
                Limit=1,
            )
            items = response.get('Items', [])
            if items:
                item = items[0]
                result[framework] = {
                    'score': float(item.get('score', 0)),
                    'last_calculated': str(item.get('calculated_at', '')),
                }
        except ClientError as exc:
            _log(
                'warning',
                'DynamoDB query failed for framework scores',
                customer_id=customer_id,
                framework=framework,
                error=str(exc),
            )

    return result


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda entry point — return cross-tenant compliance scores.

    Args:
        event:   API Gateway proxy event.
        context: Lambda context object.

    Returns:
        API Gateway proxy response with status 200 and the cross-tenant scores,
        or 401 / 500 on auth failure / internal error.
    """
    request_id = str(getattr(context, 'aws_request_id', None) or str(uuid.uuid4()))

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return _response(200, {})

    # ── Auth: admin role required ──────────────────────────────────────────
    try:
        _require_admin(event)
    except PermissionError as exc:
        _log('warning', 'admin_compliance_scores: unauthorized',
             request_id=request_id, reason=str(exc))
        return _error(401, 'Unauthorized: admin access required')

    _log('info', 'admin_compliance_scores: invoked', request_id=request_id)

    # ── Load active customer list ──────────────────────────────────────────
    try:
        rows = query_many(
            "SELECT id FROM customers WHERE status = 'active' ORDER BY created_at",
        )
    except DatabaseError as exc:
        _log('error', 'Failed to load customer list', error=str(exc),
             request_id=request_id)
        return _error(500, 'Internal server error')

    customer_ids: List[str] = [str(row['id']) for row in (rows or [])]
    _log('info', 'customers loaded', count=len(customer_ids),
         request_id=request_id)

    # ── Fetch latest scores per tenant ────────────────────────────────────
    tenants: List[Dict[str, Any]] = []

    for idx, customer_id in enumerate(customer_ids, start=1):
        # Use an internal display name — never expose real customer identifiers.
        display_name = f'Customer #{idx}'
        scores = _get_latest_scores(customer_id)

        tenant_entry: Dict[str, Any] = {
            'tenant_id': customer_id,
            'tenant_display_name': display_name,
        }

        for framework in FRAMEWORKS:
            snap = scores.get(framework)
            if snap:
                tenant_entry[framework] = {
                    'score': round(snap['score'], 1),
                    'status': _score_status(snap['score']),
                    'last_calculated': snap['last_calculated'],
                }
            else:
                tenant_entry[framework] = None

        tenants.append(tenant_entry)

    generated_at = datetime.now(timezone.utc).isoformat()

    _log('info', 'admin_compliance_scores: complete',
         tenant_count=len(tenants),
         request_id=request_id)

    return _response(200, {
        'generated_at': generated_at,
        'tenants': tenants,
    })
