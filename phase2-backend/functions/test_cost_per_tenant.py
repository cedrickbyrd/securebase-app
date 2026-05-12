import json
import unittest
from datetime import date
from unittest.mock import MagicMock, patch

import cost_per_tenant


class TestCostPerTenant(unittest.TestCase):
    @patch("cost_per_tenant.aggregate_daily_costs")
    @patch("cost_per_tenant.put_daily_cost_records")
    @patch("cost_per_tenant.get_prior_average")
    @patch("cost_per_tenant.publish_anomaly")
    def test_daily_aggregation_publishes_anomaly(
        self,
        mock_publish_anomaly,
        mock_prior_average,
        mock_put_records,
        mock_aggregate,
    ):
        target = date(2026, 5, 10)
        mock_aggregate.return_value = {
            "tenant_a": {
                "tenant_id": "tenant_a",
                "date": "2026-05-10",
                "total_cost": 300.0,
                "breakdown": {"lambda": 300.0},
            }
        }
        mock_put_records.return_value = 1
        mock_prior_average.return_value = 100.0

        result = cost_per_tenant.run_daily_aggregation(target)

        self.assertEqual(result["records_stored"], 1)
        self.assertEqual(result["anomalies_published"], 1)
        mock_publish_anomaly.assert_called_once()

    @patch("cost_per_tenant._scan_history")
    def test_admin_costs_endpoint_returns_records(self, mock_scan_history):
        mock_scan_history.return_value = [
            {"tenant_id": "tenant_a", "date": "2026-05-10", "total_cost": 12.34, "breakdown": {"lambda": 12.34}}
        ]
        event = {
            "httpMethod": "GET",
            "path": "/admin/costs",
            "queryStringParameters": {"start": "2026-05-01", "end": "2026-05-10"},
        }

        response = cost_per_tenant.lambda_handler(event, MagicMock())
        body = json.loads(response["body"])

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(len(body["records"]), 1)
        self.assertEqual(body["records"][0]["tenant_id"], "tenant_a")

    @patch("cost_per_tenant._query_tenant_history")
    def test_tenant_costs_endpoint_computes_estimate(self, mock_query):
        mock_query.return_value = [
            {"tenant_id": "tenant_a", "date": "2026-05-10", "total_cost": 10, "breakdown": {"lambda": 6, "aurora": 4}},
            {"tenant_id": "tenant_a", "date": "2026-05-11", "total_cost": 20, "breakdown": {"lambda": 12, "aurora": 8}},
        ]
        event = {
            "httpMethod": "GET",
            "path": "/tenant/costs",
            "headers": {"X-Tenant-Id": "tenant_a"},
            "queryStringParameters": {"start": "2026-05-01", "end": "2026-05-11"},
        }

        response = cost_per_tenant.lambda_handler(event, MagicMock())
        body = json.loads(response["body"])

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(body["tenant_id"], "tenant_a")
        self.assertEqual(body["trend"], [10.0, 20.0])
        self.assertIn("estimated_monthly_cost", body)


if __name__ == "__main__":
    unittest.main()
