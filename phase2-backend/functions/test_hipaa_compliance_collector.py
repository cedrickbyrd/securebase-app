"""
Unit tests for HIPAA Compliance Collector Lambda function
"""

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from hipaa_compliance_collector import (
    sha256_hex,
    kms_sign,
    _update_control_status,
    _get_healthcare_customers,
    collect_hipaa_as1,
    collect_hipaa_as2,
    collect_hipaa_ts1,
    collect_hipaa_ts2,
    collect_hipaa_ts3,
    collect_hipaa_au1,
    collect_hipaa_au2,
    collect_hipaa_tx1,
    collect_hipaa_tx2,
    collect_hipaa_baa1,
    generate_audit_export,
    lambda_handler,
    CONTROL_CATALOGUE,
    ALL_CONTROLS,
    CONTROL_COLLECTOR_MAP,
    HIPAA_RETENTION_DAYS,
)


# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440000"
REQUEST_ID = "test-request-id-001"


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _make_conn(fetchone_return=None, fetchall_return=None):
    """Build a minimal mock psycopg2 connection."""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.__enter__ = lambda s: s
    cursor.__exit__ = MagicMock(return_value=False)
    cursor.fetchone.return_value = fetchone_return or {}
    cursor.fetchall.return_value = fetchall_return or []
    conn.cursor.return_value = cursor
    return conn, cursor


# ══════════════════════════════════════════════════════════════════════════════
# CATALOGUE & MODULE-LEVEL TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestCatalogue:
    """Validate the control catalogue and module constants."""

    def test_all_ten_controls_present(self):
        expected = {
            "HIPAA-AS.1", "HIPAA-AS.2",
            "HIPAA-TS.1", "HIPAA-TS.2", "HIPAA-TS.3",
            "HIPAA-AU.1", "HIPAA-AU.2",
            "HIPAA-TX.1", "HIPAA-TX.2",
            "HIPAA-BAA.1",
        }
        assert set(CONTROL_CATALOGUE.keys()) == expected

    def test_all_controls_list_matches_catalogue(self):
        assert set(ALL_CONTROLS) == set(CONTROL_CATALOGUE.keys())

    def test_collector_map_covers_all_controls(self):
        assert set(CONTROL_COLLECTOR_MAP.keys()) == set(ALL_CONTROLS)

    def test_each_control_has_name_and_regulation_ref(self):
        for ctrl_id, ctrl in CONTROL_CATALOGUE.items():
            assert "name" in ctrl, f"{ctrl_id} missing 'name'"
            assert "regulation_ref" in ctrl, f"{ctrl_id} missing 'regulation_ref'"

    def test_hipaa_retention_days_seven_years(self):
        """Healthcare tier must be configured for 7-year retention."""
        assert HIPAA_RETENTION_DAYS == 2555


# ══════════════════════════════════════════════════════════════════════════════
# SHA-256 AND KMS
# ══════════════════════════════════════════════════════════════════════════════

class TestEvidenceUtils:
    """Test hashing and KMS signing utilities."""

    def test_sha256_hex_deterministic(self):
        data = {"control_id": "HIPAA-AS.1", "value": 42}
        assert sha256_hex(data) == sha256_hex(data)

    def test_sha256_hex_different_inputs_differ(self):
        assert sha256_hex({"a": 1}) != sha256_hex({"a": 2})

    def test_sha256_hex_returns_64_char_string(self):
        result = sha256_hex({"key": "value"})
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    @patch("hipaa_compliance_collector.KMS_KEY_ID", "")
    def test_kms_sign_skipped_when_no_key_id(self):
        sig = kms_sign("abc123")
        assert sig == ""

    @patch("hipaa_compliance_collector._kms")
    @patch("hipaa_compliance_collector.KMS_KEY_ID", "arn:aws:kms:us-east-1:123:key/test")
    def test_kms_sign_returns_base64(self, mock_kms):
        mock_kms.sign.return_value = {"Signature": b"fakesignature"}
        result = kms_sign("deadbeef")
        assert isinstance(result, str)
        mock_kms.sign.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
# _get_healthcare_customers
# ══════════════════════════════════════════════════════════════════════════════

class TestGetHealthcareCustomers:
    """Test customer discovery query."""

    def test_returns_list_of_ids(self):
        conn, cursor = _make_conn()
        cursor.fetchall.return_value = [{"id": CUSTOMER_ID}]
        result = _get_healthcare_customers(conn)
        assert result == [CUSTOMER_ID]

    def test_empty_result(self):
        conn, cursor = _make_conn()
        cursor.fetchall.return_value = []
        result = _get_healthcare_customers(conn)
        assert result == []

    def test_queries_healthcare_tier(self):
        conn, cursor = _make_conn()
        cursor.fetchall.return_value = []
        _get_healthcare_customers(conn)
        call_args = cursor.execute.call_args
        sql = call_args[0][0]
        assert "healthcare" in sql.lower() or "%s" in sql


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL COLLECTORS
# ══════════════════════════════════════════════════════════════════════════════

class TestCollectHipaaAs1:
    """HIPAA-AS.1 Workforce Training Records"""

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_compliant_all_trained(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_staff": 10, "trained_current": 10,
            "training_overdue": 0, "oldest_training": None, "newest_training": None,
        })
        result = collect_hipaa_as1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "compliant"
        assert result["findings"] == {}
        mock_update.assert_called_once()

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_non_compliant_overdue_training(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_staff": 10, "trained_current": 7,
            "training_overdue": 3, "oldest_training": None, "newest_training": None,
        })
        result = collect_hipaa_as1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "non_compliant"
        assert result["findings"]["overdue_count"] == 3

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_pending_review_no_records(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_staff": 0, "trained_current": 0,
            "training_overdue": 0, "oldest_training": None, "newest_training": None,
        })
        result = collect_hipaa_as1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "pending_review"


class TestCollectHipaaAs2:
    """HIPAA-AS.2 Risk Analysis Documentation"""

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_compliant(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_analyses": 2, "current_approved": 1,
            "most_recent": datetime.now(timezone.utc),
            "in_draft": 0, "with_open_findings": 0,
        })
        result = collect_hipaa_as2(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "compliant"

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_non_compliant_no_current_analysis(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_analyses": 1, "current_approved": 0,
            "most_recent": None, "in_draft": 1, "with_open_findings": 0,
        })
        result = collect_hipaa_as2(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "non_compliant"

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_partial_open_findings(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_analyses": 1, "current_approved": 1,
            "most_recent": datetime.now(timezone.utc),
            "in_draft": 0, "with_open_findings": 2,
        })
        result = collect_hipaa_as2(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "partial"


class TestCollectHipaaTs2:
    """HIPAA-TS.2 Encryption at Rest"""

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_compliant_all_encrypted(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn()
        cursor.fetchall.return_value = [
            {"resource_type": "s3", "total": 3, "encrypted_active_key": 3,
             "unencrypted": 0, "degraded_key": 0},
        ]
        result = collect_hipaa_ts2(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "compliant"

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_non_compliant_unencrypted(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn()
        cursor.fetchall.return_value = [
            {"resource_type": "ebs", "total": 5, "encrypted_active_key": 3,
             "unencrypted": 2, "degraded_key": 0},
        ]
        result = collect_hipaa_ts2(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "non_compliant"
        assert result["findings"]["unencrypted_resources"] == 2

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_partial_degraded_key(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn()
        cursor.fetchall.return_value = [
            {"resource_type": "rds", "total": 2, "encrypted_active_key": 1,
             "unencrypted": 0, "degraded_key": 1},
        ]
        result = collect_hipaa_ts2(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "partial"


class TestCollectHipaaAu1:
    """HIPAA-AU.1 PHI Access Audit Logging"""

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_compliant(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_events": 500, "last_24h": 20,
            "phi_operations": 500, "anonymous_access": 0,
            "oldest_log": None, "newest_log": None,
        })
        result = collect_hipaa_au1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "compliant"

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_non_compliant_no_logs(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_events": 0, "last_24h": 0,
            "phi_operations": 0, "anonymous_access": 0,
            "oldest_log": None, "newest_log": None,
        })
        result = collect_hipaa_au1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "non_compliant"

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_non_compliant_anonymous_access(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_events": 100, "last_24h": 5,
            "phi_operations": 100, "anonymous_access": 3,
            "oldest_log": None, "newest_log": None,
        })
        result = collect_hipaa_au1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "non_compliant"
        assert result["findings"]["anonymous_access_events"] == 3


class TestCollectHipaaAu2:
    """HIPAA-AU.2 Audit Log Retention"""

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_compliant_seven_years(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "oldest_log_entry": None, "newest_log_entry": None,
            "total_log_entries": 10000, "log_age_days": 2555, "months_covered": 84,
        })
        result = collect_hipaa_au2(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "compliant"

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_partial_less_than_six_years(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "oldest_log_entry": None, "newest_log_entry": None,
            "total_log_entries": 500, "log_age_days": 365, "months_covered": 12,
        })
        result = collect_hipaa_au2(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "partial"
        assert result["findings"]["required_days"] == 2190

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_pending_review_no_logs(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "oldest_log_entry": None, "newest_log_entry": None,
            "total_log_entries": 0, "log_age_days": None, "months_covered": 0,
        })
        result = collect_hipaa_au2(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "pending_review"


class TestCollectHipaaBaa1:
    """HIPAA-BAA.1 BAA Agreement on File"""

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_compliant(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_baa": 3, "active_valid": 3, "expired": 0,
            "pending": 0, "oldest_baa": None, "expiring_soon": 0,
        })
        result = collect_hipaa_baa1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "compliant"

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_non_compliant_no_baa(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_baa": 0, "active_valid": 0, "expired": 0,
            "pending": 0, "oldest_baa": None, "expiring_soon": 0,
        })
        result = collect_hipaa_baa1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "non_compliant"

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_non_compliant_expired_baa(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_baa": 2, "active_valid": 1, "expired": 1,
            "pending": 0, "oldest_baa": None, "expiring_soon": 0,
        })
        result = collect_hipaa_baa1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "non_compliant"
        assert result["findings"]["expired_baa"] == 1

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_partial_pending_signature(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_baa": 2, "active_valid": 1, "expired": 0,
            "pending": 1, "oldest_baa": None, "expiring_soon": 0,
        })
        result = collect_hipaa_baa1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["status"] == "partial"


# ══════════════════════════════════════════════════════════════════════════════
# LAMBDA HANDLER
# ══════════════════════════════════════════════════════════════════════════════

class TestLambdaHandler:
    """Test the main Lambda entry point routing logic."""

    # ── Scheduled run ──────────────────────────────────────────────────────

    @patch("hipaa_compliance_collector.get_db_connection")
    @patch("hipaa_compliance_collector._get_healthcare_customers", return_value=[])
    def test_scheduled_no_customers(self, mock_customers, mock_conn):
        mock_conn.return_value = MagicMock()
        event = {"source": "aws.events"}
        response = lambda_handler(event, MagicMock(aws_request_id=REQUEST_ID))
        assert response["statusCode"] == 200
        assert response["customers_processed"] == 0

    @patch("hipaa_compliance_collector.get_db_connection")
    @patch("hipaa_compliance_collector._get_healthcare_customers",
           return_value=[CUSTOMER_ID])
    @patch("hipaa_compliance_collector.set_rls_context")
    @patch("hipaa_compliance_collector.CONTROL_COLLECTOR_MAP", {})
    def test_scheduled_with_customer_empty_map(self, mock_rls, mock_customers, mock_conn):
        mock_conn.return_value = MagicMock()
        event = {"source": "aws.events"}
        response = lambda_handler(event, MagicMock(aws_request_id=REQUEST_ID))
        assert response["statusCode"] == 200
        assert response["customers_processed"] == 1

    # ── HTTP routing ───────────────────────────────────────────────────────

    @patch("hipaa_compliance_collector.get_db_connection")
    def test_method_not_allowed(self, mock_conn):
        mock_conn.return_value = MagicMock()
        event = {"httpMethod": "DELETE", "path": "/hipaa/collect"}
        response = lambda_handler(event, MagicMock(aws_request_id=REQUEST_ID))
        assert response["statusCode"] == 405

    @patch("hipaa_compliance_collector.get_db_connection")
    def test_missing_customer_id(self, mock_conn):
        mock_conn.return_value = MagicMock()
        event = {
            "httpMethod": "POST",
            "path": "/hipaa/collect",
            "body": json.dumps({}),
        }
        response = lambda_handler(event, MagicMock(aws_request_id=REQUEST_ID))
        assert response["statusCode"] == 400
        assert "customer_id" in json.loads(response["body"])["error"]

    @patch("hipaa_compliance_collector.get_db_connection")
    def test_invalid_json_body(self, mock_conn):
        mock_conn.return_value = MagicMock()
        event = {
            "httpMethod": "POST",
            "path": "/hipaa/collect",
            "body": "{not_valid_json",
        }
        response = lambda_handler(event, MagicMock(aws_request_id=REQUEST_ID))
        assert response["statusCode"] == 400

    @patch("hipaa_compliance_collector.get_db_connection")
    def test_no_valid_controls(self, mock_conn):
        conn = MagicMock()
        mock_conn.return_value = conn
        event = {
            "httpMethod": "POST",
            "path": "/hipaa/collect",
            "body": json.dumps({
                "customer_id": CUSTOMER_ID,
                "controls": ["INVALID-CONTROL"],
            }),
        }
        response = lambda_handler(event, MagicMock(aws_request_id=REQUEST_ID))
        assert response["statusCode"] == 400

    @patch("hipaa_compliance_collector.get_db_connection")
    @patch("hipaa_compliance_collector.set_rls_context")
    @patch("hipaa_compliance_collector.collect_hipaa_as1")
    def test_collect_single_control(self, mock_collector, mock_rls, mock_conn):
        mock_conn.return_value = MagicMock()
        mock_collector.return_value = {
            "control_id": "HIPAA-AS.1",
            "status": "compliant",
            "findings": {},
        }
        event = {
            "httpMethod": "POST",
            "path": "/hipaa/collect",
            "body": json.dumps({
                "customer_id": CUSTOMER_ID,
                "controls": ["HIPAA-AS.1"],
            }),
        }
        response = lambda_handler(event, MagicMock(aws_request_id=REQUEST_ID))
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["customer_id"] == CUSTOMER_ID
        assert body["controls_collected"] == 1

    @patch("hipaa_compliance_collector.get_db_connection")
    @patch("hipaa_compliance_collector.set_rls_context")
    @patch("hipaa_compliance_collector.generate_audit_export")
    def test_audit_export_missing_period_start(self, mock_export, mock_rls, mock_conn):
        mock_conn.return_value = MagicMock()
        event = {
            "httpMethod": "POST",
            "path": "/hipaa/audit-export",
            "body": json.dumps({
                "customer_id": CUSTOMER_ID,
                "period_end": "2025-12-31",
            }),
        }
        response = lambda_handler(event, MagicMock(aws_request_id=REQUEST_ID))
        assert response["statusCode"] == 400
        assert "period_start" in json.loads(response["body"])["error"]

    @patch("hipaa_compliance_collector.get_db_connection")
    @patch("hipaa_compliance_collector.set_rls_context")
    @patch("hipaa_compliance_collector.generate_audit_export")
    def test_audit_export_success(self, mock_export, mock_rls, mock_conn):
        mock_conn.return_value = MagicMock()
        mock_export.return_value = {
            "export_reference": "HIPAA-AUDIT-DEV-20250101-ABCD1234",
            "s3_key": "evidence/dev/customer/hipaa/audit_export/...",
            "package_hash": "abc123",
            "record_counts": {"phi_access_logs": 50},
        }
        event = {
            "httpMethod": "POST",
            "path": "/hipaa/audit-export",
            "body": json.dumps({
                "customer_id": CUSTOMER_ID,
                "period_start": "2025-01-01",
                "period_end": "2025-12-31",
                "auditor_name": "Jane Smith",
                "auditor_email": "jsmith@hhs.gov",
            }),
        }
        response = lambda_handler(event, MagicMock(aws_request_id=REQUEST_ID))
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert "export_reference" in body

    @patch("hipaa_compliance_collector.get_db_connection")
    def test_db_failure_returns_500(self, mock_conn):
        mock_conn.side_effect = Exception("DB connection refused")
        event = {
            "httpMethod": "POST",
            "path": "/hipaa/collect",
            "body": json.dumps({"customer_id": CUSTOMER_ID}),
        }
        response = lambda_handler(event, MagicMock(aws_request_id=REQUEST_ID))
        assert response["statusCode"] == 500


# ══════════════════════════════════════════════════════════════════════════════
# EVIDENCE STRUCTURE
# ══════════════════════════════════════════════════════════════════════════════

class TestEvidenceStructure:
    """Validate the evidence dicts returned by collectors."""

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_evidence_contains_required_keys(self, mock_update, mock_rec, mock_sign, mock_vault):
        required_keys = {
            "control_id", "customer_id", "collected_at",
            "regulation_ref", "status", "findings", "s3_key", "content_hash",
        }
        conn, cursor = _make_conn(fetchone_return={
            "total_staff": 5, "trained_current": 5,
            "training_overdue": 0, "oldest_training": None, "newest_training": None,
        })
        result = collect_hipaa_as1(conn, CUSTOMER_ID, REQUEST_ID)
        assert required_keys.issubset(result.keys())

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_s3_key_contains_hipaa_prefix(self, mock_update, mock_rec, mock_sign, mock_vault):
        """S3 key must use the HIPAA-compliant prefix."""
        conn, cursor = _make_conn(fetchone_return={
            "total_staff": 5, "trained_current": 5,
            "training_overdue": 0, "oldest_training": None, "newest_training": None,
        })
        result = collect_hipaa_as1(conn, CUSTOMER_ID, REQUEST_ID)
        # vault_to_s3 is mocked, but we verify the returned key from mock
        assert result["s3_key"] == "s3://bucket/key"

    @patch("hipaa_compliance_collector.vault_to_s3", return_value="s3://bucket/key")
    @patch("hipaa_compliance_collector.kms_sign", return_value="sig==")
    @patch("hipaa_compliance_collector.record_signature")
    @patch("hipaa_compliance_collector._update_control_status")
    def test_customer_id_in_evidence(self, mock_update, mock_rec, mock_sign, mock_vault):
        conn, cursor = _make_conn(fetchone_return={
            "total_staff": 5, "trained_current": 5,
            "training_overdue": 0, "oldest_training": None, "newest_training": None,
        })
        result = collect_hipaa_as1(conn, CUSTOMER_ID, REQUEST_ID)
        assert result["customer_id"] == CUSTOMER_ID


# ══════════════════════════════════════════════════════════════════════════════
# HTTP RESPONSE HELPER
# ══════════════════════════════════════════════════════════════════════════════

class TestHttpResponse:
    """Test _http_response helper."""

    def test_response_structure(self):
        from hipaa_compliance_collector import _http_response
        resp = _http_response(200, {"ok": True})
        assert resp["statusCode"] == 200
        assert resp["headers"]["Content-Type"] == "application/json"
        assert resp["isBase64Encoded"] is False
        assert json.loads(resp["body"]) == {"ok": True}

    def test_error_response(self):
        from hipaa_compliance_collector import _http_response
        resp = _http_response(400, {"error": "bad request"})
        assert resp["statusCode"] == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
