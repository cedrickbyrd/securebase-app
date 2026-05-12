"""
Unit tests for src/lambdas/dr/dr_drill.py and src/lambdas/dr/failover_validator.py

Tests run without AWS credentials using unittest.mock.
"""
import json
import os
import sys
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call, ANY

# ── Make src/lambdas/dr importable ────────────────────────────────────────────
_DR_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "src", "lambdas", "dr")
sys.path.insert(0, os.path.abspath(_DR_PATH))


# ── Helpers ────────────────────────────────────────────────────────────────────

def _ctx():
    c = MagicMock()
    c.function_name = "test-dr-drill"
    c.aws_request_id = "test-request-id"
    return c


# ══════════════════════════════════════════════════════════════════════════════
# dr_drill tests
# ══════════════════════════════════════════════════════════════════════════════

class TestDrDrill(unittest.TestCase):

    def _get_module(self):
        import importlib
        import dr_drill as m
        importlib.reload(m)
        return m

    def _make_clients(self, active_region="us-west-2"):
        """Return a dict of mocked boto3 clients."""
        ssm = MagicMock()
        ssm.get_parameter.return_value = {"Parameter": {"Value": active_region}}
        lam = MagicMock()
        lam.invoke.return_value = {
            "Payload": MagicMock(read=lambda: json.dumps({"statusCode": 200}).encode()),
            "StatusCode": 200,
        }
        cw = MagicMock()
        cw.get_metric_statistics.return_value = {"Datapoints": [{"Maximum": 50.0}]}
        s3 = MagicMock()
        sns = MagicMock()
        return {"ssm": ssm, "lam": lam, "cw": cw, "s3": s3, "sns": sns}

    @patch("boto3.client")
    @patch.dict(os.environ, {
        "PRIMARY_REGION": "us-east-1",
        "SECONDARY_REGION": "us-west-2",
        "FAILOVER_LAMBDA_ARN": "arn:aws:lambda:us-east-1:123456789012:function:failover",
        "DRILL_REPORT_BUCKET": "securebase-drill-reports",
        "ENVIRONMENT": "dev",
    })
    def test_successful_drill_pass(self, mock_boto):
        """All checks pass → result=PASS, statusCode=200."""
        m = self._get_module()
        clients = self._make_clients(active_region="us-west-2")

        def _client_factory(service, **kwargs):
            return {
                "ssm": clients["ssm"],
                "lambda": clients["lam"],
                "cloudwatch": clients["cw"],
                "s3": clients["s3"],
                "sns": clients["sns"],
            }[service]

        mock_boto.side_effect = _client_factory

        result = m.handler({}, _ctx())

        self.assertEqual(result["result"], "PASS")
        self.assertEqual(result["statusCode"], 200)
        self.assertIsNotNone(result["drill_id"])
        self.assertIsNotNone(result["rto_seconds"])

    @patch("boto3.client")
    @patch.dict(os.environ, {
        "PRIMARY_REGION": "us-east-1",
        "SECONDARY_REGION": "us-west-2",
        "FAILOVER_LAMBDA_ARN": "arn:aws:lambda:us-east-1:123456789012:function:failover",
        "DRILL_REPORT_BUCKET": "",
        "ENVIRONMENT": "dev",
    })
    def test_drill_no_report_bucket(self, mock_boto):
        """Drill completes even when no S3 bucket is configured."""
        m = self._get_module()
        clients = self._make_clients(active_region="us-west-2")

        def _client_factory(service, **kwargs):
            return {
                "ssm": clients["ssm"],
                "lambda": clients["lam"],
                "cloudwatch": clients["cw"],
                "s3": clients["s3"],
                "sns": clients["sns"],
            }[service]

        mock_boto.side_effect = _client_factory

        result = m.handler({}, _ctx())

        self.assertIn(result["result"], ("PASS", "FAIL"))
        # S3 put_object should NOT be called without a bucket
        clients["s3"].put_object.assert_not_called()

    @patch("boto3.client")
    @patch.dict(os.environ, {
        "PRIMARY_REGION": "us-east-1",
        "SECONDARY_REGION": "us-west-2",
        "FAILOVER_LAMBDA_ARN": "",   # Not set → ValueError
        "DRILL_REPORT_BUCKET": "",
        "ENVIRONMENT": "dev",
    })
    def test_drill_error_on_missing_failover_arn(self, mock_boto):
        """Missing FAILOVER_LAMBDA_ARN → drill result is ERROR."""
        m = self._get_module()
        clients = self._make_clients()

        def _client_factory(service, **kwargs):
            return {
                "ssm": clients["ssm"],
                "lambda": clients["lam"],
                "cloudwatch": clients["cw"],
                "s3": clients["s3"],
                "sns": clients["sns"],
            }[service]

        mock_boto.side_effect = _client_factory

        result = m.handler({}, _ctx())
        self.assertEqual(result["result"], "ERROR")

    @patch("boto3.client")
    @patch.dict(os.environ, {
        "PRIMARY_REGION": "us-east-1",
        "SECONDARY_REGION": "us-west-2",
        "FAILOVER_LAMBDA_ARN": "arn:aws:lambda:us-east-1:123456789012:function:failover",
        "DRILL_REPORT_BUCKET": "securebase-drill-reports",
        "ENVIRONMENT": "dev",
    })
    def test_drill_pagerduty_suppression_set_and_cleared(self, mock_boto):
        """PagerDuty suppression SSM flag is set then cleared."""
        m = self._get_module()
        clients = self._make_clients(active_region="us-west-2")

        def _client_factory(service, **kwargs):
            return {
                "ssm": clients["ssm"],
                "lambda": clients["lam"],
                "cloudwatch": clients["cw"],
                "s3": clients["s3"],
                "sns": clients["sns"],
            }[service]

        mock_boto.side_effect = _client_factory
        m.handler({}, _ctx())

        # Collect all Values passed to put_parameter calls
        values_set = []
        for c in clients["ssm"].put_parameter.call_args_list:
            # Support both positional and keyword argument styles
            if c.kwargs.get("Name") == m.DRILL_SUPPRESSION_PARAM:
                values_set.append(c.kwargs.get("Value"))
            elif c[1].get("Name") == m.DRILL_SUPPRESSION_PARAM:
                values_set.append(c[1].get("Value"))
        # Drill must set suppression=true at start and false at finish
        self.assertIn("true", values_set, "PagerDuty suppression should be set to 'true'")
        self.assertIn("false", values_set, "PagerDuty suppression should be cleared to 'false'")


# ══════════════════════════════════════════════════════════════════════════════
# failover_validator tests
# ══════════════════════════════════════════════════════════════════════════════

class TestFailoverValidator(unittest.TestCase):

    def _get_module(self):
        import importlib
        import failover_validator as m
        importlib.reload(m)
        return m

    @patch("boto3.client")
    @patch.dict(os.environ, {
        "PRIMARY_REGION": "us-east-1",
        "SECONDARY_REGION": "us-west-2",
        "AURORA_GLOBAL_CLUSTER_ID": "securebase-prod-global",
        "DYNAMODB_TABLE_NAMES": "securebase-tenants,securebase-controls-state,securebase-tenant-metrics",
        "SECONDARY_HEALTH_URL": "",
        "ENVIRONMENT": "dev",
    })
    def test_all_checks_pass(self, mock_boto):
        """SSM OK, Aurora no datapoints (standalone after failover), DynamoDB ACTIVE → PASS."""
        m = self._get_module()

        ssm = MagicMock()
        ssm.get_parameter.return_value = {"Parameter": {"Value": "us-west-2"}}

        cw = MagicMock()
        cw.get_metric_statistics.return_value = {"Datapoints": []}

        ddb = MagicMock()
        ddb.describe_table.return_value = {
            "Table": {
                "Replicas": [{"RegionName": "us-west-2", "ReplicaStatus": "ACTIVE"}],
                "StreamSpecification": {"StreamEnabled": True},
            }
        }

        sns = MagicMock()

        def _client_factory(service, **kwargs):
            return {"ssm": ssm, "cloudwatch": cw, "dynamodb": ddb, "sns": sns}[service]

        mock_boto.side_effect = _client_factory

        result = m.handler({}, None)
        body = json.loads(result["body"])

        self.assertEqual(result["statusCode"], 200)
        self.assertTrue(body["overall_passed"])
        self.assertEqual(body["failed_checks"], [])

    @patch("boto3.client")
    @patch.dict(os.environ, {
        "PRIMARY_REGION": "us-east-1",
        "SECONDARY_REGION": "us-west-2",
        "AURORA_GLOBAL_CLUSTER_ID": "securebase-prod-global",
        "DYNAMODB_TABLE_NAMES": "securebase-tenants",
        "SECONDARY_HEALTH_URL": "",
        "ENVIRONMENT": "dev",
    })
    def test_active_region_mismatch_fails(self, mock_boto):
        """SSM still showing us-east-1 → active_region_ssm check fails."""
        m = self._get_module()

        ssm = MagicMock()
        # Active region NOT updated — still primary
        ssm.get_parameter.return_value = {"Parameter": {"Value": "us-east-1"}}

        cw = MagicMock()
        cw.get_metric_statistics.return_value = {"Datapoints": []}

        ddb = MagicMock()
        ddb.describe_table.return_value = {
            "Table": {
                "Replicas": [{"RegionName": "us-west-2", "ReplicaStatus": "ACTIVE"}],
            }
        }
        sns = MagicMock()

        def _client_factory(service, **kwargs):
            return {"ssm": ssm, "cloudwatch": cw, "dynamodb": ddb, "sns": sns}[service]

        mock_boto.side_effect = _client_factory

        result = m.handler({}, None)
        body = json.loads(result["body"])

        self.assertEqual(result["statusCode"], 500)
        self.assertFalse(body["overall_passed"])
        self.assertIn("active_region_ssm", body["failed_checks"])

    @patch("boto3.client")
    @patch.dict(os.environ, {
        "PRIMARY_REGION": "us-east-1",
        "SECONDARY_REGION": "us-west-2",
        "AURORA_GLOBAL_CLUSTER_ID": "",
        "DYNAMODB_TABLE_NAMES": "securebase-tenants",
        "SECONDARY_HEALTH_URL": "",
        "ENVIRONMENT": "dev",
    })
    def test_dynamodb_replica_not_active_fails(self, mock_boto):
        """DynamoDB replica in CREATING state → dynamodb_replicas check fails."""
        m = self._get_module()

        ssm = MagicMock()
        ssm.get_parameter.return_value = {"Parameter": {"Value": "us-west-2"}}

        cw = MagicMock()
        cw.get_metric_statistics.return_value = {"Datapoints": []}

        ddb = MagicMock()
        ddb.describe_table.return_value = {
            "Table": {
                "Replicas": [{"RegionName": "us-west-2", "ReplicaStatus": "CREATING"}],
            }
        }
        sns = MagicMock()

        def _client_factory(service, **kwargs):
            return {"ssm": ssm, "cloudwatch": cw, "dynamodb": ddb, "sns": sns}[service]

        mock_boto.side_effect = _client_factory

        result = m.handler({}, None)
        body = json.loads(result["body"])

        self.assertEqual(result["statusCode"], 500)
        self.assertIn("dynamodb_replicas", body["failed_checks"])

    @patch("boto3.client")
    @patch.dict(os.environ, {
        "PRIMARY_REGION": "us-east-1",
        "SECONDARY_REGION": "us-west-2",
        "AURORA_GLOBAL_CLUSTER_ID": "securebase-prod-global",
        "DYNAMODB_TABLE_NAMES": "securebase-tenants",
        "SECONDARY_HEALTH_URL": "",
        "ENVIRONMENT": "dev",
    })
    def test_aurora_high_lag_fails(self, mock_boto):
        """Aurora replication lag above fail threshold → check fails."""
        m = self._get_module()

        ssm = MagicMock()
        ssm.get_parameter.return_value = {"Parameter": {"Value": "us-west-2"}}

        cw = MagicMock()
        # 8000 ms lag — above 5000 ms fail threshold
        cw.get_metric_statistics.return_value = {"Datapoints": [{"Maximum": 8000.0}]}

        ddb = MagicMock()
        ddb.describe_table.return_value = {
            "Table": {
                "Replicas": [{"RegionName": "us-west-2", "ReplicaStatus": "ACTIVE"}],
            }
        }
        sns = MagicMock()

        def _client_factory(service, **kwargs):
            return {"ssm": ssm, "cloudwatch": cw, "dynamodb": ddb, "sns": sns}[service]

        mock_boto.side_effect = _client_factory

        result = m.handler({}, None)
        body = json.loads(result["body"])

        self.assertFalse(body["overall_passed"])
        self.assertIn("aurora_replication_lag", body["failed_checks"])

    @patch("boto3.client")
    @patch.dict(os.environ, {
        "PRIMARY_REGION": "us-east-1",
        "SECONDARY_REGION": "us-west-2",
        "AURORA_GLOBAL_CLUSTER_ID": "",
        "DYNAMODB_TABLE_NAMES": "securebase-tenants",
        "SECONDARY_HEALTH_URL": "",
        "ENVIRONMENT": "dev",
    })
    def test_sends_sns_alert_on_failure(self, mock_boto):
        """Failed validation sends an SNS alert."""
        m = self._get_module()
        m.ALERT_SNS_ARN = "arn:aws:sns:us-east-1:123456789012:alerts"

        ssm = MagicMock()
        # Active region mismatch
        ssm.get_parameter.return_value = {"Parameter": {"Value": "us-east-1"}}

        cw = MagicMock()
        cw.get_metric_statistics.return_value = {"Datapoints": []}

        ddb = MagicMock()
        ddb.describe_table.return_value = {"Table": {"Replicas": []}}

        sns = MagicMock()

        def _client_factory(service, **kwargs):
            return {"ssm": ssm, "cloudwatch": cw, "dynamodb": ddb, "sns": sns}[service]

        mock_boto.side_effect = _client_factory

        m.handler({}, None)
        sns.publish.assert_called_once()


if __name__ == "__main__":
    unittest.main()
