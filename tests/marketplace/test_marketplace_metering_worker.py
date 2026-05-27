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
    def test_get_metering_quantity_uses_users_query_for_users_dimension(self):
        from marketplace_metering_worker import _get_metering_quantity

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (3,)

        with patch('marketplace_metering_worker.get_connection', return_value=mock_conn), \
             patch('marketplace_metering_worker.release_connection') as mock_release:
            quantity = _get_metering_quantity('c1', 'users')

        sql = mock_cursor.execute.call_args.args[0]
        params = mock_cursor.execute.call_args.args[1]
        self.assertIn("FROM users", sql)
        self.assertIn("status = 'active'", sql)
        self.assertEqual(params, ('c1',))
        self.assertEqual(quantity, 3)
        mock_release.assert_called_once_with(mock_conn)

    def test_get_metering_quantity_uses_usage_metrics_for_tenant_dimensions(self):
        from marketplace_metering_worker import _get_metering_quantity

        for dimension in ('hipaa_tenants', 'fintech_tenants', 'gov_tenants'):
            with self.subTest(dimension=dimension):
                mock_conn = MagicMock()
                mock_cursor = MagicMock()
                mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
                mock_cursor.fetchone.return_value = (8,)

                with patch('marketplace_metering_worker.get_connection', return_value=mock_conn), \
                     patch('marketplace_metering_worker.release_connection'):
                    quantity = _get_metering_quantity('c1', dimension)

                sql = mock_cursor.execute.call_args.args[0]
                params = mock_cursor.execute.call_args.args[1]
                self.assertIn("FROM usage_metrics", sql)
                self.assertIn("account_count", sql)
                self.assertIn("ORDER BY month DESC", sql)
                self.assertIn("LIMIT 1", sql)
                self.assertEqual(params, ('c1',))
                self.assertEqual(quantity, 8)

    def test_get_metering_quantity_returns_one_when_tenant_metric_row_is_missing(self):
        from marketplace_metering_worker import _get_metering_quantity

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchone.return_value = None

        with patch('marketplace_metering_worker.get_connection', return_value=mock_conn), \
             patch('marketplace_metering_worker.release_connection'):
            quantity = _get_metering_quantity('c1', 'hipaa_tenants')

        self.assertEqual(quantity, 1)

    def test_get_metering_quantity_returns_one_on_db_error(self):
        from marketplace_metering_worker import _get_metering_quantity

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.execute.side_effect = Exception('db down')

        with patch('marketplace_metering_worker.get_connection', return_value=mock_conn), \
             patch('marketplace_metering_worker.release_connection'), \
             patch('marketplace_metering_worker.logger') as mock_logger:
            quantity = _get_metering_quantity('c1', 'hipaa_tenants')

        self.assertEqual(quantity, 1)
        mock_logger.exception.assert_called_once()

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
