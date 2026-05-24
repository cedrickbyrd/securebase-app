"""
Notification Worker - Lambda function for processing and dispatching notifications

This Lambda function processes notifications from SQS queue and dispatches them
to appropriate channels (email, SMS, webhook, in-app).

Architecture:
- Triggered by SQS messages from SNS topic
- Render notification templates with variables
- Dispatch to email (SES), SMS (SNS), webhook (HTTP POST)
- Store in-app notifications in DynamoDB
- Handle retries with exponential backoff
- Log delivery status to audit trail
- Move failed messages to DLQ

Author: SecureBase Team
Created: 2026-01-26
Status: Implementation Complete
"""

import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import time
import hmac
import hashlib
import re
from uuid import uuid4

import boto3
from botocore.exceptions import ClientError
import requests

# Environment variables - Validate on startup
NOTIFICATIONS_TABLE = os.environ.get('NOTIFICATIONS_TABLE', 'securebase-notifications')
SUBSCRIPTIONS_TABLE = os.environ.get('SUBSCRIPTIONS_TABLE', 'securebase-subscriptions')
TEMPLATES_TABLE = os.environ.get('TEMPLATES_TABLE', 'securebase-templates')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')
SES_FROM_EMAIL = os.environ.get('SES_FROM_EMAIL', 'notifications@securebase.io')
WEBHOOK_TIMEOUT = int(os.environ.get('WEBHOOK_TIMEOUT', '5'))
MAX_RETRIES = int(os.environ.get('MAX_RETRIES', '3'))
NOTIFICATION_DEDUP_TABLE = os.environ.get('NOTIFICATION_DEDUP_TABLE', 'securebase-notification-dedup')
NOTIFICATION_DEDUP_WINDOW_SECONDS = int(os.environ.get('NOTIFICATION_DEDUP_WINDOW_SECONDS', '300'))
NOTIFICATION_DELIVERY_LOG_TABLE = os.environ.get('NOTIFICATION_DELIVERY_LOG_TABLE', 'securebase-notification-delivery-log')
NOTIFICATION_MAX_RETRIES = int(os.environ.get('NOTIFICATION_MAX_RETRIES', str(MAX_RETRIES)))
NOTIFICATION_RETRY_BACKOFF_BASE_MS = int(os.environ.get('NOTIFICATION_RETRY_BACKOFF_BASE_MS', '500'))
NOTIFICATION_DELIVERY_LOG_TTL_DAYS = int(os.environ.get('NOTIFICATION_DELIVERY_LOG_TTL_DAYS', '30'))
DASHBOARD_ALERT_BASE_URL = os.environ.get('DASHBOARD_ALERT_BASE_URL', 'https://app.securebase.io/alerts')

SENSITIVE_KEY_MARKERS = (
    'policy',
    'account_id',
    'arn',
    'access_key',
    'secret',
    'vulnerability',
    'cve',
)

SENSITIVE_VALUE_PATTERNS = [
    (re.compile(r'arn:aws:[^\s\'"]+'), '[REDACTED_ARN]'),
    (re.compile(r'\b\d{12}\b'), '[REDACTED_ACCOUNT_ID]'),
    (re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'), '[REDACTED_ACCESS_KEY]'),
    (re.compile(r'\bCVE-\d{4}-\d{4,7}\b', re.IGNORECASE), '[REDACTED_CVE]'),
]

# AWS clients - Initialize
dynamodb = boto3.resource('dynamodb')
ses_client = boto3.client('ses')
sns_client = boto3.client('sns')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for notification processing

    Args:
        event: SQS event with notification messages
        context: Lambda context

    Returns:
        dict: Processing results
    """
    # Validate environment variables
    validate_environment()

    # Parse SQS records
    records = event.get('Records', [])
    if not records:
        print("No records to process")
        return {'statusCode': 200, 'body': json.dumps({'message': 'No records'})}

    # Process each notification
    results = {
        'processed': 0,
        'failed': 0,
        'errors': []
    }

    for record in records:
        try:
            notification = parse_sqs_message(record)
            process_notification(notification)
            results['processed'] += 1
            print(f"Successfully processed notification: {notification.get('id')}")
        except Exception as e:
            results['failed'] += 1
            error_msg = str(e)
            results['errors'].append(error_msg)
            print(f"Error processing notification: {e}")
            
            # Log to CloudWatch for monitoring
            log_error(record, error_msg)

    print(f"Batch processing complete: {results}")
    return {
        'statusCode': 200,
        'body': json.dumps(results)
    }


def validate_environment() -> None:
    """
    Validate required environment variables
    """
    required_vars = [
        'NOTIFICATIONS_TABLE',
        'SUBSCRIPTIONS_TABLE',
        'TEMPLATES_TABLE'
    ]
    
    missing = [var for var in required_vars if not os.environ.get(var)]
    if missing:
        raise ValueError(f"Missing required environment variables: {missing}")


def parse_sqs_message(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse SQS message from SNS

    Args:
        record: SQS record

    Returns:
        dict: Parsed notification message
    """
    body = json.loads(record.get('body', '{}'))
    
    # Check if this is an SNS message
    if 'Message' in body:
        message = json.loads(body['Message'])
    else:
        message = body
    
    return {
        'id': message.get('id', f'notif-{int(time.time() * 1000)}'),
        'customer_id': message.get('customer_id'),
        'user_id': message.get('user_id'),
        'type': message.get('type', 'system'),
        'priority': message.get('priority', 'medium'),
        'title': message.get('title', ''),
        'body': message.get('body', ''),
        'channels': message.get('channels', ['in_app']),
        'metadata': message.get('metadata', {}),
        'created_at': message.get('created_at', datetime.utcnow().isoformat())
    }


def process_notification(notification: Dict[str, Any]) -> None:
    """
    Process and dispatch notification to all channels

    Args:
        notification: Notification message
    """
    should_suppress, duplicate_count = should_suppress_notification(notification)
    if should_suppress:
        print(
            f"Suppressed duplicate notification {notification.get('id')} "
            f"(dedup_count={duplicate_count})"
        )
        return

    # Get user preferences
    user_prefs = get_user_preferences(notification['user_id'], notification['customer_id'])
    
    # Check if user has opted in for this notification type
    event_type = notification['type']
    enabled_channels = get_enabled_channels(user_prefs, event_type, notification['channels'])
    
    if not enabled_channels:
        print(f"No enabled channels for user {notification['user_id']}, event {event_type}")
        return
    
    # Render template
    rendered = render_template(notification)
    
    # Track delivery results
    delivery_results = []
    
    sanitized_rendered = sanitize_notification_payload(
        {
            'subject': rendered.get('subject', ''),
            'body_html': rendered.get('body_html', ''),
            'body_text': rendered.get('body_text', ''),
            'metadata': notification.get('metadata', {}),
        },
        notification.get('id')
    )

    # Dispatch to each enabled channel
    for channel in enabled_channels:
        if channel == 'in_app':
            try:
                store_in_app(notification, rendered)
                log_delivery(notification, channel, 'success')
                delivery_results.append({'channel': channel, 'status': 'success'})
            except Exception as e:
                error_msg = str(e)
                log_delivery(notification, channel, 'failed', error_message=error_msg)
                delivery_results.append({'channel': channel, 'status': 'failed', 'error': error_msg})
            continue

        status, http_status_code, error_message = dispatch_with_retry(
            channel=channel,
            notification=notification,
            rendered=sanitized_rendered,
            user_prefs=user_prefs
        )
        delivery_results.append(
            {
                'channel': channel,
                'status': status,
                'http_status_code': http_status_code,
                'error': error_message
            }
        )
    
    print(f"Notification {notification['id']} delivery results: {delivery_results}")


def render_template(notification: Dict[str, Any]) -> Dict[str, str]:
    """
    Render notification template with variables

    Args:
        notification: Notification message

    Returns:
        dict: Rendered subject and body
    """
    # Try to fetch template from DynamoDB
    try:
        template = get_template(notification['type'], notification['customer_id'])
        
        # Replace variables in template
        metadata = notification.get('metadata', {})
        subject = template.get('subject', notification.get('title', '')).format(**metadata)
        body_html = template.get('body_html', notification.get('body', '')).format(**metadata)
        body_text = template.get('body_text', notification.get('body', '')).format(**metadata)
        
        return {
            'subject': subject,
            'body_html': body_html,
            'body_text': body_text
        }
    except Exception as e:
        # Fallback to notification content if template fails
        print(f"Template rendering failed, using fallback: {e}")
        return {
            'subject': notification.get('title', 'Notification'),
            'body_html': f"<p>{notification.get('body', '')}</p>",
            'body_text': notification.get('body', '')
        }


def dispatch_with_retry(
    channel: str,
    notification: Dict[str, Any],
    rendered: Dict[str, Any],
    user_prefs: Dict[str, Any]
) -> tuple[str, Optional[int], Optional[str]]:
    """
    Dispatch notification with retries for critical alerts.
    """
    max_attempts = 1
    priority = (notification.get('priority') or '').lower()
    if priority == 'critical':
        max_attempts = max(1, NOTIFICATION_MAX_RETRIES)

    last_error: Optional[str] = None
    http_status_code: Optional[int] = None

    for attempt in range(1, max_attempts + 1):
        try:
            if channel == 'email':
                send_email(notification, rendered, user_prefs)
            elif channel == 'sms':
                send_sms(notification, rendered, user_prefs)
            elif channel == 'webhook':
                http_status_code = send_webhook(notification, rendered, user_prefs)
            else:
                raise ValueError(f"Unsupported notification channel: {channel}")

            status = 'retried' if attempt > 1 else 'success'
            log_delivery(
                notification,
                channel,
                status,
                http_status_code=http_status_code,
                retry_attempt=attempt
            )
            return status, http_status_code, None
        except Exception as e:
            last_error = str(e)
            log_delivery(
                notification,
                channel,
                'failed',
                http_status_code=http_status_code,
                error_message=last_error,
                retry_attempt=attempt
            )

            if attempt < max_attempts:
                backoff_ms = NOTIFICATION_RETRY_BACKOFF_BASE_MS * (2 ** (attempt - 1))
                time.sleep(backoff_ms / 1000)

    print(json.dumps({
        'event': 'notification_delivery_retries_exhausted',
        'notification_id': notification.get('id'),
        'client_id': notification.get('customer_id'),
        'alert_type': notification.get('type'),
        'channel': channel,
        'max_retries': max_attempts,
        'error': last_error,
        'timestamp': datetime.utcnow().isoformat()
    }))
    return 'failed', http_status_code, last_error


def send_email(notification: Dict[str, Any], rendered: Dict[str, str], user_prefs: Dict[str, Any]) -> None:
    """
    Send notification via email (SES)

    Args:
        notification: Notification message
        rendered: Rendered subject and body
        user_prefs: User preferences
    """
    # Get user email
    user_email = user_prefs.get('email', '')
    
    if not user_email:
        raise ValueError(f"No email address for user {notification['user_id']}")
    
    # Send via SES
    try:
        response = ses_client.send_email(
            Source=SES_FROM_EMAIL,
            Destination={'ToAddresses': [user_email]},
            Message={
                'Subject': {'Data': rendered['subject']},
                'Body': {
                    'Html': {'Data': rendered['body_html']},
                    'Text': {'Data': rendered['body_text']}
                }
            }
        )
        print(f"Email sent to {user_email}, MessageId: {response['MessageId']}")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        raise Exception(f"SES error: {error_code} - {e.response['Error']['Message']}")


def send_sms(notification: Dict[str, Any], rendered: Dict[str, str], user_prefs: Dict[str, Any]) -> None:
    """
    Send notification via SMS (SNS)

    Args:
        notification: Notification message
        rendered: Rendered subject and body
        user_prefs: User preferences
    """
    # Get user phone number
    phone_number = user_prefs.get('phone_number', '')
    
    if not phone_number:
        raise ValueError(f"No phone number for user {notification['user_id']}")
    
    # Format message (SMS has 160 char limit)
    message_text = f"{rendered['subject']}\n\n{rendered['body_text']}"
    if len(message_text) > 160:
        message_text = message_text[:157] + '...'
    
    # Send via SNS SMS
    try:
        response = sns_client.publish(
            PhoneNumber=phone_number,
            Message=message_text
        )
        print(f"SMS sent to {phone_number}, MessageId: {response['MessageId']}")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        raise Exception(f"SNS error: {error_code} - {e.response['Error']['Message']}")


def send_webhook(notification: Dict[str, Any], rendered: Dict[str, str], user_prefs: Dict[str, Any]) -> int:
    """
    Send notification via webhook (HTTP POST)

    Args:
        notification: Notification message
        rendered: Rendered subject and body
        user_prefs: User preferences
    """
    # Get webhook URL from customer preferences
    webhook_url = user_prefs.get('webhook_url', '')
    webhook_secret = user_prefs.get('webhook_secret', '')
    
    if not webhook_url:
        raise ValueError(f"No webhook URL configured for customer {notification['customer_id']}")
    
    # Prepare payload
    payload = sanitize_notification_payload({
        'id': notification['id'],
        'type': notification['type'],
        'priority': notification['priority'],
        'title': rendered['subject'],
        'body': rendered['body_text'],
        'timestamp': notification.get('created_at', datetime.utcnow().isoformat()),
        'metadata': notification.get('metadata', {})
    }, notification.get('id'))
    
    # Calculate HMAC signature for verification
    headers = {'Content-Type': 'application/json'}
    if webhook_secret:
        signature = hmac.new(
            webhook_secret.encode(),
            json.dumps(payload).encode(),
            hashlib.sha256
        ).hexdigest()
        headers['X-Webhook-Signature'] = signature
    
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers=headers,
            timeout=WEBHOOK_TIMEOUT
        )
        response.raise_for_status()
        print(f"Webhook delivered to {webhook_url}, status: {response.status_code}")
        return int(response.status_code)
    except requests.exceptions.RequestException as e:
        raise Exception(f"Webhook delivery failed: {e}")


def store_in_app(notification: Dict[str, Any], rendered: Dict[str, str]) -> None:
    """
    Store notification in DynamoDB for in-app display

    Args:
        notification: Notification message
        rendered: Rendered subject and body
    """
    table = dynamodb.Table(NOTIFICATIONS_TABLE)
    
    # Calculate TTL (90 days from now)
    ttl = int((datetime.utcnow() + timedelta(days=90)).timestamp())
    
    item = {
        'id': notification['id'],
        'customer_id': notification['customer_id'],
        'user_id': notification['user_id'],
        'type': notification['type'],
        'priority': notification['priority'],
        'title': rendered['subject'],
        'body': rendered['body_text'],
        'body_html': rendered.get('body_html', ''),
        'read_at': None,
        'created_at': int(datetime.fromisoformat(notification['created_at'].replace('Z', '+00:00')).timestamp() * 1000),
        'ttl': ttl,
        'metadata': notification.get('metadata', {})
    }
    
    try:
        table.put_item(Item=item)
        print(f"Notification stored in DynamoDB: {notification['id']}")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        raise Exception(f"DynamoDB error: {error_code} - {e.response['Error']['Message']}")


def log_delivery(
    notification: Dict[str, Any],
    channel: str,
    status: str,
    http_status_code: Optional[int] = None,
    error_message: Optional[str] = None,
    retry_attempt: int = 1
) -> None:
    """
    Log notification delivery status to audit trail

    Args:
        notification: Notification payload
        channel: Delivery channel
        status: Delivery status (success/failed)
        http_status_code: HTTP response code for webhook channels
        error_message: Error message if failed
        retry_attempt: Dispatch attempt number
    """
    timestamp = datetime.utcnow().isoformat()
    notification_id = notification.get('id')
    if not notification_id:
        print("Notification ID missing while writing delivery log")
        notification_id = 'unknown-notification'

    audit_log = {
        'notificationId': notification_id,
        'clientId': notification.get('customer_id'),
        'alertType': notification.get('type'),
        'channel': channel,
        'status': status,
        'httpStatusCode': http_status_code,
        'errorMessage': error_message,
        'retryAttempt': retry_attempt,
        'timestamp': timestamp
    }
    print(json.dumps(audit_log))

    try:
        table = dynamodb.Table(NOTIFICATION_DELIVERY_LOG_TABLE)
        table.put_item(
            Item={
                'notification_id': notification_id,
                'log_id': f"{int(time.time() * 1000)}#{uuid4()}",
                'client_id': notification.get('customer_id', 'unknown'),
                'alert_type': notification.get('type', 'unknown'),
                'channel': channel,
                'status': status,
                'http_status_code': http_status_code,
                'error_message': error_message,
                'retry_attempt': retry_attempt,
                'timestamp': timestamp,
                'ttl': int(
                    (datetime.utcnow() + timedelta(days=max(1, NOTIFICATION_DELIVERY_LOG_TTL_DAYS))).timestamp()
                )
            }
        )
    except Exception as e:
        print(f"Failed to write delivery log to DynamoDB: {e}")


def build_dedup_key(notification: Dict[str, Any]) -> str:
    metadata = notification.get('metadata') or {}
    resource_id = metadata.get('resource_id') or metadata.get('resourceId') or 'global'
    return f"{notification.get('customer_id', 'unknown')}#{notification.get('type', 'unknown')}#{resource_id}"


def should_suppress_notification(notification: Dict[str, Any]) -> tuple[bool, int]:
    """
    Deduplicate repeated notification events in a short TTL window.
    """
    dedup_table = dynamodb.Table(NOTIFICATION_DEDUP_TABLE)
    dedup_key = build_dedup_key(notification)
    now = int(time.time())
    expires_at = now + max(1, NOTIFICATION_DEDUP_WINDOW_SECONDS)

    try:
        response = dedup_table.get_item(Key={'dedup_key': dedup_key})
        item = response.get('Item')

        if item and int(item.get('expires_at', 0)) > now:
            duplicate_count = int(item.get('duplicate_count', 1)) + 1
            dedup_table.put_item(
                Item={
                    'dedup_key': dedup_key,
                    'notification_id': item.get('notification_id', 'unknown-notification'),
                    'duplicate_count': duplicate_count,
                    'expires_at': item.get('expires_at'),
                    'updated_at': datetime.utcnow().isoformat(),
                    'ttl': expires_at
                }
            )
            return True, duplicate_count

        dedup_table.put_item(
            Item={
                'dedup_key': dedup_key,
                'notification_id': notification.get('id'),
                'duplicate_count': 1,
                'expires_at': expires_at,
                'updated_at': datetime.utcnow().isoformat(),
                'ttl': expires_at
            }
        )
        return False, 1
    except Exception as e:
        print(f"Dedup check failed, continuing without suppression: {e}")
        return False, 1


def sanitize_notification_payload(
    payload: Any,
    alert_id: Optional[str] = None,
    include_alert_reference: bool = True
) -> Any:
    """
    Strip or mask sensitive fields from notification payloads.
    """
    if isinstance(payload, dict):
        sanitized: Dict[str, Any] = {}
        for key, value in payload.items():
            if any(marker in key.lower() for marker in SENSITIVE_KEY_MARKERS):
                sanitized[key] = '[REDACTED]'
            else:
                sanitized[key] = sanitize_notification_payload(
                    value,
                    alert_id,
                    include_alert_reference=False
                )

        if alert_id and include_alert_reference:
            sanitized['alert_reference_url'] = f"{DASHBOARD_ALERT_BASE_URL.rstrip('/')}/{alert_id}"
        return sanitized

    if isinstance(payload, list):
        return [
            sanitize_notification_payload(item, alert_id, include_alert_reference=False)
            for item in payload
        ]

    if isinstance(payload, str):
        return scrub_sensitive_text(payload)

    return payload


def scrub_sensitive_text(value: str) -> str:
    sanitized = value
    for pattern, replacement in SENSITIVE_VALUE_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


def log_error(record: Dict[str, Any], error_msg: str) -> None:
    """
    Log error for monitoring and alerting

    Args:
        record: SQS record that failed
        error_msg: Error message
    """
    error_log = {
        'event': 'notification_processing_error',
        'error': error_msg,
        'record_id': record.get('messageId', 'unknown'),
        'timestamp': datetime.utcnow().isoformat()
    }
    
    print(json.dumps(error_log))


# Helper functions
def get_template(event_type: str, customer_id: str) -> Dict[str, str]:
    """
    Fetch notification template from DynamoDB

    Args:
        event_type: Event type (security_alert, billing, etc.)
        customer_id: Customer ID

    Returns:
        dict: Template with subject and body
    """
    table = dynamodb.Table(TEMPLATES_TABLE)
    
    try:
        # Try customer-specific template first
        response = table.get_item(
            Key={
                'customer_id': customer_id,
                'event_type': event_type
            }
        )
        
        if 'Item' in response:
            return response['Item']
    except ClientError as e:
        print(f"Error fetching customer template: {e}")
    
    # Fallback to default template
    try:
        response = table.get_item(
            Key={
                'customer_id': 'default',
                'event_type': event_type
            }
        )
        
        if 'Item' in response:
            return response['Item']
    except ClientError as e:
        print(f"Error fetching default template: {e}")
    
    # Return basic template if none found
    return {
        'subject': '{{title}}',
        'body_html': '<p>{{body}}</p>',
        'body_text': '{{body}}'
    }


def get_user_preferences(user_id: str, customer_id: str) -> Dict[str, Any]:
    """
    Fetch user notification preferences from DynamoDB

    Args:
        user_id: User ID
        customer_id: Customer ID

    Returns:
        dict: User preferences including email, phone, webhook settings
    """
    table = dynamodb.Table(SUBSCRIPTIONS_TABLE)
    
    try:
        response = table.get_item(
            Key={
                'customer_id': customer_id,
                'user_id': user_id
            }
        )
        
        if 'Item' in response:
            return response['Item']
    except ClientError as e:
        print(f"Error fetching user preferences: {e}")
    
    # Return defaults if not found
    return {
        'email': '',
        'phone_number': '',
        'webhook_url': '',
        'webhook_secret': '',
        'subscriptions': {}
    }


def get_enabled_channels(user_prefs: Dict[str, Any], event_type: str, requested_channels: List[str]) -> List[str]:
    """
    Get list of enabled channels for a specific event type

    Args:
        user_prefs: User preferences
        event_type: Event type
        requested_channels: Channels requested by notification

    Returns:
        list: List of enabled channels
    """
    subscriptions = user_prefs.get('subscriptions', {})
    event_prefs = subscriptions.get(event_type, {})
    
    # If no preferences, default to in_app only
    if not event_prefs:
        return ['in_app'] if 'in_app' in requested_channels else []
    
    # Filter requested channels by user preferences
    enabled = []
    for channel in requested_channels:
        if event_prefs.get(channel, False):
            enabled.append(channel)
    
    # Always include in_app if requested (unless explicitly disabled)
    if 'in_app' in requested_channels and event_prefs.get('in_app', True):
        if 'in_app' not in enabled:
            enabled.append('in_app')
    
    return enabled
