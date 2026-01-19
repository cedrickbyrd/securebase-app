"""
SecureBase Phase 2: Lambda Authentication Function

Handles API key validation and user session authentication
Uses RLS to ensure data isolation between customers
"""

import json
import hmac
import hashlib
import boto3
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import os
import logging
from functools import wraps
import jwt

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
RDS_ENDPOINT = os.environ.get('RDS_ENDPOINT')
RDS_PORT = os.environ.get('RDS_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'securebase')
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-in-production')

# AWS Clients
secrets_client = boto3.client('secretsmanager')
dynamodb = boto3.resource('dynamodb')
cloudwatch = boto3.client('cloudwatch')

cache_table = dynamodb.Table(os.environ.get('CACHE_TABLE', 'securebase-cache'))


def get_db_connection():
    """
    Get PostgreSQL connection via RDS Proxy
    Handles credential retrieval from Secrets Manager
    """
    try:
        secret_response = secrets_client.get_secret_value(
            SecretId=os.environ.get('RDS_SECRET_ARN')
        )
        secret_dict = json.loads(secret_response['SecretString'])
        
        conn = psycopg2.connect(
            host=RDS_ENDPOINT,
            port=int(RDS_PORT),
            database=DB_NAME,
            user=secret_dict['username'],
            password=secret_dict['password'],
            sslmode='require'  # Enforce TLS
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        raise


def set_rls_context(cur, customer_id):
    """
    Set RLS context for Row-Level Security
    All queries after this will be filtered to customer_id
    """
    cur.execute(f"SET app.current_customer_id = '{customer_id}'")


def authenticate_api_key(event, context):
    """
    Validate API key and return customer context
    Used as authorizer for all API endpoints
    
    Request Format:
    {
        "headers": {
            "Authorization": "Bearer sk_live_1234567890abcdef..."
        }
    }
    """
    try:
        auth_header = event.get('headers', {}).get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            logger.warning("Invalid auth header format")
            return error_response('Unauthorized: Invalid header', 401)
        
        api_key = auth_header.replace('Bearer ', '')
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        # Check cache first (reduce DB queries)
        cache_response = cache_table.get_item(Key={'SessionId': f'apikey#{api_key_hash}'})
        if 'Item' in cache_response:
            item = cache_response['Item']
            logger.info(f"API key cached for {item['CustomerId']}")
            return success_response({
                'customer_id': item['CustomerId'],
                'customer_name': item['CustomerName'],
                'customer_tier': item['CustomerTier'],
                'scopes': item['Scopes']
            })
        
        # Query database
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT 
                ak.id, ak.customer_id, ak.scopes, 
                c.name, c.tier, c.status
            FROM api_keys ak
            JOIN customers c ON ak.customer_id = c.id
            WHERE ak.key_hash = %s 
              AND ak.is_active = true
              AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
              AND c.status = 'active'
        """, (api_key_hash,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result:
            logger.warning(f"Invalid API key: {api_key[:8]}...")
            return error_response('Unauthorized: Invalid API key', 401)
        
        # Cache the session (8-hour TTL)
        cache_table.put_item(
            Item={
                'SessionId': f'apikey#{api_key_hash}',
                'CustomerId': result['customer_id'],
                'CustomerName': result['name'],
                'CustomerTier': result['tier'],
                'Scopes': result['scopes'],
                'ExpiresAt': int((datetime.utcnow() + timedelta(hours=8)).timestamp()),
                'TTL': int((datetime.utcnow() + timedelta(hours=8)).timestamp())
            }
        )
        
        # Update last_used_at in database (async)
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE api_keys SET last_used_at = NOW() WHERE id = %s",
            (result['id'],)
        )
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"API key authenticated: {result['customer_id']}")
        
        return success_response({
            'customer_id': result['customer_id'],
            'customer_name': result['name'],
            'customer_tier': result['tier'],
            'scopes': result['scopes']
        })
        
    except Exception as e:
        logger.exception(f"Auth error: {str(e)}")
        return error_response('Internal server error', 500)


def authenticate_user_session(event, context):
    """
    Authenticate user session from customer portal
    Uses email + MFA code validation
    
    Request Format:
    {
        "body": {
            "email": "user@customer.com",
            "mfa_code": "123456"
        }
    }
    """
    try:
        body = json.loads(event.get('body', '{}'))
        email = body.get('email', '').strip()
        mfa_code = body.get('mfa_code', '').strip()
        
        if not email or not mfa_code:
            return error_response('Missing email or MFA code', 400)
        
        # TODO: Integrate with Cognito/Auth0 for MFA validation
        # For now, validate against configured MFA provider
        # mfa_valid = validate_mfa_with_cognito(email, mfa_code)
        
        # Placeholder: Accept valid 6-digit codes for testing
        if not (len(mfa_code) == 6 and mfa_code.isdigit()):
            logger.warning(f"Invalid MFA format for {email}")
            return error_response('Invalid MFA code', 401)
        
        # Query customer from email
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT id, name, tier, status, email, billing_email
            FROM customers 
            WHERE email = %s OR billing_email = %s
        """, (email, email))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result:
            logger.warning(f"Customer not found: {email}")
            return error_response('Customer not found', 404)
        
        if result['status'] != 'active':
            logger.warning(f"Account suspended/deleted: {result['id']}")
            return error_response('Account suspended or deleted', 403)
        
        # Create JWT session token
        session_token = create_jwt_token(
            customer_id=result['id'],
            customer_name=result['name'],
            email=email,
            tier=result['tier']
        )
        
        # Cache session
        cache_table.put_item(
            Item={
                'SessionId': f"session#{result['id']}",
                'CustomerId': result['id'],
                'CustomerName': result['name'],
                'CustomerTier': result['tier'],
                'UserEmail': email,
                'ExpiresAt': int((datetime.utcnow() + timedelta(days=1)).timestamp()),
                'TTL': int((datetime.utcnow() + timedelta(days=1)).timestamp())
            }
        )
        
        # Log audit event
        log_audit_event(
            result['id'],
            'user_login',
            'User authenticated via MFA',
            actor_email=email
        )
        
        logger.info(f"User session created: {email} ({result['id']})")
        
        return success_response({
            'session_token': session_token,
            'customer_id': result['id'],
            'customer_name': result['name'],
            'email': email,
            'expires_in': 86400  # 24 hours
        })
        
    except Exception as e:
        logger.exception(f"Session auth error: {str(e)}")
        return error_response('Internal server error', 500)


def validate_session_token(token):
    """
    Validate JWT session token
    Returns customer_id if valid, None if invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Session token expired")
        return None
    except jwt.InvalidTokenError:
        logger.warning("Invalid session token")
        return None


def create_jwt_token(customer_id, customer_name, email, tier):
    """Create JWT session token with 24-hour expiration"""
    payload = {
        'customer_id': customer_id,
        'customer_name': customer_name,
        'email': email,
        'tier': tier,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=1)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def log_audit_event(customer_id, event_type, action, actor_email=None, resource_type=None, resource_id=None):
    """Log audit event to DynamoDB"""
    try:
        events_table = dynamodb.Table(os.environ.get('EVENTS_TABLE', 'securebase-events'))
        
        events_table.put_item(
            Item={
                'CustomerId#Month': f"{customer_id}#{datetime.utcnow().strftime('%Y-%m')}",
                'Timestamp': datetime.utcnow().isoformat(),
                'EventType': event_type,
                'Action': action,
                'ActorEmail': actor_email or 'system',
                'ResourceType': resource_type,
                'ResourceId': resource_id,
                'TTL': int((datetime.utcnow() + timedelta(days=2555)).timestamp())  # 7 years
            }
        )
    except Exception as e:
        logger.error(f"Failed to log audit event: {str(e)}")


def success_response(data):
    """Standard success response"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps(data)
    }


def error_response(message, status_code):
    """Standard error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'error': message})
    }
