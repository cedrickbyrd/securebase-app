"""Handle AWS Marketplace SNS subscription lifecycle events."""

import base64
import json
import os
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urlparse
from urllib.request import urlopen

import boto3
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

if os.environ.get("DB_HOST") and not os.environ.get("RDS_HOST"):
    os.environ["RDS_HOST"] = os.environ["DB_HOST"]
if os.environ.get("DB_NAME") and not os.environ.get("RDS_DATABASE"):
    os.environ["RDS_DATABASE"] = os.environ["DB_NAME"]

from db_utils import get_connection, release_connection

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

sns_client = boto3.client("sns")
entitlement_client = boto3.client("marketplace-entitlement")

# Hardcoded for AWS audit compliance — GetEntitlements must be called with the
# exact product code registered in AMMP and in us-east-1 (the only supported region).
_AUDIT_PRODUCT_CODE = "blblyu28f6s5mzwl089d4xoea"
_audit_entitlement_client = boto3.client("marketplace-entitlement", region_name="us-east-1")

MARKETPLACE_PRODUCT_CODE = os.environ.get("MARKETPLACE_PRODUCT_CODE", "")
CEO_SNS_TOPIC_ARN = os.environ.get("CEO_SNS_TOPIC_ARN", "")
BYPASS_SNS_SIGNATURE_VERIFY = os.environ.get("BYPASS_SNS_SIGNATURE_VERIFY", "false").lower() == "true"


EVENT_STATUS_UPDATES = {
    "subscribe-success": ("active", "active"),
    "subscribe-fail": ("failed", None),
    "unsubscribe-pending": ("unsubscribe-pending", "unsubscribe-pending"),
    "unsubscribe-success": ("inactive", "cancelled"),
}


ALERT_EVENTS = {"subscribe-success", "subscribe-fail", "unsubscribe-pending", "unsubscribe-success"}
SNS_CERT_HOST_RE = re.compile(r"^sns\.[a-z0-9-]+\.amazonaws\.com$")
SNS_CERT_CACHE: dict[str, x509.Certificate] = {}

# Maps AWS Marketplace dimension names (as set in AMMP) to internal SecureBase tiers.
# Must stay in sync with the pricing dimensions defined in the AMMP listing.
# Stripe pricing alignment:
#   standard_monthly    $2,000/mo  -> standard   -> cis
#   fintech_monthly     $8,000/mo  -> fintech     -> ffiec
#   healthcare_monthly $15,000/mo  -> healthcare  -> hipaa
#   government_monthly $25,000/mo  -> gov-federal -> fedramp
DIMENSION_TO_TIER = {
    "standard_monthly": "standard",
    "fintech_monthly": "fintech",
    "healthcare_monthly": "healthcare",
    "government_monthly": "gov-federal",
}


def _build_sns_signing_string(sns_payload: dict) -> str:
    fields = [
        ("Message", sns_payload.get("Message")),
        ("MessageId", sns_payload.get("MessageId")),
    ]
    if sns_payload.get("Subject"):
        fields.append(("Subject", sns_payload.get("Subject")))
    if sns_payload.get("SubscribeURL"):
        fields.append(("SubscribeURL", sns_payload.get("SubscribeURL")))
    fields.extend(
        [
            ("Timestamp", sns_payload.get("Timestamp")),
            ("TopicArn", sns_payload.get("TopicArn")),
            ("Type", sns_payload.get("Type")),
        ]
    )
    return "".join(f"{name}\n{value}\n" for name, value in fields if value is not None)


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
    if not SNS_CERT_HOST_RE.match(host):
        return False

    sns_payload = record.get("Sns", {})
    canonical_string = _build_sns_signing_string(sns_payload)
    if not canonical_string:
        return False

    try:
        cert = SNS_CERT_CACHE.get(signing_cert_url)
        if cert is None:
            with urlopen(signing_cert_url, timeout=5) as response:
                cert_pem = response.read()
            cert = x509.load_pem_x509_certificate(cert_pem)
            SNS_CERT_CACHE[signing_cert_url] = cert

        decoded_signature = base64.b64decode(signature)
        cert.public_key().verify(
            decoded_signature,
            canonical_string.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA1(),
        )
        return True
    except Exception:
        return False


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


def _update_customer_status(
    customer_id: str,
    entitlement_status: str | None,
    subscription_status: str | None,
    tier: str | None = None,
):
    updates = []
    params = []
    if entitlement_status is not None:
        updates.append("marketplace_entitlement_status = %s")
        params.append(entitlement_status)
    if subscription_status is not None:
        updates.append("subscription_status = %s")
        params.append(subscription_status)
    if tier is not None:
        updates.append("tier = %s")
        params.append(tier)

    if not updates:
        return

    params.append(customer_id)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE customers SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                tuple(params),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


def _refresh_entitlements(marketplace_customer_id: str):
    if not MARKETPLACE_PRODUCT_CODE:
        return None, None

    response = entitlement_client.get_entitlements(
        ProductCode=MARKETPLACE_PRODUCT_CODE,
        Filter={"CUSTOMER_IDENTIFIER": [marketplace_customer_id]},
    )
    entitlements = response.get("Entitlements", [])
    if not entitlements:
        return "inactive", None

    entitlement = entitlements[0] or {}
    value_obj = entitlement.get("Value") or {}
    value_dimension = next(
        (value for key, value in value_obj.items() if key.endswith("Value") and isinstance(value, str)),
        None,
    )
    dimension = entitlement.get("Dimension") or value_dimension
    return "active", DIMENSION_TO_TIER.get(dimension)


def _audit_get_entitlements(marketplace_customer_id: str) -> None:
    """Call GetEntitlements so AWS Marketplace audit logs a successful invocation.

    Must use the AMMP-registered product code and us-east-1. Failures are logged
    but never re-raised so the subscription flow is not interrupted.
    """
    try:
        response = _audit_entitlement_client.get_entitlements(
            ProductCode=_AUDIT_PRODUCT_CODE,
            Filter={"CUSTOMER_IDENTIFIER": [marketplace_customer_id]},
        )
        entitlements = response.get("Entitlements", [])
        logger.info(
            "GetEntitlements audit call succeeded: product_code=%s customer=%s entitlement_count=%d entitlements=%s",
            _AUDIT_PRODUCT_CODE,
            marketplace_customer_id,
            len(entitlements),
            json.dumps(entitlements, default=str),
        )
    except Exception as exc:
        logger.error(
            "GetEntitlements audit call failed: product_code=%s customer=%s error=%s",
            _AUDIT_PRODUCT_CODE,
            marketplace_customer_id,
            exc,
        )


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

        if event_type == "subscribe-success":
            _audit_get_entitlements(marketplace_customer_id)
            entitlement_status, subscription_status = EVENT_STATUS_UPDATES.get(event_type, (None, None))
            _update_customer_status(customer_id, entitlement_status, subscription_status)
        elif event_type == "entitlement-updated":
            entitlement_status, new_tier = _refresh_entitlements(marketplace_customer_id)
            _update_customer_status(customer_id, entitlement_status, None, tier=new_tier)
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
