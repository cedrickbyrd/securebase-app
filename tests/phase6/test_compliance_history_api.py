"""
Unit tests for Phase 6.2 compliance_history_api Lambda.

Tests cover:
- GET /tenant/compliance/history happy path (all frameworks, single framework)
- Missing customer_id returns 401
- Invalid framework parameter returns 400
- Invalid days parameter returns 400
- days boundary values (1 and 365)
- DynamoDB ClientError returns 503
- Empty history returns empty list with null summary values
- Summary calculation: latest, min, max, avg, trend
- OPTIONS pre-flight returns 200
- Non-GET method returns 405
- Decimal values from DynamoDB serialised correctly
"""

import json
import os
import sys
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Path setup — add phase6-backend/functions to sys.path
# ---------------------------------------------------------------------------

FUNCTIONS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'phase6-backend', 'functions')
)
sys.path.insert(0, FUNCTIONS_DIR)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_context(request_id: str = 'test-request-id-hist') -> MagicMock:
    ctx = MagicMock()
    ctx.aws_request_id = request_id
    return ctx


def _make_event(
    method: str = 'GET',
    customer_id: str = 'cust-uuid-001',
    qs: dict = None,
) -> dict:
    """Build a minimal API Gateway proxy event."""
    return {
        'httpMethod': method,
        'queryStringParameters': qs or {},
        'requestContext': {
            'authorizer': {
                'customer_id': customer_id,
            }
        },
        'headers': {
            'Content-Type': 'application/json',
        },
    }


# Sample DynamoDB items returned by the mock table
_SAMPLE_ITEMS = [
    {
        'PK': 'CUSTOMER#cust-uuid-001',
        'SK': 'FRAMEWORK#SOC2#DATE#2026-05-12',
        'customer_id': 'cust-uuid-001',
        'framework': 'SOC2',
        'score_date': '2026-05-12',
        'score': Decimal('95.5'),
        'controls_total': 16,
        'controls_passing': 15,
        'controls_failing': 1,
        'critical_violations': 0,
        'high_violations': 1,
        'medium_violations': 0,
        'low_violations': 0,
        'calculated_at': '2026-05-12T02:05:00+00:00',
    },
    {
        'PK': 'CUSTOMER#cust-uuid-001',
        'SK': 'FRAMEWORK#SOC2#DATE#2026-05-05',
        'customer_id': 'cust-uuid-001',
        'framework': 'SOC2',
        'score_date': '2026-05-05',
        'score': Decimal('90.0'),
        'controls_total': 16,
        'controls_passing': 14,
        'controls_failing': 2,
        'critical_violations': 0,
        'high_violations': 2,
        'medium_violations': 0,
        'low_violations': 0,
        'calculated_at': '2026-05-05T02:05:00+00:00',
    },
]

_SAMPLE_CONTROL_ITEMS = [
    {
        'PK': 'CUSTOMER#cust-uuid-001',
        'SK': 'CONTROL#HIPAA#HIPAA-164.312(b)#DATE#2026-05-12',
        'framework': 'HIPAA',
        'control_id': 'HIPAA-164.312(b)',
        'control_name': 'Audit Controls',
        'severity': 'CRITICAL',
        'status': 'NON_COMPLIANT',
        'recorded_date': '2026-05-12',
    }
]


def _mock_table(items: list) -> MagicMock:
    """Return a mock DynamoDB table whose query() returns the given items."""
    mock = MagicMock()
    mock.query.return_value = {'Items': items}
    return mock


# ---------------------------------------------------------------------------
# Load the module under test (with boto3 patched at import time)
# ---------------------------------------------------------------------------


def _load_module():
    """Import (or reload) compliance_history_api with boto3 stubbed."""
    import importlib
    import compliance_history_api
    importlib.reload(compliance_history_api)
    return compliance_history_api


# ---------------------------------------------------------------------------
# Tests: authentication
# ---------------------------------------------------------------------------


class TestAuth:
    def test_missing_customer_id_returns_401(self):
        with patch('boto3.resource'):
            mod = _load_module()

        event = {
            'httpMethod': 'GET',
            'queryStringParameters': {},
            'requestContext': {'authorizer': {}},
            'headers': {},
        }
        result = mod.lambda_handler(event, _make_context())
        assert result['statusCode'] == 401
        body = json.loads(result['body'])
        assert 'Unauthorized' in body['error']

    def test_customer_id_from_authorizer(self):
        with patch('boto3.resource') as mock_resource:
            mock_resource.return_value.Table.return_value = _mock_table(_SAMPLE_ITEMS)
            mod = _load_module()
            mod.dynamodb = mock_resource.return_value

        mod.dynamodb.Table.return_value = _mock_table(_SAMPLE_ITEMS)
        result = mod.lambda_handler(_make_event(), _make_context())
        assert result['statusCode'] == 200

    def test_customer_id_from_query_string_fallback(self):
        """customer_id in query string is accepted when authorizer is absent."""
        with patch('boto3.resource') as mock_resource:
            mock_resource.return_value.Table.return_value = _mock_table(_SAMPLE_ITEMS)
            mod = _load_module()
            mod.dynamodb = mock_resource.return_value

        mod.dynamodb.Table.return_value = _mock_table(_SAMPLE_ITEMS)
        event = {
            'httpMethod': 'GET',
            'queryStringParameters': {'customer_id': 'cust-qs-001'},
            'requestContext': {},
            'headers': {},
        }
        result = mod.lambda_handler(event, _make_context())
        assert result['statusCode'] == 200


# ---------------------------------------------------------------------------
# Tests: HTTP method handling
# ---------------------------------------------------------------------------


class TestHttpMethods:
    def test_options_returns_200(self):
        with patch('boto3.resource'):
            mod = _load_module()
        result = mod.lambda_handler({'httpMethod': 'OPTIONS'}, _make_context())
        assert result['statusCode'] == 200

    def test_post_returns_405(self):
        with patch('boto3.resource'):
            mod = _load_module()
        result = mod.lambda_handler({'httpMethod': 'POST'}, _make_context())
        assert result['statusCode'] == 405


# ---------------------------------------------------------------------------
# Tests: query parameter validation
# ---------------------------------------------------------------------------


class TestQueryParams:
    def test_invalid_framework_returns_400(self):
        with patch('boto3.resource'):
            mod = _load_module()
        result = mod.lambda_handler(
            _make_event(qs={'framework': 'PCI_DSS'}), _make_context()
        )
        assert result['statusCode'] == 400
        body = json.loads(result['body'])
        assert 'Invalid framework' in body['error']

    def test_valid_frameworks_accepted(self):
        for fw in ('SOC2', 'HIPAA', 'FedRAMP', 'CIS'):
            with patch('boto3.resource') as mock_resource:
                mod = _load_module()
                mod.dynamodb = mock_resource.return_value
                mod.dynamodb.Table.return_value = _mock_table([])
                result = mod.lambda_handler(
                    _make_event(qs={'framework': fw}), _make_context()
                )
            assert result['statusCode'] == 200, f"Framework {fw} should be valid"

    def test_framework_case_insensitive(self):
        with patch('boto3.resource') as mock_resource:
            mod = _load_module()
            mod.dynamodb = mock_resource.return_value
            mod.dynamodb.Table.return_value = _mock_table([])
            result = mod.lambda_handler(
                _make_event(qs={'framework': 'soc2'}), _make_context()
            )
        assert result['statusCode'] == 200

    def test_invalid_days_string_returns_400(self):
        with patch('boto3.resource'):
            mod = _load_module()
        result = mod.lambda_handler(
            _make_event(qs={'days': 'thirty'}), _make_context()
        )
        assert result['statusCode'] == 400

    def test_days_zero_returns_400(self):
        with patch('boto3.resource'):
            mod = _load_module()
        result = mod.lambda_handler(
            _make_event(qs={'days': '0'}), _make_context()
        )
        assert result['statusCode'] == 400

    def test_days_366_returns_400(self):
        with patch('boto3.resource'):
            mod = _load_module()
        result = mod.lambda_handler(
            _make_event(qs={'days': '366'}), _make_context()
        )
        assert result['statusCode'] == 400

    def test_days_1_is_valid(self):
        with patch('boto3.resource') as mock_resource:
            mod = _load_module()
            mod.dynamodb = mock_resource.return_value
            mod.dynamodb.Table.return_value = _mock_table([])
            result = mod.lambda_handler(
                _make_event(qs={'days': '1'}), _make_context()
            )
        assert result['statusCode'] == 200

    def test_days_365_is_valid(self):
        with patch('boto3.resource') as mock_resource:
            mod = _load_module()
            mod.dynamodb = mock_resource.return_value
            mod.dynamodb.Table.return_value = _mock_table([])
            result = mod.lambda_handler(
                _make_event(qs={'days': '365'}), _make_context()
            )
        assert result['statusCode'] == 200


# ---------------------------------------------------------------------------
# Tests: response structure
# ---------------------------------------------------------------------------


class TestResponseStructure:
    def _call(self, items=None, qs=None):
        with patch('boto3.resource') as mock_resource:
            mod = _load_module()
            mod.dynamodb = mock_resource.return_value
            mod.dynamodb.Table.return_value = _mock_table(items or _SAMPLE_ITEMS)
            result = mod.lambda_handler(_make_event(qs=qs), _make_context())
        return result, json.loads(result['body'])

    def test_200_returned_with_items(self):
        result, _ = self._call()
        assert result['statusCode'] == 200

    def test_body_has_required_keys(self):
        _, body = self._call()
        for key in ('customer_id', 'framework', 'days', 'history', 'summary'):
            assert key in body, f"Missing key: {key}"
        assert 'framework_badge' in body
        assert 'control_violations' in body

    def test_history_items_have_expected_fields(self):
        _, body = self._call()
        assert len(body['history']) > 0
        item = body['history'][0]
        for field in ('date', 'framework', 'score', 'controls_total',
                      'controls_passing', 'controls_failing',
                      'critical_violations', 'high_violations',
                      'medium_violations', 'low_violations', 'calculated_at'):
            assert field in item, f"History item missing field: {field}"

    def test_decimal_values_serialised_as_float(self):
        _, body = self._call()
        score = body['history'][0]['score']
        assert isinstance(score, float)
        assert score == 95.5

    def test_framework_filter_reflected_in_response(self):
        _, body = self._call(qs={'framework': 'HIPAA'})
        assert body['framework'] == 'HIPAA'

    def test_empty_history_returns_empty_list(self):
        _, body = self._call(items=[])
        assert body['history'] == []
        assert body['summary']['latest_score'] is None

    def test_default_days_is_90(self):
        _, body = self._call()
        assert body['days'] == 90

    def test_custom_days_reflected(self):
        _, body = self._call(qs={'days': '30'})
        assert body['days'] == 30


# ---------------------------------------------------------------------------
# Tests: summary calculation
# ---------------------------------------------------------------------------


class TestSummaryCalculation:
    def _call_summary(self, items):
        with patch('boto3.resource') as mock_resource:
            mod = _load_module()
            mod.dynamodb = mock_resource.return_value
            mod.dynamodb.Table.return_value = _mock_table(items)
            result = mod.lambda_handler(_make_event(), _make_context())
        return json.loads(result['body'])['summary']

    def test_latest_score_is_first_items_score(self):
        summary = self._call_summary(_SAMPLE_ITEMS)
        assert summary['latest_score'] == pytest.approx(95.5, abs=0.01)

    def test_min_max_avg_computed_correctly(self):
        summary = self._call_summary(_SAMPLE_ITEMS)
        # Scores: 95.5 and 90.0
        assert summary['min_score'] == pytest.approx(90.0, abs=0.01)
        assert summary['max_score'] == pytest.approx(95.5, abs=0.01)
        assert summary['avg_score'] == pytest.approx(92.75, abs=0.01)

    def test_single_item_summary(self):
        items = [_SAMPLE_ITEMS[0]]
        summary = self._call_summary(items)
        assert summary['latest_score'] == pytest.approx(95.5, abs=0.01)
        assert summary['min_score'] == pytest.approx(95.5, abs=0.01)
        assert summary['max_score'] == pytest.approx(95.5, abs=0.01)

    def test_trend_values_are_valid(self):
        summary = self._call_summary(_SAMPLE_ITEMS)
        assert summary['trend'] in ('improving', 'stable', 'degrading')

    def test_empty_items_summary_has_null_scores(self):
        summary = self._call_summary([])
        assert summary['latest_score'] is None
        assert summary['min_score'] is None
        assert summary['max_score'] is None
        assert summary['avg_score'] is None
        assert summary['trend'] == 'stable'


# ---------------------------------------------------------------------------
# Tests: error handling
# ---------------------------------------------------------------------------


class TestErrorHandling:
    def test_dynamodb_client_error_returns_503(self):
        from botocore.exceptions import ClientError

        with patch('boto3.resource') as mock_resource:
            mod = _load_module()
            mock_table = MagicMock()
            mock_table.query.side_effect = ClientError(
                {'Error': {'Code': 'ProvisionedThroughputExceededException',
                           'Message': 'Rate exceeded'}},
                'Query',
            )
            mod.dynamodb = mock_resource.return_value
            mod.dynamodb.Table.return_value = mock_table

            result = mod.lambda_handler(_make_event(), _make_context())

        assert result['statusCode'] == 503
        body = json.loads(result['body'])
        assert 'unavailable' in body['error'].lower()

    def test_null_query_string_parameters(self):
        """queryStringParameters=None (omitted from event) is handled gracefully."""
        with patch('boto3.resource') as mock_resource:
            mod = _load_module()
            mod.dynamodb = mock_resource.return_value
            mod.dynamodb.Table.return_value = _mock_table(_SAMPLE_ITEMS)

            event = {
                'httpMethod': 'GET',
                'queryStringParameters': None,
                'requestContext': {'authorizer': {'customer_id': 'cust-001'}},
                'headers': {},
            }
            result = mod.lambda_handler(event, _make_context())

        assert result['statusCode'] == 200


class TestControlBreakdown:
    def test_control_breakdown_is_returned(self):
        with patch('boto3.resource') as mock_resource:
            mod = _load_module()
            score_table = _mock_table(_SAMPLE_ITEMS)
            control_table = _mock_table(_SAMPLE_CONTROL_ITEMS)

            def table_selector(name):
                if name == mod.CONTROL_VIOLATIONS_TABLE:
                    return control_table
                return score_table

            mod.dynamodb = mock_resource.return_value
            mod.dynamodb.Table.side_effect = table_selector
            result = mod.lambda_handler(_make_event(), _make_context())

        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert len(body['control_violations']) == 1
        assert body['control_violations'][0]['control_id'] == 'HIPAA-164.312(b)'
