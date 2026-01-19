"""
Support Tickets Lambda Functions
Handles ticket creation, updating, commenting, and querying
Database: support_tickets and ticket_comments tables (Phase 2 schema)
"""

import json
import logging
import uuid
from datetime import datetime, timedelta
from functools import wraps
from decimal import Decimal

import boto3
from db_utils import get_db_connection, validate_customer_id, get_customer_org_id
from email_service import send_email

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')
sns = boto3.client('sns')

# Database tables
tickets_table = dynamodb.Table('support_tickets')
comments_table = dynamodb.Table('ticket_comments')

# SLA configurations (in hours)
SLA_CONFIG = {
    'critical': 1,
    'high': 4,
    'medium': 24,
    'low': 48,
}

# Ticket categories
VALID_CATEGORIES = ['general', 'billing', 'technical', 'feature-request', 'security']
VALID_PRIORITIES = ['low', 'medium', 'high', 'critical']
VALID_STATUSES = ['open', 'in-progress', 'waiting-customer', 'resolved', 'closed']


def require_auth(f):
    """Decorator to validate authentication"""
    @wraps(f)
    def decorated_function(event, context):
        headers = event.get('headers', {})
        auth_header = headers.get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        # Validate token with Phase 2 auth service
        # This would call your existing auth validation
        
        return f(event, context)
    return decorated_function


def get_customer_id_from_token(token):
    """Extract customer ID from JWT token"""
    # This would validate and decode the JWT
    # For now, assuming token contains customer_id
    import jwt
    try:
        payload = jwt.decode(token, 'secret', algorithms=['HS256'])
        return payload.get('customer_id')
    except:
        return None


def calculate_sla_due_date(priority):
    """Calculate SLA due date based on priority"""
    hours = SLA_CONFIG.get(priority, 48)
    return datetime.utcnow() + timedelta(hours=hours)


def parse_auth_header(event):
    """Extract and validate authorization token"""
    headers = event.get('headers', {})
    auth_header = headers.get('Authorization', '')
    
    if not auth_header.startswith('Bearer '):
        return None, {'statusCode': 401, 'body': json.dumps({'error': 'Unauthorized'})}
    
    token = auth_header[7:]
    customer_id = get_customer_id_from_token(token)
    
    if not customer_id:
        return None, {'statusCode': 401, 'body': json.dumps({'error': 'Invalid token'})}
    
    return customer_id, None


@require_auth
def create_ticket(event, context):
    """
    Create a new support ticket
    POST /support/tickets/create
    """
    try:
        customer_id, error = parse_auth_header(event)
        if error:
            return error
        
        body = json.loads(event.get('body', '{}'))
        
        # Validate required fields
        subject = body.get('subject', '').strip()
        description = body.get('description', '').strip()
        priority = body.get('priority', 'medium').lower()
        category = body.get('category', 'general').lower()
        
        if not subject or len(subject) < 5:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Subject must be at least 5 characters'})
            }
        
        if not description or len(description) < 20:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Description must be at least 20 characters'})
            }
        
        if priority not in VALID_PRIORITIES:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Invalid priority. Must be one of: {VALID_PRIORITIES}'})
            }
        
        if category not in VALID_CATEGORIES:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Invalid category. Must be one of: {VALID_CATEGORIES}'})
            }
        
        # Create ticket
        ticket_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        sla_due_date = calculate_sla_due_date(priority).isoformat()
        
        ticket = {
            'id': ticket_id,
            'customer_id': customer_id,
            'subject': subject,
            'description': description,
            'priority': priority,
            'category': category,
            'status': 'open',
            'created_at': now,
            'updated_at': now,
            'sla_due_date': sla_due_date,
            'assigned_to': None,
            'last_response_at': now,
            'comment_count': 0,
            'ttl': int((datetime.utcnow() + timedelta(days=90)).timestamp()),  # Auto-delete after 90 days
        }
        
        # Save to DynamoDB
        tickets_table.put_item(Item=ticket)
        
        # Send confirmation email
        try:
            send_email(
                to_address=body.get('email'),
                subject=f'Support Ticket Created: #{ticket_id}',
                body=f'''
Your support ticket has been created and assigned ticket number: {ticket_id}

Subject: {subject}
Priority: {priority.capitalize()}
Category: {category.capitalize()}
Status: Open

Expected Response Time: {SLA_CONFIG.get(priority, 48)} hours

You will be notified when we respond to your ticket.
'''
            )
        except Exception as e:
            logger.warning(f'Failed to send confirmation email: {str(e)}')
        
        # Publish event for real-time notifications
        try:
            sns.publish(
                TopicArn='arn:aws:sns:us-east-1:ACCOUNT:support-events',
                Message=json.dumps({
                    'type': 'ticket_created',
                    'ticket_id': ticket_id,
                    'customer_id': customer_id,
                    'priority': priority
                })
            )
        except Exception as e:
            logger.warning(f'Failed to publish SNS event: {str(e)}')
        
        logger.info(f'Ticket created: {ticket_id} for customer: {customer_id}')
        
        return {
            'statusCode': 201,
            'body': json.dumps(ticket, default=str)
        }
    
    except Exception as e:
        logger.error(f'Error creating ticket: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to create ticket'})
        }


@require_auth
def list_tickets(event, context):
    """
    List support tickets for customer
    GET /support/tickets?status=open&priority=high&limit=10&offset=0
    """
    try:
        customer_id, error = parse_auth_header(event)
        if error:
            return error
        
        # Parse query parameters
        query_params = event.get('queryStringParameters', {}) or {}
        status = query_params.get('status', 'all')
        priority = query_params.get('priority', 'all')
        limit = int(query_params.get('limit', '50'))
        offset = int(query_params.get('offset', '0'))
        
        # Validate parameters
        if limit > 100:
            limit = 100
        if offset < 0:
            offset = 0
        
        # Query tickets for customer
        response = tickets_table.query(
            KeyConditionExpression='customer_id = :cid',
            ExpressionAttributeValues={':cid': customer_id},
            ScanIndexForward=False,  # Sort by created_at descending
            Limit=limit + offset,
        )
        
        tickets = response.get('Items', [])
        
        # Apply filters
        if status != 'all':
            tickets = [t for t in tickets if t.get('status') == status]
        
        if priority != 'all':
            tickets = [t for t in tickets if t.get('priority') == priority]
        
        # Pagination
        total = len(tickets)
        tickets = tickets[offset:offset + limit]
        
        # Load comments count
        for ticket in tickets:
            comments = comments_table.query(
                KeyConditionExpression='ticket_id = :tid',
                ExpressionAttributeValues={':tid': ticket['id']},
                Select='COUNT'
            )
            ticket['comment_count'] = comments.get('Count', 0)
        
        logger.info(f'Retrieved {len(tickets)} tickets for customer: {customer_id}')
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'tickets': tickets,
                'total': total,
                'limit': limit,
                'offset': offset
            }, default=str)
        }
    
    except Exception as e:
        logger.error(f'Error listing tickets: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to list tickets'})
        }


@require_auth
def get_ticket(event, context):
    """
    Get single ticket with comments
    GET /support/tickets/{ticket_id}
    """
    try:
        customer_id, error = parse_auth_header(event)
        if error:
            return error
        
        ticket_id = event['pathParameters'].get('ticket_id')
        
        if not ticket_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Ticket ID required'})
            }
        
        # Get ticket
        response = tickets_table.get_item(Key={'id': ticket_id, 'customer_id': customer_id})
        ticket = response.get('Item')
        
        if not ticket:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Ticket not found'})
            }
        
        # Get comments
        comments_response = comments_table.query(
            KeyConditionExpression='ticket_id = :tid',
            ExpressionAttributeValues={':tid': ticket_id},
            ScanIndexForward=True,  # Sort ascending by timestamp
        )
        
        ticket['comments'] = comments_response.get('Items', [])
        
        logger.info(f'Retrieved ticket: {ticket_id}')
        
        return {
            'statusCode': 200,
            'body': json.dumps(ticket, default=str)
        }
    
    except Exception as e:
        logger.error(f'Error getting ticket: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to get ticket'})
        }


@require_auth
def update_ticket(event, context):
    """
    Update ticket status and metadata
    PUT /support/tickets/{ticket_id}
    """
    try:
        customer_id, error = parse_auth_header(event)
        if error:
            return error
        
        ticket_id = event['pathParameters'].get('ticket_id')
        body = json.loads(event.get('body', '{}'))
        
        if not ticket_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Ticket ID required'})
            }
        
        # Get existing ticket
        response = tickets_table.get_item(Key={'id': ticket_id, 'customer_id': customer_id})
        ticket = response.get('Item')
        
        if not ticket:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Ticket not found'})
            }
        
        # Update allowed fields
        updates = {}
        update_expression = 'SET updated_at = :now'
        expr_values = {':now': datetime.utcnow().isoformat()}
        
        if 'status' in body:
            new_status = body['status'].lower()
            if new_status not in VALID_STATUSES:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': f'Invalid status. Must be one of: {VALID_STATUSES}'})
                }
            update_expression += ', #status = :status'
            expr_values[':status'] = new_status
        
        if 'assigned_to' in body:
            update_expression += ', assigned_to = :assigned'
            expr_values[':assigned'] = body['assigned_to']
        
        # Execute update
        tickets_table.update_item(
            Key={'id': ticket_id, 'customer_id': customer_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues=expr_values,
        )
        
        # Publish event
        try:
            sns.publish(
                TopicArn='arn:aws:sns:us-east-1:ACCOUNT:support-events',
                Message=json.dumps({
                    'type': 'ticket_updated',
                    'ticket_id': ticket_id,
                    'customer_id': customer_id,
                    'changes': body
                })
            )
        except Exception as e:
            logger.warning(f'Failed to publish SNS event: {str(e)}')
        
        logger.info(f'Ticket updated: {ticket_id}')
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Ticket updated'})
        }
    
    except Exception as e:
        logger.error(f'Error updating ticket: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to update ticket'})
        }


@require_auth
def add_comment(event, context):
    """
    Add comment to ticket
    POST /support/tickets/{ticket_id}/comments
    """
    try:
        customer_id, error = parse_auth_header(event)
        if error:
            return error
        
        ticket_id = event['pathParameters'].get('ticket_id')
        body = json.loads(event.get('body', '{}'))
        
        if not ticket_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Ticket ID required'})
            }
        
        text = body.get('text', '').strip()
        
        if not text or len(text) < 1:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Comment text required'})
            }
        
        # Verify ticket exists and belongs to customer
        response = tickets_table.get_item(Key={'id': ticket_id, 'customer_id': customer_id})
        ticket = response.get('Item')
        
        if not ticket:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Ticket not found'})
            }
        
        # Create comment
        comment_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        comment = {
            'ticket_id': ticket_id,
            'id': comment_id,
            'author': body.get('author', 'Customer'),
            'text': text,
            'created_at': now,
            'is_internal': body.get('is_internal', False),
            'ttl': int((datetime.utcnow() + timedelta(days=90)).timestamp()),
        }
        
        # Save comment
        comments_table.put_item(Item=comment)
        
        # Update ticket's last_response_at and comment_count
        tickets_table.update_item(
            Key={'id': ticket_id, 'customer_id': customer_id},
            UpdateExpression='SET last_response_at = :now, comment_count = comment_count + :inc',
            ExpressionAttributeValues={
                ':now': now,
                ':inc': 1
            }
        )
        
        # Publish event for notifications
        try:
            sns.publish(
                TopicArn='arn:aws:sns:us-east-1:ACCOUNT:support-events',
                Message=json.dumps({
                    'type': 'comment_added',
                    'ticket_id': ticket_id,
                    'customer_id': customer_id,
                    'comment_id': comment_id
                })
            )
        except Exception as e:
            logger.warning(f'Failed to publish SNS event: {str(e)}')
        
        logger.info(f'Comment added to ticket: {ticket_id}')
        
        return {
            'statusCode': 201,
            'body': json.dumps(comment, default=str)
        }
    
    except Exception as e:
        logger.error(f'Error adding comment: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to add comment'})
        }


@require_auth
def get_comments(event, context):
    """
    Get ticket comments
    GET /support/tickets/{ticket_id}/comments
    """
    try:
        customer_id, error = parse_auth_header(event)
        if error:
            return error
        
        ticket_id = event['pathParameters'].get('ticket_id')
        
        if not ticket_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Ticket ID required'})
            }
        
        # Verify ticket belongs to customer
        response = tickets_table.get_item(Key={'id': ticket_id, 'customer_id': customer_id})
        if not response.get('Item'):
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Ticket not found'})
            }
        
        # Get comments
        comments_response = comments_table.query(
            KeyConditionExpression='ticket_id = :tid',
            ExpressionAttributeValues={':tid': ticket_id},
            ScanIndexForward=True,
        )
        
        comments = comments_response.get('Items', [])
        
        logger.info(f'Retrieved {len(comments)} comments for ticket: {ticket_id}')
        
        return {
            'statusCode': 200,
            'body': json.dumps({'comments': comments}, default=str)
        }
    
    except Exception as e:
        logger.error(f'Error getting comments: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to get comments'})
        }


# Lambda handlers
def lambda_handler_create_ticket(event, context):
    return create_ticket(event, context)


def lambda_handler_list_tickets(event, context):
    return list_tickets(event, context)


def lambda_handler_get_ticket(event, context):
    return get_ticket(event, context)


def lambda_handler_update_ticket(event, context):
    return update_ticket(event, context)


def lambda_handler_add_comment(event, context):
    return add_comment(event, context)


def lambda_handler_get_comments(event, context):
    return get_comments(event, context)
