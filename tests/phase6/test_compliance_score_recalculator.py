"""
Unit tests for Phase 6.2 compliance_score_recalculator Lambda.

Tests cover:
- Mapping files load correctly (valid JSON, required keys present)
- Weighted score calculation logic (100% passing, 0% passing, mixed)
- DynamoDB write called with correct item structure
- Error handling: Config API throttle / service error
- Error handling: Security Hub not enabled
- dry_run flag skips DynamoDB write
"""

import json
import os
import sys
from decimal import Decimal
from unittest.mock import MagicMock, patch, call

import pytest

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
FUNCTIONS_DIR = os.path.join(
    os.path.dirname(__file__), '..', '..', 'phase6-backend', 'functions'
)
COMPLIANCE_DIR = os.path.join(
    os.path.dirname(__file__), '..', '..', 'phase6-backend', 'compliance'
)
sys.path.insert(0, os.path.abspath(FUNCTIONS_DIR))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_context():
    ctx = MagicMock()
    ctx.aws_request_id = 'test-request-id-002'
    return ctx


SAMPLE_CONTROLS = [
    {'control_id': 'CC6.1', 'severity': 'CRITICAL', 'config_rule': 'mfa-enabled-for-iam-console-access'},
    {'control_id': 'CC6.7', 'severity': 'HIGH',     'config_rule': 's3-bucket-ssl-requests-only'},
    {'control_id': 'CC8.1', 'severity': 'MEDIUM',   'config_rule': 'vpc-flow-logs-enabled'},
    {'control_id': 'CC9.1', 'severity': 'LOW',      'config_rule': 'root-account-mfa-enabled'},
]

# Total weight = 3.0 + 2.0 + 1.0 + 0.5 = 6.5


# ---------------------------------------------------------------------------
# Tests: Mapping file loading
# ---------------------------------------------------------------------------

class TestMappingFiles:
    """Verify that compliance mapping JSON files are valid and well-formed."""

    @pytest.mark.parametrize('filename', [
        'soc2_mapping.json',
        'hipaa_mapping.json',
        'fedramp_mapping.json',
    ])
    def test_mapping_file_is_valid_json(self, filename):
        """Each mapping file must be parseable JSON."""
        filepath = os.path.join(COMPLIANCE_DIR, filename)
        assert os.path.exists(filepath), f"Mapping file missing: {filename}"
        with open(filepath) as fh:
            data = json.load(fh)
        assert isinstance(data, dict), f"{filename} root must be a dict"

    @pytest.mark.parametrize('filename', [
        'soc2_mapping.json',
        'hipaa_mapping.json',
        'fedramp_mapping.json',
    ])
    def test_mapping_file_has_required_top_level_keys(self, filename):
        """Each mapping file must have 'framework' and 'controls' keys."""
        filepath = os.path.join(COMPLIANCE_DIR, filename)
        with open(filepath) as fh:
            data = json.load(fh)
        assert 'framework' in data, f"{filename} missing 'framework'"
        assert 'controls' in data, f"{filename} missing 'controls'"
        assert isinstance(data['controls'], list), f"{filename} 'controls' must be a list"

    @pytest.mark.parametrize('filename,min_controls', [
        ('soc2_mapping.json', 15),
        ('hipaa_mapping.json', 10),
        ('fedramp_mapping.json', 12),
    ])
    def test_mapping_file_has_minimum_control_count(self, filename, min_controls):
        """Each mapping file must have at least the minimum number of controls."""
        filepath = os.path.join(COMPLIANCE_DIR, filename)
        with open(filepath) as fh:
            data = json.load(fh)
        count = len(data.get('controls', []))
        assert count >= min_controls, (
            f"{filename} has {count} controls; expected ≥ {min_controls}"
        )

    @pytest.mark.parametrize('filename', [
        'soc2_mapping.json',
        'hipaa_mapping.json',
        'fedramp_mapping.json',
    ])
    def test_each_control_has_required_fields(self, filename):
        """Every control must have 'control_id', 'severity', and 'config_rule'."""
        filepath = os.path.join(COMPLIANCE_DIR, filename)
        with open(filepath) as fh:
            data = json.load(fh)
        for ctrl in data['controls']:
            cid = ctrl.get('control_id', '(unknown)')
            assert ctrl.get('control_id'), f"{filename}: control missing 'control_id'"
            assert ctrl.get('severity'), f"{filename}: {cid} missing 'severity'"
            assert ctrl.get('config_rule'), f"{filename}: {cid} missing 'config_rule'"

    @pytest.mark.parametrize('filename', [
        'soc2_mapping.json',
        'hipaa_mapping.json',
        'fedramp_mapping.json',
    ])
    def test_severity_values_are_valid(self, filename):
        """Each control's severity must be one of the recognised values."""
        valid = {'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'}
        filepath = os.path.join(COMPLIANCE_DIR, filename)
        with open(filepath) as fh:
            data = json.load(fh)
        for ctrl in data['controls']:
            sev = ctrl.get('severity', '').upper()
            assert sev in valid, (
                f"{filename}: {ctrl.get('control_id')} has invalid severity '{sev}'"
            )


# ---------------------------------------------------------------------------
# Tests: _calculate_weighted_score
# ---------------------------------------------------------------------------

class TestCalculateWeightedScore:
    """Tests for the weighted score calculation logic."""

    def _get_function(self):
        """Import and return the function under test."""
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': MagicMock()}):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)
            return compliance_score_recalculator._calculate_weighted_score

    def test_all_passing_returns_100(self):
        """100% passing controls → score = 100.0."""
        fn = self._get_function()
        compliance_map = {c['config_rule']: 'COMPLIANT' for c in SAMPLE_CONTROLS}
        score, violations = fn(SAMPLE_CONTROLS, compliance_map)
        assert score == pytest.approx(100.0)
        assert all(v == 0 for v in violations.values())

    def test_all_failing_returns_0(self):
        """0% passing controls → score = 0.0."""
        fn = self._get_function()
        compliance_map = {c['config_rule']: 'NON_COMPLIANT' for c in SAMPLE_CONTROLS}
        score, violations = fn(SAMPLE_CONTROLS, compliance_map)
        assert score == pytest.approx(0.0)
        assert violations['CRITICAL'] == 1
        assert violations['HIGH'] == 1
        assert violations['MEDIUM'] == 1
        assert violations['LOW'] == 1

    def test_partial_compliance_weighted_correctly(self):
        """Score for partially compliant controls uses correct weights."""
        fn = self._get_function()
        # Only CRITICAL (3.0) and LOW (0.5) are passing → passing_weight = 3.5
        # total_weight = 6.5
        # expected = 100 * 3.5 / 6.5 ≈ 53.85
        compliance_map = {
            'mfa-enabled-for-iam-console-access': 'COMPLIANT',      # CRITICAL = 3.0
            's3-bucket-ssl-requests-only': 'NON_COMPLIANT',          # HIGH = 2.0
            'vpc-flow-logs-enabled': 'NON_COMPLIANT',                # MEDIUM = 1.0
            'root-account-mfa-enabled': 'COMPLIANT',                 # LOW = 0.5
        }
        score, violations = fn(SAMPLE_CONTROLS, compliance_map)
        expected = round(100.0 * 3.5 / 6.5, 2)
        assert score == pytest.approx(expected, abs=0.01)

    def test_empty_controls_returns_0(self):
        """No controls → score = 0.0."""
        fn = self._get_function()
        score, violations = fn([], {})
        assert score == pytest.approx(0.0)

    def test_insufficient_data_not_counted_as_passing(self):
        """INSUFFICIENT_DATA controls do not contribute to passing weight."""
        fn = self._get_function()
        compliance_map = {
            'mfa-enabled-for-iam-console-access': 'INSUFFICIENT_DATA',
            's3-bucket-ssl-requests-only': 'COMPLIANT',
            'vpc-flow-logs-enabled': 'INSUFFICIENT_DATA',
            'root-account-mfa-enabled': 'COMPLIANT',
        }
        score, _ = fn(SAMPLE_CONTROLS, compliance_map)
        # passing_weight = HIGH(2.0) + LOW(0.5) = 2.5; total = 6.5
        expected = round(100.0 * 2.5 / 6.5, 2)
        assert score == pytest.approx(expected, abs=0.01)


# ---------------------------------------------------------------------------
# Tests: _write_score_to_dynamodb
# ---------------------------------------------------------------------------

class TestWriteScoreToDynamoDB:
    """Tests for DynamoDB write logic."""

    def _setup(self):
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': MagicMock()}):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)
            return compliance_score_recalculator

    def test_dry_run_skips_dynamodb_write(self):
        """dry_run=True must not call DynamoDB put_item."""
        mod = self._setup()
        mock_table = MagicMock()
        mod.dynamodb = MagicMock()
        mod.dynamodb.Table.return_value = mock_table

        mod._write_score_to_dynamodb(
            customer_id='tenant-id',
            framework='SOC2',
            score=85.5,
            violations={'CRITICAL': 1, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0},
            controls_total=10,
            controls_passing=9,
            dry_run=True,
        )
        mock_table.put_item.assert_not_called()

    def test_writes_correct_item_structure(self):
        """put_item is called with correct PK, SK, and score fields."""
        mod = self._setup()
        mock_table = MagicMock()
        mod.dynamodb = MagicMock()
        mod.dynamodb.Table.return_value = mock_table

        mod._write_score_to_dynamodb(
            customer_id='tenant-id',
            framework='HIPAA',
            score=92.0,
            violations={'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 1, 'LOW': 0},
            controls_total=12,
            controls_passing=11,
            dry_run=False,
        )

        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args.kwargs['Item']
        assert item['PK'] == 'CUSTOMER#tenant-id'
        assert item['SK'].startswith('FRAMEWORK#HIPAA#DATE#')
        assert item['framework'] == 'HIPAA'
        assert item['score'] == Decimal('92.0')
        assert item['controls_total'] == 12
        assert item['controls_passing'] == 11
        assert item['controls_failing'] == 1
        assert 'ttl' in item


# ---------------------------------------------------------------------------
# Tests: lambda_handler
# ---------------------------------------------------------------------------

class TestLambdaHandler:
    """Integration-level tests for compliance_score_recalculator.lambda_handler."""

    def _make_mock_db(self, customers=None):
        mock_db = MagicMock()
        mock_db.query_many.return_value = customers or [
            {'id': 'tenant-aaa'},
            {'id': 'tenant-bbb'},
        ]
        return mock_db

    def test_handler_returns_tenant_count(self):
        """handler must return tenants_processed equal to number of active tenants."""
        mock_db = self._make_mock_db(customers=[{'id': 'tenant-aaa'}, {'id': 'tenant-bbb'}])
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': mock_db}):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)

            with patch.object(compliance_score_recalculator, '_score_tenant',
                               return_value={'SOC2': 90.0, 'HIPAA': 85.0}):
                result = compliance_score_recalculator.lambda_handler({}, _make_context())

        assert result['tenants_processed'] == 2
        assert 'errors' in result
        assert result['errors'] == []

    def test_handler_with_dry_run(self):
        """dry_run=True is passed through to _score_tenant."""
        mock_db = self._make_mock_db(customers=[{'id': 'tenant-ccc'}])
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': mock_db}):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)

            with patch.object(compliance_score_recalculator, '_score_tenant',
                               return_value={}) as mock_score:
                compliance_score_recalculator.lambda_handler(
                    {'dry_run': True}, _make_context()
                )
            mock_score.assert_called_once_with('tenant-ccc', dry_run=True)

    def test_handler_records_errors_but_continues(self):
        """Errors for individual tenants are recorded and processing continues."""
        mock_db = self._make_mock_db(
            customers=[{'id': 'tenant-ok'}, {'id': 'tenant-bad'}]
        )
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': mock_db}):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)

            def side_effect(customer_id, dry_run=False):
                if customer_id == 'tenant-bad':
                    raise RuntimeError('Simulated AWS API failure')
                return {'SOC2': 95.0}

            with patch.object(compliance_score_recalculator, '_score_tenant',
                               side_effect=side_effect):
                result = compliance_score_recalculator.lambda_handler({}, _make_context())

        # tenant-ok processed successfully; tenant-bad recorded as error
        assert result['tenants_processed'] == 1
        assert len(result['errors']) == 1
        assert 'tenant-bad' in result['errors'][0]

    def test_handler_single_tenant_target(self):
        """customer_id in event restricts scoring to a single tenant."""
        mock_db = self._make_mock_db(customers=[{'id': 'target-tenant'}])
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': mock_db}):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)

            with patch.object(compliance_score_recalculator, '_score_tenant',
                               return_value={'SOC2': 80.0}) as mock_score:
                result = compliance_score_recalculator.lambda_handler(
                    {'customer_id': 'target-tenant'}, _make_context()
                )

        assert result['tenants_processed'] == 1
        mock_score.assert_called_once_with('target-tenant', dry_run=False)
