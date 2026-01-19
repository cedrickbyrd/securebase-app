"""
SecureBase Webhook Manager
Handles webhook registration, delivery, and retry logic
"""

import json
import hmac
import hashlib
import time
import os
from datetime import datetime, timedelta
from uuid import uuid4
import boto3
from botocore.exceptions import ClientError
import requests

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

WEBHOOKS_TABLE = os.environ['WEBHOOKS_TABLE']
DELIVERIES_TABLE = os.environ['DELIVERIES_TABLE']
WEBHOOK_SECRET_KEY = os.environ.get('WEBHOOK_SECRET_KEY', 'change-me-in-production')

# Retry configuration
MAX_RETRIES = 5
RETRY_DELAYS = [60, 300, 900, 3600, 7200]  # 1m, 5m, 15m, 1h, 2h

def lambda_handler(event, context):
    """Main Lambda handler for webhook operations"""
    
    http_method = event.get('httpMethod', 'POST')
    path = event.get('path', '')
    customer_id = event['requestContext']['authorizer'].get('customerId')
    
    # Route to appropriate handler
    if path.endswith('/webhooks') and http_method == 'GET':
        return list_webhooks(customer_id)
    elif path.endswith('/webhooks') and http_method == 'POST':
        body = json.loads(event['body'])
        return create_webhook(customer_id, body)
    elif '/webhooks/' in path and http_method == 'GET':
        webhook_id = path.split('/')[-1]
        return get_webhook(customer_id, webhook_id)
    elif '/webhooks/' in path and http_method == 'PUT':
        webhook_id = path.split('/')[-1]
        body = json.loads(event['body'])
        return update_webhook(customer_id, webhook_id, body)
    elif '/webhooks/' in path and http_method == 'DELETE':
        webhook_id = path.split('/')[-1]
        return delete_webhook(customer_id, webhook_id)
    elif path.endswith('/deliveries') and http_method == 'GET':
        return list_deliveries(customer_id, event.get('queryStringParameters', {}))
    elif path.endswith('/test') and http_method == 'POST':
        webhook_id = event.get('queryStringParameters', {}).get('webhookId')
        return test_webhook(customer_id, webhook_id)
    else:
        return error_response(400, 'Invalid endpoint')


def list_webhooks(customer_id):
    """List all webhooks for a customer"""
    try:
        table = dynamodb.Table(WEBHOOKS_TABLE)
        response = table.query(
            KeyConditionExpression='customer_id = :cid',
            ExpressionAttributeValues={':cid': customer_id}
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'webhooks': response.get('Items', []),
                'count': len(response.get('Items', []))
            })
        }
    except Exception as e:
        return error_response(500, f'Failed to list webhooks: {str(e)}')


def create_webhook(customer_id, data):
    """Create a new webhook"""
    try:
        # Validate input
        url = data.get('url')
        events = data.get('events', [])
        description = data.get('description', '')
        
        if not url or not url.startswith('https://'):
            return error_response(400, 'Valid HTTPS URL required')
        
        if not events or not isinstance(events, list):
            return error_response(400, 'At least one event type required')
        
        # Validate event types
        valid_events = [
            'invoice.created', 'invoice.paid', 'invoice.overdue',
            'ticket.created', 'ticket.updated', 'ticket.resolved',
            'compliance.scan_completed', 'compliance.finding_critical',
            'usage.threshold_exceeded', 'api_key.created', 'api_key.revoked'
        ]
        
        for event in events:
            if event not in valid_events:
                return error_response(400, f'Invalid event type: {event}')
        
        # Generate webhook ID and secret
        webhook_id = str(uuid4())
        secret = generate_secret()
        
        # Store webhook
        table = dynamodb.Table(WEBHOOKS_TABLE)
        webhook = {
            'customer_id': customer_id,
            'id': webhook_id,
            'url': url,
            'events': events,
            'description': description,
            'secret': secret,
            'active': True,
            'created_at': datetime.utcnow().isoformat(),
            'last_triggered_at': None,
            'delivery_success_count': 0,
            'delivery_failure_count': 0
        }
        
        table.put_item(Item=webhook)
        
        # Return webhook (include secret only on creation)
        return {
            'statusCode': 201,
            'body': json.dumps({
                'webhook': webhook,
                'message': 'Webhook created successfully. Save the secret - it will not be shown again.'
            })
        }
        
    except Exception as e:
        return error_response(500, f'Failed to create webhook: {str(e)}')


def get_webhook(customer_id, webhook_id):
    """Get webhook details"""
    try:
        table = dynamodb.Table(WEBHOOKS_TABLE)
        response = table.get_item(
            Key={'customer_id': customer_id, 'id': webhook_id}
        )
        
        if 'Item' not in response:
            return error_response(404, 'Webhook not found')
        
        webhook = response['Item']
        # Remove secret from response
        webhook.pop('secret', None)
        
        return {
            'statusCode': 200,
            'body': json.dumps({'webhook': webhook})
        }
        
    except Exception as e:
        return error_response(500, f'Failed to get webhook: {str(e)}')


def update_webhook(customer_id, webhook_id, data):
    """Update webhook configuration"""
    try:
        table = dynamodb.Table(WEBHOOKS_TABLE)
        
        # Build update expression
        update_expr = 'SET '
        expr_values = {}
        expr_names = {}
        
        if 'url' in data:
            if not data['url'].startswith('https://'):
                return error_response(400, 'Valid HTTPS URL required')
            update_expr += '#url = :url, '
            expr_names['#url'] = 'url'
            expr_values[':url'] = data['url']
        
        if 'events' in data:
            update_expr += 'events = :events, '
            expr_values[':events'] = data['events']
        
        if 'description' in data:
            update_expr += 'description = :desc, '
            expr_values[':desc'] = data['description']
        
        if 'active' in data:
            update_expr += 'active = :active, '
            expr_values[':active'] = data['active']
        
        update_expr += 'updated_at = :updated'
        expr_values[':updated'] = datetime.utcnow().isoformat()
        
        response = table.update_item(
            Key={'customer_id': customer_id, 'id': webhook_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
            ExpressionAttributeNames=expr_names if expr_names else None,
            ReturnValues='ALL_NEW'
        )
        
        webhook = response['Attributes']
        webhook.pop('secret', None)
        
        return {
            'statusCode': 200,
            'body': json.dumps({'webhook': webhook})
        }
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return error_response(404, 'Webhook not found')
        return error_response(500, f'Failed to update webhook: {str(e)}')


def delete_webhook(customer_id, webhook_id):
    """Delete a webhook"""
    try:
        table = dynamodb.Table(WEBHOOKS_TABLE)
        table.delete_item(
            Key={'customer_id': customer_id, 'id': webhook_id}
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Webhook deleted successfully'})
        }
        
    except Exception as e:
        return error_response(500, f'Failed to delete webhook: {str(e)}')


def list_deliveries(customer_id, params):
    """List webhook delivery attempts"""
    try:
        table = dynamodb.Table(DELIVERIES_TABLE)
        
        webhook_id = params.get('webhookId')
        limit = int(params.get('limit', 50))
        
        if webhook_id:
            # Query by webhook_id using GSI
            response = table.query(
                IndexName='webhook_id-timestamp-index',
                KeyConditionExpression='webhook_id = :wid',
                ExpressionAttributeValues={':wid': webhook_id},
                Limit=limit,
                ScanIndexForward=False  # Most recent first
            )
        else:
            # Query all deliveries for customer
            response = table.query(
                KeyConditionExpression='customer_id = :cid',
                ExpressionAttributeValues={':cid': customer_id},
                Limit=limit,
                ScanIndexForward=False
            )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'deliveries': response.get('Items', []),
                'count': len(response.get('Items', []))
            })
        }
        
    except Exception as e:
        return error_response(500, f'Failed to list deliveries: {str(e)}')


def test_webhook(customer_id, webhook_id):
    """Send a test payload to webhook"""
    try:
        # Get webhook
        table = dynamodb.Table(WEBHOOKS_TABLE)
        response = table.get_item(
            Key={'customer_id': customer_id, 'id': webhook_id}
        )
        
        if 'Item' not in response:
            return error_response(404, 'Webhook not found')
        
        webhook = response['Item']
        
        # Create test payload
        payload = {
            'event': 'webhook.test',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {
                'message': 'This is a test webhook delivery',
                'webhook_id': webhook_id,
                'customer_id': customer_id
            }
        }
        
        # Deliver webhook
        success, status_code, response_body = deliver_webhook(
            webhook['url'],
            webhook['secret'],
            payload
        )
        
        # Log delivery
        log_delivery(customer_id, webhook_id, 'webhook.test', payload, success, status_code, response_body)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': success,
                'status_code': status_code,
                'response': response_body[:500] if response_body else None
            })
        }
        
    except Exception as e:
        return error_response(500, f'Failed to test webhook: {str(e)}')


def deliver_webhook(url, secret, payload, attempt=0):
    """Deliver webhook payload with signature"""
    try:
        # Generate signature
        payload_str = json.dumps(payload, sort_keys=True)
        signature = hmac.new(
            secret.encode('utf-8'),
            payload_str.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        # Send webhook
        headers = {
            'Content-Type': 'application/json',
            'X-SecureBase-Signature': signature,
            'X-SecureBase-Delivery': str(uuid4()),
            'User-Agent': 'SecureBase-Webhooks/1.0'
        }
        
        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=10
        )
        
        success = 200 <= response.status_code < 300
        
        return success, response.status_code, response.text
        
    except requests.exceptions.Timeout:
        return False, 0, 'Request timeout'
    except requests.exceptions.RequestException as e:
        return False, 0, str(e)


def trigger_webhook(customer_id, event_type, data):
    """Trigger webhooks for a specific event (called by other services)"""
    try:
        # Find all webhooks subscribed to this event
        table = dynamodb.Table(WEBHOOKS_TABLE)
        response = table.query(
            KeyConditionExpression='customer_id = :cid',
            FilterExpression='contains(events, :event) AND active = :active',
            ExpressionAttributeValues={
                ':cid': customer_id,
                ':event': event_type,
                ':active': True
            }
        )
        
        webhooks = response.get('Items', [])
        
        # Prepare payload
        payload = {
            'event': event_type,
            'timestamp': datetime.utcnow().isoformat(),
            'data': data
        }
        
        # Deliver to each webhook
        for webhook in webhooks:
            success, status_code, response_body = deliver_webhook(
                webhook['url'],
                webhook['secret'],
                payload
            )
            
            # Log delivery
            log_delivery(
                customer_id,
                webhook['id'],
                event_type,
                payload,
                success,
                status_code,
                response_body
            )
            
            # Update webhook stats
            if success:
                table.update_item(
                    Key={'customer_id': customer_id, 'id': webhook['id']},
                    UpdateExpression='SET delivery_success_count = delivery_success_count + :inc, last_triggered_at = :now',
                    ExpressionAttributeValues={':inc': 1, ':now': datetime.utcnow().isoformat()}
                )
            else:
                table.update_item(
                    Key={'customer_id': customer_id, 'id': webhook['id']},
                    UpdateExpression='SET delivery_failure_count = delivery_failure_count + :inc',
                    ExpressionAttributeValues={':inc': 1}
                )
                
                # Schedule retry if failed
                if status_code >= 500:  # Retry on server errors
                    schedule_retry(customer_id, webhook['id'], event_type, payload, 0)
        
        return len(webhooks)
        
    except Exception as e:
        print(f'Error triggering webhooks: {str(e)}')
        return 0


def log_delivery(customer_id, webhook_id, event_type, payload, success, status_code, response_body):
    """Log webhook delivery attempt"""
    try:
        table = dynamodb.Table(DELIVERIES_TABLE)
        
        delivery = {
            'customer_id': customer_id,
            'id': str(uuid4()),
            'webhook_id': webhook_id,
            'event_type': event_type,
            'payload': payload,
            'success': success,
            'status_code': status_code,
            'response_body': response_body[:1000] if response_body else None,
            'timestamp': datetime.utcnow().isoformat(),
            'ttl': int((datetime.utcnow() + timedelta(days=30)).timestamp())
        }
        
        table.put_item(Item=delivery)
        
    except Exception as e:
        print(f'Error logging delivery: {str(e)}')


def schedule_retry(customer_id, webhook_id, event_type, payload, attempt):
    """Schedule webhook retry using SQS delay"""
    if attempt >= MAX_RETRIES:
        return
    
    # In production, use SQS with delay or Step Functions
    # For now, just log
    print(f'Would retry webhook {webhook_id} in {RETRY_DELAYS[attempt]} seconds')


def generate_secret():
    """Generate a random webhook secret"""
    import secrets
    return 'whsec_' + secrets.token_urlsafe(32)


def error_response(status_code, message):
    """Generate error response"""
    return {
        'statusCode': status_code,
        'body': json.dumps({'error': message})
    }
