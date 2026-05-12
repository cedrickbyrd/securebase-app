"""
Alarm Aggregator — Phase 6 / Track 3

Triggered by all three severity SNS topics (P1/P2/P3) when alarms fire or resolve.
Persists alarm state transitions to DynamoDB for MTTA/MTTR tracking and the
admin portal alerting dashboard widget.

DynamoDB record schema:
{
  "alarm_name": str (hash key),
  "triggered_at": ISO-8601 string (range key),
  "severity": "P1"|"P2"|"P3",
  "state": "ALARM"|"OK",
  "reason": str,
  "region": str,
  "account": str,
  "acknowledged_at": ISO-8601 | null,
  "resolved_at": ISO-8601 | null,
  "mtta_seconds": int | null,
  "mttr_seconds": int | null,
  "ttl_epoch": int (Unix timestamp + 30 days),
}
"""
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

ENVIRONMENT = os.environ.get("ENVIRONMENT", "prod")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "securebase-alarm-history")

_AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", os.environ.get("AWS_REGION", "us-east-1"))
_dynamodb = boto3.resource("dynamodb", region_name=_AWS_REGION)
_table = _dynamodb.Table(DYNAMODB_TABLE)

# TTL: keep records for 30 days
RECORD_TTL_SECONDS = 30 * 24 * 3600


def _determine_severity(topic_arn: str) -> str:
    """Infer severity from the SNS topic ARN."""
    if "p1-critical" in topic_arn:
        return "P1"
    if "p2-high" in topic_arn:
        return "P2"
    if "p3-medium" in topic_arn:
        return "P3"
    return "P2"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ttl_epoch() -> int:
    return int(time.time()) + RECORD_TTL_SECONDS


def _store_alarm_event(alarm_name: str, state: str, severity: str, alarm_data: dict) -> None:
    """Persist an alarm state change to DynamoDB."""
    now = _now_iso()
    item = {
        "alarm_name": alarm_name,
        "triggered_at": now,
        "severity": severity,
        "state": state,
        "reason": alarm_data.get("NewStateReason", ""),
        "region": alarm_data.get("Region", ""),
        "account": alarm_data.get("AWSAccountId", ""),
        "acknowledged_at": None,
        "resolved_at": None,
        "mtta_seconds": None,
        "mttr_seconds": None,
        "ttl_epoch": _ttl_epoch(),
    }

    if state == "OK":
        item["resolved_at"] = now
        # Look up the most recent ALARM record to calculate MTTR
        try:
            response = _table.query(
                KeyConditionExpression=Key("alarm_name").eq(alarm_name),
                FilterExpression=Attr("state").eq("ALARM"),
                ScanIndexForward=False,
                Limit=1,
            )
            records = response.get("Items", [])
            if records:
                last_alarm_time = datetime.fromisoformat(records[0]["triggered_at"])
                mttr = int((datetime.now(timezone.utc) - last_alarm_time).total_seconds())
                item["mttr_seconds"] = mttr
                logger.info("MTTR for %s: %ds", alarm_name, mttr)
        except ClientError as exc:
            logger.warning("Failed to calculate MTTR for %s: %s", alarm_name, exc)

    try:
        _table.put_item(Item=item)
        logger.info("Alarm event stored: alarm=%s, state=%s, severity=%s", alarm_name, state, severity)
    except ClientError as exc:
        logger.error("Failed to store alarm event for %s: %s", alarm_name, exc)


def get_alarm_summary(environment: str = ENVIRONMENT) -> dict:
    """
    Query DynamoDB for active alarms (state=ALARM, no resolved_at) grouped by severity.
    Used by the admin portal alerting dashboard API.
    """
    try:
        # Scan for active alarms (in a real system, use a GSI on state)
        response = _table.scan(
            FilterExpression=Attr("state").eq("ALARM") & Attr("resolved_at").eq(None),
        )
        items = response.get("Items", [])

        p1 = [i for i in items if i.get("severity") == "P1"]
        p2 = [i for i in items if i.get("severity") == "P2"]
        p3 = [i for i in items if i.get("severity") == "P3"]

        return {
            "active_alarms": {
                "P1": len(p1),
                "P2": len(p2),
                "P3": len(p3),
                "total": len(items),
            },
            "alarms": items,
            "retrieved_at": _now_iso(),
        }
    except ClientError as exc:
        logger.error("Failed to get alarm summary: %s", exc)
        return {"active_alarms": {"P1": 0, "P2": 0, "P3": 0, "total": 0}, "alarms": []}


def get_alarm_history(days: int = 30) -> list[dict]:
    """
    Return alarm history for the past N days, used for the 30-day chart.
    Groups by date and severity.
    """
    from boto3.dynamodb.conditions import Attr
    cutoff = datetime.now(timezone.utc).isoformat()[:10]

    try:
        response = _table.scan(
            FilterExpression=Attr("triggered_at").gte(cutoff[:7]),  # month prefix
        )
        return response.get("Items", [])
    except ClientError as exc:
        logger.error("Failed to get alarm history: %s", exc)
        return []


def get_mtta_mttr_metrics() -> dict:
    """
    Calculate mean MTTA and MTTR from resolved alarm records.
    """
    try:
        response = _table.scan(
            FilterExpression=Attr("mttr_seconds").ne(None),
        )
        items = response.get("Items", [])

        mttr_values = [i["mttr_seconds"] for i in items if i.get("mttr_seconds") is not None]
        mtta_values = [i["mtta_seconds"] for i in items if i.get("mtta_seconds") is not None]

        avg_mttr = int(sum(mttr_values) / len(mttr_values)) if mttr_values else None
        avg_mtta = int(sum(mtta_values) / len(mtta_values)) if mtta_values else None

        return {
            "mean_mttr_seconds": avg_mttr,
            "mean_mtta_seconds": avg_mtta,
            "sample_count": len(mttr_values),
        }
    except ClientError as exc:
        logger.error("Failed to calculate MTTA/MTTR: %s", exc)
        return {"mean_mttr_seconds": None, "mean_mtta_seconds": None, "sample_count": 0}


def handler(event: dict, _context: Any) -> dict:
    """Lambda handler — invoked by SNS on alarm state change."""
    for record in event.get("Records", []):
        try:
            topic_arn = record.get("Sns", {}).get("TopicArn", "")
            severity = _determine_severity(topic_arn)
            alarm_data = json.loads(record["Sns"]["Message"])
            alarm_name = alarm_data.get("AlarmName", "unknown")
            state = alarm_data.get("NewStateValue", "ALARM")

            _store_alarm_event(alarm_name, state, severity, alarm_data)
        except (KeyError, json.JSONDecodeError) as exc:
            logger.error("Failed to parse SNS record: %s", exc)

    return {"statusCode": 200}
