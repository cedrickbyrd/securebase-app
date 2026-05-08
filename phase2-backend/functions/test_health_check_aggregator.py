import json
import unittest
from unittest.mock import MagicMock, patch

import health_check_aggregator as module


def get_handler(mod):
    return getattr(mod, "lambda_handler", mod.handler)


class TestHealthCheckAggregator(unittest.TestCase):
    def setUp(self):
        self.cw = MagicMock()
        module.cw = self.cw
        module.PRIMARY_REGION = "us-east-1"
        module.SECONDARY_REGION = "us-west-2"
        module.AURORA_CLUSTER = "securebase-prod-cluster"
        module.API_GW_ID = "abc123def4"
        module.SECONDARY_API_GW_ID = "zyx987uvw6"
        module.ENVIRONMENT = "prod"

    @patch.object(module, "_check_aurora", return_value=True)
    @patch.object(module, "_check_dynamodb", return_value=True)
    @patch.object(module, "_check_api_gateway", return_value=True)
    def test_health_aggregation_all_healthy(self, mock_api, *_):
        result = get_handler(module)({}, None)

        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertTrue(body["us-east-1"]["healthy"])
        self.assertTrue(body["us-west-2"]["healthy"])
        mock_api.assert_any_call("us-east-1", "abc123def4")
        mock_api.assert_any_call("us-west-2", "zyx987uvw6")

    @patch.object(module, "_check_aurora", side_effect=[False, True])
    @patch.object(module, "_check_dynamodb", return_value=True)
    @patch.object(module, "_check_api_gateway", return_value=True)
    def test_threshold_signal_for_failover_alarm(self, *_):
        get_handler(module)({}, None)

        overall_metrics = []
        for metric_call in self.cw.put_metric_data.call_args_list:
            metric_data = metric_call.kwargs.get("MetricData", [])
            if not metric_data:
                continue
            dimensions = metric_data[0].get("Dimensions", [])
            if len(dimensions) < 2:
                continue
            if dimensions[1].get("Value") == "overall":
                overall_metrics.append(metric_data[0].get("Value"))

        self.assertIn(0.0, overall_metrics)

    @patch("health_check_aggregator.boto3.client")
    def test_aws_health_response_mocking(self, mock_boto_client):
        mock_rds = MagicMock()
        mock_rds.describe_db_clusters.return_value = {"DBClusters": [{"Status": "available"}]}
        mock_ddb = MagicMock()
        mock_ddb.list_tables.return_value = {"TableNames": ["t1"]}
        mock_apigw = MagicMock()
        mock_apigw.get_rest_api.return_value = {"id": "abc123def4"}

        def side_effect(service, region_name=None):
            if service == "rds":
                return mock_rds
            if service == "dynamodb":
                return mock_ddb
            if service == "apigateway":
                return mock_apigw
            return MagicMock()

        mock_boto_client.side_effect = side_effect

        self.assertTrue(module._check_aurora("us-east-1"))
        self.assertTrue(module._check_dynamodb("us-east-1"))
        self.assertTrue(module._check_api_gateway("us-east-1", "abc123def4"))


if __name__ == "__main__":
    unittest.main()
