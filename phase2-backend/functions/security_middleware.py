"""
Security Middleware Lambda for SecureBase Phase 4.

Handles:
  - IP whitelisting validation
  - Device fingerprinting
  - Suspicious activity detection
  - Security event logging
  - Password validation

This Lambda acts as middleware for all authenticated requests.

Environment variables:
  - RDS_HOST: RDS Proxy endpoint
  - RDS_DATABASE: securebase
  - RDS_USER: securebase_app
  - RDS_PASSWORD: (from Secrets Manager)
  - SECURITY_SNS_TOPIC_ARN: SNS topic for security alerts
"""

import os
import sys
import json
import logging
import hashlib
import re
from typing import Dict, Optional, List, Tuple
from datetime import datetime
import ipaddress

import boto3
from botocore.exceptions import ClientError

# Import database utilities
sys.path.insert(0, '/opt/python')
from db_utils import get_connection, release_connection, DatabaseError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize AWS clients
sns_client = boto3.client('sns')

# Constants
SECURITY_SNS_TOPIC_ARN = os.environ.get('SECURITY_SNS_TOPIC_ARN', '')
MAX_FAILED_ATTEMPTS_THRESHOLD = 5
SUSPICIOUS_LOGIN_INTERVAL_MINUTES = 5  # Multiple logins from different countries
MAX_DISTANCE_KM = 1000  # Impossible travel distance


def lambda_handler(event, context):
    """
    Main Lambda handler for security middleware.
    
    Operations:
    - POST /security/validate-ip - Validate IP against whitelist
    - POST /security/check-device - Check device fingerprint
    - POST /security/validate-password - Validate password against policy
    - GET /security/events - Get security events
    - POST /security/ip-whitelist - Add IP to whitelist
    - DELETE /security/ip-whitelist/{id} - Remove IP from whitelist
    - GET /security/ip-whitelist - List whitelisted IPs
    """
    try:
        http_method = event.get('httpMethod')
        path = event.get('path', '')
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        path_params = event.get('pathParameters') or {}
        
        # Get client info
        headers = event.get('headers', {})
        source_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp')
        user_agent = headers.get('User-Agent', headers.get('user-agent', ''))
        
        # Route to handlers
        if http_method == 'POST' and path == '/security/validate-ip':
            return validate_ip(body, source_ip)
        
        elif http_method == 'POST' and path == '/security/check-device':
            return check_device_fingerprint(body, source_ip, user_agent)
        
        elif http_method == 'POST' and path == '/security/validate-password':
            return validate_password_endpoint(body, headers)
        
        elif http_method == 'GET' and path == '/security/events':
            return get_security_events(headers, event.get('queryStringParameters') or {})
        
        elif http_method == 'POST' and path == '/security/ip-whitelist':
            return add_ip_whitelist(body, headers)
        
        elif http_method == 'DELETE' and '/security/ip-whitelist/' in path:
            whitelist_id = path_params.get('id') or path.split('/')[-1]
            return remove_ip_whitelist(whitelist_id, headers)
        
        elif http_method == 'GET' and path == '/security/ip-whitelist':
            return list_ip_whitelist(headers)
        
        else:
            return error_response(404, f'Not found: {http_method} {path}')
    
    except Exception as e:
        logger.error(f'Error in security middleware: {str(e)}', exc_info=True)
        return error_response(500, f'Internal server error: {str(e)}')


def validate_ip(data: Dict, source_ip: str) -> Dict:
    """Validate IP address against customer whitelist."""
    customer_id = data.get('customer_id')
    ip_address = data.get('ip_address', source_ip)
    
    if not customer_id:
        return error_response(400, 'customer_id is required')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Use database function to check whitelist
        cursor.execute("""
            SELECT is_ip_whitelisted(%s, %s::inet)
        """, (customer_id, ip_address))
        
        is_whitelisted = cursor.fetchone()[0]
        
        if not is_whitelisted:
            # Log security event
            log_security_event_db(
                cursor, customer_id, 'suspicious_ip', 'high',
                f'Access attempt from non-whitelisted IP: {ip_address}',
                ip_address=ip_address
            )
            conn.commit()
            
            return error_response(403, 'IP address not whitelisted', {
                'ip_address': ip_address,
                'whitelisted': False
            })
        
        conn.commit()
        
        return success_response({
            'ip_address': ip_address,
            'whitelisted': True
        })
    
    except Exception as e:
        logger.error(f'Error validating IP: {str(e)}')
        return error_response(500, 'IP validation failed')
    
    finally:
        if conn:
            release_connection(conn)


def check_device_fingerprint(data: Dict, source_ip: str, user_agent: str) -> Dict:
    """Check device fingerprint and detect suspicious activity."""
    user_id = data.get('user_id')
    customer_id = data.get('customer_id')
    fingerprint = data.get('fingerprint')
    
    if not user_id or not customer_id or not fingerprint:
        return error_response(400, 'user_id, customer_id, and fingerprint are required')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        fingerprint_hash = hashlib.sha256(fingerprint.encode()).hexdigest()
        
        # Check if device is known
        cursor.execute("""
            SELECT id, trust_level, last_seen_at, country_code
            FROM device_fingerprints
            WHERE user_id = %s AND fingerprint_hash = %s
        """, (user_id, fingerprint_hash))
        
        device = cursor.fetchone()
        
        if device:
            # Known device - update last seen
            device_id = str(device[0])
            trust_level = device[1]
            last_seen = device[2]
            last_country = device[3]
            
            cursor.execute("""
                UPDATE device_fingerprints
                SET last_seen_at = CURRENT_TIMESTAMP,
                    total_logins = total_logins + 1,
                    ip_address = %s
                WHERE id = %s
            """, (source_ip, device_id))
            
            # Check for impossible travel (simplified)
            current_country = extract_country_from_ip(source_ip)
            if last_country and current_country and last_country != current_country:
                time_diff_minutes = (datetime.utcnow() - last_seen).total_seconds() / 60
                if time_diff_minutes < SUSPICIOUS_LOGIN_INTERVAL_MINUTES:
                    # Suspicious: different countries in short time
                    log_security_event_db(
                        cursor, customer_id, 'unusual_activity', 'medium',
                        f'User {user_id} logged in from {current_country} shortly after {last_country}',
                        user_id=user_id, ip_address=source_ip,
                        details={'previous_country': last_country, 'current_country': current_country}
                    )
                    
                    trust_level = 'suspicious'
                    cursor.execute("""
                        UPDATE device_fingerprints
                        SET trust_level = 'suspicious'
                        WHERE id = %s
                    """, (device_id,))
        else:
            # New device - create record
            platform = extract_platform_from_ua(user_agent)
            browser = extract_browser_from_ua(user_agent)
            country_code = extract_country_from_ip(source_ip)
            
            cursor.execute("""
                INSERT INTO device_fingerprints (
                    user_id, customer_id, fingerprint_hash,
                    user_agent, platform, browser,
                    ip_address, country_code,
                    trust_level, total_logins
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'unverified', 1)
                RETURNING id
            """, (
                user_id, customer_id, fingerprint_hash,
                user_agent, platform, browser,
                source_ip, country_code
            ))
            
            device_id = str(cursor.fetchone()[0])
            trust_level = 'unverified'
            
            # Log new device event
            log_security_event_db(
                cursor, customer_id, 'new_device', 'low',
                f'New device detected for user {user_id}',
                user_id=user_id, ip_address=source_ip,
                details={'platform': platform, 'browser': browser}
            )
        
        conn.commit()
        
        return success_response({
            'device_id': device_id,
            'trust_level': trust_level,
            'is_new_device': device is None,
            'requires_verification': trust_level in ['unverified', 'suspicious']
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error checking device: {str(e)}')
        return error_response(500, 'Device check failed')
    
    finally:
        if conn:
            release_connection(conn)


def validate_password_endpoint(data: Dict, headers: Dict) -> Dict:
    """Validate password against customer policy."""
    customer_id = get_customer_from_auth(headers)
    if not customer_id:
        return error_response(401, 'Unauthorized')
    
    password = data.get('password')
    user_id = data.get('user_id')
    
    if not password:
        return error_response(400, 'password is required')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Use database validation function
        cursor.execute("""
            SELECT is_valid, error_message
            FROM validate_password(%s, %s, %s)
        """, (customer_id, password, user_id))
        
        is_valid, error_message = cursor.fetchone()
        
        if not is_valid:
            return error_response(400, error_message)
        
        return success_response({
            'valid': True,
            'message': 'Password meets complexity requirements'
        })
    
    except Exception as e:
        logger.error(f'Error validating password: {str(e)}')
        return error_response(500, 'Password validation failed')
    
    finally:
        if conn:
            release_connection(conn)


def get_security_events(headers: Dict, query_params: Dict) -> Dict:
    """Get security events for customer."""
    customer_id = get_customer_from_auth(headers)
    if not customer_id:
        return error_response(401, 'Unauthorized')
    
    severity = query_params.get('severity')
    status = query_params.get('status')
    limit = int(query_params.get('limit', 100))
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Build query
        query = """
            SELECT 
                id, event_type, severity, status, description,
                user_id, user_email, ip_address, details,
                detected_at, resolved_at, alert_sent
            FROM security_events
            WHERE customer_id = %s
        """
        params = [customer_id]
        
        if severity:
            query += " AND severity = %s"
            params.append(severity)
        
        if status:
            query += " AND status = %s"
            params.append(status)
        
        query += " ORDER BY detected_at DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        
        events = []
        for row in cursor.fetchall():
            events.append({
                'id': str(row[0]),
                'event_type': row[1],
                'severity': row[2],
                'status': row[3],
                'description': row[4],
                'user_id': str(row[5]) if row[5] else None,
                'user_email': row[6],
                'ip_address': str(row[7]) if row[7] else None,
                'details': row[8],
                'detected_at': row[9].isoformat(),
                'resolved_at': row[10].isoformat() if row[10] else None,
                'alert_sent': row[11]
            })
        
        return success_response({'events': events})
    
    except Exception as e:
        logger.error(f'Error getting security events: {str(e)}')
        return error_response(500, 'Failed to get security events')
    
    finally:
        if conn:
            release_connection(conn)


def add_ip_whitelist(data: Dict, headers: Dict) -> Dict:
    """Add IP address or range to whitelist."""
    customer_id = get_customer_from_auth(headers)
    if not customer_id:
        return error_response(401, 'Unauthorized')
    
    ip_range = data.get('ip_range')
    description = data.get('description')
    expires_at = data.get('expires_at')
    
    if not ip_range:
        return error_response(400, 'ip_range is required')
    
    # Validate CIDR notation
    try:
        ipaddress.ip_network(ip_range, strict=False)
    except ValueError:
        return error_response(400, 'Invalid IP range (use CIDR notation, e.g., 192.168.1.0/24)')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get user_id from token
        user_id = get_user_from_auth(headers)
        
        cursor.execute("""
            INSERT INTO ip_whitelists (
                customer_id, ip_range, description, expires_at, created_by
            )
            VALUES (%s, %s::cidr, %s, %s, %s)
            RETURNING id
        """, (customer_id, ip_range, description, expires_at, user_id))
        
        whitelist_id = str(cursor.fetchone()[0])
        
        # Log activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, resource_type, resource_id
            )
            SELECT %s, %s, email, 'resource_created',
                   'Added IP whitelist: ' || %s,
                   'ip_whitelists', %s
            FROM users WHERE id = %s
        """, (customer_id, user_id, ip_range, whitelist_id, user_id))
        
        conn.commit()
        
        return success_response({
            'whitelist_id': whitelist_id,
            'message': 'IP whitelist added successfully'
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error adding IP whitelist: {str(e)}')
        return error_response(500, 'Failed to add IP whitelist')
    
    finally:
        if conn:
            release_connection(conn)


def remove_ip_whitelist(whitelist_id: str, headers: Dict) -> Dict:
    """Remove IP from whitelist."""
    customer_id = get_customer_from_auth(headers)
    if not customer_id:
        return error_response(401, 'Unauthorized')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE ip_whitelists
            SET status = 'disabled'
            WHERE id = %s AND customer_id = %s
            RETURNING ip_range
        """, (whitelist_id, customer_id))
        
        result = cursor.fetchone()
        if not result:
            return error_response(404, 'IP whitelist not found')
        
        conn.commit()
        
        return success_response({'message': 'IP whitelist removed'})
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error removing IP whitelist: {str(e)}')
        return error_response(500, 'Failed to remove IP whitelist')
    
    finally:
        if conn:
            release_connection(conn)


def list_ip_whitelist(headers: Dict) -> Dict:
    """List IP whitelists for customer."""
    customer_id = get_customer_from_auth(headers)
    if not customer_id:
        return error_response(401, 'Unauthorized')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                id, ip_range::text, description, status,
                expires_at, last_used_at, usage_count, created_at
            FROM ip_whitelists
            WHERE customer_id = %s AND status = 'active'
            ORDER BY created_at DESC
        """, (customer_id,))
        
        whitelists = []
        for row in cursor.fetchall():
            whitelists.append({
                'id': str(row[0]),
                'ip_range': row[1],
                'description': row[2],
                'status': row[3],
                'expires_at': row[4].isoformat() if row[4] else None,
                'last_used_at': row[5].isoformat() if row[5] else None,
                'usage_count': row[6],
                'created_at': row[7].isoformat()
            })
        
        return success_response({'whitelists': whitelists})
    
    except Exception as e:
        logger.error(f'Error listing IP whitelists: {str(e)}')
        return error_response(500, 'Failed to list IP whitelists')
    
    finally:
        if conn:
            release_connection(conn)


# ============================================
# Helper Functions
# ============================================

def log_security_event_db(cursor, customer_id: str, event_type: str, severity: str,
                          description: str, user_id: Optional[str] = None,
                          user_email: Optional[str] = None, ip_address: Optional[str] = None,
                          details: Optional[Dict] = None):
    """Log security event to database."""
    cursor.execute("""
        SELECT log_security_event(%s, %s, %s, %s, %s, %s, %s::inet, %s)
    """, (
        customer_id, event_type, severity, description,
        user_id, user_email, ip_address, json.dumps(details or {})
    ))
    
    event_id = cursor.fetchone()[0]
    
    # Send alert if high/critical
    if severity in ['high', 'critical'] and SECURITY_SNS_TOPIC_ARN:
        try:
            sns_client.publish(
                TopicArn=SECURITY_SNS_TOPIC_ARN,
                Subject=f'[{severity.upper()}] Security Alert: {event_type}',
                Message=json.dumps({
                    'event_id': str(event_id),
                    'customer_id': customer_id,
                    'event_type': event_type,
                    'severity': severity,
                    'description': description,
                    'user_id': user_id,
                    'ip_address': ip_address,
                    'details': details,
                    'timestamp': datetime.utcnow().isoformat()
                }, indent=2)
            )
            logger.info(f'Security alert sent for event {event_id}')
        except Exception as e:
            logger.error(f'Failed to send security alert: {str(e)}')
    
    return event_id


def extract_platform_from_ua(user_agent: str) -> str:
    """Extract platform from user agent string."""
    ua_lower = user_agent.lower()
    if 'windows' in ua_lower:
        return 'Windows'
    elif 'mac' in ua_lower or 'darwin' in ua_lower:
        return 'macOS'
    elif 'iphone' in ua_lower or 'ipad' in ua_lower:
        return 'iOS'
    elif 'android' in ua_lower:
        return 'Android'
    elif 'linux' in ua_lower:
        return 'Linux'
    return 'Unknown'


def extract_browser_from_ua(user_agent: str) -> str:
    """Extract browser from user agent string."""
    ua_lower = user_agent.lower()
    if 'chrome' in ua_lower and 'edg' not in ua_lower:
        return 'Chrome'
    elif 'safari' in ua_lower and 'chrome' not in ua_lower:
        return 'Safari'
    elif 'firefox' in ua_lower:
        return 'Firefox'
    elif 'edg' in ua_lower:
        return 'Edge'
    return 'Unknown'


def extract_country_from_ip(ip_address: str) -> Optional[str]:
    """Extract country code from IP address (simplified)."""
    # Production would use MaxMind GeoIP2 or similar
    # This is a placeholder
    return None


def get_customer_from_auth(headers: Dict) -> Optional[str]:
    """Extract customer_id from Authorization header."""
    import jwt
    auth_header = headers.get('Authorization', headers.get('authorization', ''))
    if not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header[7:]
    
    try:
        payload = jwt.decode(token, options={'verify_signature': False})
        return payload.get('customer_id')
    except Exception:
        return None


def get_user_from_auth(headers: Dict) -> Optional[str]:
    """Extract user_id from Authorization header."""
    import jwt
    auth_header = headers.get('Authorization', headers.get('authorization', ''))
    if not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header[7:]
    
    try:
        payload = jwt.decode(token, options={'verify_signature': False})
        return payload.get('user_id')
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


def error_response(status_code: int, message: str, extra_data: Optional[Dict] = None) -> Dict:
    """Format error response."""
    body = {'error': message}
    if extra_data:
        body.update(extra_data)
    
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps(body)
    }
