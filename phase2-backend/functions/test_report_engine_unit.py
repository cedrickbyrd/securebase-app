"""
Unit tests for report_engine Lambda function
Phase 4: Testing & Quality Assurance
"""

import unittest
from unittest.mock import patch, MagicMock
import json
import sys
import os

# Mock psycopg2 and boto3 before any imports
sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.pool'] = MagicMock()
sys.modules['psycopg2.extras'] = MagicMock()
sys.modules['boto3'] = MagicMock()
sys.modules['botocore'] = MagicMock()
sys.modules['botocore.exceptions'] = MagicMock()

sys.path.insert(0, os.path.dirname(__file__))
# Add lambda_layer/python to path for db_utils and other layer modules
lambda_layer_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'lambda_layer', 'python')
if lambda_layer_path not in sys.path:
    sys.path.insert(0, lambda_layer_path)


class TestReportEngine(unittest.TestCase):
    """Test suite for report_engine Lambda function"""

    @patch('report_engine.get_db_connection')
    def test_generate_csv_report(self, mock_db):
        """Test CSV report generation"""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            {'date': '2024-01-01', 'cost': 100.00, 'service': 'EC2'},
            {'date': '2024-01-02', 'cost': 150.00, 'service': 'S3'},
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        from report_engine import lambda_handler
        
        event = {
            'httpMethod': 'POST',
            'body': json.dumps({
                'format': 'csv',
                'customer_id': 'customer-123',
                'start_date': '2024-01-01',
                'end_date': '2024-01-31'
            })
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        self.assertIn('Content-Type', response['headers'])
        self.assertEqual(response['headers']['Content-Type'], 'text/csv')

    @patch('report_engine.get_db_connection')
    def test_generate_json_report(self, mock_db):
        """Test JSON report generation"""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            {'date': '2024-01-01', 'cost': 100.00},
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        from report_engine import lambda_handler
        
        event = {
            'httpMethod': 'GET',
            'queryStringParameters': {
                'customer_id': 'customer-123',
                'format': 'json'
            }
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('data', body)
        self.assertIsInstance(body['data'], list)

    @patch('report_engine.get_db_connection')
    @patch('report_engine.generate_pdf')
    def test_generate_pdf_report(self, mock_pdf, mock_db):
        """Test PDF report generation"""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        mock_pdf.return_value = b'PDF content'
        
        from report_engine import lambda_handler
        
        event = {
            'httpMethod': 'POST',
            'body': json.dumps({
                'format': 'pdf',
                'customer_id': 'customer-123'
            })
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(response['headers']['Content-Type'], 'application/pdf')

    def test_missing_customer_id(self):
        """Test validation of required parameters"""
        from report_engine import lambda_handler
        
        event = {
            'httpMethod': 'GET',
            'queryStringParameters': {}
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertIn('error', body)

    @patch('report_engine.get_db_connection')
    def test_invalid_date_format(self, mock_db):
        """Test handling of invalid date formats"""
        from report_engine import lambda_handler
        
        event = {
            'httpMethod': 'GET',
            'queryStringParameters': {
                'customer_id': 'customer-123',
                'start_date': 'invalid-date'
            }
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 400)

    @patch('report_engine.get_db_connection')
    def test_empty_result_set(self, mock_db):
        """Test handling of empty query results"""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        from report_engine import lambda_handler
        
        event = {
            'httpMethod': 'GET',
            'queryStringParameters': {
                'customer_id': 'customer-123',
                'format': 'json'
            }
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertEqual(len(body['data']), 0)


if __name__ == '__main__':
    unittest.main()
