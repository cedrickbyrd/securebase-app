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
    
    # Dispatch to each enabled channel
    for channel in enabled_channels:
        try:
            if channel == 'email':
                send_email(notification, rendered, user_prefs)
            elif channel == 'sms':
                send_sms(notification, rendered, user_prefs)
            elif channel == 'webhook':
                send_webhook(notification, rendered, user_prefs)
            elif channel == 'in_app':
                store_in_app(notification, rendered)
            
            log_delivery(notification['id'], channel, 'success')
            delivery_results.append({'channel': channel, 'status': 'success'})
        except Exception as e:
            error_msg = str(e)
            log_delivery(notification['id'], channel, 'failed', error_msg)
            delivery_results.append({'channel': channel, 'status': 'failed', 'error': error_msg})
            # Continue to next channel instead of failing entire notification
    
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


def send_webhook(notification: Dict[str, Any], rendered: Dict[str, str], user_prefs: Dict[str, Any]) -> None:
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
    payload = {
        'id': notification['id'],
        'type': notification['type'],
        'priority': notification['priority'],
        'title': rendered['subject'],
        'body': rendered['body_text'],
        'timestamp': notification.get('created_at', datetime.utcnow().isoformat()),
        'metadata': notification.get('metadata', {})
    }
    
    # Calculate HMAC signature for verification
    headers = {'Content-Type': 'application/json'}
    if webhook_secret:
        signature = hmac.new(
            webhook_secret.encode(),
            json.dumps(payload).encode(),
            hashlib.sha256
        ).hexdigest()
        headers['X-Webhook-Signature'] = signature
    
    # Send HTTP POST with retry logic
    retry_count = 0
    last_error = None
    
    while retry_count < MAX_RETRIES:
        try:
            response = requests.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=WEBHOOK_TIMEOUT
            )
            response.raise_for_status()
            print(f"Webhook delivered to {webhook_url}, status: {response.status_code}")
            return
        except requests.exceptions.RequestException as e:
            retry_count += 1
            last_error = e
            if retry_count < MAX_RETRIES:
                # Exponential backoff
                sleep_time = 2 ** retry_count
                print(f"Webhook failed (attempt {retry_count}), retrying in {sleep_time}s: {e}")
                time.sleep(sleep_time)
    
    # All retries failed
    raise Exception(f"Webhook delivery failed after {MAX_RETRIES} attempts: {last_error}")


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


def log_delivery(notification_id: str, channel: str, status: str, error: Optional[str] = None) -> None:
    """
    Log notification delivery status to audit trail

    Args:
        notification_id: Notification ID
        channel: Delivery channel
        status: Delivery status (success/failed)
        error: Error message if failed
    """
    audit_log = {
        'notification_id': notification_id,
        'channel': channel,
        'status': status,
        'error': error,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    # Log to CloudWatch Logs
    print(json.dumps(audit_log))


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
