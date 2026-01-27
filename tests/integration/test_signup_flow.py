"""
Integration Test for Pilot Customer Signup Workflow
Tests end-to-end signup flow from checkout to onboarding
"""

import json
import os
import sys
import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase2-backend/functions'))


class TestSignupWorkflow(unittest.TestCase):
    """Test complete signup workflow"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_email = "test@example.com"
        self.test_name = "Test Company"
        self.test_tier = "fintech"
        
        # Mock environment variables
        os.environ['STRIPE_SECRET_KEY'] = 'sk_test_mock'
        os.environ['STRIPE_WEBHOOK_SECRET'] = 'whsec_mock'
        os.environ['STRIPE_PRICE_FINTECH'] = 'price_mock_fintech'
        os.environ['PORTAL_URL'] = 'https://portal.test.securebase.io'
        os.environ['SNS_TOPIC_ARN'] = 'arn:aws:sns:us-east-1:123456789012:test-topic'
        os.environ['SES_SENDER_EMAIL'] = 'noreply@test.securebase.io'
    
    @patch('create_checkout_session.stripe')
    @patch('create_checkout_session.get_db_connection')
    def test_create_checkout_session_success(self, mock_db, mock_stripe):
        """Test successful checkout session creation"""
        from create_checkout_session import lambda_handler
        
        # Mock database response - no existing customer
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value.fetchall.return_value = []
        
        # Mock Stripe session creation
        mock_session = Mock()
        mock_session.url = "https://checkout.stripe.com/test"
        mock_session.id = "cs_test_123"
        mock_stripe.checkout.Session.create.return_value = mock_session
        
        # Create test event
        event = {
            'body': json.dumps({
                'tier': self.test_tier,
                'email': self.test_email,
                'name': self.test_name,
                'use_pilot_coupon': True
            }),
            'requestContext': {
                'identity': {
                    'sourceIp': '192.0.2.1'
                }
            }
        }
        
        # Execute
        response = lambda_handler(event, {})
        
        # Verify
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('checkout_url', body)
        self.assertEqual(body['checkout_url'], "https://checkout.stripe.com/test")
        
    @patch('create_checkout_session.get_db_connection')
    def test_create_checkout_session_invalid_email(self, mock_db):
        """Test checkout session with invalid email"""
        from create_checkout_session import lambda_handler
        
        event = {
            'body': json.dumps({
                'tier': self.test_tier,
                'email': 'invalid-email',
                'name': self.test_name
            }),
            'requestContext': {
                'identity': {
                    'sourceIp': '192.0.2.1'
                }
            }
        }
        
        response = lambda_handler(event, {})
        
        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertIn('error', body)
        self.assertIn('email', body['error'].lower())
    
    @patch('create_checkout_session.get_db_connection')
    def test_create_checkout_session_duplicate_customer(self, mock_db):
        """Test checkout session for existing active customer"""
        from create_checkout_session import lambda_handler
        
        # Mock database response - existing active customer
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        
        # Simulate existing customer with active subscription
        mock_cursor = Mock()
        mock_cursor.fetchall.return_value = [
            ('cust_123', 'cus_stripe_123', 'active')
        ]
        mock_conn.cursor.return_value = mock_cursor
        
        event = {
            'body': json.dumps({
                'tier': self.test_tier,
                'email': self.test_email,
                'name': self.test_name
            }),
            'requestContext': {
                'identity': {
                    'sourceIp': '192.0.2.1'
                }
            }
        }
        
        response = lambda_handler(event, {})
        
        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertIn('error', body)
        self.assertIn('active subscription', body['error'].lower())
    
    @patch('stripe_webhook.get_db_connection')
    @patch('stripe_webhook.lambda_client')
    @patch('stripe_webhook.sns')
    def test_webhook_checkout_completed(self, mock_sns, mock_lambda, mock_db):
        """Test webhook handling for checkout.session.completed"""
        from stripe_webhook import handle_checkout_completed
        
        # Mock database connection
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        
        # Mock no existing customer
        mock_cursor = Mock()
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value = mock_cursor
        
        # Mock successful insert
        mock_cursor.fetchone.return_value = ('new_cust_id', 'Test Company')
        
        # Create test session data
        session = {
            'customer_email': self.test_email,
            'customer': 'cus_stripe_123',
            'subscription': 'sub_stripe_123',
            'metadata': {
                'tier': self.test_tier,
                'customer_name': self.test_name
            }
        }
        
        # Execute
        handle_checkout_completed(session)
        
        # Verify Lambda invocation for onboarding
        mock_lambda.invoke.assert_called_once()
        
    @patch('trigger_onboarding.get_db_connection')
    @patch('trigger_onboarding.ses')
    @patch('trigger_onboarding.sns')
    def test_trigger_onboarding_flow(self, mock_sns, mock_ses, mock_db):
        """Test complete onboarding trigger"""
        from trigger_onboarding import lambda_handler
        
        # Mock database
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        
        # Mock successful API key and user creation
        mock_cursor.fetchone.side_effect = [
            ('api_key_id',),  # API key creation
            None,  # No existing user
            ('user_id',)  # User creation
        ]
        
        # Create test event
        event = {
            'customer_id': 'test_customer_id',
            'tier': self.test_tier,
            'email': self.test_email,
            'name': self.test_name
        }
        
        # Execute
        response = lambda_handler(event, {})
        
        # Verify
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertTrue(body['success'])
        self.assertEqual(body['customer_id'], 'test_customer_id')
        
        # Verify welcome email sent
        mock_ses.send_email.assert_called()
    
    def test_input_validation(self):
        """Test input validation functions"""
        from create_checkout_session import validate_inputs
        
        # Valid inputs
        self.assertIsNone(validate_inputs('fintech', 'test@example.com', 'Test Company'))
        
        # Invalid email
        self.assertIsNotNone(validate_inputs('fintech', 'invalid', 'Test Company'))
        
        # Invalid tier
        self.assertIsNotNone(validate_inputs('invalid_tier', 'test@example.com', 'Test Company'))
        
        # Missing name
        self.assertIsNotNone(validate_inputs('fintech', 'test@example.com', ''))
        
        # Disposable email
        self.assertIsNotNone(validate_inputs('fintech', 'test@tempmail.com', 'Test Company'))


class TestRateLimiting(unittest.TestCase):
    """Test rate limiting functionality"""
    
    @patch('create_checkout_session.boto3')
    def test_rate_limit_check_within_limit(self, mock_boto3):
        """Test rate limit check when within limit"""
        from create_checkout_session import check_rate_limit
        
        # Mock DynamoDB
        mock_table = Mock()
        mock_boto3.resource.return_value.Table.return_value = mock_table
        
        # Mock response with 3 attempts (below limit of 5)
        current_time = int(datetime.now().timestamp())
        mock_table.get_item.return_value = {
            'Item': {
                'attempts': [current_time - 1000, current_time - 500, current_time - 100]
            }
        }
        
        # Execute
        result = check_rate_limit('192.0.2.1')
        
        # Verify - should allow
        self.assertTrue(result)
    
    @patch('create_checkout_session.boto3')
    def test_rate_limit_check_exceeded(self, mock_boto3):
        """Test rate limit check when exceeded"""
        from create_checkout_session import check_rate_limit
        
        # Mock DynamoDB
        mock_table = Mock()
        mock_boto3.resource.return_value.Table.return_value = mock_table
        
        # Mock response with 5 attempts (at limit)
        current_time = int(datetime.now().timestamp())
        mock_table.get_item.return_value = {
            'Item': {
                'attempts': [
                    current_time - 3000,
                    current_time - 2000,
                    current_time - 1000,
                    current_time - 500,
                    current_time - 100
                ]
            }
        }
        
        # Execute
        result = check_rate_limit('192.0.2.1')
        
        # Verify - should block
        self.assertFalse(result)


class TestAuditLogging(unittest.TestCase):
    """Test audit logging functionality"""
    
    @patch('create_checkout_session.get_db_connection')
    def test_signup_attempt_logged(self, mock_db):
        """Test that signup attempts are logged"""
        from create_checkout_session import log_signup_attempt
        
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        
        # Execute
        log_signup_attempt('test@example.com', 'fintech', '192.0.2.1', 'checkout_created')
        
        # Verify database insert was called
        mock_conn.cursor.return_value.execute.assert_called()


if __name__ == '__main__':
    unittest.main()
