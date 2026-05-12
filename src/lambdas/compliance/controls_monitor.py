"""Controls monitor Lambda for compliance drift detection."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

import boto3

sns_client = boto3.client("sns")
dynamodb = boto3.resource("dynamodb")


def detect_drift(current: Dict[str, str], baseline: Dict[str, str]) -> List[Dict[str, Any]]:
    drifts: List[Dict[str, Any]] = []
    for control_id, baseline_state in baseline.items():
        current_state = current.get(control_id, "unknown")
        if current_state != baseline_state:
            drifts.append(
                {
                    "control_id": control_id,
                    "expected": baseline_state,
                    "actual": current_state,
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                }
            )
    return drifts


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    current = event.get("current_state", {})
    baseline = event.get("baseline_state", {})
    drifts = detect_drift(current, baseline)

    status = "green" if not drifts else ("yellow" if len(drifts) < 3 else "red")

    table_name = os.environ.get("CONTROLS_HISTORY_TABLE")
    if table_name:
        table = dynamodb.Table(table_name)
        table.put_item(
            Item={
                "snapshot_id": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
                "detected_at": datetime.now(timezone.utc).isoformat(),
                "status": status,
                "drift_count": len(drifts),
                "drifts": drifts,
            }
        )

    topic_arn = os.environ.get("COMPLIANCE_ALERT_TOPIC_ARN")
    if topic_arn and drifts:
        sns_client.publish(
            TopicArn=topic_arn,
            Subject="SecureBase compliance drift detected",
            Message=json.dumps({"drifts": drifts, "status": status}),
        )

    return {
        "statusCode": 200,
        "body": json.dumps({"status": status, "drifts": drifts}),
    }
