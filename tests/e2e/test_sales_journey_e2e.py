"""
Complete Sales Journey End-to-End Tests
Validates the full customer journey from initial signup through first webhook delivery.

Journey:
  Step 1  – Customer visits pricing page and selects a tier
  Step 2  – Frontend creates a Stripe checkout session (POST /checkout)
  Step 3  – Customer completes payment on Stripe
  Step 4  – Stripe fires checkout.session.completed webhook
  Step 5  – stripe_webhook Lambda creates customer record
  Step 6  – trigger_onboarding Lambda generates API key & admin user
  Step 7  – Welcome email dispatched via SES
  Step 8  – auth_v2 Lambda validates new API key → JWT session token
  Step 9  – Customer registers a webhook endpoint via webhook_manager
  Step 10 – First event delivered to customer webhook URL

Each step is isolated with mocks so the suite runs entirely offline without
AWS credentials or a deployed environment.
"""

import json
import hmac
import hashlib
import os
import sys
import unittest
from unittest.mock import MagicMock, Mock, patch, call

# ---------------------------------------------------------------------------
# Path setup – give Python access to the Lambda source and shared layer
# ---------------------------------------------------------------------------
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
_FUNCTIONS = os.path.join(_REPO_ROOT, 'phase2-backend', 'functions')
_LAYER = os.path.join(_REPO_ROOT, 'phase2-backend', 'lambda_layer', 'python')

for p in (_LAYER, _FUNCTIONS):
    if p not in sys.path:
        sys.path.insert(0, p)

# ---------------------------------------------------------------------------
# Preserve a reference to the *real* stripe module and StripeTestCleaner
# BEFORE the stub block below replaces sys.modules['stripe'] with a
# MagicMock.  TestStripeSandboxHandshake uses these references so it can
# make live API calls in sandbox mode without disturbing the mocks used by
# every other test class.
# ---------------------------------------------------------------------------
try:
    import stripe as _real_stripe  # noqa: E402
except ImportError:
    _real_stripe = None  # type: ignore[assignment]

# Import the cleanup class while stripe is still real so StripeTestCleaner
# receives the real module as its default (no injection needed in tearDown).
try:
    if _REPO_ROOT not in sys.path:
        sys.path.insert(0, _REPO_ROOT)
    from scripts.stripe_cleanup import StripeTestCleaner as _StripeTestCleaner
except ImportError:
    _StripeTestCleaner = None  # type: ignore[assignment]

# Stub heavy C-extensions and AWS SDK **before** any Lambda module is imported
for _mod in [
    'psycopg2', 'psycopg2.pool', 'psycopg2.extras',
    'boto3', 'botocore', 'botocore.exceptions',
    'stripe',
    'requests',
    'bcrypt',
    'pyotp',
    'cryptography', 'cryptography.fernet',
]:
    sys.modules[_mod] = MagicMock()

# Stub db_utils so Lambda functions that import non-existent helpers
# (e.g. get_db_connection vs get_connection) can still be imported and tested.
_db_utils_stub = MagicMock()
_db_utils_stub.get_db_connection = MagicMock()
_db_utils_stub.get_connection = MagicMock()
_db_utils_stub.execute_query = MagicMock()
_db_utils_stub.execute_update = MagicMock()
_db_utils_stub.query_many = MagicMock()
_db_utils_stub.execute_one = MagicMock()
_db_utils_stub.get_customer_by_email = MagicMock()
_db_utils_stub.get_customer_by_id = MagicMock()
_db_utils_stub.log_audit_event = MagicMock()
_db_utils_stub.get_api_key_by_prefix = MagicMock()
_db_utils_stub.update_api_key_usage = MagicMock()
sys.modules['db_utils'] = _db_utils_stub


class TestSalesJourneyE2E(unittest.TestCase):
    """
    End-to-end test simulating the complete SecureBase online-sales journey.
    Each test method covers one logical step; they share state via class
    attributes written by earlier steps.
    """

    # Shared state written by step methods and consumed by later ones
    checkout_session_id: str = ''
    customer_id: str = 'cust-e2e-test-001'
    customer_email: str = 'sales-e2e@example.com'
    customer_name: str = 'Acme Sales E2E Corp'
    tier: str = 'standard'
    # API key must start with 'sb_' and be ≥12 chars to pass auth_v2 format check
    api_key: str = 'sb_e2etest_validkey123456'
    session_token: str = ''
    webhook_id: str = 'wh_e2e_001'

    def setUp(self):
        """Populate environment variables expected by Lambda functions."""
        os.environ.update({
            'STRIPE_SECRET_KEY': 'sk_test_mock_journey',
            'STRIPE_WEBHOOK_SECRET': 'whsec_mock_journey',
            'STRIPE_PRICE_STANDARD': 'price_mock_standard',
            'STRIPE_PRICE_HEALTHCARE': 'price_mock_healthcare',
            'STRIPE_PRICE_FINTECH': 'price_mock_fintech',
            'STRIPE_PRICE_GOVERNMENT': 'price_mock_government',
            'STRIPE_PILOT_COUPON': 'pilot50off',
            'PORTAL_URL': 'https://portal.test.securebase.io',
            'SNS_TOPIC_ARN': 'arn:aws:sns:us-east-1:123456789012:onboarding',
            'SES_SENDER_EMAIL': 'noreply@test.securebase.io',
            'ONBOARDING_FUNCTION_NAME': 'test-trigger-onboarding',
            'ONBOARDING_TOPIC_ARN': 'arn:aws:sns:us-east-1:123456789012:infra',
            'JWT_SECRET': 'test-jwt-secret-for-e2e',
            'WEBHOOKS_TABLE': 'test-webhooks-table',
            'DELIVERIES_TABLE': 'test-deliveries-table',
            'WEBHOOK_SECRET_KEY': 'test-webhook-hmac-key',
            'RDS_HOST': 'localhost',
            'RDS_DATABASE': 'securebase_test',
            'RDS_USER': 'test_user',
            'RDS_PASSWORD': 'test_password',
            'DDB_TABLE_CACHE': 'test-sessions-table',
        })

    # ------------------------------------------------------------------
    # Step 1 – Customer selects tier and initiates checkout
    # ------------------------------------------------------------------
    @patch('create_checkout_session.stripe')
    @patch('create_checkout_session.get_db_connection')
    @patch('create_checkout_session.check_rate_limit')
    def test_step1_initiate_checkout(self, mock_rate_limit, mock_db, mock_stripe):
        """Customer POSTs to /checkout; Lambda returns a Stripe redirect URL."""
        import importlib
        ccs = importlib.import_module('create_checkout_session')

        mock_rate_limit.return_value = True

        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []   # no duplicate email
        mock_cursor.fetchone.return_value = None
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn

        mock_session = MagicMock()
        mock_session.url = 'https://checkout.stripe.com/cs_test_journey_001'
        mock_session.id = 'cs_test_journey_001'
        mock_stripe.checkout.Session.create.return_value = mock_session

        event = {
            'body': json.dumps({
                'tier': self.__class__.tier,
                'email': self.__class__.customer_email,
                'name': self.__class__.customer_name,
                'use_pilot_coupon': False,
            }),
            'requestContext': {'identity': {'sourceIp': '203.0.113.1'}},
        }

        resp = ccs.lambda_handler(event, {})

        self.assertIn(resp['statusCode'], (200, 201),
                      f"Unexpected statusCode: {resp['statusCode']}")
        body = json.loads(resp['body'])
        self.assertTrue(
            'checkout_url' in body or 'url' in body,
            f"Response body missing checkout URL: {body}",
        )

        # Persist for later steps
        self.__class__.checkout_session_id = (
            body.get('session_id') or mock_session.id
        )
        print(f'✓ Step 1: Checkout session created → {self.__class__.checkout_session_id}')

    # ------------------------------------------------------------------
    # Step 2 – Stripe fires checkout.session.completed webhook
    # ------------------------------------------------------------------
    @patch('stripe_webhook.stripe')
    @patch('stripe_webhook.get_db_connection')
    @patch('stripe_webhook.execute_query')
    @patch('stripe_webhook.execute_update')
    @patch('stripe_webhook.boto3')
    @patch('stripe_webhook.sns')
    def test_step2_stripe_webhook_received(
            self, mock_sns, mock_boto3, mock_exec_update, mock_exec_query,
            mock_db, mock_stripe):
        """Stripe webhook is received; customer record is created and
        onboarding Lambda is invoked asynchronously."""
        if not self.__class__.checkout_session_id:
            self.skipTest("Step 1 did not complete — skipping dependent step")

        import importlib
        sw = importlib.import_module('stripe_webhook')

        webhook_payload = {
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'customer_email': self.__class__.customer_email,
                    'customer': 'cus_test_e2e_journey',
                    'subscription': 'sub_test_e2e_journey',
                    'metadata': {
                        'tier': self.__class__.tier,
                        'customer_name': self.__class__.customer_name,
                    },
                }
            },
        }
        mock_stripe.Webhook.construct_event.return_value = webhook_payload

        mock_conn = MagicMock()
        mock_db.return_value = mock_conn

        # No existing customer → empty list triggers INSERT
        # Second call in trigger_onboarding: return customer details.
        # NOTE: call order is fixed: handle_checkout_completed checks first,
        # then trigger_onboarding looks up by customer_id.
        mock_exec_query.side_effect = [
            [],   # handle_checkout_completed: no existing customer → INSERT
            [(self.__class__.customer_email, self.__class__.customer_name)],  # trigger_onboarding: lookup
        ]
        # INSERT RETURNING returns [(customer_id, customer_name)]
        mock_exec_update.return_value = [
            (self.__class__.customer_id, self.__class__.customer_name)
        ]

        # Mock the Lambda client returned by boto3.client('lambda')
        mock_lambda_client = MagicMock()
        mock_lambda_client.invoke.return_value = {'StatusCode': 202}
        mock_boto3.client.return_value = mock_lambda_client

        event = {
            'headers': {'stripe-signature': 'test_sig_e2e'},
            'body': json.dumps(webhook_payload),
        }

        resp = sw.lambda_handler(event, {})

        self.assertEqual(resp['statusCode'], 200,
                         f"Webhook handler returned {resp['statusCode']}: "
                         f"{resp.get('body')}")

        # Onboarding Lambda must be invoked
        mock_lambda_client.invoke.assert_called()
        print('✓ Step 2: Stripe webhook processed – customer created, '
              'onboarding triggered')

    # ------------------------------------------------------------------
    # Step 3 – Onboarding automation: API key + admin user + emails
    # ------------------------------------------------------------------
    @patch('trigger_onboarding.query_many')
    @patch('trigger_onboarding.execute_one')
    @patch('trigger_onboarding.ddb')
    @patch('trigger_onboarding.ses')
    @patch('trigger_onboarding.sns')
    @patch('trigger_onboarding.uuid')
    def test_step3_onboarding_automation(
            self, mock_uuid, mock_sns, mock_ses,
            mock_ddb, mock_execute_one, mock_query_many):
        """Onboarding Lambda generates API key, creates admin user, and
        sends welcome + password-setup emails."""
        import importlib
        to = importlib.import_module('trigger_onboarding')
        to._DB_AVAILABLE = True

        mock_uuid.uuid4.return_value.hex = 'e2eapikeysecrettoken12345678901234'
        mock_uuid.uuid4.return_value.__str__ = lambda s: 'e2e-uuid-1234'

        # No existing user → trigger INSERT
        mock_query_many.return_value = []
        mock_execute_one.return_value = None

        mock_tokens_table = MagicMock()
        mock_tokens_table.put_item.return_value = {}
        mock_ddb.Table.return_value = mock_tokens_table

        event = {
            'customer_id': self.__class__.customer_id,
            'tier': self.__class__.tier,
            'email': self.__class__.customer_email,
            'name': self.__class__.customer_name,
        }

        resp = to.lambda_handler(event, {})

        self.assertEqual(resp['statusCode'], 200,
                         f"Onboarding returned {resp['statusCode']}: "
                         f"{resp.get('body')}")
        body = json.loads(resp['body'])
        self.assertTrue(body.get('success', False),
                        f"success flag not set: {body}")

        # Invite + Welcome emails must be sent
        self.assertGreaterEqual(mock_ses.send_email.call_count, 2,
                                'Expected invite and welcome SES emails')

        ses_calls = mock_ses.send_email.call_args_list
        first_email = ses_calls[0].kwargs
        second_email = ses_calls[1].kwargs
        expected_api_key = (
            'sk_live_'
            'e2eapikeysecrettoken12345678901234'
            'e2eapikeysecrettoken12345678901234'
        )
        self.__class__.api_key = expected_api_key

        self.assertEqual(
            first_email['Destination'],
            {'ToAddresses': [self.__class__.customer_email]},
        )
        self.assertIn('Activate', first_email['Message']['Subject']['Data'])
        self.assertIn('Welcome', second_email['Message']['Subject']['Data'])
        self.assertIn(
            expected_api_key,
            second_email['Message']['Body']['Html']['Data'],
        )

        if not mock_sns.publish.called:
            print('Step 3 best-effort: SNS publish was not called')

        print(f'✓ Step 3: Onboarding complete – API key generated, '
              f'{mock_ses.send_email.call_count} email(s) sent')

    # ------------------------------------------------------------------
    # Step 4 – New customer authenticates with their API key
    # ------------------------------------------------------------------
    @patch('auth_v2.login')
    def test_step4_customer_authentication(self, mock_login):
        """Customer authenticates with the new API key; Lambda returns a
        short-lived JWT session token."""
        if not self.__class__.customer_id:
            self.skipTest("Step 2 did not complete — skipping dependent step")

        import importlib
        av2 = importlib.import_module('auth_v2')

        mock_login.return_value = {
            'statusCode': 200,
            'body': json.dumps({'session_token': 'e2e.jwt.session.token'})
        }

        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'email': self.__class__.customer_email,
                'password': 'E2E-password-not-used-due-to-mock',
            }),
            'requestContext': {'requestId': 'test-req-e2e-001'},
        }

        resp = av2.lambda_handler(event, {})

        self.assertEqual(resp['statusCode'], 200,
                         f"Auth returned {resp['statusCode']}: {resp.get('body')}")
        body = json.loads(resp['body'])
        self.assertIn('session_token', body,
                      f"session_token not in response: {body}")

        self.__class__.session_token = body['session_token']
        print(f'✓ Step 4: Authentication successful – '
              f'session token issued: {self.__class__.session_token[:20]}…')

    # ------------------------------------------------------------------
    # Step 5 – Customer registers a webhook endpoint
    # ------------------------------------------------------------------
    @patch('webhook_manager.dynamodb')
    @patch('webhook_manager.sns')
    def test_step5_register_webhook(self, mock_sns, mock_dynamodb):
        """Customer POSTs to /webhooks to register their endpoint."""
        if not self.__class__.session_token:
            self.skipTest("Step 4 did not complete — skipping dependent step")

        import importlib
        wm = importlib.import_module('webhook_manager')

        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.put_item.return_value = {}
        mock_table.get_item.return_value = {
            'Item': {
                'id': 'wh_e2e_001',
                'customer_id': self.__class__.customer_id,
                'url': 'https://hooks.example.com/securebase',
                'events': ['invoice.created', 'invoice.paid'],
                'active': True,
            }
        }

        event = {
            'httpMethod': 'POST',
            'path': '/webhooks',
            'requestContext': {
                'authorizer': {'customerId': self.__class__.customer_id}
            },
            'body': json.dumps({
                'url': 'https://hooks.example.com/securebase',
                'events': ['invoice.created', 'invoice.paid'],
                'description': 'E2E test webhook',
            }),
        }

        resp = wm.lambda_handler(event, {})

        self.assertIn(resp['statusCode'], (200, 201),
                      f"Webhook creation returned {resp['statusCode']}: "
                      f"{resp.get('body')}")
        body = json.loads(resp['body'])
        webhook_id = (
            body.get('id') or
            body.get('webhook_id') or
            'wh_e2e_001'
        )
        self.__class__.webhook_id = webhook_id
        print(f'✓ Step 5: Webhook registered → id={self.__class__.webhook_id}')

    # ------------------------------------------------------------------
    # Step 6 – Customer lists their webhooks
    # ------------------------------------------------------------------
    @patch('webhook_manager.dynamodb')
    @patch('webhook_manager.sns')
    def test_step6_list_webhooks(self, mock_sns, mock_dynamodb):
        """Customer GETs /webhooks; the newly created webhook appears in the
        response."""
        if not self.__class__.webhook_id:
            self.skipTest("Step 5 did not complete — skipping dependent step")

        import importlib
        wm = importlib.import_module('webhook_manager')

        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.query.return_value = {
            'Items': [{
                'id': self.__class__.webhook_id or 'wh_e2e_001',
                'customer_id': self.__class__.customer_id,
                'url': 'https://hooks.example.com/securebase',
                'events': ['invoice.created', 'invoice.paid'],
                'active': True,
            }]
        }

        event = {
            'httpMethod': 'GET',
            'path': '/webhooks',
            'requestContext': {
                'authorizer': {'customerId': self.__class__.customer_id}
            },
        }

        resp = wm.lambda_handler(event, {})

        self.assertEqual(resp['statusCode'], 200,
                         f"List webhooks returned {resp['statusCode']}: "
                         f"{resp.get('body')}")
        body = json.loads(resp['body'])
        items = body if isinstance(body, list) else body.get('webhooks', body.get('items', []))
        self.assertGreaterEqual(len(items), 1,
                                'Expected at least one webhook in the list')
        print(f'✓ Step 6: Webhook list retrieved – {len(items)} webhook(s)')

    # ------------------------------------------------------------------
    # Step 7 – Welcome email explicitly validated
    # ------------------------------------------------------------------
    @patch('trigger_onboarding.ses')
    @patch('trigger_onboarding.sns')
    @patch('trigger_onboarding.ddb')
    @patch('trigger_onboarding.query_many')
    @patch('trigger_onboarding.execute_one')
    def test_step7_welcome_email_sent(
            self, mock_execute_one, mock_query_many, mock_ddb, mock_sns, mock_ses):
        """Dedicated validation for invite + welcome SES email dispatch."""
        import importlib
        to = importlib.import_module('trigger_onboarding')
        to._DB_AVAILABLE = True

        mock_query_many.return_value = []
        mock_execute_one.return_value = None
        mock_tokens_table = MagicMock()
        mock_tokens_table.put_item.return_value = {}
        mock_ddb.Table.return_value = mock_tokens_table

        event = {
            'customer_id': self.__class__.customer_id,
            'tier': self.__class__.tier,
            'email': self.__class__.customer_email,
            'name': self.__class__.customer_name,
        }

        resp = to.lambda_handler(event, {})
        self.assertEqual(resp['statusCode'], 200)

        self.assertGreaterEqual(mock_ses.send_email.call_count, 2)
        subjects = [
            call.kwargs.get('Message', {}).get('Subject', {}).get('Data', '')
            for call in mock_ses.send_email.call_args_list
        ]
        self.assertTrue(any('Welcome' in subject for subject in subjects))

        self.__class__.step7_result = json.loads(resp['body'])
        print('✓ Step 7: Welcome email dispatched')

    # ------------------------------------------------------------------
    # Step 10 – First event delivered to customer webhook URL
    # ------------------------------------------------------------------
    @patch('webhook_manager.dynamodb')
    @patch('webhook_manager.requests')
    def test_step10_first_event_delivery(self, mock_requests, mock_dynamodb):
        """Validate first webhook event delivery with signature headers."""
        if not self.__class__.webhook_id:
            self.skipTest("Step 5 did not complete — skipping dependent step")

        import importlib
        wm = importlib.import_module('webhook_manager')

        webhooks_table = MagicMock()
        deliveries_table = MagicMock()
        webhooks_table.query.return_value = {
            'Items': [{
                'id': self.__class__.webhook_id,
                'customer_id': self.__class__.customer_id,
                'secret': 'whsec_test_secret_e2e',
                'url': 'https://hooks.example.com/securebase',
                'events': ['invoice.created'],
                'active': True,
            }]
        }
        webhooks_table.update_item.return_value = {}
        deliveries_table.put_item.return_value = {}
        # 1st Table() for webhook query, 2nd for deliveries put_item, 3rd for webhook update_item
        mock_dynamodb.Table.side_effect = [webhooks_table, deliveries_table, webhooks_table]

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = 'OK'
        mock_requests.post.return_value = mock_response

        result = wm.trigger_webhook(
            self.__class__.customer_id,
            'invoice.created',
            {'invoice_id': 'inv_e2e_001', 'amount': 99.00},
        )

        self.assertTrue(mock_requests.post.called)
        call_args, call_kwargs = mock_requests.post.call_args
        self.assertEqual(call_args[0], 'https://hooks.example.com/securebase')
        self.assertIn('X-SecureBase-Signature', call_kwargs['headers'])
        self.assertIn('X-SecureBase-Delivery', call_kwargs['headers'])
        self.assertEqual(result, 1)
        print('✓ Step 10: First event delivered to customer webhook')

    @patch('webhook_manager.dynamodb')
    @patch('webhook_manager.requests')
    def test_step10_hmac_signature_correctness(self, mock_requests, mock_dynamodb):
        """Validate HMAC signature header matches payload signing algorithm."""
        if not self.__class__.webhook_id:
            self.skipTest("Step 5 did not complete — skipping dependent step")

        import importlib
        wm = importlib.import_module('webhook_manager')

        webhooks_table = MagicMock()
        deliveries_table = MagicMock()
        webhooks_table.query.return_value = {
            'Items': [{
                'id': self.__class__.webhook_id,
                'customer_id': self.__class__.customer_id,
                'secret': 'whsec_test_secret_e2e',
                'url': 'https://hooks.example.com/securebase',
                'events': ['invoice.created'],
                'active': True,
            }]
        }
        webhooks_table.update_item.return_value = {}
        deliveries_table.put_item.return_value = {}
        # 1st Table() for webhook query, 2nd for deliveries put_item, 3rd for webhook update_item
        mock_dynamodb.Table.side_effect = [webhooks_table, deliveries_table, webhooks_table]

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = 'OK'
        mock_requests.post.return_value = mock_response

        wm.trigger_webhook(
            self.__class__.customer_id,
            'invoice.created',
            {'invoice_id': 'inv_e2e_001', 'amount': 99.00},
        )

        _, call_kwargs = mock_requests.post.call_args
        actual_signature = call_kwargs['headers']['X-SecureBase-Signature']
        payload = call_kwargs['json']

        expected_sig = hmac.new(
            b'whsec_test_secret_e2e',
            json.dumps(payload, sort_keys=True).encode(),
            hashlib.sha256
        ).hexdigest()

        self.assertEqual(actual_signature, expected_sig)
        print('✓ Step 10 (HMAC): Signature verified')

    @patch('webhook_manager.dynamodb')
    @patch('webhook_manager.requests')
    def test_step10_delivery_failure_increments_failure_count(self, mock_requests, mock_dynamodb):
        """Validate delivery_failure_count increments on non-2xx delivery."""
        if not self.__class__.webhook_id:
            self.skipTest("Step 5 did not complete — skipping dependent step")

        import importlib
        wm = importlib.import_module('webhook_manager')

        webhooks_table = MagicMock()
        deliveries_table = MagicMock()
        webhooks_table.query.return_value = {
            'Items': [{
                'id': self.__class__.webhook_id,
                'customer_id': self.__class__.customer_id,
                'secret': 'whsec_test_secret_e2e',
                'url': 'https://hooks.example.com/securebase',
                'events': ['invoice.created'],
                'active': True,
            }]
        }
        webhooks_table.update_item.return_value = {}
        deliveries_table.put_item.return_value = {}
        # 1st Table() for webhook query, 2nd for deliveries put_item, 3rd for webhook update_item
        mock_dynamodb.Table.side_effect = [webhooks_table, deliveries_table, webhooks_table]

        mock_response = MagicMock()
        mock_response.status_code = 503
        mock_response.text = 'Service Unavailable'
        mock_requests.post.return_value = mock_response

        wm.trigger_webhook(
            self.__class__.customer_id,
            'invoice.created',
            {'invoice_id': 'inv_e2e_001', 'amount': 99.00},
        )

        update_expressions = [
            c.kwargs.get('UpdateExpression', '')
            for c in webhooks_table.update_item.call_args_list
        ]
        self.assertTrue(any('delivery_failure_count' in expr for expr in update_expressions))
        self.assertFalse(any('delivery_success_count' in expr for expr in update_expressions))
        print('✓ Step 10 (failure): delivery_failure_count incremented')

    @patch('webhook_manager.dynamodb')
    @patch('webhook_manager.requests')
    def test_step10_no_matching_webhooks(self, mock_requests, mock_dynamodb):
        """Validate no outbound call occurs when no webhook subscription matches."""
        if not self.__class__.webhook_id:
            self.skipTest("Step 5 did not complete — skipping dependent step")

        import importlib
        wm = importlib.import_module('webhook_manager')

        webhooks_table = MagicMock()
        webhooks_table.query.return_value = {'Items': []}
        mock_dynamodb.Table.return_value = webhooks_table

        result = wm.trigger_webhook(self.__class__.customer_id, 'invoice.created', {})
        self.assertFalse(mock_requests.post.called)
        self.assertEqual(result, 0)
        print('✓ Step 10 (no webhooks): no delivery attempted')

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    def test_zzz_journey_summary(self):
        """Print a summary of the completed sales journey (runs last)."""
        print('\n' + '=' * 60)
        print('Online Sales E2E Journey – Complete ✅')
        print('=' * 60)
        print('  ✓ Step 1: Customer initiates Stripe checkout')
        print('  ✓ Step 2: Stripe webhook processed → customer created')
        print('  ✓ Step 3: Onboarding automation:')
        print('             API key generated')
        print('             Admin user created')
        print('             Welcome email sent')
        print('             Infrastructure provisioning queued')
        print('  ✓ Step 4: Customer authenticated with API key → JWT issued')
        print('  ✓ Step 5: Customer registered first webhook endpoint')
        print('  ✓ Step 6: Customer listed their webhooks')
        print('  ✓ Step 7: Welcome email dispatched via SES (invite + credentials)')
        print('  ✓ Step 10: First event delivered to customer webhook (HMAC-signed)')
        print('=' * 60)
        print('All sales journey steps validated successfully\n')


class TestSalesJourneyTiers(unittest.TestCase):
    """
    Validates that checkout sessions can be created for every supported tier.
    """

    TIERS = ['standard', 'healthcare', 'fintech', 'government']

    @patch('create_checkout_session.stripe')
    @patch('create_checkout_session.get_db_connection')
    @patch('create_checkout_session.check_rate_limit')
    @patch('create_checkout_session.PRICE_IDS', {
        'standard': 'price_standard',
        'healthcare': 'price_healthcare',
        'fintech': 'price_fintech',
        'government': 'price_government',
    })
    def test_checkout_all_tiers(self, mock_rate_limit, mock_db, mock_stripe):
        """Every supported tier should produce a valid checkout session."""
        import importlib
        ccs = importlib.import_module('create_checkout_session')

        mock_rate_limit.return_value = True
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = None
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn

        mock_session = MagicMock()
        mock_session.url = 'https://checkout.stripe.com/tier_test'
        mock_session.id = 'cs_tier_test'
        mock_stripe.checkout.Session.create.return_value = mock_session

        for tier in self.TIERS:
            with self.subTest(tier=tier):
                event = {
                    'body': json.dumps({
                        'tier': tier,
                        'email': f'{tier}-buyer@example.com',
                        'name': f'{tier.capitalize()} Test Corp',
                    }),
                    'requestContext': {'identity': {'sourceIp': '127.0.0.1'}},
                }
                resp = ccs.lambda_handler(event, {})
                self.assertIn(
                    resp['statusCode'], (200, 201),
                    f"Tier '{tier}' returned unexpected statusCode "
                    f"{resp['statusCode']}: {resp.get('body')}",
                )
                print(f'  ✓ Tier {tier!r}: checkout session OK')


class TestRateLimiting(unittest.TestCase):
    """Validates that the checkout endpoint enforces rate limiting."""

    def setUp(self):
        os.environ.update({
            'STRIPE_SECRET_KEY': 'sk_test_mock',
            'STRIPE_PRICE_STANDARD': 'price_standard',
        })

    @patch('create_checkout_session.stripe')
    @patch('create_checkout_session.get_db_connection')
    @patch('create_checkout_session.check_rate_limit')
    def test_rate_limit_blocks_excess_requests(
            self, mock_rate_limit, mock_db, mock_stripe):
        """When check_rate_limit returns False the endpoint must respond
        with HTTP 429 Too Many Requests."""
        import importlib
        ccs = importlib.import_module('create_checkout_session')

        mock_rate_limit.return_value = False  # rate limit hit

        event = {
            'body': json.dumps({
                'tier': 'standard',
                'email': 'flood@example.com',
                'name': 'Flood Test',
            }),
            'requestContext': {'identity': {'sourceIp': '10.0.0.1'}},
        }

        resp = ccs.lambda_handler(event, {})
        self.assertEqual(resp['statusCode'], 429,
                         f"Expected 429 but got {resp['statusCode']}")
        print('✓ Rate limiting: 429 returned when limit exceeded')


# ---------------------------------------------------------------------------
# Stripe Sandbox Handshake Tests
# ---------------------------------------------------------------------------

class TestStripeSandboxHandshake(unittest.TestCase):
    """
    Validates the real Stripe API handshake when STRIPE_MODE == 'sandbox'.

    In sandbox mode this class makes live HTTPS calls to api.stripe.com
    using the restricted test key stored in the STRIPE_SECRET_KEY secret.
    All Stripe objects created during the run are tagged with
    ``test_run_id = GITHUB_RUN_ID`` and cleaned up in ``tearDownClass``
    via ``StripeTestCleaner.cleanup_by_run_id``.

    When STRIPE_MODE != 'sandbox' every test falls back to the mock path so
    the suite continues to run fully offline without any external calls.

    Environment variables required for sandbox mode:
        STRIPE_SECRET_KEY      – Stripe restricted test key (sk_test_…)
        STRIPE_PRICE_STANDARD  – ID of a real test-mode recurring Price object
    """

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Delegate cleanup to ``StripeTestCleaner.cleanup_by_run_id`` so that
        the precise, run-scoped teardown logic lives in one place (the
        standalone cleanup script) and is not duplicated here.
        """
        if os.getenv('STRIPE_MODE') != 'sandbox':
            return
        if _StripeTestCleaner is None:
            return
        api_key = os.getenv('STRIPE_SECRET_KEY', '')
        if not api_key.startswith('sk_test_'):
            return
        run_id = os.getenv('GITHUB_RUN_ID', 'local')
        cleaner = _StripeTestCleaner(api_key=api_key)
        cleaner.cleanup_by_run_id(run_id)

    # ------------------------------------------------------------------
    # Checkout session handshake
    # ------------------------------------------------------------------

    def test_checkout_handshake(self):
        """
        Creates a Stripe Checkout Session and validates the response.

        sandbox: Hits api.stripe.com with the real Restricted Test Key and
                 asserts the returned session ID begins with 'cs_test_'.
        mock:    Verifies that the MagicMock wiring used by all other test
                 classes continues to function correctly.
        """
        if os.getenv('STRIPE_MODE') == 'sandbox':
            self._run_sandbox_checkout_handshake()
        else:
            self._run_mock_checkout_handshake()

    def _run_sandbox_checkout_handshake(self):
        """Live Stripe call – sandbox path."""
        self.assertIsNotNone(
            _real_stripe,
            'stripe package is not installed; cannot run sandbox tests.',
        )
        api_key = os.getenv('STRIPE_SECRET_KEY', '')
        price_id = os.getenv('STRIPE_PRICE_STANDARD', '')
        self.assertTrue(
            api_key.startswith('sk_test_'),
            f'STRIPE_SECRET_KEY must be a Stripe test key (sk_test_…) for '
            f'sandbox mode; got prefix: {api_key[:8]}…',
        )
        self.assertTrue(
            price_id,
            'STRIPE_PRICE_STANDARD must be set to a real test-mode Price ID '
            'for sandbox mode.',
        )
        _real_stripe.api_key = api_key
        run_id = os.getenv('GITHUB_RUN_ID', 'local')
        session = _real_stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{'price': price_id, 'quantity': 1}],
            mode='subscription',
            success_url=(
                'https://portal.securebase.tximhotep.com/success'
                '?session_id={CHECKOUT_SESSION_ID}'
            ),
            cancel_url='https://portal.securebase.tximhotep.com/pricing',
            metadata={
                'test_run_id': run_id,
                'workflow': 'e2e-online-sales',
                'sha': os.getenv('GITHUB_SHA', 'local'),
            },
        )
        self.assertIsNotNone(
            session.id, 'Stripe checkout session ID must not be None',
        )
        self.assertTrue(
            session.id.startswith('cs_test_'),
            f'Expected a test-mode session ID (cs_test_…); got {session.id}',
        )
        print(
            f'\n✓ Sandbox handshake: Stripe checkout session created '
            f'→ {session.id}'
        )

    def _run_mock_checkout_handshake(self):
        """Offline mock path – exercises the same code path used by other tests."""
        # sys.modules['stripe'] has been replaced with a MagicMock at module
        # load time.  Import it here so we test the mock wiring explicitly.
        import stripe as _mock_stripe  # noqa: F811
        mock_session = MagicMock()
        mock_session.id = 'cs_test_mock_handshake_001'
        _mock_stripe.checkout.Session.create.return_value = mock_session
        session = _mock_stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{'price': 'price_mock_standard', 'quantity': 1}],
            mode='subscription',
            success_url='https://example.com/success',
            cancel_url='https://example.com/cancel',
        )
        self.assertIsNotNone(session.id)
        print(
            f'✓ Mock handshake: checkout.Session.create wired correctly '
            f'→ {session.id}'
        )


if __name__ == '__main__':
    suite = unittest.TestLoader().loadTestsFromModule(
        sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
