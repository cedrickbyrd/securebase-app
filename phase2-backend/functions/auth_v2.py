"""
Authentication Lambda for SecureBase — DynamoDB-native.

Routes:
  OPTIONS *                        -> CORS preflight
  GET  /auth/accept-invite?token=  -> validate invite token (for email link landing)
  POST /auth/accept-invite         -> validate invite token, set password, mint JWT
  POST /auth/validate-session      -> verify existing JWT
  POST /auth/login | /auth         -> email + password login

Tables (env vars):
  TOKENS_TABLE   securebase-tokens   PK: token (S)
  USERS_TABLE    securebase-users    PK: email (S)

Env vars:
  JWT_SECRET               Secrets Manager secret name (or raw secret)
  TOKENS_TABLE             DynamoDB table for invite/session tokens
  USERS_TABLE              DynamoDB table for user records
  CORS_ORIGIN              Allowed origin
  LOG_LEVEL                DEBUG|INFO|WARNING|ERROR
  ACTIVATION_SNS_TOPIC_ARN SNS topic ARN for first-activation/first-login events
                           (optional; omit to disable activation alerts)
"""

import os
import json
import uuid
import hashlib
import logging
import boto3
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError

import jwt
import bcrypt

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# AWS clients — module-level; reused across warm Lambda invocations
ddb = boto3.resource('dynamodb')
secrets_client = boto3.client('secretsmanager')
_sns_client    = boto3.client('sns')

# Table handles — module-level; reused across warm Lambda invocations
_tokens_table = ddb.Table(os.environ.get('TOKENS_TABLE', 'securebase-tokens'))
_users_table  = ddb.Table(os.environ.get('USERS_TABLE',  'securebase-users'))

# ── In-memory JWT secret cache ────────────────────────────────────────────────
# Avoids a Secrets Manager round-trip on every decode/mint under concurrent load.
# TTL is kept short (5 min) so rotation takes effect within a single Lambda run.
_JWT_SECRET_CACHE: dict = {}
_JWT_SECRET_TTL_SECONDS = int(os.environ.get('JWT_SECRET_CACHE_TTL', '300'))

_ACTIVATION_TOPIC_ARN = os.environ.get('ACTIVATION_SNS_TOPIC_ARN', '')

_CORS_ORIGIN = os.environ.get('CORS_ORIGIN', 'https://portal.securebase.tximhotep.com')

_CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': _CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
}

_ACCEPT_INVITE_PATHS    = {'/auth/accept-invite', '/accept-invite'}
_VALIDATE_SESSION_PATHS = {'/auth/validate-session', '/auth/verify'}
_LOGIN_PATHS            = {'/auth', '/auth/login', '/login'}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resp(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': _CORS_HEADERS,
        'body': json.dumps(body),
    }


def _normalize_email(email: str) -> str:
    return (email or '').strip().lower()


def _get_jwt_secret() -> str:
    """Return the JWT secret, serving from an in-memory cache when possible.

    The cache avoids a Secrets Manager call on every Lambda invocation, which
    is the dominant latency contributor under concurrent RBAC verification load.
    The TTL (_JWT_SECRET_TTL_SECONDS) ensures that key rotation propagates within
    a predictable window without restarting the function.
    """
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
    except ClientError:
        value = secret_name

    _JWT_SECRET_CACHE['secret'] = value
    _JWT_SECRET_CACHE['expires_at'] = now + _JWT_SECRET_TTL_SECONDS
    return value


def _mint_jwt(email: str, user: dict) -> str:
    email = _normalize_email(email)
    secret = _get_jwt_secret()
    now = datetime.now(timezone.utc)
    payload = {
        'sub':        email,
        'email':      email,
        'plan':       user.get('plan', 'standard'),
        'tier':       user.get('pilot_tier', user.get('plan', 'standard')),
        'status':     user.get('status', 'active'),
        'pilot_ends': user.get('pilot_ends', ''),
        'iat':        int(now.timestamp()),
        'exp':        int((now + timedelta(hours=24)).timestamp()),
        'jti':        str(uuid.uuid4()),
    }
    return jwt.encode(payload, secret, algorithm='HS256')


def _decode_jwt(token: str) -> dict:
    secret = _get_jwt_secret()
    return jwt.decode(token, secret, algorithms=['HS256'])


def _get_token_record(token: str) -> dict | None:
    resp = _tokens_table.get_item(Key={'token': token})
    return resp.get('Item')


def _get_user_record(email: str) -> dict | None:
    email = _normalize_email(email)
    resp = _users_table.get_item(Key={'email': email})
    return resp.get('Item')


def _has_active_invite(email: str) -> bool:
    """Best-effort check for an active invite token for this email.

    Uses ProjectionExpression + Limit so the scan reads only the minimum data
    required. A future improvement is to add a GSI on (email, status) to
    convert this to a key-based query and eliminate the scan entirely.
    """
    email = _normalize_email(email)
    try:
        resp = _tokens_table.scan(
            FilterExpression='email = :e AND #s = :s',
            ExpressionAttributeValues={':e': email, ':s': 'active'},
            ExpressionAttributeNames={'#s': 'status'},
            ProjectionExpression='#s',
            Limit=1,
        )
        return bool(resp.get('Items'))
    except Exception as e:
        logger.warning(f"Could not check pending invite for {email}: {e}")
        return False


def _normalize_token_email(token: str, email: str) -> str:
    normalized_email = _normalize_email(email)
    if not normalized_email or normalized_email == email:
        return normalized_email

    try:
        _tokens_table.update_item(
            Key={'token': token},
            UpdateExpression='SET email = :e',
            ExpressionAttributeValues={':e': normalized_email},
        )
    except Exception as e:
        logger.warning(f"Could not normalize token email for {normalized_email}: {e}")

    return normalized_email


def _mark_token_used(token: str) -> None:
    """Mark an invite token as used using an optimistic conditional write.

    The ConditionExpression ensures that only one concurrent accept-invite
    request can succeed for the same token. If two requests race, the second
    will receive a ConditionalCheckFailedException, which is silently ignored
    because the token was already consumed by the winner.
    """
    try:
        _tokens_table.update_item(
            Key={'token': token},
            UpdateExpression='SET #s = :used',
            ConditionExpression='#s = :active',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':used': 'used', ':active': 'active'},
        )
    except ClientError as e:
        if e.response['Error']['Code'] != 'ConditionalCheckFailedException':
            logger.warning(f"Could not mark token used: {e}")
    except Exception as e:
        logger.warning(f"Could not mark token used: {e}")


def _mask_email(email: str) -> str:
    email = _normalize_email(email)
    if not email:
        return ''

    local, sep, domain = email.partition('@')
    visible = local[:2]
    if sep and domain:
        return f'{visible}***@{domain}'
    return f'{visible}***'


def _store_password(email: str, password: str, user: dict) -> None:
    """Hash password with bcrypt and store/update user record."""
    email = _normalize_email(email)
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    _users_table.put_item(Item={
        **user,
        'email':        email,
        'password_hash': pw_hash,
        'activated_at': datetime.now(timezone.utc).isoformat(),
    })


def _publish_activation_event(email: str, event_type: str, metadata: dict) -> None:
    """Publish a customer activation event to SNS for admin tracking (best-effort).

    The raw email is never included in the SNS payload; a SHA-256 prefix is used
    as a privacy-safe correlation ID that operators can verify locally.
    """
    if not _ACTIVATION_TOPIC_ARN:
        return
    try:
        email = _normalize_email(email)
        # Use a truncated SHA-256 hash as a correlation ID — never raw email (PII)
        correlation_id = hashlib.sha256(email.encode()).hexdigest()[:16]
        message = json.dumps({
            'event_type':     event_type,
            'correlation_id': correlation_id,
            'timestamp':      datetime.now(timezone.utc).isoformat(),
            **metadata,
        })
        _sns_client.publish(
            TopicArn=_ACTIVATION_TOPIC_ARN,
            Subject=f"[SecureBase] Customer {event_type.replace('_', ' ').title()} [{correlation_id}]",
            Message=message,
            MessageAttributes={
                'event_type': {
                    'DataType': 'String',
                    'StringValue': event_type,
                },
            },
        )
        logger.info(f"Activation event published: {event_type} [corr={correlation_id}]")
    except Exception as e:
        logger.warning(f"Could not publish activation event [{event_type}]: {e}")


def _record_first_login(email: str, user: dict) -> None:
    """Record first-login timestamp and publish activation event (best-effort).

    Uses a DynamoDB conditional write so concurrent requests cannot double-fire.
    """
    email = _normalize_email(email)
    try:
        _users_table.update_item(
            Key={'email': email},
            UpdateExpression='SET first_login_at = :t',
            ExpressionAttributeValues={':t': datetime.now(timezone.utc).isoformat()},
            ConditionExpression='attribute_not_exists(first_login_at)',
        )
        _publish_activation_event(email, 'first_login', {
            'plan': user.get('plan', 'standard'),
            'tier': user.get('pilot_tier', user.get('plan', 'standard')),
        })
    except ClientError as e:
        if e.response['Error']['Code'] != 'ConditionalCheckFailedException':
            logger.warning(f"Could not record first login for {email}: {e}")
    except Exception as e:
        logger.warning(f"Could not record first login for {email}: {e}")


# ── Route handlers ────────────────────────────────────────────────────────────

def validate_invite_token(event: dict, request_id: str) -> dict:
    """GET /auth/accept-invite?token=... or /accept-invite?token=..."""
    query = event.get('queryStringParameters') or {}
    token_val = (query.get('token') or '').strip()
    if not token_val:
        return _resp(400, {'error': 'token is required', 'request_id': request_id})

    token_record = _get_token_record(token_val)
    if not token_record:
        return _resp(401, {'error': 'Invalid or expired invite link', 'request_id': request_id})

    if token_record.get('status') != 'active':
        return _resp(401, {'error': 'Invite link has already been used', 'request_id': request_id})

    expires_at = token_record.get('expires_at', '')
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                return _resp(401, {'error': 'Invite link has expired', 'request_id': request_id})
        except ValueError:
            pass

    return _resp(200, {
        'valid': True,
        'email': _mask_email(token_record.get('email', '')),
        'plan': token_record.get('plan', 'standard'),
        'expires_at': expires_at,
    })


def accept_invite(event: dict, request_id: str) -> dict:
    """
    POST /auth/accept-invite
    Body: {"token": "<invite_token>", "password": "<chosen_password>"}

    1. Validate invite token in securebase-tokens
    2. Hash and store password in securebase-users
    3. Mint JWT
    4. Mark token used
    Returns: {"token": "<jwt>", "user": {"email": ..., "role": ...}}
    """
    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        body = {}

    token_val = (body.get('token') or '').strip()
    password  = body.get('password') or ''

    if not token_val:
        return _resp(400, {'error': 'token is required', 'request_id': request_id})
    if not password or len(password) < 8:
        return _resp(400, {'error': 'password must be at least 8 characters', 'request_id': request_id})

    token_record = _get_token_record(token_val)
    if not token_record:
        logger.warning(f"Invite token not found [{request_id}]")
        return _resp(401, {'error': 'Invalid or expired invite link', 'request_id': request_id})

    if token_record.get('status') != 'active':
        logger.warning(f"Invite token already used [{request_id}]")
        return _resp(401, {'error': 'Invite link has already been used', 'request_id': request_id})

    # Check expiry
    expires_at = token_record.get('expires_at', '')
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                return _resp(401, {'error': 'Invite link has expired', 'request_id': request_id})
        except ValueError:
            pass

    email = _normalize_token_email(token_val, token_record.get('email', ''))
    if not email:
        logger.error(f"Token record missing email [{request_id}]")
        return _resp(500, {'error': 'Invalid token record', 'request_id': request_id})

    # Get or build user record
    user = _get_user_record(email) or {
        'email':      email,
        'plan':       token_record.get('plan', 'standard'),
        'pilot_tier': token_record.get('pilot_tier', ''),
        'pilot_ends': token_record.get('pilot_ends', ''),
        'status':     'pro',
        'created_at': datetime.now(timezone.utc).date().isoformat(),
    }

    # Store hashed password
    try:
        _store_password(email, password, user)
    except Exception as e:
        logger.error(f"Failed to store password for {email}: {e}")
        return _resp(500, {'error': 'Account activation failed', 'request_id': request_id})

    session_token = _mint_jwt(email, user)
    _mark_token_used(token_val)

    logger.info(f"Invite accepted + password set: {email} plan={user.get('plan')} [{request_id}]")

    # Publish best-effort activation event for admin tracking/compliance audit
    _publish_activation_event(email, 'invite_accepted', {
        'plan': user.get('plan', 'standard'),
        'tier': user.get('pilot_tier', user.get('plan', 'standard')),
    })

    # Return 'token' and 'user' — matches what AcceptInvite.jsx expects
    return _resp(200, {
        'token': session_token,
        'user': {
            'email': email,
            'role':  user.get('role', 'user'),
            'plan':  user.get('plan', 'standard'),
            'tier':  user.get('pilot_tier', user.get('plan', 'standard')),
        },
        'expires_in': 86400,
    })


def login(event: dict, request_id: str) -> dict:
    """
    POST /auth/login
    Body: {"email": "...", "password": "..."}
    """
    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        body = {}

    email    = _normalize_email(body.get('email') or '')
    password = body.get('password') or ''

    if not email or not password:
        return _resp(400, {'error': 'email and password are required', 'request_id': request_id})

    user = _get_user_record(email)
    if not user:
        logger.warning(f"Login attempt for unknown email: {email} [{request_id}]")
        if _has_active_invite(email):
            return _resp(403, {
                'error': 'invite_pending',
                'message': 'Please activate your account using your invite link before logging in.',
                'redirect': '/accept-invite',
                'request_id': request_id,
            })
        return _resp(401, {'error': 'Invalid email or password', 'request_id': request_id})

    pw_hash = user.get('password_hash', '')
    if not pw_hash:
        return _resp(401, {'error': 'Account not yet activated — check your invite email', 'request_id': request_id})

    if not bcrypt.checkpw(password.encode(), pw_hash.encode()):
        logger.warning(f"Bad password for {email} [{request_id}]")
        return _resp(401, {'error': 'Invalid email or password', 'request_id': request_id})

    session_token = _mint_jwt(email, user)
    logger.info(f"Login success: {email} [{request_id}]")

    # Track first login for audit/compliance (best-effort, conditional write)
    if not user.get('first_login_at'):
        _record_first_login(email, user)

    return _resp(200, {
        'token': session_token,
        'user': {
            'email': email,
            'role':  user.get('role', 'user'),
            'plan':  user.get('plan', 'standard'),
            'tier':  user.get('pilot_tier', user.get('plan', 'standard')),
        },
        'expires_in': 86400,
    })


def validate_session(event: dict, request_id: str) -> dict:
    """POST /auth/validate-session or Bearer <jwt>"""
    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        body = {}

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
    except jwt.InvalidTokenError:
        return _resp(401, {'error': 'Invalid session token', 'request_id': request_id})


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

    if method == 'GET' and path in _ACCEPT_INVITE_PATHS:
        return validate_invite_token(event, request_id)

    if method == 'POST' and path in _VALIDATE_SESSION_PATHS:
        return validate_session(event, request_id)

    if method == 'POST' and path in _LOGIN_PATHS:
        return login(event, request_id)

    # Bearer token validation fallback
    auth_header = event.get('headers', {}).get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return validate_session(event, request_id)

    return _resp(404, {'error': f'No route for {method} {path}', 'request_id': request_id})
