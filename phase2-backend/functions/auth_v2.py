"""
Authentication Lambda for SecureBase — DynamoDB-native.

Routes:
  OPTIONS *                        -> CORS preflight
  POST /auth/accept-invite         -> validate invite token, mint JWT
  POST /auth/validate-session      -> verify existing JWT
  POST /auth/login | /auth         -> email login (magic-link placeholder)

Tables (env vars):
  TOKENS_TABLE   securebase-tokens   PK: token (S)
  USERS_TABLE    securebase-users    PK: email (S)

Env vars:
  JWT_SECRET       Secrets Manager secret name (or raw secret)
  TOKENS_TABLE     DynamoDB table for invite/session tokens
  USERS_TABLE      DynamoDB table for user records
  CORS_ORIGIN      Allowed origin (default: https://portal.securebase.tximhotep.com)
  LOG_LEVEL        DEBUG|INFO|WARNING|ERROR
"""

import os
import json
import uuid
import logging
import boto3
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError

import jwt

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# AWS clients
ddb = boto3.resource('dynamodb')
secrets_client = boto3.client('secretsmanager')

# Table handles
_tokens_table = ddb.Table(os.environ.get('TOKENS_TABLE', 'securebase-tokens'))
_users_table  = ddb.Table(os.environ.get('USERS_TABLE',  'securebase-users'))

_CORS_ORIGIN = os.environ.get('CORS_ORIGIN', 'https://portal.securebase.tximhotep.com')

_CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': _CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
}

_ACCEPT_INVITE_PATHS  = {'/auth/accept-invite', '/accept-invite'}
_VALIDATE_SESSION_PATHS = {'/auth/validate-session', '/auth/verify'}
_LOGIN_PATHS          = {'/auth', '/auth/login', '/login'}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resp(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': _CORS_HEADERS,
        'body': json.dumps(body),
    }


def _get_jwt_secret() -> str:
    """Return JWT secret — try Secrets Manager first, fall back to env value."""
    secret_name = os.environ.get('JWT_SECRET', 'securebase-jwt-production')
    try:
        resp = secrets_client.get_secret_value(SecretId=secret_name)
        raw = resp.get('SecretString', '')
        try:
            parsed = json.loads(raw)
            return parsed.get('jwt_secret') or parsed.get(secret_name) or raw
        except (json.JSONDecodeError, AttributeError):
            return raw
    except ClientError:
        # If the env var IS the secret (not a SM name), use it directly
        return secret_name


def _mint_jwt(email: str, user: dict) -> str:
    secret = _get_jwt_secret()
    now = datetime.now(timezone.utc)
    payload = {
        'sub':   email,
        'email': email,
        'plan':  user.get('plan', 'standard'),
        'tier':  user.get('pilot_tier', user.get('plan', 'standard')),
        'status': user.get('status', 'active'),
        'pilot_ends': user.get('pilot_ends', ''),
        'iat':   int(now.timestamp()),
        'exp':   int((now + timedelta(hours=24)).timestamp()),
        'jti':   str(uuid.uuid4()),
    }
    return jwt.encode(payload, secret, algorithm='HS256')


def _decode_jwt(token: str) -> dict:
    secret = _get_jwt_secret()
    return jwt.decode(token, secret, algorithms=['HS256'])


def _get_token_record(token: str) -> dict | None:
    resp = _tokens_table.get_item(Key={'token': token})
    return resp.get('Item')


def _get_user_record(email: str) -> dict | None:
    resp = _users_table.get_item(Key={'email': email})
    return resp.get('Item')


def _mark_token_used(token: str) -> None:
    try:
        _tokens_table.update_item(
            Key={'token': token},
            UpdateExpression='SET #s = :used',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':used': 'used'},
        )
    except Exception as e:
        logger.warning(f"Could not mark token used: {e}")


# ── Route handlers ────────────────────────────────────────────────────────────

def accept_invite(event: dict, request_id: str) -> dict:
    """
    POST /auth/accept-invite
    Body: {"token": "<invite_token>"}

    1. Look up token in securebase-tokens
    2. Validate status=active and not expired
    3. Look up user in securebase-users by email
    4. Mint JWT
    5. Mark token used
    """
    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        body = {}

    token_val = (body.get('token') or '').strip()
    if not token_val:
        return _resp(400, {'error': 'token is required', 'request_id': request_id})

    token_record = _get_token_record(token_val)
    if not token_record:
        logger.warning(f"Invite token not found [{request_id}]")
        return _resp(401, {'error': 'Invalid or expired invite link', 'request_id': request_id})

    if token_record.get('status') != 'active':
        logger.warning(f"Invite token already used/expired [{request_id}]")
        return _resp(401, {'error': 'Invite link has already been used', 'request_id': request_id})

    # Check expiry if present
    expires_at = token_record.get('expires_at', '')
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                return _resp(401, {'error': 'Invite link has expired', 'request_id': request_id})
        except ValueError:
            pass  # malformed date — allow through

    email = token_record.get('email', '')
    if not email:
        logger.error(f"Token record missing email [{request_id}]")
        return _resp(500, {'error': 'Invalid token record', 'request_id': request_id})

    user = _get_user_record(email)
    if not user:
        # Auto-create minimal user record from token data
        user = {
            'email':      email,
            'plan':       token_record.get('plan', 'standard'),
            'pilot_tier': token_record.get('pilot_tier', ''),
            'status':     'pro',
        }
        try:
            _users_table.put_item(Item={**user, 'created_at': datetime.now(timezone.utc).date().isoformat()})
            logger.info(f"Auto-created user record for {email}")
        except Exception as e:
            logger.warning(f"Could not auto-create user: {e}")

    session_token = _mint_jwt(email, user)
    _mark_token_used(token_val)

    logger.info(f"Invite accepted: {email} plan={user.get('plan')} [{request_id}]")

    return _resp(200, {
        'session_token': session_token,
        'email':         email,
        'plan':          user.get('plan', 'standard'),
        'tier':          user.get('pilot_tier', user.get('plan', 'standard')),
        'pilot_ends':    user.get('pilot_ends', ''),
        'expires_in':    86400,
    })


def validate_session(event: dict, request_id: str) -> dict:
    """
    POST /auth/validate-session  OR  Bearer <jwt> on any route
    Body: {"token": "<jwt>"} OR Authorization: Bearer <jwt>
    """
    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        body = {}

    # Accept token from body or Authorization header
    token_val = body.get('token', '')
    if not token_val:
        auth_header = event.get('headers', {}).get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token_val = auth_header[7:]

    if not token_val:
        return _resp(400, {'error': 'token is required', 'request_id': request_id})

    try:
        claims = _decode_jwt(token_val)
        return _resp(200, {
            'valid':      True,
            'email':      claims.get('sub'),
            'plan':       claims.get('plan'),
            'tier':       claims.get('tier'),
            'expires_at': claims.get('exp'),
        })
    except jwt.ExpiredSignatureError:
        return _resp(401, {'error': 'Session expired', 'request_id': request_id})
    except jwt.InvalidTokenError as e:
        return _resp(401, {'error': 'Invalid session token', 'request_id': request_id})


def login_placeholder(event: dict, request_id: str) -> dict:
    """
    POST /auth/login
    Magic-link / passwordless placeholder.
    Returns instructions — actual magic link flow TBD.
    """
    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        body = {}

    email = (body.get('email') or '').strip().lower()
    if not email:
        return _resp(400, {'error': 'email is required', 'request_id': request_id})

    # Check if user exists
    user = _get_user_record(email)
    if not user:
        # Return 200 to avoid email enumeration
        logger.info(f"Login attempt for unknown email: {email}")
        return _resp(200, {'message': 'If this email is registered, you will receive an invite link.'})

    logger.info(f"Login requested for {email} [{request_id}]")
    return _resp(200, {'message': 'Check your email for your access link.'})


# ── Lambda handler ────────────────────────────────────────────────────────────

def lambda_handler(event, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _CORS_HEADERS, 'body': ''}

    request_id = event.get('requestContext', {}).get('requestId', str(uuid.uuid4()))
    path   = event.get('path', '')
    method = event.get('httpMethod', 'POST')

    logger.info(f"{method} {path} [{request_id}]")

    if method == 'POST' and path in _ACCEPT_INVITE_PATHS:
        return accept_invite(event, request_id)

    if method == 'POST' and path in _VALIDATE_SESSION_PATHS:
        return validate_session(event, request_id)

    if method == 'POST' and path in _LOGIN_PATHS:
        return login_placeholder(event, request_id)

    # Bearer token validation fallback (API integrations)
    auth_header = event.get('headers', {}).get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return validate_session(event, request_id)

    return _resp(404, {'error': f'No route for {method} {path}', 'request_id': request_id})
