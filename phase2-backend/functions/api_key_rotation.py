"""
API Key Rotation Lambda for SecureBase Phase 4.

Handles automated API key rotation based on customer policies.
Runs daily via EventBridge schedule to check for keys needing rotation.

Environment variables:
  - RDS_HOST: RDS Proxy endpoint
  - RDS_DATABASE: securebase
  - RDS_USER: securebase_app
  - RDS_PASSWORD: (from Secrets Manager)
"""

import os
import sys
import json
import logging
import secrets
import hashlib
from typing import Dict, List, Tuple
from datetime import datetime, timedelta

import boto3
from botocore.exceptions import ClientError

# Import database utilities
sys.path.insert(0, '/opt/python')
from db_utils import get_connection, release_connection, DatabaseError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize AWS clients
ses_client = boto3.client('ses')

# Constants
ROTATION_FREQUENCY_DAYS = {
    '30_days': 30,
    '60_days': 60,
    '90_days': 90,
    '180_days': 180,
    '365_days': 365
}


def lambda_handler(event, context):
    """
    Main Lambda handler for API key rotation.
    
    Checks all customers with auto-rotation enabled and rotates keys
    that are due for rotation based on their policies.
    """
    try:
        logger.info('Starting API key rotation check')
        
        conn = None
        total_rotated = 0
        total_warned = 0
        
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            # Get all customers with auto-rotation enabled
            cursor.execute("""
                SELECT 
                    id, customer_id, rotation_frequency, rotation_warning_days,
                    old_key_grace_period_hours, notify_on_rotation,
                    notification_emails, last_rotation_at, next_rotation_at
                FROM api_key_rotation_policy
                WHERE auto_rotation_enabled = true
                    AND (next_rotation_at IS NULL OR next_rotation_at <= CURRENT_TIMESTAMP)
            """)
            
            policies = cursor.fetchall()
            
            logger.info(f'Found {len(policies)} customers with keys due for rotation')
            
            for policy in policies:
                policy_id = str(policy[0])
                customer_id = str(policy[1])
                rotation_freq = policy[2]
                warning_days = policy[3]
                grace_period_hours = policy[4]
                notify = policy[5]
                notification_emails = policy[6] or []
                
                # Rotate keys for this customer
                rotated_count, warned_count = rotate_customer_keys(
                    cursor, customer_id, rotation_freq, warning_days,
                    grace_period_hours, notify, notification_emails
                )
                
                total_rotated += rotated_count
                total_warned += warned_count
                
                # Update rotation policy
                frequency_days = ROTATION_FREQUENCY_DAYS.get(rotation_freq, 90)
                next_rotation = datetime.utcnow() + timedelta(days=frequency_days)
                
                cursor.execute("""
                    UPDATE api_key_rotation_policy
                    SET last_rotation_at = CURRENT_TIMESTAMP,
                        next_rotation_at = %s,
                        total_rotations = total_rotations + 1
                    WHERE id = %s
                """, (next_rotation, policy_id))
            
            conn.commit()
            
            logger.info(f'Rotation complete: {total_rotated} keys rotated, {total_warned} warnings sent')
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'customers_processed': len(policies),
                    'keys_rotated': total_rotated,
                    'warnings_sent': total_warned
                })
            }
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f'Error during rotation: {str(e)}', exc_info=True)
            raise
        
        finally:
            if conn:
                release_connection(conn)
    
    except Exception as e:
        logger.error(f'Error in API key rotation handler: {str(e)}', exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


def rotate_customer_keys(cursor, customer_id: str, rotation_freq: str,
                        warning_days: int, grace_period_hours: int,
                        notify: bool, notification_emails: List[str]) -> Tuple[int, int]:
    """Rotate API keys for a customer based on policy."""
    rotated_count = 0
    warned_count = 0
    
    frequency_days = ROTATION_FREQUENCY_DAYS.get(rotation_freq, 90)
    rotation_threshold = datetime.utcnow() - timedelta(days=frequency_days)
    warning_threshold = datetime.utcnow() + timedelta(days=warning_days)
    
    # Get keys that need rotation (active keys older than rotation frequency)
    cursor.execute("""
        SELECT id, key_prefix, created_at
        FROM api_keys
        WHERE customer_id = %s
            AND is_active = true
            AND created_at < %s
        ORDER BY created_at ASC
    """, (customer_id, rotation_threshold))
    
    keys_to_rotate = cursor.fetchall()
    
    for key in keys_to_rotate:
        key_id = str(key[0])
        key_prefix = key[1]
        created_at = key[2]
        
        # Generate new API key
        new_key = generate_api_key()
        new_key_hash = hashlib.sha256(new_key.encode()).hexdigest()
        new_key_prefix = new_key[:8]
        
        # Insert new key
        cursor.execute("""
            INSERT INTO api_keys (
                customer_id, key_hash, key_prefix, scopes,
                is_active, created_at
            )
            SELECT customer_id, %s, %s, scopes, true, CURRENT_TIMESTAMP
            FROM api_keys
            WHERE id = %s
            RETURNING id
        """, (new_key_hash, new_key_prefix, key_id))
        
        new_key_id = str(cursor.fetchone()[0])
        
        # Mark old key for grace period expiration
        grace_expires_at = datetime.utcnow() + timedelta(hours=grace_period_hours)
        
        cursor.execute("""
            UPDATE api_keys
            SET is_active = false,
                rotated_at = CURRENT_TIMESTAMP,
                rotated_to_key_id = %s,
                grace_period_expires_at = %s
            WHERE id = %s
        """, (new_key_id, grace_expires_at, key_id))
        
        # Log activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, activity_type, description,
                resource_type, resource_id
            )
            VALUES (%s, 'api_key_rotated', %s, 'api_keys', %s)
        """, (
            customer_id,
            f'API key {key_prefix}... automatically rotated (new: {new_key_prefix}..., grace period: {grace_period_hours}h)',
            new_key_id
        ))
        
        # Send notification if enabled
        if notify and notification_emails:
            send_rotation_notification(
                customer_id, notification_emails, key_prefix,
                new_key_prefix, new_key, grace_period_hours
            )
        
        rotated_count += 1
        logger.info(f'Rotated key {key_id} for customer {customer_id}')
    
    # Check for keys approaching rotation (send warnings)
    cursor.execute("""
        SELECT id, key_prefix, created_at
        FROM api_keys
        WHERE customer_id = %s
            AND is_active = true
            AND created_at < %s
            AND created_at >= %s
            AND rotation_warning_sent = false
    """, (customer_id, warning_threshold, rotation_threshold))
    
    keys_to_warn = cursor.fetchall()
    
    for key in keys_to_warn:
        key_id = str(key[0])
        key_prefix = key[1]
        created_at = key[2]
        
        days_until_rotation = (created_at + timedelta(days=frequency_days) - datetime.utcnow()).days
        
        if notify and notification_emails:
            send_warning_notification(
                customer_id, notification_emails, key_prefix, days_until_rotation
            )
        
        # Mark warning as sent
        cursor.execute("""
            UPDATE api_keys
            SET rotation_warning_sent = true,
                rotation_warning_sent_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (key_id,))
        
        warned_count += 1
    
    return rotated_count, warned_count


def generate_api_key() -> str:
    """Generate a new API key with 'sb_' prefix."""
    # Generate 32 random bytes (256 bits)
    random_bytes = secrets.token_bytes(32)
    # Encode as base64 (URL-safe)
    key = secrets.token_urlsafe(32)
    # Add SecureBase prefix
    return f'sb_{key}'


def send_rotation_notification(customer_id: str, emails: List[str], old_prefix: str,
                               new_prefix: str, new_key: str, grace_hours: int):
    """Send email notification about rotated API key."""
    subject = f'[SecureBase] API Key Rotated - Action Required'
    
    body_html = f"""
    <html>
    <head></head>
    <body>
        <h2>API Key Rotation Notice</h2>
        <p>Your SecureBase API key has been automatically rotated as per your rotation policy.</p>
        
        <h3>Details:</h3>
        <ul>
            <li><strong>Old Key:</strong> {old_prefix}... (will expire in {grace_hours} hours)</li>
            <li><strong>New Key:</strong> {new_key}</li>
        </ul>
        
        <h3>Action Required:</h3>
        <p>Please update your applications to use the new API key within the next {grace_hours} hours.</p>
        <p>The old key will continue to work during this grace period, but will be fully disabled after {grace_hours} hours.</p>
        
        <h3>Security Best Practices:</h3>
        <ul>
            <li>Store the new key securely (e.g., in environment variables or a secrets manager)</li>
            <li>Never commit API keys to source control</li>
            <li>Rotate keys regularly (current policy: automated rotation enabled)</li>
        </ul>
        
        <p>If you did not expect this rotation or have questions, please contact support immediately.</p>
        
        <p>Best regards,<br>SecureBase Security Team</p>
    </body>
    </html>
    """
    
    body_text = f"""
    API Key Rotation Notice
    
    Your SecureBase API key has been automatically rotated as per your rotation policy.
    
    Details:
    - Old Key: {old_prefix}... (will expire in {grace_hours} hours)
    - New Key: {new_key}
    
    Action Required:
    Please update your applications to use the new API key within the next {grace_hours} hours.
    The old key will continue to work during this grace period, but will be fully disabled after {grace_hours} hours.
    
    If you did not expect this rotation or have questions, please contact support immediately.
    
    Best regards,
    SecureBase Security Team
    """
    
    try:
        for email in emails:
            ses_client.send_email(
                Source='noreply@securebase.com',
                Destination={'ToAddresses': [email]},
                Message={
                    'Subject': {'Data': subject},
                    'Body': {
                        'Text': {'Data': body_text},
                        'Html': {'Data': body_html}
                    }
                }
            )
        logger.info(f'Sent rotation notification to {len(emails)} recipients for customer {customer_id}')
    except ClientError as e:
        logger.error(f'Failed to send rotation notification: {str(e)}')


def send_warning_notification(customer_id: str, emails: List[str], key_prefix: str, days_remaining: int):
    """Send email warning about upcoming API key rotation."""
    subject = f'[SecureBase] API Key Rotation in {days_remaining} Days'
    
    body_html = f"""
    <html>
    <head></head>
    <body>
        <h2>API Key Rotation Reminder</h2>
        <p>This is a reminder that your SecureBase API key will be automatically rotated in {days_remaining} days.</p>
        
        <h3>Details:</h3>
        <ul>
            <li><strong>Current Key:</strong> {key_prefix}...</li>
            <li><strong>Days Until Rotation:</strong> {days_remaining}</li>
        </ul>
        
        <h3>What to Expect:</h3>
        <p>When the rotation occurs:</p>
        <ul>
            <li>You will receive a new API key via email</li>
            <li>Your current key will remain active for a grace period (typically 24 hours)</li>
            <li>You should update your applications to use the new key during this grace period</li>
        </ul>
        
        <p>No action is required at this time. This is just a courtesy reminder.</p>
        
        <p>Best regards,<br>SecureBase Security Team</p>
    </body>
    </html>
    """
    
    body_text = f"""
    API Key Rotation Reminder
    
    This is a reminder that your SecureBase API key will be automatically rotated in {days_remaining} days.
    
    Details:
    - Current Key: {key_prefix}...
    - Days Until Rotation: {days_remaining}
    
    What to Expect:
    When the rotation occurs, you will receive a new API key via email. Your current key will remain 
    active for a grace period (typically 24 hours) during which you should update your applications.
    
    No action is required at this time. This is just a courtesy reminder.
    
    Best regards,
    SecureBase Security Team
    """
    
    try:
        for email in emails:
            ses_client.send_email(
                Source='noreply@securebase.com',
                Destination={'ToAddresses': [email]},
                Message={
                    'Subject': {'Data': subject},
                    'Body': {
                        'Text': {'Data': body_text},
                        'Html': {'Data': body_html}
                    }
                }
            )
        logger.info(f'Sent rotation warning to {len(emails)} recipients for customer {customer_id}')
    except ClientError as e:
        logger.error(f'Failed to send rotation warning: {str(e)}')
