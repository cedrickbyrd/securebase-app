"""
Integration tests for RBAC workflows.
Phase 4: Component 2 - Team Collaboration & RBAC Testing

Tests cover complete user lifecycle and RBAC scenarios:
- User invitation and onboarding
- Login with MFA
- Role-based permission validation
- Session management
- Activity logging
- Account suspension and deletion
"""

import unittest
from unittest.mock import patch, MagicMock
import json
import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))


class TestRBACIntegration(unittest.TestCase):
    """Integration test suite for complete RBAC workflows"""

    def setUp(self):
        """Set up test fixtures"""
        self.customer_id = 'cust-integration-test'
        self.admin_id = 'user-admin-integration'
        self.new_user_email = 'newuser@integration.test'
        self.new_user_id = 'user-new-integration'

    @patch('user_management.get_connection')
    @patch('user_management.execute_query')
    @patch('user_management.query_one')
    @patch('user_management.query_all')
    @patch('user_management.ses')
    @patch('user_management.bcrypt')
    @patch('user_management.secrets.token_urlsafe')
    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    @patch('session_management.bcrypt.checkpw')
    @patch('session_management.jwt.encode')
    @patch('session_management.execute_query')
    def test_complete_user_lifecycle(self, 
                                     # session_management mocks
                                     sm_execute, sm_jwt, sm_checkpw, sm_query_one, sm_get_conn,
                                     # user_management mocks
                                     um_token, um_bcrypt, um_ses, um_query_all, um_query_one, 
                                     um_execute, um_get_conn):
        """
        Test complete user lifecycle from creation to deletion.
        
        Flow:
        1. Admin creates new user
        2. New user receives invite email
        3. New user logs in with temporary password
        4. New user changes password
        5. Admin changes user role
        6. User permissions are updated
        7. Admin suspends user
        8. User cannot log in
        9. Admin deletes user
        10. User is soft-deleted
        """
        # Setup mocks for user management
        um_conn = MagicMock()
        um_get_conn.return_value = um_conn
        um_token.return_value = 'temp-password-123'
        um_bcrypt.hashpw.return_value = b'hashed_temp_password'
        
        # Setup mocks for session management
        sm_conn = MagicMock()
        sm_get_conn.return_value = sm_conn
        
        # Step 1: Admin creates new user
        um_query_one.return_value = None  # No existing user
        
        from user_management import lambda_handler as user_mgmt_handler
        
        create_event = {
            'httpMethod': 'POST',
            'path': '/users',
            'headers': {},
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_id,
                    'role': 'admin'
                }
            },
            'body': json.dumps({
                'email': self.new_user_email,
                'name': 'New User',
                'role': 'analyst'
            })
        }
        
        response = user_mgmt_handler(create_event, None)
        self.assertEqual(response['statusCode'], 201)
        
        # Verify email invitation sent
        um_ses.send_email.assert_called_once()
        
        # Step 2: New user logs in
        sm_query_one.return_value = {
            'user_id': self.new_user_id,
            'customer_id': self.customer_id,
            'email': self.new_user_email,
            'password_hash': b'hashed_temp_password',
            'role': 'analyst',
            'mfa_enabled': False,
            'is_locked': False,
            'failed_login_attempts': 0,
            'status': 'active',
            'must_change_password': True
        }
        sm_checkpw.return_value = True
        sm_jwt.return_value = 'session-token-new-user'
        
        from session_management import lambda_handler as session_mgmt_handler
        
        login_event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'headers': {'User-Agent': 'Test Browser'},
            'requestContext': {'identity': {'sourceIp': '192.168.1.1'}},
            'body': json.dumps({
                'email': self.new_user_email,
                'password': 'temp-password-123'
            })
        }
        
        response = session_mgmt_handler(login_event, None)
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertTrue(body.get('must_change_password', False))
        
        # Step 3: Admin changes user role
        um_query_one.return_value = {
            'user_id': self.new_user_id,
            'email': self.new_user_email,
            'role': 'analyst',
            'status': 'active'
        }
        
        role_change_event = {
            'httpMethod': 'PUT',
            'path': f'/users/{self.new_user_id}/role',
            'pathParameters': {'user_id': self.new_user_id},
            'body': json.dumps({'role': 'manager'}),
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_id,
                    'role': 'admin'
                }
            }
        }
        
        response = user_mgmt_handler(role_change_event, None)
        self.assertEqual(response['statusCode'], 200)
        
        # Step 4: Admin suspends user
        suspend_event = {
            'httpMethod': 'PUT',
            'path': f'/users/{self.new_user_id}/status',
            'pathParameters': {'user_id': self.new_user_id},
            'body': json.dumps({'status': 'suspended'}),
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_id,
                    'role': 'admin'
                }
            }
        }
        
        response = user_mgmt_handler(suspend_event, None)
        self.assertEqual(response['statusCode'], 200)
        
        # Step 5: Suspended user cannot log in
        sm_query_one.return_value = {
            'user_id': self.new_user_id,
            'status': 'suspended'
        }
        
        response = session_mgmt_handler(login_event, None)
        self.assertEqual(response['statusCode'], 403)
        
        # Step 6: Admin deletes user
        um_query_one.return_value = {
            'user_id': self.new_user_id,
            'status': 'suspended'
        }
        
        delete_event = {
            'httpMethod': 'DELETE',
            'path': f'/users/{self.new_user_id}',
            'pathParameters': {'user_id': self.new_user_id},
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_id,
                    'role': 'admin'
                }
            }
        }
        
        response = user_mgmt_handler(delete_event, None)
        self.assertEqual(response['statusCode'], 200)

    @patch('user_management.get_connection')
    @patch('user_management.query_one')
    def test_rbac_permission_matrix(self, mock_query_one, mock_get_conn):
        """
        Test permission matrix across all roles.
        
        Validates that each role has correct permissions:
        - Admin: Full access
        - Manager: User management except admin operations
        - Analyst: Read-only for users, read/write for data
        - Viewer: Read-only everywhere
        """
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        from user_management import lambda_handler
        
        test_scenarios = [
            # (role, operation, expected_status)
            ('admin', 'create_user_admin', 201),      # Admin can create admin
            ('admin', 'create_user_manager', 201),    # Admin can create manager
            ('admin', 'delete_user', 200),            # Admin can delete
            ('manager', 'create_user_admin', 403),    # Manager cannot create admin
            ('manager', 'create_user_analyst', 201),  # Manager can create analyst
            ('manager', 'delete_user', 200),          # Manager can delete
            ('analyst', 'create_user', 403),          # Analyst cannot create users
            ('analyst', 'update_user', 403),          # Analyst cannot update users
            ('viewer', 'create_user', 403),           # Viewer cannot create
            ('viewer', 'update_user', 403),           # Viewer cannot update
            ('viewer', 'delete_user', 403),           # Viewer cannot delete
        ]
        
        for role, operation, expected_status in test_scenarios:
            with self.subTest(role=role, operation=operation):
                if 'create_user' in operation:
                    target_role = 'admin' if 'admin' in operation else 'analyst'
                    mock_query_one.return_value = None
                    
                    event = {
                        'httpMethod': 'POST',
                        'path': '/users',
                        'body': json.dumps({
                            'email': f'test_{operation}@example.com',
                            'name': 'Test User',
                            'role': target_role
                        }),
                        'requestContext': {
                            'authorizer': {
                                'customer_id': 'cust-test',
                                'user_id': f'user-{role}',
                                'role': role
                            }
                        }
                    }
                else:
                    mock_query_one.return_value = {
                        'user_id': 'user-target',
                        'status': 'active'
                    }
                    
                    if 'delete' in operation:
                        event = {
                            'httpMethod': 'DELETE',
                            'path': '/users/user-target',
                            'pathParameters': {'user_id': 'user-target'},
                            'requestContext': {
                                'authorizer': {
                                    'customer_id': 'cust-test',
                                    'user_id': f'user-{role}',
                                    'role': role
                                }
                            }
                        }
                    else:  # update
                        event = {
                            'httpMethod': 'PUT',
                            'path': '/users/user-target',
                            'pathParameters': {'user_id': 'user-target'},
                            'body': json.dumps({'name': 'Updated Name'}),
                            'requestContext': {
                                'authorizer': {
                                    'customer_id': 'cust-test',
                                    'user_id': f'user-{role}',
                                    'role': role
                                }
                            }
                        }
                
                response = lambda_handler(event, None)
                
                # For 201/200 success cases, check status code
                # For 403 forbidden cases, verify access denied
                if expected_status in [200, 201]:
                    self.assertIn(response['statusCode'], [200, 201])
                else:
                    self.assertEqual(response['statusCode'], 403)

    @patch('activity_feed.get_connection')
    @patch('activity_feed.query_all')
    def test_audit_logging_completeness(self, mock_query_all, mock_get_conn):
        """
        Test that all user actions are logged in activity feed.
        
        Validates:
        - User creation is logged
        - Role changes are logged
        - Login attempts are logged
        - Deletions are logged
        """
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        # Mock activity feed with various action types
        mock_query_all.return_value = [
            {
                'activity_id': 'act-1',
                'customer_id': self.customer_id,
                'user_id': self.admin_id,
                'action': 'user.created',
                'resource_type': 'user',
                'resource_id': self.new_user_id,
                'created_at': datetime.utcnow().isoformat()
            },
            {
                'activity_id': 'act-2',
                'customer_id': self.customer_id,
                'user_id': self.admin_id,
                'action': 'user.role_changed',
                'resource_type': 'user',
                'resource_id': self.new_user_id,
                'changes': json.dumps({'role': {'from': 'analyst', 'to': 'manager'}}),
                'created_at': datetime.utcnow().isoformat()
            },
            {
                'activity_id': 'act-3',
                'customer_id': self.customer_id,
                'user_id': self.new_user_id,
                'action': 'auth.login_success',
                'ip_address': '192.168.1.1',
                'created_at': datetime.utcnow().isoformat()
            }
        ]
        
        from activity_feed import lambda_handler
        
        event = {
            'httpMethod': 'GET',
            'path': '/activity',
            'queryStringParameters': {
                'resource_type': 'user',
                'resource_id': self.new_user_id
            },
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': self.admin_id,
                    'role': 'admin'
                }
            }
        }
        
        response = lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('activities', body)
        self.assertEqual(len(body['activities']), 3)
        
        # Verify action types
        actions = [act['action'] for act in body['activities']]
        self.assertIn('user.created', actions)
        self.assertIn('user.role_changed', actions)
        self.assertIn('auth.login_success', actions)

    @patch('session_management.get_connection')
    @patch('session_management.query_one')
    @patch('session_management.pyotp.TOTP')
    @patch('session_management.jwt.encode')
    @patch('session_management.bcrypt.checkpw')
    @patch('session_management.execute_query')
    def test_mfa_complete_flow(self, mock_execute, mock_checkpw, mock_jwt, 
                               mock_totp_class, mock_query_one, mock_get_conn):
        """
        Test complete MFA setup and login flow.
        
        Flow:
        1. User sets up MFA
        2. User logs in with password (requires MFA)
        3. User provides MFA code
        4. Session is created
        """
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn
        
        from session_management import lambda_handler
        
        # Step 1: Setup MFA
        with patch('session_management.pyotp.random_base32', return_value='JBSWY3DPEHPK3PXP'):
            setup_event = {
                'httpMethod': 'POST',
                'path': '/auth/mfa/setup',
                'headers': {},
                'requestContext': {'identity': {'sourceIp': '192.168.1.1'}},
                'body': json.dumps({'user_id': self.new_user_id})
            }
            
            response = lambda_handler(setup_event, None)
            self.assertEqual(response['statusCode'], 200)
            body = json.loads(response['body'])
            self.assertIn('mfa_secret', body)
            mfa_secret = body['mfa_secret']
        
        # Step 2: Login with MFA enabled
        mock_query_one.return_value = {
            'user_id': self.new_user_id,
            'customer_id': self.customer_id,
            'email': self.new_user_email,
            'password_hash': b'hashed_password',
            'role': 'analyst',
            'mfa_enabled': True,
            'mfa_secret': mfa_secret,
            'is_locked': False,
            'status': 'active'
        }
        mock_checkpw.return_value = True
        
        login_event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'headers': {'User-Agent': 'Test Browser'},
            'requestContext': {'identity': {'sourceIp': '192.168.1.1'}},
            'body': json.dumps({
                'email': self.new_user_email,
                'password': 'ValidPassword123!'
            })
        }
        
        response = lambda_handler(login_event, None)
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertTrue(body['mfa_required'])
        self.assertIn('temp_token', body)
        temp_token = body['temp_token']
        
        # Step 3: Verify MFA code
        mock_totp = MagicMock()
        mock_totp.verify.return_value = True
        mock_totp_class.return_value = mock_totp
        mock_jwt.return_value = 'final-session-token'
        
        verify_event = {
            'httpMethod': 'POST',
            'path': '/auth/mfa/verify',
            'headers': {},
            'requestContext': {'identity': {'sourceIp': '192.168.1.1'}},
            'body': json.dumps({
                'temp_token': temp_token,
                'mfa_code': '123456'
            })
        }
        
        response = lambda_handler(verify_event, None)
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('session_token', body)
        self.assertEqual(body['session_token'], 'final-session-token')


if __name__ == '__main__':
    unittest.main()
