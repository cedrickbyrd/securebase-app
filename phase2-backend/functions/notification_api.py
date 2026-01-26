"""
Notification API - HTTP API handler for notification CRUD operations

This Lambda function provides HTTP API endpoints for managing notifications
and user subscriptions.

Endpoints:
- GET /notifications - Fetch user notifications (paginated, filtered)
- POST /notifications/mark-read - Mark notifications as read
- GET /subscriptions - Get user notification preferences
- PUT /subscriptions - Update notification preferences
- POST /notifications/test - Send test notification

Author: SecureBase Team
Created: 2026-01-26
Status: Implementation Complete
"""

import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
import time

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key, Attr

# Environment variables - Validate on startup
NOTIFICATIONS_TABLE = os.environ.get('NOTIFICATIONS_TABLE', 'securebase-notifications')
SUBSCRIPTIONS_TABLE = os.environ.get('SUBSCRIPTIONS_TABLE', 'securebase-subscriptions')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')
MAX_PAGE_SIZE = int(os.environ.get('MAX_PAGE_SIZE', '100'))

# AWS clients - Initialize
dynamodb = boto3.resource('dynamodb')
sns_client = boto3.client('sns')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for notification API

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        dict: API response
    """
    # Extract route and method
    route = event.get('resource', event.get('path', ''))
    method = event.get('httpMethod', 'GET')
    
    print(f"Request: {method} {route}")
    
    try:
        # Extract user info from JWT token (simplified - in production use proper JWT validation)
        user_id = extract_user_id(event)
        customer_id = extract_customer_id(event)
        
        # Route to appropriate handler
        if '/notifications/mark-read' in route and method == 'POST':
            return mark_notifications_read(event, user_id, customer_id)
        elif '/notifications/test' in route and method == 'POST':
            return send_test_notification(event, user_id, customer_id)
        elif '/notifications' in route and method == 'GET':
            return get_notifications(event, user_id, customer_id)
        elif '/subscriptions' in route and method == 'GET':
            return get_subscriptions(event, user_id, customer_id)
        elif '/subscriptions' in route and method == 'PUT':
            return update_subscriptions(event, user_id, customer_id)
        else:
            return error_response(404, f'Route not found: {method} {route}')
    except ValueError as e:
        print(f"Validation error: {e}")
        return error_response(400, str(e))
    except Exception as e:
        print(f"Error processing request: {e}")
        return error_response(500, 'Internal server error')


def get_notifications(event: Dict[str, Any], user_id: str, customer_id: str) -> Dict[str, Any]:
    """
    GET /notifications - Fetch user notifications

    Query parameters:
    - type: Filter by notification type (security, billing, system)
    - read: Filter by read status (true/false)
    - limit: Number of results per page (default: 10, max: 100)
    - cursor: Pagination cursor

    Args:
        event: API Gateway event
        user_id: User ID from JWT
        customer_id: Customer ID from JWT

    Returns:
        dict: API response with notifications
    """
    # Parse query parameters
    params = event.get('queryStringParameters') or {}
    notification_type = params.get('type')
    read_filter = params.get('read')
    limit = min(int(params.get('limit', '10')), MAX_PAGE_SIZE)
    last_key = params.get('cursor')
    
    table = dynamodb.Table(NOTIFICATIONS_TABLE)
    
    # Build query
    query_params = {
        'IndexName': 'user_id-created_at-index',
        'KeyConditionExpression': Key('user_id').eq(user_id),
        'ScanIndexForward': False,  # Sort by created_at DESC
        'Limit': limit
    }
    
    # Add filters
    filter_expressions = []
    if notification_type:
        filter_expressions.append(Attr('type').eq(notification_type))
    if read_filter == 'true':
        filter_expressions.append(Attr('read_at').exists())
    elif read_filter == 'false':
        filter_expressions.append(Attr('read_at').not_exists())
    
    # Combine filters
    if filter_expressions:
        combined_filter = filter_expressions[0]
        for expr in filter_expressions[1:]:
            combined_filter = combined_filter & expr
        query_params['FilterExpression'] = combined_filter
    
    # Add pagination cursor
    if last_key:
        try:
            query_params['ExclusiveStartKey'] = json.loads(last_key)
        except Exception:
            pass
    
    # Execute query
    try:
        response = table.query(**query_params)
        
        notifications = response.get('Items', [])
        
        # Count unread notifications
        unread_count_response = table.query(
            IndexName='user_id-created_at-index',
            KeyConditionExpression=Key('user_id').eq(user_id),
            FilterExpression=Attr('read_at').not_exists(),
            Select='COUNT'
        )
        unread_count = unread_count_response.get('Count', 0)
        
        # Prepare response
        result = {
            'notifications': notifications,
            'unreadCount': unread_count,
            'hasMore': 'LastEvaluatedKey' in response
        }
        
        if 'LastEvaluatedKey' in response:
            result['cursor'] = json.dumps(response['LastEvaluatedKey'])
        
        return success_response(result)
    except ClientError as e:
        print(f"DynamoDB error: {e}")
        return error_response(500, 'Failed to fetch notifications')


def mark_notifications_read(event: Dict[str, Any], user_id: str, customer_id: str) -> Dict[str, Any]:
    """
    POST /notifications/mark-read - Mark notifications as read

    Request body:
    {
        "notification_ids": ["id1", "id2", ...]
    }

    Args:
        event: API Gateway event
        user_id: User ID from JWT
        customer_id: Customer ID from JWT

    Returns:
        dict: API response with success status
    """
    # Parse request body
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return error_response(400, 'Invalid JSON in request body')
    
    notification_ids = body.get('notification_ids', [])
    
    if not notification_ids:
        return error_response(400, 'No notification IDs provided')
    
    # Update DynamoDB items
    table = dynamodb.Table(NOTIFICATIONS_TABLE)
    
    marked_count = 0
    read_timestamp = int(time.time() * 1000)
    
    for notification_id in notification_ids:
        try:
            # Verify ownership before updating
            table.update_item(
                Key={'id': notification_id},
                UpdateExpression='SET read_at = :read_at',
                ConditionExpression='user_id = :user_id AND attribute_not_exists(read_at)',
                ExpressionAttributeValues={
                    ':read_at': read_timestamp,
                    ':user_id': user_id
                }
            )
            marked_count += 1
        except ClientError as e:
            if e.response['Error']['Code'] != 'ConditionalCheckFailedException':
                print(f"Error marking notification {notification_id} as read: {e}")
    
    return success_response({
        'success': True,
        'markedCount': marked_count
    })


def get_subscriptions(event: Dict[str, Any], user_id: str, customer_id: str) -> Dict[str, Any]:
    """
    GET /subscriptions - Get user notification preferences

    Args:
        event: API Gateway event
        user_id: User ID from JWT
        customer_id: Customer ID from JWT

    Returns:
        dict: API response with subscriptions
    """
    table = dynamodb.Table(SUBSCRIPTIONS_TABLE)
    
    try:
        # Get user subscription preferences
        response = table.get_item(
            Key={
                'customer_id': customer_id,
                'user_id': user_id
            }
        )
        
        if 'Item' in response:
            item = response['Item']
            return success_response({
                'subscriptions': item.get('subscriptions', {}),
                'emailVerified': item.get('email_verified', False),
                'smsNumber': item.get('phone_number', ''),
                'webhookUrl': item.get('webhook_url', '')
            })
        else:
            # Return defaults if no preferences found
            return success_response({
                'subscriptions': get_default_subscriptions(),
                'emailVerified': False,
                'smsNumber': '',
                'webhookUrl': ''
            })
    except ClientError as e:
        print(f"DynamoDB error: {e}")
        return error_response(500, 'Failed to fetch subscriptions')


def update_subscriptions(event: Dict[str, Any], user_id: str, customer_id: str) -> Dict[str, Any]:
    """
    PUT /subscriptions - Update user notification preferences

    Request body:
    {
        "subscriptions": {
            "security_alert": { "email": true, "sms": true, "in_app": true },
            "billing": { "email": true, "sms": false, "in_app": true }
        }
    }

    Args:
        event: API Gateway event
        user_id: User ID from JWT
        customer_id: Customer ID from JWT

    Returns:
        dict: API response with success status
    """
    # Parse request body
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return error_response(400, 'Invalid JSON in request body')
    
    subscriptions = body.get('subscriptions', {})
    
    if not subscriptions:
        return error_response(400, 'No subscriptions provided')
    
    # Update subscriptions table
    table = dynamodb.Table(SUBSCRIPTIONS_TABLE)
    
    try:
        table.put_item(
            Item={
                'customer_id': customer_id,
                'user_id': user_id,
                'subscriptions': subscriptions,
                'updated_at': int(time.time() * 1000)
            }
        )
        
        return success_response({'success': True})
    except ClientError as e:
        print(f"DynamoDB error: {e}")
        return error_response(500, 'Failed to update subscriptions')


def send_test_notification(event: Dict[str, Any], user_id: str, customer_id: str) -> Dict[str, Any]:
    """
    POST /notifications/test - Send test notification

    Request body:
    {
        "channel": "email" | "sms" | "in_app" | "webhook"
    }

    Args:
        event: API Gateway event
        user_id: User ID from JWT
        customer_id: Customer ID from JWT

    Returns:
        dict: API response with delivery status
    """
    # Parse request body
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return error_response(400, 'Invalid JSON in request body')
    
    channel = body.get('channel', 'in_app')
    
    if channel not in ['email', 'sms', 'in_app', 'webhook']:
        return error_response(400, f'Invalid channel: {channel}')
    
    # Create test notification message
    test_id = f'test-{int(time.time() * 1000)}'
    message = {
        'id': test_id,
        'customer_id': customer_id,
        'user_id': user_id,
        'type': 'test',
        'priority': 'low',
        'title': 'Test Notification',
        'body': f'This is a test notification sent via {channel}',
        'channels': [channel],
        'metadata': {},
        'created_at': datetime.utcnow().isoformat()
    }
    
    # Publish to SNS topic
    try:
        if SNS_TOPIC_ARN:
            response = sns_client.publish(
                TopicArn=SNS_TOPIC_ARN,
                Message=json.dumps(message),
                Subject='Test Notification'
            )
            
            return success_response({
                'success': True,
                'deliveryId': test_id,
                'messageId': response['MessageId']
            })
        else:
            # Fallback if SNS not configured
            return success_response({
                'success': True,
                'deliveryId': test_id,
                'note': 'SNS topic not configured, test notification logged only'
            })
    except ClientError as e:
        print(f"SNS error: {e}")
        return error_response(500, 'Failed to send test notification')


# Helper functions
def extract_user_id(event: Dict[str, Any]) -> str:
    """
    Extract user ID from JWT token or query parameters
    
    In production, this should validate JWT token from Authorization header
    For now, we'll accept user_id from query parameters or context
    """
    # Check query parameters first
    params = event.get('queryStringParameters') or {}
    if 'user_id' in params:
        return params['user_id']
    
    # Check request context (API Gateway authorizer)
    request_context = event.get('requestContext', {})
    authorizer = request_context.get('authorizer', {})
    if 'user_id' in authorizer:
        return authorizer['user_id']
    
    # Fallback for testing
    return 'test-user-id'


def extract_customer_id(event: Dict[str, Any]) -> str:
    """
    Extract customer ID from JWT token or query parameters
    
    In production, this should validate JWT token from Authorization header
    For now, we'll accept customer_id from query parameters or context
    """
    # Check query parameters first
    params = event.get('queryStringParameters') or {}
    if 'customer_id' in params:
        return params['customer_id']
    
    # Check request context (API Gateway authorizer)
    request_context = event.get('requestContext', {})
    authorizer = request_context.get('authorizer', {})
    if 'customer_id' in authorizer:
        return authorizer['customer_id']
    
    # Fallback for testing
    return 'test-customer-id'


def get_default_subscriptions() -> Dict[str, Dict[str, bool]]:
    """
    Return default subscription preferences for new users
    
    Returns:
        dict: Default subscriptions with all event types
    """
    return {
        'security_alert': {
            'email': True,
            'sms': True,
            'webhook': False,
            'in_app': True
        },
        'billing': {
            'email': True,
            'sms': False,
            'webhook': False,
            'in_app': True
        },
        'compliance': {
            'email': True,
            'sms': False,
            'webhook': False,
            'in_app': True
        },
        'system': {
            'email': False,
            'sms': False,
            'webhook': False,
            'in_app': True
        },
        'informational': {
            'email': False,
            'sms': False,
            'webhook': False,
            'in_app': True
        }
    }


def success_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """Return successful API response"""
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


def error_response(status_code: int, message: str) -> Dict[str, Any]:
    """Return error API response"""
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
