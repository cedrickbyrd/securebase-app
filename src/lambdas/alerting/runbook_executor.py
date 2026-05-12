"""
Runbook Executor — Phase 6 / Track 3

Triggered by SNS (P1 or P2 topic) when a CloudWatch alarm fires.
Loads the appropriate runbook JSON from S3 and executes each step sequentially.
Notifies PagerDuty and/or Slack on step completion or failure.

Runbook JSON schema:
{
  "runbook_id": "high_lambda_error_rate",
  "version": "1.0",
  "trigger_patterns": ["*-error-rate", "*-errors-critical"],
  "steps": [
    {
      "step_id": 1,
      "name": "capture_logs",
      "action": "capture_lambda_logs",
      "params": {"tail_minutes": 30},
      "on_failure": "continue"
    },
    ...
  ]
}
"""
import json
import logging
import os
import time
from datetime import datetime, timezone
from fnmatch import fnmatch
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

_AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", os.environ.get("AWS_REGION", "us-east-1"))
_ssm = boto3.client("ssm", region_name=_AWS_REGION)
_s3 = boto3.client("s3", region_name=_AWS_REGION)
_lambda_client = boto3.client("lambda", region_name=_AWS_REGION)
_cloudwatch = boto3.client("cloudwatch", region_name=_AWS_REGION)
_dynamodb = boto3.resource("dynamodb", region_name=_AWS_REGION)

ENVIRONMENT = os.environ.get("ENVIRONMENT", "prod")
RUNBOOK_BUCKET = os.environ.get("RUNBOOK_BUCKET", "")
RUNBOOK_PREFIX = os.environ.get("RUNBOOK_PREFIX", "runbooks/")
PAGERDUTY_SSM_PARAM = os.environ.get("PAGERDUTY_SSM_PARAM", "/securebase/alerts/pagerduty_routing_key")
SLACK_WEBHOOK_SSM = os.environ.get("SLACK_WEBHOOK_SSM", "/securebase/alerts/slack_webhook_url")
MAINTENANCE_PARAM = os.environ.get("MAINTENANCE_PARAM", f"/securebase/{ENVIRONMENT}/maintenance_mode")


def _get_ssm_secret(param_name: str) -> str:
    """Retrieve a SecureString SSM parameter."""
    try:
        return _ssm.get_parameter(Name=param_name, WithDecryption=True)["Parameter"]["Value"].strip()
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        logger.warning("SSM param %s not found (%s)", param_name, code)
        return ""


def _is_maintenance_mode() -> bool:
    try:
        value = _ssm.get_parameter(Name=MAINTENANCE_PARAM)["Parameter"]["Value"].strip().lower()
        return value == "true"
    except ClientError:
        return False


def _list_runbooks() -> list[dict]:
    """List all runbook JSON files in the S3 bucket."""
    if not RUNBOOK_BUCKET:
        return []
    try:
        paginator = _s3.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=RUNBOOK_BUCKET, Prefix=RUNBOOK_PREFIX)
        return [obj for page in pages for obj in page.get("Contents", []) if obj["Key"].endswith(".json")]
    except ClientError as exc:
        logger.error("Failed to list runbooks from S3: %s", exc)
        return []


def _load_runbook(s3_key: str) -> dict | None:
    """Load and parse a runbook JSON from S3."""
    try:
        obj = _s3.get_object(Bucket=RUNBOOK_BUCKET, Key=s3_key)
        return json.loads(obj["Body"].read())
    except (ClientError, json.JSONDecodeError) as exc:
        logger.error("Failed to load runbook %s: %s", s3_key, exc)
        return None


def _match_runbook(alarm_name: str, runbooks: list[tuple[str, dict]]) -> dict | None:
    """Find the first runbook whose trigger_patterns match the alarm name."""
    for _key, runbook in runbooks:
        for pattern in runbook.get("trigger_patterns", []):
            if fnmatch(alarm_name, pattern):
                logger.info("Runbook '%s' matched alarm '%s' via pattern '%s'",
                            runbook.get("runbook_id"), alarm_name, pattern)
                return runbook
    return None


# ── Step executors ────────────────────────────────────────────────────────────

def _step_capture_lambda_logs(alarm_name: str, params: dict) -> dict:
    """Capture recent CloudWatch logs for the Lambda function named in the alarm."""
    function_name = params.get("function_name") or alarm_name.split("-errors")[0].split("-error-rate")[0]
    tail_minutes = params.get("tail_minutes", 30)
    log_group = f"/aws/lambda/{function_name}"
    logs_client = boto3.client("logs")

    start_ms = int((time.time() - tail_minutes * 60) * 1000)
    try:
        response = logs_client.filter_log_events(
            logGroupName=log_group,
            startTime=start_ms,
            filterPattern="ERROR",
            limit=100,
        )
        events = response.get("events", [])
        logger.info("Captured %d error log events from %s", len(events), log_group)
        return {"status": "success", "log_count": len(events), "log_group": log_group}
    except ClientError as exc:
        logger.warning("Could not capture logs for %s: %s", log_group, exc)
        return {"status": "skipped", "reason": str(exc)}


def _step_notify(alarm_name: str, params: dict, execution_id: str) -> dict:
    """Send a notification to Slack or PagerDuty."""
    import urllib.request
    import urllib.error

    message = params.get("message", f"Runbook step executed for alarm: {alarm_name}")
    channel = params.get("channel", "slack")

    if channel == "pagerduty":
        pd_key = _get_ssm_secret(PAGERDUTY_SSM_PARAM)
        if not pd_key:
            return {"status": "skipped", "reason": "PagerDuty key not configured"}
        payload = {
            "routing_key": pd_key,
            "event_action": "trigger",
            "dedup_key": f"runbook-{execution_id}",
            "payload": {
                "summary": message,
                "severity": "warning",
                "source": f"securebase-{ENVIRONMENT}",
                "custom_details": {"alarm_name": alarm_name, "execution_id": execution_id},
            },
        }
        url = "https://events.pagerduty.com/v2/enqueue"
    else:
        webhook_url = _get_ssm_secret(SLACK_WEBHOOK_SSM)
        if not webhook_url:
            return {"status": "skipped", "reason": "Slack webhook not configured"}
        payload = {"text": f":warning: *[{ENVIRONMENT.upper()}]* {message}\n_Alarm:_ `{alarm_name}` | _Execution:_ `{execution_id}`"}
        url = webhook_url

    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            logger.info("Notification sent to %s: status=%s", channel, resp.status)
            return {"status": "success", "channel": channel}
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        logger.error("Notification to %s failed: %s", channel, exc)
        return {"status": "failed", "reason": str(exc)}


def _step_invoke_lambda(alarm_name: str, params: dict) -> dict:
    """Invoke an AWS Lambda function as a runbook step."""
    function_name = params.get("function_name", "")
    if not function_name:
        return {"status": "failed", "reason": "function_name is required"}
    payload = params.get("payload", {})
    payload["_runbook_trigger"] = True
    payload["alarm_name"] = alarm_name

    try:
        response = _lambda_client.invoke(
            FunctionName=function_name,
            InvocationType="Event",
            Payload=json.dumps(payload).encode(),
        )
        status_code = response.get("StatusCode", 0)
        logger.info("Invoked Lambda %s: status=%s", function_name, status_code)
        return {"status": "success" if status_code == 202 else "failed", "status_code": status_code}
    except ClientError as exc:
        logger.error("Lambda invocation failed for %s: %s", function_name, exc)
        return {"status": "failed", "reason": str(exc)}


def _step_set_concurrency(alarm_name: str, params: dict) -> dict:
    """Set (or remove) reserved concurrency on a Lambda function."""
    function_name = params.get("function_name", "")
    concurrency = params.get("concurrency")
    if not function_name:
        return {"status": "failed", "reason": "function_name is required"}

    try:
        if concurrency is None:
            _lambda_client.delete_function_concurrency(FunctionName=function_name)
            logger.info("Removed concurrency limit on %s", function_name)
        else:
            _lambda_client.put_function_concurrency(
                FunctionName=function_name,
                ReservedConcurrentExecutions=concurrency,
            )
            logger.info("Set concurrency=%s on %s", concurrency, function_name)
        return {"status": "success", "function": function_name, "concurrency": concurrency}
    except ClientError as exc:
        logger.error("Failed to set concurrency on %s: %s", function_name, exc)
        return {"status": "failed", "reason": str(exc)}


STEP_EXECUTORS: dict[str, Any] = {
    "capture_lambda_logs": _step_capture_lambda_logs,
    "notify": _step_notify,
    "invoke_lambda": _step_invoke_lambda,
    "set_concurrency": _step_set_concurrency,
}


def _execute_step(step: dict, alarm_name: str, execution_id: str) -> dict:
    action = step.get("action", "")
    params = step.get("params", {})
    executor = STEP_EXECUTORS.get(action)
    if executor is None:
        logger.warning("Unknown action '%s' in step %s — skipping", action, step.get("step_id"))
        return {"status": "skipped", "reason": f"unknown action: {action}"}

    if action == "notify":
        return executor(alarm_name, params, execution_id)
    return executor(alarm_name, params)


def _run_runbook(runbook: dict, alarm_name: str, alarm_state: str) -> dict:
    """Execute all steps in a runbook, respecting on_failure policy."""
    execution_id = f"{runbook['runbook_id']}-{int(time.time())}"
    results = []
    success = True

    logger.info("Starting runbook execution: id=%s, alarm=%s, state=%s",
                execution_id, alarm_name, alarm_state)

    for step in runbook.get("steps", []):
        step_id = step.get("step_id", "?")
        step_name = step.get("name", "unnamed")
        on_failure = step.get("on_failure", "abort")

        logger.info("Executing step %s: %s", step_id, step_name)
        result = _execute_step(step, alarm_name, execution_id)
        result["step_id"] = step_id
        result["step_name"] = step_name
        results.append(result)

        if result.get("status") == "failed":
            logger.error("Step %s (%s) failed: %s", step_id, step_name, result.get("reason"))
            if on_failure == "abort":
                success = False
                break

    return {
        "execution_id": execution_id,
        "runbook_id": runbook.get("runbook_id"),
        "alarm_name": alarm_name,
        "alarm_state": alarm_state,
        "success": success,
        "steps_executed": len(results),
        "results": results,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }


def handler(event: dict, _context: Any) -> dict:
    """Lambda handler — invoked by SNS when a CloudWatch alarm fires."""
    if _is_maintenance_mode():
        logger.info("Maintenance mode — suppressing runbook execution")
        return {"statusCode": 200, "body": "maintenance mode active"}

    if not RUNBOOK_BUCKET:
        logger.warning("RUNBOOK_BUCKET not configured — runbook execution skipped")
        return {"statusCode": 200, "body": "no runbook bucket configured"}

    # Load all runbooks from S3 once per invocation
    runbook_objects = _list_runbooks()
    runbooks_loaded: list[tuple[str, dict]] = []
    for obj in runbook_objects:
        rb = _load_runbook(obj["Key"])
        if rb:
            runbooks_loaded.append((obj["Key"], rb))

    executions = []
    for record in event.get("Records", []):
        try:
            sns_msg = json.loads(record["Sns"]["Message"])
            alarm_name = sns_msg.get("AlarmName", "")
            alarm_state = sns_msg.get("NewStateValue", "ALARM")

            if alarm_state != "ALARM":
                logger.info("Alarm %s transitioned to %s — no runbook needed", alarm_name, alarm_state)
                continue

            runbook = _match_runbook(alarm_name, runbooks_loaded)
            if runbook is None:
                logger.info("No runbook matched alarm '%s'", alarm_name)
                continue

            result = _run_runbook(runbook, alarm_name, alarm_state)
            executions.append(result)
            logger.info("Runbook execution complete: %s", result.get("execution_id"))
        except Exception as exc:
            logger.error("Error processing SNS record: %s", exc)

    return {"statusCode": 200, "executions": executions}
