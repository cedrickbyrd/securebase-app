"""Scheduled AWS Marketplace metering worker."""

import json
import os
import logging
from datetime import datetime, timezone

import boto3
from botocore.config import Config

if os.environ.get("DB_HOST") and not os.environ.get("RDS_HOST"):
    os.environ["RDS_HOST"] = os.environ["DB_HOST"]
if os.environ.get("DB_NAME") and not os.environ.get("RDS_DATABASE"):
    os.environ["RDS_DATABASE"] = os.environ["DB_NAME"]

from db_utils import get_connection, release_connection

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

# Short timeout for marketplace/SNS API calls — no VPC endpoint available for
# SNS; must fail fast rather than hanging the full Lambda timeout.
_MARKETPLACE_API_CONFIG = Config(
    connect_timeout=5,
    read_timeout=5,
    retries={"max_attempts": 1},
)

metering_client = boto3.client("meteringmarketplace")
sns_client = boto3.client("sns", config=_MARKETPLACE_API_CONFIG)

MARKETPLACE_PRODUCT_CODE = os.environ.get("MARKETPLACE_PRODUCT_CODE", "")
ALERTS_SNS_TOPIC_ARN = os.environ.get("ALERTS_SNS_TOPIC_ARN", "")

# Maps internal tier names to AMMP pricing dimension API names.
# Must stay in sync with DIMENSION_TO_TIER in marketplace_subscription_handler.py
# and the dimensions registered in the AWS Marketplace Management Portal.
TIER_TO_DIMENSION = {
    "standard":    "standard_monthly",
    "healthcare":  "healthcare_monthly",
    "fintech":     "fintech_monthly",
    "gov-federal": "government_monthly",
}


def _get_metering_quantity(customer_id: str) -> int:
    # SaaS subscription dimensions are flat-rate monthly per subscriber.
    # Quantity is always 1 — one active subscription per customer_id.
    return 1


def _fetch_active_marketplace_customers():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, marketplace_customer_id, tier
                FROM customers
                WHERE payment_method = 'aws_marketplace'
                  AND marketplace_entitlement_status = 'active'
                  AND marketplace_customer_id IS NOT NULL
                """
            )
            return cur.fetchall() or []
    finally:
        release_connection(conn)


def _insert_metering_record(customer_id: str, marketplace_customer_id: str, dimension: str, quantity: int, status: str, aws_record_id: str | None = None, error_message: str | None = None):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO marketplace_metering_records (
                    customer_id,
                    marketplace_customer_id,
                    dimension,
                    quantity,
                    timestamp,
                    metering_status,
                    aws_metering_record_id,
                    error_message
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    customer_id,
                    marketplace_customer_id,
                    dimension,
                    quantity,
                    datetime.now(timezone.utc),
                    status,
                    aws_record_id,
                    error_message,
                ),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


def _publish_alert(subject: str, message: str):
    if not ALERTS_SNS_TOPIC_ARN:
        return
    try:
        sns_client.publish(TopicArn=ALERTS_SNS_TOPIC_ARN, Subject=subject, Message=message)
    except Exception:
        # Alerting must never crash the worker — a missing VPC endpoint/NAT path to
        # SNS would otherwise mask the real per-customer failure being reported.
        logger.exception("Failed to publish alert: %s", subject)


def _meter_customer(customer_id: str, marketplace_customer_id: str, tier: str):
    dimension = TIER_TO_DIMENSION.get(tier, "standard_monthly")
    quantity = _get_metering_quantity(customer_id)

    payload = {
        "CustomerIdentifier": marketplace_customer_id,
        "Dimension": dimension,
        "Quantity": quantity,
        "Timestamp": datetime.now(timezone.utc),
    }

    result = metering_client.batch_meter_usage(
        ProductCode=MARKETPLACE_PRODUCT_CODE,
        UsageRecords=[payload],
    )

    usage_results = result.get("Results", [])
    if usage_results:
        record = usage_results[0]
        status = (record.get("Status") or "").lower()
        record_id = record.get("MeteringRecordId")
        if status in {"success", "accepted"}:
            _insert_metering_record(customer_id, marketplace_customer_id, dimension, quantity, "success", record_id)
            return True

        error_message = record.get("UsageRecord", {}).get("Status") or record.get("Status") or "metering failed"
        _insert_metering_record(customer_id, marketplace_customer_id, dimension, quantity, "failed", record_id, error_message)
        _publish_alert("[SecureBase Marketplace] Metering failed", json.dumps({"customer_id": customer_id, "error": error_message}))
        return False

    _insert_metering_record(customer_id, marketplace_customer_id, dimension, quantity, "failed", None, "No metering response")
    _publish_alert("[SecureBase Marketplace] Metering failed", json.dumps({"customer_id": customer_id, "error": "No metering response"}))
    return False


def lambda_handler(_event, _context):
    if not MARKETPLACE_PRODUCT_CODE:
        return {"statusCode": 500, "body": json.dumps({"error": "MARKETPLACE_PRODUCT_CODE missing"})}

    customers = _fetch_active_marketplace_customers()
    processed = 0
    failures = 0

    for row in customers:
        customer_id = str(row[0])
        marketplace_customer_id = row[1]
        tier = row[2]

        try:
            ok = _meter_customer(customer_id, marketplace_customer_id, tier)
            processed += 1
            if not ok:
                failures += 1
        except Exception as exc:
            logger.exception("Metering failed for %s", customer_id)
            dimension = TIER_TO_DIMENSION.get(tier, "standard_monthly")
            quantity = _get_metering_quantity(customer_id)
            _insert_metering_record(customer_id, marketplace_customer_id, dimension, quantity, "failed", None, str(exc))
            _publish_alert("[SecureBase Marketplace] Metering exception", json.dumps({"customer_id": customer_id, "error": str(exc)}))
            failures += 1

    return {
        "statusCode": 200,
        "body": json.dumps({"processed": processed, "failures": failures}),
    }
