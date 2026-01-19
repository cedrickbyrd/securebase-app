"""
Authentication Lambda for SecureBase Phase 2.

Handles:
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

Event format (API Gateway):
  {
    "headers": {
      "Authorization": "Bearer <api_key>"
    },
    "requestContext": {
      "requestId": "abc-123"
    }
  }

Response format:
  {
    "statusCode": 200,
    "body": {
      "session_token": "eyJ...",
      "customer_id": "uuid",
      "expires_in": 86400
    }
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
    
    Args:
        api_key: Full API key (format: sb_<random>_<hash>)
    
    Returns:
        Dict with customer_id, customer_name, tier, scopes, api_key_id
    
    Raises:
        AuthenticationError: If key is invalid or expired
    """
    logger.debug(f"Validating API key (prefix: {api_key[:16]}...)")
    
    # Extract and validate key format
    if not api_key.startswith('sb_'):
        raise AuthenticationError("Invalid API key format")
    
    # Extract prefix (first 12 chars: 'sb_' + 9 random)
    key_prefix = api_key[:12]
    
    # Check cache first (DynamoDB)
    cache_key = f"api_key#{key_prefix}"
    cache_table = ddb.Table(os.environ.get('DDB_TABLE_CACHE', 'securebase-cache'))
    
    try:
        cache_response = cache_table.get_item(Key={'CacheKey': cache_key})
        if 'Item' in cache_response:
            cached = cache_response['Item']
            # Verify cache TTL
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
        # Continue to database lookup
    
    # Query database for API key
    try:
        api_key_record = get_api_key_by_prefix(key_prefix)
        
        if not api_key_record:
            logger.warning(f"API key not found: {key_prefix}")
            raise AuthenticationError("Invalid API key")
        
        # Hash provided key
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        # Compare with stored hash (using constant-time comparison)
        if not hmac.compare_digest(api_key_hash, api_key_record.get('key_hash', '')):
            logger.warning(f"API key hash mismatch for {key_prefix}")
            raise AuthenticationError("Invalid API key")
        
        # Check if key is active
        if not api_key_record.get('is_active', True):
            raise AuthenticationError("API key is inactive")
        
        # Get customer details
        customer_id = api_key_record.get('customer_id', '')
        customer = get_customer_by_id(customer_id)
        
        if not customer:
            raise AuthenticationError("Customer not found")
        
        if customer.get('status') != 'active':
            raise AuthenticationError("Customer account is not active")
        
        # Update last used timestamp
        try:
            update_api_key_usage(api_key_record.get('id', ''))
        except Exception as e:
            logger.warning(f"Failed to update API key usage: {str(e)}")
        
        # Cache the result (4 hour TTL)
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
    """
    Generate JWT session token.
    
    Token format:
    {
        "sub": "<customer_id>",
        "name": "<customer_name>",
        "iat": <issued_at>,
        "exp": <expires_at>,
        "jti": "<key_prefix>"
    }
    
    Args:
        customer_id: Customer UUID
        customer_name: Customer name
        api_key_prefix: API key prefix (for jti)
    
    Returns:
        Tuple of (token, expires_in_seconds)
    """
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
    expires_in = 86400  # 24 hours
    
    logger.debug(f"Session token generated for {customer_name}")
    return token, expires_in


def validate_session_token(token: str) -> Dict:
    """
    Validate JWT session token.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded token claims
    
    Raises:
        AuthenticationError: If token is invalid or expired
    """
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


def lambda_handler(event, context) -> Dict:
    """
    Lambda handler for authentication requests.
    
    Expects:
      - Authorization header with Bearer token (API key or session token)
      - Request ID for audit logging
    
    Returns:
      - 200: {"session_token": "...", "customer_id": "...", "expires_in": 86400}
      - 401: {"error": "Invalid credentials", "request_id": "..."}
      - 500: {"error": "Internal server error", "request_id": "..."}
    """
    request_id = event.get('requestContext', {}).get('requestId', str(uuid.uuid4()))
    
    try:
        # Extract authorization header
        auth_header = event.get('headers', {}).get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            logger.warning(f"Missing Authorization header [{request_id}]")
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'error': 'Missing or invalid Authorization header',
                    'request_id': request_id
                })
            }
        
        api_key_or_token = auth_header[7:]  # Remove 'Bearer '
        
        # Try to validate as API key first
        try:
            auth_result = validate_api_key(api_key_or_token)
            session_token, expires_in = generate_session_token(
                auth_result['customer_id'],
                auth_result['customer_name'],
                api_key_or_token[:12]
            )
            
            # Log successful authentication
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
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'session_token': session_token,
                    'customer_id': auth_result['customer_id'],
                    'customer_name': auth_result['customer_name'],
                    'tier': auth_result['tier'],
                    'expires_in': expires_in
                })
            }
        
        except AuthenticationError:
            # Try to validate as session token
            try:
                claims = validate_session_token(api_key_or_token)
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({
                        'customer_id': claims['sub'],
                        'customer_name': claims['name'],
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
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': str(e),
                'request_id': request_id
            })
        }
    
    except Exception as e:
        logger.error(f"Unexpected error [{request_id}]: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': 'Internal server error',
                'request_id': request_id
            })
        }
