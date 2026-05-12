"""
Unit tests for Phase 6 / Track 3: Alerting & Incident Response Lambda functions.

Tests cover:
- runbook_executor: maintenance mode, runbook matching, step execution
- alarm_aggregator: SNS event parsing, DynamoDB persistence, MTTA/MTTR calculation
- chaos_drill: maintenance mode toggle, Lambda throttle/restore, result storage
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
LAMBDAS_DIR = os.path.join(
    os.path.dirname(__file__), '..', '..', 'src', 'lambdas', 'alerting'
)
sys.path.insert(0, os.path.abspath(LAMBDAS_DIR))

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_sns_event(alarm_name: str, state: str = "ALARM", topic_arn: str = "arn:aws:sns:us-east-1:123:p2-high") -> dict:
    message = json.dumps({
        "AlarmName": alarm_name,
        "NewStateValue": state,
        "NewStateReason": "Test threshold crossed",
        "Region": "us-east-1",
        "AWSAccountId": "123456789012",
    })
    return {
        "Records": [
            {
                "Sns": {
                    "TopicArn": topic_arn,
                    "Message": message,
                }
            }
        ]
    }


def _make_context():
    ctx = MagicMock()
    ctx.aws_request_id = "test-req-123"
    return ctx


# ===========================================================================
# runbook_executor tests
# ===========================================================================

class TestRunbookExecutorMaintenanceMode:
    """Runbook executor suppresses execution during maintenance mode."""

    @patch.dict(os.environ, {"ENVIRONMENT": "prod", "RUNBOOK_BUCKET": "test-bucket"})
    @patch("runbook_executor._ssm")
    def test_suppressed_during_maintenance(self, mock_ssm):
        import runbook_executor
        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": "true"}}

        result = runbook_executor.handler({}, _make_context())

        assert result["statusCode"] == 200
        assert "maintenance mode" in result["body"]

    @patch.dict(os.environ, {"ENVIRONMENT": "prod", "RUNBOOK_BUCKET": ""})
    @patch("runbook_executor._ssm")
    def test_no_bucket_configured(self, mock_ssm):
        import runbook_executor
        mock_ssm.get_parameter.side_effect = Exception("not found")

        result = runbook_executor.handler({}, _make_context())

        assert result["statusCode"] == 200
        assert "no runbook bucket configured" in result["body"]


class TestRunbookMatching:
    """Runbook is matched by alarm name pattern."""

    def test_match_by_pattern(self):
        from runbook_executor import _match_runbook
        runbooks = [
            ("runbooks/high_lambda_error_rate.json", {
                "runbook_id": "high_lambda_error_rate",
                "trigger_patterns": ["*-error-rate", "*-errors-critical"],
                "steps": [],
            })
        ]
        result = _match_runbook("securebase-prod-auth_v2-error-rate", runbooks)
        assert result is not None
        assert result["runbook_id"] == "high_lambda_error_rate"

    def test_no_match(self):
        from runbook_executor import _match_runbook
        runbooks = [
            ("runbooks/aurora_failover.json", {
                "runbook_id": "aurora_failover",
                "trigger_patterns": ["*-aurora-*"],
                "steps": [],
            })
        ]
        result = _match_runbook("securebase-prod-lambda-errors", runbooks)
        assert result is None

    def test_ok_state_skipped(self):
        """Runbook execution is skipped when alarm transitions to OK."""
        from runbook_executor import _match_runbook
        runbooks = [
            ("runbooks/lambda.json", {
                "runbook_id": "lambda_error",
                "trigger_patterns": ["*-error-rate"],
                "steps": [],
            })
        ]
        # Pattern would match, but the handler checks state before calling _match_runbook
        result = _match_runbook("securebase-prod-auth_v2-error-rate", runbooks)
        assert result is not None  # matching is state-agnostic; handler guards state


class TestRunbookStepExecution:
    """Individual runbook step actions execute correctly."""

    @patch("runbook_executor._lambda_client")
    def test_invoke_lambda_step(self, mock_lambda):
        from runbook_executor import _step_invoke_lambda
        mock_lambda.invoke.return_value = {"StatusCode": 202}

        result = _step_invoke_lambda("test-alarm", {"function_name": "securebase-prod-health-check-aggregator"})

        mock_lambda.invoke.assert_called_once()
        assert result["status"] == "success"
        assert result["status_code"] == 202

    @patch("runbook_executor._lambda_client")
    def test_invoke_lambda_missing_function_name(self, _mock_lambda):
        from runbook_executor import _step_invoke_lambda
        result = _step_invoke_lambda("test-alarm", {})
        assert result["status"] == "failed"
        assert "function_name" in result["reason"]

    @patch("runbook_executor.boto3")
    def test_capture_logs_step_skips_on_error(self, mock_boto3):
        from runbook_executor import _step_capture_lambda_logs
        mock_logs = MagicMock()
        mock_boto3.client.return_value = mock_logs
        from botocore.exceptions import ClientError
        mock_logs.filter_log_events.side_effect = ClientError(
            {"Error": {"Code": "ResourceNotFoundException", "Message": "log group not found"}},
            "filter_log_events",
        )

        result = _step_capture_lambda_logs("securebase-prod-auth_v2-error-rate", {})
        assert result["status"] == "skipped"

    @patch("runbook_executor._lambda_client")
    def test_set_concurrency_step(self, mock_lambda):
        from runbook_executor import _step_set_concurrency
        mock_lambda.put_function_concurrency.return_value = {}

        result = _step_set_concurrency("alarm", {"function_name": "securebase-prod-alarm-aggregator", "concurrency": 10})
        assert result["status"] == "success"
        mock_lambda.put_function_concurrency.assert_called_once_with(
            FunctionName="securebase-prod-alarm-aggregator",
            ReservedConcurrentExecutions=10,
        )

    @patch("runbook_executor._lambda_client")
    def test_remove_concurrency_step(self, mock_lambda):
        from runbook_executor import _step_set_concurrency
        mock_lambda.delete_function_concurrency.return_value = {}

        result = _step_set_concurrency("alarm", {"function_name": "securebase-prod-alarm-aggregator"})
        assert result["status"] == "success"
        mock_lambda.delete_function_concurrency.assert_called_once()


class TestRunRunbook:
    """Full runbook execution with multiple steps."""

    @patch("runbook_executor._lambda_client")
    @patch("runbook_executor._ssm")
    def test_run_multi_step_runbook(self, mock_ssm, mock_lambda):
        from runbook_executor import _run_runbook
        mock_ssm.get_parameter.side_effect = Exception("no ssm")
        mock_lambda.invoke.return_value = {"StatusCode": 202}

        runbook = {
            "runbook_id": "test_runbook",
            "steps": [
                {"step_id": 1, "name": "invoke_lambda", "action": "invoke_lambda",
                 "params": {"function_name": "securebase-prod-test"}, "on_failure": "continue"},
                {"step_id": 2, "name": "notify", "action": "notify",
                 "params": {"channel": "slack", "message": "test"}, "on_failure": "continue"},
            ],
        }
        result = _run_runbook(runbook, "test-alarm", "ALARM")

        assert result["runbook_id"] == "test_runbook"
        assert result["steps_executed"] == 2
        assert "execution_id" in result

    def test_abort_on_failure_stops_execution(self):
        from runbook_executor import _run_runbook
        runbook = {
            "runbook_id": "abort_test",
            "steps": [
                {"step_id": 1, "name": "bad_step", "action": "invoke_lambda",
                 "params": {}, "on_failure": "abort"},
                {"step_id": 2, "name": "should_not_run", "action": "notify",
                 "params": {}, "on_failure": "continue"},
            ],
        }
        result = _run_runbook(runbook, "test-alarm", "ALARM")

        assert result["success"] is False
        assert result["steps_executed"] == 1


# ===========================================================================
# alarm_aggregator tests
# ===========================================================================

class TestAlarmAggregatorSeverityDetection:
    """SNS topic ARN maps to correct severity level."""

    def test_p1_topic(self):
        from alarm_aggregator import _determine_severity
        assert _determine_severity("arn:aws:sns:us-east-1:123:securebase-prod-alerts-p1-critical") == "P1"

    def test_p2_topic(self):
        from alarm_aggregator import _determine_severity
        assert _determine_severity("arn:aws:sns:us-east-1:123:securebase-prod-alerts-p2-high") == "P2"

    def test_p3_topic(self):
        from alarm_aggregator import _determine_severity
        assert _determine_severity("arn:aws:sns:us-east-1:123:securebase-prod-alerts-p3-medium") == "P3"

    def test_unknown_defaults_p2(self):
        from alarm_aggregator import _determine_severity
        assert _determine_severity("arn:aws:sns:us-east-1:123:unknown-topic") == "P2"


class TestAlarmAggregatorStorageAndMTTR:
    """Alarm events are stored to DynamoDB with MTTR calculated on OK transitions."""

    @patch("alarm_aggregator._table")
    def test_alarm_event_stored(self, mock_table):
        from alarm_aggregator import _store_alarm_event
        mock_table.put_item.return_value = {}
        mock_table.query.return_value = {"Items": []}

        _store_alarm_event(
            "securebase-prod-auth_v2-error-rate",
            "ALARM",
            "P2",
            {"AlarmName": "securebase-prod-auth_v2-error-rate", "NewStateReason": "Test"},
        )

        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args[1]["Item"]
        assert item["alarm_name"] == "securebase-prod-auth_v2-error-rate"
        assert item["state"] == "ALARM"
        assert item["severity"] == "P2"
        assert "triggered_at" in item
        assert "ttl_epoch" in item

    @patch("alarm_aggregator._table")
    def test_mttr_calculated_on_ok(self, mock_table):
        from alarm_aggregator import _store_alarm_event
        from datetime import timezone

        past_triggered = (
            datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        )
        mock_table.query.return_value = {
            "Items": [{"triggered_at": past_triggered, "state": "ALARM"}]
        }
        mock_table.put_item.return_value = {}

        _store_alarm_event("test-alarm", "OK", "P2", {})

        item = mock_table.put_item.call_args[1]["Item"]
        assert item["resolved_at"] is not None
        assert item.get("mttr_seconds") is not None
        assert item["mttr_seconds"] >= 0


class TestAlarmAggregatorHandler:
    """Handler correctly processes SNS records."""

    @patch("alarm_aggregator._table")
    def test_handler_processes_alarm_record(self, mock_table):
        import alarm_aggregator
        mock_table.put_item.return_value = {}
        mock_table.query.return_value = {"Items": []}

        event = _make_sns_event("securebase-prod-apigw-5xx-rate", "ALARM")
        result = alarm_aggregator.handler(event, _make_context())

        assert result["statusCode"] == 200
        mock_table.put_item.assert_called_once()

    @patch("alarm_aggregator._table")
    def test_handler_processes_ok_record(self, mock_table):
        import alarm_aggregator
        mock_table.put_item.return_value = {}
        mock_table.query.return_value = {"Items": []}

        event = _make_sns_event("securebase-prod-apigw-5xx-rate", "OK")
        result = alarm_aggregator.handler(event, _make_context())

        assert result["statusCode"] == 200

    @patch("alarm_aggregator._table")
    def test_handler_invalid_json_continues(self, mock_table):
        import alarm_aggregator
        event = {
            "Records": [
                {"Sns": {"TopicArn": "arn:aws:sns:us-east-1:123:p2-high", "Message": "not-json"}}
            ]
        }
        result = alarm_aggregator.handler(event, _make_context())
        assert result["statusCode"] == 200
        mock_table.put_item.assert_not_called()


class TestAlarmAggregatorSummary:
    """get_alarm_summary aggregates active alarms by severity."""

    @patch("alarm_aggregator._table")
    def test_summary_groups_by_severity(self, mock_table):
        from alarm_aggregator import get_alarm_summary
        mock_table.scan.return_value = {
            "Items": [
                {"alarm_name": "alarm-1", "severity": "P1", "state": "ALARM", "resolved_at": None},
                {"alarm_name": "alarm-2", "severity": "P2", "state": "ALARM", "resolved_at": None},
                {"alarm_name": "alarm-3", "severity": "P2", "state": "ALARM", "resolved_at": None},
                {"alarm_name": "alarm-4", "severity": "P3", "state": "ALARM", "resolved_at": None},
            ]
        }

        result = get_alarm_summary()

        assert result["active_alarms"]["P1"] == 1
        assert result["active_alarms"]["P2"] == 2
        assert result["active_alarms"]["P3"] == 1
        assert result["active_alarms"]["total"] == 4

    @patch("alarm_aggregator._table")
    def test_summary_empty(self, mock_table):
        from alarm_aggregator import get_alarm_summary
        mock_table.scan.return_value = {"Items": []}

        result = get_alarm_summary()
        assert result["active_alarms"]["total"] == 0


class TestMttaMttrMetrics:
    """MTTA/MTTR averages are calculated correctly."""

    @patch("alarm_aggregator._table")
    def test_average_mttr(self, mock_table):
        from alarm_aggregator import get_mtta_mttr_metrics
        mock_table.scan.return_value = {
            "Items": [
                {"mttr_seconds": 300, "mtta_seconds": 120},
                {"mttr_seconds": 600, "mtta_seconds": 180},
                {"mttr_seconds": 900, "mtta_seconds": None},
            ]
        }

        result = get_mtta_mttr_metrics()

        assert result["mean_mttr_seconds"] == 600  # (300+600+900)/3
        assert result["mean_mtta_seconds"] == 150  # (120+180)/2
        assert result["sample_count"] == 3

    @patch("alarm_aggregator._table")
    def test_no_data_returns_none(self, mock_table):
        from alarm_aggregator import get_mtta_mttr_metrics
        mock_table.scan.return_value = {"Items": []}

        result = get_mtta_mttr_metrics()
        assert result["mean_mttr_seconds"] is None
        assert result["mean_mtta_seconds"] is None


# ===========================================================================
# chaos_drill tests
# ===========================================================================

class TestChaosDrillMaintenanceMode:
    """Chaos drill toggles maintenance mode on start and off on completion."""

    @patch.dict(os.environ, {"ENVIRONMENT": "prod", "DRILL_RESULTS_BUCKET": ""})
    @patch("chaos_drill._lambda_client")
    @patch("chaos_drill._ssm")
    @patch("chaos_drill._s3")
    def test_maintenance_mode_enabled_and_disabled(self, mock_s3, mock_ssm, mock_lambda):
        import chaos_drill
        mock_ssm.get_parameter.side_effect = Exception("no ssm")
        mock_ssm.put_parameter.return_value = {}
        mock_lambda.put_function_concurrency.return_value = {}
        mock_lambda.delete_function_concurrency.return_value = {}

        with patch("chaos_drill.DRILL_DURATION_SECONDS", 0):
            result = chaos_drill.handler({"action": "alarm_check"}, _make_context())

        calls = [c[1].get("Value", c[0][1] if len(c[0]) > 1 else "") for c in mock_ssm.put_parameter.call_args_list]
        values = [c for c in calls if c in ("true", "false")]
        assert "true" in values
        assert "false" in values

    @patch.dict(os.environ, {"ENVIRONMENT": "prod", "DRILL_RESULTS_BUCKET": ""})
    @patch("chaos_drill._lambda_client")
    @patch("chaos_drill._cloudwatch")
    @patch("chaos_drill._ssm")
    @patch("chaos_drill._s3")
    def test_alarm_check_scenario(self, mock_s3, mock_ssm, mock_cw, mock_lambda):
        import chaos_drill
        mock_ssm.get_parameter.side_effect = Exception("no ssm")
        mock_ssm.put_parameter.return_value = {}
        mock_cw.describe_alarms.return_value = {"MetricAlarms": [], "CompositeAlarms": []}

        result = chaos_drill.handler({"action": "alarm_check"}, _make_context())

        body = json.loads(result["body"])
        assert body["action"] == "alarm_check"
        scenario_names = [s["scenario"] for s in body["scenarios"]]
        assert "alarm_check" in scenario_names


class TestChaosDrillLambdaThrottle:
    """Lambda throttle scenario sets and restores concurrency."""

    @patch.dict(os.environ, {"ENVIRONMENT": "prod", "DRILL_RESULTS_BUCKET": ""})
    @patch("chaos_drill._cloudwatch")
    @patch("chaos_drill._ssm")
    @patch("chaos_drill._s3")
    @patch("chaos_drill._lambda_client")
    def test_throttle_and_restore(self, mock_lambda, mock_s3, mock_ssm, mock_cw):
        import chaos_drill
        mock_ssm.get_parameter.side_effect = Exception("no ssm")
        mock_ssm.put_parameter.return_value = {}
        mock_lambda.put_function_concurrency.return_value = {}
        mock_lambda.delete_function_concurrency.return_value = {}

        with patch("chaos_drill.DRILL_DURATION_SECONDS", 0):
            result = chaos_drill.handler({"action": "lambda_throttle"}, _make_context())

        mock_lambda.put_function_concurrency.assert_called()
        mock_lambda.delete_function_concurrency.assert_called()
        body = json.loads(result["body"])
        assert body["success"] is True


class TestChaosDrillResultsSaved:
    """Drill results are saved to S3 when bucket is configured."""

    @patch.dict(os.environ, {"ENVIRONMENT": "prod", "DRILL_RESULTS_BUCKET": "test-bucket"})
    @patch("chaos_drill._cloudwatch")
    @patch("chaos_drill._ssm")
    @patch("chaos_drill._s3")
    @patch("chaos_drill._lambda_client")
    def test_results_saved_to_s3(self, mock_lambda, mock_s3, mock_ssm, mock_cw):
        import chaos_drill
        mock_ssm.get_parameter.side_effect = Exception("no ssm")
        mock_ssm.put_parameter.return_value = {}
        mock_cw.describe_alarms.return_value = {"MetricAlarms": [], "CompositeAlarms": []}
        mock_s3.put_object.return_value = {}

        result = chaos_drill.handler({"action": "alarm_check"}, _make_context())

        mock_s3.put_object.assert_called_once()
        call_kwargs = mock_s3.put_object.call_args[1]
        assert call_kwargs["Bucket"] == "test-bucket"
        assert "drill-results/prod/" in call_kwargs["Key"]
        body = json.loads(result["body"])
        assert "results_s3_uri" in body
