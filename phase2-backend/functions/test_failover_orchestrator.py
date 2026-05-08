import unittest
from unittest.mock import MagicMock

import failover_orchestrator as module


def get_handler(mod):
    return getattr(mod, "lambda_handler", mod.handler)


class TestFailoverOrchestrator(unittest.TestCase):
    def setUp(self):
        self.ssm = MagicMock()
        self.rds = MagicMock()
        self.sns = MagicMock()

        module.ssm = self.ssm
        module.rds = self.rds
        module.sns = self.sns
        module.GLOBAL_CLUSTER_ID = "securebase-global-prod"
        module.SECONDARY_CLUSTER_ARN = "arn:aws:rds:us-west-2:123456789012:cluster:secondary"
        module.ALERT_SNS_ARN = "arn:aws:sns:us-east-1:123456789012:securebase-alerts"
        module.PRIMARY_REGION = "us-east-1"
        module.SECONDARY_REGION = "us-west-2"

    def test_lambda_handler_auto_trigger_success(self):
        self.ssm.get_parameter.side_effect = [
            {"Parameter": {"Value": "true"}},
            {"Parameter": {"Value": "us-east-1"}},
        ]

        result = get_handler(module)({"source": "aws.events"}, None)

        self.assertEqual(result["statusCode"], 200)
        self.rds.remove_from_global_cluster.assert_called_once()
        self.ssm.put_parameter.assert_called_once()
        self.sns.publish.assert_called_once()

    def test_lambda_handler_manual_event_success(self):
        self.ssm.get_parameter.side_effect = [
            {"Parameter": {"Value": "true"}},
            {"Parameter": {"Value": "us-east-1"}},
        ]

        result = get_handler(module)({"trigger": "manual"}, None)

        self.assertEqual(result["statusCode"], 200)
        self.assertIn("failed over", result["body"])

    def test_idempotency_already_failed_over(self):
        self.ssm.get_parameter.side_effect = [
            {"Parameter": {"Value": "true"}},
            {"Parameter": {"Value": "us-west-2"}},
        ]

        result = get_handler(module)({}, None)

        self.assertEqual(result["statusCode"], 200)
        self.assertIn("already failed over", result["body"])
        self.rds.remove_from_global_cluster.assert_not_called()

    def test_rollback_behavior_on_failure(self):
        self.ssm.get_parameter.side_effect = [
            {"Parameter": {"Value": "true"}},
            {"Parameter": {"Value": "us-east-1"}},
        ]
        self.rds.remove_from_global_cluster.side_effect = Exception("promotion failed")

        with self.assertRaises(Exception):
            get_handler(module)({}, None)

        self.ssm.put_parameter.assert_not_called()
        self.sns.publish.assert_called_once()
        self.assertIn("FAILOVER FAILED", self.sns.publish.call_args[1]["Message"])

    def test_failover_disabled_returns_without_actions(self):
        self.ssm.get_parameter.return_value = {"Parameter": {"Value": "false"}}

        result = get_handler(module)({}, None)

        self.assertEqual(result["statusCode"], 200)
        self.assertIn("disabled", result["body"])
        self.rds.remove_from_global_cluster.assert_not_called()


if __name__ == "__main__":
    unittest.main()
