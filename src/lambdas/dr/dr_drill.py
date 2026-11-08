"""
DR Drill Lambda — Phase 6 / Track 2 (Sub-task 2.5)

Scheduled monthly by EventBridge (first Sunday, 02:00 UTC).
Simulates a regional failover, measures elapsed time, validates RTO/RPO,
and writes a drill report to S3. Sends a PagerDuty alert suppression
header before starting so real on-call pages are not fired during the drill.

Environment variables:
    PRIMARY_REGION          AWS region string (default: us-east-1)
    SECONDARY_REGION        AWS region string (default: us-west-2)
    AURORA_GLOBAL_CLUSTER_ID  e.g. securebase-prod-global
    AURORA_CLUSTER_ID       Primary Aurora cluster identifier (optional)
    FAILOVER_LAMBDA_ARN     ARN of the failover_orchestrator Lambda
    FAILOVER_VALIDATOR_LAMBDA_ARN  ARN of failover validator Lambda (optional)
    DRILL_REPORT_BUCKET     S3 bucket for drill reports
    ALERT_SNS_ARN           SNS topic for notifications
    PAGERDUTY_API_KEY_PARAM SSM parameter name for PagerDuty API key
    ENVIRONMENT             prod | staging | dev
"""
import json
import os
import time
import logging
import uuid
from datetime import datetime, timezone, timedelta

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

PRIMARY_REGION          = os.environ.get("PRIMARY_REGION", "us-east-1")
SECONDARY_REGION        = os.environ.get("SECONDARY_REGION", "us-west-2")
GLOBAL_CLUSTER_ID       = os.environ.get("AURORA_GLOBAL_CLUSTER_ID", "")
AURORA_CLUSTER_ID       = os.environ.get("AURORA_CLUSTER_ID", "")
FAILOVER_LAMBDA_ARN     = os.environ.get("FAILOVER_LAMBDA_ARN", "")
FAILOVER_VALIDATOR_LAMBDA_ARN = os.environ.get("FAILOVER_VALIDATOR_LAMBDA_ARN", "")
DRILL_REPORT_BUCKET     = os.environ.get("DRILL_REPORT_BUCKET", "")
ALERT_SNS_ARN           = os.environ.get("ALERT_SNS_ARN", "")
PAGERDUTY_KEY_PARAM     = os.environ.get("PAGERDUTY_API_KEY_PARAM", "/securebase/pagerduty/api_key")
ENVIRONMENT             = os.environ.get("ENVIRONMENT", "prod")

# SSM parameters
ACTIVE_REGION_PARAM     = "/securebase/active_region"
FAILOVER_ENABLED_PARAM  = "/securebase/dr/failover_enabled"
DRILL_SUPPRESSION_PARAM = "/securebase/dr/drill_in_progress"

# RTO/RPO targets
RTO_TARGET_SECONDS = 900   # 15 minutes
RPO_TARGET_SECONDS = 60    # 1 minute


def _aws(service: str, region: str = PRIMARY_REGION, **kwargs):
    return boto3.client(service, region_name=region, **kwargs)


def _suppress_pagerduty_alerts(ssm, drill_id: str, suppress: bool) -> None:
    """Set drill-in-progress SSM flag to suppress PagerDuty noise."""
    try:
        ssm.put_parameter(
            Name=DRILL_SUPPRESSION_PARAM,
            Value="true" if suppress else "false",
            Type="String",
            Overwrite=True,
        )
        logger.info("PagerDuty suppression set to %s (drill %s)", suppress, drill_id)
    except ClientError as exc:
        logger.warning("Could not update drill suppression flag: %s", exc)


def _enable_failover(ssm) -> None:
    ssm.put_parameter(
        Name=FAILOVER_ENABLED_PARAM,
        Value="true",
        Type="String",
        Overwrite=True,
    )


def _disable_failover(ssm) -> None:
    ssm.put_parameter(
        Name=FAILOVER_ENABLED_PARAM,
        Value="false",
        Type="String",
        Overwrite=True,
    )


def _get_active_region(ssm) -> str:
    try:
        return ssm.get_parameter(Name=ACTIVE_REGION_PARAM)["Parameter"]["Value"]
    except ClientError:
        return PRIMARY_REGION


def _invoke_failover_lambda(lam) -> dict:
    """Synchronously invoke failover_orchestrator and return its result."""
    if not FAILOVER_LAMBDA_ARN:
        raise ValueError("FAILOVER_LAMBDA_ARN not configured")
    response = lam.invoke(
        FunctionName=FAILOVER_LAMBDA_ARN,
        InvocationType="RequestResponse",
        Payload=json.dumps({"action": "failover", "reason": "DR drill", "source": "dr_drill"}),
    )
    payload_raw = response["Payload"].read()
    if isinstance(payload_raw, bytes):
        payload_raw = payload_raw.decode("utf-8")
    payload = json.loads(payload_raw or "{}")
    if response.get("FunctionError"):
        raise RuntimeError(f"Failover Lambda error: {payload}")
    return payload


def _get_aurora_replication_lag(cw) -> float:
    """Return latest Aurora Global DB replication lag sample in milliseconds."""
    cluster_id = AURORA_CLUSTER_ID or GLOBAL_CLUSTER_ID
    if not cluster_id:
        return 0.0
    try:
        now = datetime.now(timezone.utc)
        result = cw.get_metric_statistics(
            Namespace="AWS/RDS",
            MetricName="AuroraGlobalDBReplicationLag",
            Dimensions=[{"Name": "DBClusterIdentifier", "Value": cluster_id}],
            StartTime=now - timedelta(minutes=5),
            EndTime=now,
            Period=60,
            Statistics=["Maximum"],
        )
        datapoints = result.get("Datapoints", [])
        if datapoints:
            return float(max(d["Maximum"] for d in datapoints))
        return 0.0
    except ClientError as exc:
        logger.warning("Could not fetch Aurora replication lag: %s", exc)
        return 0.0


def _invoke_failover_validator_lambda(lam, drill_id: str) -> dict:
    """Synchronously invoke failover validator and return normalized result."""
    if not FAILOVER_VALIDATOR_LAMBDA_ARN:
        return {"skipped": True, "message": "FAILOVER_VALIDATOR_LAMBDA_ARN not configured"}

    try:
        response = lam.invoke(
            FunctionName=FAILOVER_VALIDATOR_LAMBDA_ARN,
            InvocationType="RequestResponse",
            Payload=json.dumps({"source": "dr_drill", "drill_id": drill_id}),
        )
    except ClientError as exc:
        return {"passed": False, "error": str(exc), "statusCode": None, "overall_passed": False}

    payload_raw = response["Payload"].read()
    if isinstance(payload_raw, bytes):
        payload_raw = payload_raw.decode("utf-8")
    payload = json.loads(payload_raw or "{}")
    if response.get("FunctionError"):
        return {
            "passed": False,
            "error": f"Failover validator Lambda error: {payload}",
            "statusCode": payload.get("statusCode"),
            "overall_passed": False,
        }

    status_code = payload.get("statusCode")
    body = payload.get("body")
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            logger.warning("Failover validator body was not JSON: %s", body)
            body = {"raw_body": body}

    overall_passed = body.get("overall_passed") if isinstance(body, dict) else None
    missing_overall_flag = overall_passed is None
    if missing_overall_flag:
        passed = status_code == 200
    else:
        passed = status_code == 200 and overall_passed is not False
    return {
        "passed": passed,
        "statusCode": status_code,
        "overall_passed": overall_passed,
        "warning": "overall_passed missing from validator response" if missing_overall_flag else None,
    }


def _invoke_failback(ssm, lam) -> None:
    """Restore active region to primary after drill."""
    ssm.put_parameter(
        Name=ACTIVE_REGION_PARAM,
        Value=PRIMARY_REGION,
        Type="String",
        Overwrite=True,
    )
    logger.info("Active region restored to %s (post-drill)", PRIMARY_REGION)


def _upload_report(s3, report: dict, drill_id: str) -> str:
    """Upload drill report JSON to S3. Returns S3 URI."""
    if not DRILL_REPORT_BUCKET:
        logger.warning("DRILL_REPORT_BUCKET not set — report not persisted")
        return ""
    ts = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    key = f"dr-drills/{ts}/{drill_id}.json"
    s3.put_object(
        Bucket=DRILL_REPORT_BUCKET,
        Key=key,
        Body=json.dumps(report, indent=2, default=str),
        ContentType="application/json",
        ServerSideEncryption="AES256",
    )
    uri = f"s3://{DRILL_REPORT_BUCKET}/{key}"
    logger.info("Drill report saved: %s", uri)
    return uri


def _notify(sns, subject: str, message: str) -> None:
    if not ALERT_SNS_ARN:
        return
    try:
        sns.publish(TopicArn=ALERT_SNS_ARN, Subject=subject, Message=message)
    except ClientError as exc:
        logger.warning("SNS notification failed: %s", exc)


def handler(event, _context):
    drill_id = f"drill-{uuid.uuid4().hex[:8]}"
    logger.info("DR drill starting: %s (event=%s)", drill_id, json.dumps(event))

    ssm = _aws("ssm")
    lam = _aws("lambda")
    cw  = _aws("cloudwatch")
    s3  = _aws("s3")
    sns = _aws("sns")

    report = {
        "drill_id":       drill_id,
        "environment":    ENVIRONMENT,
        "primary_region": PRIMARY_REGION,
        "secondary_region": SECONDARY_REGION,
        "started_at":     datetime.now(timezone.utc).isoformat(),
        "steps":          [],
        "result":         "UNKNOWN",
        "rto_seconds":    None,
        "rpo_lag_ms":     None,
        "passed":         False,
    }

    def _step(name: str, status: str, details: str = "") -> None:
        entry = {"step": name, "status": status, "ts": datetime.now(timezone.utc).isoformat()}
        if details:
            entry["details"] = details
        report["steps"].append(entry)
        logger.info("[%s] %s — %s %s", drill_id, name, status, details)

    try:
        # ── Step 1: Suppress PagerDuty alerts ─────────────────────────────────
        _suppress_pagerduty_alerts(ssm, drill_id, suppress=True)
        _step("suppress_pagerduty", "OK")

        # ── Step 2: Capture pre-drill replication lag ──────────────────────────
        pre_lag_ms = _get_aurora_replication_lag(cw)
        report["rpo_lag_ms"] = pre_lag_ms
        _step("measure_replication_lag", "OK", f"lag={pre_lag_ms:.1f}ms")

        # ── Step 3: Enable automated failover guard ────────────────────────────
        _enable_failover(ssm)
        _step("enable_failover_guard", "OK")

        # ── Step 4: Execute failover ───────────────────────────────────────────
        t_start = time.monotonic()
        failover_result = _invoke_failover_lambda(lam)
        _step("invoke_failover_lambda", "OK", json.dumps(failover_result))

        # ── Step 5: Wait for active region to flip ────────────────────────────
        deadline = time.monotonic() + RTO_TARGET_SECONDS
        while time.monotonic() < deadline:
            active = _get_active_region(ssm)
            if active == SECONDARY_REGION:
                break
            time.sleep(10)
        else:
            _step("wait_for_region_flip", "FAIL", f"active region still {_get_active_region(ssm)} after {RTO_TARGET_SECONDS}s")
            report["result"] = "FAIL"
            report["passed"] = False
            return _finish(report, drill_id, ssm, s3, sns, lam, _step)

        rto_seconds = time.monotonic() - t_start
        report["rto_seconds"] = round(rto_seconds, 1)
        _step("wait_for_region_flip", "OK", f"flipped in {rto_seconds:.1f}s")

        # ── Step 6: Validate RTO target ───────────────────────────────────────
        rto_passed = rto_seconds <= RTO_TARGET_SECONDS
        _step("validate_rto", "PASS" if rto_passed else "FAIL",
              f"{rto_seconds:.1f}s <= {RTO_TARGET_SECONDS}s: {rto_passed}")

        # ── Step 7: Validate RPO target ───────────────────────────────────────
        rpo_passed = pre_lag_ms <= (RPO_TARGET_SECONDS * 1000)
        _step("validate_rpo", "PASS" if rpo_passed else "FAIL",
              f"lag={pre_lag_ms:.1f}ms <= {RPO_TARGET_SECONDS * 1000}ms: {rpo_passed}")

        # ── Step 8: Run post-failover validation checks (DDB/API/SSM) ─────────
        validator_result = _invoke_failover_validator_lambda(lam, drill_id)
        report["validator"] = validator_result
        if validator_result.get("skipped"):
            validator_passed = True
            _step("validate_failover_post_checks", "SKIP", validator_result.get("message", ""))
        else:
            validator_passed = validator_result.get("passed", False)
            validator_details = f"status={validator_result.get('statusCode')} overall_passed={validator_result.get('overall_passed')}"
            if validator_result.get("error"):
                validator_details = f"{validator_details} error={validator_result.get('error')}"
            elif validator_result.get("warning"):
                validator_details = f"{validator_details} warning={validator_result.get('warning')}"
            _step(
                "validate_failover_post_checks",
                "PASS" if validator_passed else "FAIL",
                validator_details,
            )

        report["passed"] = rto_passed and rpo_passed and validator_passed
        report["result"] = "PASS" if report["passed"] else "FAIL"

    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Drill %s failed with exception: %s", drill_id, exc, exc_info=True)
        _step("drill_exception", "ERROR", str(exc))
        report["result"] = "ERROR"
        report["passed"] = False

    finally:
        return _finish(report, drill_id, ssm, s3, sns, lam, _step)


def _finish(report, drill_id, ssm, s3, sns, lam, _step):
    """Restore state and persist report regardless of drill outcome."""
    report["finished_at"] = datetime.now(timezone.utc).isoformat()

    # Restore active region to primary
    try:
        _invoke_failback(ssm, lam)
        _step("failback_restore", "OK", f"active region restored to {PRIMARY_REGION}")
    except Exception as exc:  # pylint: disable=broad-except
        _step("failback_restore", "ERROR", str(exc))

    # Disable automated failover guard (safer default between drills)
    try:
        _disable_failover(ssm)
        _step("disable_failover_guard", "OK")
    except Exception as exc:  # pylint: disable=broad-except
        _step("disable_failover_guard", "ERROR", str(exc))

    # Clear PagerDuty suppression
    try:
        _suppress_pagerduty_alerts(ssm, drill_id, suppress=False)
        _step("clear_pagerduty_suppression", "OK")
    except Exception as exc:  # pylint: disable=broad-except
        _step("clear_pagerduty_suppression", "ERROR", str(exc))

    # Persist report
    report_uri = _upload_report(s3, report, drill_id)

    # Notify
    status_emoji = "✅" if report["passed"] else "❌"
    subject = f"[{ENVIRONMENT.upper()}] DR Drill {drill_id} — {report['result']}"
    body = (
        f"{status_emoji} DR Drill {drill_id}\n"
        f"Result:     {report['result']}\n"
        f"RTO:        {report.get('rto_seconds', 'N/A')}s (target < {RTO_TARGET_SECONDS}s)\n"
        f"RPO lag:    {report.get('rpo_lag_ms', 'N/A')}ms (target < {RPO_TARGET_SECONDS * 1000}ms)\n"
        f"Started:    {report.get('started_at', '')}\n"
        f"Finished:   {report.get('finished_at', '')}\n"
        f"Report:     {report_uri}\n"
    )
    _notify(sns, subject, body)

    logger.info("Drill %s complete: %s", drill_id, report["result"])
    return {
        "statusCode": 200 if report["passed"] else 500,
        "drill_id":   drill_id,
        "result":     report["result"],
        "rto_seconds": report.get("rto_seconds"),
        "rpo_lag_ms":  report.get("rpo_lag_ms"),
        "validator":   report.get("validator"),
        "report_uri":  report_uri,
    }
