"""
Stripe webhook handler Lambda for SecureBase.
Validates Stripe signatures and routes events to GA4 tracking.
Secrets stored in SSM Parameter Store (consistent with signup_handler.py).
"""
import json
import logging
import hmac
import hashlib
import time
import base64

import boto3
from botocore.exceptions import ClientError
from urllib.request import urlopen, Request

import ga4_client

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

_ssm = boto3.client("ssm")
_stripe_secret_cache = None
_webhook_secret_cache = None


def _get_ssm(name: str) -> str:
    return _ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


def _get_stripe_secret() -> str:
    global _stripe_secret_cache
    if not _stripe_secret_cache:
        _stripe_secret_cache = _get_ssm("/securebase/stripe/secret_key")
    return _stripe_secret_cache


def _get_webhook_secret() -> str:
    global _webhook_secret_cache
    if not _webhook_secret_cache:
        _webhook_secret_cache = _get_ssm("/securebase/stripe/webhook_secret")
    return _webhook_secret_cache


def _verify_stripe_signature(payload: str, sig_header: str, secret: str) -> bool:
    """
    Validate Stripe webhook signature (matches stripe.webhooks.constructEvent logic).
    https://stripe.com/docs/webhooks/signatures
    """
    try:
        # Build pairs list — keep all v1= entries (supports secret rotation)
        pairs = [p.split("=", 1) for p in sig_header.split(",") if "=" in p]
        timestamp_values = [v for k, v in pairs if k == "t"]
        signatures = [v for k, v in pairs if k == "v1"]

        if not timestamp_values or not signatures:
            logger.warning("Stripe signature header missing required fields")
            return False

        timestamp = int(timestamp_values[0])

        # Reject events older than 5 minutes
        if abs(time.time() - timestamp) > 300:
            logger.warning("Stripe webhook timestamp too old: %s", timestamp)
            return False

        signed_payload = f"{timestamp}.{payload}"
        expected = hmac.new(
            secret.encode("utf-8"),
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return any(hmac.compare_digest(expected, sig) for sig in signatures)
    except Exception as e:
        logger.error("Signature verification error: %s", e)
        return False


def _cors(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def _call_stripe(path: str, stripe_secret: str) -> dict:
    """Minimal Stripe API GET using urllib (no stripe-python package required)."""
    credentials = base64.b64encode(f"{stripe_secret}:".encode()).decode()
    req = Request(
        f"https://api.stripe.com/v1/{path}",
        headers={"Authorization": f"Basic {credentials}"},
    )
    with urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return _cors(200, {})

    if event.get("httpMethod") != "POST":
        return _cors(405, {"error": "Method Not Allowed"})

    body = event.get("body") or ""
    sig_header = (event.get("headers") or {}).get("stripe-signature", "")

    try:
        webhook_secret = _get_webhook_secret()
        stripe_secret = _get_stripe_secret()
    except ClientError as e:
        logger.error("SSM fetch failed: %s", e)
        return _cors(500, {"error": "Configuration error"})

    if not _verify_stripe_signature(body, sig_header, webhook_secret):
        logger.warning("Invalid Stripe signature")
        return _cors(400, {"error": "Invalid signature"})

    try:
        stripe_event = json.loads(body)
    except json.JSONDecodeError:
        return _cors(400, {"error": "Invalid JSON"})

    event_type = stripe_event.get("type", "")
    data = stripe_event.get("data", {}).get("object", {})
    prev = stripe_event.get("data", {}).get("previous_attributes", {})

    logger.info("Processing Stripe event: %s", event_type)

    try:
        if event_type == "checkout.session.completed":
            session_id = data.get("id", "unknown")
            payment_status = data.get("payment_status", "unknown")
            customer_email = data.get("customer_email") or data.get("customer_details", {}).get("email", "unknown")
            logger.info(
                "WEBHOOK_RECEIVED checkout.session.completed session_id=%s payment_status=%s customer=%s",
                session_id, payment_status, customer_email,
            )
            if data.get("subscription"):
                subscription = _call_stripe(f"subscriptions/{data['subscription']}", stripe_secret)
                customer = _call_stripe(f"customers/{data['customer']}", stripe_secret)
                sub_items = (subscription.get("items", {}).get("data") or [{}])
                sub_price = sub_items[0].get("price", {})
                plan_name = sub_price.get("nickname") or "unknown"
                amount = sub_price.get("unit_amount", 0) / 100
                currency = subscription.get("currency", "usd").upper()
                logger.info(
                    "CHECKOUT_CONFIRMED subscription_id=%s plan=%s amount=%.2f %s customer_id=%s",
                    data["subscription"], plan_name, amount, currency, data.get("customer"),
                )
                ga4_client.track_subscription_purchase(subscription, customer, data)

        elif event_type == "customer.subscription.created":
            ga4_client.track_subscription_created(data)

        elif event_type == "customer.subscription.updated":
            if prev.get("items"):
                old_price = prev["items"]["data"][0]["price"]
                new_price = data["items"]["data"][0]["price"]
                if old_price["id"] != new_price["id"]:
                    ga4_client.track_subscription_updated(data, old_price, new_price)
            if prev.get("status") == "trialing" and data.get("status") == "active":
                ga4_client.track_trial_converted(data)

        elif event_type == "customer.subscription.deleted":
            metadata = data.get("metadata") or {}
            ga4_client.track_subscription_cancelled(data, {
                "reason": metadata.get("cancellation_reason", "not_specified"),
                "feedback": metadata.get("cancellation_feedback"),
            })

        elif event_type == "invoice.payment_succeeded":
            subscription = None
            if data.get("subscription"):
                subscription = _call_stripe(f"subscriptions/{data['subscription']}", stripe_secret)
            ga4_client.track_invoice_paid(data, subscription)

        elif event_type == "invoice.payment_failed":
            subscription = None
            if data.get("subscription"):
                subscription = _call_stripe(f"subscriptions/{data['subscription']}", stripe_secret)
            ga4_client.track_invoice_payment_failed(data, subscription)

        elif event_type == "charge.refunded":
            refunds = (data.get("refunds") or {}).get("data") or []
            if refunds:
                ga4_client.track_refund(refunds[0], data)

        else:
            logger.info("Unhandled event type: %s", event_type)

    except Exception as e:
        logger.error("Error handling %s: %s", event_type, e, exc_info=True)
        return _cors(500, {"error": "Handler error"})

    return _cors(200, {"received": True})
