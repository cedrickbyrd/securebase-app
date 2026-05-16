"""
Authentication Lambda for SecureBase Phase 2.

Handles:
  - Email + password login (portal)
  - API key validation (Bearer token extraction)
  - Session token generation (JWT)
  - User MFA code verification
  - RLS context setting for database isolation
  - Cache integration with DynamoDB
  - Audit event logging

Environment variables:
  - RDS_HOST: RDS Proxy endpoint
  - RDS_DATABASE: securebase
  - RDS_USER: securebase_app
  - RDS_PASSWORD: (from Secrets Manager)
  - JWT_SECRET: (from Secrets Manager)
  - DDB_TABLE_CACHE: DynamoDB cache table name
  - LOG_LEVEL: DEBUG|INFO|WARNING|ERROR

Routes:
  OPTIONS *                       -> CORS preflight
  POST /auth | /auth/login        -> email + password portal login
  POST * with Bearer <api_key>    -> API key -> session token exchange
  POST * with Bearer <jwt>        -> session token validation

Response format (API Gateway Proxy Integration):
  {
    "statusCode": 200,
    "headers": { "Content-Type": "application/json", ... },
    "isBase64Encoded": false,
    "body": "{...}"   <- MUST be json.dumps string, not dict
  }
"""

import os
import sys
import json
import logging
import hashlib
import hmac
import time
import uuid
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta

import bcrypt
import jwt
import boto3
from botocore.exceptions import ClientError

# Import database utilities
sys.path.insert(0, '/opt/python')
from db_utils import (
    get_connection_pool, set_rls_context, query_one, execute_one,
    log_audit_event, get_api_key_by_prefix, update_api_key_usage,
    DatabaseError, get_customer_by_id
)

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize AWS clients
ddb = boto3.resource('dynamodb')
secrets_client = boto3.client('secretsmanager')

_CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://portal.securebase.tximhotep.com',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
}

_LOGIN_PATHS = {'/auth', '/auth/login', '/login'}


class AuthenticationError(Exception):
    """Custom exception for auth failures."""
    pass


def get_secret(secret_name: str) -> str:
    """Retrieve secret from AWS Secrets Manager."""
    try:
        response = secrets_client.get_secret_value(SecretId=secret_name)
        if 'SecretString' in response:
            secret = json.loads(response['SecretString'])
            if isinstance(secret, dict) and secret_name in secret:
                return secret[secret_name]
            return response['SecretString']
        return response['SecretBinary'].decode()
    except ClientError as e:
        logger.error(f"Failed to retrieve secret {secret_name}: {str(e)}")
        raise AuthenticationError(f"Secret retrieval failed: {str(e)}")


def validate_api_key(api_key: str) -> Dict:
    """
    Validate API key by:
    1. Extracting key prefix
    2. Checking DynamoDB cache first
    3. Querying database if not cached
    4. Hashing key and comparing with stored hash
    5. Updating cache and last_used_at timestamp
    """
    logger.debug(f"Validating API key (prefix: {api_key[:16]}...)")

    if not api_key.startswith('sb_'):
        raise AuthenticationError("Invalid API key format")

    key_prefix = api_key[:12]
    cache_key = f"api_key#{key_prefix}"
    cache_table = ddb.Table(os.environ.get('DDB_TABLE_CACHE', 'securebase-cache'))

    try:
        cache_response = cache_table.get_item(Key={'CacheKey': cache_key})
        if 'Item' in cache_response:
            cached = cache_response['Item']
            if 'ExpiresAt' in cached:
                expires_at = datetime.fromisoformat(cached['ExpiresAt'])
                if expires_at > datetime.now():
                    logger.debug(f"API key validation from cache: {cached['CustomerId']}")
                    return {
                        'customer_id': cached['CustomerId'],
                        'customer_name': cached.get('CustomerName', ''),
                        'tier': cached.get('Tier', 'standard'),
                        'scopes': cached.get('Scopes', ['read:invoices', 'read:metrics']),
                        'api_key_id': cached.get('ApiKeyId', '')
                    }
    except Exception as e:
        logger.warning(f"Cache lookup failed: {str(e)}")

    try:
        api_key_record = get_api_key_by_prefix(key_prefix)

        if not api_key_record:
            logger.warning(f"API key not found: {key_prefix}")
            raise AuthenticationError("Invalid API key")

        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()

        if not hmac.compare_digest(api_key_hash, api_key_record.get('key_hash', '')):
            logger.warning(f"API key hash mismatch for {key_prefix}")
            raise AuthenticationError("Invalid API key")

        if not api_key_record.get('is_active', True):
            raise AuthenticationError("API key is inactive")

        customer_id = api_key_record.get('customer_id', '')
        customer = get_customer_by_id(customer_id)

        if not customer:
            raise AuthenticationError("Customer not found")

        if customer.get('status') != 'active':
            raise AuthenticationError("Customer account is not active")

        try:
            update_api_key_usage(api_key_record.get('id', ''))
        except Exception as e:
            logger.warning(f"Failed to update API key usage: {str(e)}")

        cache_expires = datetime.now() + timedelta(hours=4)
        try:
            cache_table.put_item(Item={
                'CacheKey': cache_key,
                'CustomerId': customer_id,
                'CustomerName': customer.get('name', ''),
                'Tier': customer.get('tier', 'standard'),
                'Scopes': api_key_record.get('scopes', ['read:invoices', 'read:metrics']),
                'ApiKeyId': api_key_record.get('id', ''),
                'ExpiresAt': cache_expires.isoformat()
            })
        except Exception as e:
            logger.warning(f"Failed to cache API key: {str(e)}")

        logger.info(f"API key validated for customer {customer_id}")

        return {
            'customer_id': customer_id,
            'customer_name': customer.get('name', ''),
            'tier': customer.get('tier', 'standard'),
            'scopes': api_key_record.get('scopes', ['read:invoices', 'read:metrics']),
            'api_key_id': api_key_record.get('id', '')
        }

    except DatabaseError as e:
        logger.error(f"Database error during key validation: {str(e)}")
        raise AuthenticationError("Authentication service unavailable")


def generate_session_token(customer_id: str, customer_name: str, api_key_prefix: str) -> Tuple[str, int]:
    """Generate JWT session token from API key exchange."""
    try:
        jwt_secret = get_secret('jwt_secret')
    except Exception as e:
        logger.error(f"Failed to get JWT secret: {str(e)}")
        raise AuthenticationError("Token generation failed")

    payload = {
        'sub': customer_id,
        'name': customer_name,
        'iat': int(datetime.now().timestamp()),
        'exp': int((datetime.now() + timedelta(hours=24)).timestamp()),
        'jti': api_key_prefix
    }

    token = jwt.encode(payload, jwt_secret, algorithm='HS256')
    return token, 86400


def validate_session_token(token: str) -> Dict:
    """Validate JWT session token."""
    try:
        jwt_secret = get_secret('jwt_secret')
    except Exception as e:
        logger.error(f"Failed to get JWT secret: {str(e)}")
        raise AuthenticationError("Token validation failed")

    try:
        claims = jwt.decode(token, jwt_secret, algorithms=['HS256'])
        logger.debug(f"Session token validated for {claims.get('sub')}")
        return claims
    except jwt.ExpiredSignatureError:
        logger.warning("Session token expired")
        raise AuthenticationError("Session token expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid session token: {str(e)}")
        raise AuthenticationError("Invalid session token")


def authenticate_user_login(event: Dict, request_id: str) -> Dict:
    """
    Handle email + password login from the portal login form.

    Expected body: {"email": "...", "password": "..."}
    Returns API Gateway proxy response with session_token on success.
    """
    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        body = {}

    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''

    if not email or not password:
        return {
            'statusCode': 400,
            'headers': _CORS_HEADERS,
            'body': json.dumps({'error': 'email and password are required', 'request_id': request_id})
        }

    try:
        user = query_one(
            """
            SELECT u.id, u.email, u.password_hash, u.customer_id, u.role,
                   c.name AS customer_name, c.tier, c.status AS customer_status
            FROM users u
            JOIN customers c ON u.customer_id = c.id
            WHERE u.email = %s AND u.is_active = true
            """,
            (email,)
        )

        if not user:
            logger.warning(f"Login attempt for unknown email: {email} [{request_id}]")
            return {
                'statusCode': 401,
                'headers': _CORS_HEADERS,
                'body': json.dumps({'error': 'Invalid email or password', 'request_id': request_id})
            }

        if user.get('customer_status') != 'active':
            logger.warning(f"Login attempt on suspended account: {email} [{request_id}]")
            return {
                'statusCode': 403,
                'headers': _CORS_HEADERS,
                'body': json.dumps({'error': 'Account is not active', 'request_id': request_id})
            }

        password_hash = user.get('password_hash') or ''
        if not password_hash or not bcrypt.checkpw(password.encode(), password_hash.encode()):
            logger.warning(f"Bad password for {email} [{request_id}]")
            return {
                'statusCode': 401,
                'headers': _CORS_HEADERS,
                'body': json.dumps({'error': 'Invalid email or password', 'request_id': request_id})
            }

        try:
            jwt_secret = get_secret('jwt_secret')
        except Exception:
            raise AuthenticationError("Token generation failed")

        now = datetime.utcnow()
        payload = {
            'sub': user['customer_id'],
            'user_id': user['id'],
            'name': user['customer_name'],
            'email': email,
            'role': user.get('role', 'member'),
            'tier': user.get('tier', 'standard'),
            'iat': int(now.timestamp()),
            'exp': int((now + timedelta(hours=24)).timestamp()),
            'jti': str(uuid.uuid4()),
        }
        token = jwt.encode(payload, jwt_secret, algorithm='HS256')

        try:
            log_audit_event(
                customer_id=user['customer_id'],
                event_type='authentication',
                action='user_login',
                actor_email=email,
                status='success',
                request_id=request_id,
                metadata={'role': user.get('role')}
            )
        except Exception as e:
            logger.warning(f"Audit log failed: {e}")

        logger.info(f"User login success: {email} customer={user['customer_id']} [{request_id}]")

        return {
            'statusCode': 200,
            'headers': _CORS_HEADERS,
            'body': json.dumps({
                'session_token': token,
                'customer_id': user['customer_id'],
                'customer_name': user['customer_name'],
                'email': email,
                'role': user.get('role', 'member'),
                'tier': user.get('tier', 'standard'),
                'expires_in': 86400,
            })
        }

    except AuthenticationError as e:
        return {
            'statusCode': 401,
            'headers': _CORS_HEADERS,
            'body': json.dumps({'error': str(e), 'request_id': request_id})
        }
    except DatabaseError as e:
        logger.error(f"DB error during login [{request_id}]: {e}")
        return {
            'statusCode': 503,
            'headers': _CORS_HEADERS,
            'body': json.dumps({'error': 'Authentication service unavailable', 'request_id': request_id})
        }
    except Exception as e:
        logger.error(f"Unexpected login error [{request_id}]: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': _CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error', 'request_id': request_id})
        }


def lambda_handler(event, context) -> Dict:
    """
    Main Lambda entry point.

    Routes:
      OPTIONS *                       -> CORS preflight
      POST /auth | /auth/login        -> email + password portal login
      POST * with Bearer <api_key>    -> API key -> session token
      POST * with Bearer <jwt>        -> session token validation
    """
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _CORS_HEADERS, 'body': ''}

    request_id = event.get('requestContext', {}).get('requestId', str(uuid.uuid4()))
    path = event.get('path', '')
    method = event.get('httpMethod', 'POST')

    # ── Portal login: email + password ───────────────────────────────────
    if method == 'POST' and path in _LOGIN_PATHS:
        return authenticate_user_login(event, request_id)

    # ── API key or session token exchange ────────────────────────────────
    try:
        auth_header = event.get('headers', {}).get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            logger.warning(f"Missing Authorization header [{request_id}]")
            return {
                'statusCode': 401,
                'headers': _CORS_HEADERS,
                'body': json.dumps({
                    'error': 'Missing or invalid Authorization header',
                    'request_id': request_id
                })
            }

        api_key_or_token = auth_header[7:]

        try:
            auth_result = validate_api_key(api_key_or_token)
            session_token, expires_in = generate_session_token(
                auth_result['customer_id'],
                auth_result['customer_name'],
                api_key_or_token[:12]
            )

            try:
                log_audit_event(
                    customer_id=auth_result['customer_id'],
                    event_type='authentication',
                    action='api_key_authenticated',
                    actor_email='api',
                    status='success',
                    request_id=request_id,
                    metadata={
                        'api_key_id': auth_result['api_key_id'],
                        'scopes': auth_result['scopes']
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to log audit event: {str(e)}")

            return {
                'statusCode': 200,
                'headers': _CORS_HEADERS,
                'body': json.dumps({
                    'session_token': session_token,
                    'customer_id': auth_result['customer_id'],
                    'customer_name': auth_result['customer_name'],
                    'tier': auth_result['tier'],
                    'expires_in': expires_in
                })
            }

        except AuthenticationError:
            try:
                claims = validate_session_token(api_key_or_token)
                return {
                    'statusCode': 200,
                    'headers': _CORS_HEADERS,
                    'body': json.dumps({
                        'customer_id': claims['sub'],
                        'customer_name': claims.get('name', ''),
                        'authenticated': True,
                        'expires_at': claims['exp']
                    })
                }
            except AuthenticationError as e:
                raise e

    except AuthenticationError as e:
        logger.warning(f"Authentication failed [{request_id}]: {str(e)}")
        return {
            'statusCode': 401,
            'headers': _CORS_HEADERS,
            'body': json.dumps({'error': str(e), 'request_id': request_id})
        }

    except Exception as e:
        logger.error(f"Unexpected error [{request_id}]: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': _CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error', 'request_id': request_id})
        }
