import json
import unittest
from unittest.mock import MagicMock

import failback_orchestrator as module


def get_handler(mod):
    return getattr(mod, "lambda_handler", mod.handler)


class TestFailbackOrchestrator(unittest.TestCase):
    def setUp(self):
        self.ssm = MagicMock()
        self.rds = MagicMock()
        self.sns = MagicMock()
        self.cw = MagicMock()

        module.ssm = self.ssm
        module.rds = self.rds
        module.sns = self.sns
        module.cw = self.cw
        module.PRIMARY_CLUSTER_ARN = "arn:aws:rds:us-east-1:123456789012:cluster:primary"
        module.ALERT_SNS_ARN = "arn:aws:sns:us-east-1:123456789012:securebase-alerts"
        module.PRIMARY_REGION = "us-east-1"
        module.SECONDARY_REGION = "us-west-2"
        module.ENVIRONMENT = "prod"

    def test_lambda_handler_requires_confirm(self):
        result = get_handler(module)({"body": json.dumps({"confirm": False})}, None)
        self.assertEqual(result["statusCode"], 400)

    def test_pre_failback_health_check_failure(self):
        self.ssm.get_parameter.return_value = {"Parameter": {"Value": "us-west-2"}}
        self.rds.describe_db_clusters.return_value = {"DBClusters": [{"Status": "modifying"}]}

        result = get_handler(module)({"body": json.dumps({"confirm": True})}, None)

        self.assertEqual(result["statusCode"], 409)
        self.assertIn("not healthy", json.loads(result["body"])["error"])

    def test_failback_success_updates_active_region_for_dns_revert_logic(self):
        self.ssm.get_parameter.return_value = {"Parameter": {"Value": "us-west-2"}}
        self.rds.describe_db_clusters.return_value = {"DBClusters": [{"Status": "available"}]}

        result = get_handler(module)({"body": json.dumps({"confirm": True})}, None)

        self.assertEqual(result["statusCode"], 200)
        self.ssm.put_parameter.assert_called_once_with(
            Name=module.ACTIVE_REGION_PARAM,
            Value="us-east-1",
            Type="String",
            Overwrite=True,
        )
        self.rds.create_global_cluster.assert_called_once()
        self.cw.put_metric_data.assert_called_once()

    def test_already_on_primary_noop(self):
        self.ssm.get_parameter.return_value = {"Parameter": {"Value": "us-east-1"}}

        result = get_handler(module)({"body": json.dumps({"confirm": True})}, None)

        self.assertEqual(result["statusCode"], 200)
        self.rds.create_global_cluster.assert_not_called()


if __name__ == "__main__":
    unittest.main()
