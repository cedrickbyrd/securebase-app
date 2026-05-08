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
import hmac
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

# Cookie configuration for unified cross-domain session management
COOKIE_DOMAIN = os.environ.get('COOKIE_DOMAIN', '.tximhotep.com')
COOKIE_NAME = 'securebase_session'
REFRESH_COOKIE_NAME = 'securebase_refresh'
CSRF_COOKIE_NAME = 'securebase_csrf'
CSRF_HEADER_NAME = 'X-CSRF-Token'


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

        # Handle OPTIONS preflight for CORS
        if http_method == 'OPTIONS':
            return success_response({}, event)

        # Route to appropriate handler
        if http_method == 'POST' and path == '/auth/login':
            return login(body, source_ip, user_agent, event)

        elif http_method == 'POST' and path == '/auth/mfa/verify':
            return verify_mfa(body, source_ip, user_agent, event)

        elif http_method == 'POST' and path == '/auth/mfa/setup':
            return setup_mfa(body, event)

        elif http_method == 'POST' and path == '/auth/refresh':
            return refresh_session(body, source_ip, user_agent, event)

        elif http_method == 'POST' and path == '/auth/logout':
            return logout(body, event)

        elif http_method == 'GET' and path == '/auth/session':
            auth_header = get_header_value(headers, 'Authorization')
            # Also check cookie-based session
            cookie_header = get_header_value(headers, 'Cookie')
            return get_session_info(auth_header, event, cookie_header)

        elif http_method == 'GET' and path == '/auth/session/validate':
            auth_header = get_header_value(headers, 'Authorization')
            cookie_header = get_header_value(headers, 'Cookie')
            return get_session_info(auth_header, event, cookie_header)

        else:
            return error_response(404, f'Not found: {http_method} {path}', event)

    except Exception as e:
        logger.error(f'Error in session management: {str(e)}', exc_info=True)
        return error_response(500, f'Internal server error: {str(e)}', event)


def login(data: Dict, source_ip: str, user_agent: str, event: Dict) -> Dict:
    """
    User login with email and password.
    Returns session token if successful, or requires MFA if enabled.
    Also sets httpOnly cookies for unified cross-domain session management.
    """
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')

    if not email or not password:
        return error_response(400, 'Email and password are required', event)

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
            return error_response(401, 'Invalid email or password', event)

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
            return error_response(423, f'Account is locked until {locked_until.isoformat()}', event)

        # Check account status
        if status != 'active':
            return error_response(403, f'Account is {status}', event)

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
                return error_response(423, f'Account locked due to too many failed attempts. Try again after {LOCKOUT_DURATION_MINUTES} minutes.', event)
            else:
                cursor.execute("""
                    UPDATE users
                    SET failed_login_attempts = %s
                    WHERE id = %s
                """, (failed_attempts, user_id))
                conn.commit()
                return error_response(401, f'Invalid email or password. {MAX_FAILED_ATTEMPTS - failed_attempts} attempts remaining.', event)

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
            }, event)

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

        # Build Set-Cookie headers for unified cross-domain auth
        csrf_token = generate_csrf_token(session_token)
        cookie_headers = build_session_cookies(session_token, refresh_token, expires_at, csrf_token)

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
        }, event, additional_headers=cookie_headers)

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error during login: {str(e)}')
        return error_response(500, 'Login failed', event)

    finally:
        if conn:
            release_connection(conn)


def verify_mfa(data: Dict, source_ip: str, user_agent: str, event: Dict) -> Dict:
    """Verify MFA code and create session."""
    pre_auth_token = data.get('pre_auth_token', '')
    mfa_code = data.get('mfa_code', '')

    if not pre_auth_token or not mfa_code:
        return error_response(400, 'Pre-auth token and MFA code are required', event)

    # Validate pre-auth token
    try:
        jwt_secret = get_jwt_secret()
        payload = jwt.decode(pre_auth_token, jwt_secret, algorithms=['HS256'])
        user_id = payload['user_id']
        customer_id = payload['customer_id']
        email = payload['email']
    except jwt.ExpiredSignatureError:
        return error_response(401, 'Pre-auth token expired', event)
    except jwt.InvalidTokenError:
        return error_response(401, 'Invalid pre-auth token', event)

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
            return error_response(404, 'User not found', event)

        mfa_secret = user[0]
        role = user[1]
        full_name = user[2]
        status = user[3]

        if status != 'active':
            return error_response(403, f'Account is {status}', event)

        # Verify MFA code
        totp = pyotp.TOTP(mfa_secret)
        if not totp.verify(mfa_code, valid_window=1):  # Allow 1 time step before/after
            return error_response(401, 'Invalid MFA code', event)

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

        # Build Set-Cookie headers for unified cross-domain auth
        csrf_token = generate_csrf_token(session_token)
        cookie_headers = build_session_cookies(session_token, refresh_token, expires_at, csrf_token)

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
        }, event, additional_headers=cookie_headers)

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error verifying MFA: {str(e)}')
        return error_response(500, 'MFA verification failed', event)

    finally:
        if conn:
            release_connection(conn)


def setup_mfa(data: Dict, event: Dict) -> Dict:
    """Setup MFA for a user. Returns QR code data for TOTP app."""
    user_id = data.get('user_id')

    if not user_id:
        return error_response(400, 'User ID is required', event)

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
            return error_response(404, 'User not found', event)

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
            'message': 'Use provisioning_uri to generate QR code on client side, then scan with authenticator app'
        }, event)

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error setting up MFA: {str(e)}')
        return error_response(500, 'MFA setup failed', event)

    finally:
        if conn:
            release_connection(conn)


def refresh_session(data: Dict, source_ip: str, user_agent: str, event: Dict) -> Dict:
    """Refresh session using refresh token (body or cookie)."""
    headers = event.get('headers', {})
    cookie_header = get_header_value(headers, 'Cookie')

    # Enforce CSRF token validation for cookie-based refresh requests
    cookie_session_token = extract_cookie(cookie_header, COOKIE_NAME)
    if cookie_session_token:
        csrf_header = get_header_value(headers, CSRF_HEADER_NAME)
        csrf_cookie = extract_cookie(cookie_header, CSRF_COOKIE_NAME)
        if not validate_csrf_token(cookie_session_token, csrf_header, csrf_cookie):
            return error_response(403, 'Invalid CSRF token', event)

    # Accept refresh token from body or from cookie
    refresh_token = data.get('refresh_token', '')
    if not refresh_token:
        refresh_token = extract_cookie(cookie_header, REFRESH_COOKIE_NAME)

    if not refresh_token:
        return error_response(400, 'Refresh token is required', event)

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
            return error_response(401, 'Invalid refresh token', event)

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
            return error_response(401, 'Session is no longer active', event)

        if expires_at < datetime.utcnow():
            return error_response(401, 'Refresh token expired', event)

        if status != 'active':
            return error_response(403, f'Account is {status}', event)

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

        # Build Set-Cookie headers for refreshed session
        csrf_token = generate_csrf_token(new_session_token)
        cookie_headers = build_session_cookies(new_session_token, new_refresh_token, new_expires_at, csrf_token)

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
        }, event, additional_headers=cookie_headers)

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error refreshing session: {str(e)}')
        return error_response(500, 'Session refresh failed', event)

    finally:
        if conn:
            release_connection(conn)


def logout(data: Dict, event: Dict) -> Dict:
    """Logout and invalidate session. Clears httpOnly cookies."""
    session_token = data.get('session_token', '')
    headers = event.get('headers', {})
    cookie_header = get_header_value(headers, 'Cookie')

    # Also check cookie if no token in body
    if not session_token:
        session_token = extract_cookie(cookie_header, COOKIE_NAME)

    # Enforce CSRF token validation for cookie-based logout requests
    if cookie_header and extract_cookie(cookie_header, COOKIE_NAME):
        csrf_header = get_header_value(headers, CSRF_HEADER_NAME)
        csrf_cookie = extract_cookie(cookie_header, CSRF_COOKIE_NAME)
        if not validate_csrf_token(session_token, csrf_header, csrf_cookie):
            return error_response(403, 'Invalid CSRF token', event)

    if not session_token:
        return error_response(400, 'Session token is required', event)

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

        # Clear cookies on logout
        clear_cookies = build_clear_cookies()

        return success_response({'message': 'Logged out successfully'}, event, additional_headers=clear_cookies)

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error during logout: {str(e)}')
        return error_response(500, 'Logout failed', event)

    finally:
        if conn:
            release_connection(conn)


def get_session_info(auth_header: str, event: Dict, cookie_header: str = '') -> Dict:
    """Get current session information from bearer token or cookie."""
    session_token = None

    # Try bearer token first
    if auth_header.startswith('Bearer '):
        session_token = auth_header[7:]

    # Fall back to cookie
    if not session_token and cookie_header:
        session_token = extract_cookie(cookie_header, COOKIE_NAME)

    if not session_token:
        return error_response(401, 'Missing or invalid Authorization header or session cookie', event)

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
            return error_response(401, 'Invalid session token', event)

        is_active = session[3]
        expires_at = session[4]
        status = session[11]

        if not is_active:
            return error_response(401, 'Session is no longer active', event)

        if expires_at < datetime.utcnow():
            return error_response(401, 'Session expired', event)

        if status != 'active':
            return error_response(403, f'Account is {status}', event)

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
        }, event)

    except Exception as e:
        logger.error(f'Error getting session info: {str(e)}')
        return error_response(500, 'Failed to get session info', event)

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


def get_cors_headers(event: Dict) -> Dict:
    """Get CORS headers with credentials support for cross-domain cookies."""
    origin = event.get('headers', {}).get('origin', 'https://securebase.tximhotep.com')

    allowed_origins = [
        'https://securebase.tximhotep.com',
        'https://www.securebase.tximhotep.com',
        'https://demo.securebase.tximhotep.com',
        'http://localhost:3000',
        'http://localhost:5173'
    ]

    cors_origin = origin if origin in allowed_origins else 'https://securebase.tximhotep.com'

    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': cors_origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-CSRF-Token,Cookie',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
        'Access-Control-Expose-Headers': 'Set-Cookie,X-CSRF-Token'
    }


def generate_csrf_token(session_token: str) -> str:
    """Generate CSRF token bound to the session token."""
    csrf_secret = os.environ.get('CSRF_SECRET') or os.environ.get('JWT_SECRET')
    if not csrf_secret:
        csrf_secret = get_jwt_secret()
    if not csrf_secret:
        raise AuthenticationError('CSRF secret is not configured')
    return hmac.new(csrf_secret.encode(), session_token.encode(), hashlib.sha256).hexdigest()


def validate_csrf_token(session_token: str, provided_token: str, cookie_token: str) -> bool:
    """Validate CSRF token from request header against cookie and expected value."""
    if not session_token or not provided_token or not cookie_token:
        return False
    try:
        expected_token = generate_csrf_token(session_token)
    except Exception:
        return False
    return (
        secrets.compare_digest(provided_token, cookie_token) and
        secrets.compare_digest(expected_token, cookie_token)
    )


def build_session_cookies(session_token: str, refresh_token: str, expires_at: datetime, csrf_token: str = '') -> Dict:
    """
    Build Set-Cookie headers for unified cross-domain session management.
    Uses httpOnly + Secure + SameSite=None for cross-domain cookie sharing.
    API Gateway supports multiValueHeaders for multiple Set-Cookie headers.
    """
    max_age = SESSION_DURATION
    # Refresh token lives 7x longer than session
    refresh_max_age = SESSION_DURATION * 7

    session_cookie = (
        f'{COOKIE_NAME}={session_token}; '
        f'Domain={COOKIE_DOMAIN}; Path=/; '
        f'Max-Age={max_age}; '
        'HttpOnly; Secure; SameSite=None'
    )

    refresh_cookie = (
        f'{REFRESH_COOKIE_NAME}={refresh_token}; '
        f'Domain={COOKIE_DOMAIN}; Path=/auth/refresh; '
        f'Max-Age={refresh_max_age}; '
        'HttpOnly; Secure; SameSite=None'
    )

    cookies = [session_cookie, refresh_cookie]
    if csrf_token:
        csrf_cookie = (
            f'{CSRF_COOKIE_NAME}={csrf_token}; '
            f'Domain={COOKIE_DOMAIN}; Path=/; '
            f'Max-Age={max_age}; '
            'Secure; SameSite=None'
        )
        cookies.append(csrf_cookie)

    # Return as multiValueHeaders key so API Gateway sends all Set-Cookie headers
    return {'multiValueHeaders': {'Set-Cookie': cookies}}


def build_clear_cookies() -> Dict:
    """Build expired Set-Cookie headers to clear session cookies on logout."""
    clear_session = (
        f'{COOKIE_NAME}=; '
        f'Domain={COOKIE_DOMAIN}; Path=/; '
        'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; '
        'HttpOnly; Secure; SameSite=None'
    )

    clear_refresh = (
        f'{REFRESH_COOKIE_NAME}=; '
        f'Domain={COOKIE_DOMAIN}; Path=/auth/refresh; '
        'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; '
        'HttpOnly; Secure; SameSite=None'
    )

    clear_csrf = (
        f'{CSRF_COOKIE_NAME}=; '
        f'Domain={COOKIE_DOMAIN}; Path=/; '
        'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; '
        'Secure; SameSite=None'
    )

    return {'multiValueHeaders': {'Set-Cookie': [clear_session, clear_refresh, clear_csrf]}}


def extract_cookie(cookie_header: str, cookie_name: str) -> Optional[str]:
    """Extract a specific cookie value from the Cookie header string."""
    if not cookie_header:
        return None
    for part in cookie_header.split(';'):
        name, _, value = part.strip().partition('=')
        if name.strip() == cookie_name:
            return value.strip()
    return None


def get_header_value(headers: Dict, header_name: str) -> str:
    """Get header value with case-insensitive lookup."""
    if not headers:
        return ''
    return headers.get(header_name, headers.get(header_name.lower(), ''))


def success_response(data: Dict, event: Dict = None, additional_headers: Dict = None) -> Dict:
    """Format success response with CORS and optional additional headers."""
    headers = get_cors_headers(event or {})

    response = {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps(data)
    }

    # Merge multiValueHeaders (e.g. Set-Cookie) separately from single-value headers
    if additional_headers:
        if 'multiValueHeaders' in additional_headers:
            response['multiValueHeaders'] = additional_headers.pop('multiValueHeaders')
        headers.update(additional_headers)

    return response


def error_response(status_code: int, message: str, event: Dict = None) -> Dict:
    """Format error response with CORS."""
    return {
        'statusCode': status_code,
        'headers': get_cors_headers(event or {}),
        'body': json.dumps({'error': message})
    }
