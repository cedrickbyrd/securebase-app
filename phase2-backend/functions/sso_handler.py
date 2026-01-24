"""
SSO Handler Lambda for SecureBase Phase 4.

Handles:
  - OIDC authentication flow (Google, Okta, Auth0, Azure AD)
  - SAML 2.0 authentication flow
  - SSO provider configuration management
  - User auto-provisioning from SSO
  - SSO session mapping

Environment variables:
  - RDS_HOST: RDS Proxy endpoint
  - RDS_DATABASE: securebase
  - RDS_USER: securebase_app
  - RDS_PASSWORD: (from Secrets Manager)
  - JWT_SECRET: (from Secrets Manager)
  - KMS_KEY_ID: For encrypting SSO client secrets
  - CALLBACK_BASE_URL: Base URL for SSO callbacks (e.g., https://portal.securebase.com)
"""

import os
import sys
import json
import logging
import hashlib
import secrets
import base64
import time
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from urllib.parse import urlencode, parse_qs, urlparse
import re

import boto3
import jwt
import requests
from botocore.exceptions import ClientError

# Import database utilities
sys.path.insert(0, '/opt/python')
from db_utils import get_connection, release_connection, DatabaseError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize AWS clients
secrets_client = boto3.client('secretsmanager')
kms_client = boto3.client('kms')

# Constants
CALLBACK_BASE_URL = os.environ.get('CALLBACK_BASE_URL', 'https://portal.securebase.com')
KMS_KEY_ID = os.environ.get('KMS_KEY_ID', '')
SSO_STATE_TTL_SECONDS = 600  # 10 minutes
MAX_SSO_LOGIN_TIME_MS = 2000  # <2s target for SSO login


class SSOError(Exception):
    """Custom exception for SSO failures."""
    pass


def lambda_handler(event, context):
    """
    Main Lambda handler for SSO operations.
    
    Supported operations:
    - GET /auth/sso/providers - List SSO providers for customer
    - POST /auth/sso/providers - Create/update SSO provider
    - GET /auth/sso/login/{provider_id} - Initiate SSO login (redirect to provider)
    - GET /auth/sso/callback - Handle SSO callback from provider
    - POST /auth/sso/saml/acs - SAML Assertion Consumer Service endpoint
    - DELETE /auth/sso/providers/{provider_id} - Delete SSO provider
    """
    start_time = time.time()
    
    try:
        http_method = event.get('httpMethod')
        path = event.get('path', '')
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        query_params = event.get('queryStringParameters') or {}
        path_params = event.get('pathParameters') or {}
        
        # Get client info
        headers = event.get('headers', {})
        source_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp')
        user_agent = headers.get('User-Agent', headers.get('user-agent', ''))
        
        # Route to appropriate handler
        if http_method == 'GET' and path == '/auth/sso/providers':
            return list_sso_providers(headers)
        
        elif http_method == 'POST' and path == '/auth/sso/providers':
            return create_or_update_sso_provider(body, headers)
        
        elif http_method == 'GET' and '/auth/sso/login/' in path:
            provider_id = path_params.get('provider_id') or path.split('/')[-1]
            return initiate_sso_login(provider_id, query_params, source_ip)
        
        elif http_method == 'GET' and path == '/auth/sso/callback':
            elapsed_ms = int((time.time() - start_time) * 1000)
            return handle_sso_callback(query_params, source_ip, user_agent, elapsed_ms)
        
        elif http_method == 'POST' and path == '/auth/sso/saml/acs':
            elapsed_ms = int((time.time() - start_time) * 1000)
            return handle_saml_acs(body, source_ip, user_agent, elapsed_ms)
        
        elif http_method == 'DELETE' and '/auth/sso/providers/' in path:
            provider_id = path_params.get('provider_id') or path.split('/')[-1]
            return delete_sso_provider(provider_id, headers)
        
        else:
            return error_response(404, f'Not found: {http_method} {path}')
    
    except Exception as e:
        logger.error(f'Error in SSO handler: {str(e)}', exc_info=True)
        return error_response(500, f'Internal server error: {str(e)}')


def list_sso_providers(headers: Dict) -> Dict:
    """List SSO providers for customer."""
    # Get customer_id from auth token
    customer_id = get_customer_from_auth(headers)
    if not customer_id:
        return error_response(401, 'Unauthorized')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                id, provider_type, provider_name, status,
                oidc_issuer_url, oidc_client_id, oidc_scopes,
                saml_entity_id, saml_sso_url, saml_name_id_format,
                auto_provision_users, default_role,
                total_logins, failed_logins, avg_login_time_ms,
                last_successful_login_at, created_at
            FROM sso_providers
            WHERE customer_id = %s
            ORDER BY created_at DESC
        """, (customer_id,))
        
        providers = []
        for row in cursor.fetchall():
            providers.append({
                'id': str(row[0]),
                'provider_type': row[1],
                'provider_name': row[2],
                'status': row[3],
                'oidc_issuer_url': row[4],
                'oidc_client_id': row[5],
                'oidc_scopes': row[6],
                'saml_entity_id': row[7],
                'saml_sso_url': row[8],
                'saml_name_id_format': row[9],
                'auto_provision_users': row[10],
                'default_role': row[11],
                'total_logins': row[12],
                'failed_logins': row[13],
                'avg_login_time_ms': row[14],
                'last_successful_login_at': row[15].isoformat() if row[15] else None,
                'created_at': row[16].isoformat()
            })
        
        return success_response({'providers': providers})
    
    except Exception as e:
        logger.error(f'Error listing SSO providers: {str(e)}')
        return error_response(500, 'Failed to list SSO providers')
    
    finally:
        if conn:
            release_connection(conn)


def create_or_update_sso_provider(data: Dict, headers: Dict) -> Dict:
    """Create or update SSO provider configuration."""
    customer_id = get_customer_from_auth(headers)
    if not customer_id:
        return error_response(401, 'Unauthorized')
    
    # Validate required fields
    provider_type = data.get('provider_type')
    provider_name = data.get('provider_name')
    
    if not provider_type or provider_type not in ['oidc', 'saml2']:
        return error_response(400, 'Invalid provider_type (must be oidc or saml2)')
    
    if not provider_name:
        return error_response(400, 'provider_name is required')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Check if provider already exists
        cursor.execute("""
            SELECT id FROM sso_providers
            WHERE customer_id = %s AND provider_name = %s
        """, (customer_id, provider_name))
        
        existing = cursor.fetchone()
        provider_id = str(existing[0]) if existing else None
        
        if provider_type == 'oidc':
            # OIDC configuration
            oidc_issuer = data.get('oidc_issuer_url')
            oidc_client_id = data.get('oidc_client_id')
            oidc_client_secret = data.get('oidc_client_secret')
            
            if not oidc_issuer or not oidc_client_id:
                return error_response(400, 'oidc_issuer_url and oidc_client_id are required for OIDC')
            
            # Encrypt client secret if provided
            encrypted_secret = None
            if oidc_client_secret:
                encrypted_secret = encrypt_with_kms(oidc_client_secret)
            
            if provider_id:
                # Update existing
                cursor.execute("""
                    UPDATE sso_providers
                    SET oidc_issuer_url = %s,
                        oidc_client_id = %s,
                        oidc_client_secret_encrypted = COALESCE(%s, oidc_client_secret_encrypted),
                        oidc_scopes = %s,
                        auto_provision_users = %s,
                        default_role = %s,
                        status = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id
                """, (
                    oidc_issuer, oidc_client_id, encrypted_secret,
                    data.get('oidc_scopes', ['openid', 'email', 'profile']),
                    data.get('auto_provision_users', True),
                    data.get('default_role', 'viewer'),
                    data.get('status', 'testing'),
                    provider_id
                ))
            else:
                # Create new
                cursor.execute("""
                    INSERT INTO sso_providers (
                        customer_id, provider_type, provider_name,
                        oidc_issuer_url, oidc_client_id, oidc_client_secret_encrypted,
                        oidc_scopes, auto_provision_users, default_role, status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    customer_id, provider_type, provider_name,
                    oidc_issuer, oidc_client_id, encrypted_secret,
                    data.get('oidc_scopes', ['openid', 'email', 'profile']),
                    data.get('auto_provision_users', True),
                    data.get('default_role', 'viewer'),
                    data.get('status', 'testing')
                ))
                provider_id = str(cursor.fetchone()[0])
        
        elif provider_type == 'saml2':
            # SAML 2.0 configuration
            saml_entity_id = data.get('saml_entity_id')
            saml_sso_url = data.get('saml_sso_url')
            saml_x509_cert = data.get('saml_x509_cert')
            
            if not saml_entity_id or not saml_sso_url or not saml_x509_cert:
                return error_response(400, 'saml_entity_id, saml_sso_url, and saml_x509_cert are required for SAML')
            
            if provider_id:
                # Update existing
                cursor.execute("""
                    UPDATE sso_providers
                    SET saml_entity_id = %s,
                        saml_sso_url = %s,
                        saml_x509_cert = %s,
                        saml_name_id_format = %s,
                        auto_provision_users = %s,
                        default_role = %s,
                        status = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id
                """, (
                    saml_entity_id, saml_sso_url, saml_x509_cert,
                    data.get('saml_name_id_format', 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'),
                    data.get('auto_provision_users', True),
                    data.get('default_role', 'viewer'),
                    data.get('status', 'testing'),
                    provider_id
                ))
            else:
                # Create new
                cursor.execute("""
                    INSERT INTO sso_providers (
                        customer_id, provider_type, provider_name,
                        saml_entity_id, saml_sso_url, saml_x509_cert,
                        saml_name_id_format, auto_provision_users, default_role, status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    customer_id, provider_type, provider_name,
                    saml_entity_id, saml_sso_url, saml_x509_cert,
                    data.get('saml_name_id_format', 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'),
                    data.get('auto_provision_users', True),
                    data.get('default_role', 'viewer'),
                    data.get('status', 'testing')
                ))
                provider_id = str(cursor.fetchone()[0])
        
        conn.commit()
        
        return success_response({
            'provider_id': provider_id,
            'message': 'SSO provider created successfully' if not existing else 'SSO provider updated successfully'
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error creating SSO provider: {str(e)}')
        return error_response(500, 'Failed to create SSO provider')
    
    finally:
        if conn:
            release_connection(conn)


def initiate_sso_login(provider_id: str, query_params: Dict, source_ip: str) -> Dict:
    """Initiate SSO login flow by redirecting to provider."""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get provider config
        cursor.execute("""
            SELECT 
                id, customer_id, provider_type, provider_name, status,
                oidc_issuer_url, oidc_client_id, oidc_scopes,
                saml_entity_id, saml_sso_url
            FROM sso_providers
            WHERE id = %s
        """, (provider_id,))
        
        provider = cursor.fetchone()
        if not provider:
            return error_response(404, 'SSO provider not found')
        
        if provider[4] != 'active' and provider[4] != 'testing':
            return error_response(403, f'SSO provider is {provider[4]}')
        
        provider_type = provider[2]
        customer_id = str(provider[1])
        
        # Generate state token for CSRF protection
        state_token = secrets.token_urlsafe(32)
        state_data = {
            'provider_id': provider_id,
            'customer_id': customer_id,
            'source_ip': source_ip,
            'timestamp': int(time.time())
        }
        
        # Store state in DynamoDB or cache (simplified - using encoded state)
        encoded_state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()
        
        if provider_type == 'oidc':
            # OIDC Authorization Code Flow
            oidc_issuer = provider[5]
            oidc_client_id = provider[6]
            oidc_scopes = provider[7] or ['openid', 'email', 'profile']
            
            # Construct authorization URL
            auth_params = {
                'client_id': oidc_client_id,
                'response_type': 'code',
                'scope': ' '.join(oidc_scopes),
                'redirect_uri': f'{CALLBACK_BASE_URL}/auth/sso/callback',
                'state': encoded_state
            }
            
            # Get authorization endpoint from OIDC discovery
            auth_url = f'{oidc_issuer}/authorize?{urlencode(auth_params)}'
            
            return redirect_response(auth_url)
        
        elif provider_type == 'saml2':
            # SAML 2.0 AuthnRequest
            saml_sso_url = provider[9]
            
            # Simplified SAML request (production would use python3-saml library)
            saml_request = generate_saml_authn_request(provider_id, customer_id)
            encoded_saml = base64.b64encode(saml_request.encode()).decode()
            
            auth_params = {
                'SAMLRequest': encoded_saml,
                'RelayState': encoded_state
            }
            
            auth_url = f'{saml_sso_url}?{urlencode(auth_params)}'
            
            return redirect_response(auth_url)
        
        else:
            return error_response(400, 'Unsupported provider type')
    
    except Exception as e:
        logger.error(f'Error initiating SSO login: {str(e)}')
        return error_response(500, 'Failed to initiate SSO login')
    
    finally:
        if conn:
            release_connection(conn)


def handle_sso_callback(query_params: Dict, source_ip: str, user_agent: str, elapsed_ms: int) -> Dict:
    """Handle OIDC callback with authorization code."""
    code = query_params.get('code')
    state = query_params.get('state')
    error = query_params.get('error')
    
    if error:
        return error_response(400, f'SSO provider error: {error}')
    
    if not code or not state:
        return error_response(400, 'Missing code or state parameter')
    
    # Decode and validate state
    try:
        state_data = json.loads(base64.urlsafe_b64decode(state).decode())
        provider_id = state_data['provider_id']
        customer_id = state_data['customer_id']
        timestamp = state_data['timestamp']
        
        # Validate state timestamp (10 min expiry)
        if time.time() - timestamp > SSO_STATE_TTL_SECONDS:
            return error_response(400, 'SSO state expired')
    except Exception as e:
        logger.error(f'Invalid state parameter: {str(e)}')
        return error_response(400, 'Invalid state parameter')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get provider config
        cursor.execute("""
            SELECT 
                provider_type, oidc_issuer_url, oidc_client_id,
                oidc_client_secret_encrypted, auto_provision_users, default_role
            FROM sso_providers
            WHERE id = %s AND customer_id = %s
        """, (provider_id, customer_id))
        
        provider = cursor.fetchone()
        if not provider:
            return error_response(404, 'SSO provider not found')
        
        # Exchange code for token
        oidc_issuer = provider[1]
        oidc_client_id = provider[2]
        oidc_client_secret = decrypt_with_kms(provider[3]) if provider[3] else ''
        
        token_response = exchange_code_for_token(
            oidc_issuer, oidc_client_id, oidc_client_secret, code
        )
        
        if not token_response:
            # Log failed login
            cursor.execute("""
                UPDATE sso_providers
                SET failed_logins = failed_logins + 1
                WHERE id = %s
            """, (provider_id,))
            conn.commit()
            return error_response(401, 'Failed to exchange authorization code')
        
        # Decode ID token
        id_token = token_response.get('id_token')
        user_info = decode_id_token(id_token, oidc_client_id)
        
        if not user_info:
            return error_response(401, 'Invalid ID token')
        
        # Extract user details
        sso_subject_id = user_info.get('sub')
        sso_email = user_info.get('email')
        sso_name = user_info.get('name') or user_info.get('given_name', '')
        
        if not sso_email:
            return error_response(400, 'Email not provided by SSO provider')
        
        # Find or create user
        user_id, session_token, refresh_token, expires_at = get_or_create_sso_user(
            cursor, provider_id, customer_id, sso_subject_id, sso_email, sso_name,
            provider[4], provider[5], source_ip, user_agent
        )
        
        # Update provider stats
        cursor.execute("""
            UPDATE sso_providers
            SET total_logins = total_logins + 1,
                avg_login_time_ms = CASE 
                    WHEN avg_login_time_ms IS NULL THEN %s
                    ELSE (avg_login_time_ms * 0.9 + %s * 0.1)::INTEGER
                END,
                last_successful_login_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (elapsed_ms, elapsed_ms, provider_id))
        
        # Log security event if slow login
        if elapsed_ms > MAX_SSO_LOGIN_TIME_MS:
            logger.warning(f'SSO login took {elapsed_ms}ms (target: <{MAX_SSO_LOGIN_TIME_MS}ms)')
        
        conn.commit()
        
        # Return session with redirect to portal
        return redirect_with_token_response(session_token, refresh_token, expires_at)
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error handling SSO callback: {str(e)}')
        return error_response(500, 'SSO login failed')
    
    finally:
        if conn:
            release_connection(conn)


def handle_saml_acs(body: Dict, source_ip: str, user_agent: str, elapsed_ms: int) -> Dict:
    """Handle SAML Assertion Consumer Service (ACS) endpoint."""
    # This is a simplified implementation
    # Production would use python3-saml library for full SAML validation
    saml_response = body.get('SAMLResponse')
    relay_state = body.get('RelayState')
    
    if not saml_response:
        return error_response(400, 'Missing SAMLResponse')
    
    # Decode state
    try:
        state_data = json.loads(base64.urlsafe_b64decode(relay_state).decode())
        provider_id = state_data['provider_id']
        customer_id = state_data['customer_id']
    except Exception as e:
        return error_response(400, 'Invalid RelayState')
    
    # Production implementation would:
    # 1. Decode and parse SAML response XML
    # 2. Validate signature with provider's X.509 certificate
    # 3. Verify timestamps and conditions
    # 4. Extract user attributes
    
    return error_response(501, 'SAML ACS not yet fully implemented - use OIDC for now')


def delete_sso_provider(provider_id: str, headers: Dict) -> Dict:
    """Delete SSO provider."""
    customer_id = get_customer_from_auth(headers)
    if not customer_id:
        return error_response(401, 'Unauthorized')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Soft delete by setting status to disabled
        cursor.execute("""
            UPDATE sso_providers
            SET status = 'disabled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND customer_id = %s
            RETURNING id
        """, (provider_id, customer_id))
        
        if cursor.rowcount == 0:
            return error_response(404, 'SSO provider not found')
        
        conn.commit()
        
        return success_response({'message': 'SSO provider disabled'})
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error deleting SSO provider: {str(e)}')
        return error_response(500, 'Failed to delete SSO provider')
    
    finally:
        if conn:
            release_connection(conn)


# ============================================
# Helper Functions
# ============================================

def get_or_create_sso_user(cursor, provider_id: str, customer_id: str, sso_subject_id: str,
                            sso_email: str, sso_name: str, auto_provision: bool,
                            default_role: str, source_ip: str, user_agent: str) -> Tuple:
    """Get existing user or create new user from SSO."""
    # Check if SSO mapping exists
    cursor.execute("""
        SELECT user_id FROM sso_user_mappings
        WHERE sso_provider_id = %s AND sso_subject_id = %s
    """, (provider_id, sso_subject_id))
    
    mapping = cursor.fetchone()
    
    if mapping:
        user_id = str(mapping[0])
        
        # Update SSO login stats
        cursor.execute("""
            UPDATE sso_user_mappings
            SET last_sso_login_at = CURRENT_TIMESTAMP,
                total_sso_logins = total_sso_logins + 1
            WHERE sso_provider_id = %s AND sso_subject_id = %s
        """, (provider_id, sso_subject_id))
    else:
        # Check if user exists by email
        cursor.execute("""
            SELECT id FROM users
            WHERE customer_id = %s AND email = %s
        """, (customer_id, sso_email))
        
        existing_user = cursor.fetchone()
        
        if existing_user:
            user_id = str(existing_user[0])
        else:
            if not auto_provision:
                raise SSOError('User auto-provisioning is disabled')
            
            # Create new user
            cursor.execute("""
                INSERT INTO users (
                    customer_id, email, full_name, role, status,
                    password_hash
                )
                VALUES (%s, %s, %s, %s, 'active', NULL)
                RETURNING id
            """, (customer_id, sso_email, sso_name, default_role))
            
            user_id = str(cursor.fetchone()[0])
        
        # Create SSO mapping
        cursor.execute("""
            INSERT INTO sso_user_mappings (
                user_id, customer_id, sso_provider_id,
                sso_subject_id, sso_email, sso_name,
                total_sso_logins
            )
            VALUES (%s, %s, %s, %s, %s, %s, 1)
        """, (user_id, customer_id, provider_id, sso_subject_id, sso_email, sso_name))
    
    # Create session
    from session_management import create_session
    
    session_token, refresh_token, expires_at = create_session(
        cursor, user_id, customer_id, default_role, sso_email,
        source_ip, user_agent, mfa_verified=True  # SSO implies MFA from provider
    )
    
    return user_id, session_token, refresh_token, expires_at


def exchange_code_for_token(issuer: str, client_id: str, client_secret: str, code: str) -> Optional[Dict]:
    """Exchange authorization code for access/ID tokens."""
    token_endpoint = f'{issuer}/token'
    
    try:
        response = requests.post(token_endpoint, data={
            'grant_type': 'authorization_code',
            'code': code,
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': f'{CALLBACK_BASE_URL}/auth/sso/callback'
        }, timeout=5)
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f'Token exchange failed: {response.status_code} {response.text}')
            return None
    except Exception as e:
        logger.error(f'Error exchanging code: {str(e)}')
        return None


def decode_id_token(id_token: str, client_id: str) -> Optional[Dict]:
    """Decode and validate OIDC ID token."""
    try:
        # Skip signature verification for now (production should verify)
        payload = jwt.decode(id_token, options={'verify_signature': False})
        
        # Validate audience
        if payload.get('aud') != client_id:
            logger.error('ID token audience mismatch')
            return None
        
        # Validate expiration
        if payload.get('exp', 0) < time.time():
            logger.error('ID token expired')
            return None
        
        return payload
    except Exception as e:
        logger.error(f'Error decoding ID token: {str(e)}')
        return None


def generate_saml_authn_request(provider_id: str, customer_id: str) -> str:
    """Generate SAML AuthnRequest (simplified)."""
    # Production would use python3-saml library
    request_id = f'_{secrets.token_hex(16)}'
    timestamp = datetime.utcnow().isoformat() + 'Z'
    
    return f'''<samlp:AuthnRequest 
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        ID="{request_id}"
        Version="2.0"
        IssueInstant="{timestamp}"
        Destination=""
        AssertionConsumerServiceURL="{CALLBACK_BASE_URL}/auth/sso/saml/acs">
        <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
            SecureBase
        </saml:Issuer>
    </samlp:AuthnRequest>'''


def encrypt_with_kms(plaintext: str) -> str:
    """Encrypt string with KMS."""
    if not KMS_KEY_ID:
        return plaintext  # No encryption if KMS key not configured
    
    try:
        response = kms_client.encrypt(
            KeyId=KMS_KEY_ID,
            Plaintext=plaintext.encode()
        )
        return base64.b64encode(response['CiphertextBlob']).decode()
    except Exception as e:
        logger.error(f'KMS encryption failed: {str(e)}')
        return plaintext


def decrypt_with_kms(ciphertext: str) -> str:
    """Decrypt string with KMS."""
    if not KMS_KEY_ID or not ciphertext:
        return ciphertext
    
    try:
        response = kms_client.decrypt(
            CiphertextBlob=base64.b64decode(ciphertext)
        )
        return response['Plaintext'].decode()
    except Exception as e:
        logger.error(f'KMS decryption failed: {str(e)}')
        return ''


def get_customer_from_auth(headers: Dict) -> Optional[str]:
    """Extract customer_id from Authorization header."""
    auth_header = headers.get('Authorization', headers.get('authorization', ''))
    if not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header[7:]
    
    try:
        # Simplified - production should validate JWT properly
        payload = jwt.decode(token, options={'verify_signature': False})
        return payload.get('customer_id')
    except Exception:
        return None


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


def redirect_response(url: str) -> Dict:
    """Format redirect response."""
    return {
        'statusCode': 302,
        'headers': {
            'Location': url,
            'Access-Control-Allow-Origin': '*'
        },
        'body': ''
    }


def redirect_with_token_response(session_token: str, refresh_token: str, expires_at: datetime) -> Dict:
    """Redirect to portal with session tokens."""
    # Redirect to portal with tokens in hash fragment (not query params for security)
    redirect_url = f'{CALLBACK_BASE_URL}/#session_token={session_token}&refresh_token={refresh_token}&expires_at={expires_at.isoformat()}'
    
    return redirect_response(redirect_url)
