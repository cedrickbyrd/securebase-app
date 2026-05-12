"""Compliance report generator Lambda (PDF + CSV with presigned URLs)."""

from __future__ import annotations

import csv
import io
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict

import boto3

s3_client = boto3.client("s3")


REQUIRED_FIELDS = {"tenant_id", "framework", "date_range"}


def _validate_payload(payload: Dict[str, Any]) -> str | None:
    missing = [field for field in REQUIRED_FIELDS if field not in payload]
    if missing:
        return f"Missing required fields: {', '.join(sorted(missing))}"
    return None


def _csv_bytes(payload: Dict[str, Any]) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["tenant_id", "framework", "date_range", "generated_at"])
    writer.writerow(
        [
            payload["tenant_id"],
            payload["framework"],
            json.dumps(payload["date_range"]),
            datetime.now(timezone.utc).isoformat(),
        ]
    )
    return output.getvalue().encode("utf-8")


def _pdf_bytes(payload: Dict[str, Any]) -> bytes:
    # Lightweight placeholder payload for Lambda environments without PDF libs.
    text = (
        "SecureBase Compliance Report\n"
        f"Tenant: {payload['tenant_id']}\n"
        f"Framework: {payload['framework']}\n"
        f"Date Range: {json.dumps(payload['date_range'])}\n"
        f"Generated: {datetime.now(timezone.utc).isoformat()}\n"
    )
    return text.encode("utf-8")


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    body = event.get("body") or event
    if isinstance(body, str):
        body = json.loads(body)

    error = _validate_payload(body)
    if error:
        return {"statusCode": 400, "body": json.dumps({"error": error})}

    bucket = os.environ.get("COMPLIANCE_REPORTS_BUCKET", "")
    if not bucket:
        return {"statusCode": 500, "body": json.dumps({"error": "COMPLIANCE_REPORTS_BUCKET is not configured"})}

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    tenant_id = body["tenant_id"]
    framework = str(body["framework"]).lower()

    pdf_key = f"reports/{tenant_id}/{framework}/{timestamp}.pdf"
    csv_key = f"reports/{tenant_id}/{framework}/{timestamp}.csv"

    s3_client.put_object(Bucket=bucket, Key=pdf_key, Body=_pdf_bytes(body), ContentType="application/pdf")
    s3_client.put_object(Bucket=bucket, Key=csv_key, Body=_csv_bytes(body), ContentType="text/csv")

    expires_in = 24 * 60 * 60
    pdf_url = s3_client.generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": pdf_key}, ExpiresIn=expires_in)
    csv_url = s3_client.generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": csv_key}, ExpiresIn=expires_in)

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "tenant_id": tenant_id,
                "framework": body["framework"],
                "download_urls": {"pdf": pdf_url, "csv": csv_url},
                "expires_in_seconds": expires_in,
            }
        ),
    }
