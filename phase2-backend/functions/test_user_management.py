"""
Unit tests for user_management Lambda function.
Phase 4: Component 2 - Team Collaboration & RBAC Testing

Tests cover:
- User creation
- User listing with filters
- User updates
- Role changes
- Password reset
- Account unlock
- Permission validation
- RBAC enforcement
"""

import unittest
from unittest.mock import patch, MagicMock, call
import json
import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))


class TestUserManagement(unittest.TestCase):
    """Test suite for user_management Lambda function"""

    def setUp(self):
        """Set up test fixtures"""
        self.customer_id = 'cust-123'
        self.admin_user_id = 'user-admin-1'
        self.manager_user_id = 'user-manager-1'
        self.analyst_user_id = 'user-analyst-1'
        
        self.test_event = {
            'httpMethod': 'POST',
            'path': '/users',
            'headers': {},
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_user_id,
                    'role': 'admin'
                }
            },
            'body': json.dumps({
                'email': 'newuser@example.com',
                'name': 'Test User',
                'role': 'analyst'
            })
        }

    @patch('user_management.get_connection')
    @patch('user_management.execute_query')
    @patch('user_management.query_one')
    @patch('user_management.ses')
    @patch('user_management.bcrypt.hashpw')
    @patch('user_management.secrets.token_urlsafe')
    def test_create_user_success_as_admin(self, mock_token, mock_hashpw, mock_ses, 
                                          mock_query_one, mock_execute, mock_get_conn):
        """Test successful user creation by admin"""
        # Setup mocks
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = None  # No existing user
        mock_hashpw.return_value = b'hashed_password'
        mock_token.return_value = 'temp-password-token'
        
        # Import after mocking
        from user_management import lambda_handler
        
        # Execute
        response = lambda_handler(self.test_event, None)
        
        # Assertions
        self.assertEqual(response['statusCode'], 201)
        body = json.loads(response['body'])
        self.assertEqual(body['email'], 'newuser@example.com')
        self.assertEqual(body['role'], 'analyst')
        self.assertIn('user_id', body)
        
        # Verify user was inserted
        mock_execute.assert_called()
        
        # Verify email was sent
        mock_ses.send_email.assert_called_once()

    @patch('user_management.get_connection')
    @patch('user_management.query_one')
    def test_create_user_duplicate_email(self, mock_query_one, mock_get_conn):
        """Test user creation fails with duplicate email"""
        # Setup - existing user found
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = {'email': 'newuser@example.com'}
        
        from user_management import lambda_handler
        
        response = lambda_handler(self.test_event, None)
        
        self.assertEqual(response['statusCode'], 409)
        body = json.loads(response['body'])
        self.assertIn('already exists', body['error'].lower())

    @patch('user_management.get_connection')
    def test_create_user_unauthorized_role(self, mock_get_conn):
        """Test manager cannot create admin users"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        # Change requestor to manager
        event = self.test_event.copy()
        event['requestContext']['authorizer']['role'] = 'manager'
        event['body'] = json.dumps({
            'email': 'admin@example.com',
            'name': 'Admin User',
            'role': 'admin'  # Manager trying to create admin
        })
        
        from user_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 403)
        body = json.loads(response['body'])
        self.assertIn('permission', body['error'].lower())

    @patch('user_management.get_connection')
    @patch('user_management.query_all')
    def test_list_users_success(self, mock_query_all, mock_get_conn):
        """Test listing users with filters"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_all.return_value = [
            {
                'user_id': 'user-1',
                'email': 'user1@example.com',
                'name': 'User One',
                'role': 'admin',
                'status': 'active'
            },
            {
                'user_id': 'user-2',
                'email': 'user2@example.com',
                'name': 'User Two',
                'role': 'analyst',
                'status': 'active'
            }
        ]
        
        event = {
            'httpMethod': 'GET',
            'path': '/users',
            'queryStringParameters': {'role': 'analyst'},
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_user_id,
                    'role': 'admin'
                }
            }
        }
        
        from user_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('users', body)
        self.assertEqual(len(body['users']), 2)

    @patch('user_management.get_connection')
    @patch('user_management.query_one')
    @patch('user_management.execute_query')
    def test_update_user_role_success(self, mock_execute, mock_query_one, mock_get_conn):
        """Test updating user role as admin"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = {
            'user_id': 'user-target',
            'email': 'target@example.com',
            'role': 'analyst',
            'status': 'active'
        }
        
        event = {
            'httpMethod': 'PUT',
            'path': '/users/user-target/role',
            'pathParameters': {'user_id': 'user-target'},
            'body': json.dumps({'role': 'manager'}),
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_user_id,
                    'role': 'admin'
                }
            }
        }
        
        from user_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertEqual(body['role'], 'manager')
        
        # Verify update was executed
        mock_execute.assert_called()

    @patch('user_management.get_connection')
    @patch('user_management.query_one')
    @patch('user_management.execute_query')
    @patch('user_management.bcrypt.hashpw')
    @patch('user_management.secrets.token_urlsafe')
    @patch('user_management.ses')
    def test_reset_password_success(self, mock_ses, mock_token, mock_hashpw,
                                    mock_execute, mock_query_one, mock_get_conn):
        """Test password reset functionality"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = {
            'user_id': 'user-target',
            'email': 'target@example.com',
            'status': 'active'
        }
        mock_token.return_value = 'new-temp-password'
        mock_hashpw.return_value = b'hashed_new_password'
        
        event = {
            'httpMethod': 'POST',
            'path': '/users/user-target/reset-password',
            'pathParameters': {'user_id': 'user-target'},
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_user_id,
                    'role': 'admin'
                }
            }
        }
        
        from user_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        
        # Verify password was updated
        mock_execute.assert_called()
        
        # Verify email was sent
        mock_ses.send_email.assert_called_once()

    @patch('user_management.get_connection')
    @patch('user_management.query_one')
    @patch('user_management.execute_query')
    def test_unlock_account_success(self, mock_execute, mock_query_one, mock_get_conn):
        """Test unlocking a locked user account"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = {
            'user_id': 'user-locked',
            'email': 'locked@example.com',
            'is_locked': True,
            'failed_login_attempts': 5
        }
        
        event = {
            'httpMethod': 'POST',
            'path': '/users/user-locked/unlock',
            'pathParameters': {'user_id': 'user-locked'},
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_user_id,
                    'role': 'admin'
                }
            }
        }
        
        from user_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        
        # Verify unlock was executed
        mock_execute.assert_called()

    @patch('user_management.get_connection')
    @patch('user_management.query_one')
    @patch('user_management.execute_query')
    def test_delete_user_success(self, mock_execute, mock_query_one, mock_get_conn):
        """Test soft delete of user"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_query_one.return_value = {
            'user_id': 'user-delete',
            'email': 'delete@example.com',
            'status': 'active'
        }
        
        event = {
            'httpMethod': 'DELETE',
            'path': '/users/user-delete',
            'pathParameters': {'user_id': 'user-delete'},
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_user_id,
                    'role': 'admin'
                }
            }
        }
        
        from user_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        
        # Verify soft delete was executed
        mock_execute.assert_called()

    def test_unauthorized_missing_auth_context(self):
        """Test request fails without authentication context"""
        event = {
            'httpMethod': 'GET',
            'path': '/users',
            'requestContext': {}  # No authorizer
        }
        
        from user_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 401)

    @patch('user_management.get_connection')
    def test_analyst_cannot_manage_users(self, mock_get_conn):
        """Test analyst role cannot create users"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        event = self.test_event.copy()
        event['requestContext']['authorizer']['role'] = 'analyst'
        
        from user_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 403)

    @patch('user_management.get_connection')
    def test_viewer_read_only_access(self, mock_get_conn):
        """Test viewer role has read-only access"""
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        # Viewer trying to create user
        event = self.test_event.copy()
        event['requestContext']['authorizer']['role'] = 'viewer'
        
        from user_management import lambda_handler
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 403)


if __name__ == '__main__':
    unittest.main()
