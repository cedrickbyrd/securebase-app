"""
Unified Session Management Enhancement - Cross-Domain Cookie Support
Sprint Day 2 - Issue 2: Implement shared session management

This module extends the existing session_management.py to support
cross-domain authentication between marketing site and portal.
"""

import os
import json
import secrets
import hashlib
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from http.cookies import SimpleCookie

# Cookie configuration for cross-domain support
COOKIE_CONFIG = {
    'name': 'securebase_session',
    'httpOnly': True,
    'secure': True,  # HTTPS only
    'sameSite': 'None',  # Allow cross-domain
    'domain': '.tximhotep.com',  # Shared parent domain
    'path': '/',
    'maxAge': 86400  # 24 hours
}

# CSRF token configuration
CSRF_COOKIE_NAME = 'securebase_csrf'
CSRF_HEADER_NAME = 'X-CSRF-Token'


def create_cross_domain_session(event: dict, user_id: str, customer_id: str, 
                               role: str, email: str, full_name: str,
                               mfa_verified: bool = False) -> Dict:
    """
    Create a session with cross-domain cookie support.
    
    This is called after successful authentication (login or signup).
    Returns API Gateway response with Set-Cookie headers.
    """
    # Get request context
    source_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp', '')
    user_agent = event.get('headers', {}).get('User-Agent', '')
    
    # Generate tokens
    session_token = secrets.token_urlsafe(32)
    session_token_hash = hashlib.sha256(session_token.encode()).hexdigest()
    
    refresh_token = secrets.token_urlsafe(32)
    refresh_token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    
    csrf_token = generate_csrf_token(session_token)
    
    # Store session in database (reuse existing create_session logic)
    # Note: In production, this would call the existing create_session function
    expires_at = datetime.utcnow() + timedelta(seconds=COOKIE_CONFIG['maxAge'])
    
    # Create response with cookies
    response = {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': get_allowed_origin(event),
            'Access-Control-Allow-Credentials': 'true',
        },
        'multiValueHeaders': {
            'Set-Cookie': [
                build_session_cookie(session_token),
                build_csrf_cookie(csrf_token)
            ]
        },
        'body': json.dumps({
            'success': True,
            'user': {
                'id': user_id,
                'customer_id': customer_id,
                'email': email,
                'full_name': full_name,
                'role': role
            },
            'csrf_token': csrf_token,
            'expires_at': expires_at.isoformat(),
            'mfa_required': not mfa_verified
        })
    }
    
    return response


def validate_cookie_session(event: dict) -> Dict:
    """
    Validate session from cookie header.
    Used for cross-domain session validation.
    """
    # Extract cookies from request
    cookie_header = event.get('headers', {}).get('Cookie', '')
    if not cookie_header:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_allowed_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({'error': 'No session cookie found'})
        }
    
    # Parse cookies
    cookie = SimpleCookie()
    cookie.load(cookie_header)
    
    session_token = None
    if COOKIE_CONFIG['name'] in cookie:
        session_token = cookie[COOKIE_CONFIG['name']].value
    
    if not session_token:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_allowed_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({'error': 'Invalid session cookie'})
        }
    
    # Hash token for database lookup
    session_token_hash = hashlib.sha256(session_token.encode()).hexdigest()
    
    # In production, this would query the database for session details
    # For now, return mock validated session
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': get_allowed_origin(event),
            'Access-Control-Allow-Credentials': 'true'
        },
        'body': json.dumps({
            'valid': True,
            'user': {
                'id': 'mock-user-id',
                'customer_id': 'mock-customer-id',
                'email': 'user@example.com',
                'role': 'admin'
            },
            'expires_at': (datetime.utcnow() + timedelta(hours=24)).isoformat()
        })
    }


def build_session_cookie(session_token: str) -> str:
    """Build secure session cookie string."""
    cookie_parts = [
        f"{COOKIE_CONFIG['name']}={session_token}",
        "HttpOnly",
        "Secure",
        f"SameSite={COOKIE_CONFIG['sameSite']}",
        f"Domain={COOKIE_CONFIG['domain']}",
        f"Path={COOKIE_CONFIG['path']}",
        f"Max-Age={COOKIE_CONFIG['maxAge']}"
    ]
    return '; '.join(cookie_parts)


def build_csrf_cookie(csrf_token: str) -> str:
    """Build CSRF token cookie (not httpOnly so JS can read it)."""
    cookie_parts = [
        f"{CSRF_COOKIE_NAME}={csrf_token}",
        "Secure",
        f"SameSite={COOKIE_CONFIG['sameSite']}",
        f"Domain={COOKIE_CONFIG['domain']}",
        f"Path={COOKIE_CONFIG['path']}",
        f"Max-Age={COOKIE_CONFIG['maxAge']}"
    ]
    return '; '.join(cookie_parts)


def generate_csrf_token(session_token: str) -> str:
    """Generate CSRF token tied to session."""
    # In production, use a proper secret
    secret = os.environ.get('CSRF_SECRET', 'default-csrf-secret')
    data = f"{session_token}:{secret}"
    return hashlib.sha256(data.encode()).hexdigest()[:32]


def validate_csrf_token(session_token: str, provided_token: str) -> bool:
    """Validate CSRF token matches session."""
    expected_token = generate_csrf_token(session_token)
    return secrets.compare_digest(expected_token, provided_token)


def get_allowed_origin(event: dict) -> str:
    """Get allowed origin for CORS based on request origin."""
    origin = event.get('headers', {}).get('Origin', '')
    
    allowed_origins = [
        'https://securebase.tximhotep.com',
        'https://demo.securebase.tximhotep.com',
        'http://localhost:5173',  # Local development
        'http://localhost:3000'   # Local development
    ]
    
    if origin in allowed_origins:
        return origin
    
    # Default to marketing site
    return 'https://securebase.tximhotep.com'


def clear_session_cookies(event: dict) -> Dict:
    """Clear session cookies on logout."""
    # Create expired cookies to clear them
    expired = 'Thu, 01 Jan 1970 00:00:00 GMT'
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': get_allowed_origin(event),
            'Access-Control-Allow-Credentials': 'true'
        },
        'multiValueHeaders': {
            'Set-Cookie': [
                f"{COOKIE_CONFIG['name']}=; Domain={COOKIE_CONFIG['domain']}; Path=/; Expires={expired}; Secure; HttpOnly",
                f"{CSRF_COOKIE_NAME}=; Domain={COOKIE_CONFIG['domain']}; Path=/; Expires={expired}; Secure"
            ]
        },
        'body': json.dumps({'success': True, 'message': 'Logged out successfully'})
    }


# Enhanced Lambda handler that includes cookie-based endpoints
def enhanced_lambda_handler(event, context):
    """
    Enhanced Lambda handler with cookie support.
    
    New endpoints:
    - POST /auth/session/cookie - Create session with cookie
    - GET /auth/session/validate - Validate session from cookie
    - POST /auth/logout/cookie - Logout with cookie clearing
    """
    http_method = event.get('httpMethod')
    path = event.get('path', '')
    
    # Handle cookie-based session validation
    if http_method == 'GET' and path == '/auth/session/validate':
        return validate_cookie_session(event)
    
    # Handle logout with cookie clearing
    if http_method == 'POST' and path == '/auth/logout/cookie':
        return clear_session_cookies(event)
    
    # For other endpoints, delegate to main handler
    # In production, this would import and call the original lambda_handler
    return {
        'statusCode': 404,
        'body': json.dumps({'error': 'Endpoint not found'})
    }


# Middleware for CSRF validation
def require_csrf_token(handler):
    """Decorator to validate CSRF token for state-changing operations."""
    def wrapper(event, context):
        # Skip CSRF for safe methods
        if event.get('httpMethod') in ['GET', 'HEAD', 'OPTIONS']:
            return handler(event, context)
        
        # Extract CSRF token from header
        csrf_token = event.get('headers', {}).get(CSRF_HEADER_NAME, '')
        if not csrf_token:
            return {
                'statusCode': 403,
                'body': json.dumps({'error': 'CSRF token required'})
            }
        
        # Extract session token from cookie
        cookie_header = event.get('headers', {}).get('Cookie', '')
        cookie = SimpleCookie()
        cookie.load(cookie_header)
        
        session_token = None
        if COOKIE_CONFIG['name'] in cookie:
            session_token = cookie[COOKIE_CONFIG['name']].value
        
        if not session_token or not validate_csrf_token(session_token, csrf_token):
            return {
                'statusCode': 403,
                'body': json.dumps({'error': 'Invalid CSRF token'})
            }
        
        # CSRF valid, proceed with request
        return handler(event, context)
    
    return wrapper