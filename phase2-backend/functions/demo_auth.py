"""
demo_auth — AWS Lambda function

Issues a short-lived, HttpOnly JWT cookie for demo-environment visitors.
The token identifies the session as a "prospect" with "demo" access so the
SRE Dashboard shows mock data rather than live production metrics.

Routes:
  POST /demo-auth                  → validate demo credentials, set HttpOnly cookie
  POST /demo-auth?action=logout    → clear the cookie
  OPTIONS /demo-auth               → CORS preflight

JWT payload:
  { user_id, role: "prospect", access: "demo", tenant_id }

Security notes:
  - Token is stored only in an HttpOnly, Secure, SameSite=Lax cookie.
  - The token value is NEVER returned in the response body.
  - JWT_SECRET must be set as a Lambda environment variable in production.
  - No PII is logged — only role, access level, and timestamp.

Environment variables:
  JWT_SECRET     — required; raises at cold start if missing
  DEMO_EMAIL     — default demo@securebase.tximhotep.com
  DEMO_PASSWORD  — default SecureBaseDemo2026!
  ALLOWED_ORIGIN — default https://demo.securebase.tximhotep.com
  TOKEN_TTL_SECS — default 3600
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

import jwt

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# ---------------------------------------------------------------------------
# Config — resolved once at cold start
# ---------------------------------------------------------------------------

ALLOWED_ORIGIN = os.environ.get('ALLOWED_ORIGIN', 'https://demo.securebase.tximhotep.com')
DEMO_EMAIL = os.environ.get('DEMO_EMAIL', 'demo@securebase.tximhotep.com')
DEMO_PASSWORD = os.environ.get('DEMO_PASSWORD', 'SecureBaseDemo2026!')
TOKEN_TTL_SECS = int(os.environ.get('TOKEN_TTL_SECS', '3600'))

# Fail fast if the JWT signing secret is missing.  Set JWT_SECRET as a
# Lambda environment variable backed by Secrets Manager in production.
_JWT_SECRET = os.environ.get('JWT_SECRET')
if not _JWT_SECRET:
    raise EnvironmentError(
        'JWT_SECRET environment variable is required. '
        'Set it as a Lambda environment variable backed by AWS Secrets Manager.'
    )

CORS_HEADERS = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
}


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

def lambda_handler(event, context):
    """
    Main Lambda entry point for demo authentication.

    Routes:
      OPTIONS *                        -> CORS preflight
      POST /demo-auth                  -> issue demo JWT cookie
      POST /demo-auth?action=logout    -> clear demo JWT cookie
      * (other methods)                -> 405 Method Not Allowed
    """
    method = event.get('httpMethod', '')

    # CORS preflight
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'}),
        }

    # -----------------------------------------------------------------------
    # Logout: clear the cookie
    # -----------------------------------------------------------------------
    query_params = event.get('queryStringParameters') or {}
    if query_params.get('action') == 'logout':
        logger.info(json.dumps({
            'event': 'jwt_logout',
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }))
        return {
            'statusCode': 200,
            'headers': {
                **CORS_HEADERS,
                'Content-Type': 'application/json',
                'Set-Cookie': 'demo_jwt=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
            },
            'body': json.dumps({'success': True}),
        }

    # -----------------------------------------------------------------------
    # Login: validate credentials and issue JWT cookie
    # -----------------------------------------------------------------------
    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, ValueError):
        return {
            'statusCode': 400,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Invalid request body'}),
        }

    email = body.get('email', '')
    password = body.get('password', '')

    if email != DEMO_EMAIL or password != DEMO_PASSWORD:
        # Audit log — no PII, no credentials
        logger.info(json.dumps({
            'event': 'jwt_auth_failed',
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }))
        return {
            'statusCode': 401,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Invalid credentials'}),
        }

    # Build minimal payload — no PII
    payload = {
        'user_id': 'demo-prospect',
        'role': 'prospect',
        'access': 'demo',
        'tenant_id': 'demo-tenant',
    }

    token = jwt.encode(
        {
            **payload,
            'iss': 'securebase-demo',
            'aud': 'securebase-portal',
            'exp': int(time.time()) + TOKEN_TTL_SECS,
        },
        _JWT_SECRET,
        algorithm='HS256',
    )

    # Audit log — token value is intentionally omitted
    logger.info(json.dumps({
        'event': 'jwt_issued',
        'role': payload['role'],
        'access': payload['access'],
        'tenant_id': payload['tenant_id'],
        'ttl_secs': TOKEN_TTL_SECS,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }))

    return {
        'statusCode': 200,
        'headers': {
            **CORS_HEADERS,
            'Content-Type': 'application/json',
            # HttpOnly prevents JavaScript from reading the cookie (XSS protection).
            # Secure ensures it is only sent over HTTPS.
            # SameSite=Lax allows first-party navigations from external links.
            'Set-Cookie': (
                f'demo_jwt={token}; HttpOnly; Secure; SameSite=Lax; '
                f'Path=/; Max-Age={TOKEN_TTL_SECS}'
            ),
        },
        # Never return the token in the body — only role metadata
        'body': json.dumps({
            'success': True,
            'role': payload['role'],
            'access': payload['access'],
        }),
    }
