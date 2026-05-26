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
os.environ['MARKETPLACE_PRODUCT_CODE'] = ''

sys.modules.setdefault('psycopg2', MagicMock())
sys.modules.setdefault('psycopg2.pool', MagicMock())
sys.modules.setdefault('psycopg2.extras', MagicMock())
sys.modules.setdefault('db_utils', MagicMock())


class TestMarketplaceResolveCustomer(unittest.TestCase):
    @patch('marketplace_resolve_customer._trigger_onboarding')
    @patch('marketplace_resolve_customer._insert_marketplace_customer')
    @patch('marketplace_resolve_customer._get_customer_by_marketplace_id')
    @patch('marketplace_resolve_customer.metering_client')
    def test_new_customer_creation(self, mock_metering, mock_get_existing, mock_insert, mock_onboard):
        from marketplace_resolve_customer import lambda_handler

        mock_metering.resolve_customer.return_value = {
            'CustomerIdentifier': 'cust-abc123',
            'ProductCode': 'prod-xyz',
        }
        mock_get_existing.return_value = None
        mock_insert.return_value = 'uuid-123'

        event = {'body': json.dumps({'token': 'valid-token'})}
        response = lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertEqual(body['customer_id'], 'uuid-123')
        mock_insert.assert_called_once()
        mock_onboard.assert_called_once()

    @patch('marketplace_resolve_customer._get_customer_by_marketplace_id')
    @patch('marketplace_resolve_customer.metering_client')
    def test_idempotent_existing_customer(self, mock_metering, mock_get_existing):
        from marketplace_resolve_customer import lambda_handler

        mock_metering.resolve_customer.return_value = {
            'CustomerIdentifier': 'cust-abc123',
            'ProductCode': 'prod-xyz',
        }
        mock_get_existing.return_value = ('uuid-existing', 'cust-abc123', 'prod-xyz')

        event = {'body': json.dumps({'token': 'valid-token'})}
        response = lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertTrue(body['idempotent'])
        self.assertEqual(body['customer_id'], 'uuid-existing')

    @patch('marketplace_resolve_customer.metering_client')
    def test_invalid_token(self, mock_metering):
        from botocore.exceptions import ClientError
        from marketplace_resolve_customer import lambda_handler

        mock_metering.resolve_customer.side_effect = ClientError(
            {'Error': {'Code': 'InvalidTokenException', 'Message': 'Bad token'}},
            'ResolveCustomer',
        )

        event = {'body': json.dumps({'token': 'bad-token'})}
        response = lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertEqual(body['error'], 'invalid_token')


if __name__ == '__main__':
    unittest.main()
