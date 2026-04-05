"""
GA4 Measurement Protocol client for SecureBase.
Mirrors the pattern of existing Lambda handlers — secrets via SSM Parameter Store.
"""
import json
import logging
import time
from urllib.request import urlopen, Request
from urllib.error import URLError

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

GA_MEASUREMENT_ID = "G-EEVD92DCS1"
GA4_ENDPOINT = "https://www.google-analytics.com/mp/collect"

_ssm = boto3.client("ssm")
_api_secret_cache = None  # module-level cache — survives Lambda warm starts


def _get_api_secret() -> str | None:
    global _api_secret_cache
    if _api_secret_cache:
        return _api_secret_cache
    try:
        _api_secret_cache = _ssm.get_parameter(
            Name="/securebase/ga4/api_secret", WithDecryption=True
        )["Parameter"]["Value"]
        return _api_secret_cache
    except ClientError as e:
        logger.error("Failed to fetch GA4 API secret from SSM: %s", e)
        return None


def track_event(client_id: str, event_name: str, params: dict = None) -> bool:
    """Send a single event to the GA4 Measurement Protocol."""
    api_secret = _get_api_secret()
    if not api_secret:
        logger.warning("GA4_API_SECRET unavailable — skipping %s", event_name)
        return False

    url = f"{GA4_ENDPOINT}?measurement_id={GA_MEASUREMENT_ID}&api_secret={api_secret}"
    payload = json.dumps({
        "client_id": client_id,
        "events": [{
            "name": event_name,
            "params": {
                "engagement_time_msec": "100",
                "session_id": str(int(time.time() * 1000)),
                **(params or {})
            }
        }]
    }).encode("utf-8")

    try:
        req = Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(req, timeout=5) as resp:
            if resp.status not in (200, 204):
                logger.error("GA4 returned unexpected status %s for %s", resp.status, event_name)
                return False
        logger.info("GA4 tracked: %s for client %s", event_name, client_id)
        return True
    except URLError as e:
        logger.error("GA4 network error for %s: %s", event_name, e)
        return False


# ---------------------------------------------------------------------------
# High-level tracking helpers
# ---------------------------------------------------------------------------

def track_subscription_purchase(subscription: dict, customer: dict, session: dict = None) -> bool:
    item = subscription["items"]["data"][0]
    price = item["price"]
    amount = price["unit_amount"] / 100
    interval = (price.get("recurring") or {}).get("interval", "month")
    plan_name = price.get("nickname") or "Unknown Plan"

    return track_event(customer["id"], "purchase", {
        "transaction_id": subscription["id"],
        "value": amount,
        "currency": subscription["currency"].upper(),
        "items": [{
            "item_id": price["id"],
            "item_name": plan_name,
            "item_category": "subscription",
            "item_category2": interval,
            "price": amount,
            "quantity": 1,
        }],
        "plan_name": plan_name,
        "billing_period": interval,
        "payment_method": ((session or {}).get("payment_method_types") or ["unknown"])[0],
    })


def track_subscription_created(subscription: dict) -> bool:
    item = subscription["items"]["data"][0]
    price = item["price"]
    amount = price["unit_amount"] / 100
    interval = (price.get("recurring") or {}).get("interval", "month")
    trial_end = subscription.get("trial_end")

    return track_event(subscription["customer"], "subscription_created", {
        "subscription_id": subscription["id"],
        "plan_name": price.get("nickname") or "Unknown Plan",
        "billing_period": interval,
        "value": amount,
        "currency": subscription["currency"].upper(),
        "trial_end": str(trial_end) if trial_end else None,
    })


def track_subscription_updated(subscription: dict, old_price: dict, new_price: dict) -> bool:
    old_amount = old_price["unit_amount"] / 100
    new_amount = new_price["unit_amount"] / 100
    diff = new_amount - old_amount

    return track_event(subscription["customer"], "plan_change", {
        "subscription_id": subscription["id"],
        "from_plan": old_price.get("nickname", "Unknown"),
        "to_plan": new_price.get("nickname", "Unknown"),
        "change_type": "upgrade" if diff > 0 else "downgrade",
        "value": abs(diff),
        "currency": subscription["currency"].upper(),
    })


def track_subscription_cancelled(subscription: dict, cancellation_details: dict = None) -> bool:
    cancellation_details = cancellation_details or {}
    item = subscription["items"]["data"][0]
    price = item["price"]
    amount = price["unit_amount"] / 100
    days_active = int((time.time() - subscription["created"]) / 86400)

    return track_event(subscription["customer"], "subscription_cancel", {
        "subscription_id": subscription["id"],
        "plan_name": price.get("nickname") or "Unknown Plan",
        "days_active": days_active,
        "cancellation_reason": cancellation_details.get("reason", "not_specified"),
        "feedback": cancellation_details.get("feedback"),
        "value": -amount,
        "currency": subscription["currency"].upper(),
        "cancel_at_period_end": subscription.get("cancel_at_period_end", False),
    })


def track_invoice_paid(invoice: dict, subscription: dict = None) -> bool:
    plan_name = "Unknown Plan"
    if subscription:
        plan_name = subscription["items"]["data"][0]["price"].get("nickname") or plan_name

    return track_event(invoice["customer"], "invoice_payment_succeeded", {
        "invoice_id": invoice["id"],
        "subscription_id": invoice.get("subscription"),
        "plan_name": plan_name,
        "value": invoice["amount_paid"] / 100,
        "currency": invoice["currency"].upper(),
        "billing_reason": invoice.get("billing_reason"),
        "invoice_number": invoice.get("number"),
    })


def track_invoice_payment_failed(invoice: dict, subscription: dict = None) -> bool:
    plan_name = "Unknown Plan"
    if subscription:
        plan_name = subscription["items"]["data"][0]["price"].get("nickname") or plan_name

    next_attempt = invoice.get("next_payment_attempt")
    return track_event(invoice["customer"], "invoice_payment_failed", {
        "invoice_id": invoice["id"],
        "subscription_id": invoice.get("subscription"),
        "plan_name": plan_name,
        "value": invoice["amount_due"] / 100,
        "currency": invoice["currency"].upper(),
        "attempt_count": invoice.get("attempt_count"),
        "next_payment_attempt": str(next_attempt) if next_attempt else None,
    })


def track_subscription_reactivated(subscription: dict, days_cancelled: int) -> bool:
    item = subscription["items"]["data"][0]
    price = item["price"]
    amount = price["unit_amount"] / 100

    return track_event(subscription["customer"], "subscription_reactivate", {
        "subscription_id": subscription["id"],
        "plan_name": price.get("nickname") or "Unknown Plan",
        "days_cancelled": days_cancelled,
        "value": amount,
        "currency": subscription["currency"].upper(),
    })


def track_trial_converted(subscription: dict) -> bool:
    item = subscription["items"]["data"][0]
    price = item["price"]
    amount = price["unit_amount"] / 100

    return track_event(subscription["customer"], "trial_converted", {
        "subscription_id": subscription["id"],
        "plan_name": price.get("nickname") or "Unknown Plan",
        "value": amount,
        "currency": subscription["currency"].upper(),
    })


def track_refund(refund: dict, charge: dict) -> bool:
    return track_event(charge["customer"], "refund", {
        "refund_id": refund["id"],
        "charge_id": charge["id"],
        "value": -(refund["amount"] / 100),
        "currency": refund["currency"].upper(),
        "reason": refund.get("reason"),
    })
