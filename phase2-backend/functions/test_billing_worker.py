"""
Unit tests for billing_worker Lambda function
Phase 4: Testing & Quality Assurance
"""

import unittest
from unittest.mock import patch, MagicMock
import json
import sys
import os
from datetime import datetime, timedelta

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


class TestBillingWorker(unittest.TestCase):
    """Test suite for billing_worker Lambda function"""

    @patch('billing_worker.get_db_connection')
    @patch('billing_worker.calculate_usage')
    def test_generate_monthly_invoice(self, mock_calculate, mock_db):
        """Test monthly invoice generation"""
        # Mock database
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        # Mock usage calculation
        mock_calculate.return_value = {
            'total_cost': 1500.00,
            'breakdown': {
                'compute': 800.00,
                'storage': 400.00,
                'network': 300.00
            }
        }
        
        from billing_worker import lambda_handler
        
        event = {
            'customer_id': 'customer-123',
            'billing_period': '2024-01'
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertEqual(body['total_cost'], 1500.00)
        self.assertIn('invoice_id', body)

    @patch('billing_worker.get_db_connection')
    def test_invoice_already_exists(self, mock_db):
        """Test handling of duplicate invoice generation"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {'invoice_id': 'inv-001'}
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        from billing_worker import lambda_handler
        
        event = {
            'customer_id': 'customer-123',
            'billing_period': '2024-01'
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('already exists', body.get('message', '').lower())

    @patch('billing_worker.get_db_connection')
    @patch('billing_worker.send_invoice_email')
    def test_invoice_email_sent(self, mock_email, mock_db):
        """Test that invoice email is sent"""
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        from billing_worker import lambda_handler
        
        event = {
            'customer_id': 'customer-123',
            'billing_period': '2024-01',
            'send_email': True
        }
        
        lambda_handler(event, None)
        
        # Verify email was sent
        mock_email.assert_called_once()

    @patch('billing_worker.get_db_connection')
    def test_zero_usage_invoice(self, mock_db):
        """Test invoice generation with zero usage"""
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        from billing_worker import lambda_handler
        
        event = {
            'customer_id': 'customer-123',
            'billing_period': '2024-01'
        }
        
        response = lambda_handler(event, None)
        
        # Should still create invoice with $0
        self.assertEqual(response['statusCode'], 200)


if __name__ == '__main__':
    unittest.main()
