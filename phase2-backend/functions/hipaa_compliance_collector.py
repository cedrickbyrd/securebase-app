"""
HIPAA Security Rule Compliance Evidence Collector
Lambda function that collects and vaults tamper-evident compliance evidence
required for HIPAA Security Rule (45 CFR Part 164) audits covering
Administrative, Technical, and Audit safeguards for Protected Health Information.

Controls implemented
--------------------
  HIPAA-AS.1   Workforce Training Records         164.308(a)(5)
  HIPAA-AS.2   Risk Analysis Documentation        164.308(a)(1)(ii)(A)
  HIPAA-TS.1   PHI Directory Access Controls      164.312(a)(1)
  HIPAA-TS.2   Encryption at Rest (PHI Volumes)   164.312(a)(2)(iv)
  HIPAA-TS.3   Database PHI Access Controls       164.312(a)(1)
  HIPAA-AU.1   PHI Access Audit Logging           164.312(b)
  HIPAA-AU.2   Audit Log Retention (7-year)       164.312(b)
  HIPAA-TX.1   Encryption in Transit (TLS 1.2+)   164.312(e)(1)
  HIPAA-TX.2   Secure PHI Transmission            164.312(e)(2)(ii)
  HIPAA-BAA.1  BAA Agreement on File              164.308(b)(1)

Evidence pipeline
-----------------
  Customer DB → Lambda → SHA-256 → KMS Sign → S3 Vault (Object Lock, HIPAA prefix)
                                 ↓
               Aurora (hipaa_* tables, hipaa_evidence_signatures)

  NOTE: S3 bucket MUST be configured with Object Lock in Compliance mode.
  HIPAA requires minimum 6-year retention; healthcare tier is configured for
  7 years (HIPAA_RETENTION_DAYS = 2555) matching dataRetentionDays in
  src/config/customerTiers.js.

Invocation modes
----------------
  Scheduled (EventBridge cron):   collects all active healthcare customers
  API Gateway (on-demand):        POST /hipaa/collect — collects a single
                                  customer, specific controls optional
  API Gateway (audit export):     POST /hipaa/audit-export — generates a
                                  signed HIPAA audit package

Environment variables
---------------------
  RDS_HOST            Aurora Proxy endpoint
  RDS_DATABASE        securebase
  RDS_USER            securebase_app
  RDS_SECRET_ARN      Secrets Manager ARN for DB password
  KMS_KEY_ID          KMS key for evidence signing
  S3_EVIDENCE_BUCKET  S3 bucket (Object Lock / Compliance mode, HIPAA-compliant)
  ENVIRONMENT         dev | staging | prod
  LOG_LEVEL           DEBUG | INFO | WARNING | ERROR

Event format (API Gateway on-demand)
-------------------------------------
  {
    "httpMethod": "POST",
    "path": "/hipaa/collect",
    "body": "{\"customer_id\": \"uuid\", \"controls\": [\"HIPAA-AS.1\"]}"
  }
  OR
  {
    "httpMethod": "POST",
    "path": "/hipaa/audit-export",
    "body": "{\"customer_id\": \"uuid\", \"period_start\": \"2025-01-01\",
              \"period_end\": \"2025-12-31\", \"auditor_name\": \"Jane Smith\",
              \"auditor_email\": \"jsmith@hhs.gov\"}"
  }
  OR (scheduled)
  {
    "source": "aws.events"
  }
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import uuid
from base64 import b64encode
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import boto3
import psycopg2
import psycopg2.extras

# ── Logging ───────────────────────────────────────────────────────────────────

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
logger = logging.getLogger(__name__)
logger.setLevel(LOG_LEVEL)

# ── AWS clients (module-level for Lambda container reuse) ─────────────────────

_secrets = boto3.client("secretsmanager")
_kms = boto3.client("kms")
_s3 = boto3.client("s3")

# ── Constants ─────────────────────────────────────────────────────────────────

CONTROL_CATALOGUE = {
    "HIPAA-AS.1": {
        "name": "Workforce Training Records",
        "regulation_ref": "164.308(a)(5)",
    },
    "HIPAA-AS.2": {
        "name": "Risk Analysis Documentation",
        "regulation_ref": "164.308(a)(1)(ii)(A)",
    },
    "HIPAA-TS.1": {
        "name": "PHI Directory Access Controls",
        "regulation_ref": "164.312(a)(1)",
    },
    "HIPAA-TS.2": {
        "name": "Encryption at Rest (PHI Volumes)",
        "regulation_ref": "164.312(a)(2)(iv)",
    },
    "HIPAA-TS.3": {
        "name": "Database PHI Access Controls",
        "regulation_ref": "164.312(a)(1)",
    },
    "HIPAA-AU.1": {
        "name": "PHI Access Audit Logging",
        "regulation_ref": "164.312(b)",
    },
    "HIPAA-AU.2": {
        "name": "Audit Log Retention (7-year)",
        "regulation_ref": "164.312(b)",
    },
    "HIPAA-TX.1": {
        "name": "Encryption in Transit (TLS 1.2+)",
        "regulation_ref": "164.312(e)(1)",
    },
    "HIPAA-TX.2": {
        "name": "Secure PHI Transmission",
        "regulation_ref": "164.312(e)(2)(ii)",
    },
    "HIPAA-BAA.1": {
        "name": "BAA Agreement on File",
        "regulation_ref": "164.308(b)(1)",
    },
}

ALL_CONTROLS = list(CONTROL_CATALOGUE.keys())

# Healthcare tier qualifier
HEALTHCARE_TIER = "healthcare"

# HIPAA requires minimum 6-year retention; healthcare tier is configured
# for 7 years to provide a safety margin (dataRetentionDays in customerTiers.js).
HIPAA_RETENTION_DAYS = 2555  # 7 years

# ── Environment ───────────────────────────────────────────────────────────────

RDS_HOST = os.environ.get("RDS_HOST", "")
RDS_DATABASE = os.environ.get("RDS_DATABASE", "securebase")
RDS_USER = os.environ.get("RDS_USER", "securebase_app")
RDS_SECRET_ARN = os.environ.get("RDS_SECRET_ARN", "")
KMS_KEY_ID = os.environ.get("KMS_KEY_ID", "")
S3_EVIDENCE_BUCKET = os.environ.get("S3_EVIDENCE_BUCKET", "securebase-evidence")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")

# ══════════════════════════════════════════════════════════════════════════════
# DATABASE HELPERS
# ══════════════════════════════════════════════════════════════════════════════


def _get_db_password() -> str:
    """Retrieve DB password from Secrets Manager (cached after first call)."""
    secret = _secrets.get_secret_value(SecretId=RDS_SECRET_ARN)
    value = secret.get("SecretString", "{}")
    return json.loads(value).get("password", value)


_db_conn: Optional[psycopg2.extensions.connection] = None


def get_db_connection() -> psycopg2.extensions.connection:
    """Return (or reuse) a psycopg2 connection to Aurora."""
    global _db_conn
    try:
        if _db_conn is None or _db_conn.closed:
            password = _get_db_password()
            _db_conn = psycopg2.connect(
                host=RDS_HOST,
                dbname=RDS_DATABASE,
                user=RDS_USER,
                password=password,
                connect_timeout=5,
                cursor_factory=psycopg2.extras.RealDictCursor,
            )
            _db_conn.autocommit = False
        return _db_conn
    except Exception as exc:
        logger.error("DB connection failed: %s", exc)
        raise


def set_rls_context(conn: psycopg2.extensions.connection, customer_id: str) -> None:
    """Set the PostgreSQL session variable for Row-Level Security."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT set_config('app.current_customer_id', %s, TRUE)",
            (str(customer_id),),
        )


# ══════════════════════════════════════════════════════════════════════════════
# EVIDENCE SIGNING & VAULTING
# ══════════════════════════════════════════════════════════════════════════════


def sha256_hex(data: Any) -> str:
    """Return lowercase hex SHA-256 of the JSON-serialised data."""
    payload = json.dumps(data, sort_keys=True, default=str).encode()
    return hashlib.sha256(payload).hexdigest()


def kms_sign(content_hash: str) -> str:
    """Sign a content hash with KMS and return base64-encoded signature."""
    if not KMS_KEY_ID:
        logger.warning("KMS_KEY_ID not set; skipping signing")
        return ""
    resp = _kms.sign(
        KeyId=KMS_KEY_ID,
        Message=content_hash.encode(),
        MessageType="RAW",
        SigningAlgorithm="RSASSA_PKCS1_V1_5_SHA_256",
    )
    return b64encode(resp["Signature"]).decode()


def vault_to_s3(
    customer_id: str, evidence_type: str, evidence_id: str, payload: Any
) -> str:
    """Upload evidence JSON to S3 under the HIPAA-compliant prefix and return the key.

    NOTE: The S3 bucket must be configured with Object Lock in Compliance mode
    and a retention period of at least HIPAA_RETENTION_DAYS (2555 days / 7 years).
    This satisfies 45 CFR §164.312(b) audit log preservation requirements.
    """
    date_prefix = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    # Use 'hipaa' sub-prefix to distinguish from fintech evidence in the same bucket
    key = (
        f"evidence/{ENVIRONMENT}/{customer_id}/hipaa/{evidence_type}/"
        f"{date_prefix}/{evidence_id}.json"
    )
    body = json.dumps(payload, default=str, indent=2).encode()
    _s3.put_object(
        Bucket=S3_EVIDENCE_BUCKET,
        Key=key,
        Body=body,
        ContentType="application/json",
        ServerSideEncryption="aws:kms",
        SSEKMSKeyId=KMS_KEY_ID or None,
    )
    logger.debug("Vaulted HIPAA evidence: s3://%s/%s", S3_EVIDENCE_BUCKET, key)
    return key


def record_signature(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    evidence_type: str,
    evidence_id: str,
    content_hash: str,
    kms_sig: str,
    lambda_request_id: str,
) -> None:
    """Insert a KMS-signature record into hipaa_evidence_signatures."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO hipaa_evidence_signatures
              (id, customer_id, evidence_type, evidence_id, content_hash,
               kms_key_id, kms_signature_b64, signed_at, lambda_request_id)
            VALUES
              (gen_random_uuid(), %s, %s, %s::UUID, %s, %s, %s, NOW(), %s)
            """,
            (
                str(customer_id),
                evidence_type,
                str(evidence_id),
                content_hash,
                KMS_KEY_ID,
                kms_sig,
                lambda_request_id,
            ),
        )


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL COLLECTORS
# ══════════════════════════════════════════════════════════════════════════════


def collect_hipaa_as1(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    HIPAA-AS.1 — Workforce Training Records (164.308(a)(5))
    Verifies that all active workforce members have current HIPAA security
    training on file with completion dates within the past 12 months.
    """
    logger.info("[HIPAA-AS.1] Collecting workforce training records for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                                                            AS total_staff,
              COUNT(*) FILTER (WHERE last_training_date IS NOT NULL
                AND last_training_date >= NOW() - INTERVAL '365 days')           AS trained_current,
              COUNT(*) FILTER (WHERE last_training_date IS NULL
                OR last_training_date < NOW() - INTERVAL '365 days')             AS training_overdue,
              MIN(last_training_date)                                             AS oldest_training,
              MAX(last_training_date)                                             AS newest_training
            FROM hipaa_phi_access_logs
            WHERE customer_id = %s
              AND record_type = 'workforce_training'
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "HIPAA-AS.1",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "164.308(a)(5)",
        "metrics": dict(row) if row else {},
    }

    total = evidence["metrics"].get("total_staff") or 0
    overdue = evidence["metrics"].get("training_overdue") or 0

    if total == 0:
        status = "pending_review"
        findings = {"issue": "No workforce training records found."}
    elif overdue > 0:
        status = "non_compliant"
        findings = {
            "overdue_count": overdue,
            "total_staff": total,
            "issue": f"{overdue} of {total} staff members have missing or expired training.",
            "action_required": "Schedule HIPAA security training for overdue staff members.",
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "HIPAA-AS.1", status, findings, total, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "HIPAA-AS.1", evidence_id, evidence)
    record_signature(conn, customer_id, "HIPAA-AS.1", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[HIPAA-AS.1] Complete — status=%s staff=%d overdue=%d", status, total, overdue)
    return evidence


def collect_hipaa_as2(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    HIPAA-AS.2 — Risk Analysis Documentation (164.308(a)(1)(ii)(A))
    Checks that a current risk analysis document exists and was completed
    within the past 12 months as required by the Security Management Process.
    """
    logger.info("[HIPAA-AS.2] Collecting risk analysis documentation for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                                                    AS total_analyses,
              COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '365 days'
                AND document_status = 'approved')                        AS current_approved,
              MAX(completed_at)                                           AS most_recent,
              COUNT(*) FILTER (WHERE document_status = 'draft')          AS in_draft,
              COUNT(*) FILTER (WHERE remediation_items_open > 0)         AS with_open_findings
            FROM hipaa_phi_access_logs
            WHERE customer_id = %s
              AND record_type = 'risk_analysis'
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "HIPAA-AS.2",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "164.308(a)(1)(ii)(A)",
        "metrics": dict(row) if row else {},
    }

    current = evidence["metrics"].get("current_approved") or 0
    total = evidence["metrics"].get("total_analyses") or 0
    open_findings = evidence["metrics"].get("with_open_findings") or 0

    if current == 0 and total == 0:
        status = "pending_review"
        findings = {"issue": "No risk analysis records found in the database."}
    elif current == 0:
        status = "non_compliant"
        findings = {
            "issue": "No approved risk analysis completed within the past 12 months.",
            "total_on_record": total,
            "action_required": "Conduct and document a HIPAA risk analysis (164.308(a)(1)(ii)(A)).",
        }
    elif open_findings > 0:
        status = "partial"
        findings = {
            "open_remediation_items": open_findings,
            "issue": f"{open_findings} risk analysis reports have unresolved remediation items.",
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "HIPAA-AS.2", status, findings, total, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "HIPAA-AS.2", evidence_id, evidence)
    record_signature(conn, customer_id, "HIPAA-AS.2", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[HIPAA-AS.2] Complete — status=%s current_approved=%d", status, current)
    return evidence


def collect_hipaa_ts1(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    HIPAA-TS.1 — PHI Directory Access Controls (164.312(a)(1))
    Validates that PHI file-system directories have role-based access controls
    configured and that no world-readable or overly permissive ACLs exist.
    """
    logger.info("[HIPAA-TS.1] Collecting PHI directory access controls for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                                                        AS total_resources,
              COUNT(*) FILTER (WHERE resource_type = 'directory'
                AND access_control_configured = TRUE)                        AS controlled,
              COUNT(*) FILTER (WHERE resource_type = 'directory'
                AND (world_readable = TRUE OR overly_permissive = TRUE))     AS permissive,
              COUNT(*) FILTER (WHERE resource_type = 'directory'
                AND last_access_review_at < NOW() - INTERVAL '90 days'
                OR last_access_review_at IS NULL)                            AS review_overdue
            FROM hipaa_encryption_status
            WHERE customer_id = %s
              AND resource_type = 'directory'
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "HIPAA-TS.1",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "164.312(a)(1)",
        "metrics": dict(row) if row else {},
    }

    total = evidence["metrics"].get("total_resources") or 0
    permissive = evidence["metrics"].get("permissive") or 0
    review_overdue = evidence["metrics"].get("review_overdue") or 0

    if total == 0:
        status = "pending_review"
        findings = {"issue": "No PHI directory resources found in encryption inventory."}
    elif permissive > 0:
        status = "non_compliant"
        findings = {
            "overly_permissive_directories": permissive,
            "action_required": "Remove world-readable or overly permissive ACLs on PHI directories.",
        }
    elif review_overdue > 0:
        status = "partial"
        findings = {
            "access_review_overdue": review_overdue,
            "issue": f"{review_overdue} directories have not had an access review in 90+ days.",
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "HIPAA-TS.1", status, findings, total, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "HIPAA-TS.1", evidence_id, evidence)
    record_signature(conn, customer_id, "HIPAA-TS.1", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[HIPAA-TS.1] Complete — status=%s permissive=%d", status, permissive)
    return evidence


def collect_hipaa_ts2(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    HIPAA-TS.2 — Encryption at Rest (PHI Volumes) (164.312(a)(2)(iv))
    Validates that all PHI-bearing storage volumes (S3, RDS, EBS) have
    encryption at rest enabled with an active KMS key.
    """
    logger.info("[HIPAA-TS.2] Collecting encryption-at-rest status for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              resource_type,
              COUNT(*)                                                        AS total,
              COUNT(*) FILTER (WHERE encryption_enabled = TRUE
                AND kms_key_status = 'active')                               AS encrypted_active_key,
              COUNT(*) FILTER (WHERE encryption_enabled = FALSE)             AS unencrypted,
              COUNT(*) FILTER (WHERE kms_key_status IN ('disabled', 'pending_deletion')) AS degraded_key
            FROM hipaa_encryption_status
            WHERE customer_id = %s
              AND contains_phi = TRUE
            GROUP BY resource_type
            """,
            (str(customer_id),),
        )
        rows = cur.fetchall()

    by_type = [dict(r) for r in rows]
    total = sum(r["total"] for r in by_type)
    unencrypted = sum(r["unencrypted"] for r in by_type)
    degraded = sum(r["degraded_key"] for r in by_type)

    evidence = {
        "control_id": "HIPAA-TS.2",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "164.312(a)(2)(iv)",
        "encryption_by_resource_type": by_type,
        "totals": {"total": total, "unencrypted": unencrypted, "degraded_key": degraded},
    }

    if total == 0:
        status = "pending_review"
        findings = {"issue": "No PHI-bearing resources found in encryption inventory."}
    elif unencrypted > 0:
        status = "non_compliant"
        findings = {
            "unencrypted_resources": unencrypted,
            "action_required": "Enable KMS encryption on all PHI-bearing storage resources.",
        }
    elif degraded > 0:
        status = "partial"
        findings = {
            "degraded_key_resources": degraded,
            "issue": "Some PHI resources use disabled or pending-deletion KMS keys.",
            "action_required": "Rotate or re-enable KMS keys for affected resources.",
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "HIPAA-TS.2", status, findings, total, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "HIPAA-TS.2", evidence_id, evidence)
    record_signature(conn, customer_id, "HIPAA-TS.2", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[HIPAA-TS.2] Complete — status=%s unencrypted=%d degraded=%d", status, unencrypted, degraded)
    return evidence


def collect_hipaa_ts3(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    HIPAA-TS.3 — Database PHI Access Controls (164.312(a)(1))
    Validates that PHI-bearing databases enforce column/row-level access
    controls and that no overly permissive database roles have PHI access.
    """
    logger.info("[HIPAA-TS.3] Collecting database PHI access controls for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                                                        AS total_db_resources,
              COUNT(*) FILTER (WHERE resource_type = 'rds'
                AND access_control_configured = TRUE)                        AS rls_enabled,
              COUNT(*) FILTER (WHERE resource_type = 'rds'
                AND access_control_configured = FALSE)                       AS rls_missing,
              COUNT(*) FILTER (WHERE resource_type = 'rds'
                AND overly_permissive = TRUE)                                AS overprivileged_roles
            FROM hipaa_encryption_status
            WHERE customer_id = %s
              AND resource_type = 'rds'
              AND contains_phi = TRUE
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "HIPAA-TS.3",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "164.312(a)(1)",
        "metrics": dict(row) if row else {},
    }

    total = evidence["metrics"].get("total_db_resources") or 0
    rls_missing = evidence["metrics"].get("rls_missing") or 0
    overprivileged = evidence["metrics"].get("overprivileged_roles") or 0

    if total == 0:
        status = "pending_review"
        findings = {"issue": "No PHI-bearing RDS resources found in inventory."}
    elif rls_missing > 0 or overprivileged > 0:
        status = "non_compliant"
        findings = {
            "rls_missing": rls_missing,
            "overprivileged_roles": overprivileged,
            "action_required": "Enable RLS policies and remove over-privileged database roles from PHI tables.",
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "HIPAA-TS.3", status, findings, total, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "HIPAA-TS.3", evidence_id, evidence)
    record_signature(conn, customer_id, "HIPAA-TS.3", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[HIPAA-TS.3] Complete — status=%s rls_missing=%d overprivileged=%d", status, rls_missing, overprivileged)
    return evidence


def collect_hipaa_au1(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    HIPAA-AU.1 — PHI Access Audit Logging (164.312(b))
    Verifies that all PHI read/write operations are captured in
    hipaa_phi_access_logs and that no logging gaps exist in the past 24 hours.
    """
    logger.info("[HIPAA-AU.1] Collecting PHI access audit log status for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                                                          AS total_events,
              COUNT(*) FILTER (WHERE accessed_at >= NOW() - INTERVAL '24 hours') AS last_24h,
              COUNT(*) FILTER (WHERE action IN ('read', 'write', 'delete'))    AS phi_operations,
              COUNT(*) FILTER (WHERE user_id IS NULL OR user_id = '')          AS anonymous_access,
              MIN(accessed_at)                                                  AS oldest_log,
              MAX(accessed_at)                                                  AS newest_log
            FROM hipaa_phi_access_logs
            WHERE customer_id = %s
              AND record_type = 'phi_access'
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "HIPAA-AU.1",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "164.312(b)",
        "metrics": dict(row) if row else {},
    }

    total = evidence["metrics"].get("total_events") or 0
    anonymous = evidence["metrics"].get("anonymous_access") or 0
    last_24h = evidence["metrics"].get("last_24h") or 0

    if total == 0:
        status = "non_compliant"
        findings = {
            "issue": "No PHI access audit log entries found — audit logging may not be configured.",
            "action_required": "Enable CloudTrail data events and application-level PHI access logging.",
        }
    elif anonymous > 0:
        status = "non_compliant"
        findings = {
            "anonymous_access_events": anonymous,
            "action_required": "All PHI access must be attributed to an identified user (164.312(b)).",
        }
    elif last_24h == 0 and total > 0:
        status = "partial"
        findings = {
            "issue": "No PHI access events logged in the past 24 hours — logging gap suspected.",
            "last_event_total": total,
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "HIPAA-AU.1", status, findings, total, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "HIPAA-AU.1", evidence_id, evidence)
    record_signature(conn, customer_id, "HIPAA-AU.1", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[HIPAA-AU.1] Complete — status=%s total=%d anonymous=%d", status, total, anonymous)
    return evidence


def collect_hipaa_au2(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    HIPAA-AU.2 — Audit Log Retention (7-year) (164.312(b))
    Validates that audit log retention policy meets the HIPAA 6-year minimum.
    Healthcare tier is configured for 7 years (HIPAA_RETENTION_DAYS = 2555).
    Evidence includes oldest log entry date to confirm archive depth.
    """
    logger.info("[HIPAA-AU.2] Collecting audit log retention status for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              MIN(accessed_at)                                        AS oldest_log_entry,
              MAX(accessed_at)                                        AS newest_log_entry,
              COUNT(*)                                                AS total_log_entries,
              EXTRACT(DAY FROM NOW() - MIN(accessed_at))::INTEGER    AS log_age_days,
              COUNT(DISTINCT DATE_TRUNC('month', accessed_at))       AS months_covered
            FROM hipaa_phi_access_logs
            WHERE customer_id = %s
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "HIPAA-AU.2",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "164.312(b)",
        "hipaa_retention_days_required": 2190,   # 6 years minimum
        "configured_retention_days": HIPAA_RETENTION_DAYS,  # 2555 = 7 years
        "metrics": dict(row) if row else {},
    }

    total = evidence["metrics"].get("total_log_entries") or 0
    log_age_days = evidence["metrics"].get("log_age_days") or 0

    if total == 0:
        status = "pending_review"
        findings = {"issue": "No audit log entries found — cannot assess retention compliance."}
    elif log_age_days < 2190:  # Less than 6 years
        status = "partial"
        findings = {
            "log_age_days": log_age_days,
            "required_days": 2190,
            "configured_days": HIPAA_RETENTION_DAYS,
            "issue": f"Audit logs span {log_age_days} days; HIPAA requires minimum 2190 days (6 years).",
        }
    else:
        status = "compliant"
        findings = {"log_age_days": log_age_days, "configured_retention_days": HIPAA_RETENTION_DAYS}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "HIPAA-AU.2", status, findings, total, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "HIPAA-AU.2", evidence_id, evidence)
    record_signature(conn, customer_id, "HIPAA-AU.2", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[HIPAA-AU.2] Complete — status=%s log_age_days=%d", status, log_age_days)
    return evidence


def collect_hipaa_tx1(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    HIPAA-TX.1 — Encryption in Transit (TLS 1.2+) (164.312(e)(1))
    Validates that all PHI transmission channels use TLS 1.2 or higher.
    Checks load balancers, API gateways, and direct database connections.
    """
    logger.info("[HIPAA-TX.1] Collecting encryption-in-transit status for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                                                        AS total_channels,
              COUNT(*) FILTER (WHERE tls_version IN ('TLSv1.2', 'TLSv1.3')
                AND contains_phi = TRUE)                                      AS compliant_channels,
              COUNT(*) FILTER (WHERE (tls_version NOT IN ('TLSv1.2', 'TLSv1.3')
                OR tls_version IS NULL)
                AND contains_phi = TRUE)                                      AS non_compliant_channels,
              COUNT(*) FILTER (WHERE contains_phi = TRUE)                    AS phi_channels
            FROM hipaa_encryption_status
            WHERE customer_id = %s
              AND resource_type IN ('alb', 'api_gateway', 'rds', 'elasticache')
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "HIPAA-TX.1",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "164.312(e)(1)",
        "metrics": dict(row) if row else {},
    }

    phi_channels = evidence["metrics"].get("phi_channels") or 0
    non_compliant = evidence["metrics"].get("non_compliant_channels") or 0

    if phi_channels == 0:
        status = "pending_review"
        findings = {"issue": "No PHI transmission channels found in encryption inventory."}
    elif non_compliant > 0:
        status = "non_compliant"
        findings = {
            "non_compliant_channels": non_compliant,
            "action_required": "Enforce TLS 1.2 minimum policy on all PHI transmission channels.",
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "HIPAA-TX.1", status, findings, phi_channels, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "HIPAA-TX.1", evidence_id, evidence)
    record_signature(conn, customer_id, "HIPAA-TX.1", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[HIPAA-TX.1] Complete — status=%s non_compliant_channels=%d", status, non_compliant)
    return evidence


def collect_hipaa_tx2(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    HIPAA-TX.2 — Secure PHI Transmission (164.312(e)(2)(ii))
    Validates that all PHI transmitted over open networks is end-to-end
    encrypted and that transmission integrity controls are in place.
    Checks for integrity checksums and signed payloads on PHI transfers.
    """
    logger.info("[HIPAA-TX.2] Collecting secure PHI transmission evidence for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                                                        AS total_transmissions,
              COUNT(*) FILTER (WHERE encrypted = TRUE
                AND integrity_verified = TRUE)                                AS secure_transmissions,
              COUNT(*) FILTER (WHERE encrypted = FALSE)                      AS unencrypted_transmissions,
              COUNT(*) FILTER (WHERE integrity_verified = FALSE)             AS integrity_failures,
              COUNT(*) FILTER (WHERE transmission_type = 'external')        AS external_transmissions,
              COUNT(*) FILTER (WHERE transmission_type = 'external'
                AND encrypted = FALSE)                                        AS insecure_external
            FROM hipaa_phi_access_logs
            WHERE customer_id = %s
              AND record_type = 'phi_transmission'
              AND accessed_at >= NOW() - INTERVAL '30 days'
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "HIPAA-TX.2",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "164.312(e)(2)(ii)",
        "metrics": dict(row) if row else {},
    }

    total = evidence["metrics"].get("total_transmissions") or 0
    unencrypted = evidence["metrics"].get("unencrypted_transmissions") or 0
    insecure_external = evidence["metrics"].get("insecure_external") or 0
    integrity_failures = evidence["metrics"].get("integrity_failures") or 0

    if total == 0:
        status = "pending_review"
        findings = {"issue": "No PHI transmission records found in the past 30 days."}
    elif unencrypted > 0 or insecure_external > 0:
        status = "non_compliant"
        findings = {
            "unencrypted_transmissions": unencrypted,
            "insecure_external_transmissions": insecure_external,
            "action_required": "Encrypt all PHI transmissions, especially over external/open networks.",
        }
    elif integrity_failures > 0:
        status = "partial"
        findings = {
            "integrity_failures": integrity_failures,
            "issue": "Some PHI transmissions failed integrity verification checks.",
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "HIPAA-TX.2", status, findings, total, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "HIPAA-TX.2", evidence_id, evidence)
    record_signature(conn, customer_id, "HIPAA-TX.2", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[HIPAA-TX.2] Complete — status=%s unencrypted=%d", status, unencrypted)
    return evidence


def collect_hipaa_baa1(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    HIPAA-BAA.1 — BAA Agreement on File (164.308(b)(1))
    Verifies that a current Business Associate Agreement (BAA) is on file
    for all business associates that handle PHI on behalf of the customer.
    """
    logger.info("[HIPAA-BAA.1] Collecting BAA agreement records for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                                                        AS total_baa,
              COUNT(*) FILTER (WHERE status = 'active'
                AND (expiry IS NULL OR expiry > NOW()))                       AS active_valid,
              COUNT(*) FILTER (WHERE status = 'expired'
                OR (expiry IS NOT NULL AND expiry <= NOW()))                  AS expired,
              COUNT(*) FILTER (WHERE status = 'pending_signature')           AS pending,
              MIN(signed_at)                                                  AS oldest_baa,
              COUNT(*) FILTER (WHERE expiry <= NOW() + INTERVAL '90 days'
                AND status = 'active')                                        AS expiring_soon
            FROM hipaa_baa_agreements
            WHERE customer_id = %s
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "HIPAA-BAA.1",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "164.308(b)(1)",
        "metrics": dict(row) if row else {},
    }

    total = evidence["metrics"].get("total_baa") or 0
    active_valid = evidence["metrics"].get("active_valid") or 0
    expired = evidence["metrics"].get("expired") or 0
    pending = evidence["metrics"].get("pending") or 0
    expiring_soon = evidence["metrics"].get("expiring_soon") or 0

    if total == 0:
        status = "non_compliant"
        findings = {
            "issue": "No BAA agreements found — required for all business associates handling PHI.",
            "action_required": "Execute BAA agreements with all business associates per 164.308(b)(1).",
        }
    elif expired > 0:
        status = "non_compliant"
        findings = {
            "expired_baa": expired,
            "action_required": "Renew expired BAA agreements immediately.",
        }
    elif pending > 0:
        status = "partial"
        findings = {
            "pending_signature": pending,
            "issue": f"{pending} BAA agreements awaiting signature.",
        }
    elif expiring_soon > 0:
        status = "compliant"
        findings = {
            "expiring_within_90_days": expiring_soon,
            "note": "Some BAAs are expiring within 90 days — initiate renewal process.",
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "HIPAA-BAA.1", status, findings, total, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "HIPAA-BAA.1", evidence_id, evidence)
    record_signature(conn, customer_id, "HIPAA-BAA.1", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[HIPAA-BAA.1] Complete — status=%s active=%d expired=%d", status, active_valid, expired)
    return evidence


# ══════════════════════════════════════════════════════════════════════════════
# SHARED HELPERS
# ══════════════════════════════════════════════════════════════════════════════


def _update_control_status(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    control_id: str,
    status: str,
    findings: Dict[str, Any],
    evidence_count: int,
    lambda_request_id: str,
) -> None:
    """Upsert a row in hipaa_compliance_controls."""
    ctrl = CONTROL_CATALOGUE.get(control_id, {})
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO hipaa_compliance_controls
              (id, customer_id, control_id, control_name, regulation_ref,
               status, last_assessed_at, evidence_count, findings,
               assessed_by_lambda, created_at, updated_at)
            VALUES
              (gen_random_uuid(), %s, %s, %s, %s,
               %s::hipaa_control_status, NOW(), %s, %s,
               %s, NOW(), NOW())
            ON CONFLICT (customer_id, control_id) DO UPDATE SET
              status            = EXCLUDED.status,
              last_assessed_at  = EXCLUDED.last_assessed_at,
              evidence_count    = EXCLUDED.evidence_count,
              findings          = EXCLUDED.findings,
              assessed_by_lambda= EXCLUDED.assessed_by_lambda,
              updated_at        = NOW()
            """,
            (
                str(customer_id),
                control_id,
                ctrl.get("name", control_id),
                ctrl.get("regulation_ref", ""),
                status,
                evidence_count,
                json.dumps(findings),
                lambda_request_id,
            ),
        )


def _get_healthcare_customers(conn: psycopg2.extensions.connection) -> List[str]:
    """Return customer IDs for the healthcare tier with active status."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::TEXT FROM customers
            WHERE tier = %s AND status = 'active'
            """,
            (HEALTHCARE_TIER,),
        )
        return [row["id"] for row in cur.fetchall()]


# ══════════════════════════════════════════════════════════════════════════════
# AUDIT EXPORT
# ══════════════════════════════════════════════════════════════════════════════


def generate_audit_export(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    period_start: str,
    period_end: str,
    auditor_name: str,
    auditor_email: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    Build a signed HIPAA audit evidence package covering all controls
    for the requested date range and upload it to S3.

    The package includes:
      - PHI access logs for the period
      - Encryption status snapshots
      - BAA agreements active during the period
      - Current control statuses
      - Package SHA-256 hash + KMS signature
    """
    logger.info(
        "Generating HIPAA audit export for customer=%s period=%s to %s",
        customer_id, period_start, period_end,
    )

    export_ref = (
        f"HIPAA-AUDIT-{ENVIRONMENT.upper()}-"
        f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-"
        f"{uuid.uuid4().hex[:8].upper()}"
    )

    with conn.cursor() as cur:
        # PHI access logs for the period
        cur.execute(
            """
            SELECT id, accessed_at, user_id, action, resource_id,
                   resource_type, record_type, patient_id,
                   transmission_type, encrypted, integrity_verified
            FROM hipaa_phi_access_logs
            WHERE customer_id = %s
              AND accessed_at BETWEEN %s::DATE AND %s::DATE + INTERVAL '1 day'
            ORDER BY accessed_at
            """,
            (str(customer_id), period_start, period_end),
        )
        phi_access_logs = [dict(r) for r in cur.fetchall()]

        # Encryption status snapshots
        cur.execute(
            """
            SELECT id, resource_type, resource_id, resource_name,
                   contains_phi, encryption_enabled, kms_key_status,
                   tls_version, access_control_configured,
                   overly_permissive, snapshot_at
            FROM hipaa_encryption_status
            WHERE customer_id = %s
            ORDER BY resource_type, resource_id
            """,
            (str(customer_id),),
        )
        encryption_snapshots = [dict(r) for r in cur.fetchall()]

        # BAA agreements active during the period
        cur.execute(
            """
            SELECT id, counterparty, signed_at, expiry, status
            FROM hipaa_baa_agreements
            WHERE customer_id = %s
              AND signed_at <= %s::DATE + INTERVAL '1 day'
              AND (expiry IS NULL OR expiry >= %s::DATE)
            ORDER BY signed_at
            """,
            (str(customer_id), period_end, period_start),
        )
        baa_agreements = [dict(r) for r in cur.fetchall()]

        # Current control statuses
        cur.execute(
            "SELECT * FROM hipaa_compliance_controls WHERE customer_id = %s",
            (str(customer_id),),
        )
        controls = [dict(r) for r in cur.fetchall()]

    package = {
        "export_reference": export_ref,
        "customer_id": str(customer_id),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period_start": period_start,
        "period_end": period_end,
        "auditor_name": auditor_name,
        "auditor_email": auditor_email,
        "environment": ENVIRONMENT,
        "controls_included": ALL_CONTROLS,
        "retention_policy_days": HIPAA_RETENTION_DAYS,
        "record_counts": {
            "phi_access_logs": len(phi_access_logs),
            "encryption_snapshots": len(encryption_snapshots),
            "baa_agreements": len(baa_agreements),
        },
        "phi_access_logs": phi_access_logs,
        "encryption_snapshots": encryption_snapshots,
        "baa_agreements": baa_agreements,
        "control_statuses": controls,
    }

    package_hash = sha256_hex(package)
    kms_sig = kms_sign(package_hash)

    s3_key = vault_to_s3(str(customer_id), "audit_export", export_ref, package)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO hipaa_audit_exports
              (id, customer_id, export_reference, auditor_name, auditor_email,
               period_start, period_end, controls_included,
               record_count, s3_package_key, package_hash, kms_signature, generated_at)
            VALUES
              (gen_random_uuid(), %s, %s, %s, %s,
               %s::DATE, %s::DATE, %s,
               %s, %s, %s, %s, NOW())
            """,
            (
                str(customer_id),
                export_ref,
                auditor_name,
                auditor_email,
                period_start,
                period_end,
                ALL_CONTROLS,
                len(phi_access_logs) + len(baa_agreements),
                s3_key,
                package_hash,
                kms_sig,
            ),
        )

    logger.info("HIPAA audit export complete: ref=%s s3=%s", export_ref, s3_key)
    return {
        "export_reference": export_ref,
        "s3_key": s3_key,
        "package_hash": package_hash,
        "record_counts": package["record_counts"],
    }


# ══════════════════════════════════════════════════════════════════════════════
# LAMBDA HANDLER
# ══════════════════════════════════════════════════════════════════════════════

CONTROL_COLLECTOR_MAP = {
    "HIPAA-AS.1": collect_hipaa_as1,
    "HIPAA-AS.2": collect_hipaa_as2,
    "HIPAA-TS.1": collect_hipaa_ts1,
    "HIPAA-TS.2": collect_hipaa_ts2,
    "HIPAA-TS.3": collect_hipaa_ts3,
    "HIPAA-AU.1": collect_hipaa_au1,
    "HIPAA-AU.2": collect_hipaa_au2,
    "HIPAA-TX.1": collect_hipaa_tx1,
    "HIPAA-TX.2": collect_hipaa_tx2,
    "HIPAA-BAA.1": collect_hipaa_baa1,
}


def _http_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "isBase64Encoded": False,
        "body": json.dumps(body, default=str),
    }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda entry point.

    Routes:
      POST /hipaa/collect        — on-demand collection for one customer
      POST /hipaa/audit-export   — generate signed HIPAA audit package
      aws.events (scheduled)     — collect all active healthcare customers
    """
    request_id = getattr(context, "aws_request_id", str(uuid.uuid4()))
    logger.info("Event: %s", json.dumps(event, default=str))

    source = event.get("source", "")
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")

    conn = None
    try:
        conn = get_db_connection()

        # ── Scheduled run: collect all eligible customers ──────────────────
        if source == "aws.events":
            customer_ids = _get_healthcare_customers(conn)
            logger.info("Scheduled run: %d healthcare customers", len(customer_ids))
            results = []
            for cid in customer_ids:
                set_rls_context(conn, cid)
                customer_results = []
                for ctrl in ALL_CONTROLS:
                    collector = CONTROL_COLLECTOR_MAP.get(ctrl)
                    if collector:
                        try:
                            result = collector(conn, cid, request_id)
                            customer_results.append(result)
                        except Exception as exc:
                            logger.error("Control %s failed for %s: %s", ctrl, cid, exc)
                conn.commit()
                results.append({"customer_id": cid, "controls": customer_results})
            return {"statusCode": 200, "customers_processed": len(customer_ids)}

        # ── HTTP: on-demand collection ─────────────────────────────────────
        if http_method not in ("POST", "GET"):
            return _http_response(405, {"error": "Method not allowed"})

        body: Dict[str, Any] = {}
        if event.get("body"):
            try:
                body = json.loads(event["body"])
            except json.JSONDecodeError:
                return _http_response(400, {"error": "Invalid JSON body"})

        customer_id = body.get("customer_id")
        if not customer_id:
            return _http_response(400, {"error": "customer_id is required"})

        set_rls_context(conn, customer_id)

        # ── POST /hipaa/audit-export ───────────────────────────────────────
        if path.endswith("/audit-export"):
            required = ("period_start", "period_end")
            for field in required:
                if not body.get(field):
                    return _http_response(400, {"error": f"{field} is required"})
            result = generate_audit_export(
                conn,
                customer_id,
                body["period_start"],
                body["period_end"],
                body.get("auditor_name", ""),
                body.get("auditor_email", ""),
                request_id,
            )
            conn.commit()
            return _http_response(200, result)

        # ── POST /hipaa/collect ────────────────────────────────────────────
        controls_requested = body.get("controls", ALL_CONTROLS)
        # Deduplicate while preserving order
        seen: set = set()
        controls_to_run: List[str] = []
        for c in controls_requested:
            if c in CONTROL_COLLECTOR_MAP and c not in seen:
                seen.add(c)
                controls_to_run.append(c)

        if not controls_to_run:
            return _http_response(400, {"error": "No valid controls specified"})

        results = []
        for ctrl in controls_to_run:
            collector = CONTROL_COLLECTOR_MAP[ctrl]
            try:
                result = collector(conn, customer_id, request_id)
                results.append(result)
            except Exception as exc:
                logger.error("Control %s failed: %s", ctrl, exc)
                results.append({"control_id": ctrl, "error": str(exc)})

        conn.commit()
        return _http_response(200, {
            "customer_id": customer_id,
            "controls_collected": len(results),
            "results": results,
        })

    except Exception as exc:
        logger.error("Lambda handler error: %s", exc, exc_info=True)
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return _http_response(500, {"error": "Internal server error", "message": str(exc)})
