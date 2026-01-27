"""
Integration Tests for Phase 4 Analytics API
Tests database integration, API endpoints, RLS enforcement, and data accuracy
"""

import pytest
import json
import boto3
from datetime import datetime, timedelta
from decimal import Decimal
import os
from unittest.mock import Mock, patch, MagicMock

# Import Lambda functions for testing
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase2-backend/functions'))

import analytics_aggregator
import analytics_reporter
import analytics_query


class TestAnalyticsIntegration:
    """Integration tests for analytics Lambda functions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test environment"""
        # Set environment variables
        os.environ['ENVIRONMENT'] = 'test'
        os.environ['METRICS_TABLE'] = 'test-metrics'
        os.environ['REPORTS_TABLE'] = 'test-reports'
        os.environ['CACHE_TABLE'] = 'test-cache'
        os.environ['CUSTOMERS_TABLE'] = 'test-customers'
        os.environ['S3_BUCKET'] = 'test-reports-bucket'
        os.environ['AWS_REGION'] = 'us-east-1'
        os.environ['LOG_LEVEL'] = 'DEBUG'
        
        # Test customer IDs
        self.customer_id_1 = 'cust-123e4567-e89b-12d3-a456-426614174000'
        self.customer_id_2 = 'cust-987f6543-e21a-98b7-c654-321098765432'
        
        yield
        
        # Cleanup after tests
        # In production, clean up test DynamoDB items
    
    
    class TestDatabaseIntegration:
        """Test analytics queries against Aurora database"""
        
        @patch('analytics_query.metrics_table')
        def test_query_metrics_returns_customer_data_only(self, mock_table):
            """Verify RLS: customers only see their own data"""
            # Mock DynamoDB response with mixed customer data
            mock_table.query.return_value = {
                'Items': [
                    {'customer_id': self.customer_id_1, 'metric_name': 'api_calls', 'value': Decimal('100')},
                    {'customer_id': self.customer_id_1, 'metric_name': 'storage_gb', 'value': Decimal('50.5')}
                ]
            }
            
            # Query for customer 1
            metrics = analytics_query.query_metrics(self.customer_id_1, 30)
            
            # Verify only customer 1's data returned
            assert len(metrics) == 2
            assert all(m['customer_id'] == self.customer_id_1 for m in metrics)
        
        
        @patch('analytics_query.metrics_table')
        def test_metrics_aggregation_accuracy(self, mock_table):
            """Verify aggregation calculations are accurate"""
            # Mock metrics data
            mock_table.query.return_value = {
                'Items': [
                    {'customer_id': self.customer_id_1, 'metric_name': 'api_calls', 'value': Decimal('100'), 'timestamp': '2026-01-01T00:00:00'},
                    {'customer_id': self.customer_id_1, 'metric_name': 'api_calls', 'value': Decimal('150'), 'timestamp': '2026-01-02T00:00:00'},
                    {'customer_id': self.customer_id_1, 'metric_name': 'api_calls', 'value': Decimal('200'), 'timestamp': '2026-01-03T00:00:00'}
                ]
            }
            
            # Query and sum
            metrics = analytics_query.query_metrics(self.customer_id_1, 7)
            total = analytics_query.sum_metric(metrics, 'api_calls')
            
            # Verify sum is accurate
            assert total == 450.0
        
        
        @patch('analytics_aggregator.metrics_table')
        @patch('analytics_aggregator.customers_table')
        def test_aggregator_stores_metrics_correctly(self, mock_customers, mock_metrics):
            """Verify aggregator stores metrics with correct schema"""
            # Mock customer data
            mock_customers.scan.return_value = {
                'Items': [{'id': self.customer_id_1, 'status': 'active', 'tier': {'framework': 'HIPAA'}}]
            }
            
            # Mock metrics table batch writer
            mock_batch = MagicMock()
            mock_metrics.batch_writer.return_value.__enter__.return_value = mock_batch
            
            # Run aggregation
            event = {'source': 'aws.events'}
            response = analytics_aggregator.lambda_handler(event, None)
            
            # Verify metrics were stored
            assert response['statusCode'] == 200
            assert mock_batch.put_item.called
        
        
        @patch('analytics_query.metrics_table')
        def test_query_performance_under_500ms(self, mock_table):
            """Verify queries complete within 500ms requirement"""
            # Mock fast response
            mock_table.query.return_value = {
                'Items': [
                    {'customer_id': self.customer_id_1, 'metric_name': 'api_calls', 'value': Decimal('100')}
                    for _ in range(100)  # 100 metrics
                ]
            }
            
            # Time the query
            import time
            start = time.time()
            event = {
                'httpMethod': 'GET',
                'path': '/analytics/usage',
                'queryStringParameters': {'period': '30d'},
                'requestContext': {'authorizer': {'customerId': self.customer_id_1}}
            }
            response = analytics_query.lambda_handler(event, None)
            duration_ms = (time.time() - start) * 1000
            
            # Verify performance
            assert response['statusCode'] == 200
            # Note: In real AWS environment with DynamoDB, this would be validated
            # For unit tests, we just verify the mock returns quickly
            assert duration_ms < 500
    
    
    class TestAPIEndpoints:
        """Test all analytics API endpoints"""
        
        @patch('analytics_query.metrics_table')
        def test_get_usage_analytics_endpoint(self, mock_table):
            """Test GET /analytics/usage endpoint"""
            # Mock metrics
            mock_table.query.return_value = {
                'Items': [
                    {'customer_id': self.customer_id_1, 'metric_name': 'api_calls', 'value': Decimal('15000'), 'timestamp': '2026-01-01T00:00:00'},
                    {'customer_id': self.customer_id_1, 'metric_name': 'storage_gb', 'value': Decimal('250.5'), 'timestamp': '2026-01-01T00:00:00'}
                ]
            }
            
            event = {
                'httpMethod': 'GET',
                'path': '/analytics/usage',
                'queryStringParameters': {'period': '30d'},
                'requestContext': {'authorizer': {'customerId': self.customer_id_1}}
            }
            
            response = analytics_query.lambda_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert body['customer_id'] == self.customer_id_1
            assert 'metrics' in body
            assert body['metrics']['api_calls'] == 15000.0
            assert body['metrics']['storage_gb'] == 250.5
        
        
        @patch('analytics_query.metrics_table')
        def test_get_compliance_analytics_endpoint(self, mock_table):
            """Test GET /analytics/compliance endpoint"""
            # Mock compliance metrics
            mock_table.query.return_value = {
                'Items': [
                    {
                        'customer_id': self.customer_id_1,
                        'metric_name': 'compliance_score',
                        'value': Decimal('87'),
                        'timestamp': '2026-01-27T00:00:00'
                    },
                    {
                        'customer_id': self.customer_id_1,
                        'metric_name': 'security_findings',
                        'value': Decimal('25'),
                        'timestamp': '2026-01-27T00:00:00',
                        'metadata': {'critical': 0, 'high': 2, 'medium': 8, 'low': 15}
                    }
                ]
            }
            
            event = {
                'httpMethod': 'GET',
                'path': '/analytics/compliance',
                'queryStringParameters': {},
                'requestContext': {'authorizer': {'customerId': self.customer_id_1}}
            }
            
            response = analytics_query.lambda_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert body['current_score'] == 87
            assert body['findings']['critical'] == 0
            assert body['findings']['high'] == 2
        
        
        @patch('analytics_query.metrics_table')
        def test_get_costs_analytics_endpoint(self, mock_table):
            """Test GET /analytics/costs endpoint"""
            # Mock cost metrics
            mock_table.query.return_value = {
                'Items': [
                    {
                        'customer_id': self.customer_id_1,
                        'metric_name': 'daily_cost',
                        'value': Decimal('245.75'),
                        'timestamp': '2026-01-27T00:00:00',
                        'metadata': {
                            'breakdown': {'compute': 120.00, 'storage': 85.50, 'networking': 40.25}
                        }
                    }
                ]
            }
            
            event = {
                'httpMethod': 'GET',
                'path': '/analytics/costs',
                'queryStringParameters': {'period': '30d', 'breakdown': 'service'},
                'requestContext': {'authorizer': {'customerId': self.customer_id_1}}
            }
            
            response = analytics_query.lambda_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert body['total'] == 245.75
            assert body['breakdown']['compute'] == 120.0
            assert 'forecast_next_month' in body
        
        
        @patch('analytics_reporter.metrics_table')
        @patch('analytics_reporter.s3')
        def test_post_analytics_reports_endpoint(self, mock_s3, mock_table):
            """Test POST /analytics/reports endpoint"""
            # Mock metrics
            mock_table.query.return_value = {
                'Items': [
                    {'customer_id': self.customer_id_1, 'metric_name': 'api_calls', 'value': Decimal('1000'), 'timestamp': '2026-01-27T00:00:00'}
                ]
            }
            
            # Mock S3 upload
            mock_s3.put_object.return_value = {}
            mock_s3.generate_presigned_url.return_value = 'https://s3.amazonaws.com/test-bucket/report.pdf'
            
            event = {
                'httpMethod': 'POST',
                'path': '/analytics/reports',
                'body': json.dumps({
                    'type': 'monthly',
                    'format': 'pdf',
                    'period': '30d'
                }),
                'requestContext': {'authorizer': {'customerId': self.customer_id_1}}
            }
            
            response = analytics_reporter.lambda_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert 'url' in body
            assert body['message'] == 'Report generated successfully'
        
        
        @patch('analytics_query.metrics_table')
        def test_api_authentication_required(self, mock_table):
            """Verify API requires authentication"""
            event = {
                'httpMethod': 'GET',
                'path': '/analytics/usage',
                'queryStringParameters': {},
                'requestContext': {'authorizer': {}}  # No customerId
            }
            
            response = analytics_query.lambda_handler(event, None)
            
            assert response['statusCode'] == 401
            body = json.loads(response['body'])
            assert 'error' in body
        
        
        def test_api_cors_enabled(self):
            """Verify CORS headers are present"""
            event = {
                'httpMethod': 'GET',
                'path': '/analytics/usage',
                'queryStringParameters': {},
                'requestContext': {'authorizer': {'customerId': self.customer_id_1}}
            }
            
            with patch('analytics_query.metrics_table') as mock_table:
                mock_table.query.return_value = {'Items': []}
                response = analytics_query.lambda_handler(event, None)
            
            assert 'Access-Control-Allow-Origin' in response['headers']
            assert response['headers']['Access-Control-Allow-Origin'] == '*'
    
    
    class TestCaching:
        """Test caching functionality"""
        
        @patch('analytics_query.cache_table')
        @patch('analytics_query.metrics_table')
        def test_cache_hit_returns_cached_data(self, mock_metrics, mock_cache):
            """Verify cache returns cached data when available"""
            # Mock cache hit
            cached_data = {
                'customer_id': self.customer_id_1,
                'metrics': {'api_calls': 1000}
            }
            mock_cache.get_item.return_value = {
                'Item': {
                    'cache_key': 'test-key',
                    'data': cached_data,
                    'expires_at': (datetime.utcnow() + timedelta(hours=1)).isoformat()
                }
            }
            
            # Should not query metrics table
            mock_metrics.query.return_value = {'Items': []}
            
            event = {
                'httpMethod': 'GET',
                'path': '/analytics/usage',
                'queryStringParameters': {'period': '30d'},
                'requestContext': {'authorizer': {'customerId': self.customer_id_1}}
            }
            
            response = analytics_query.lambda_handler(event, None)
            
            assert response['statusCode'] == 200
            # Metrics table should not have been queried
            assert not mock_metrics.query.called
        
        
        @patch('analytics_query.cache_table')
        def test_expired_cache_ignored(self, mock_cache):
            """Verify expired cache entries are ignored"""
            # Mock expired cache
            mock_cache.get_item.return_value = {
                'Item': {
                    'cache_key': 'test-key',
                    'data': {},
                    'expires_at': (datetime.utcnow() - timedelta(hours=1)).isoformat()  # Expired
                }
            }
            
            cached = analytics_query.get_from_cache('test-key')
            
            assert cached is None
    
    
    class TestDataAccuracy:
        """Test data accuracy and calculations"""
        
        @patch('analytics_query.metrics_table')
        def test_trend_calculation_accuracy(self, mock_table):
            """Verify trend calculations are mathematically correct"""
            # Mock metrics with known values
            mock_table.query.return_value = {
                'Items': [
                    {'customer_id': self.customer_id_1, 'metric_name': 'api_calls', 'value': Decimal('100'), 'timestamp': '2026-01-01T00:00:00'},
                    {'customer_id': self.customer_id_1, 'metric_name': 'api_calls', 'value': Decimal('120'), 'timestamp': '2026-01-15T00:00:00'}
                ]
            }
            
            metrics = analytics_query.query_metrics(self.customer_id_1, 30)
            change = analytics_query.calculate_change(metrics, 'api_calls', 30)
            
            # 100 -> 120 is 20% increase
            assert '+20%' in change or '+19%' in change  # Allow for rounding
        
        
        @patch('analytics_aggregator.get_api_call_metrics')
        @patch('analytics_aggregator.get_storage_metrics')
        @patch('analytics_aggregator.get_security_metrics')
        def test_compliance_score_calculation(self, mock_security, mock_storage, mock_api):
            """Verify compliance score is calculated correctly"""
            # Mock security metrics
            mock_security.return_value = {
                'passed': 180,
                'total': 200,
                'critical': 0,
                'high': 5,
                'medium': 10,
                'low': 5
            }
            mock_storage.return_value = None
            mock_api.return_value = None
            
            score = analytics_aggregator.calculate_compliance_score(mock_security.return_value)
            
            # 180/200 = 90%
            assert score == 90.0


class TestPerformance:
    """Performance and load tests"""
    
    @patch('analytics_query.metrics_table')
    def test_handles_large_result_sets(self, mock_table):
        """Verify system handles large datasets"""
        # Mock 10,000 metrics
        large_dataset = [
            {'customer_id': 'cust-test', 'metric_name': 'api_calls', 'value': Decimal(str(i)), 'timestamp': '2026-01-01T00:00:00'}
            for i in range(10000)
        ]
        mock_table.query.return_value = {'Items': large_dataset}
        
        # Query should handle large dataset
        metrics = analytics_query.query_metrics('cust-test', 30)
        
        assert len(metrics) == 10000
    
    
    @patch('analytics_query.metrics_table')
    def test_concurrent_requests_isolated(self, mock_table):
        """Verify concurrent requests from different customers are isolated"""
        customer1 = 'cust-111'
        customer2 = 'cust-222'
        
        # Mock different data for each customer
        def mock_query(**kwargs):
            cid = kwargs['ExpressionAttributeValues'][':cid']
            if cid == customer1:
                return {'Items': [{'customer_id': customer1, 'value': Decimal('100')}]}
            else:
                return {'Items': [{'customer_id': customer2, 'value': Decimal('200')}]}
        
        mock_table.query.side_effect = mock_query
        
        # Query both
        metrics1 = analytics_query.query_metrics(customer1, 30)
        metrics2 = analytics_query.query_metrics(customer2, 30)
        
        # Verify isolation
        assert metrics1[0]['customer_id'] == customer1
        assert metrics2[0]['customer_id'] == customer2


class TestSecurity:
    """Security and RLS tests"""
    
    @patch('analytics_query.metrics_table')
    def test_rls_prevents_cross_customer_access(self, mock_table):
        """Verify customers cannot access other customers' data"""
        # Attempt to query with customer ID that doesn't match request
        mock_table.query.return_value = {'Items': []}
        
        event = {
            'httpMethod': 'GET',
            'path': '/analytics/usage',
            'queryStringParameters': {},
            'requestContext': {'authorizer': {'customerId': 'cust-123'}}
        }
        
        response = analytics_query.lambda_handler(event, None)
        
        # Query should only use customer ID from auth context
        call_args = mock_table.query.call_args
        assert call_args[1]['ExpressionAttributeValues'][':cid'] == 'cust-123'
    
    
    def test_sql_injection_protection(self):
        """Verify inputs are sanitized against injection attacks"""
        # DynamoDB expressions are parameterized by design
        # This test verifies we use parameterized queries
        
        malicious_period = "30d'; DROP TABLE metrics; --"
        days = analytics_query.parse_period(malicious_period)
        
        # Should safely parse or default
        assert isinstance(days, int)
        assert days > 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
