"""Audit log integrity validator Lambda for CloudTrail evidence."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict


def validate_sha256(payload: bytes, expected_sha256: str) -> bool:
    digest = hashlib.sha256(payload).hexdigest()
    return digest == expected_sha256


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    body = event.get("body") or event
    if isinstance(body, str):
        body = json.loads(body)

    payload = str(body.get("payload", "")).encode("utf-8")
    expected_sha256 = str(body.get("expected_sha256", ""))
    if not expected_sha256:
        return {"statusCode": 400, "body": json.dumps({"error": "expected_sha256 is required"})}

    valid = validate_sha256(payload, expected_sha256)
    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "valid": valid,
                "validated_at": datetime.now(timezone.utc).isoformat(),
            }
        ),
    }
