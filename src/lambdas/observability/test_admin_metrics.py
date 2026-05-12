import json
import os
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

import admin_metrics


class FixedDatetime(datetime):
    @classmethod
    def utcnow(cls):
        return cls(2026, 5, 12, 12, 0, 0)


class TestAdminMetrics(unittest.TestCase):
    def setUp(self):
        self.event = {
            "httpMethod": "GET",
            "path": "/admin/metrics",
            "headers": {"Authorization": "Bearer test-token"},
            "requestContext": {
                "authorizer": {
                    "claims": {"role": "admin"}
                }
            },
        }

    @patch.object(admin_metrics, "cloudwatch", new_callable=MagicMock)
    @patch.object(admin_metrics, "datetime", FixedDatetime)
    def test_get_metric_data_batches_expected_queries_and_time_window(self, mock_cw):
        mock_cw.get_metric_data.return_value = {
            "MetricDataResults": [
                {"Id": "lambda_invocations", "Values": [120], "Timestamps": [FixedDatetime.utcnow()]},
                {"Id": "lambda_errors", "Values": [2], "Timestamps": [FixedDatetime.utcnow()]},
                {"Id": "lambda_duration_p50", "Values": [40], "Timestamps": [FixedDatetime.utcnow()]},
                {"Id": "lambda_duration_p95", "Values": [180], "Timestamps": [FixedDatetime.utcnow()]},
                {"Id": "lambda_duration_p99", "Values": [350], "Timestamps": [FixedDatetime.utcnow()]},
                {"Id": "api_requests", "Values": [1000], "Timestamps": [FixedDatetime.utcnow()]},
                {"Id": "api_5xx", "Values": [4], "Timestamps": [FixedDatetime.utcnow()]},
            ]
        }

        response = admin_metrics.lambda_handler(self.event, None)
        self.assertEqual(response["statusCode"], 200)

        kwargs = mock_cw.get_metric_data.call_args.kwargs
        query_ids = [q["Id"] for q in kwargs["MetricDataQueries"]]
        self.assertEqual(
            query_ids,
            [
                "lambda_invocations",
                "lambda_errors",
                "lambda_duration_p50",
                "lambda_duration_p95",
                "lambda_duration_p99",
                "api_requests",
                "api_5xx",
            ],
        )
        self.assertEqual(kwargs["StartTime"], FixedDatetime(2026, 5, 12, 11, 0, 0))
        self.assertEqual(kwargs["EndTime"], FixedDatetime(2026, 5, 12, 12, 0, 0))

        body = json.loads(response["body"])
        self.assertIn("infrastructure", body)
        self.assertEqual(body["infrastructure"]["lambdaInvocations"], 120)
        self.assertEqual(body["infrastructure"]["apiRequestCount"], 1000)

    def test_requires_admin_token(self):
        event = {"httpMethod": "GET", "path": "/admin/metrics", "headers": {}, "requestContext": {}}
        response = admin_metrics.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 401)


if __name__ == "__main__":
    unittest.main()
