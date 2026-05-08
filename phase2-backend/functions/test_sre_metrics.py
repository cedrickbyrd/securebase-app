"""
Unit tests for sre_metrics Lambda function.
Phase 5.3: SRE/Operations Dashboard Backend

Coverage targets:
- All 9 endpoints return expected shape on happy path
- CloudWatch errors return partial data (not 500)
- CORS headers present on all responses
- /sre/health returns 'degraded' when any subsystem has errors
- Invalid path returns 404
- OPTIONS preflight returns 200
"""

import json
import time
import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, date

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

import sre_metrics


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_event(path, method='GET', query=None):
    return {
        'httpMethod': method,
        'path': path,
        'queryStringParameters': query or {},
        'headers': {'Authorization': 'Bearer test_token'},
    }


def _assert_cors(test_case, response):
    """Verify CORS headers are present."""
    headers = response.get('headers', {})
    test_case.assertIn('Access-Control-Allow-Origin', headers)
    test_case.assertIn('Access-Control-Allow-Methods', headers)
    test_case.assertIn('Access-Control-Allow-Headers', headers)


# ---------------------------------------------------------------------------
# Test class
# ---------------------------------------------------------------------------

class TestSREMetrics(unittest.TestCase):

    def setUp(self):
        self.ctx = Mock()
        # Patch module-level boto3 clients so we never hit real AWS
        patcher_cw = patch.object(sre_metrics, 'cloudwatch', new_callable=MagicMock)
        patcher_logs = patch.object(sre_metrics, 'logs_client', new_callable=MagicMock)
        patcher_ce = patch.object(sre_metrics, 'ce', new_callable=MagicMock)
        patcher_ssm = patch.object(sre_metrics, 'ssm', new_callable=MagicMock)
        patcher_ddb = patch.object(sre_metrics, 'dynamodb', new_callable=MagicMock)

        self.mock_cw = patcher_cw.start()
        self.mock_logs = patcher_logs.start()
        self.mock_ce = patcher_ce.start()
        self.mock_ssm = patcher_ssm.start()
        self.mock_ddb = patcher_ddb.start()

        self.addCleanup(patcher_cw.stop)
        self.addCleanup(patcher_logs.stop)
        self.addCleanup(patcher_ce.stop)
        self.addCleanup(patcher_ssm.stop)
        self.addCleanup(patcher_ddb.stop)

        # Default CloudWatch response — datapoints including both standard and percentile stats
        self.mock_cw.get_metric_statistics.return_value = {
            'Datapoints': [
                {'Timestamp': datetime(2026, 1, 1, 0, 0), 'Average': 12.5, 'Sum': 50.0,
                 'Maximum': 20.0, 'ExtendedStatistics': {'p95': 0.02}},
            ]
        }
        self.mock_cw.get_metric_data.return_value = {
            'MetricDataResults': [
                {'Id': 'q1', 'Values': [42.0]},
            ]
        }

    # -----------------------------------------------------------------------
    # Infrastructure
    # -----------------------------------------------------------------------

    def test_infrastructure_happy_path(self):
        event = _make_event('/sre/infrastructure')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        _assert_cors(self, resp)
        body = json.loads(resp['body'])
        self.assertIn('lambda', body)
        self.assertIn('ecs', body)
        self.assertIn('timestamp', body)

    def test_infrastructure_cloudwatch_error_returns_partial(self):
        self.mock_cw.get_metric_statistics.side_effect = Exception('CW error')
        event = _make_event('/sre/infrastructure')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        # Should still return 200 with None values (not 500)
        self.assertEqual(resp['statusCode'], 200)
        body = json.loads(resp['body'])
        self.assertIn('lambda', body)

    # -----------------------------------------------------------------------
    # Deployments
    # -----------------------------------------------------------------------

    def test_deployments_happy_path(self):
        mock_table = MagicMock()
        mock_table.query.return_value = {
            'Items': [
                {'metric_type': 'deployment', 'timestamp': '2026-01-10T10:00:00Z',
                 'status': 'success', 'duration_seconds': 120},
                {'metric_type': 'deployment', 'timestamp': '2026-01-09T10:00:00Z',
                 'status': 'failure', 'duration_seconds': 60},
            ]
        }
        self.mock_ddb.Table.return_value = mock_table

        event = _make_event('/sre/deployments')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        _assert_cors(self, resp)
        body = json.loads(resp['body'])
        self.assertIn('deployments', body)
        self.assertIn('summary', body)
        self.assertEqual(body['summary']['total'], 2)
        self.assertEqual(body['summary']['success_rate_pct'], 50.0)

    def test_deployments_dynamodb_error_returns_partial(self):
        mock_table = MagicMock()
        mock_table.query.side_effect = Exception('DDB error')
        self.mock_ddb.Table.return_value = mock_table

        event = _make_event('/sre/deployments')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        body = json.loads(resp['body'])
        self.assertIn('errors', body)
        self.assertTrue(len(body['errors']) > 0)

    # -----------------------------------------------------------------------
    # Scaling
    # -----------------------------------------------------------------------

    def test_scaling_happy_path(self):
        event = _make_event('/sre/scaling')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        _assert_cors(self, resp)
        body = json.loads(resp['body'])
        self.assertIn('lambda', body)
        self.assertIn('api_gateway', body)

    # -----------------------------------------------------------------------
    # Database
    # -----------------------------------------------------------------------

    def test_database_happy_path(self):
        event = _make_event('/sre/database')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        _assert_cors(self, resp)
        body = json.loads(resp['body'])
        self.assertIn('aurora', body)
        self.assertIn('dynamodb', body)

    def test_database_cloudwatch_error_returns_partial(self):
        self.mock_cw.get_metric_statistics.side_effect = Exception('CW unavailable')
        event = _make_event('/sre/database')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        body = json.loads(resp['body'])
        self.assertIsNone(body['aurora']['read_latency_p95_ms'])

    # -----------------------------------------------------------------------
    # Cache
    # -----------------------------------------------------------------------

    def test_cache_happy_path(self):
        # CacheHits / CacheMisses
        def _cw_side(Namespace, MetricName, **kwargs):
            if MetricName == 'CacheHits':
                return {'Datapoints': [{'Timestamp': datetime.utcnow(), 'Sum': 900.0}]}
            if MetricName == 'CacheMisses':
                return {'Datapoints': [{'Timestamp': datetime.utcnow(), 'Sum': 100.0}]}
            return {'Datapoints': [{'Timestamp': datetime.utcnow(), 'Average': 5.0,
                                    'Sum': 0.0, 'Maximum': 10.0}]}
        self.mock_cw.get_metric_statistics.side_effect = _cw_side

        event = _make_event('/sre/cache')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        _assert_cors(self, resp)
        body = json.loads(resp['body'])
        self.assertIn('redis', body)
        self.assertAlmostEqual(body['redis']['hit_rate_pct'], 90.0)

    def test_cache_cloudwatch_error_returns_partial(self):
        self.mock_cw.get_metric_statistics.side_effect = Exception('timeout')
        event = _make_event('/sre/cache')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        body = json.loads(resp['body'])
        self.assertIsNone(body['redis']['hit_rate_pct'])

    # -----------------------------------------------------------------------
    # Errors
    # -----------------------------------------------------------------------

    def test_errors_happy_path(self):
        self.mock_logs.start_query.return_value = {'queryId': 'q-test'}
        self.mock_logs.get_query_results.return_value = {
            'status': 'Complete',
            'results': [
                [{'field': '@timestamp', 'value': '2026-01-10 10:00:00.000'},
                 {'field': '@message', 'value': 'ERROR something went wrong'}],
            ]
        }
        event = _make_event('/sre/errors')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        _assert_cors(self, resp)
        body = json.loads(resp['body'])
        self.assertIn('lambda', body)
        self.assertIn('api_gateway', body)
        self.assertIn('recent_log_errors', body)

    def test_errors_logs_insights_failure_returns_partial(self):
        self.mock_logs.start_query.side_effect = Exception('Logs Insights error')
        event = _make_event('/sre/errors')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        body = json.loads(resp['body'])
        self.assertIn('errors', body)

    # -----------------------------------------------------------------------
    # Lambda metrics
    # -----------------------------------------------------------------------

    @patch('boto3.client')
    def test_lambda_metrics_happy_path(self, mock_boto_client):
        mock_lambda = MagicMock()
        mock_lambda.get_paginator.return_value.paginate.return_value = [
            {'Functions': [
                {'FunctionName': 'securebase-dev-auth-v2'},
                {'FunctionName': 'securebase-dev-billing'},
            ]}
        ]
        mock_lambda.get_function_configuration.return_value = {'DeadLetterConfig': {}}
        mock_boto_client.return_value = mock_lambda

        event = _make_event('/sre/lambda')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        _assert_cors(self, resp)
        body = json.loads(resp['body'])
        self.assertIn('functions', body)
        self.assertIn('aggregate', body)

    @patch('boto3.client')
    def test_lambda_metrics_list_error_returns_partial(self, mock_boto_client):
        mock_lambda = MagicMock()
        mock_lambda.get_paginator.side_effect = Exception('ListFunctions error')
        mock_boto_client.return_value = mock_lambda

        event = _make_event('/sre/lambda')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        body = json.loads(resp['body'])
        self.assertIn('errors', body)

    # -----------------------------------------------------------------------
    # Costs
    # -----------------------------------------------------------------------

    def test_costs_happy_path(self):
        self.mock_ce.get_cost_and_usage.return_value = {
            'ResultsByTime': [
                {
                    'TimePeriod': {'Start': '2026-04-01', 'End': '2026-04-02'},
                    'Groups': [
                        {'Keys': ['AWS Lambda'], 'Metrics': {'BlendedCost': {'Amount': '12.50', 'Unit': 'USD'}}},
                        {'Keys': ['Amazon DynamoDB'], 'Metrics': {'BlendedCost': {'Amount': '5.00', 'Unit': 'USD'}}},
                    ],
                },
            ]
        }
        event = _make_event('/sre/costs')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        _assert_cors(self, resp)
        body = json.loads(resp['body'])
        self.assertIn('by_service', body)
        self.assertIn('total_cost_usd', body)
        self.assertAlmostEqual(body['total_cost_usd'], 17.5, places=1)

    def test_costs_ce_error_returns_partial(self):
        self.mock_ce.get_cost_and_usage.side_effect = Exception('CE error')
        event = _make_event('/sre/costs')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        body = json.loads(resp['body'])
        self.assertIn('errors', body)
        self.assertEqual(body['total_cost_usd'], 0.0)

    # -----------------------------------------------------------------------
    # Health
    # -----------------------------------------------------------------------

    def test_health_all_healthy(self):
        # Low metric values → all healthy
        self.mock_cw.get_metric_statistics.return_value = {
            'Datapoints': [{'Timestamp': datetime.utcnow(), 'Sum': 0.0, 'Average': 0.001,
                            'Maximum': 1.0}]
        }
        event = _make_event('/sre/health')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        _assert_cors(self, resp)
        body = json.loads(resp['body'])
        self.assertIn('overall_status', body)
        self.assertIn('subsystems', body)

    def test_health_degraded_when_subsystem_errors(self):
        """Lambda error rate 8% → degraded."""
        call_count = [0]

        def _cw_side(Namespace, MetricName, **kwargs):
            call_count[0] += 1
            if Namespace == 'AWS/Lambda' and MetricName == 'Errors':
                return {'Datapoints': [{'Timestamp': datetime.utcnow(), 'Sum': 80.0}]}
            if Namespace == 'AWS/Lambda' and MetricName == 'Invocations':
                return {'Datapoints': [{'Timestamp': datetime.utcnow(), 'Sum': 1000.0}]}
            return {'Datapoints': [{'Timestamp': datetime.utcnow(), 'Sum': 0.0,
                                    'Average': 0.001, 'Maximum': 1.0}]}

        self.mock_cw.get_metric_statistics.side_effect = _cw_side

        event = _make_event('/sre/health')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        body = json.loads(resp['body'])
        self.assertIn(body['overall_status'], ['degraded', 'critical'])
        self.assertIn(body['subsystems']['lambda'], ['degraded', 'critical'])

    def test_health_critical_when_high_error_rate(self):
        """Lambda error rate >10% → critical."""
        def _cw_side(Namespace, MetricName, **kwargs):
            if Namespace == 'AWS/Lambda' and MetricName == 'Errors':
                return {'Datapoints': [{'Timestamp': datetime.utcnow(), 'Sum': 200.0}]}
            if Namespace == 'AWS/Lambda' and MetricName == 'Invocations':
                return {'Datapoints': [{'Timestamp': datetime.utcnow(), 'Sum': 1000.0}]}
            return {'Datapoints': []}

        self.mock_cw.get_metric_statistics.side_effect = _cw_side

        event = _make_event('/sre/health')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        body = json.loads(resp['body'])
        self.assertEqual(body['overall_status'], 'critical')
        self.assertEqual(body['subsystems']['lambda'], 'critical')

    # -----------------------------------------------------------------------
    # Routing edge cases
    # -----------------------------------------------------------------------

    def test_invalid_path_returns_404(self):
        event = _make_event('/sre/nonexistent')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 404)
        _assert_cors(self, resp)

    def test_options_preflight_returns_200(self):
        event = _make_event('/sre/health', method='OPTIONS')
        resp = sre_metrics.lambda_handler(event, self.ctx)
        self.assertEqual(resp['statusCode'], 200)
        _assert_cors(self, resp)

    def test_cors_headers_on_all_endpoints(self):
        endpoints = [
            '/sre/infrastructure',
            '/sre/deployments',
            '/sre/scaling',
            '/sre/database',
            '/sre/cache',
            '/sre/errors',
            '/sre/costs',
            '/sre/health',
        ]
        # Stub DynamoDB for deployments
        mock_table = MagicMock()
        mock_table.query.return_value = {'Items': []}
        self.mock_ddb.Table.return_value = mock_table
        # Stub Logs Insights
        self.mock_logs.start_query.return_value = {'queryId': 'q'}
        self.mock_logs.get_query_results.return_value = {'status': 'Complete', 'results': []}
        # Stub CE
        self.mock_ce.get_cost_and_usage.return_value = {'ResultsByTime': []}

        with patch('boto3.client') as mock_boto:
            mock_lambda = MagicMock()
            mock_lambda.get_paginator.return_value.paginate.return_value = [{'Functions': []}]
            mock_boto.return_value = mock_lambda

            for path in endpoints:
                with self.subTest(path=path):
                    event = _make_event(path)
                    resp = sre_metrics.lambda_handler(event, self.ctx)
                    _assert_cors(self, resp)

    # -----------------------------------------------------------------------
    # DecimalEncoder
    # -----------------------------------------------------------------------

    def test_decimal_encoder(self):
        from decimal import Decimal
        encoder = sre_metrics.DecimalEncoder()
        self.assertEqual(encoder.default(Decimal('3.14')), 3.14)

    # -----------------------------------------------------------------------
    # Structured logging emission
    # -----------------------------------------------------------------------

    def test_structured_log_emitted(self):
        """Verify lambda_handler emits a structured log dict on every request."""
        with patch.object(sre_metrics.logger, 'info') as mock_log:
            mock_table = MagicMock()
            mock_table.query.return_value = {'Items': []}
            self.mock_ddb.Table.return_value = mock_table
            event = _make_event('/sre/deployments')
            sre_metrics.lambda_handler(event, self.ctx)
            # First call should be the request log
            first_call_arg = mock_log.call_args_list[0][0][0]
            log_data = json.loads(first_call_arg)
            self.assertEqual(log_data['event'], 'sre_metrics_request')
            self.assertIn('path', log_data)
            self.assertIn('timestamp', log_data)


if __name__ == '__main__':
    unittest.main()
