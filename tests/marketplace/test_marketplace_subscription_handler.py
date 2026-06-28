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
    @patch('marketplace_subscription_handler._audit_get_entitlements', return_value=[])
    @patch('marketplace_subscription_handler._publish_ceo_alert')
    @patch('marketplace_subscription_handler._update_customer_status')
    @patch('marketplace_subscription_handler._upsert_audit_event')
    @patch('marketplace_subscription_handler._lookup_customer')
    def test_subscribe_success_updates_customer(
        self, mock_lookup, mock_audit, mock_update, _mock_alert, _mock_entitlements, _mock_verify
    ):
        from marketplace_subscription_handler import lambda_handler

        mock_lookup.return_value = 'uuid-1'
        mock_audit.return_value = True

        resp = lambda_handler(sns_event('subscribe-success'), None)

        self.assertEqual(resp['statusCode'], 200)
        # No entitlement dimension resolved -> tier is None (status still set).
        mock_update.assert_called_once_with('uuid-1', 'active', 'active', tier=None)

    @patch('marketplace_subscription_handler._verify_sns_signature', return_value=True)
    @patch('marketplace_subscription_handler._audit_get_entitlements')
    @patch('marketplace_subscription_handler._publish_ceo_alert')
    @patch('marketplace_subscription_handler._update_customer_status')
    @patch('marketplace_subscription_handler._upsert_audit_event')
    @patch('marketplace_subscription_handler._lookup_customer')
    def test_subscribe_success_sets_tier_from_entitlement(
        self, mock_lookup, mock_audit, mock_update, _mock_alert, mock_entitlements, _mock_verify
    ):
        """GAP #5: tier is derived from the GetEntitlements response and persisted."""
        from marketplace_subscription_handler import lambda_handler

        mock_lookup.return_value = 'uuid-1'
        mock_audit.return_value = True
        # fintech_monthly dimension -> 'fintech' tier
        mock_entitlements.return_value = [{'Dimension': 'fintech_monthly'}]

        resp = lambda_handler(sns_event('subscribe-success'), None)

        self.assertEqual(resp['statusCode'], 200)
        # Exactly one GetEntitlements call per subscribe (no second round-trip).
        mock_entitlements.assert_called_once_with('cust-abc123')
        mock_update.assert_called_once_with('uuid-1', 'active', 'active', tier='fintech')

    @patch('marketplace_subscription_handler._verify_sns_signature', return_value=True)
    @patch('marketplace_subscription_handler._audit_get_entitlements')
    @patch('marketplace_subscription_handler._publish_ceo_alert')
    @patch('marketplace_subscription_handler._update_customer_status')
    @patch('marketplace_subscription_handler._upsert_audit_event')
    @patch('marketplace_subscription_handler._upsert_pending_customer')
    @patch('marketplace_subscription_handler._lookup_customer')
    def test_subscribe_success_without_registration_creates_pending_customer(
        self, mock_lookup, mock_upsert_pending, mock_audit, mock_update, mock_alert, mock_entitlements, _mock_verify
    ):
        """GAP #6: a subscribe-success with no matching customer creates a PENDING customer + alerts."""
        from marketplace_subscription_handler import lambda_handler

        mock_lookup.return_value = None  # no registered customer
        mock_upsert_pending.return_value = 'pending-uuid'
        mock_audit.return_value = True
        mock_entitlements.return_value = [{'Dimension': 'healthcare_monthly'}]

        resp = lambda_handler(sns_event('subscribe-success'), None)

        body = json.loads(resp['body'])
        self.assertEqual(resp['statusCode'], 200)
        self.assertEqual(body['processed'], 1)
        self.assertEqual(body['skipped'], 0)
        # Pending customer synthesized with the entitled tier.
        mock_upsert_pending.assert_called_once_with('cust-abc123', 'healthcare')
        # Audit + status persisted against the new pending customer id.
        mock_audit.assert_called_once()
        self.assertEqual(mock_audit.call_args.args[0], 'pending-uuid')
        mock_update.assert_called_once_with('pending-uuid', 'active', 'active', tier='healthcare')
        # CEO alerted to the out-of-band subscribe.
        mock_alert.assert_any_call('subscribe-without-registration', 'cust-abc123')

    @patch('marketplace_subscription_handler._verify_sns_signature', return_value=True)
    @patch('marketplace_subscription_handler._publish_ceo_alert')
    @patch('marketplace_subscription_handler._update_customer_status')
    @patch('marketplace_subscription_handler._upsert_audit_event')
    @patch('marketplace_subscription_handler._upsert_pending_customer')
    @patch('marketplace_subscription_handler._lookup_customer')
    def test_non_subscribe_event_without_customer_is_skipped(
        self, mock_lookup, mock_upsert_pending, mock_audit, mock_update, _mock_alert, _mock_verify
    ):
        """GAP #6 scope guard: non-subscribe events with no customer are still skipped (no PENDING row)."""
        from marketplace_subscription_handler import lambda_handler

        mock_lookup.return_value = None

        resp = lambda_handler(sns_event('unsubscribe-pending'), None)

        body = json.loads(resp['body'])
        self.assertEqual(resp['statusCode'], 200)
        self.assertEqual(body['processed'], 0)
        self.assertEqual(body['skipped'], 1)
        mock_upsert_pending.assert_not_called()
        mock_audit.assert_not_called()
        mock_update.assert_not_called()

    def test_tier_from_entitlements_maps_dimensions(self):
        """GAP #5 unit: dimension -> tier mapping, including Value-nested dimensions and misses."""
        import marketplace_subscription_handler as handler

        self.assertEqual(handler._tier_from_entitlements([{'Dimension': 'government_monthly'}]), 'gov-federal')
        self.assertEqual(
            handler._tier_from_entitlements([{'Value': {'StringValue': 'standard_monthly'}}]),
            'standard',
        )
        self.assertIsNone(handler._tier_from_entitlements([]))
        self.assertIsNone(handler._tier_from_entitlements([{'Dimension': 'unknown_dim'}]))

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
             patch('cryptography.x509.load_pem_x509_certificate', return_value=cert_mock):
            verified = handler._verify_sns_signature(sns_event('subscribe-success')['Records'][0])

        self.assertTrue(verified)
        cert_mock.public_key.return_value.verify.assert_called_once()


if __name__ == '__main__':
    unittest.main()
