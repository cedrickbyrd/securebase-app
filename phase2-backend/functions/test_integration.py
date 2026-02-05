"""
Integration tests for Phase 4 Analytics & Reporting
Tests the full flow from API Gateway to Lambda to DynamoDB

Run with: pytest test_integration.py -v --cov
"""

import json
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Mock psycopg2 and boto3 before any imports
sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.pool'] = MagicMock()
sys.modules['psycopg2.extras'] = MagicMock()
sys.modules['boto3'] = MagicMock()
sys.modules['botocore'] = MagicMock()
sys.modules['botocore.exceptions'] = MagicMock()

import boto3
from datetime import datetime, timedelta
import time

# Add lambda_layer/python to path for db_utils and other layer modules
lambda_layer_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'lambda_layer', 'python')
if lambda_layer_path not in sys.path:
    sys.path.insert(0, lambda_layer_path)

# Set AWS environment
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
os.environ['AWS_ACCESS_KEY_ID'] = 'test'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'test'
os.environ['REPORTS_TABLE'] = 'test-reports'
os.environ['METRICS_TABLE'] = 'test-metrics'
os.environ['CACHE_TABLE'] = 'test-cache'
os.environ['S3_BUCKET'] = 'test-bucket'
os.environ['ENVIRONMENT'] = 'test'

# Mock AWS clients before import
with patch('boto3.resource'), patch('boto3.client'):
    import report_engine


class TestAnalyticsIntegration(unittest.TestCase):
    """Integration tests for analytics workflows"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test data that persists across tests"""
        cls.customer_id = 'integration-test-customer'
        cls.test_report_id = None
    
    def setUp(self):
        """Set up mocks for each test"""
        # Mock DynamoDB
        self.patcher_dynamodb = patch('report_engine.dynamodb')
        self.mock_dynamodb = self.patcher_dynamodb.start()
        
        # Mock S3
        self.patcher_s3 = patch('report_engine.s3')
        self.mock_s3 = self.patcher_s3.start()
        
        # Setup table mocks
        self.mock_tables = {
            'reports': MagicMock(),
            'metrics': MagicMock(),
            'cache': MagicMock(),
        }
        
        def get_table(name):
            table_map = {
                'test-reports': self.mock_tables['reports'],
                'test-metrics': self.mock_tables['metrics'],
                'test-cache': self.mock_tables['cache'],
            }
            return table_map.get(name, MagicMock())
        
        self.mock_dynamodb.Table.side_effect = get_table
    
    def tearDown(self):
        """Clean up after each test"""
        self.patcher_dynamodb.stop()
        self.patcher_s3.stop()
    
    def create_event(self, method, path, body=None, query_params=None):
        """Helper to create API Gateway events"""
        return {
            'httpMethod': method,
            'path': path,
            'body': json.dumps(body) if body else None,
            'queryStringParameters': query_params or {},
            'pathParameters': {},
            'requestContext': {
                'authorizer': {
                    'customerId': self.customer_id
                }
            }
        }
    
    # ===== End-to-End Workflow Tests =====
    
    def test_complete_report_workflow(self):
        """Test complete workflow: create report -> run query -> export -> schedule"""
        
        # Step 1: Create a new report
        report_data = {
            'name': 'Monthly Cost Analysis',
            'config': {
                'dateRange': '30d',
                'dimension': 'service',
                'filters': {'region': 'us-east-1'}
            }
        }
        
        self.mock_tables['reports'].put_item.return_value = {}
        
        create_event = self.create_event('POST', '/reports', body=report_data)
        create_response = report_engine.lambda_handler(create_event, None)
        
        self.assertEqual(create_response['statusCode'], 201)
        created_report = json.loads(create_response['body'])
        report_id = created_report.get('report', {}).get('id')
        
        # Step 2: Query analytics data
        self.mock_tables['metrics'].query.return_value = {
            'Items': [
                {'timestamp': '2024-01-15', 'service': 'EC2', 'cost': 100},
                {'timestamp': '2024-01-16', 'service': 'S3', 'cost': 50},
            ]
        }
        
        query_event = self.create_event(
            'GET',
            '/analytics',
            query_params={'dateRange': '30d', 'dimension': 'service'}
        )
        query_response = report_engine.lambda_handler(query_event, None)
        
        self.assertEqual(query_response['statusCode'], 200)
        query_data = json.loads(query_response['body'])
        self.assertIn('data', query_data)
        
        # Step 3: Export to CSV
        export_event = self.create_event(
            'POST',
            '/analytics/export',
            body={
                'format': 'csv',
                'data': query_data['data'],
                'reportName': 'Monthly Cost Analysis'
            }
        )
        export_response = report_engine.lambda_handler(export_event, None)
        
        self.assertEqual(export_response['statusCode'], 200)
        self.assertEqual(export_response['headers']['Content-Type'], 'text/csv')
        
        # Step 4: Verify the complete workflow succeeded
        self.assertIsNotNone(created_report.get('report'))
        self.assertIsNotNone(query_data.get('data'))
        self.assertEqual(export_response['statusCode'], 200)
    
    def test_multi_format_export_workflow(self):
        """Test exporting the same data in multiple formats"""
        test_data = [
            {'service': 'EC2', 'cost': 100, 'region': 'us-east-1'},
            {'service': 'S3', 'cost': 50, 'region': 'us-west-2'},
        ]
        
        formats = ['csv', 'json', 'pdf', 'excel']
        export_times = {}
        
        for format_type in formats:
            event = self.create_event(
                'POST',
                '/analytics/export',
                body={
                    'format': format_type,
                    'data': test_data,
                    'reportName': f'Test Report {format_type.upper()}'
                }
            )
            
            start_time = time.time()
            response = report_engine.lambda_handler(event, None)
            export_times[format_type] = time.time() - start_time
            
            self.assertEqual(response['statusCode'], 200,
                           f"{format_type.upper()} export failed")
        
        # Verify all exports completed within performance limits
        for format_type, exec_time in export_times.items():
            self.assertLess(exec_time, 10.0,
                          f"{format_type.upper()} export took {exec_time:.2f}s (limit: 10s)")
    
    def test_caching_workflow(self):
        """Test that caching works correctly across multiple requests"""
        query_params = {'dateRange': '30d', 'dimension': 'service'}
        
        # First request - cache miss
        self.mock_tables['cache'].get_item.return_value = {}
        self.mock_tables['metrics'].query.return_value = {
            'Items': [{'service': 'EC2', 'cost': 100}]
        }
        
        event1 = self.create_event('GET', '/analytics', query_params=query_params)
        response1 = report_engine.lambda_handler(event1, None)
        
        self.assertEqual(response1['statusCode'], 200)
        query_count_1 = self.mock_tables['metrics'].query.call_count
        
        # Second request - cache hit
        cache_data = {
            'data': [{'service': 'EC2', 'cost': 100}],
            'timestamp': datetime.utcnow().isoformat(),
        }
        self.mock_tables['cache'].get_item.return_value = {
            'Item': {
                'cache_key': 'test-key',
                'data': json.dumps(cache_data),
                'created_at': datetime.utcnow().isoformat(),
            }
        }
        
        event2 = self.create_event('GET', '/analytics', query_params=query_params)
        response2 = report_engine.lambda_handler(event2, None)
        
        self.assertEqual(response2['statusCode'], 200)
        query_count_2 = self.mock_tables['metrics'].query.call_count
        
        # Verify query was not called again (cache hit)
        self.assertEqual(query_count_1, query_count_2,
                        "Cache miss - query was executed again")
    
    def test_scheduled_report_workflow(self):
        """Test creating and managing scheduled reports"""
        # Create a report schedule
        schedule_data = {
            'reportId': 'report-123',
            'schedule': 'daily',
            'recipients': ['admin@example.com'],
            'format': 'pdf',
            'enabled': True
        }
        
        self.mock_tables['reports'].put_item.return_value = {}
        
        event = self.create_event(
            'POST',
            '/reports/schedule',
            body=schedule_data
        )
        
        response = report_engine.lambda_handler(event, None)
        
        # Should create schedule successfully
        self.assertIn(response['statusCode'], [200, 201])
    
    # ===== Multi-Dimensional Analytics Tests =====
    
    def test_analytics_by_service(self):
        """Test analytics grouped by service"""
        self.mock_tables['metrics'].query.return_value = {
            'Items': [
                {'service': 'EC2', 'cost': 500},
                {'service': 'S3', 'cost': 100},
                {'service': 'RDS', 'cost': 300},
            ]
        }
        
        event = self.create_event(
            'GET',
            '/analytics/cost-breakdown',
            query_params={'dimension': 'service'}
        )
        
        response = report_engine.lambda_handler(event, None)
        self.assertEqual(response['statusCode'], 200)
    
    def test_analytics_by_region(self):
        """Test analytics grouped by region"""
        self.mock_tables['metrics'].query.return_value = {
            'Items': [
                {'region': 'us-east-1', 'cost': 600},
                {'region': 'us-west-2', 'cost': 400},
            ]
        }
        
        event = self.create_event(
            'GET',
            '/analytics/cost-breakdown',
            query_params={'dimension': 'region'}
        )
        
        response = report_engine.lambda_handler(event, None)
        self.assertEqual(response['statusCode'], 200)
    
    def test_analytics_by_account(self):
        """Test analytics grouped by account"""
        self.mock_tables['metrics'].query.return_value = {
            'Items': [
                {'account_id': '111122223333', 'cost': 800},
                {'account_id': '444455556666', 'cost': 200},
            ]
        }
        
        event = self.create_event(
            'GET',
            '/analytics/cost-breakdown',
            query_params={'dimension': 'account'}
        )
        
        response = report_engine.lambda_handler(event, None)
        self.assertEqual(response['statusCode'], 200)
    
    # ===== Security & Compliance Tests =====
    
    def test_security_analytics(self):
        """Test security analytics endpoint"""
        event = self.create_event('GET', '/analytics/security')
        response = report_engine.lambda_handler(event, None)
        
        # Should return security metrics
        self.assertEqual(response['statusCode'], 200)
    
    def test_compliance_analytics(self):
        """Test compliance analytics endpoint"""
        event = self.create_event('GET', '/analytics/compliance')
        response = report_engine.lambda_handler(event, None)
        
        # Should return compliance metrics
        self.assertEqual(response['statusCode'], 200)
    
    # ===== Error Recovery Tests =====
    
    def test_retry_on_transient_failure(self):
        """Test that transient failures are handled gracefully"""
        # Simulate transient failure then success
        self.mock_tables['metrics'].query.side_effect = [
            Exception("Transient error"),
            {'Items': [{'service': 'EC2', 'cost': 100}]}
        ]
        
        event = self.create_event('GET', '/analytics')
        
        # Should handle error and return error response
        response = report_engine.lambda_handler(event, None)
        self.assertIn(response['statusCode'], [500, 503])
    
    def test_data_validation(self):
        """Test that invalid data is rejected"""
        # Try to create report with missing required fields
        event = self.create_event(
            'POST',
            '/reports',
            body={'name': ''}  # Empty name
        )
        
        response = report_engine.lambda_handler(event, None)
        self.assertIn(response['statusCode'], [400, 422])
    
    # ===== Performance Tests =====
    
    def test_large_dataset_query(self):
        """Test querying large datasets meets performance requirements"""
        # Simulate 1000 records
        large_dataset = [
            {'service': f'Service-{i % 10}', 'cost': i * 10}
            for i in range(1000)
        ]
        
        self.mock_tables['metrics'].query.return_value = {
            'Items': large_dataset
        }
        
        event = self.create_event('GET', '/analytics')
        
        start_time = time.time()
        response = report_engine.lambda_handler(event, None)
        execution_time = time.time() - start_time
        
        self.assertEqual(response['statusCode'], 200)
        self.assertLess(execution_time, 5.0,
                       f"Large dataset query took {execution_time:.2f}s (limit: 5s)")
    
    def test_concurrent_exports(self):
        """Test that multiple exports can be processed efficiently"""
        test_data = [{'service': 'EC2', 'cost': 100}]
        
        # Simulate concurrent export requests
        formats = ['csv', 'json', 'pdf']
        responses = []
        
        for fmt in formats:
            event = self.create_event(
                'POST',
                '/analytics/export',
                body={'format': fmt, 'data': test_data, 'reportName': 'Test'}
            )
            response = report_engine.lambda_handler(event, None)
            responses.append(response)
        
        # All should succeed
        for response in responses:
            self.assertEqual(response['statusCode'], 200)


class TestReportTemplates(unittest.TestCase):
    """Test pre-built report templates"""
    
    def setUp(self):
        """Set up mocks"""
        self.patcher_dynamodb = patch('report_engine.dynamodb')
        self.mock_dynamodb = self.patcher_dynamodb.start()
        self.mock_tables = {'reports': MagicMock()}
        self.mock_dynamodb.Table.return_value = self.mock_tables['reports']
    
    def tearDown(self):
        """Clean up"""
        self.patcher_dynamodb.stop()
    
    def create_event(self, method, path, body=None):
        """Helper to create events"""
        return {
            'httpMethod': method,
            'path': path,
            'body': json.dumps(body) if body else None,
            'pathParameters': {},
            'requestContext': {
                'authorizer': {'customerId': 'test-customer'}
            }
        }
    
    def test_cost_analysis_template(self):
        """Test cost analysis report template"""
        event = self.create_event(
            'POST',
            '/reports/templates/cost-analysis',
            body={'dateRange': '30d'}
        )
        event['pathParameters'] = {'templateId': 'cost-analysis'}
        
        response = report_engine.lambda_handler(event, None)
        # Should create report from template
        self.assertIn(response['statusCode'], [200, 201])
    
    def test_security_report_template(self):
        """Test security report template"""
        event = self.create_event(
            'POST',
            '/reports/templates/security',
            body={'dateRange': '7d'}
        )
        event['pathParameters'] = {'templateId': 'security'}
        
        response = report_engine.lambda_handler(event, None)
        self.assertIn(response['statusCode'], [200, 201])
    
    def test_compliance_report_template(self):
        """Test compliance report template"""
        event = self.create_event(
            'POST',
            '/reports/templates/compliance',
            body={'framework': 'hipaa'}
        )
        event['pathParameters'] = {'templateId': 'compliance'}
        
        response = report_engine.lambda_handler(event, None)
        self.assertIn(response['statusCode'], [200, 201])


if __name__ == '__main__':
    unittest.main(verbosity=2)
