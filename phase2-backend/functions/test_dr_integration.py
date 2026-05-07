"""
DR Integration Tests — Phase 5.3

Covers:
  - health_check_aggregator: unit-level checks per service/region
  - failover_orchestrator: guard conditions, SSM idempotency, Aurora promo path
  - failback_orchestrator: confirm gate, primary-health validation, happy path

All AWS SDK calls are mocked with unittest.mock so tests run in CI without
real AWS credentials.
"""
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_context():
    ctx = MagicMock()
    ctx.function_name = "test-function"
    ctx.aws_request_id = "test-request-id"
    return ctx


# ─────────────────────────────────────────────────────────────────────────────
# health_check_aggregator tests
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthCheckAggregator(unittest.TestCase):

    def _get_module(self):
        import importlib
        import health_check_aggregator as m
        importlib.reload(m)
        return m

    @patch("boto3.client")
    def test_healthy_regions_returns_200(self, mock_boto):
        """All services healthy → overall healthy, 200 returned."""
        cw_client = MagicMock()
        rds_client = MagicMock()
        ddb_client = MagicMock()

        rds_client.describe_db_clusters.return_value = {
            "DBClusters": [{"Status": "available"}]
        }
        ddb_client.list_tables.return_value = {"TableNames": []}

        def boto_factory(service, region_name=None, **kw):
            if service == "cloudwatch":
                return cw_client
            if service == "rds":
                return rds_client
            if service == "dynamodb":
                return ddb_client
            if service == "apigateway":
                apigw = MagicMock()
                apigw.get_rest_api.return_value = {"id": "abc"}
                return apigw
            return MagicMock()

        mock_boto.side_effect = boto_factory

        import health_check_aggregator as m
        m.cw = cw_client
        m.AURORA_CLUSTER = "test-cluster"
        m.API_GW_ID = "test-api"
        m.PRIMARY_REGION = "us-east-1"
        m.SECONDARY_REGION = "us-west-2"
        m.ENVIRONMENT = "test"

        with patch.object(m, "_check_aurora", return_value=True), \
             patch.object(m, "_check_dynamodb", return_value=True), \
             patch.object(m, "_check_api_gateway", return_value=True):
            result = m.handler({}, _make_context())

        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertTrue(body["us-east-1"]["healthy"])

    @patch("boto3.client")
    def test_aurora_down_marks_region_unhealthy(self, mock_boto):
        """Aurora unavailable → overall regional health = False."""
        import health_check_aggregator as m
        m.cw = MagicMock()
        m.AURORA_CLUSTER = "test-cluster"
        m.API_GW_ID = "test-api"
        m.PRIMARY_REGION = "us-east-1"
        m.SECONDARY_REGION = "us-west-2"
        m.ENVIRONMENT = "test"

        with patch.object(m, "_check_aurora", return_value=False), \
             patch.object(m, "_check_dynamodb", return_value=True), \
             patch.object(m, "_check_api_gateway", return_value=True):
            result = m.handler({}, _make_context())

        body = json.loads(result["body"])
        self.assertFalse(body["us-east-1"]["healthy"])
        self.assertFalse(body["us-east-1"]["checks"]["aurora"])

    @patch("boto3.client")
    def test_publishes_metrics_for_each_region_and_service(self, _mock_boto):
        """_publish called once per service + overall per region (2 regions × 4 = 8 calls)."""
        import health_check_aggregator as m
        cw = MagicMock()
        m.cw = cw
        m.AURORA_CLUSTER = "cluster"
        m.API_GW_ID = "apigw"
        m.PRIMARY_REGION = "us-east-1"
        m.SECONDARY_REGION = "us-west-2"
        m.ENVIRONMENT = "test"

        with patch.object(m, "_check_aurora", return_value=True), \
             patch.object(m, "_check_dynamodb", return_value=True), \
             patch.object(m, "_check_api_gateway", return_value=True):
            m.handler({}, _make_context())

        # 3 services + 1 overall = 4 per region × 2 regions = 8 put_metric_data calls
        self.assertEqual(cw.put_metric_data.call_count, 8)


# ─────────────────────────────────────────────────────────────────────────────
# failover_orchestrator tests
# ─────────────────────────────────────────────────────────────────────────────

class TestFailoverOrchestrator(unittest.TestCase):

    def _patch_module(self, failover_enabled=True, current_active=None):
        """Return patched module-level clients."""
        import failover_orchestrator as m

        ssm = MagicMock()
        rds = MagicMock()
        sns = MagicMock()

        def ssm_get(Name):
            if Name == m.FAILOVER_ENABLED_PARAM:
                return {"Parameter": {"Value": "true" if failover_enabled else "false"}}
            if Name == m.ACTIVE_REGION_PARAM and current_active:
                return {"Parameter": {"Value": current_active}}
            raise m.ClientError({"Error": {"Code": "ParameterNotFound", "Message": ""}}, "GetParameter")

        ssm.get_parameter.side_effect = ssm_get
        m.ssm = ssm
        m.rds = rds
        m.sns = sns
        m.GLOBAL_CLUSTER_ID = "test-global"
        m.SECONDARY_CLUSTER_ARN = "arn:aws:rds:us-west-2:123:cluster:secondary"
        m.ALERT_SNS_ARN = "arn:aws:sns:us-east-1:123:alerts"
        m.PRIMARY_REGION = "us-east-1"
        m.SECONDARY_REGION = "us-west-2"
        m.ENVIRONMENT = "test"
        return m, ssm, rds, sns

    def test_failover_disabled_returns_early(self):
        m, ssm, rds, _ = self._patch_module(failover_enabled=False)
        result = m.handler({}, _make_context())
        self.assertEqual(result["statusCode"], 200)
        self.assertIn("disabled", result["body"])
        rds.remove_from_global_cluster.assert_not_called()

    def test_already_failed_over_is_idempotent(self):
        m, ssm, rds, _ = self._patch_module(
            failover_enabled=True, current_active="us-west-2"
        )
        result = m.handler({}, _make_context())
        self.assertEqual(result["statusCode"], 200)
        self.assertIn("already", result["body"])
        rds.remove_from_global_cluster.assert_not_called()

    def test_successful_failover_promotes_aurora_and_updates_ssm(self):
        m, ssm, rds, sns = self._patch_module(
            failover_enabled=True, current_active="us-east-1"
        )
        result = m.handler({}, _make_context())
        self.assertEqual(result["statusCode"], 200)
        self.assertIn("us-west-2", result["body"])
        # Aurora promotion called
        rds.remove_from_global_cluster.assert_called_once()
        # SSM updated to secondary
        ssm.put_parameter.assert_called_once_with(
            Name=m.ACTIVE_REGION_PARAM,
            Value="us-west-2",
            Type="String",
            Overwrite=True,
        )
        # On-call paged
        sns.publish.assert_called_once()
        page_msg = sns.publish.call_args[1]["Message"]
        self.assertIn("FAILOVER COMPLETE", page_msg)

    def test_failover_exception_pages_oncall_and_reraises(self):
        m, ssm, rds, sns = self._patch_module(
            failover_enabled=True, current_active="us-east-1"
        )
        rds.remove_from_global_cluster.side_effect = Exception("RDS error")
        with self.assertRaises(Exception):
            m.handler({}, _make_context())
        sns.publish.assert_called_once()
        self.assertIn("FAILOVER FAILED", sns.publish.call_args[1]["Message"])


# ─────────────────────────────────────────────────────────────────────────────
# failback_orchestrator tests
# ─────────────────────────────────────────────────────────────────────────────

class TestFailbackOrchestrator(unittest.TestCase):

    def _patch_module(self, primary_healthy=True, current_active="us-west-2"):
        import failback_orchestrator as m

        ssm = MagicMock()
        rds = MagicMock()
        sns = MagicMock()

        def ssm_get(Name):
            if Name == m.ACTIVE_REGION_PARAM:
                return {"Parameter": {"Value": current_active}}
            raise m.ClientError({"Error": {"Code": "ParameterNotFound", "Message": ""}}, "GetParameter")

        ssm.get_parameter.side_effect = ssm_get

        # Aurora health check mock
        rds.describe_db_clusters.return_value = {
            "DBClusters": [{"Status": "available" if primary_healthy else "stopped"}]
        }

        m.ssm = ssm
        m.rds = rds
        m.sns = sns
        m.PRIMARY_CLUSTER_ARN = "arn:aws:rds:us-east-1:123:cluster:primary"
        m.SECONDARY_CLUSTER_ARN = "arn:aws:rds:us-west-2:123:cluster:secondary"
        m.ALERT_SNS_ARN = "arn:aws:sns:us-east-1:123:alerts"
        m.PRIMARY_REGION = "us-east-1"
        m.SECONDARY_REGION = "us-west-2"
        m.ENVIRONMENT = "test"
        return m, ssm, rds, sns

    def test_missing_confirm_returns_400(self):
        m, *_ = self._patch_module()
        result = m.handler({"body": json.dumps({"confirm": False})}, _make_context())
        self.assertEqual(result["statusCode"], 400)

    def test_already_on_primary_returns_200_no_op(self):
        m, _, rds, _ = self._patch_module(current_active="us-east-1")
        result = m.handler({"body": json.dumps({"confirm": True})}, _make_context())
        body = json.loads(result["body"])
        self.assertIn("no failback needed", body["message"])
        rds.create_global_cluster.assert_not_called()

    def test_unhealthy_primary_returns_409(self):
        m, *_ = self._patch_module(primary_healthy=False)
        result = m.handler({"body": json.dumps({"confirm": True})}, _make_context())
        self.assertEqual(result["statusCode"], 409)
        body = json.loads(result["body"])
        self.assertIn("not healthy", body["error"])

    def test_successful_failback_creates_global_cluster_and_updates_ssm(self):
        m, ssm, rds, sns = self._patch_module(primary_healthy=True)
        result = m.handler(
            {"body": json.dumps({"confirm": True, "new_global_cluster_id": "securebase-global-test-v2"})},
            _make_context()
        )
        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertIn("us-east-1", body["message"])
        # Global cluster recreated
        rds.create_global_cluster.assert_called_once()
        # SSM updated to primary
        ssm.put_parameter.assert_called_once_with(
            Name=m.ACTIVE_REGION_PARAM,
            Value="us-east-1",
            Type="String",
            Overwrite=True,
        )
        sns.publish.assert_called_once()
        self.assertIn("FAILBACK COMPLETE", sns.publish.call_args[1]["Subject"])

    def test_failback_exception_pages_oncall_and_reraises(self):
        m, _, rds, sns = self._patch_module(primary_healthy=True)
        rds.create_global_cluster.side_effect = Exception("RDS error")
        with self.assertRaises(Exception):
            m.handler({"body": json.dumps({"confirm": True})}, _make_context())
        self.assertIn("FAILBACK FAILED", sns.publish.call_args[1]["Subject"])


# ─────────────────────────────────────────────────────────────────────────────
# RTO / RPO smoke test (timing contract)
# ─────────────────────────────────────────────────────────────────────────────

class TestDRTimingContract(unittest.TestCase):
    """
    Validates that the failover and failback Lambda execution paths
    complete within acceptable wall-clock time under mock conditions.
    Target: orchestrator code path (excluding actual AWS API wait) < 2 s.
    """

    def test_failover_orchestrator_completes_quickly(self):
        import time
        import failover_orchestrator as m

        ssm = MagicMock()
        ssm.get_parameter.side_effect = [
            {"Parameter": {"Value": "true"}},   # failover_enabled
            {"Parameter": {"Value": "us-east-1"}},  # current active
        ]
        m.ssm = ssm
        m.rds = MagicMock()
        m.sns = MagicMock()
        m.GLOBAL_CLUSTER_ID = "g"
        m.SECONDARY_CLUSTER_ARN = "arn:x"
        m.ALERT_SNS_ARN = "arn:sns"
        m.PRIMARY_REGION = "us-east-1"
        m.SECONDARY_REGION = "us-west-2"
        m.ENVIRONMENT = "test"

        start = time.time()
        m.handler({}, _make_context())
        elapsed = time.time() - start
        # Orchestration logic (no real I/O) must complete well under 2s
        self.assertLess(elapsed, 2.0, f"Failover orchestrator too slow: {elapsed:.2f}s")


if __name__ == "__main__":
    unittest.main()
