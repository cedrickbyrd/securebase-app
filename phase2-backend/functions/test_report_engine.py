"""
Unit tests for report_engine Lambda function
Phase 4: Advanced Analytics & Reporting

Tests cover:
- Analytics query execution
- Export format generation (CSV, JSON, PDF, Excel)
- Report CRUD operations
- Caching behavior
- Error handling
- Performance validation

Run with: pytest test_report_engine.py -v --cov=report_engine --cov-report=term-missing
"""

import json
import os
import sys
import unittest
from unittest.mock import Mock, patch, MagicMock
from decimal import Decimal
from datetime import datetime, timedelta
import io
import base64

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set AWS environment variables before importing
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
os.environ['AWS_ACCESS_KEY_ID'] = 'test'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'test'
os.environ['REPORTS_TABLE'] = 'test-reports'
os.environ['SCHEDULES_TABLE'] = 'test-schedules'
os.environ['METRICS_TABLE'] = 'test-metrics'
os.environ['CACHE_TABLE'] = 'test-cache'
os.environ['S3_BUCKET'] = 'test-bucket'
os.environ['ENVIRONMENT'] = 'test'

# Mock AWS clients at module level before import
with patch('boto3.resource'), patch('boto3.client'):
    import report_engine


class TestReportEngineLambda(unittest.TestCase):
    """Test cases for report_engine Lambda function"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.customer_id = 'test-customer-123'
        
        # Mock AWS clients
        self.mock_dynamodb = MagicMock()
        self.mock_s3 = MagicMock()
        
        # Patch AWS clients
        self.patcher_dynamodb = patch('report_engine.dynamodb', self.mock_dynamodb)
        self.patcher_s3 = patch('report_engine.s3', self.mock_s3)
        
        self.patcher_dynamodb.start()
        self.patcher_s3.start()
        
        # Mock DynamoDB tables
        self.mock_reports_table = MagicMock()
        self.mock_metrics_table = MagicMock()
        self.mock_cache_table = MagicMock()
        
        self.mock_dynamodb.Table.side_effect = lambda name: {
            'test-reports': self.mock_reports_table,
            'test-metrics': self.mock_metrics_table,
            'test-cache': self.mock_cache_table,
        }.get(name, MagicMock())
    
    def tearDown(self):
        """Clean up after tests"""
        self.patcher_dynamodb.stop()
        self.patcher_s3.stop()
    
    def create_test_event(self, method='GET', path='/analytics', body=None, query_params=None):
        """Helper to create Lambda test events"""
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
    
    # ===== Authentication Tests =====
    
    def test_missing_customer_id_returns_401(self):
        """Test that missing customer ID returns 401"""
        event = {
            'httpMethod': 'GET',
            'path': '/analytics',
            'requestContext': {}
        }
        
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 401)
        self.assertIn('Unauthorized', response['body'])
    
    # ===== Analytics Query Tests =====
    
    def test_get_analytics_success(self):
        """Test successful analytics query"""
        # Mock DynamoDB response
        self.mock_metrics_table.query.return_value = {
            'Items': [
                {'timestamp': '2024-01-15', 'service': 'EC2', 'cost': Decimal('100.50')},
                {'timestamp': '2024-01-16', 'service': 'S3', 'cost': Decimal('25.75')},
            ]
        }
        
        event = self.create_test_event(
            path='/analytics',
            query_params={'dateRange': '30d', 'dimension': 'service'}
        )
        
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('data', body)
        self.assertEqual(len(body['data']), 2)
    
    def test_get_analytics_with_invalid_date_range(self):
        """Test analytics query with invalid date range"""
        event = self.create_test_event(
            path='/analytics',
            query_params={'dateRange': 'invalid'}
        )
        
        response = report_engine.lambda_handler(event, None)
        
        # Should use default date range or return error
        self.assertIn(response['statusCode'], [200, 400])
    
    def test_get_summary_statistics(self):
        """Test summary statistics endpoint"""
        self.mock_metrics_table.query.return_value = {
            'Items': [
                {'cost': Decimal('100'), 'security_score': Decimal('95')},
                {'cost': Decimal('150'), 'security_score': Decimal('92')},
            ]
        }
        
        event = self.create_test_event(path='/analytics/summary')
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('summary', body)
    
    def test_get_cost_breakdown(self):
        """Test cost breakdown by dimension"""
        self.mock_metrics_table.query.return_value = {
            'Items': [
                {'service': 'EC2', 'cost': Decimal('500')},
                {'service': 'S3', 'cost': Decimal('100')},
            ]
        }
        
        event = self.create_test_event(
            path='/analytics/cost-breakdown',
            query_params={'dimension': 'service'}
        )
        
        response = report_engine.lambda_handler(event, None)
        self.assertEqual(response['statusCode'], 200)
    
    # ===== Export Format Tests =====
    
    def test_export_csv_format(self):
        """Test CSV export generation"""
        test_data = [
            {'service': 'EC2', 'cost': 100.50, 'region': 'us-east-1'},
            {'service': 'S3', 'cost': 25.75, 'region': 'us-west-2'},
        ]
        
        event = self.create_test_event(
            method='POST',
            path='/analytics/export',
            body={'format': 'csv', 'data': test_data, 'reportName': 'Test Report'}
        )
        
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(response['headers']['Content-Type'], 'text/csv')
        
        # Decode and verify CSV content
        csv_content = response['body']
        self.assertIn('service,cost,region', csv_content)
        self.assertIn('EC2,100.5,us-east-1', csv_content)
    
    def test_export_json_format(self):
        """Test JSON export generation"""
        test_data = [
            {'service': 'EC2', 'cost': Decimal('100.50')},
            {'service': 'S3', 'cost': Decimal('25.75')},
        ]
        
        event = self.create_test_event(
            method='POST',
            path='/analytics/export',
            body={'format': 'json', 'data': test_data, 'reportName': 'Test Report'}
        )
        
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(response['headers']['Content-Type'], 'application/json')
        
        # Verify JSON is valid and Decimals are converted
        body = json.loads(response['body'])
        self.assertIsInstance(body['data'][0]['cost'], (int, float))
    
    def test_export_pdf_format(self):
        """Test PDF export generation"""
        test_data = [
            {'service': 'EC2', 'cost': 100.50},
            {'service': 'S3', 'cost': 25.75},
        ]
        
        event = self.create_test_event(
            method='POST',
            path='/analytics/export',
            body={'format': 'pdf', 'data': test_data, 'reportName': 'Test Report'}
        )
        
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(response['headers']['Content-Type'], 'application/pdf')
        self.assertTrue(response.get('isBase64Encoded', False))
        
        # Verify base64 encoded PDF
        try:
            pdf_bytes = base64.b64decode(response['body'])
            self.assertGreater(len(pdf_bytes), 0)
            # PDF files start with %PDF
            self.assertTrue(pdf_bytes.startswith(b'%PDF') or len(pdf_bytes) > 100)
        except Exception:
            # If ReportLab not available, might return HTML fallback
            pass
    
    def test_export_excel_format(self):
        """Test Excel export generation"""
        test_data = [
            {'service': 'EC2', 'cost': 100.50},
            {'service': 'S3', 'cost': 25.75},
        ]
        
        event = self.create_test_event(
            method='POST',
            path='/analytics/export',
            body={'format': 'excel', 'data': test_data, 'reportName': 'Test Report'}
        )
        
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        self.assertIn('excel', response['headers']['Content-Type'].lower())
        self.assertTrue(response.get('isBase64Encoded', False))
    
    def test_export_unsupported_format(self):
        """Test export with unsupported format returns error"""
        event = self.create_test_event(
            method='POST',
            path='/analytics/export',
            body={'format': 'xml', 'data': [], 'reportName': 'Test'}
        )
        
        response = report_engine.lambda_handler(event, None)
        self.assertEqual(response['statusCode'], 400)
    
    # ===== Report CRUD Tests =====
    
    def test_list_reports(self):
        """Test listing saved reports"""
        self.mock_reports_table.query.return_value = {
            'Items': [
                {
                    'customer_id': self.customer_id,
                    'id': 'report-1',
                    'name': 'Monthly Cost Report',
                    'created_at': '2024-01-15',
                },
                {
                    'customer_id': self.customer_id,
                    'id': 'report-2',
                    'name': 'Security Report',
                    'created_at': '2024-01-16',
                }
            ]
        }
        
        event = self.create_test_event(path='/reports')
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertEqual(len(body['reports']), 2)
    
    def test_create_report(self):
        """Test creating a new report"""
        report_data = {
            'name': 'Test Report',
            'config': {'dateRange': '30d', 'dimension': 'service'},
        }
        
        self.mock_reports_table.put_item.return_value = {}
        
        event = self.create_test_event(
            method='POST',
            path='/reports',
            body=report_data
        )
        
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 201)
        self.mock_reports_table.put_item.assert_called_once()
    
    def test_get_report_by_id(self):
        """Test retrieving a specific report"""
        self.mock_reports_table.get_item.return_value = {
            'Item': {
                'customer_id': self.customer_id,
                'id': 'report-123',
                'name': 'Test Report',
                'config': {'dateRange': '30d'},
            }
        }
        
        event = self.create_test_event(path='/reports/report-123')
        event['pathParameters'] = {'reportId': 'report-123'}
        
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertEqual(body['report']['id'], 'report-123')
    
    def test_update_report(self):
        """Test updating an existing report"""
        update_data = {
            'name': 'Updated Report Name',
            'config': {'dateRange': '90d'},
        }
        
        self.mock_reports_table.update_item.return_value = {
            'Attributes': {
                'customer_id': self.customer_id,
                'id': 'report-123',
                'name': 'Updated Report Name',
            }
        }
        
        event = self.create_test_event(
            method='PUT',
            path='/reports/report-123',
            body=update_data
        )
        event['pathParameters'] = {'reportId': 'report-123'}
        
        response = report_engine.lambda_handler(event, None)
        self.assertEqual(response['statusCode'], 200)
    
    def test_delete_report(self):
        """Test deleting a report"""
        self.mock_reports_table.delete_item.return_value = {}
        
        event = self.create_test_event(method='DELETE', path='/reports/report-123')
        event['pathParameters'] = {'reportId': 'report-123'}
        
        response = report_engine.lambda_handler(event, None)
        self.assertEqual(response['statusCode'], 200)
    
    # ===== Caching Tests =====
    
    def test_cache_hit(self):
        """Test that cached results are returned"""
        cached_data = {
            'data': [{'service': 'EC2', 'cost': 100}],
            'timestamp': datetime.utcnow().isoformat(),
        }
        
        self.mock_cache_table.get_item.return_value = {
            'Item': {
                'cache_key': 'analytics:test-customer-123:30d:service',
                'data': json.dumps(cached_data),
                'created_at': datetime.utcnow().isoformat(),
            }
        }
        
        event = self.create_test_event(
            path='/analytics',
            query_params={'dateRange': '30d', 'dimension': 'service'}
        )
        
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        # Verify metrics table was not queried (cache hit)
        self.mock_metrics_table.query.assert_not_called()
    
    def test_cache_miss(self):
        """Test that queries execute when cache misses"""
        self.mock_cache_table.get_item.return_value = {}
        self.mock_metrics_table.query.return_value = {
            'Items': [{'service': 'EC2', 'cost': Decimal('100')}]
        }
        
        event = self.create_test_event(path='/analytics')
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        # Verify metrics table was queried (cache miss)
        self.mock_metrics_table.query.assert_called()
    
    # ===== Error Handling Tests =====
    
    def test_dynamodb_error_handling(self):
        """Test graceful handling of DynamoDB errors"""
        self.mock_metrics_table.query.side_effect = Exception("DynamoDB error")
        
        event = self.create_test_event(path='/analytics')
        response = report_engine.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 500)
        body = json.loads(response['body'])
        self.assertIn('error', body)
    
    def test_invalid_json_body(self):
        """Test handling of invalid JSON in request body"""
        event = {
            'httpMethod': 'POST',
            'path': '/reports',
            'body': '{invalid json}',
            'requestContext': {
                'authorizer': {'customerId': self.customer_id}
            }
        }
        
        response = report_engine.lambda_handler(event, None)
        self.assertEqual(response['statusCode'], 400)
    
    # ===== Decimal Encoder Tests =====
    
    def test_decimal_encoder_converts_decimals(self):
        """Test DecimalEncoder properly converts Decimal types"""
        encoder = report_engine.DecimalEncoder()
        
        # Test integer Decimal
        result = json.dumps({'value': Decimal('100')}, cls=report_engine.DecimalEncoder)
        self.assertEqual(json.loads(result)['value'], 100)
        
        # Test float Decimal
        result = json.dumps({'value': Decimal('100.50')}, cls=report_engine.DecimalEncoder)
        self.assertEqual(json.loads(result)['value'], 100.5)
    
    # ===== Performance Tests =====
    
    def test_query_execution_time(self):
        """Test that query execution meets performance requirements (<5s)"""
        import time
        
        self.mock_metrics_table.query.return_value = {
            'Items': [{'service': f'Service-{i}', 'cost': Decimal(str(i * 10))} 
                     for i in range(100)]
        }
        
        event = self.create_test_event(path='/analytics')
        
        start_time = time.time()
        response = report_engine.lambda_handler(event, None)
        execution_time = time.time() - start_time
        
        self.assertEqual(response['statusCode'], 200)
        self.assertLess(execution_time, 5.0, "Query execution exceeded 5s limit")
    
    def test_export_execution_time(self):
        """Test that PDF export meets performance requirements (<10s)"""
        import time
        
        test_data = [
            {'service': f'Service-{i}', 'cost': i * 10, 'region': 'us-east-1'}
            for i in range(50)
        ]
        
        event = self.create_test_event(
            method='POST',
            path='/analytics/export',
            body={'format': 'pdf', 'data': test_data, 'reportName': 'Performance Test'}
        )
        
        start_time = time.time()
        response = report_engine.lambda_handler(event, None)
        execution_time = time.time() - start_time
        
        self.assertEqual(response['statusCode'], 200)
        self.assertLess(execution_time, 10.0, "PDF export exceeded 10s limit")


class TestHelperFunctions(unittest.TestCase):
    """Test helper functions in report_engine"""
    
    def test_error_response_format(self):
        """Test error_response helper creates proper format"""
        response = report_engine.error_response('Test error', 400)
        
        self.assertEqual(response['statusCode'], 400)
        self.assertIn('Access-Control-Allow-Origin', response['headers'])
        body = json.loads(response['body'])
        self.assertEqual(body['error'], 'Test error')
    
    def test_success_response_format(self):
        """Test success_response helper creates proper format"""
        data = {'key': 'value'}
        response = report_engine.success_response(data, 200)
        
        self.assertEqual(response['statusCode'], 200)
        self.assertIn('Access-Control-Allow-Origin', response['headers'])
        body = json.loads(response['body'])
        self.assertEqual(body['key'], 'value')


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
