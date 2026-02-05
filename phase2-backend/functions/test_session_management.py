"""
Unit tests for session_management Lambda function.
Phase 4: Component 2 - Team Collaboration & RBAC Testing

Tests cover:
- User login
- MFA verification
- MFA setup
- Session refresh
- Logout
- Account lockout
- Session validation
"""

import unittest
from unittest.mock import patch, MagicMock, Mock
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
sys.modules['bcrypt'] = MagicMock()
sys.modules['pyotp'] = MagicMock()
sys.modules['jwt'] = MagicMock()

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))
# Add lambda_layer/python to path for db_utils and other layer modules
lambda_layer_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'lambda_layer', 'python')
if lambda_layer_path not in sys.path:
    sys.path.insert(0, lambda_layer_path)


class TestSessionManagement(unittest.TestCase):
    """Test suite for session_management Lambda function"""

    def setUp(self):
        """Set up test fixtures"""
        self.customer_id = 'cust-123'
        self.user_id = 'user-123'
        self.user_email = 'test@example.com'
        
        self.login_event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'headers': {
                'User-Agent': 'Test Browser'
            },
            'requestContext': {
                'identity': {
                    'sourceIp': '192.168.1.1'
                }
            },
            'body': json.dumps({
                'email': self.user_email,
                'password': 'ValidPassword123!'
            })
        }

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    @patch('session_management.bcrypt.checkpw')
    @patch('session_management.jwt.encode')
    @patch('session_management.execute_query')
    def test_login_success_without_mfa(self, mock_execute, mock_jwt, mock_checkpw, 
                                       mock_query_one, mock_get_conn):
        """Test successful login without MFA"""
        # Setup mocks
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = {
            'user_id': self.user_id,
            'customer_id': self.customer_id,
            'email': self.user_email,
            'password_hash': b'hashed_password',
            'role': 'admin',
            'mfa_enabled': False,
            'is_locked': False,
            'failed_login_attempts': 0,
            'status': 'active'
        }
        mock_checkpw.return_value = True
        mock_jwt.return_value = 'jwt-session-token-123'
        
        from session_management import lambda_handler
        
        response = lambda_handler(self.login_event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('session_token', body)
        self.assertEqual(body['session_token'], 'jwt-session-token-123')
        self.assertEqual(body['user']['email'], self.user_email)
        self.assertFalse(body['mfa_required'])
        
        # Verify session was created
        mock_execute.assert_called()

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    @patch('session_management.bcrypt.checkpw')
    def test_login_success_with_mfa_required(self, mock_checkpw, mock_query_one, mock_get_conn):
        """Test login requires MFA when enabled"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = {
            'user_id': self.user_id,
            'customer_id': self.customer_id,
            'email': self.user_email,
            'password_hash': b'hashed_password',
            'role': 'admin',
            'mfa_enabled': True,
            'mfa_secret': 'JBSWY3DPEHPK3PXP',
            'is_locked': False,
            'failed_login_attempts': 0,
            'status': 'active'
        }
        mock_checkpw.return_value = True
        
        from session_management import lambda_handler
        
        response = lambda_handler(self.login_event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertTrue(body['mfa_required'])
        self.assertIn('temp_token', body)
        self.assertNotIn('session_token', body)

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    def test_login_invalid_password(self, mock_query_one, mock_get_conn):
        """Test login fails with invalid password"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = {
            'user_id': self.user_id,
            'email': self.user_email,
            'password_hash': b'hashed_password',
            'is_locked': False,
            'failed_login_attempts': 0
        }
        
        # Mock bcrypt to return False
        with patch('session_management.bcrypt.checkpw', return_value=False):
            from session_management import lambda_handler
            
            response = lambda_handler(self.login_event, None)
            
            self.assertEqual(response['statusCode'], 401)
            body = json.loads(response['body'])
            self.assertIn('invalid', body['error'].lower())

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    def test_login_account_locked(self, mock_query_one, mock_get_conn):
        """Test login fails when account is locked"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = {
            'user_id': self.user_id,
            'email': self.user_email,
            'is_locked': True,
            'locked_until': datetime.utcnow() + timedelta(minutes=30)
        }
        
        from session_management import lambda_handler
        
        response = lambda_handler(self.login_event, None)
        
        self.assertEqual(response['statusCode'], 423)  # HTTP 423 Locked
        body = json.loads(response['body'])
        self.assertIn('locked', body['error'].lower())

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    def test_login_user_not_found(self, mock_query_one, mock_get_conn):
        """Test login fails when user doesn't exist"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = None  # User not found
        
        from session_management import lambda_handler
        
        response = lambda_handler(self.login_event, None)
        
        self.assertEqual(response['statusCode'], 401)

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    @patch('session_management.bcrypt.checkpw')
    @patch('session_management.execute_query')
    def test_login_increments_failed_attempts(self, mock_execute, mock_checkpw, 
                                              mock_query_one, mock_get_conn):
        """Test failed login increments attempt counter"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = {
            'user_id': self.user_id,
            'email': self.user_email,
            'password_hash': b'hashed_password',
            'is_locked': False,
            'failed_login_attempts': 3
        }
        mock_checkpw.return_value = False  # Wrong password
        
        from session_management import lambda_handler
        
        response = lambda_handler(self.login_event, None)
        
        # Verify failed attempts were incremented
        mock_execute.assert_called()

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    @patch('session_management.pyotp.TOTP')
    @patch('session_management.jwt.encode')
    @patch('session_management.execute_query')
    def test_mfa_verification_success(self, mock_execute, mock_jwt, mock_totp_class,
                                      mock_query_one, mock_get_conn):
        """Test successful MFA code verification"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        # Mock temp session
        mock_query_one.return_value = {
            'user_id': self.user_id,
            'customer_id': self.customer_id,
            'email': self.user_email,
            'role': 'admin',
            'mfa_secret': 'JBSWY3DPEHPK3PXP',
            'mfa_verified': False
        }
        
        # Mock TOTP verification
        mock_totp = MagicMock()
        mock_totp.verify.return_value = True
        mock_totp_class.return_value = mock_totp
        
        mock_jwt.return_value = 'jwt-session-token-with-mfa'
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/mfa/verify',
            'headers': {},
            'requestContext': {'identity': {'sourceIp': '192.168.1.1'}},
            'body': json.dumps({
                'temp_token': 'temp-token-123',
                'mfa_code': '123456'
            })
        }
        
        from session_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('session_token', body)

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    @patch('session_management.pyotp.TOTP')
    def test_mfa_verification_invalid_code(self, mock_totp_class, mock_query_one, mock_get_conn):
        """Test MFA verification fails with invalid code"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        mock_query_one.return_value = {
            'user_id': self.user_id,
            'mfa_secret': 'JBSWY3DPEHPK3PXP'
        }
        
        mock_totp = MagicMock()
        mock_totp.verify.return_value = False
        mock_totp_class.return_value = mock_totp
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/mfa/verify',
            'headers': {},
            'requestContext': {'identity': {'sourceIp': '192.168.1.1'}},
            'body': json.dumps({
                'temp_token': 'temp-token-123',
                'mfa_code': '000000'
            })
        }
        
        from session_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 401)

    @patch('session_management.pyotp.random_base32')
    @patch('session_management.get_connection')
    @patch('session_management.execute_query')
    def test_mfa_setup_success(self, mock_execute, mock_get_conn, mock_random):
        """Test MFA setup generates secret"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_random.return_value = 'JBSWY3DPEHPK3PXP'
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/mfa/setup',
            'headers': {},
            'requestContext': {'identity': {'sourceIp': '192.168.1.1'}},
            'body': json.dumps({
                'user_id': self.user_id
            })
        }
        
        from session_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('mfa_secret', body)
        self.assertIn('qr_code_url', body)

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    @patch('session_management.jwt.decode')
    @patch('session_management.jwt.encode')
    @patch('session_management.execute_query')
    def test_refresh_session_success(self, mock_execute, mock_jwt_encode, mock_jwt_decode,
                                     mock_query_one, mock_get_conn):
        """Test session refresh with valid refresh token"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        # Mock JWT decode
        mock_jwt_decode.return_value = {
            'session_id': 'session-123',
            'user_id': self.user_id,
            'type': 'refresh'
        }
        
        # Mock session lookup
        mock_query_one.return_value = {
            'session_id': 'session-123',
            'user_id': self.user_id,
            'customer_id': self.customer_id,
            'role': 'admin',
            'is_valid': True
        }
        
        mock_jwt_encode.return_value = 'new-session-token'
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/refresh',
            'headers': {},
            'requestContext': {'identity': {'sourceIp': '192.168.1.1'}},
            'body': json.dumps({
                'refresh_token': 'old-refresh-token'
            })
        }
        
        from session_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('session_token', body)

    @patch('session_management.get_connection')
    @patch('session_management.execute_query')
    def test_logout_success(self, mock_execute, mock_get_conn):
        """Test successful logout invalidates session"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/logout',
            'headers': {},
            'requestContext': {'identity': {'sourceIp': '192.168.1.1'}},
            'body': json.dumps({
                'session_token': 'session-token-to-invalidate'
            })
        }
        
        from session_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        
        # Verify session was invalidated
        mock_execute.assert_called()

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    @patch('session_management.jwt.decode')
    def test_get_session_info_success(self, mock_jwt_decode, mock_query_one, mock_get_conn):
        """Test getting current session info"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        mock_jwt_decode.return_value = {
            'session_id': 'session-123',
            'user_id': self.user_id
        }
        
        mock_query_one.return_value = {
            'session_id': 'session-123',
            'user_id': self.user_id,
            'customer_id': self.customer_id,
            'role': 'admin',
            'email': self.user_email,
            'created_at': datetime.utcnow().isoformat()
        }
        
        event = {
            'httpMethod': 'GET',
            'path': '/auth/session',
            'headers': {
                'Authorization': 'Bearer valid-session-token'
            },
            'requestContext': {'identity': {'sourceIp': '192.168.1.1'}}
        }
        
        from session_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertEqual(body['user_id'], self.user_id)
        self.assertEqual(body['role'], 'admin')


if __name__ == '__main__':
    unittest.main()
