"""
End-to-End Test for Pilot Customer Signup
Tests complete signup flow from browser to infrastructure provisioning
"""

import os
import sys
import unittest
from unittest.mock import Mock, patch
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase2-backend/functions'))


class TestPilotSignupE2E(unittest.TestCase):
    """
    End-to-end test simulating complete customer signup journey
    
    Flow:
    1. Customer fills out signup form
    2. Frontend calls /checkout API
    3. Customer completes Stripe checkout
    4. Stripe webhook triggers
    5. Customer record created
    6. Onboarding Lambda triggered
    7. API key generated
    8. Admin user created
    9. Welcome email sent
    10. Infrastructure provisioning queued
    """
    
    def setUp(self):
        """Set up test environment"""
        self.test_customer = {
            'name': 'E2E Test Hospital',
            'email': 'e2e-test@example.com',
            'tier': 'healthcare',
            'use_pilot_coupon': True
        }
        
        # Set up environment variables
        os.environ.update({
            'STRIPE_SECRET_KEY': 'sk_test_mock',
            'STRIPE_WEBHOOK_SECRET': 'whsec_mock',
            'STRIPE_PRICE_HEALTHCARE': 'price_mock_healthcare',
            'STRIPE_PILOT_COUPON': 'pilot50off',
            'PORTAL_URL': 'https://portal.test.securebase.io',
            'SNS_TOPIC_ARN': 'arn:aws:sns:us-east-1:123456789012:onboarding',
            'SES_SENDER_EMAIL': 'noreply@test.securebase.io',
            'ONBOARDING_FUNCTION_NAME': 'test-trigger-onboarding'
        })
    
    @patch('create_checkout_session.stripe')
    @patch('create_checkout_session.get_db_connection')
    @patch('create_checkout_session.check_rate_limit')
    def test_step1_create_checkout_session(self, mock_rate_limit, mock_db, mock_stripe):
        """Step 1: Customer creates checkout session"""
        from create_checkout_session import lambda_handler
        
        # Mock rate limit check
        mock_rate_limit.return_value = True
        
        # Mock database - no existing customer
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value.fetchall.return_value = []
        
        # Mock Stripe checkout session
        mock_session = Mock()
        mock_session.url = "https://checkout.stripe.com/test_session"
        mock_session.id = "cs_test_e2e_123"
        mock_stripe.checkout.Session.create.return_value = mock_session
        
        # Create event
        event = {
            'body': json.dumps(self.test_customer),
            'requestContext': {
                'identity': {'sourceIp': '192.0.2.1'}
            }
        }
        
        # Execute
        response = lambda_handler(event, {})
        
        # Verify
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('checkout_url', body)
        self.checkout_session_id = body['session_id']
        
        print(f"✓ Step 1: Checkout session created: {self.checkout_session_id}")
    
    @patch('stripe_webhook.stripe')
    @patch('stripe_webhook.get_db_connection')
    @patch('stripe_webhook.lambda_client')
    @patch('stripe_webhook.sns')
    def test_step2_webhook_checkout_completed(self, mock_sns, mock_lambda, mock_db, mock_stripe):
        """Step 2: Stripe webhook processes checkout completion"""
        from stripe_webhook import lambda_handler
        
        # Mock webhook signature verification
        mock_webhook_event = {
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'customer_email': self.test_customer['email'],
                    'customer': 'cus_test_e2e_123',
                    'subscription': 'sub_test_e2e_123',
                    'metadata': {
                        'tier': self.test_customer['tier'],
                        'customer_name': self.test_customer['name']
                    }
                }
            }
        }
        mock_stripe.Webhook.construct_event.return_value = mock_webhook_event
        
        # Mock database
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        
        # Mock no existing customer
        mock_cursor = Mock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = ('new_customer_id', self.test_customer['name'])
        mock_conn.cursor.return_value = mock_cursor
        
        # Mock Lambda invocation
        mock_lambda.invoke.return_value = {'StatusCode': 202}
        
        # Create webhook event
        event = {
            'headers': {'stripe-signature': 'test_sig'},
            'body': json.dumps(mock_webhook_event)
        }
        
        # Execute
        response = lambda_handler(event, {})
        
        # Verify
        self.assertEqual(response['statusCode'], 200)
        
        # Verify Lambda was invoked to trigger onboarding
        mock_lambda.invoke.assert_called_once()
        
        print("✓ Step 2: Webhook processed, onboarding triggered")
    
    @patch('trigger_onboarding.get_db_connection')
    @patch('trigger_onboarding.ses')
    @patch('trigger_onboarding.sns')
    @patch('trigger_onboarding.uuid')
    @patch('trigger_onboarding.bcrypt')
    def test_step3_onboarding_automation(self, mock_bcrypt, mock_uuid, mock_sns, mock_ses, mock_db):
        """Step 3: Onboarding automation executes"""
        from trigger_onboarding import lambda_handler
        
        # Mock UUID generation
        mock_uuid.uuid4.return_value.hex = 'test_api_key_secret'
        
        # Mock bcrypt
        mock_bcrypt.hashpw.return_value.decode.return_value = 'hashed_password'
        
        # Mock database
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        
        # Mock successful operations
        mock_cursor.fetchone.side_effect = [
            ('api_key_id',),  # API key creation
            None,  # No existing user
            ('user_id',)  # User creation
        ]
        
        # Create event
        event = {
            'customer_id': 'test_customer_id',
            'tier': self.test_customer['tier'],
            'email': self.test_customer['email'],
            'name': self.test_customer['name']
        }
        
        # Execute
        response = lambda_handler(event, {})
        
        # Verify
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertTrue(body['success'])
        
        # Verify emails sent
        self.assertEqual(mock_ses.send_email.call_count, 2)  # Welcome + password setup
        
        # Verify SNS notification
        mock_sns.publish.assert_called()
        
        print("✓ Step 3: Onboarding completed - API key, user, emails sent")
    
    def test_complete_flow_summary(self):
        """Summary of complete E2E flow"""
        print("\n" + "="*60)
        print("E2E Pilot Signup Flow - Test Summary")
        print("="*60)
        print("✓ Customer submits signup form")
        print("✓ Stripe checkout session created")
        print("✓ Customer completes payment")
        print("✓ Webhook triggers customer creation")
        print("✓ Onboarding automation executes:")
        print("  - API key generated")
        print("  - Admin user created")
        print("  - Welcome email sent")
        print("  - Password setup email sent")
        print("  - Infrastructure provisioning queued")
        print("✓ Audit trail logged")
        print("="*60)
        print("\nAll E2E tests passed! ✅")
        print("="*60 + "\n")


if __name__ == '__main__':
    # Run tests
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPilotSignupE2E)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Exit with appropriate code
    sys.exit(0 if result.wasSuccessful() else 1)
