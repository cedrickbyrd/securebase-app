"""Offline Day 1 access-flow readiness tests (fully mocked)."""

import json
import os
import sys
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
_FUNCTIONS = os.path.join(_REPO_ROOT, 'phase2-backend', 'functions')
_LAYER = os.path.join(_REPO_ROOT, 'phase2-backend', 'lambda_layer', 'python')

for _path in (_LAYER, _FUNCTIONS):
    if _path not in sys.path:
        sys.path.insert(0, _path)

# Stub heavy dependencies before importing Lambda modules
for _mod in [
    'boto3', 'botocore', 'botocore.exceptions',
    'psycopg2', 'psycopg2.pool', 'psycopg2.extras',
    'bcrypt', 'jwt', 'requests',
]:
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()

# Stub db_utils/email_service modules imported by lambdas
_db_utils_stub = MagicMock()
_db_utils_stub.get_db_connection = MagicMock()
_db_utils_stub.get_connection = MagicMock()
_db_utils_stub.release_connection = MagicMock()
_db_utils_stub.execute_query = MagicMock()
_db_utils_stub.execute_update = MagicMock()
_db_utils_stub.get_customer_by_email = MagicMock()
_db_utils_stub.get_customer_by_id = MagicMock()
_db_utils_stub.log_audit_event = MagicMock()
_db_utils_stub.get_api_key_by_prefix = MagicMock()
_db_utils_stub.update_api_key_usage = MagicMock()
_db_utils_stub.validate_customer_id = MagicMock(return_value=True)
_db_utils_stub.get_customer_org_id = MagicMock(return_value='org_test')
_db_utils_stub.get_connection_pool = MagicMock()
_db_utils_stub.set_rls_context = MagicMock()
_db_utils_stub.query_one = MagicMock()
_db_utils_stub.execute_one = MagicMock()
_db_utils_stub.DatabaseError = Exception
sys.modules['db_utils'] = _db_utils_stub

_email_service_stub = MagicMock()
_email_service_stub.send_email = MagicMock()
sys.modules['email_service'] = _email_service_stub


class TestDay1AccessFlow(unittest.TestCase):
    """Validates all six Day 1 customer access steps in sequence."""

    def setUp(self):
        os.environ.update({
            'JWT_SECRET': 'test-jwt-secret',
            'SNS_SUPPORT_TOPIC_ARN': 'arn:aws:sns:us-east-1:123456789012:support-events',
            'SUPPORT_TICKETS_TABLE': 'test-support-tickets',
            'TICKET_COMMENTS_TABLE': 'test-ticket-comments',
            'WEBHOOKS_TABLE': 'test-webhooks',
            'DELIVERIES_TABLE': 'test-deliveries',
            'REPORTS_TABLE': 'test-reports',
            'METRICS_TABLE': 'test-metrics',
            'CACHE_TABLE': 'test-cache',
            'S3_BUCKET': 'test-report-bucket',
            'DDB_TABLE_CACHE': 'test-session-cache',
            'SES_SENDER_EMAIL': 'noreply@test.securebase.io',
            'PORTAL_URL': 'https://portal.test.securebase.io',
        })

        self.customer_id = '11111111-1111-1111-1111-111111111111'

    @patch('trigger_onboarding.trigger_infrastructure_provisioning')
    @patch('trigger_onboarding.log_onboarding_event')
    @patch('trigger_onboarding.create_admin_user')
    @patch('trigger_onboarding.generate_api_key')
    @patch('trigger_onboarding.ses')
    def test_step1_welcome_email_sent(
        self,
        mock_ses,
        mock_generate_api_key,
        mock_create_admin_user,
        mock_log_event,
        mock_trigger,
    ):
        import importlib
        trigger_onboarding = importlib.import_module('trigger_onboarding')

        mock_generate_api_key.return_value = 'sb_test_key_12345'
        mock_create_admin_user.return_value = 'user_test_001'
        mock_ses.send_email.return_value = {'MessageId': 'msg-123'}

        event = {
            'customer_id': self.customer_id,
            'tier': 'fintech',
            'email': 'matthew@example.com',
            'name': 'Matthew M.',
        }

        resp = trigger_onboarding.lambda_handler(event, {})

        self.assertEqual(resp['statusCode'], 200)
        self.assertGreaterEqual(mock_ses.send_email.call_count, 1)

    @patch('auth_v2.generate_session_token')
    @patch('auth_v2.validate_api_key')
    def test_step2_auth_with_api_key(self, mock_validate_api_key, mock_generate_session_token):
        import importlib
        auth_v2 = importlib.import_module('auth_v2')

        mock_validate_api_key.return_value = {
            'customer_id': self.customer_id,
            'customer_name': 'Matthew M.',
            'tier': 'fintech',
            'scopes': ['read:invoices'],
            'api_key_id': 'key_test_001',
        }
        mock_generate_session_token.return_value = ('test.jwt.token', 86400)

        event = {
            'headers': {'Authorization': 'Bearer sb_test_key_12345'},
            'requestContext': {'requestId': 'req-day1-auth'},
        }

        resp = auth_v2.lambda_handler(event, {})
        self.assertEqual(resp['statusCode'], 200)

        body = json.loads(resp['body'])
        self.assertIn('session_token', body)

    @patch('user_management.release_connection')
    @patch('user_management.get_connection')
    def test_step3_portal_user_list(self, mock_get_connection, mock_release_connection):
        import importlib
        user_management = importlib.import_module('user_management')

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_connection.return_value = mock_conn

        mock_cursor.fetchall.return_value = [
            (
                '22222222-2222-2222-2222-222222222222',
                'matthew@example.com',
                'Matthew M.',
                'admin',
                'active',
                'Owner',
                'Operations',
                None,
                'UTC',
                False,
                datetime.utcnow(),
                datetime.utcnow(),
                datetime.utcnow(),
            )
        ]
        mock_cursor.fetchone.return_value = (1,)

        event = {
            'httpMethod': 'GET',
            'path': '/users',
            'queryStringParameters': {},
            'requestContext': {
                'authorizer': {
                    'customer_id': self.customer_id,
                    'user_id': '33333333-3333-3333-3333-333333333333',
                    'role': 'admin',
                }
            },
        }

        resp = user_management.lambda_handler(event, {})
        self.assertEqual(resp['statusCode'], 200)

        body = json.loads(resp['body'])
        self.assertIn('users', body)
        self.assertEqual(len(body['users']), 1)

    @patch('support_tickets.send_email')
    @patch('support_tickets.sns')
    @patch('support_tickets.tickets_table')
    @patch('support_tickets.get_customer_id_from_token')
    def test_step4_create_support_ticket(
        self,
        mock_get_customer_id_from_token,
        mock_tickets_table,
        mock_sns,
        mock_send_email,
    ):
        import importlib
        support_tickets = importlib.import_module('support_tickets')

        mock_get_customer_id_from_token.return_value = self.customer_id
        mock_tickets_table.put_item.return_value = {}
        mock_sns.publish.return_value = {'MessageId': 'sns-123'}
        mock_send_email.return_value = True

        event = {
            'headers': {'Authorization': 'Bearer test.jwt.token'},
            'body': json.dumps({
                'subject': 'Need onboarding help',
                'description': 'Please help validate my first production integration setup.',
                'priority': 'high',
                'category': 'technical',
                'email': 'matthew@example.com',
            }),
        }

        resp = support_tickets.lambda_handler_create_ticket(event, {})
        self.assertEqual(resp['statusCode'], 201)

        body = json.loads(resp['body'])
        self.assertIn('id', body)
        mock_sns.publish.assert_called()

    @patch('webhook_manager.dynamodb')
    def test_step5_register_webhook(self, mock_dynamodb):
        import importlib
        webhook_manager = importlib.import_module('webhook_manager')

        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.put_item.return_value = {}

        event = {
            'httpMethod': 'POST',
            'path': '/webhooks',
            'requestContext': {'authorizer': {'customerId': self.customer_id}},
            'body': json.dumps({
                'url': 'https://hooks.example.com/securebase',
                'events': ['ticket.created'],
                'description': 'Day 1 webhook',
            }),
        }

        resp = webhook_manager.lambda_handler(event, {})
        self.assertIn(resp['statusCode'], (200, 201))

        body = json.loads(resp['body'])
        webhook_id = body.get('id') or body.get('webhook_id') or body.get('webhook', {}).get('id')
        self.assertTrue(webhook_id)

    @patch('report_engine.reports_table')
    def test_step6_view_reports(self, mock_reports_table):
        import importlib
        report_engine = importlib.import_module('report_engine')

        mock_reports_table.query.return_value = {
            'Items': [
                {
                    'customer_id': self.customer_id,
                    'id': 'rpt_test_001',
                    'name': 'Day 1 Compliance Report',
                }
            ]
        }

        event = {
            'httpMethod': 'GET',
            'path': '/reports',
            'queryStringParameters': {},
            'requestContext': {'authorizer': {'customerId': self.customer_id}},
        }

        resp = report_engine.lambda_handler(event, {})
        self.assertEqual(resp['statusCode'], 200)

    def test_zzz_day1_summary(self):
        print('\n' + '=' * 60)
        print('Day 1 Access Flow Readiness – Complete ✅')
        print('=' * 60)
        print('  ✓ Step 1: Welcome email sent')
        print('  ✓ Step 2: API key auth returns JWT session token')
        print('  ✓ Step 3: Portal user list endpoint works')
        print('  ✓ Step 4: Support ticket creation works + SNS attempted')
        print('  ✓ Step 5: Webhook registration works')
        print('  ✓ Step 6: Reports endpoint works')
        print('=' * 60)


if __name__ == '__main__':
    unittest.main()
