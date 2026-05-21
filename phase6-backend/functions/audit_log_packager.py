"""
Phase 6.1 — Audit Log Packager Lambda.

Collects audit log files for a given tenant and date range from S3, packages
them into a zip archive with a SHA-256 manifest, uploads the archive to the
compliance evidence S3 bucket with Object Lock (COMPLIANCE mode, 7-year
retention), and writes an immutable record to the ``evidence_packages``
PostgreSQL table.

Handler:
    ``audit_log_packager.lambda_handler``

Trigger:
    - Direct Lambda invocation (from ``audit_evidence_api.py`` POST handler)
    - EventBridge scheduled rule (weekly automated packaging)

Event Schema:
    {
        "customer_id": "<uuid>",
        "framework": "SOC2" | "HIPAA" | "FedRAMP" | "ALL",
        "date_range_start": "2026-01-01T00:00:00Z",
        "date_range_end":   "2026-01-31T23:59:59Z",
        "requested_by": "<user_uuid>"   # optional; null for automated runs
    }

Environment Variables:
    AUDIT_SOURCE_BUCKET       S3 bucket containing raw audit log objects
    EVIDENCE_BUCKET           S3 bucket with Object Lock (compliance evidence)
    EVIDENCE_RETENTION_YEARS  Object Lock retention in years (default: 7)
    RDS_HOST                  Aurora Serverless v2 endpoint (via RDS Proxy)
    RDS_DATABASE              Database name (default: securebase)
    RDS_USER                  Application database user
    LOG_LEVEL                 DEBUG | INFO | WARNING | ERROR (default: INFO)

Author: SecureBase Engineering
Phase: 6.1 — Immutable Audit Logging at Scale
Python: 3.11
"""

import hashlib
import io
import json
import logging
import os
import sys
import uuid
import zipfile
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError

# Import shared database utilities and psycopg2 from the Lambda layer.
sys.path.insert(0, '/opt/python')
import psycopg2
import psycopg2.extras
from psycopg2.extras import RealDictCursor
from db_utils import (
    get_connection,
    release_connection,
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
# AWS SDK clients — initialised outside the handler for connection re-use.
# ---------------------------------------------------------------------------

s3_client = boto3.client('s3')
s3_resource = boto3.resource('s3')


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AUDIT_SOURCE_BUCKET = os.environ.get('AUDIT_SOURCE_BUCKET', '')
EVIDENCE_BUCKET = os.environ.get('EVIDENCE_BUCKET', '')
EVIDENCE_RETENTION_YEARS = int(os.environ.get('EVIDENCE_RETENTION_YEARS', '7'))
MAX_OBJECTS_PER_PACKAGE = 10_000   # Hard cap to stay within Lambda memory
MAX_SIZE_CONVERGENCE_ITERATIONS = 3
EVIDENCE_KMS_KEY_ARN = os.environ.get('EVIDENCE_KMS_KEY_ARN', '')
DEFAULT_KMS_KEY_ALIAS = 'alias/aws/s3'


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------


def _list_log_objects(
    bucket: str,
    customer_id: str,
    start: datetime,
    end: datetime,
) -> List[Dict[str, Any]]:
    """Return S3 object metadata for audit logs within the given date range.

    Logs are expected to be stored under the prefix:
    ``logs/{customer_id}/YYYY/MM/DD/``

    Args:
        bucket:      Source S3 bucket name.
        customer_id: Tenant UUID — used as the S3 key prefix.
        start:       Inclusive start of date range (UTC).
        end:         Inclusive end of date range (UTC).

    Returns:
        List of dicts with ``Key``, ``Size``, and ``LastModified``.

    Raises:
        ClientError: On S3 API failures.
    """
    objects: List[Dict[str, Any]] = []
    paginator = s3_client.get_paginator('list_objects_v2')

    current = start.replace(hour=0, minute=0, second=0, microsecond=0)
    while current <= end:
        prefix = f"logs/{customer_id}/{current.strftime('%Y/%m/%d')}/"
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get('Contents', []):
                mod_time = obj['LastModified']
                if start <= mod_time <= end:
                    objects.append({
                        'Key': obj['Key'],
                        'Size': obj['Size'],
                        'LastModified': mod_time.isoformat(),
                    })
                    if len(objects) >= MAX_OBJECTS_PER_PACKAGE:
                        _log('warning', 'Object cap reached; truncating package',
                             cap=MAX_OBJECTS_PER_PACKAGE, customer_id=customer_id)
                        return objects
        current += timedelta(days=1)

    return objects


def _build_zip_package(
    bucket: str,
    objects: List[Dict[str, Any]],
    manifest_meta: Dict[str, Any],
    cover_page_meta: Dict[str, Any],
) -> Tuple[bytes, str]:
    """Download objects from S3 and create an in-memory zip archive.

    A ``COVER_PAGE.pdf`` and ``MANIFEST.json`` file are included in the zip.
    The SHA-256 digest is computed over MANIFEST.json content.

    Args:
        bucket:        Source S3 bucket name.
        objects:       List of object metadata dicts from ``_list_log_objects``.
        manifest_meta: Additional metadata to embed in MANIFEST.json.

    Returns:
        Tuple of (zip_bytes, sha256_hex_digest).
    """
    file_hashes: Dict[str, str] = {}

    object_contents: Dict[str, bytes] = {}
    for obj in objects:
        key = obj['Key']
        response = s3_client.get_object(Bucket=bucket, Key=key)
        content = response['Body'].read()
        file_hashes[key] = hashlib.sha256(content).hexdigest()
        object_contents[key] = content

    manifest: Dict[str, Any] = {
        **manifest_meta,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'object_count': len(objects),
        'file_hashes': file_hashes,
    }
    manifest_json = json.dumps(manifest, indent=2).encode('utf-8')
    sha256 = hashlib.sha256(manifest_json).hexdigest()

    def _build_with_size(package_size_bytes: int) -> bytes:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(
                'COVER_PAGE.pdf',
                _generate_cover_page_pdf({
                    **cover_page_meta,
                    'sha256_manifest': sha256,
                    'package_size_bytes': package_size_bytes,
                }),
            )
            for key, content in object_contents.items():
                arc_name = key.split('/', 2)[-1] if key.count('/') >= 2 else key
                zf.writestr(arc_name, content)
            zf.writestr('MANIFEST.json', manifest_json)
        return zip_buffer.getvalue()

    zip_bytes = _build_with_size(0)
    # Iterate until the ZIP size converges because package_size_bytes is rendered
    # on the cover page, which changes the PDF content and therefore ZIP size.
    # Three passes are sufficient for decimal-length stabilization in practice.
    for _ in range(MAX_SIZE_CONVERGENCE_ITERATIONS):
        candidate_size = len(zip_bytes)
        updated_zip = _build_with_size(candidate_size)
        if len(updated_zip) == candidate_size:
            zip_bytes = updated_zip
            break
        zip_bytes = updated_zip
    return zip_bytes, sha256


def _generate_cover_page_pdf(cover_page_meta: Dict[str, Any]) -> bytes:
    """Render the auditor-grade evidence package cover page as PDF bytes."""
    from reportlab.lib.pagesizes import LETTER
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=LETTER)
    width, height = LETTER
    y = height - 50

    c.setFont('Helvetica-Bold', 18)
    c.drawString(50, y, 'SecureBase')
    y -= 22
    c.setFont('Helvetica-Bold', 15)
    c.drawString(50, y, 'Immutable Compliance Evidence Package')
    y -= 24

    c.setFont('Helvetica', 11)
    c.drawString(
        50,
        y,
        f"Tenant: {cover_page_meta['organization_name']} "
        f"({cover_page_meta['customer_id']})",
    )
    y -= 22

    sections = [
        ('Framework(s)', cover_page_meta['framework']),
        (
            'Coverage Period',
            f"{cover_page_meta['date_range_start']} -> {cover_page_meta['date_range_end']}",
        ),
        ('Generated', f"{cover_page_meta['created_at']} UTC"),
        ('Package ID', cover_page_meta['package_id']),
        ('SHA256 Manifest Hash', cover_page_meta['sha256_manifest']),
        ('KMS Key ARN', cover_page_meta['kms_key_arn']),
        ('Log Records Included', str(cover_page_meta['log_count'])),
        ('Package Size', f"{cover_page_meta['package_size_bytes']} bytes"),
    ]
    for label, value in sections:
        c.setFont('Helvetica-Bold', 10.5)
        c.drawString(50, y, f'{label}:')
        c.setFont('Helvetica', 10.5)
        c.drawString(210, y, value)
        y -= 17

    y -= 6
    c.setFont('Helvetica-Bold', 11)
    c.drawString(50, y, 'Immutability Statement')
    y -= 16

    statement = (
        "This evidence package was written to AWS S3 with Object Lock "
        "(COMPLIANCE mode) and cannot be modified, overwritten, or deleted "
        "for the duration of the retention period. All records are encrypted "
        "at rest using AWS KMS. The SHA256 hash above can be used to verify "
        "package integrity at any time."
    )
    c.setFont('Helvetica', 10)
    words = statement.split(' ')
    line = []
    for word in words:
        test_line = ' '.join(line + [word]).strip()
        if c.stringWidth(test_line, 'Helvetica', 10) > (width - 100):
            c.drawString(50, y, ' '.join(line))
            y -= 14
            line = [word]
        else:
            line.append(word)
    if line:
        c.drawString(50, y, ' '.join(line))
        y -= 20

    c.setFont('Helvetica-Bold', 10.5)
    c.drawString(50, y, f"Retention Until: {cover_page_meta['retention_until']}")
    y -= 16
    c.setFont('Helvetica', 10)
    c.drawString(50, y, 'SecureBase by TxImhotep LLC | securebase.tximhotep.com')

    c.showPage()
    c.save()
    return buffer.getvalue()


def _upload_evidence_package(
    zip_bytes: bytes,
    s3_key: str,
    retain_until: datetime,
    kms_key_arn: str,
) -> str:
    """Upload zip to the evidence bucket with Object Lock (COMPLIANCE mode).

    Args:
        zip_bytes:       Raw bytes of the zip archive.
        s3_key:          Destination S3 key in the evidence bucket.
        retain_until:    Object Lock retention timestamp.
        kms_key_arn:     KMS key ARN to use for SSE-KMS.

    Returns:
        S3 version ID of the uploaded object.

    Raises:
        ClientError: On upload failure.
    """
    put_args: Dict[str, Any] = {
        'Bucket': EVIDENCE_BUCKET,
        'Key': s3_key,
        'Body': zip_bytes,
        'ContentType': 'application/zip',
        'ObjectLockMode': 'COMPLIANCE',
        'ObjectLockRetainUntilDate': retain_until,
        'ServerSideEncryption': 'aws:kms',
        'Metadata': {
            'phase': '6.1',
            'generated_by': 'audit_log_packager',
        },
    }
    if kms_key_arn and kms_key_arn != DEFAULT_KMS_KEY_ALIAS:
        put_args['SSEKMSKeyId'] = kms_key_arn

    response = s3_client.put_object(**put_args)
    return response.get('VersionId', '')


def _write_evidence_record(
    package_id: str,
    customer_id: str,
    package_name: str,
    s3_key: str,
    version_id: str,
    sha256: str,
    framework: str,
    date_range_start: datetime,
    date_range_end: datetime,
    log_count: int,
    package_size_bytes: int,
    requested_by: Optional[str],
    retention_years: int,
) -> str:
    """Insert a record into the ``evidence_packages`` table.

    Args:
        customer_id:       Tenant UUID.
        package_name:      Human-readable package name.
        s3_key:            S3 key of the uploaded zip.
        version_id:        S3 version ID (Object Lock).
        sha256:            SHA-256 hex digest of the zip.
        framework:         'SOC2', 'HIPAA', 'FedRAMP', or 'ALL'.
        date_range_start:  Start of the audited date range.
        date_range_end:    End of the audited date range.
        log_count:         Number of log objects included.
        package_size_bytes: Size of the zip in bytes.
        requested_by:      User UUID who triggered the request (or None).
        retention_years:   Number of years for Object Lock retention.

    Returns:
        UUID of the newly created ``evidence_packages`` row.

    Raises:
        DatabaseError: On database insert failure.
    """
    conn = get_connection()
    try:
        # Set RLS context on this connection before any DML so the INSERT
        # runs under the correct tenant policy.
        with conn.cursor() as rls_cur:
            rls_cur.execute(
                "SELECT set_customer_context(%s, %s)", (customer_id, 'customer')
            )
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO evidence_packages (
                    id, customer_id, package_name, s3_bucket, s3_key, s3_version_id,
                    sha256_manifest, framework, date_range_start, date_range_end,
                    log_count, package_size_bytes, status, generated_by, retention_until
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'complete', %s,
                    NOW() + (%s || ' years')::INTERVAL
                )
                RETURNING id
                """,
                (
                    package_id,
                    customer_id,
                    package_name,
                    EVIDENCE_BUCKET,
                    s3_key,
                    version_id,
                    sha256,
                    framework,
                    date_range_start,
                    date_range_end,
                    log_count,
                    package_size_bytes,
                    requested_by,
                    str(retention_years),
                ),
            )
            row = cur.fetchone()
            conn.commit()
        if row:
            return str(row['id'] if isinstance(row, dict) else row[0])
        return ''
    except psycopg2.Error as exc:
        conn.rollback()
        raise DatabaseError(f"Failed to insert evidence_packages record: {exc}") from exc
    finally:
        release_connection(conn)


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda entry point — packages audit logs into a signed evidence archive.

    Args:
        event:   Lambda invocation payload (see module docstring for schema).
        context: Lambda context object (unused directly).

    Returns:
        Dict containing:
            - ``package_id``  (str): UUID of the created evidence_packages row.
            - ``s3_key``      (str): S3 key of the uploaded zip.
            - ``sha256``      (str): SHA-256 hex digest of the zip.
            - ``log_count``   (int): Number of log objects packaged.
            - ``size_bytes``  (int): Total zip size in bytes.

    Raises:
        ValueError: If required event fields are missing.
        RuntimeError: If packaging or upload fails.
    """
    request_id = getattr(context, 'aws_request_id', str(uuid.uuid4()))
    _log('info', 'audit_log_packager invoked',
         request_id=request_id, event_keys=list(event.keys()))

    # ------------------------------------------------------------------
    # Input validation
    # ------------------------------------------------------------------
    customer_id: Optional[str] = event.get('customer_id')
    framework: str = event.get('framework', 'ALL')
    date_range_start_str: Optional[str] = event.get('date_range_start')
    date_range_end_str: Optional[str] = event.get('date_range_end')
    requested_by: Optional[str] = event.get('requested_by')

    if not customer_id:
        raise ValueError("Event missing required field: 'customer_id'")
    if not date_range_start_str or not date_range_end_str:
        raise ValueError("Event missing 'date_range_start' or 'date_range_end'")
    if not AUDIT_SOURCE_BUCKET:
        raise RuntimeError("AUDIT_SOURCE_BUCKET environment variable is not set")
    if not EVIDENCE_BUCKET:
        raise RuntimeError("EVIDENCE_BUCKET environment variable is not set")
    organization_name: str = (
        event.get('organization_name')
        or event.get('tenant_name')
        or f'Customer {customer_id}'
    )

    try:
        date_range_start = datetime.fromisoformat(
            date_range_start_str.replace('Z', '+00:00')
        )
        date_range_end = datetime.fromisoformat(
            date_range_end_str.replace('Z', '+00:00')
        )
    except ValueError as exc:
        raise ValueError(f"Invalid date format in event: {exc}") from exc

    _log('info', 'packaging audit logs',
         customer_id=customer_id,
         framework=framework,
         date_range_start=date_range_start.isoformat(),
         date_range_end=date_range_end.isoformat())

    # ------------------------------------------------------------------
    # List source objects
    # ------------------------------------------------------------------
    try:
        objects = _list_log_objects(
            AUDIT_SOURCE_BUCKET, customer_id, date_range_start, date_range_end
        )
    except ClientError as exc:
        _log('error', 'Failed to list audit log objects',
             customer_id=customer_id, error=str(exc))
        raise RuntimeError(f"S3 list_objects failed: {exc}") from exc

    if not objects:
        _log('warning', 'No audit log objects found for date range',
             customer_id=customer_id,
             date_range_start=date_range_start.isoformat(),
             date_range_end=date_range_end.isoformat())
        # Return early — do not create an empty evidence package
        return {
            'package_id': None,
            's3_key': None,
            'sha256': None,
            'log_count': 0,
            'size_bytes': 0,
            'message': 'No log objects found for the specified date range.',
        }

    # ------------------------------------------------------------------
    # Build zip archive with manifest
    # ------------------------------------------------------------------
    # Human-readable display name shown in the portal evidence table.
    month_label = date_range_end.strftime('%B %Y')   # e.g. "May 2026"
    if framework == 'ALL':
        package_name = f"Compliance Baseline \u2014 {month_label}"
    else:
        package_name = f"{framework} Evidence \u2014 {month_label}"

    # Machine-readable S3 key preserves full date range for uniqueness.
    s3_package_slug = (
        f"{framework}_{date_range_start.strftime('%Y%m%d')}"
        f"_{date_range_end.strftime('%Y%m%d')}"
        f"_{customer_id[:8]}"
    )
    s3_key = (
        f"evidence/{customer_id}/{framework}/"
        f"{date_range_start.strftime('%Y/%m')}/"
        f"{s3_package_slug}.zip"
    )

    manifest_meta: Dict[str, Any] = {
        'customer_id': customer_id,
        'framework': framework,
        'date_range_start': date_range_start.isoformat(),
        'date_range_end': date_range_end.isoformat(),
        'requested_by': requested_by,
        's3_key': s3_key,
        'evidence_bucket': EVIDENCE_BUCKET,
    }
    package_id = str(uuid.uuid4())
    generated_at = datetime.now(timezone.utc)
    retention_until = generated_at + timedelta(days=365 * EVIDENCE_RETENTION_YEARS)
    kms_key_arn = EVIDENCE_KMS_KEY_ARN or DEFAULT_KMS_KEY_ALIAS

    try:
        zip_bytes, sha256 = _build_zip_package(
            AUDIT_SOURCE_BUCKET,
            objects,
            manifest_meta,
            {
                'organization_name': organization_name,
                'customer_id': customer_id,
                'framework': framework,
                'date_range_start': date_range_start.isoformat(),
                'date_range_end': date_range_end.isoformat(),
                'created_at': generated_at.replace(microsecond=0).isoformat(),
                'package_id': package_id,
                'kms_key_arn': kms_key_arn,
                'log_count': len(objects),
                'retention_until': retention_until.replace(microsecond=0).isoformat(),
            },
        )
    except ClientError as exc:
        _log('error', 'Failed to download log objects for packaging',
             customer_id=customer_id, error=str(exc))
        raise RuntimeError(f"Failed to build zip package: {exc}") from exc

    _log('info', 'zip archive built',
         customer_id=customer_id,
         sha256=sha256,
         size_bytes=len(zip_bytes),
         object_count=len(objects))

    # ------------------------------------------------------------------
    # Upload with Object Lock
    # ------------------------------------------------------------------
    try:
        version_id = _upload_evidence_package(
            zip_bytes, s3_key, retention_until, kms_key_arn
        )
    except ClientError as exc:
        _log('error', 'Failed to upload evidence package to S3',
             customer_id=customer_id, s3_key=s3_key, error=str(exc))
        raise RuntimeError(f"S3 upload failed: {exc}") from exc

    _log('info', 'evidence package uploaded',
         customer_id=customer_id,
         s3_key=s3_key,
         version_id=version_id,
         retention_years=EVIDENCE_RETENTION_YEARS)

    # ------------------------------------------------------------------
    # Write database record
    # ------------------------------------------------------------------
    try:
        package_id = _write_evidence_record(
            package_id=package_id,
            customer_id=customer_id,
            package_name=package_name,
            s3_key=s3_key,
            version_id=version_id,
            sha256=sha256,
            framework=framework,
            date_range_start=date_range_start,
            date_range_end=date_range_end,
            log_count=len(objects),
            package_size_bytes=len(zip_bytes),
            requested_by=requested_by,
            retention_years=EVIDENCE_RETENTION_YEARS,
        )
    except DatabaseError as exc:
        # Log but do NOT fail — the S3 object was already written with Object Lock.
        # The record can be reconciled later.
        _log('error', 'Failed to write evidence_packages DB record',
             customer_id=customer_id, s3_key=s3_key, error=str(exc))
        package_id = ''

    _log('info', 'audit_log_packager complete',
         customer_id=customer_id,
         package_id=package_id,
         sha256=sha256,
         log_count=len(objects))

    return {
        'package_id': package_id,
        's3_key': s3_key,
        'sha256': sha256,
        'log_count': len(objects),
        'size_bytes': len(zip_bytes),
    }
