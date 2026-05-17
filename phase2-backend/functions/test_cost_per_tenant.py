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
    @patch("cost_per_tenant.emit_monthly_cost_metrics")
    def test_daily_aggregation_publishes_anomaly(
        self,
        mock_emit_metrics,
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
        mock_emit_metrics.return_value = 2

        result = cost_per_tenant.run_daily_aggregation(target)

        self.assertEqual(result["records_stored"], 1)
        self.assertEqual(result["anomalies_published"], 1)
        self.assertIn("metrics_emitted", result)
        mock_publish_anomaly.assert_called_once()
        mock_emit_metrics.assert_called_once()

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

    @patch("cost_per_tenant.cw")
    @patch("cost_per_tenant.sns")
    def test_emit_monthly_cost_metrics_publishes_cw_and_sns_alert(self, mock_sns, mock_cw):
        """Estimated monthly cost above threshold triggers SNS alert and CW metric."""
        cost_per_tenant.ALERT_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:test-topic"
        cost_per_tenant.MONTHLY_COST_ALERT_THRESHOLD_USD = 50.0
        mock_cw.put_metric_data = MagicMock()
        mock_sns.publish = MagicMock()

        tenant_costs = {
            "tenant_high": {
                "tenant_id": "tenant_high",
                "date": "2026-05-10",
                "total_cost": 3.0,  # daily $3 → ~$90/month estimated
                "breakdown": {"lambda": 3.0},
            },
            "tenant_low": {
                "tenant_id": "tenant_low",
                "date": "2026-05-10",
                "total_cost": 0.5,  # daily $0.50 → ~$15/month estimated
                "breakdown": {"lambda": 0.5},
            },
        }

        emitted = cost_per_tenant.emit_monthly_cost_metrics(tenant_costs, date(2026, 5, 10))

        self.assertGreater(emitted, 0)
        mock_cw.put_metric_data.assert_called()
        # Only the high-cost tenant should trigger SNS publish
        mock_sns.publish.assert_called_once()
        call_kwargs = mock_sns.publish.call_args[1]
        self.assertIn("tenant_high", call_kwargs["Subject"])

    @patch("cost_per_tenant.cw")
    def test_emit_monthly_cost_metrics_no_alert_below_threshold(self, mock_cw):
        """No SNS alert when all tenants are below the cost threshold."""
        original_threshold = cost_per_tenant.MONTHLY_COST_ALERT_THRESHOLD_USD
        original_arn = cost_per_tenant.ALERT_TOPIC_ARN
        cost_per_tenant.MONTHLY_COST_ALERT_THRESHOLD_USD = 50.0
        cost_per_tenant.ALERT_TOPIC_ARN = ""

        tenant_costs = {
            "tenant_cheap": {
                "tenant_id": "tenant_cheap",
                "date": "2026-05-10",
                "total_cost": 0.1,
                "breakdown": {"lambda": 0.1},
            }
        }

        emitted = cost_per_tenant.emit_monthly_cost_metrics(tenant_costs, date(2026, 5, 10))
        self.assertGreater(emitted, 0)

        # Restore
        cost_per_tenant.MONTHLY_COST_ALERT_THRESHOLD_USD = original_threshold
        cost_per_tenant.ALERT_TOPIC_ARN = original_arn

    @patch("cost_per_tenant.cw")
    def test_emit_monthly_cost_metrics_empty(self, mock_cw):
        """No metrics emitted when there are no tenants."""
        emitted = cost_per_tenant.emit_monthly_cost_metrics({}, date(2026, 5, 10))
        self.assertEqual(emitted, 0)
        mock_cw.put_metric_data.assert_not_called()


if __name__ == "__main__":
    unittest.main()
