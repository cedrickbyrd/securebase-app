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
os.environ.setdefault('MARKETPLACE_PRODUCT_CODE', 'prod-test')

sys.modules.setdefault('psycopg2', MagicMock())
sys.modules.setdefault('psycopg2.pool', MagicMock())
sys.modules.setdefault('psycopg2.extras', MagicMock())
sys.modules.setdefault('db_utils', MagicMock())


class TestMarketplaceMeteringWorker(unittest.TestCase):
    @patch('marketplace_metering_worker.metering_client')
    @patch('marketplace_metering_worker._insert_metering_record')
    def test_dimension_mapping(self, mock_insert, mock_metering):
        from marketplace_metering_worker import _meter_customer

        mock_metering.batch_meter_usage.return_value = {
            'Results': [{'Status': 'Success', 'MeteringRecordId': 'r-1'}]
        }

        _meter_customer('c1', 'mp1', 'healthcare')

        args = mock_metering.batch_meter_usage.call_args.kwargs
        self.assertEqual(args['UsageRecords'][0]['Dimension'], 'hipaa_tenants')
        mock_insert.assert_called_once()

    @patch('marketplace_metering_worker._publish_alert')
    @patch('marketplace_metering_worker._insert_metering_record')
    @patch('marketplace_metering_worker._meter_customer')
    @patch('marketplace_metering_worker._fetch_active_marketplace_customers')
    def test_partial_failure_does_not_crash(self, mock_fetch, mock_meter_customer, _mock_insert, _mock_alert):
        import marketplace_metering_worker as worker
        worker.MARKETPLACE_PRODUCT_CODE = 'prod-test'

        mock_fetch.return_value = [
            ('c1', 'mp1', 'standard'),
            ('c2', 'mp2', 'fintech'),
        ]
        mock_meter_customer.side_effect = [True, Exception('boom')]

        resp = worker.lambda_handler({}, None)
        body = json.loads(resp['body'])

        self.assertEqual(resp['statusCode'], 200)
        self.assertEqual(body['processed'], 1)
        self.assertEqual(body['failures'], 1)


if __name__ == '__main__':
    unittest.main()
