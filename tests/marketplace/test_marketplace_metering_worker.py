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


class TestGetMeteringQuantity(unittest.TestCase):
    def _make_mock_conn(self, count):
        mock_cur = MagicMock()
        mock_cur.__enter__ = lambda s: s
        mock_cur.__exit__ = MagicMock(return_value=False)
        mock_cur.fetchone.return_value = (count,)
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        return mock_conn, mock_cur

    @patch('marketplace_metering_worker.release_connection')
    @patch('marketplace_metering_worker.get_connection')
    def test_users_dimension_queries_users_table(self, mock_get_conn, _mock_release):
        from marketplace_metering_worker import _get_metering_quantity
        mock_conn, mock_cur = self._make_mock_conn(5)
        mock_get_conn.return_value = mock_conn

        result = _get_metering_quantity('cust-1', 'users')

        self.assertEqual(result, 5)
        sql = mock_cur.execute.call_args[0][0]
        self.assertIn('users', sql)
        self.assertNotIn('tenants', sql)

    @patch('marketplace_metering_worker.release_connection')
    @patch('marketplace_metering_worker.get_connection')
    def test_tenant_dimensions_query_tenants_table(self, mock_get_conn, _mock_release):
        """hipaa_tenants/fintech_tenants/gov_tenants must count rows in the tenants table."""
        from marketplace_metering_worker import _get_metering_quantity, TENANT_DIMENSIONS

        for dim in TENANT_DIMENSIONS:
            with self.subTest(dimension=dim):
                mock_conn, mock_cur = self._make_mock_conn(3)
                mock_get_conn.return_value = mock_conn

                result = _get_metering_quantity('cust-1', dim)

                self.assertEqual(result, 3)
                sql = mock_cur.execute.call_args[0][0]
                self.assertIn('tenants', sql)
                # Must NOT fall back to counting the customer row itself
                self.assertNotIn('customers', sql)

    @patch('marketplace_metering_worker.release_connection')
    @patch('marketplace_metering_worker.get_connection')
    def test_tenant_dimension_zero_count_returns_one(self, mock_get_conn, _mock_release):
        """When no tenants exist yet, metering quantity must be at least 1."""
        from marketplace_metering_worker import _get_metering_quantity
        mock_conn, mock_cur = self._make_mock_conn(0)
        mock_get_conn.return_value = mock_conn

        result = _get_metering_quantity('cust-1', 'hipaa_tenants')

        self.assertEqual(result, 1)


class TestMarketplaceMeteringWorker(unittest.TestCase):
    @patch('marketplace_metering_worker._get_metering_quantity', return_value=7)
    @patch('marketplace_metering_worker.metering_client')
    @patch('marketplace_metering_worker._insert_metering_record')
    def test_dimension_mapping(self, mock_insert, mock_metering, mock_quantity):
        from marketplace_metering_worker import _meter_customer

        mock_metering.batch_meter_usage.return_value = {
            'Results': [{'Status': 'Success', 'MeteringRecordId': 'r-1'}]
        }

        _meter_customer('c1', 'mp1', 'healthcare')

        args = mock_metering.batch_meter_usage.call_args.kwargs
        self.assertEqual(args['UsageRecords'][0]['Dimension'], 'hipaa_tenants')
        self.assertEqual(args['UsageRecords'][0]['Quantity'], 7)
        mock_quantity.assert_called_once_with('c1', 'hipaa_tenants')
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
