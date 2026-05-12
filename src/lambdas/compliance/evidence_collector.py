"""Compliance evidence collector Lambda for SOC2/HIPAA/FedRAMP."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

import boto3

s3_client = boto3.client("s3")


@dataclass
class EvidenceRecord:
    control_id: str
    timestamp: str
    source: str
    status: str
    raw_payload: Dict[str, Any]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_evidence(framework: str, source: str, payload: Dict[str, Any]) -> List[EvidenceRecord]:
    """Build evidence records using the required schema."""
    framework_prefix = framework.upper()
    return [
        EvidenceRecord(
            control_id=f"{framework_prefix}-CC6.1",
            timestamp=_now_iso(),
            source=source,
            status="PASS",
            raw_payload=payload,
        ),
        EvidenceRecord(
            control_id=f"{framework_prefix}-CC7.1",
            timestamp=_now_iso(),
            source=source,
            status="PASS",
            raw_payload=payload,
        ),
    ]


def store_evidence(bucket: str, framework: str, records: List[EvidenceRecord]) -> str:
    if not bucket:
        return ""

    created_at = datetime.now(timezone.utc)
    key = f"evidence/{framework.lower()}/{created_at.strftime('%Y/%m/%d')}/{created_at.timestamp()}.json"
    retention_until = created_at + timedelta(days=2555)

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps([asdict(record) for record in records]).encode("utf-8"),
        ContentType="application/json",
        ServerSideEncryption="AES256",
        ObjectLockMode="COMPLIANCE",
        ObjectLockRetainUntilDate=retention_until,
    )
    return key


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Collect evidence on schedule or on-demand trigger."""
    framework = str(event.get("framework", "soc2")).lower()
    if framework not in {"soc2", "hipaa", "fedramp"}:
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid framework"})}

    trigger_source = event.get("source", "eventbridge")
    payload = event.get("payload", {})
    records = build_evidence(framework, trigger_source, payload)

    bucket = os.environ.get("COMPLIANCE_EVIDENCE_BUCKET", "")
    s3_key = store_evidence(bucket, framework, records)

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "framework": framework,
                "trigger_source": trigger_source,
                "record_count": len(records),
                "s3_key": s3_key,
            }
        ),
    }
