"""
Phase 6.1 — Audit Evidence API Lambda.

REST API handler for compliance evidence management.  Authenticates requests
via API key (same pattern as ``auth_v2.py``), enforces tenant isolation, and
provides endpoints for listing, downloading, and generating evidence packages.

Handler:
    ``audit_evidence_api.lambda_handler``

Routes:
    GET  /admin/evidence
        List evidence packages for the authenticated tenant.
        Query params: framework, status, limit (default 20), offset (default 0)

    GET  /admin/evidence/{package_id}
        Get details for a specific evidence package.
        Returns a pre-signed S3 download URL (expires in 3600 seconds).

    POST /admin/evidence/generate
        Trigger asynchronous generation of a new evidence package.
        Body: { "framework": "SOC2"|"HIPAA"|"FedRAMP"|"ALL",
                "date_range_start": "ISO-8601",
                "date_range_end":   "ISO-8601" }

Environment Variables:
    EVIDENCE_BUCKET   S3 bucket containing evidence packages
    RDS_HOST          Aurora Serverless v2 endpoint (via RDS Proxy)
    RDS_DATABASE      Database name (default: securebase)
    RDS_USER          Application database user
    JWT_SECRET        JWT secret for session token validation
    PACKAGER_FUNCTION Lambda function name for audit_log_packager
    LOG_LEVEL         DEBUG | INFO | WARNING | ERROR (default: INFO)

Author: SecureBase Engineering
Phase: 6.1 — Immutable Audit Logging at Scale
Python: 3.11
"""

import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import boto3
from botocore.exceptions import ClientError

# Shared Lambda layer utilities
sys.path.insert(0, '/opt/python')
from db_utils import (
    get_connection_pool,
    set_rls_context,
    query_one,
    execute_query,
    get_api_key_by_prefix,
    DatabaseError,
)

# ---------------------------------------------------------------------------
# Logging
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

s3_client = boto3.client('s3')
lambda_client = boto3.client('lambda')

EVIDENCE_BUCKET = os.environ.get('EVIDENCE_BUCKET', '')
PACKAGER_FUNCTION = os.environ.get('PACKAGER_FUNCTION', 'securebase-prod-audit-log-packager')
PRESIGNED_URL_EXPIRES = 3600  # 1 hour

# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------


def _response(status_code: int, body: Any, headers: Optional[Dict] = None) -> Dict:
    """Build an API Gateway proxy integration response."""
    default_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-API-Key',
    }
    if headers:
        default_headers.update(headers)
    return {
        'statusCode': status_code,
        'headers': default_headers,
        'isBase64Encoded': False,
        'body': json.dumps(body),
    }


def _error(status_code: int, message: str) -> Dict:
    return _response(status_code, {'error': message})


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


def _authenticate(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract and validate the API key from the request.

    Args:
        event: API Gateway proxy event.

    Returns:
        Customer dict if authentication succeeds; None otherwise.
    """
    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    raw_key = (
        headers.get('x-api-key')
        or headers.get('authorization', '').removeprefix('Bearer ').strip()
    )
    if not raw_key:
        return None

    try:
        pool = get_connection_pool()
        with pool.getconn() as conn:
            customer = get_api_key_by_prefix(conn, raw_key)
            pool.putconn(conn)
        return customer
    except DatabaseError:
        return None


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------


def _handle_list(
    event: Dict[str, Any],
    customer_id: str,
) -> Dict:
    """Handle GET /admin/evidence — list evidence packages.

    Args:
        event:       API Gateway proxy event.
        customer_id: Authenticated tenant UUID.

    Returns:
        API Gateway response with paginated evidence packages.
    """
    params = event.get('queryStringParameters') or {}
    framework: Optional[str] = params.get('framework')
    status: Optional[str] = params.get('status')
    limit: int = min(int(params.get('limit', 20)), 100)
    offset: int = max(int(params.get('offset', 0)), 0)

    where_clauses = ['customer_id = %s']
    values: list = [customer_id]

    if framework:
        where_clauses.append('framework = %s')
        values.append(framework.upper())
    if status:
        where_clauses.append('status = %s')
        values.append(status.lower())

    where_sql = ' AND '.join(where_clauses)
    values.extend([limit, offset])

    try:
        pool = get_connection_pool()
        with pool.getconn() as conn:
            set_rls_context(conn, customer_id)
            rows = execute_query(
                conn,
                f"""
                SELECT id, package_name, framework, status, date_range_start,
                       date_range_end, log_count, package_size_bytes,
                       sha256_manifest, created_at
                FROM evidence_packages
                WHERE {where_sql}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                tuple(values),
                fetch=True,
            )
            pool.putconn(conn)
    except DatabaseError as exc:
        _log('error', 'DB query failed in list_evidence', error=str(exc))
        return _error(500, 'Database error listing evidence packages')

    packages = []
    for row in (rows or []):
        packages.append({
            'id': str(row['id']),
            'package_name': row['package_name'],
            'framework': row['framework'],
            'status': row['status'],
            'date_range_start': row['date_range_start'].isoformat(),
            'date_range_end': row['date_range_end'].isoformat(),
            'log_count': row['log_count'],
            'size_bytes': row['package_size_bytes'],
            'sha256': row['sha256_manifest'],
            'created_at': row['created_at'].isoformat(),
        })

    return _response(200, {'packages': packages, 'count': len(packages)})


def _handle_get(
    package_id: str,
    customer_id: str,
) -> Dict:
    """Handle GET /admin/evidence/{package_id} — get package with presigned URL.

    Args:
        package_id:  UUID of the evidence package.
        customer_id: Authenticated tenant UUID.

    Returns:
        API Gateway response with package details and pre-signed download URL.
    """
    try:
        pool = get_connection_pool()
        with pool.getconn() as conn:
            set_rls_context(conn, customer_id)
            row = query_one(
                conn,
                """
                SELECT id, package_name, s3_bucket, s3_key, sha256_manifest,
                       framework, date_range_start, date_range_end, log_count,
                       package_size_bytes, status, retention_until, created_at
                FROM evidence_packages
                WHERE id = %s AND customer_id = %s
                """,
                (package_id, customer_id),
            )
            pool.putconn(conn)
    except DatabaseError as exc:
        _log('error', 'DB query failed in get_evidence', error=str(exc))
        return _error(500, 'Database error retrieving evidence package')

    if not row:
        return _error(404, f"Evidence package '{package_id}' not found")

    # Generate a short-lived presigned download URL
    try:
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': row['s3_bucket'], 'Key': row['s3_key']},
            ExpiresIn=PRESIGNED_URL_EXPIRES,
        )
    except ClientError as exc:
        _log('error', 'Failed to generate presigned URL',
             package_id=package_id, error=str(exc))
        download_url = None

    return _response(200, {
        'id': str(row['id']),
        'package_name': row['package_name'],
        'framework': row['framework'],
        'status': row['status'],
        'date_range_start': row['date_range_start'].isoformat(),
        'date_range_end': row['date_range_end'].isoformat(),
        'log_count': row['log_count'],
        'size_bytes': row['package_size_bytes'],
        'sha256': row['sha256_manifest'],
        'retention_until': row['retention_until'].isoformat(),
        'created_at': row['created_at'].isoformat(),
        'download_url': download_url,
        'download_url_expires_in': PRESIGNED_URL_EXPIRES,
    })


def _handle_generate(
    event: Dict[str, Any],
    customer_id: str,
    user_id: Optional[str],
) -> Dict:
    """Handle POST /admin/evidence/generate — asynchronously trigger packaging.

    Args:
        event:       API Gateway proxy event.
        customer_id: Authenticated tenant UUID.
        user_id:     Authenticated user UUID (may be None).

    Returns:
        API Gateway response with 202 Accepted.
    """
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return _error(400, 'Invalid JSON body')

    framework = body.get('framework', 'ALL').upper()
    if framework not in ('SOC2', 'HIPAA', 'FEDRAMP', 'ALL'):
        return _error(400, f"Invalid framework: '{framework}'. Must be SOC2, HIPAA, FedRAMP, or ALL")

    date_range_start = body.get('date_range_start')
    date_range_end = body.get('date_range_end')
    if not date_range_start or not date_range_end:
        return _error(400, "Missing required fields: 'date_range_start', 'date_range_end'")

    # Asynchronously invoke audit_log_packager
    packager_event = {
        'customer_id': customer_id,
        'framework': framework,
        'date_range_start': date_range_start,
        'date_range_end': date_range_end,
        'requested_by': user_id,
    }
    request_id = str(uuid.uuid4())

    try:
        lambda_client.invoke(
            FunctionName=PACKAGER_FUNCTION,
            InvocationType='Event',   # async
            Payload=json.dumps(packager_event),
        )
    except ClientError as exc:
        _log('error', 'Failed to invoke audit_log_packager',
             customer_id=customer_id, error=str(exc))
        return _error(500, 'Failed to trigger evidence package generation')

    _log('info', 'evidence generation triggered',
         customer_id=customer_id, framework=framework, request_id=request_id)

    return _response(202, {
        'message': 'Evidence package generation started',
        'request_id': request_id,
        'framework': framework,
        'date_range_start': date_range_start,
        'date_range_end': date_range_end,
    })


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    """Lambda entry point — routes API Gateway requests to handler functions.

    Args:
        event:   API Gateway proxy event.
        context: Lambda context object.

    Returns:
        API Gateway proxy response dict.
    """
    request_id = getattr(context, 'aws_request_id', str(uuid.uuid4()))
    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')

    _log('info', 'audit_evidence_api request',
         method=method, path=path, request_id=request_id)

    # ------------------------------------------------------------------
    # CORS preflight
    # ------------------------------------------------------------------
    if method == 'OPTIONS':
        return _response(204, '')

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------
    customer = _authenticate(event)
    if not customer:
        return _error(401, 'Unauthorized: valid API key required')

    customer_id: str = str(customer['id'])
    user_id: Optional[str] = customer.get('user_id')

    # ------------------------------------------------------------------
    # Route dispatch
    # ------------------------------------------------------------------
    path_parts = [p for p in path.strip('/').split('/') if p]
    # Expected: ['admin', 'evidence'] or ['admin', 'evidence', '<id>']

    if method == 'GET' and len(path_parts) == 2:
        # GET /admin/evidence
        return _handle_list(event, customer_id)

    if method == 'GET' and len(path_parts) == 3:
        # GET /admin/evidence/{package_id}
        package_id = path_parts[2]
        if package_id == 'generate':
            return _error(405, 'Use POST /admin/evidence/generate')
        return _handle_get(package_id, customer_id)

    if method == 'POST' and len(path_parts) == 3 and path_parts[2] == 'generate':
        # POST /admin/evidence/generate
        return _handle_generate(event, customer_id, user_id)

    return _error(404, f"Route not found: {method} {path}")
