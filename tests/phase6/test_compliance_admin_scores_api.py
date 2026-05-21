"""
Unit tests for Phase 6.2 compliance_admin_scores_api Lambda.

Tests cover:
- Admin JWT validation: admin role passes, tenant/missing role returns 401
- DynamoDB is queried per tenant per framework
- Score status derivation: Passing/At Risk/Critical thresholds
- Lambda handler returns correct response structure
- OPTIONS preflight returns 200
- Database errors return 500
"""

import json
import os
import sys
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
FUNCTIONS_DIR = os.path.join(
    os.path.dirname(__file__), '..', '..', 'phase6-backend', 'functions'
)
sys.path.insert(0, os.path.abspath(FUNCTIONS_DIR))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_context():
    ctx = MagicMock()
    ctx.aws_request_id = 'test-request-id-track4'
    return ctx


def _admin_event(http_method='GET'):
    """Build an API Gateway event with an admin role claim."""
    return {
        'httpMethod': http_method,
        'requestContext': {
            'authorizer': {
                'role': 'admin',
            },
        },
        'queryStringParameters': None,
    }


def _tenant_event():
    """Build an API Gateway event with a tenant role claim."""
    return {
        'httpMethod': 'GET',
        'requestContext': {
            'authorizer': {
                'role': 'viewer',
                'customer_id': 'some-tenant-uuid',
            },
        },
        'queryStringParameters': None,
    }


def _no_auth_event():
    """Build an API Gateway event with no authorizer context."""
    return {
        'httpMethod': 'GET',
        'requestContext': {},
        'queryStringParameters': None,
    }


def _load_module():
    """Import the module under test with boto3 and db_utils mocked."""
    mock_db = MagicMock()
    mock_db.query_many.return_value = [
        {'id': 'tenant-001'},
        {'id': 'tenant-002'},
    ]
    with patch('boto3.client'), patch('boto3.resource'), \
         patch.dict('sys.modules', {'db_utils': mock_db}):
        import importlib
        import compliance_admin_scores_api
        importlib.reload(compliance_admin_scores_api)
        return compliance_admin_scores_api, mock_db


# ---------------------------------------------------------------------------
# Tests: admin role validation
# ---------------------------------------------------------------------------

class TestAdminAuth:
    """Tests for admin JWT role enforcement."""

    def test_admin_role_passes(self):
        """An event with role=admin must not raise PermissionError."""
        mod, _ = _load_module()
        event = _admin_event()
        # Should not raise
        mod._require_admin(event)

    def test_tenant_role_raises(self):
        """An event with a non-admin role must raise PermissionError."""
        mod, _ = _load_module()
        event = _tenant_event()
        with pytest.raises(PermissionError, match='Admin role required'):
            mod._require_admin(event)

    def test_missing_authorizer_raises(self):
        """An event with no authorizer context must raise PermissionError."""
        mod, _ = _load_module()
        event = _no_auth_event()
        with pytest.raises(PermissionError, match='Missing authorizer context'):
            mod._require_admin(event)

    def test_handler_returns_401_for_tenant_token(self):
        """lambda_handler must return 401 for non-admin tokens."""
        mod, mock_db = _load_module()
        response = mod.lambda_handler(_tenant_event(), _make_context())
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert 'error' in body

    def test_handler_returns_401_for_missing_auth(self):
        """lambda_handler must return 401 when authorizer context is absent."""
        mod, _ = _load_module()
        response = mod.lambda_handler(_no_auth_event(), _make_context())
        assert response['statusCode'] == 401


# ---------------------------------------------------------------------------
# Tests: score status derivation
# ---------------------------------------------------------------------------

class TestScoreStatus:
    """Tests for the _score_status helper."""

    def _get_fn(self):
        mod, _ = _load_module()
        return mod._score_status

    def test_passing_at_80(self):
        assert self._get_fn()(80) == 'Passing'

    def test_passing_above_80(self):
        assert self._get_fn()(95.5) == 'Passing'

    def test_at_risk_at_60(self):
        assert self._get_fn()(60) == 'At Risk'

    def test_at_risk_between_60_and_80(self):
        assert self._get_fn()(75) == 'At Risk'

    def test_critical_below_60(self):
        assert self._get_fn()(59.9) == 'Critical'

    def test_critical_at_zero(self):
        assert self._get_fn()(0) == 'Critical'


# ---------------------------------------------------------------------------
# Tests: OPTIONS preflight
# ---------------------------------------------------------------------------

class TestCORSPreflight:
    """The Lambda must respond to OPTIONS requests for CORS support."""

    def test_options_returns_200(self):
        mod, _ = _load_module()
        event = {'httpMethod': 'OPTIONS', 'requestContext': {}}
        response = mod.lambda_handler(event, _make_context())
        assert response['statusCode'] == 200


# ---------------------------------------------------------------------------
# Tests: lambda_handler success path
# ---------------------------------------------------------------------------

class TestLambdaHandlerSuccess:
    """Integration tests for the admin compliance scores handler."""

    def _setup(self, customers, dynamo_items_by_fw):
        """Set up module with controlled mock DB and DynamoDB responses."""
        mock_db = MagicMock()
        mock_db.query_many.return_value = customers
        mock_db.DatabaseError = Exception

        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': mock_db}):
            import importlib
            import compliance_admin_scores_api
            importlib.reload(compliance_admin_scores_api)

        # Build separate mock tables per framework so each call returns the
        # right items regardless of the internal KeyConditionExpression format.
        def make_table(fw_items):
            call_count = [0]

            def query_side_effect(**_kwargs):
                # Return items on the first call (for this framework), then []
                idx = call_count[0] % len(fw_items) if fw_items else 0
                result = fw_items[call_count[0]] if call_count[0] < len(fw_items) else []
                call_count[0] += 1
                return {'Items': result}

            mock_table = MagicMock()
            mock_table.query.side_effect = query_side_effect
            return mock_table

        # The module calls dynamodb.Table() once per (tenant, framework) pair.
        # We return items in the order SOC2, HIPAA, FedRAMP per tenant.
        all_item_batches = []
        for _cust in customers:
            for fw in ('SOC2', 'HIPAA', 'FedRAMP'):
                all_item_batches.append(dynamo_items_by_fw.get(fw, []))

        batch_index = [0]
        mock_table_obj = MagicMock()

        def table_query_side_effect(**_kwargs):
            idx = batch_index[0]
            items = all_item_batches[idx] if idx < len(all_item_batches) else []
            batch_index[0] += 1
            return {'Items': items}

        mock_table_obj.query.side_effect = table_query_side_effect
        compliance_admin_scores_api.dynamodb = MagicMock()
        compliance_admin_scores_api.dynamodb.Table.return_value = mock_table_obj
        compliance_admin_scores_api.query_many = mock_db.query_many

        return compliance_admin_scores_api

    def test_handler_returns_200_for_admin(self):
        """lambda_handler returns 200 with generated_at and tenants list."""
        mod = self._setup(
            customers=[{'id': 'aaa'}, {'id': 'bbb'}],
            dynamo_items_by_fw={
                'SOC2':    [{'score': Decimal('84'), 'calculated_at': '2026-05-17T02:00:00+00:00'}],
                'HIPAA':   [{'score': Decimal('71'), 'calculated_at': '2026-05-17T02:00:00+00:00'}],
                'FedRAMP': [{'score': Decimal('90'), 'calculated_at': '2026-05-17T02:00:00+00:00'}],
            },
        )
        response = mod.lambda_handler(_admin_event(), _make_context())
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert 'generated_at' in body
        assert 'tenants' in body
        assert len(body['tenants']) == 2

    def test_tenant_display_names_are_internal_identifiers(self):
        """tenant_display_name must use Customer #N format, not real names."""
        mod = self._setup(
            customers=[{'id': 'cust-001'}, {'id': 'cust-002'}],
            dynamo_items_by_fw={},
        )
        response = mod.lambda_handler(_admin_event(), _make_context())
        body = json.loads(response['body'])
        display_names = [t['tenant_display_name'] for t in body['tenants']]
        assert display_names == ['Customer #1', 'Customer #2']

    def test_framework_scores_in_response(self):
        """Each tenant entry must contain SOC2, HIPAA, FedRAMP keys."""
        mod = self._setup(
            customers=[{'id': 'cust-001'}],
            dynamo_items_by_fw={
                'SOC2':    [{'score': Decimal('84'), 'calculated_at': '2026-05-17T02:00:00+00:00'}],
                'HIPAA':   [{'score': Decimal('71'), 'calculated_at': '2026-05-17T02:00:00+00:00'}],
                'FedRAMP': [{'score': Decimal('90'), 'calculated_at': '2026-05-17T02:00:00+00:00'}],
            },
        )
        response = mod.lambda_handler(_admin_event(), _make_context())
        body = json.loads(response['body'])
        tenant = body['tenants'][0]
        assert tenant['SOC2']['score'] == 84.0
        assert tenant['SOC2']['status'] == 'Passing'
        assert tenant['HIPAA']['score'] == 71.0
        assert tenant['HIPAA']['status'] == 'At Risk'
        assert tenant['FedRAMP']['score'] == 90.0
        assert tenant['FedRAMP']['status'] == 'Passing'

    def test_missing_framework_score_is_none(self):
        """When DynamoDB has no data for a framework, that key is None."""
        mod = self._setup(
            customers=[{'id': 'cust-001'}],
            dynamo_items_by_fw={},  # no scores stored
        )
        response = mod.lambda_handler(_admin_event(), _make_context())
        body = json.loads(response['body'])
        tenant = body['tenants'][0]
        assert tenant['SOC2'] is None
        assert tenant['HIPAA'] is None
        assert tenant['FedRAMP'] is None

    def test_tenant_id_in_response(self):
        """Each tenant entry must include the original tenant_id."""
        mod = self._setup(
            customers=[{'id': 'my-tenant-uuid'}],
            dynamo_items_by_fw={},
        )
        response = mod.lambda_handler(_admin_event(), _make_context())
        body = json.loads(response['body'])
        assert body['tenants'][0]['tenant_id'] == 'my-tenant-uuid'

    def test_empty_customer_list_returns_empty_tenants(self):
        """If no active customers exist, tenants list is empty."""
        mod = self._setup(
            customers=[],
            dynamo_items_by_fw={},
        )
        response = mod.lambda_handler(_admin_event(), _make_context())
        body = json.loads(response['body'])
        assert body['tenants'] == []

    def test_database_error_returns_500(self):
        """A DatabaseError loading customers must return 500."""
        mock_db = MagicMock()
        mock_db.DatabaseError = RuntimeError
        mock_db.query_many.side_effect = RuntimeError('DB unavailable')

        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': mock_db}):
            import importlib
            import compliance_admin_scores_api
            importlib.reload(compliance_admin_scores_api)
            compliance_admin_scores_api.query_many = mock_db.query_many

        response = compliance_admin_scores_api.lambda_handler(_admin_event(), _make_context())
        assert response['statusCode'] == 500
        body = json.loads(response['body'])
        assert 'error' in body
