"""
submit_lead.py — AWS Lambda function for lead capture.

Receives POST /leads from API Gateway (AWS_PROXY integration) and:
  1. Validates the required ``email`` field.
  2. Sanitises all string inputs.
  3. Forwards the enriched payload to LEAD_NOTIFICATION_WEBHOOK_URL
     (Zapier / Make / n8n / custom) if configured, with a 3-second timeout.
  4. Returns 200 { "success": true }.

Environment variables (set in Lambda configuration / Terraform):
  LEAD_NOTIFICATION_WEBHOOK_URL  — Generic outbound webhook (optional)
  ALLOWED_ORIGIN                 — CORS origin (default: demo domain)
  ENVIRONMENT                    — dev | staging | prod

HIPAA NOTE: Raw email is only forwarded to the configured webhook and is
never written to CloudWatch Logs (stdout). Only non-PII metadata (score,
grade, campaign, trigger, timestamp) appears in log output.

SECURITY:
  - Only POST and OPTIONS requests are accepted.
  - Input is allowlisted — unknown fields are stripped before forwarding.
  - Email format is validated with a strict regex on the server side.
  - CORS is locked to ALLOWED_ORIGIN.
"""

import json
import logging
import os
import re
from urllib.request import Request, urlopen
from urllib.error import URLError
import socket

logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

ALLOWED_ORIGIN = os.environ.get(
    "ALLOWED_ORIGIN", "https://demo.securebase.tximhotep.com"
)
ENVIRONMENT = os.environ.get("ENVIRONMENT", "production")

# Strict email regex (no RFC 5322 edge cases needed for a lead-capture form)
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

# Fields allowed through to the webhook — everything else is stripped
ALLOWED_FIELDS = {
    "email", "company", "role", "trigger", "campaign", "source",
    "medium", "content", "score", "grade", "priority",
    "pageUrl", "submittedAt",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def cors_headers():
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    }


def json_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", **cors_headers()},
        "body": json.dumps(body),
    }


def sanitise(value, max_len=200):
    """Trim and cap a string value. Non-strings become empty string."""
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_len]


def forward_to_webhook(payload, webhook_url):
    """
    POST ``payload`` to ``webhook_url`` with a 3-second connect/read timeout.
    Errors are logged but never propagate to the caller (fire-and-forget).
    """
    try:
        data = json.dumps(payload).encode("utf-8")
        req = Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        # socket.setdefaulttimeout affects urlopen when timeout= is omitted;
        # we pass it explicitly here for clarity.
        with urlopen(req, timeout=3) as resp:  # noqa: S310
            if resp.status not in (200, 201, 202, 204):
                logger.warning("Webhook returned status %s", resp.status)
    except (URLError, socket.timeout) as exc:
        logger.error("Webhook request failed: %s", exc)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Unexpected webhook error: %s", exc)


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------


def lambda_handler(event, _context):
    http_method = event.get("httpMethod", "")

    # ── CORS preflight ────────────────────────────────────────────────────
    if http_method == "OPTIONS":
        return {"statusCode": 204, "headers": cors_headers(), "body": ""}

    # ── Method guard ──────────────────────────────────────────────────────
    if http_method != "POST":
        return json_response(405, {"error": "Method not allowed"})

    # ── Parse body ────────────────────────────────────────────────────────
    try:
        raw = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return json_response(400, {"error": "Invalid JSON"})

    # ── Validate required fields ──────────────────────────────────────────
    email = sanitise(raw.get("email", ""), max_len=254)
    if not email or not EMAIL_RE.match(email):
        return json_response(400, {"error": "A valid email address is required"})

    # ── Build allowlisted payload ─────────────────────────────────────────
    payload = {}
    for field in ALLOWED_FIELDS:
        value = raw.get(field)
        if value is not None:
            payload[field] = sanitise(value) if isinstance(value, str) else value
    payload["email"] = email  # Use validated/sanitised email
    payload["source_system"] = "securebase-demo"
    payload["environment"] = ENVIRONMENT

    # ── Non-PII metadata for CloudWatch Logs ─────────────────────────────
    # HIPAA: log only non-identifiable fields.
    logger.info(
        "Lead received: score=%s grade=%s campaign=%s trigger=%s",
        payload.get("score"),
        payload.get("grade"),
        payload.get("campaign"),
        payload.get("trigger"),
    )

    # ── Webhook notification (fire-and-forget, 3 s timeout) ───────────────
    webhook_url = os.environ.get("LEAD_NOTIFICATION_WEBHOOK_URL")
    if webhook_url:
        forward_to_webhook(payload, webhook_url)

    return json_response(200, {"success": True})
