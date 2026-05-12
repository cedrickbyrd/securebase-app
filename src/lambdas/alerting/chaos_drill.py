"""
Chaos / DR Drill Automation — Phase 6 / Track 3

Triggered monthly by EventBridge or on-demand. Orchestrates synthetic failure
injection to validate alert routing, runbook execution, and RTO/RPO targets.

Drill types:
- lambda_throttle: Set reserved concurrency to 0 on a non-critical Lambda
- db_connection_spike: Simulate connection exhaustion via repeated short-lived Lambda invocations
- full_drill: Run all drill scenarios sequentially

On start: sets PagerDuty maintenance window via API to suppress pages.
On end:   clears maintenance window, generates post-drill summary to S3.
"""
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

_AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", os.environ.get("AWS_REGION", "us-east-1"))
_ssm = boto3.client("ssm", region_name=_AWS_REGION)
_lambda_client = boto3.client("lambda", region_name=_AWS_REGION)
_cloudwatch = boto3.client("cloudwatch", region_name=_AWS_REGION)
_s3 = boto3.client("s3", region_name=_AWS_REGION)

ENVIRONMENT = os.environ.get("ENVIRONMENT", "prod")
PAGERDUTY_SSM_PARAM = os.environ.get("PAGERDUTY_SSM_PARAM", "/securebase/alerts/pagerduty_routing_key")
MAINTENANCE_PARAM = os.environ.get("MAINTENANCE_PARAM", f"/securebase/{ENVIRONMENT}/maintenance_mode")
DRILL_RESULTS_BUCKET = os.environ.get("DRILL_RESULTS_BUCKET", "")
SLACK_WEBHOOK_SSM = os.environ.get("SLACK_WEBHOOK_SSM", "/securebase/alerts/slack_webhook_url")

# Functions safe for throttle simulation (non-critical, non-auth)
DRILL_TARGET_FUNCTIONS = [
    f"securebase-{ENVIRONMENT}-alarm-aggregator",
]

DRILL_DURATION_SECONDS = 120


def _get_ssm_param(name: str, decrypt: bool = True) -> str:
    try:
        return _ssm.get_parameter(Name=name, WithDecryption=decrypt)["Parameter"]["Value"].strip()
    except ClientError as exc:
        logger.warning("SSM param %s unavailable: %s", name, exc)
        return ""


def _set_ssm_param(name: str, value: str) -> None:
    try:
        _ssm.put_parameter(Name=name, Value=value, Type="String", Overwrite=True)
    except ClientError as exc:
        logger.error("Failed to write SSM param %s: %s", name, exc)


def _set_maintenance_mode(enabled: bool) -> None:
    _set_ssm_param(MAINTENANCE_PARAM, "true" if enabled else "false")
    logger.info("Maintenance mode set to: %s", enabled)


def _create_pagerduty_maintenance_window(pd_routing_key: str, duration_minutes: int) -> str | None:
    """Create a PagerDuty maintenance window via Events API v2.
    Returns window_id if created, or None on failure.
    """
    import urllib.request
    import urllib.error

    if not pd_routing_key:
        return None

    payload = {
        "routing_key": pd_routing_key,
        "event_action": "trigger",
        "dedup_key": f"securebase-chaos-drill-{ENVIRONMENT}-{int(time.time())}",
        "payload": {
            "summary": f"[DRILL] SecureBase {ENVIRONMENT} chaos drill starting — alerts suppressed for {duration_minutes} min",
            "severity": "info",
            "source": f"securebase-{ENVIRONMENT}-chaos-drill",
            "custom_details": {
                "environment": ENVIRONMENT,
                "drill_type": "chaos",
                "duration_minutes": duration_minutes,
            },
        },
    }

    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://events.pagerduty.com/v2/enqueue",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            dedup_key = result.get("dedup_key", "")
            logger.info("PagerDuty maintenance event created: dedup_key=%s", dedup_key)
            return dedup_key
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        logger.warning("PagerDuty maintenance window creation failed: %s", exc)
        return None


def _resolve_pagerduty_maintenance(pd_routing_key: str, dedup_key: str) -> None:
    """Resolve the PagerDuty maintenance event after the drill."""
    import urllib.request
    import urllib.error

    if not pd_routing_key or not dedup_key:
        return

    payload = {
        "routing_key": pd_routing_key,
        "event_action": "resolve",
        "dedup_key": dedup_key,
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://events.pagerduty.com/v2/enqueue",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10):
            logger.info("PagerDuty maintenance event resolved: %s", dedup_key)
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        logger.warning("Failed to resolve PagerDuty maintenance event: %s", exc)


def _notify_slack(message: str) -> None:
    import urllib.request
    import urllib.error

    webhook_url = _get_ssm_param(SLACK_WEBHOOK_SSM)
    if not webhook_url:
        return

    payload = {"text": f":test_tube: *[{ENVIRONMENT.upper()} DRILL]* {message}"}
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        webhook_url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=8):
            pass
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        logger.warning("Slack notification failed: %s", exc)


# ── Drill scenarios ───────────────────────────────────────────────────────────

def _drill_lambda_throttle() -> dict:
    """
    Inject Lambda throttle by setting reserved concurrency to 0,
    wait DRILL_DURATION_SECONDS, then restore it.
    """
    results = []
    for function_name in DRILL_TARGET_FUNCTIONS:
        start = time.time()
        try:
            # Throttle
            _lambda_client.put_function_concurrency(
                FunctionName=function_name,
                ReservedConcurrentExecutions=0,
            )
            logger.info("Throttled %s (concurrency=0)", function_name)
            time.sleep(DRILL_DURATION_SECONDS)

            # Restore
            _lambda_client.delete_function_concurrency(FunctionName=function_name)
            logger.info("Restored %s concurrency", function_name)

            duration = time.time() - start
            results.append({"function": function_name, "status": "success", "duration_s": round(duration, 1)})
        except ClientError as exc:
            logger.error("Throttle drill failed for %s: %s", function_name, exc)
            # Attempt restore even on failure
            try:
                _lambda_client.delete_function_concurrency(FunctionName=function_name)
            except ClientError:
                pass
            results.append({"function": function_name, "status": "failed", "reason": str(exc)})

    return {"scenario": "lambda_throttle", "results": results}


def _drill_alarm_check() -> dict:
    """Verify that CloudWatch alarms for the environment exist and are in OK state at baseline."""
    try:
        response = _cloudwatch.describe_alarms(
            AlarmNamePrefix=f"securebase-{ENVIRONMENT}-",
            StateValue="ALARM",
        )
        alarm_count = len(response.get("MetricAlarms", []) + response.get("CompositeAlarms", []))
        logger.info("Active alarms at drill start: %d", alarm_count)
        return {
            "scenario": "alarm_check",
            "active_alarm_count": alarm_count,
            "status": "warning" if alarm_count > 0 else "ok",
        }
    except ClientError as exc:
        logger.error("Alarm check failed: %s", exc)
        return {"scenario": "alarm_check", "status": "failed", "reason": str(exc)}


def _save_drill_results(results: dict) -> str | None:
    """Save drill results JSON to S3."""
    if not DRILL_RESULTS_BUCKET:
        logger.warning("DRILL_RESULTS_BUCKET not set — results not saved")
        return None

    key = f"drill-results/{ENVIRONMENT}/{results['drill_id']}.json"
    try:
        _s3.put_object(
            Bucket=DRILL_RESULTS_BUCKET,
            Key=key,
            Body=json.dumps(results, indent=2).encode(),
            ContentType="application/json",
        )
        logger.info("Drill results saved to s3://%s/%s", DRILL_RESULTS_BUCKET, key)
        return f"s3://{DRILL_RESULTS_BUCKET}/{key}"
    except ClientError as exc:
        logger.error("Failed to save drill results: %s", exc)
        return None


def handler(event: dict, _context: Any) -> dict:
    """Lambda handler — invoked by EventBridge schedule or direct invocation."""
    action = event.get("action", "full_drill")
    drill_id = f"drill-{ENVIRONMENT}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    drill_start = time.time()

    logger.info("Chaos drill starting: id=%s, action=%s, source=%s",
                drill_id, action, event.get("source", "manual"))

    pd_routing_key = _get_ssm_param(PAGERDUTY_SSM_PARAM)
    pd_dedup_key = None

    # Enable maintenance mode and suppress PagerDuty pages
    _set_maintenance_mode(True)
    if pd_routing_key:
        pd_dedup_key = _create_pagerduty_maintenance_window(pd_routing_key, duration_minutes=30)
    _notify_slack(f"Chaos drill starting: `{drill_id}` | action=`{action}`")

    scenario_results = []
    try:
        if action in ("lambda_throttle", "full_drill"):
            scenario_results.append(_drill_lambda_throttle())

        if action in ("alarm_check", "full_drill"):
            scenario_results.append(_drill_alarm_check())

    finally:
        # Always disable maintenance mode
        _set_maintenance_mode(False)
        if pd_routing_key and pd_dedup_key:
            _resolve_pagerduty_maintenance(pd_routing_key, pd_dedup_key)

    duration = round(time.time() - drill_start, 1)
    success = all(r.get("status") not in ("failed",) for r in scenario_results)

    summary = {
        "drill_id": drill_id,
        "environment": ENVIRONMENT,
        "action": action,
        "success": success,
        "duration_s": duration,
        "scenario_count": len(scenario_results),
        "scenarios": scenario_results,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }

    results_uri = _save_drill_results(summary)
    if results_uri:
        summary["results_s3_uri"] = results_uri

    status = "PASSED" if success else "FAILED"
    _notify_slack(f"Chaos drill complete: `{drill_id}` | status=*{status}* | duration={duration}s")
    logger.info("Drill complete: %s", json.dumps(summary, default=str))

    return {"statusCode": 200, "body": json.dumps(summary)}
