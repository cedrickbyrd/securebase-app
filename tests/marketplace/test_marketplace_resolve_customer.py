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
sys.modules.setdefault('jwt', MagicMock())


class TestMarketplaceResolveCustomer(unittest.TestCase):
    @patch('marketplace_resolve_customer._mint_marketplace_jwt', return_value='jwt-token')
    @patch('marketplace_resolve_customer._trigger_onboarding')
    @patch('marketplace_resolve_customer._insert_marketplace_customer')
    @patch('marketplace_resolve_customer._get_customer_by_marketplace_id')
    @patch('marketplace_resolve_customer.metering_client')
    def test_new_customer_creation(self, mock_metering, mock_get_existing, mock_insert, mock_onboard, mock_mint):
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
        self.assertEqual(body['token'], 'jwt-token')
        self.assertEqual(body['user']['email'], 'marketplace+cust-abc123@securebase.local')
        mock_metering.resolve_customer.assert_called_once_with(RegistrationToken='valid-token')
        mock_insert.assert_called_once_with('cust-abc123', 'prod-xyz', 'standard', 'cis')
        mock_onboard.assert_called_once_with('uuid-123', 'marketplace+cust-abc123@securebase.local', 'standard')
        mock_mint.assert_called_once_with('uuid-123', 'marketplace+cust-abc123@securebase.local', 'standard')

    @patch('marketplace_resolve_customer._mint_marketplace_jwt', return_value='jwt-token')
    @patch('marketplace_resolve_customer._get_customer_by_marketplace_id')
    @patch('marketplace_resolve_customer.metering_client')
    def test_regtoken_payload_is_accepted(self, mock_metering, mock_get_existing, _mock_mint):
        from marketplace_resolve_customer import lambda_handler

        mock_metering.resolve_customer.return_value = {
            'CustomerIdentifier': 'cust-regtoken',
            'ProductCode': 'prod-xyz',
        }
        mock_get_existing.return_value = ('uuid-existing', 'cust-regtoken', 'prod-xyz', 'standard')

        event = {'body': json.dumps({'regToken': 'reg-token'})}
        response = lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 200)
        mock_metering.resolve_customer.assert_called_once_with(RegistrationToken='reg-token')

    @patch('marketplace_resolve_customer._mint_marketplace_jwt', return_value='jwt-token')
    @patch('marketplace_resolve_customer._get_customer_by_marketplace_id')
    @patch('marketplace_resolve_customer.metering_client')
    def test_header_token_is_accepted_case_insensitive(self, mock_metering, mock_get_existing, _mock_mint):
        from marketplace_resolve_customer import lambda_handler

        mock_metering.resolve_customer.return_value = {
            'CustomerIdentifier': 'cust-header',
            'ProductCode': 'prod-xyz',
        }
        mock_get_existing.return_value = ('uuid-existing', 'cust-header', 'prod-xyz', 'standard')

        event = {'headers': {'X-Amzn-Marketplace-Token': 'header-token'}}
        response = lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 200)
        mock_metering.resolve_customer.assert_called_once_with(RegistrationToken='header-token')

    @patch('marketplace_resolve_customer._mint_marketplace_jwt', return_value='jwt-token')
    @patch('marketplace_resolve_customer._get_customer_by_marketplace_id')
    @patch('marketplace_resolve_customer.metering_client')
    def test_idempotent_existing_customer(self, mock_metering, mock_get_existing, mock_mint):
        from marketplace_resolve_customer import lambda_handler

        mock_metering.resolve_customer.return_value = {
            'CustomerIdentifier': 'cust-abc123',
            'ProductCode': 'prod-xyz',
        }
        mock_get_existing.return_value = ('uuid-existing', 'cust-abc123', 'prod-xyz', 'healthcare')

        event = {'body': json.dumps({'token': 'valid-token'})}
        response = lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertTrue(body['idempotent'])
        self.assertEqual(body['customer_id'], 'uuid-existing')
        self.assertEqual(body['token'], 'jwt-token')
        mock_mint.assert_called_once_with(
            'uuid-existing',
            'marketplace+cust-abc123@securebase.local',
            'healthcare',
        )

    @patch('marketplace_resolve_customer._mint_marketplace_jwt', return_value='jwt-token')
    @patch('marketplace_resolve_customer._trigger_onboarding')
    @patch('marketplace_resolve_customer._insert_marketplace_customer')
    @patch('marketplace_resolve_customer._get_customer_by_marketplace_id')
    @patch('marketplace_resolve_customer.metering_client')
    def test_healthcare_plan_uses_healthcare_tier_and_hipaa_framework(
        self,
        mock_metering,
        mock_get_existing,
        mock_insert,
        mock_onboard,
        _mock_mint,
    ):
        from marketplace_resolve_customer import lambda_handler

        mock_metering.resolve_customer.return_value = {
            'CustomerIdentifier': 'cust-health',
            'ProductCode': 'prod-xyz',
        }
        mock_get_existing.return_value = None
        mock_insert.return_value = 'uuid-health'

        event = {'body': json.dumps({'token': 'valid-token', 'plan': 'healthcare'})}
        response = lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 200)
        mock_insert.assert_called_once_with('cust-health', 'prod-xyz', 'healthcare', 'hipaa')
        mock_onboard.assert_called_once_with(
            'uuid-health',
            'marketplace+cust-health@securebase.local',
            'healthcare',
        )

    @patch('marketplace_resolve_customer._mint_marketplace_jwt', return_value='jwt-token')
    @patch('marketplace_resolve_customer._trigger_onboarding')
    @patch('marketplace_resolve_customer._insert_marketplace_customer')
    @patch('marketplace_resolve_customer._get_customer_by_marketplace_id')
    @patch('marketplace_resolve_customer.metering_client')
    def test_invalid_plan_falls_back_to_standard(
        self,
        mock_metering,
        mock_get_existing,
        mock_insert,
        _mock_onboard,
        _mock_mint,
    ):
        from marketplace_resolve_customer import lambda_handler

        mock_metering.resolve_customer.return_value = {
            'CustomerIdentifier': 'cust-invalid-plan',
            'ProductCode': 'prod-xyz',
        }
        mock_get_existing.return_value = None
        mock_insert.return_value = 'uuid-standard'

        event = {'body': json.dumps({'token': 'valid-token', 'plan': 'unknown-tier'})}
        response = lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 200)
        mock_insert.assert_called_once_with('cust-invalid-plan', 'prod-xyz', 'standard', 'cis')

    @patch('marketplace_resolve_customer._mint_marketplace_jwt', side_effect=Exception('secrets unavailable'))
    @patch('marketplace_resolve_customer._trigger_onboarding')
    @patch('marketplace_resolve_customer._insert_marketplace_customer')
    @patch('marketplace_resolve_customer._get_customer_by_marketplace_id')
    @patch('marketplace_resolve_customer.metering_client')
    def test_jwt_mint_failure_returns_500_for_new_customer(
        self,
        mock_metering,
        mock_get_existing,
        mock_insert,
        _mock_onboard,
        _mock_mint,
    ):
        from marketplace_resolve_customer import lambda_handler

        mock_metering.resolve_customer.return_value = {
            'CustomerIdentifier': 'cust-no-jwt',
            'ProductCode': 'prod-xyz',
        }
        mock_get_existing.return_value = None
        mock_insert.return_value = 'uuid-no-jwt'

        event = {'body': json.dumps({'token': 'valid-token'})}
        response = lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 500)
        body = json.loads(response['body'])
        self.assertEqual(body['error'], 'jwt_error')

    @patch('marketplace_resolve_customer._mint_marketplace_jwt', side_effect=Exception('secrets unavailable'))
    @patch('marketplace_resolve_customer._get_customer_by_marketplace_id')
    @patch('marketplace_resolve_customer.metering_client')
    def test_jwt_mint_failure_returns_500_for_existing_customer(self, mock_metering, mock_get_existing, _mock_mint):
        from marketplace_resolve_customer import lambda_handler

        mock_metering.resolve_customer.return_value = {
            'CustomerIdentifier': 'cust-existing-no-jwt',
            'ProductCode': 'prod-xyz',
        }
        mock_get_existing.return_value = ('uuid-existing-no-jwt', 'cust-existing-no-jwt', 'prod-xyz', 'standard')

        event = {'body': json.dumps({'token': 'valid-token'})}
        response = lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 500)
        body = json.loads(response['body'])
        self.assertEqual(body['error'], 'jwt_error')

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

    @patch('marketplace_resolve_customer.metering_client')
    def test_missing_token_returns_400(self, mock_metering):
        from marketplace_resolve_customer import lambda_handler

        response = lambda_handler({'body': json.dumps({})}, None)

        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertEqual(body['error'], 'invalid_token')
        mock_metering.resolve_customer.assert_not_called()


if __name__ == '__main__':
    unittest.main()
