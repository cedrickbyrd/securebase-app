"""Resolve AWS Marketplace buyer token and provision SecureBase customer."""

import json
import os
import uuid
import logging
import base64
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs

import boto3
import jwt
from botocore.exceptions import ClientError

if os.environ.get("DB_HOST") and not os.environ.get("RDS_HOST"):
    os.environ["RDS_HOST"] = os.environ["DB_HOST"]
if os.environ.get("DB_NAME") and not os.environ.get("RDS_DATABASE"):
    os.environ["RDS_DATABASE"] = os.environ["DB_NAME"]

try:
    from db_utils import get_connection, release_connection
except ImportError:  # pragma: no cover
    from db_utils import get_connection, release_connection  # type: ignore

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

metering_client = boto3.client("meteringmarketplace")
lambda_client = boto3.client("lambda")
secrets_client = boto3.client("secretsmanager")

ONBOARDING_FUNCTION_NAME = os.environ.get("ONBOARDING_FUNCTION_NAME") or "securebase-trigger-onboarding"
MARKETPLACE_PRODUCT_CODE = os.environ.get("MARKETPLACE_PRODUCT_CODE", "")
VALID_TIERS = {"standard", "healthcare", "fintech", "gov-federal"}
TIER_FRAMEWORK_MAP = {
    "standard": "cis",
    "healthcare": "hipaa",
    "fintech": "ffiec",
    "gov-federal": "fedramp",
}

_JWT_SECRET_CACHE: dict = {}
_JWT_SECRET_TTL_SECONDS = 300


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def _parse_body(event: dict) -> dict:
    body = event.get("body") if isinstance(event, dict) else None
    if isinstance(body, str):
        if isinstance(event, dict) and event.get("isBase64Encoded"):
            try:
                body = base64.b64decode(body).decode("utf-8")
            except Exception:
                return {}
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            parsed = parse_qs(body, keep_blank_values=False)
            if parsed:
                return {key: values[0] for key, values in parsed.items() if values}
            return {}
    if isinstance(body, dict):
        return body
    return event if isinstance(event, dict) else {}


def _normalize_string(value) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


def _extract_marketplace_token(event: dict, request: dict) -> tuple[str, str | None]:
    candidates = []

    def _add(source: str, value):
        normalized = _normalize_string(value)
        if normalized:
            candidates.append((normalized, source))

    request = request if isinstance(request, dict) else {}
    event = event if isinstance(event, dict) else {}
    headers = event.get("headers")
    query = event.get("queryStringParameters")
    multi_value_headers = event.get("multiValueHeaders")
    multi_value_query = event.get("multiValueQueryStringParameters")

    request_keys = ("regToken", "regtoken", "token", "x-amzn-marketplace-token")
    for key in request_keys:
        _add(f"body:{key}", request.get(key))

    if isinstance(query, dict):
        for key in request_keys:
            _add(f"query:{key}", query.get(key))

    if isinstance(multi_value_query, dict):
        for key in request_keys:
            values = multi_value_query.get(key)
            if isinstance(values, list) and values:
                _add(f"multi_query:{key}", values[0])

    if isinstance(headers, dict):
        normalized_headers = {str(k).lower(): v for k, v in headers.items()}
        _add("header:x-amzn-marketplace-token", normalized_headers.get("x-amzn-marketplace-token"))
        _add("header:regtoken", normalized_headers.get("regtoken"))
        _add("header:token", normalized_headers.get("token"))

    if isinstance(multi_value_headers, dict):
        normalized_multi_headers = {str(k).lower(): v for k, v in multi_value_headers.items()}
        for header_key in ("x-amzn-marketplace-token", "regtoken", "token"):
            values = normalized_multi_headers.get(header_key)
            if isinstance(values, list) and values:
                _add(f"multi_header:{header_key}", values[0])

    return candidates[0] if candidates else ("", None)


def _get_jwt_secret() -> str:
    """Fetch JWT secret from Secrets Manager with 5-minute in-memory cache."""
    now = datetime.now(timezone.utc).timestamp()
    cached = _JWT_SECRET_CACHE.get('secret')
    if cached and now < _JWT_SECRET_CACHE.get('expires_at', 0):
        return cached

    secret_name = os.environ.get('JWT_SECRET', 'securebase-jwt-production')
    try:
        resp = secrets_client.get_secret_value(SecretId=secret_name)
        raw = resp.get('SecretString', '')
        try:
            parsed = json.loads(raw)
            value = parsed.get('jwt_secret') or parsed.get(secret_name) or raw
        except (json.JSONDecodeError, AttributeError):
            value = raw
    except Exception:
        value = secret_name

    _JWT_SECRET_CACHE['secret'] = value
    _JWT_SECRET_CACHE['expires_at'] = now + _JWT_SECRET_TTL_SECONDS
    return value


def _get_customer_by_marketplace_id(marketplace_customer_id: str):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, marketplace_customer_id, marketplace_product_code, tier
                FROM customers
                WHERE marketplace_customer_id = %s
                """,
                (marketplace_customer_id,),
            )
            row = cur.fetchone()
            return row
    finally:
        release_connection(conn)


def _mint_marketplace_jwt(customer_id: str, email: str, tier: str) -> str:
    """Mint a 24-hour JWT for a marketplace-provisioned customer."""
    secret = _get_jwt_secret()
    now = datetime.now(timezone.utc)
    payload = {
        'sub': email,
        'email': email,
        'plan': tier,
        'tier': tier,
        'status': 'active',
        'source': 'aws_marketplace',
        'iat': int(now.timestamp()),
        'exp': int((now + timedelta(hours=24)).timestamp()),
        'jti': str(uuid.uuid4()),
    }
    return jwt.encode(payload, secret, algorithm='HS256')


def _insert_marketplace_customer(
    marketplace_customer_id: str,
    product_code: str,
    tier: str = "standard",
    framework: str = "cis",
):
    customer_id = str(uuid.uuid4())
    synthetic_email = f"marketplace+{marketplace_customer_id.lower()}@securebase.local"
    synthetic_name = f"marketplace-{marketplace_customer_id.lower()}"

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO customers (
                    id,
                    name,
                    tier,
                    framework,
                    email,
                    billing_email,
                    payment_method,
                    subscription_status,
                    marketplace_customer_id,
                    marketplace_product_code,
                    marketplace_entitlement_status,
                    marketplace_subscription_start
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (marketplace_customer_id) DO NOTHING
                RETURNING id
                """,
                (
                    customer_id,
                    synthetic_name,
                    tier,
                    framework,
                    synthetic_email,
                    synthetic_email,
                    "aws_marketplace",
                    "active",
                    marketplace_customer_id,
                    product_code,
                    "active",
                    datetime.utcnow(),
                ),
            )
            created = cur.fetchone()
            if created is None:
                cur.execute(
                    "SELECT id FROM customers WHERE marketplace_customer_id = %s",
                    (marketplace_customer_id,),
                )
                existing = cur.fetchone()
                if existing is None:
                    raise RuntimeError("Failed to create or fetch marketplace customer")
                return str(existing[0])
        conn.commit()
        return str(created[0])
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


def _trigger_onboarding(customer_id: str, email: str, tier: str = "standard"):
    payload = {
        "customer_id": customer_id,
        "tier": tier,
        "email": email,
        "name": email,
        "source": "aws_marketplace",
    }
    lambda_client.invoke(
        FunctionName=ONBOARDING_FUNCTION_NAME,
        InvocationType="Event",
        Payload=json.dumps(payload),
    )


def lambda_handler(event, _context):
    if event.get("httpMethod") == "OPTIONS":
        return _response(200, {"ok": True})

    request = _parse_body(event)
    token, token_source = _extract_marketplace_token(event, request)
    if not token:
        logger.warning("Marketplace token missing from request")
        return _response(400, {"error": "invalid_token", "message": "Marketplace token is required."})
    logger.info("Marketplace token accepted from %s", token_source or "unknown")

    try:
        resolution = metering_client.resolve_customer(RegistrationToken=token)
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "Unknown")
        if error_code in {"InvalidTokenException", "ExpiredTokenException", "ValidationException"}:
            return _response(400, {"error": "invalid_token", "message": "Invalid or expired marketplace token."})
        logger.exception("ResolveCustomer API failed")
        return _response(500, {"error": "aws_api_error", "message": "Unable to resolve AWS Marketplace customer."})

    marketplace_customer_id = resolution.get("CustomerIdentifier")
    product_code = resolution.get("ProductCode")

    if not marketplace_customer_id:
        return _response(500, {"error": "aws_api_error", "message": "Marketplace response missing customer identifier."})

    if MARKETPLACE_PRODUCT_CODE and product_code and product_code != MARKETPLACE_PRODUCT_CODE:
        return _response(400, {"error": "invalid_product", "message": "Marketplace token product does not match this listing."})

    existing = _get_customer_by_marketplace_id(marketplace_customer_id)
    if existing:
        existing_customer_id = str(existing[0])
        existing_tier = existing[3] if len(existing) > 3 and existing[3] else "standard"
        synthetic_email = f"marketplace+{marketplace_customer_id.lower()}@securebase.local"

        try:
            token = _mint_marketplace_jwt(existing_customer_id, synthetic_email, existing_tier)
        except Exception:
            logger.exception("JWT minting failed for returning marketplace customer %s", existing_customer_id)
            token = None
        if not token:
            return _response(500, {"error": "jwt_error", "message": "Failed to issue session token. Please try again."})

        response_body = {
            "customer_id": existing_customer_id,
            "marketplace_customer_id": existing[1],
            "marketplace_product_code": existing[2],
            "redirect_url": "/dashboard",
            "idempotent": True,
            "user": {"email": synthetic_email, "role": "user"},
        }
        if token:
            response_body["token"] = token

        return _response(200, response_body)

    requested_plan = (
        request.get("plan")
        or ((event.get("queryStringParameters") or {}).get("plan") if isinstance(event, dict) else None)
        or "standard"
    ).strip().lower()
    tier = requested_plan if requested_plan in VALID_TIERS else "standard"
    framework = TIER_FRAMEWORK_MAP.get(tier, "cis")

    customer_id = _insert_marketplace_customer(
        marketplace_customer_id,
        product_code or MARKETPLACE_PRODUCT_CODE,
        tier,
        framework,
    )
    synthetic_email = f"marketplace+{marketplace_customer_id.lower()}@securebase.local"

    try:
        _trigger_onboarding(customer_id, synthetic_email, tier)
    except Exception:
        logger.exception("Marketplace onboarding trigger failed for %s", customer_id)

    try:
        token = _mint_marketplace_jwt(customer_id, synthetic_email, tier)
    except Exception:
        logger.exception("JWT minting failed for marketplace customer %s", customer_id)
        token = None
    if not token:
        return _response(500, {"error": "jwt_error", "message": "Failed to issue session token. Please try again."})

    response_body = {
        "customer_id": customer_id,
        "marketplace_customer_id": marketplace_customer_id,
        "marketplace_product_code": product_code,
        "redirect_url": "/dashboard",
        "user": {"email": synthetic_email, "role": "user"},
    }
    if token:
        response_body["token"] = token

    return _response(200, response_body)
