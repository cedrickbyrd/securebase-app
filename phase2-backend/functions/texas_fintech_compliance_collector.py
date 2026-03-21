"""
Texas Money Transmitter Compliance Evidence Collector
=====================================================
Lambda function that collects and vaults tamper-evident compliance evidence
required by Texas Department of Banking (DOB) examiners for licensed money
transmitters and digital asset service providers.

Controls implemented
--------------------
  TX-MT-R1    Transaction Recordkeeping       7 TAC §33.35; Fin. Code §151.307
  TX-MT-R2a   Currency Transaction Reports    31 CFR §1022.310
  TX-MT-R2b   Suspicious Activity Reports     31 CFR §1022.320
  TX-MT-R3    Customer Identification Program 31 CFR §1022.210; 7 TAC §33.3
  TX-MT-R4    Digital Asset Segregation       TX HB 1666; Fin. Code §152
  TX-DASP-R1  DASP License Compliance         TX Fin. Code §152.101

Evidence pipeline
-----------------
  Customer DB → Lambda → SHA-256 → KMS Sign → S3 Vault (Object Lock)
                                 ↓
                          Aurora (tx_* tables, tx_evidence_signatures)

Invocation modes
----------------
  Scheduled (EventBridge cron):  collects all active fintech_pro customers
  API Gateway (on-demand):       collects a single customer or generates
                                 an examiner export package

Environment variables
---------------------
  RDS_HOST            Aurora Proxy endpoint
  RDS_DATABASE        securebase
  RDS_USER            securebase_app
  RDS_SECRET_ARN      Secrets Manager ARN for DB password
  KMS_KEY_ID          KMS key for evidence signing
  S3_EVIDENCE_BUCKET  S3 bucket (Object Lock / Compliance mode)
  ENVIRONMENT         dev | staging | prod
  LOG_LEVEL           DEBUG | INFO | WARNING | ERROR

Event format (API Gateway on-demand)
-------------------------------------
  {
    "httpMethod": "POST",
    "path": "/fintech/collect",
    "body": "{\"customer_id\": \"uuid\", \"controls\": [\"TX-MT-R1\"]}"
  }
  OR
  {
    "httpMethod": "POST",
    "path": "/fintech/examiner-export",
    "body": "{\"customer_id\": \"uuid\", \"period_start\": \"2025-01-01\",
              \"period_end\": \"2025-03-31\", \"examiner_name\": \"John Smith\",
              \"examiner_email\": \"jsmith@dob.texas.gov\"}"
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
from typing import Any, Dict, List, Optional, Tuple

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
    "TX-MT-R1": {
        "name": "Transaction Recordkeeping",
        "regulation_ref": "7 TAC §33.35; Fin. Code §151.307",
    },
    "TX-MT-R2a": {
        "name": "Currency Transaction Report (CTR)",
        "regulation_ref": "31 CFR §1022.310",
    },
    "TX-MT-R2b": {
        "name": "Suspicious Activity Report (SAR)",
        "regulation_ref": "31 CFR §1022.320",
    },
    "TX-MT-R3": {
        "name": "Customer Identification Program (CIP)",
        "regulation_ref": "31 CFR §1022.210; 7 TAC §33.3",
    },
    "TX-MT-R4": {
        "name": "Digital Asset Segregation",
        "regulation_ref": "TX HB 1666; Fin. Code §152",
    },
    "TX-DASP-R1": {
        "name": "Digital Asset Service Provider License",
        "regulation_ref": "TX Fin. Code §152.101",
    },
}

ALL_CONTROLS = list(CONTROL_CATALOGUE.keys())

# Tiers that have access to Texas compliance features
FINTECH_TIERS = {"fintech_pro", "fintech_elite"}

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
    """Upload evidence JSON to S3 and return the object key."""
    date_prefix = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    key = (
        f"evidence/{ENVIRONMENT}/{customer_id}/{evidence_type}/"
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
    logger.debug("Vaulted evidence: s3://%s/%s", S3_EVIDENCE_BUCKET, key)
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
    """Insert a KMS-signature record into tx_evidence_signatures."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tx_evidence_signatures
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


def collect_tx_mt_r1(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    TX-MT-R1 — Transaction Recordkeeping (7 TAC §33.35)
    Queries the customer's transaction records stored in tx_transaction_records.
    Returns evidence summary and updates control status.
    """
    logger.info("[TX-MT-R1] Collecting transaction records for %s", customer_id)

    with conn.cursor() as cur:
        # Count records by age bucket
        cur.execute(
            """
            SELECT
              COUNT(*) FILTER (WHERE transaction_date >= NOW() - INTERVAL '30 days')  AS last_30d,
              COUNT(*) FILTER (WHERE transaction_date >= NOW() - INTERVAL '365 days') AS last_year,
              COUNT(*)                                                                  AS total,
              MIN(transaction_date)                                                     AS oldest,
              MAX(transaction_date)                                                     AS newest,
              COUNT(*) FILTER (WHERE sender_name IS NULL OR sender_account IS NULL)    AS missing_sender_fields,
              COUNT(*) FILTER (WHERE amount >= 10000 AND transaction_type IN
                               ('cash','money_order'))                                  AS ctr_eligible
            FROM tx_transaction_records
            WHERE customer_id = %s
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "TX-MT-R1",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "7 TAC §33.35; Fin. Code §151.307",
        "metrics": dict(row) if row else {},
    }

    # Determine compliance status
    total = (evidence["metrics"].get("total") or 0)
    missing = (evidence["metrics"].get("missing_sender_fields") or 0)
    if total == 0:
        status = "pending_review"
        findings = {"issue": "No transaction records found — database connector may not be configured."}
    elif missing / max(total, 1) > 0.05:
        status = "non_compliant"
        findings = {
            "issue": f"{missing} of {total} records missing required sender fields.",
            "threshold": "5% tolerance",
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(conn, customer_id, "TX-MT-R1", status, findings, total, request_id)

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "TX-MT-R1", evidence_id, evidence)
    record_signature(conn, customer_id, "TX-MT-R1", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[TX-MT-R1] Complete — status=%s records=%d", status, total)
    return evidence


def collect_tx_mt_r2a(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    TX-MT-R2a — Currency Transaction Reports (31 CFR §1022.310)
    Checks that all cash transactions ≥$10,000 have a corresponding CTR.
    """
    logger.info("[TX-MT-R2a] Collecting CTR evidence for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*) AS eligible_transactions,
              COUNT(*) FILTER (WHERE ctr_status = 'filed')    AS filed,
              COUNT(*) FILTER (WHERE ctr_status = 'pending')  AS pending,
              COUNT(*) FILTER (WHERE ctr_status = 'MISSING')  AS missing,
              COUNT(*) FILTER (WHERE ctr_status = 'exempt')   AS exempt
            FROM check_ctr_filing_compliance(%s)
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

        # Pull structuring alerts
        cur.execute(
            "SELECT * FROM detect_structuring(%s, 24, 10000)",
            (str(customer_id),),
        )
        structuring = [dict(r) for r in cur.fetchall()]

    evidence = {
        "control_id": "TX-MT-R2a",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "31 CFR §1022.310",
        "ctr_summary": dict(row) if row else {},
        "structuring_alerts": structuring,
    }

    missing = (evidence["ctr_summary"].get("missing") or 0)
    if missing > 0:
        status = "non_compliant"
        findings = {"missing_ctrs": missing, "action_required": "File CTRs for missing transactions."}
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(
        conn, customer_id, "TX-MT-R2a", status, findings,
        evidence["ctr_summary"].get("eligible_transactions") or 0,
        request_id,
    )

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "TX-MT-R2a", evidence_id, evidence)
    record_signature(conn, customer_id, "TX-MT-R2a", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[TX-MT-R2a] Complete — status=%s missing_ctrs=%d", status, missing)
    return evidence


def collect_tx_mt_r2b(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    TX-MT-R2b — Suspicious Activity Reports (31 CFR §1022.320)
    Validates AML alert disposition and SAR filing completeness.
    """
    logger.info("[TX-MT-R2b] Collecting SAR evidence for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*) AS total_alerts,
              COUNT(*) FILTER (WHERE status = 'open')            AS open_alerts,
              COUNT(*) FILTER (WHERE status = 'escalated')       AS escalated,
              COUNT(*) FILTER (WHERE sar_filed = TRUE)           AS sar_filed,
              AVG(EXTRACT(EPOCH FROM
                (COALESCE(dispositioned_at, NOW()) - alert_date)) / 86400
              )::NUMERIC(6,1)                                     AS avg_days_to_disposition
            FROM tx_aml_alerts
            WHERE customer_id = %s
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

        cur.execute(
            """
            SELECT filing_status, COUNT(*) AS count
            FROM tx_sar_filings
            WHERE customer_id = %s
            GROUP BY filing_status
            """,
            (str(customer_id),),
        )
        sar_status = {r["filing_status"]: r["count"] for r in cur.fetchall()}

    evidence = {
        "control_id": "TX-MT-R2b",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "31 CFR §1022.320",
        "aml_alert_summary": dict(row) if row else {},
        "sar_by_status": sar_status,
    }

    open_alerts = evidence["aml_alert_summary"].get("open_alerts") or 0
    pending_sars = sar_status.get("pending", 0)
    if open_alerts > 10 or pending_sars > 0:
        status = "non_compliant" if pending_sars > 0 else "partial"
        findings = {
            "open_alerts": open_alerts,
            "pending_sars": pending_sars,
        }
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(
        conn, customer_id, "TX-MT-R2b", status, findings,
        evidence["aml_alert_summary"].get("total_alerts") or 0,
        request_id,
    )

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "TX-MT-R2b", evidence_id, evidence)
    record_signature(conn, customer_id, "TX-MT-R2b", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[TX-MT-R2b] Complete — status=%s open_alerts=%d", status, open_alerts)
    return evidence


def collect_tx_mt_r3(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    TX-MT-R3 — Customer Identification Program (31 CFR §1022.210)
    Validates CIP record completeness and enhanced due diligence coverage.
    """
    logger.info("[TX-MT-R3] Collecting CIP evidence for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*) AS total_customers,
              COUNT(*) FILTER (WHERE identity_verified_at IS NULL)         AS unverified,
              COUNT(*) FILTER (WHERE risk_rating = 'high'
                AND enhanced_due_diligence = FALSE)                        AS high_risk_no_edd,
              COUNT(*) FILTER (WHERE risk_rating = 'pep')                  AS pep_count,
              COUNT(*) FILTER (WHERE last_reviewed_at < NOW() - INTERVAL '365 days'
                OR last_reviewed_at IS NULL)                               AS overdue_review,
              ROUND(AVG(CASE WHEN identity_verified_at IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100, 1)
                                                                            AS verification_rate_pct
            FROM tx_cip_records
            WHERE customer_id = %s
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "TX-MT-R3",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "31 CFR §1022.210; 7 TAC §33.3",
        "cip_summary": dict(row) if row else {},
    }

    unverified = evidence["cip_summary"].get("unverified") or 0
    high_risk_no_edd = evidence["cip_summary"].get("high_risk_no_edd") or 0
    if unverified > 0 or high_risk_no_edd > 0:
        status = "non_compliant"
        findings = {"unverified": unverified, "high_risk_missing_edd": high_risk_no_edd}
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    _update_control_status(
        conn, customer_id, "TX-MT-R3", status, findings,
        evidence["cip_summary"].get("total_customers") or 0,
        request_id,
    )

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "TX-MT-R3", evidence_id, evidence)
    record_signature(conn, customer_id, "TX-MT-R3", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[TX-MT-R3] Complete — status=%s", status)
    return evidence


def collect_tx_mt_r4_dasp_r1(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    TX-MT-R4 / TX-DASP-R1 — Digital Asset Segregation (HB 1666; Fin. Code §152)
    Validates that customer digital assets are held in segregated wallets.
    """
    logger.info("[TX-MT-R4/TX-DASP-R1] Collecting digital asset evidence for %s", customer_id)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*) AS total_wallets,
              COUNT(*) FILTER (WHERE is_customer_funds = TRUE)              AS customer_wallets,
              COUNT(*) FILTER (WHERE is_customer_funds = TRUE
                AND is_segregated = FALSE)                                   AS non_segregated,
              COUNT(*) FILTER (WHERE is_customer_funds = TRUE
                AND cold_storage = TRUE)                                     AS cold_storage,
              COUNT(*) FILTER (WHERE is_customer_funds = TRUE
                AND multi_sig_required = TRUE)                               AS multi_sig,
              COUNT(DISTINCT asset_type)                                     AS asset_types,
              SUM(CASE WHEN is_customer_funds AND balance_snapshot IS NOT NULL
                       THEN balance_snapshot ELSE 0 END)                     AS total_balance_approx
            FROM tx_digital_asset_wallets
            WHERE customer_id = %s
            """,
            (str(customer_id),),
        )
        row = cur.fetchone()

    evidence = {
        "control_id": "TX-MT-R4/TX-DASP-R1",
        "customer_id": str(customer_id),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "regulation_ref": "TX HB 1666; Fin. Code §152; Fin. Code §152.101",
        "digital_asset_summary": dict(row) if row else {},
    }

    non_segregated = evidence["digital_asset_summary"].get("non_segregated") or 0
    customer_wallets = evidence["digital_asset_summary"].get("customer_wallets") or 0
    if non_segregated > 0:
        status = "non_compliant"
        findings = {
            "non_segregated_wallets": non_segregated,
            "action_required": "Segregate customer funds into dedicated wallets per HB 1666.",
        }
    elif customer_wallets == 0:
        status = "not_applicable"
        findings = {}
    else:
        status = "compliant"
        findings = {}

    evidence["status"] = status
    evidence["findings"] = findings

    # Update both controls
    for control_id in ("TX-MT-R4", "TX-DASP-R1"):
        _update_control_status(
            conn, customer_id, control_id, status, findings, customer_wallets, request_id
        )

    content_hash = sha256_hex(evidence)
    evidence_id = str(uuid.uuid4())
    kms_sig = kms_sign(content_hash)
    s3_key = vault_to_s3(str(customer_id), "TX-MT-R4", evidence_id, evidence)
    record_signature(conn, customer_id, "TX-MT-R4", evidence_id, content_hash, kms_sig, request_id)

    evidence["s3_key"] = s3_key
    evidence["content_hash"] = content_hash
    logger.info("[TX-MT-R4/TX-DASP-R1] Complete — status=%s non_segregated=%d", status, non_segregated)
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
    """Upsert a row in tx_compliance_controls."""
    ctrl = CONTROL_CATALOGUE.get(control_id, {})
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tx_compliance_controls
              (id, customer_id, control_id, control_name, regulation_ref,
               status, last_assessed_at, evidence_count, findings,
               assessed_by_lambda, created_at, updated_at)
            VALUES
              (gen_random_uuid(), %s, %s, %s, %s,
               %s::tx_control_status, NOW(), %s, %s,
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


def _get_fintech_customers(conn: psycopg2.extensions.connection) -> List[str]:
    """Return customer IDs for tiers that include Texas compliance."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::TEXT FROM customers
            WHERE tier IN %s AND status = 'active'
            """,
            (tuple(FINTECH_TIERS),),
        )
        return [row["id"] for row in cur.fetchall()]


# ══════════════════════════════════════════════════════════════════════════════
# EXAMINER EXPORT
# ══════════════════════════════════════════════════════════════════════════════


def generate_examiner_export(
    conn: psycopg2.extensions.connection,
    customer_id: str,
    period_start: str,
    period_end: str,
    examiner_name: str,
    examiner_email: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    Build a signed examiner evidence package covering all controls
    for the requested date range and upload it to S3.
    """
    logger.info(
        "Generating examiner export for customer=%s period=%s to %s",
        customer_id, period_start, period_end,
    )

    export_ref = f"TX-EXAM-{ENVIRONMENT.upper()}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"

    with conn.cursor() as cur:
        # Transaction records
        cur.execute(
            """
            SELECT id, transaction_date, transaction_type, amount, currency,
                   sender_name, sender_account, recipient_name, recipient_account,
                   recipient_country, channel, status
            FROM tx_transaction_records
            WHERE customer_id = %s
              AND transaction_date BETWEEN %s::DATE AND %s::DATE + INTERVAL '1 day'
            ORDER BY transaction_date
            """,
            (str(customer_id), period_start, period_end),
        )
        transactions = [dict(r) for r in cur.fetchall()]

        # CTR filings
        cur.execute(
            """
            SELECT id, filing_reference, transaction_date, amount, subject_name,
                   filing_status, filing_date, fincen_tracking_id
            FROM tx_ctr_filings
            WHERE customer_id = %s
              AND transaction_date BETWEEN %s::DATE AND %s::DATE + INTERVAL '1 day'
            ORDER BY transaction_date
            """,
            (str(customer_id), period_start, period_end),
        )
        ctrs = [dict(r) for r in cur.fetchall()]

        # SAR filings
        cur.execute(
            """
            SELECT id, filing_reference, activity_date_start, activity_date_end,
                   amount, activity_type, filing_status, filing_date, fincen_tracking_id
            FROM tx_sar_filings
            WHERE customer_id = %s
              AND activity_date_start BETWEEN %s::DATE AND %s::DATE + INTERVAL '1 day'
            ORDER BY activity_date_start
            """,
            (str(customer_id), period_start, period_end),
        )
        sars = [dict(r) for r in cur.fetchall()]

        # Control statuses
        cur.execute(
            "SELECT * FROM tx_compliance_controls WHERE customer_id = %s",
            (str(customer_id),),
        )
        controls = [dict(r) for r in cur.fetchall()]

    package = {
        "export_reference": export_ref,
        "customer_id": str(customer_id),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period_start": period_start,
        "period_end": period_end,
        "examiner_name": examiner_name,
        "examiner_email": examiner_email,
        "environment": ENVIRONMENT,
        "controls_included": ALL_CONTROLS,
        "record_counts": {
            "transactions": len(transactions),
            "ctr_filings": len(ctrs),
            "sar_filings": len(sars),
        },
        "transactions": transactions,
        "ctr_filings": ctrs,
        "sar_filings": sars,
        "control_statuses": controls,
    }

    package_hash = sha256_hex(package)
    kms_sig = kms_sign(package_hash)

    s3_key = vault_to_s3(str(customer_id), "examiner_export", export_ref, package)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tx_examiner_exports
              (id, customer_id, export_reference, examiner_name, examiner_email,
               exam_type, period_start, period_end, controls_included,
               record_count, s3_package_key, package_hash, kms_signature, generated_at)
            VALUES
              (gen_random_uuid(), %s, %s, %s, %s,
               'routine', %s::DATE, %s::DATE, %s,
               %s, %s, %s, %s, NOW())
            """,
            (
                str(customer_id),
                export_ref,
                examiner_name,
                examiner_email,
                period_start,
                period_end,
                ALL_CONTROLS,
                len(transactions) + len(ctrs) + len(sars),
                s3_key,
                package_hash,
                kms_sig,
            ),
        )

    logger.info("Examiner export complete: ref=%s s3=%s", export_ref, s3_key)
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
    "TX-MT-R1":   collect_tx_mt_r1,
    "TX-MT-R2a":  collect_tx_mt_r2a,
    "TX-MT-R2b":  collect_tx_mt_r2b,
    "TX-MT-R3":   collect_tx_mt_r3,
    "TX-MT-R4":   collect_tx_mt_r4_dasp_r1,
    "TX-DASP-R1": collect_tx_mt_r4_dasp_r1,  # same collector handles both
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
      POST /fintech/collect          — on-demand collection for one customer
      POST /fintech/examiner-export  — generate signed examiner package
      aws.events (scheduled)         — collect all fintech_pro/elite customers
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
            customer_ids = _get_fintech_customers(conn)
            logger.info("Scheduled run: %d fintech customers", len(customer_ids))
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

        # ── POST /fintech/examiner-export ──────────────────────────────────
        if path.endswith("/examiner-export"):
            required = ("period_start", "period_end")
            for field in required:
                if not body.get(field):
                    return _http_response(400, {"error": f"{field} is required"})
            result = generate_examiner_export(
                conn,
                customer_id,
                body["period_start"],
                body["period_end"],
                body.get("examiner_name", ""),
                body.get("examiner_email", ""),
                request_id,
            )
            conn.commit()
            return _http_response(200, result)

        # ── POST /fintech/collect ──────────────────────────────────────────
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
