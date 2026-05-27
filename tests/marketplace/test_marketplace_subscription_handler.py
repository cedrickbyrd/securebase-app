import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FUNCTIONS = os.path.join(REPO_ROOT, 'phase2-backend', 'functions')
if FUNCTIONS not in sys.path:
    sys.path.insert(0, FUNCTIONS)

os.environ.setdefault('AWS_DEFAULT_REGION', 'us-east-1')
os.environ.setdefault('AWS_ACCESS_KEY_ID', 'test')
os.environ.setdefault('AWS_SECRET_ACCESS_KEY', 'test')

sys.modules.setdefault('psycopg2', MagicMock())
sys.modules.setdefault('psycopg2.pool', MagicMock())
sys.modules.setdefault('psycopg2.extras', MagicMock())
sys.modules.setdefault('db_utils', MagicMock())

def sns_event(event_type):
    return {
        'Records': [{
            'Sns': {
                'MessageId': f'msg-{event_type}',
                'Message': json.dumps({
                    'eventType': event_type,
                    'customerIdentifier': 'cust-abc123',
                }),
                'Signature': 'sig',
                'SignatureVersion': '1',
                'SigningCertUrl': 'https://sns.us-east-1.amazonaws.com/cert.pem',
            }
        }]
    }


class TestMarketplaceSubscriptionHandler(unittest.TestCase):
    @patch('marketplace_subscription_handler._verify_sns_signature', return_value=True)
    @patch('marketplace_subscription_handler._publish_ceo_alert')
    @patch('marketplace_subscription_handler._update_customer_status')
    @patch('marketplace_subscription_handler._upsert_audit_event')
    @patch('marketplace_subscription_handler._lookup_customer')
    def test_subscribe_success_updates_customer(self, mock_lookup, mock_audit, mock_update, _mock_alert, _mock_verify):
        from marketplace_subscription_handler import lambda_handler

        mock_lookup.return_value = 'uuid-1'
        mock_audit.return_value = True

        resp = lambda_handler(sns_event('subscribe-success'), None)

        self.assertEqual(resp['statusCode'], 200)
        mock_update.assert_called_once_with('uuid-1', 'active', 'active')

    @patch('marketplace_subscription_handler._verify_sns_signature', return_value=True)
    @patch('marketplace_subscription_handler._publish_ceo_alert')
    @patch('marketplace_subscription_handler._update_customer_status')
    @patch('marketplace_subscription_handler._upsert_audit_event')
    @patch('marketplace_subscription_handler._lookup_customer')
    def test_unsubscribe_pending_updates_subscription_status(self, mock_lookup, mock_audit, mock_update, _mock_alert, _mock_verify):
        from marketplace_subscription_handler import lambda_handler

        mock_lookup.return_value = 'uuid-1'
        mock_audit.return_value = True

        resp = lambda_handler(sns_event('unsubscribe-pending'), None)

        self.assertEqual(resp['statusCode'], 200)
        mock_update.assert_called_once_with('uuid-1', 'unsubscribe-pending', 'unsubscribe-pending')

    @patch('marketplace_subscription_handler._verify_sns_signature', return_value=True)
    @patch('marketplace_subscription_handler._refresh_entitlements')
    @patch('marketplace_subscription_handler._update_customer_status')
    @patch('marketplace_subscription_handler._upsert_audit_event')
    @patch('marketplace_subscription_handler._lookup_customer')
    def test_entitlement_updated_refreshes(self, mock_lookup, mock_audit, mock_update, mock_refresh, _mock_verify):
        from marketplace_subscription_handler import lambda_handler

        mock_lookup.return_value = 'uuid-2'
        mock_audit.return_value = True
        mock_refresh.return_value = ('inactive', None)

        resp = lambda_handler(sns_event('entitlement-updated'), None)

        self.assertEqual(resp['statusCode'], 200)
        mock_update.assert_called_once_with('uuid-2', 'inactive', None, tier=None)

    @patch('marketplace_subscription_handler._lookup_customer')
    def test_invalid_signature_skipped(self, mock_lookup):
        with patch.dict(os.environ, {'BYPASS_SNS_SIGNATURE_VERIFY': 'false'}):
            from importlib import reload
            import marketplace_subscription_handler as handler
            handler = reload(handler)

        self.assertFalse(handler._verify_sns_signature({'Sns': {'SignatureVersion': '2'}}))
        mock_lookup.assert_not_called()

    def test_verify_signature_cryptographically(self):
        import marketplace_subscription_handler as handler

        handler.BYPASS_SNS_SIGNATURE_VERIFY = False
        cert_mock = MagicMock()
        cert_mock.public_key.return_value.verify.return_value = None
        handler.SNS_CERT_CACHE.clear()

        response_mock = MagicMock()
        response_mock.read.return_value = b'fake-pem'
        response_mock.__enter__.return_value = response_mock
        with patch('marketplace_subscription_handler.base64.b64decode', return_value=b'signature'), \
             patch('marketplace_subscription_handler.urlopen', return_value=response_mock), \
             patch('marketplace_subscription_handler.x509.load_pem_x509_certificate', return_value=cert_mock):
            verified = handler._verify_sns_signature(sns_event('subscribe-success')['Records'][0])

        self.assertTrue(verified)
        cert_mock.public_key.return_value.verify.assert_called_once()


if __name__ == '__main__':
    unittest.main()
