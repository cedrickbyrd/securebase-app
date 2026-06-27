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
        """Every control must include required compliance metadata fields."""
        filepath = os.path.join(COMPLIANCE_DIR, filename)
        with open(filepath) as fh:
            data = json.load(fh)
        for ctrl in data['controls']:
            cid = ctrl.get('control_id', '(unknown)')
            assert ctrl.get('control_id'), f"{filename}: control missing 'control_id'"
            assert ctrl.get('rule_name'), f"{filename}: {cid} missing 'rule_name'"
            assert ctrl.get('framework'), f"{filename}: {cid} missing 'framework'"
            assert ctrl.get('control_name'), f"{filename}: {cid} missing 'control_name'"
            assert ctrl.get('description'), f"{filename}: {cid} missing 'description'"
            assert ctrl.get('severity'), f"{filename}: {cid} missing 'severity'"
            assert ctrl.get('config_rule'), f"{filename}: {cid} missing 'config_rule'"

    @pytest.mark.parametrize('filename', [
        'soc2_mapping.json',
        'hipaa_mapping.json',
        'fedramp_mapping.json',
    ])
    def test_severity_values_are_valid(self, filename):
        """Each control's severity must be one of the recognised values."""
        valid = {'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'}
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
            cloudwatch_client=MagicMock(),
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
            cloudwatch_client=MagicMock(),
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

    def test_control_violations_written_with_expected_key(self):
        """Per-control snapshots are written to control_violation_log table."""
        mod = self._setup()
        mock_table = MagicMock()
        mod.dynamodb = MagicMock()
        mod.dynamodb.Table.return_value = mock_table

        mod._write_control_violations_to_dynamodb(
            customer_id='tenant-id',
            framework='HIPAA',
            controls=[{
                'control_id': 'HIPAA-164.312(b)',
                'control_name': 'Audit Controls',
                'description': 'Audit logging controls',
                'severity': 'CRITICAL',
                'config_rule': 'cloudtrail-enabled',
                'remediation_url': 'https://example.com/fix',
            }],
            compliance_map={'cloudtrail-enabled': 'NON_COMPLIANT'},
            dry_run=False,
        )

        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args.kwargs['Item']
        assert item['PK'] == 'CUSTOMER#tenant-id'
        assert item['SK'].startswith('CONTROL#HIPAA#HIPAA-164.312(b)#DATE#')
        assert item['status'] == 'NON_COMPLIANT'
        assert item['severity'] == 'CRITICAL'


# ---------------------------------------------------------------------------
# Tests: lambda_handler
# ---------------------------------------------------------------------------

class TestLambdaHandler:
    """Integration-level tests for compliance_score_recalculator.lambda_handler."""

    def test_scheduled_run_fans_out_to_all_active_tenants(self):
        """Empty (scheduled) event must async self-invoke once per tenant.

        Regression test for the audit finding: the daily cron previously scored
        only the 'platform' account (tenants_processed == 1). It must now read
        the tenant registry and dispatch one invoke per active tenant plus the
        platform account.
        """
        with patch('boto3.client'), patch('boto3.resource'):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)
            compliance_score_recalculator.SELF_FUNCTION_NAME = 'self-fn'

            # Three active tenants in the registry (Customer #1/#2/#3 convention,
            # opaque ids only — no PII).
            active_tenants = [
                {'customer_id': 'cust-0001', 'role_arn': 'arn:aws:iam::111:role/SecureBaseReadOnly'},
                {'customer_id': 'cust-0002', 'role_arn': 'arn:aws:iam::222:role/SecureBaseReadOnly'},
                {'customer_id': 'cust-0003', 'role_arn': None},
            ]
            mock_lambda = MagicMock()
            with patch.object(compliance_score_recalculator, '_get_active_tenants',
                              return_value=active_tenants), \
                 patch('compliance_score_recalculator.boto3.client',
                       return_value=mock_lambda):
                result = compliance_score_recalculator.lambda_handler({}, _make_context())

        # platform + 3 tenants = 4 dispatched invocations.
        assert result['mode'] == 'fan_out'
        assert result['tenants_dispatched'] == 4
        assert result['tenants_total'] == 4
        assert result['errors'] == []
        assert mock_lambda.invoke.call_count == 4

        # Every dispatch must be async (fire-and-forget) and target this function.
        dispatched_ids = []
        for invoke_call in mock_lambda.invoke.call_args_list:
            kwargs = invoke_call.kwargs
            assert kwargs['InvocationType'] == 'Event'
            assert kwargs['FunctionName'] == 'self-fn'
            dispatched_ids.append(json.loads(kwargs['Payload'])['customer_id'])

        assert 'platform' in dispatched_ids
        assert {'cust-0001', 'cust-0002', 'cust-0003'}.issubset(set(dispatched_ids))

        # The tenant with a role_arn must carry it through to the child invoke.
        cust1_payload = next(
            json.loads(c.kwargs['Payload'])
            for c in mock_lambda.invoke.call_args_list
            if json.loads(c.kwargs['Payload'])['customer_id'] == 'cust-0001'
        )
        assert cust1_payload['role_arn'] == 'arn:aws:iam::111:role/SecureBaseReadOnly'

    def test_scheduled_fan_out_propagates_dry_run(self):
        """dry_run on the scheduled event is forwarded to each child invoke."""
        with patch('boto3.client'), patch('boto3.resource'):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)
            compliance_score_recalculator.SELF_FUNCTION_NAME = 'self-fn'

            mock_lambda = MagicMock()
            with patch.object(compliance_score_recalculator, '_get_active_tenants',
                              return_value=[{'customer_id': 'cust-0001', 'role_arn': None}]), \
                 patch('compliance_score_recalculator.boto3.client',
                       return_value=mock_lambda):
                compliance_score_recalculator.lambda_handler({'dry_run': True}, _make_context())

        for invoke_call in mock_lambda.invoke.call_args_list:
            assert json.loads(invoke_call.kwargs['Payload'])['dry_run'] is True

    def test_manual_single_tenant_invoke_still_scores_one_tenant(self):
        """A manual invoke with customer_id scores exactly that tenant inline."""
        with patch('boto3.client'), patch('boto3.resource'):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)

            with patch.object(compliance_score_recalculator, '_score_tenant',
                               return_value={'SOC2': 90.0, 'HIPAA': 85.0}) as mock_score, \
                 patch('compliance_score_recalculator.boto3.Session',
                       return_value=MagicMock()) as mock_session:
                result = compliance_score_recalculator.lambda_handler(
                    {'customer_id': 'platform'}, _make_context()
                )

        assert result['mode'] == 'single_tenant'
        assert result['tenants_processed'] == 1
        assert result['scores']['platform']['SOC2'] == 90.0
        assert result['errors'] == []
        mock_session.assert_called_once()
        called_args, called_kwargs = mock_score.call_args
        assert called_args[0] == 'platform'
        assert called_kwargs['dry_run'] is False
        assert called_kwargs['session'] is mock_session.return_value

    def test_single_tenant_with_dry_run(self):
        """dry_run=True is passed through to _score_tenant on the manual path."""
        with patch('boto3.client'), patch('boto3.resource'):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)

            with patch.object(compliance_score_recalculator, '_score_tenant',
                               return_value={}) as mock_score, \
                 patch('compliance_score_recalculator.boto3.Session',
                       return_value=MagicMock()) as mock_session:
                compliance_score_recalculator.lambda_handler(
                    {'customer_id': 'cust-0001', 'dry_run': True}, _make_context()
                )
            called_args, called_kwargs = mock_score.call_args
            assert called_args[0] == 'cust-0001'
            assert called_kwargs['dry_run'] is True
            assert called_kwargs['session'] is mock_session.return_value

    def test_handler_records_errors(self):
        with patch('boto3.client'), patch('boto3.resource'):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)

            with patch.object(compliance_score_recalculator, '_score_tenant',
                               side_effect=RuntimeError('Simulated AWS API failure')), \
                 patch('compliance_score_recalculator.boto3.Session',
                       return_value=MagicMock()):
                result = compliance_score_recalculator.lambda_handler(
                    {'customer_id': 'platform'}, _make_context()
                )

        assert result['tenants_processed'] == 0
        assert len(result['errors']) == 1
        assert 'platform' in result['errors'][0]

    def test_handler_assumes_role_when_role_arn_is_provided(self):
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('os.environ', {'SECUREBASE_EXTERNAL_ID': 'test-external-id'}):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)

            with patch.object(compliance_score_recalculator, '_score_tenant',
                               return_value={'SOC2': 80.0}) as mock_score, \
                 patch('compliance_score_recalculator.boto3.client') as mock_boto_client, \
                 patch('compliance_score_recalculator.boto3.Session',
                       return_value=MagicMock()) as mock_session:
                mock_boto_client.return_value.assume_role.return_value = {
                    'Credentials': {
                        'AccessKeyId': 'ak',
                        'SecretAccessKey': 'sk',
                        'SessionToken': 'st',
                    }
                }
                result = compliance_score_recalculator.lambda_handler(
                    {'customer_id': 'target-tenant', 'role_arn': 'arn:aws:iam::123:role/SecureBaseReadOnlyRole'},
                    _make_context(),
                )

        assert result['tenants_processed'] == 1
        called_args, called_kwargs = mock_score.call_args
        assert called_args[0] == 'target-tenant'
        assert called_kwargs['dry_run'] is False
        assert called_kwargs['session'] is mock_session.return_value


# ---------------------------------------------------------------------------
# Tests: _score_tenant — Config failure must NOT persist a spurious score=0
# ---------------------------------------------------------------------------

class TestScoreTenantConfigFailure:
    """When AWS Config returns no data, no score row may be written."""

    def _setup(self):
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': MagicMock()}):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)
            return compliance_score_recalculator

    def _session_with_controls(self, mod):
        """Build a fake session and force a non-empty control mapping load."""
        session = MagicMock()
        # _load_mapping returns controls so rule_names is non-empty.
        mod._load_mapping = MagicMock(return_value={'controls': SAMPLE_CONTROLS})
        return session

    def test_empty_config_map_skips_write(self):
        """An empty compliance map (Config query failed) must skip the write.

        Regression test: previously the code wrote score=0 from an empty map,
        which tripped the >10pt-drop alarm. Now the framework is skipped and no
        DynamoDB write happens.
        """
        mod = self._setup()
        session = self._session_with_controls(mod)

        write_score = MagicMock()
        write_violations = MagicMock()
        mod._write_score_to_dynamodb = write_score
        mod._write_control_violations_to_dynamodb = write_violations
        # Simulate Config failure: empty compliance map for every framework.
        mod._get_config_compliance = MagicMock(return_value={})

        scores = mod._score_tenant('cust-0001', session=session, dry_run=False)

        # No score persisted for any framework, and each is reported as None.
        write_score.assert_not_called()
        write_violations.assert_not_called()
        assert scores  # frameworks were attempted
        assert all(value is None for value in scores.values())

    def test_nonempty_config_map_still_writes(self):
        """A populated compliance map writes the score as before (no regression)."""
        mod = self._setup()
        session = self._session_with_controls(mod)

        write_score = MagicMock()
        write_violations = MagicMock()
        mod._write_score_to_dynamodb = write_score
        mod._write_control_violations_to_dynamodb = write_violations
        mod._get_config_compliance = MagicMock(
            return_value={c['config_rule']: 'COMPLIANT' for c in SAMPLE_CONTROLS}
        )

        scores = mod._score_tenant('cust-0001', session=session, dry_run=False)

        assert write_score.called
        assert all(value == pytest.approx(100.0) for value in scores.values())


# ---------------------------------------------------------------------------
# Tests: _get_active_tenants — reads active customers + role_arn (no PII)
# ---------------------------------------------------------------------------

class TestGetActiveTenants:
    """Tenant-registry read returns active customer ids + cross-account roles."""

    def _setup(self):
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': MagicMock()}):
            import importlib
            import compliance_score_recalculator
            importlib.reload(compliance_score_recalculator)
            return compliance_score_recalculator

    def test_returns_empty_when_db_secret_not_configured(self):
        """Without DB_SECRET_ARN the read is a safe no-op (platform-only)."""
        mod = self._setup()
        mod.DB_SECRET_ARN = ''
        assert mod._get_active_tenants() == []

    def test_reads_active_tenants_with_role_arns(self):
        """Active customers and their role_arns are returned as opaque records."""
        mod = self._setup()
        mod.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123:secret:db'

        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            ('cust-0001', 'arn:aws:iam::111:role/SecureBaseReadOnly'),
            ('cust-0002', None),
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mod._get_db_connection = MagicMock(return_value=mock_conn)

        tenants = mod._get_active_tenants()

        assert tenants == [
            {'customer_id': 'cust-0001', 'role_arn': 'arn:aws:iam::111:role/SecureBaseReadOnly'},
            {'customer_id': 'cust-0002', 'role_arn': None},
        ]
        # Only the active-status query should run (no PII columns selected).
        executed_sql = mock_cursor.execute.call_args[0][0]
        assert "status = 'active'" in executed_sql
        assert 'email' not in executed_sql.lower()
        assert 'first_name' not in executed_sql.lower()

    def test_db_failure_degrades_to_empty(self):
        """A DB error returns an empty list so the caller still scores platform."""
        mod = self._setup()
        mod.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123:secret:db'
        mod._get_db_connection = MagicMock(side_effect=RuntimeError('connect failed'))
        assert mod._get_active_tenants() == []
