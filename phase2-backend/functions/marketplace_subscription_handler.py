"""Handle AWS Marketplace SNS subscription lifecycle events."""

import json
import os
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import boto3

if os.environ.get("DB_HOST") and not os.environ.get("RDS_HOST"):
    os.environ["RDS_HOST"] = os.environ["DB_HOST"]
if os.environ.get("DB_NAME") and not os.environ.get("RDS_DATABASE"):
    os.environ["RDS_DATABASE"] = os.environ["DB_NAME"]

from db_utils import get_connection, release_connection

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

sns_client = boto3.client("sns")
entitlement_client = boto3.client("marketplace-entitlement")

MARKETPLACE_PRODUCT_CODE = os.environ.get("MARKETPLACE_PRODUCT_CODE", "")
CEO_SNS_TOPIC_ARN = os.environ.get("CEO_SNS_TOPIC_ARN", "")
BYPASS_SNS_SIGNATURE_VERIFY = os.environ.get("BYPASS_SNS_SIGNATURE_VERIFY", "false").lower() == "true"


EVENT_STATUS_UPDATES = {
    "subscribe-success": ("active", "active"),
    "subscribe-fail": ("failed", None),
    "unsubscribe-pending": ("unsubscribe-pending", None),
    "unsubscribe-success": ("inactive", "cancelled"),
}


ALERT_EVENTS = {"subscribe-success", "subscribe-fail", "unsubscribe-pending", "unsubscribe-success"}


def _verify_sns_signature(record: dict) -> bool:
    if BYPASS_SNS_SIGNATURE_VERIFY:
        return True

    sns_payload = record.get("Sns", {})
    signature = sns_payload.get("Signature")
    signature_version = sns_payload.get("SignatureVersion")
    signing_cert_url = sns_payload.get("SigningCertUrl") or sns_payload.get("SigningCertURL")

    if not signature or signature_version != "1" or not signing_cert_url:
        return False

    parsed = urlparse(signing_cert_url)
    if parsed.scheme != "https":
        return False
    host = (parsed.hostname or "").lower()
    return bool(re.fullmatch(r"sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?", host))


def _extract_event_payload(record: dict) -> tuple[str, dict, str]:
    sns_payload = record.get("Sns", {})
    message_id = sns_payload.get("MessageId", "")

    raw_message = sns_payload.get("Message", "{}")
    if isinstance(raw_message, str):
        try:
            payload = json.loads(raw_message)
        except json.JSONDecodeError:
            payload = {}
    else:
        payload = raw_message or {}

    event_type = (
        payload.get("eventType")
        or payload.get("event_type")
        or payload.get("action")
        or payload.get("notificationType")
        or "unknown"
    )

    return event_type, payload, message_id


def _lookup_customer(marketplace_customer_id: str):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM customers WHERE marketplace_customer_id = %s",
                (marketplace_customer_id,),
            )
            row = cur.fetchone()
            return str(row[0]) if row else None
    finally:
        release_connection(conn)


def _upsert_audit_event(customer_id: str, event_type: str, message_id: str, metadata: dict) -> bool:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO audit_events (
                    customer_id,
                    event_type,
                    action,
                    actor_email,
                    status,
                    request_id,
                    metadata
                ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    customer_id,
                    "marketplace_subscription_event",
                    event_type,
                    "marketplace-system@securebase.local",
                    "success",
                    message_id,
                    json.dumps(metadata),
                ),
            )
        conn.commit()
        return True
    except Exception as exc:
        conn.rollback()
        if "duplicate key" in str(exc).lower():
            logger.info("Duplicate SNS event skipped: %s", message_id)
            return False
        raise
    finally:
        release_connection(conn)


def _update_customer_status(customer_id: str, entitlement_status: str | None, subscription_status: str | None):
    if entitlement_status is None and subscription_status is None:
        return

    if entitlement_status is not None and subscription_status is not None:
        query = """
            UPDATE customers
            SET marketplace_entitlement_status = %s,
                subscription_status = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """
        params = (entitlement_status, subscription_status, customer_id)
    elif entitlement_status is not None:
        query = """
            UPDATE customers
            SET marketplace_entitlement_status = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """
        params = (entitlement_status, customer_id)
    else:
        query = """
            UPDATE customers
            SET subscription_status = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """
        params = (subscription_status, customer_id)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


def _refresh_entitlements(marketplace_customer_id: str):
    if not MARKETPLACE_PRODUCT_CODE:
        return None

    response = entitlement_client.get_entitlements(
        ProductCode=MARKETPLACE_PRODUCT_CODE,
        Filter={"CUSTOMER_IDENTIFIER": [marketplace_customer_id]},
    )
    entitlements = response.get("Entitlements", [])
    return "active" if entitlements else "inactive"


def _publish_ceo_alert(event_type: str, marketplace_customer_id: str):
    if not CEO_SNS_TOPIC_ARN:
        return

    sns_client.publish(
        TopicArn=CEO_SNS_TOPIC_ARN,
        Subject=f"[SecureBase Marketplace] {event_type}",
        Message=json.dumps(
            {
                "event_type": event_type,
                "marketplace_customer_id": marketplace_customer_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ),
    )


def lambda_handler(event, _context):
    records = event.get("Records", [])
    processed = 0
    skipped = 0

    for record in records:
        if not _verify_sns_signature(record):
            logger.warning("Skipping SNS record with invalid signature envelope")
            skipped += 1
            continue

        event_type, payload, message_id = _extract_event_payload(record)
        marketplace_customer_id = (
            payload.get("customerIdentifier")
            or payload.get("CustomerIdentifier")
            or payload.get("marketplaceCustomerId")
        )

        if not marketplace_customer_id:
            logger.warning("SNS message missing marketplace customer identifier: %s", payload)
            skipped += 1
            continue

        customer_id = _lookup_customer(marketplace_customer_id)
        if not customer_id:
            logger.warning("No customer found for marketplace id %s", marketplace_customer_id)
            skipped += 1
            continue

        inserted = _upsert_audit_event(customer_id, event_type, message_id, payload)
        if not inserted:
            skipped += 1
            continue

        if event_type == "entitlement-updated":
            entitlement_status = _refresh_entitlements(marketplace_customer_id)
            _update_customer_status(customer_id, entitlement_status, None)
        else:
            entitlement_status, subscription_status = EVENT_STATUS_UPDATES.get(event_type, (None, None))
            _update_customer_status(customer_id, entitlement_status, subscription_status)

        if event_type in ALERT_EVENTS:
            _publish_ceo_alert(event_type, marketplace_customer_id)

        processed += 1

    return {
        "statusCode": 200,
        "body": json.dumps({"processed": processed, "skipped": skipped}),
    }
