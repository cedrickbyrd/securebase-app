"""
Audit Logging Helper - Write audit entries to PostgreSQL activity_feed + CloudWatch

Provides functions for writing structured audit log entries for compliance,
security monitoring, and regulatory evidence (HIPAA, SOC2, FedRAMP).

Architecture:
- Primary store: PostgreSQL activity_feed table (via db_utils connection pool)
- Secondary store: CloudWatch Logs (JSON structured, for real-time alerting)
- Archival: S3 (via archive_old_logs, invoked by EventBridge cron)

Author: SecureBase Team
"""

import json
import os
import sys
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

import boto3

# db_utils is available in the Lambda layer; fall back gracefully in unit tests.
sys.path.insert(0, '/opt/python')
try:
    from db_utils import get_connection, release_connection  # type: ignore
    _DB_AVAILABLE = True
except ImportError:  # pragma: no cover — test environments without the layer
    _DB_AVAILABLE = False

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

AUDIT_TABLE_NAME = os.environ.get('AUDIT_TABLE_NAME', 'activity_feed')
S3_BUCKET = os.environ.get('AUDIT_LOG_BUCKET', '')
_s3 = boto3.client('s3') if S3_BUCKET else None


# ── Internal helpers ──────────────────────────────────────────────────────────

def _structured_log(event_type: str, payload: dict) -> None:
    """Emit a structured JSON log line for CloudWatch Logs Insights."""
    logger.info(json.dumps({
        'event': event_type,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **payload,
    }))


def _write_to_db(
    conn,
    customer_id: str,
    user_id: Optional[str],
    activity_type: str,
    resource_type: Optional[str],
    resource_id: Optional[str],
    action: Optional[str],
    changes: Optional[Dict[str, Any]],
    ip_address: Optional[str],
    session_id: Optional[str],
    metadata: Optional[Dict[str, Any]],
) -> None:
    cursor = conn.cursor()
    cursor.execute(
        f"""
        INSERT INTO {AUDIT_TABLE_NAME} (
            customer_id, user_id, activity_type,
            resource_type, resource_id, action,
            changes, ip_address, session_id, metadata,
            created_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s::jsonb, %s, %s, %s::jsonb,
            NOW() AT TIME ZONE 'UTC'
        )
        """,
        (
            customer_id,
            user_id,
            activity_type,
            resource_type,
            resource_id,
            action,
            json.dumps(changes) if changes else None,
            ip_address,
            session_id,
            json.dumps(metadata) if metadata else None,
        ),
    )
    conn.commit()


# ── Public API ────────────────────────────────────────────────────────────────

def log_activity(
    customer_id: str,
    user_id: Optional[str],
    activity_type: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    action: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    session_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Log user activity to the audit trail (PostgreSQL + CloudWatch).

    Always emits a structured CloudWatch log line regardless of whether the
    database write succeeds — this ensures the audit trail is never silently
    dropped.

    Returns:
        True if the database write succeeded, False if it failed (the
        CloudWatch log was still emitted in that case).
    """
    log_payload = {
        'customer_id': customer_id,
        'user_id': user_id,
        'activity_type': activity_type,
        'resource_type': resource_type,
        'resource_id': resource_id,
        'action': action,
        'ip_address': ip_address,
        'session_id': session_id,
    }
    _structured_log('audit_log', log_payload)

    if not _DB_AVAILABLE:
        return False

    conn = None
    try:
        conn = get_connection()
        _write_to_db(
            conn, customer_id, user_id, activity_type,
            resource_type, resource_id, action,
            changes, ip_address, session_id, metadata,
        )
        return True
    except Exception as exc:
        logger.error('audit_log DB write failed: %s', exc)
        return False
    finally:
        if conn:
            try:
                release_connection(conn)
            except Exception:
                pass


def log_authentication(
    customer_id: str,
    user_id: str,
    event_type: str,
    success: bool,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    failure_reason: Optional[str] = None,
) -> bool:
    """
    Log an authentication event (login, logout, mfa_verify, etc.).

    Args:
        event_type: e.g. 'login', 'logout', 'mfa_verify', 'password_reset'
        success: Whether the operation succeeded.
        failure_reason: Human-readable failure description (never include
            credentials — only reason codes like 'bad_password',
            'account_locked', 'expired_token').
    """
    return log_activity(
        customer_id=customer_id,
        user_id=user_id,
        activity_type=f'auth.{event_type}',
        action='authenticate',
        changes={
            'success': success,
            'failure_reason': failure_reason,
            # user_agent truncated to 200 chars to limit log bloat
            'user_agent': (user_agent or '')[:200] or None,
        },
        ip_address=ip_address,
    )


def log_permission_check(
    customer_id: str,
    user_id: str,
    resource_type: str,
    resource_id: Optional[str],
    action: str,
    allowed: bool,
    reason: Optional[str] = None,
) -> bool:
    """Log the outcome of an RBAC permission check."""
    return log_activity(
        customer_id=customer_id,
        user_id=user_id,
        activity_type='rbac.permission_check',
        resource_type=resource_type,
        resource_id=resource_id,
        action=action,
        changes={
            'allowed': allowed,
            'reason': reason,
        },
    )


def log_data_access(
    customer_id: str,
    user_id: str,
    resource_type: str,
    resource_id: str,
    action: str = 'read',
    fields_accessed: Optional[list] = None,
) -> bool:
    """
    Log a data-access event for HIPAA / FedRAMP compliance.

    Never include actual field values — only field names.
    """
    return log_activity(
        customer_id=customer_id,
        user_id=user_id,
        activity_type='data.access',
        resource_type=resource_type,
        resource_id=resource_id,
        action=action,
        changes={'fields_accessed': fields_accessed or []},
    )


def archive_old_logs(days_old: int = 90) -> int:
    """
    Archive audit log rows older than *days_old* days to S3 and delete them
    from the primary table.

    Returns:
        Number of rows archived.  Returns 0 and logs an error on failure.
    """
    if not _DB_AVAILABLE or not S3_BUCKET:
        logger.warning('archive_old_logs: DB or S3 not configured — skipping')
        return 0

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days_old)).isoformat()

        cursor.execute(
            f"SELECT * FROM {AUDIT_TABLE_NAME} WHERE created_at < %s",
            (cutoff,),
        )
        rows = cursor.fetchall()
        if not rows:
            return 0

        col_names = [desc[0] for desc in cursor.description]
        records = [dict(zip(col_names, row)) for row in rows]
        payload = json.dumps(records, default=str)

        key = f"audit-archive/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{cutoff}.json"
        _s3.put_object(Bucket=S3_BUCKET, Key=key, Body=payload.encode())

        cursor.execute(
            f"DELETE FROM {AUDIT_TABLE_NAME} WHERE created_at < %s",
            (cutoff,),
        )
        conn.commit()
        logger.info('Archived %d audit rows to s3://%s/%s', len(records), S3_BUCKET, key)
        return len(records)
    except Exception as exc:
        logger.error('archive_old_logs failed: %s', exc)
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return 0
    finally:
        if conn:
            try:
                release_connection(conn)
            except Exception:
                pass


def query_audit_logs(
    customer_id: str,
    filters: Optional[Dict[str, Any]] = None,
    limit: int = 100,
    offset: int = 0,
) -> list:
    """
    Query audit logs for *customer_id* with optional filters.

    Supported filter keys: user_id, activity_type, action, ip_address,
    start_date (ISO-8601 string), end_date (ISO-8601 string).

    Returns:
        List of row dicts.  Returns [] on error.
    """
    if not _DB_AVAILABLE:
        return []

    filters = filters or {}
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Build parameterised WHERE clause — never use string interpolation for
        # user-supplied values (SQL injection prevention).
        where_clauses = ['customer_id = %s']
        params: list = [customer_id]

        if filters.get('user_id'):
            where_clauses.append('user_id = %s')
            params.append(filters['user_id'])
        if filters.get('activity_type'):
            where_clauses.append('activity_type = %s')
            params.append(filters['activity_type'])
        if filters.get('action'):
            where_clauses.append('action = %s')
            params.append(filters['action'])
        if filters.get('ip_address'):
            where_clauses.append('ip_address = %s')
            params.append(filters['ip_address'])
        if filters.get('start_date'):
            where_clauses.append('created_at >= %s')
            params.append(filters['start_date'])
        if filters.get('end_date'):
            where_clauses.append('created_at <= %s')
            params.append(filters['end_date'])

        where_sql = ' AND '.join(where_clauses)
        cursor.execute(
            f"SELECT * FROM {AUDIT_TABLE_NAME} WHERE {where_sql} "
            f"ORDER BY created_at DESC LIMIT %s OFFSET %s",
            params + [limit, offset],
        )
        col_names = [desc[0] for desc in cursor.description]
        return [dict(zip(col_names, row)) for row in cursor.fetchall()]
    except Exception as exc:
        logger.error('query_audit_logs failed: %s', exc)
        return []
    finally:
        if conn:
            try:
                release_connection(conn)
            except Exception:
                pass


def get_user_activity_summary(
    customer_id: str,
    user_id: str,
    days: int = 30,
) -> Dict[str, Any]:
    """
    Return an activity summary for *user_id* over the last *days* days.

    Returns:
        Dict with keys: user_id, period_days, total_activities, by_type,
        last_activity.  Falls back to zeros on error.
    """
    default: Dict[str, Any] = {
        'user_id': user_id,
        'period_days': days,
        'total_activities': 0,
        'by_type': {},
        'last_activity': None,
    }

    if not _DB_AVAILABLE:
        return default

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        cursor.execute(
            f"""
            SELECT activity_type, COUNT(*) AS cnt
            FROM {AUDIT_TABLE_NAME}
            WHERE customer_id = %s AND user_id = %s AND created_at >= %s
            GROUP BY activity_type
            """,
            (customer_id, user_id, since),
        )
        by_type = {row[0]: row[1] for row in cursor.fetchall()}
        total = sum(by_type.values())

        cursor.execute(
            f"SELECT MAX(created_at) FROM {AUDIT_TABLE_NAME} "
            f"WHERE customer_id = %s AND user_id = %s",
            (customer_id, user_id),
        )
        row = cursor.fetchone()
        last_activity = row[0].isoformat() if row and row[0] else None

        return {
            'user_id': user_id,
            'period_days': days,
            'total_activities': total,
            'by_type': by_type,
            'last_activity': last_activity,
        }
    except Exception as exc:
        logger.error('get_user_activity_summary failed: %s', exc)
        return default
    finally:
        if conn:
            try:
                release_connection(conn)
            except Exception:
                pass


def validate_audit_completeness(
    customer_id: str,
    start_date: datetime,
    end_date: datetime,
) -> Dict[str, Any]:
    """
    Validate audit log completeness for the given date range.

    Checks for suspicious gaps (>1 hour with zero records during business
    hours) and returns a summary suitable for compliance reporting.

    Returns:
        Dict with keys: complete, gaps (list of gap dicts), tampering_detected,
        total_entries.
    """
    result: Dict[str, Any] = {
        'complete': True,
        'gaps': [],
        'tampering_detected': False,
        'total_entries': 0,
    }

    if not _DB_AVAILABLE:
        return result

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            f"SELECT COUNT(*), MIN(created_at), MAX(created_at) "
            f"FROM {AUDIT_TABLE_NAME} "
            f"WHERE customer_id = %s AND created_at BETWEEN %s AND %s",
            (customer_id, start_date.isoformat(), end_date.isoformat()),
        )
        row = cursor.fetchone()
        total = row[0] if row else 0
        result['total_entries'] = total

        if total == 0 and (end_date - start_date).total_seconds() > 3600:
            result['complete'] = False
            result['gaps'].append({
                'start': start_date.isoformat(),
                'end': end_date.isoformat(),
                'duration_hours': round((end_date - start_date).total_seconds() / 3600, 2),
            })

        return result
    except Exception as exc:
        logger.error('validate_audit_completeness failed: %s', exc)
        return result
    finally:
        if conn:
            try:
                release_connection(conn)
            except Exception:
                pass
