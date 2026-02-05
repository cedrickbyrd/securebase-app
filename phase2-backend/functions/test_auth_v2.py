"""
Unit tests for auth_v2 Lambda function
Phase 4: Testing & Quality Assurance
"""

import unittest
from unittest.mock import patch, MagicMock, Mock
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

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))
# Add lambda_layer/python to path for db_utils and other layer modules
lambda_layer_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'lambda_layer', 'python')
if lambda_layer_path not in sys.path:
    sys.path.insert(0, lambda_layer_path)


class TestAuthV2(unittest.TestCase):
    """Test suite for auth_v2 Lambda function"""

    @patch('auth_v2.get_db_connection')
    @patch('auth_v2.jwt')
    def test_valid_api_key_authentication(self, mock_jwt, mock_db):
        """Test successful authentication with valid API key"""
        # Mock database response
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            'customer_id': 'customer-123',
            'email': 'test@example.com',
            'tier': 'healthcare'
        }
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        # Mock JWT encoding
        mock_jwt.encode.return_value = 'jwt-token-123'
        
        # Import function after mocking
        from auth_v2 import lambda_handler
        
        # Test event
        event = {
            'headers': {
                'X-API-Key': 'valid-api-key'
            }
        }
        
        # Call function
        response = lambda_handler(event, None)
        
        # Assertions
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('token', body)
        self.assertEqual(body['customer_id'], 'customer-123')

    @patch('auth_v2.get_db_connection')
    def test_invalid_api_key(self, mock_db):
        """Test authentication failure with invalid API key"""
        # Mock database response - no customer found
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        from auth_v2 import lambda_handler
        
        event = {
            'headers': {
                'X-API-Key': 'invalid-key'
            }
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 401)
        body = json.loads(response['body'])
        self.assertIn('error', body)

    def test_missing_api_key(self):
        """Test request without API key"""
        from auth_v2 import lambda_handler
        
        event = {
            'headers': {}
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertIn('error', body)

    @patch('auth_v2.get_db_connection')
    def test_database_error_handling(self, mock_db):
        """Test handling of database errors"""
        # Mock database error
        mock_db.side_effect = Exception('Database connection failed')
        
        from auth_v2 import lambda_handler
        
        event = {
            'headers': {
                'X-API-Key': 'test-key'
            }
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 500)

    @patch('auth_v2.get_db_connection')
    @patch('auth_v2.set_rls_context')
    def test_rls_context_set(self, mock_rls, mock_db):
        """Test that RLS context is properly set"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            'customer_id': 'customer-123',
            'email': 'test@example.com',
            'tier': 'healthcare'
        }
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        from auth_v2 import lambda_handler
        
        event = {
            'headers': {
                'X-API-Key': 'valid-key'
            }
        }
        
        lambda_handler(event, None)
        
        # Verify RLS context was set
        mock_rls.assert_called_once_with(mock_conn, 'customer-123')


if __name__ == '__main__':
    unittest.main()
