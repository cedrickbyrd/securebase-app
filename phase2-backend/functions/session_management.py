"""
Session Management Lambda for SecureBase Phase 4.

Handles:
  - User login with email/password
  - MFA verification (TOTP)
  - Session token generation and validation
  - Session refresh
  - Logout
  - Device tracking

Environment variables:
  - RDS_HOST: RDS Proxy endpoint
  - RDS_DATABASE: securebase
  - RDS_USER: securebase_app
  - RDS_PASSWORD: (from Secrets Manager)
  - JWT_SECRET: (from Secrets Manager)
  - SESSION_DURATION: Session duration in seconds (default: 86400 = 24 hours)
"""

import os
import sys
import json
import logging
import hashlib
import secrets
import base64
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta

import bcrypt
import jwt
import pyotp
import boto3
from botocore.exceptions import ClientError

# Import database utilities
sys.path.insert(0, '/opt/python')
from db_utils import get_connection, release_connection, DatabaseError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize AWS clients
secrets_client = boto3.client('secretsmanager')

# Constants
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30
SESSION_DURATION = int(os.environ.get('SESSION_DURATION', 86400))  # 24 hours


class AuthenticationError(Exception):
    """Custom exception for authentication failures."""
    pass


def lambda_handler(event, context):
    """
    Main Lambda handler for session management operations.
    
    Supported operations:
    - POST /auth/login - User login
    - POST /auth/mfa/verify - Verify MFA code
    - POST /auth/mfa/setup - Setup MFA for user
    - POST /auth/refresh - Refresh session token
    - POST /auth/logout - Logout and invalidate session
    - GET /auth/session - Validate and get current session info
    """
    try:
        http_method = event.get('httpMethod')
        path = event.get('path', '')
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        
        # Get client info
        headers = event.get('headers', {})
        source_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp')
        user_agent = headers.get('User-Agent', headers.get('user-agent', ''))
        
        # Route to appropriate handler
        if http_method == 'POST' and path == '/auth/login':
            return login(body, source_ip, user_agent)
        
        elif http_method == 'POST' and path == '/auth/mfa/verify':
            return verify_mfa(body, source_ip, user_agent)
        
        elif http_method == 'POST' and path == '/auth/mfa/setup':
            return setup_mfa(body)
        
        elif http_method == 'POST' and path == '/auth/refresh':
            return refresh_session(body, source_ip, user_agent)
        
        elif http_method == 'POST' and path == '/auth/logout':
            return logout(body)
        
        elif http_method == 'GET' and path == '/auth/session':
            auth_header = headers.get('Authorization', headers.get('authorization', ''))
            return get_session_info(auth_header)
        
        else:
            return error_response(404, f'Not found: {http_method} {path}')
    
    except Exception as e:
        logger.error(f'Error in session management: {str(e)}', exc_info=True)
        return error_response(500, f'Internal server error: {str(e)}')


def login(data: Dict, source_ip: str, user_agent: str) -> Dict:
    """
    User login with email and password.
    Returns session token if successful, or requires MFA if enabled.
    """
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')
    
    if not email or not password:
        return error_response(400, 'Email and password are required')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get user by email
        cursor.execute("""
            SELECT 
                u.id, u.customer_id, u.password_hash, u.status,
                u.mfa_enabled, u.mfa_secret, u.role, u.email, u.full_name,
                u.failed_login_attempts, u.locked_until
            FROM users u
            WHERE u.email = %s
        """, (email,))
        
        user = cursor.fetchone()
        
        if not user:
            # Don't reveal if user exists or not
            return error_response(401, 'Invalid email or password')
        
        user_id = str(user[0])
        customer_id = str(user[1])
        password_hash = user[2]
        status = user[3]
        mfa_enabled = user[4]
        mfa_secret = user[5]
        role = user[6]
        user_email = user[7]
        full_name = user[8]
        failed_attempts = user[9] or 0
        locked_until = user[10]
        
        # Check if account is locked
        if locked_until and locked_until > datetime.utcnow():
            return error_response(423, f'Account is locked until {locked_until.isoformat()}')
        
        # Check account status
        if status != 'active':
            return error_response(403, f'Account is {status}')
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
            # Increment failed attempts
            failed_attempts += 1
            
            if failed_attempts >= MAX_FAILED_ATTEMPTS:
                lockout_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                cursor.execute("""
                    UPDATE users
                    SET failed_login_attempts = %s,
                        locked_until = %s
                    WHERE id = %s
                """, (failed_attempts, lockout_until, user_id))
                conn.commit()
                return error_response(423, f'Account locked due to too many failed attempts. Try again after {LOCKOUT_DURATION_MINUTES} minutes.')
            else:
                cursor.execute("""
                    UPDATE users
                    SET failed_login_attempts = %s
                    WHERE id = %s
                """, (failed_attempts, user_id))
                conn.commit()
                return error_response(401, f'Invalid email or password. {MAX_FAILED_ATTEMPTS - failed_attempts} attempts remaining.')
        
        # Password is correct - reset failed attempts
        cursor.execute("""
            UPDATE users
            SET failed_login_attempts = 0,
                locked_until = NULL,
                last_login_at = CURRENT_TIMESTAMP,
                last_login_ip = %s
            WHERE id = %s
        """, (source_ip, user_id))
        
        # If MFA is enabled, don't create session yet - require MFA verification
        if mfa_enabled:
            # Create temporary pre-auth token
            pre_auth_token = generate_pre_auth_token(user_id, customer_id, email)
            
            conn.commit()
            
            return success_response({
                'mfa_required': True,
                'pre_auth_token': pre_auth_token,
                'message': 'MFA verification required'
            })
        
        # No MFA - create session directly
        session_token, refresh_token, expires_at = create_session(
            cursor, user_id, customer_id, role, email, source_ip, user_agent
        )
        
        # Log login activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, ip_address, user_agent
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id, user_id, user_email, 'user_login',
            f'User {full_name} logged in',
            source_ip, user_agent
        ))
        
        conn.commit()
        
        return success_response({
            'session_token': session_token,
            'refresh_token': refresh_token,
            'expires_at': expires_at.isoformat(),
            'expires_in': SESSION_DURATION,
            'user': {
                'id': user_id,
                'customer_id': customer_id,
                'email': user_email,
                'full_name': full_name,
                'role': role
            }
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error during login: {str(e)}')
        return error_response(500, 'Login failed')
    
    finally:
        if conn:
            release_connection(conn)


def verify_mfa(data: Dict, source_ip: str, user_agent: str) -> Dict:
    """Verify MFA code and create session."""
    pre_auth_token = data.get('pre_auth_token', '')
    mfa_code = data.get('mfa_code', '')
    
    if not pre_auth_token or not mfa_code:
        return error_response(400, 'Pre-auth token and MFA code are required')
    
    # Validate pre-auth token
    try:
        jwt_secret = get_jwt_secret()
        payload = jwt.decode(pre_auth_token, jwt_secret, algorithms=['HS256'])
        user_id = payload['user_id']
        customer_id = payload['customer_id']
        email = payload['email']
    except jwt.ExpiredSignatureError:
        return error_response(401, 'Pre-auth token expired')
    except jwt.InvalidTokenError:
        return error_response(401, 'Invalid pre-auth token')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get user MFA secret
        cursor.execute("""
            SELECT mfa_secret, role, full_name, status
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        user = cursor.fetchone()
        if not user:
            return error_response(404, 'User not found')
        
        mfa_secret = user[0]
        role = user[1]
        full_name = user[2]
        status = user[3]
        
        if status != 'active':
            return error_response(403, f'Account is {status}')
        
        # Verify MFA code
        totp = pyotp.TOTP(mfa_secret)
        if not totp.verify(mfa_code, valid_window=1):  # Allow 1 time step before/after
            return error_response(401, 'Invalid MFA code')
        
        # MFA verified - create session
        session_token, refresh_token, expires_at = create_session(
            cursor, user_id, customer_id, role, email, source_ip, user_agent, mfa_verified=True
        )
        
        # Log login activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, ip_address, user_agent
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id, user_id, email, 'user_login',
            f'User {full_name} logged in (MFA verified)',
            source_ip, user_agent
        ))
        
        conn.commit()
        
        return success_response({
            'session_token': session_token,
            'refresh_token': refresh_token,
            'expires_at': expires_at.isoformat(),
            'expires_in': SESSION_DURATION,
            'user': {
                'id': user_id,
                'customer_id': customer_id,
                'email': email,
                'full_name': full_name,
                'role': role
            }
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error verifying MFA: {str(e)}')
        return error_response(500, 'MFA verification failed')
    
    finally:
        if conn:
            release_connection(conn)


def setup_mfa(data: Dict) -> Dict:
    """Setup MFA for a user. Returns QR code data for TOTP app."""
    # This would typically require an authenticated session
    # For simplicity, we'll use user_id from request
    user_id = data.get('user_id')
    
    if not user_id:
        return error_response(400, 'User ID is required')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get user info
        cursor.execute("""
            SELECT email, full_name, customer_id
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        user = cursor.fetchone()
        if not user:
            return error_response(404, 'User not found')
        
        email = user[0]
        full_name = user[1]
        customer_id = user[2]
        
        # Generate TOTP secret
        totp_secret = pyotp.random_base32()
        
        # Create TOTP URI for QR code
        totp = pyotp.TOTP(totp_secret)
        provisioning_uri = totp.provisioning_uri(
            name=email,
            issuer_name='SecureBase'
        )
        
        # Update user with MFA secret (but don't enable yet)
        cursor.execute("""
            UPDATE users
            SET mfa_secret = %s
            WHERE id = %s
        """, (totp_secret, user_id))
        
        # Log activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, resource_type, resource_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id, user_id, email, 'user_updated',
            f'MFA setup initiated for user {full_name}',
            'users', user_id
        ))
        
        conn.commit()
        
        return success_response({
            'secret': totp_secret,
            'provisioning_uri': provisioning_uri,
            # Note: For production, generate QR code on frontend using qrcode.js library
            # to avoid exposing secret to third-party services
            'message': 'Use provisioning_uri to generate QR code on client side, then scan with authenticator app'
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error setting up MFA: {str(e)}')
        return error_response(500, 'MFA setup failed')
    
    finally:
        if conn:
            release_connection(conn)


def refresh_session(data: Dict, source_ip: str, user_agent: str) -> Dict:
    """Refresh session using refresh token."""
    refresh_token = data.get('refresh_token', '')
    
    if not refresh_token:
        return error_response(400, 'Refresh token is required')
    
    refresh_token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Find session by refresh token
        cursor.execute("""
            SELECT s.id, s.user_id, s.customer_id, s.is_active, s.expires_at,
                   u.role, u.email, u.full_name, u.status
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.refresh_token_hash = %s
        """, (refresh_token_hash,))
        
        session = cursor.fetchone()
        
        if not session:
            return error_response(401, 'Invalid refresh token')
        
        session_id = session[0]
        user_id = str(session[1])
        customer_id = str(session[2])
        is_active = session[3]
        expires_at = session[4]
        role = session[5]
        email = session[6]
        full_name = session[7]
        status = session[8]
        
        if not is_active:
            return error_response(401, 'Session is no longer active')
        
        if expires_at < datetime.utcnow():
            return error_response(401, 'Refresh token expired')
        
        if status != 'active':
            return error_response(403, f'Account is {status}')
        
        # Create new session
        new_session_token, new_refresh_token, new_expires_at = create_session(
            cursor, user_id, customer_id, role, email, source_ip, user_agent
        )
        
        # Invalidate old session
        cursor.execute("""
            UPDATE user_sessions
            SET is_active = false,
                logged_out_at = CURRENT_TIMESTAMP,
                logout_reason = 'refreshed'
            WHERE id = %s
        """, (session_id,))
        
        conn.commit()
        
        return success_response({
            'session_token': new_session_token,
            'refresh_token': new_refresh_token,
            'expires_at': new_expires_at.isoformat(),
            'expires_in': SESSION_DURATION,
            'user': {
                'id': user_id,
                'customer_id': customer_id,
                'email': email,
                'full_name': full_name,
                'role': role
            }
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error refreshing session: {str(e)}')
        return error_response(500, 'Session refresh failed')
    
    finally:
        if conn:
            release_connection(conn)


def logout(data: Dict) -> Dict:
    """Logout and invalidate session."""
    session_token = data.get('session_token', '')
    
    if not session_token:
        return error_response(400, 'Session token is required')
    
    session_token_hash = hashlib.sha256(session_token.encode()).hexdigest()
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Find and invalidate session
        cursor.execute("""
            UPDATE user_sessions
            SET is_active = false,
                logged_out_at = CURRENT_TIMESTAMP,
                logout_reason = 'user_logout'
            WHERE session_token_hash = %s AND is_active = true
            RETURNING user_id, customer_id
        """, (session_token_hash,))
        
        result = cursor.fetchone()
        
        if result:
            user_id = str(result[0])
            customer_id = str(result[1])
            
            # Log logout activity
            cursor.execute("""
                INSERT INTO activity_feed (
                    customer_id, user_id, user_email, activity_type,
                    description
                )
                SELECT %s, %s, email, 'user_logout', 
                       'User logged out'
                FROM users WHERE id = %s
            """, (customer_id, user_id, user_id))
        
        conn.commit()
        
        return success_response({'message': 'Logged out successfully'})
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error during logout: {str(e)}')
        return error_response(500, 'Logout failed')
    
    finally:
        if conn:
            release_connection(conn)


def get_session_info(auth_header: str) -> Dict:
    """Get current session information from bearer token."""
    if not auth_header.startswith('Bearer '):
        return error_response(401, 'Missing or invalid Authorization header')
    
    session_token = auth_header[7:]  # Remove 'Bearer ' prefix
    session_token_hash = hashlib.sha256(session_token.encode()).hexdigest()
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get session info
        cursor.execute("""
            SELECT s.id, s.user_id, s.customer_id, s.is_active, s.expires_at,
                   s.mfa_verified, s.last_activity_at, s.created_at,
                   u.email, u.full_name, u.role, u.status
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token_hash = %s
        """, (session_token_hash,))
        
        session = cursor.fetchone()
        
        if not session:
            return error_response(401, 'Invalid session token')
        
        is_active = session[3]
        expires_at = session[4]
        status = session[11]
        
        if not is_active:
            return error_response(401, 'Session is no longer active')
        
        if expires_at < datetime.utcnow():
            return error_response(401, 'Session expired')
        
        if status != 'active':
            return error_response(403, f'Account is {status}')
        
        # Update last activity
        cursor.execute("""
            UPDATE user_sessions
            SET last_activity_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (session[0],))
        
        conn.commit()
        
        return success_response({
            'session_id': str(session[0]),
            'user_id': str(session[1]),
            'customer_id': str(session[2]),
            'is_active': session[3],
            'expires_at': session[4].isoformat(),
            'mfa_verified': session[5],
            'last_activity_at': session[6].isoformat() if session[6] else None,
            'created_at': session[7].isoformat(),
            'user': {
                'email': session[8],
                'full_name': session[9],
                'role': session[10],
                'status': session[11]
            }
        })
    
    except Exception as e:
        logger.error(f'Error getting session info: {str(e)}')
        return error_response(500, 'Failed to get session info')
    
    finally:
        if conn:
            release_connection(conn)


def create_session(cursor, user_id: str, customer_id: str, role: str, email: str,
                   source_ip: str, user_agent: str, mfa_verified: bool = False) -> Tuple[str, str, datetime]:
    """Create a new session and return tokens."""
    # Generate session token
    session_token = secrets.token_urlsafe(32)
    session_token_hash = hashlib.sha256(session_token.encode()).hexdigest()
    
    # Generate refresh token
    refresh_token = secrets.token_urlsafe(32)
    refresh_token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    
    # Calculate expiration
    expires_at = datetime.utcnow() + timedelta(seconds=SESSION_DURATION)
    
    # Create session in database
    cursor.execute("""
        INSERT INTO user_sessions (
            user_id, customer_id, session_token_hash, refresh_token_hash,
            user_agent, ip_address, mfa_verified, mfa_verified_at,
            expires_at, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        user_id, customer_id, session_token_hash, refresh_token_hash,
        user_agent, source_ip, mfa_verified,
        datetime.utcnow() if mfa_verified else None,
        expires_at, True
    ))
    
    return session_token, refresh_token, expires_at


def generate_pre_auth_token(user_id: str, customer_id: str, email: str) -> str:
    """Generate temporary pre-authentication token for MFA flow."""
    jwt_secret = get_jwt_secret()
    
    payload = {
        'user_id': user_id,
        'customer_id': customer_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(minutes=5),  # 5 minute expiration
        'iat': datetime.utcnow()
    }
    
    return jwt.encode(payload, jwt_secret, algorithm='HS256')


def get_jwt_secret() -> str:
    """Get JWT secret from environment or Secrets Manager."""
    # Try environment first
    secret = os.environ.get('JWT_SECRET')
    if secret:
        return secret
    
    # Fall back to Secrets Manager
    try:
        response = secrets_client.get_secret_value(SecretId='securebase/jwt_secret')
        if 'SecretString' in response:
            return response['SecretString']
        return base64.b64decode(response['SecretBinary']).decode('utf-8')
    except ClientError as e:
        logger.error(f'Failed to retrieve JWT secret: {str(e)}')
        raise AuthenticationError('Failed to retrieve JWT secret')


def success_response(data: Dict) -> Dict:
    """Format success response."""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps(data)
    }


def error_response(status_code: int, message: str) -> Dict:
    """Format error response."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps({'error': message})
    }
