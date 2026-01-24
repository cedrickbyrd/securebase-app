"""
Activity Feed Lambda for SecureBase Phase 4.

Handles:
  - Get activity feed for customer
  - Get activity feed for specific user
  - Get activity feed for specific resource
  - Filter and pagination

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
from typing import Dict
from datetime import datetime, timedelta

# Import database utilities
sys.path.insert(0, '/opt/python')
from db_utils import get_connection, release_connection, DatabaseError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))


def lambda_handler(event, context):
    """
    Main Lambda handler for activity feed operations.
    
    Supported operations:
    - GET /activity - Get activity feed with filters
    - GET /activity/user/{user_id} - Get activity for specific user
    - GET /activity/resource/{resource_type}/{resource_id} - Get activity for specific resource
    """
    try:
        http_method = event.get('httpMethod')
        path = event.get('path', '')
        path_params = event.get('pathParameters', {})
        query_params = event.get('queryStringParameters', {}) or {}
        
        # Extract user context from authorizer
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        customer_id = authorizer.get('customer_id')
        current_user_role = authorizer.get('role')
        
        if not customer_id:
            return error_response(401, 'Unauthorized: Missing customer context')
        
        # Route to appropriate handler
        if http_method == 'GET' and path == '/activity':
            return get_activity_feed(customer_id, current_user_role, query_params)
        
        elif http_method == 'GET' and '/activity/user/' in path:
            user_id = path_params.get('user_id')
            return get_user_activity(customer_id, current_user_role, user_id, query_params)
        
        elif http_method == 'GET' and '/activity/resource/' in path:
            resource_type = path_params.get('resource_type')
            resource_id = path_params.get('resource_id')
            return get_resource_activity(customer_id, current_user_role, resource_type, resource_id, query_params)
        
        else:
            return error_response(404, f'Not found: {http_method} {path}')
    
    except Exception as e:
        logger.error(f'Error in activity feed: {str(e)}', exc_info=True)
        return error_response(500, f'Internal server error: {str(e)}')


def get_activity_feed(customer_id: str, current_user_role: str, params: Dict) -> Dict:
    """Get activity feed for customer with optional filters."""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Set RLS context
        cursor.execute(
            "SELECT set_customer_context(%s::uuid, %s)",
            (customer_id, 'admin')
        )
        
        # Build query with filters
        where_clauses = ['customer_id = %s']
        query_params = [customer_id]
        
        # Filter by activity type
        if params.get('activity_type'):
            where_clauses.append('activity_type = %s')
            query_params.append(params['activity_type'])
        
        # Filter by user
        if params.get('user_id'):
            where_clauses.append('user_id = %s')
            query_params.append(params['user_id'])
        
        # Filter by resource type
        if params.get('resource_type'):
            where_clauses.append('resource_type = %s')
            query_params.append(params['resource_type'])
        
        # Filter by date range
        if params.get('start_date'):
            where_clauses.append('created_at >= %s')
            query_params.append(params['start_date'])
        
        if params.get('end_date'):
            where_clauses.append('created_at <= %s')
            query_params.append(params['end_date'])
        
        # Default to last 30 days if no date filter
        if not params.get('start_date') and not params.get('end_date'):
            where_clauses.append('created_at >= CURRENT_DATE - INTERVAL \'30 days\'')
        
        where_sql = ' AND '.join(where_clauses)
        
        # Pagination
        limit = min(int(params.get('limit', 50)), 100)
        offset = int(params.get('offset', 0))
        
        # Get activity feed
        cursor.execute(f"""
            SELECT 
                id, user_id, user_email, activity_type, description,
                resource_type, resource_id, resource_name,
                changes, ip_address, user_agent, created_at
            FROM activity_feed
            WHERE {where_sql}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """, query_params + [limit, offset])
        
        activities = []
        for row in cursor.fetchall():
            activities.append({
                'id': str(row[0]),
                'user_id': str(row[1]) if row[1] else None,
                'user_email': row[2],
                'activity_type': row[3],
                'description': row[4],
                'resource_type': row[5],
                'resource_id': row[6],
                'resource_name': row[7],
                'changes': row[8],
                'ip_address': str(row[9]) if row[9] else None,
                'user_agent': row[10],
                'created_at': row[11].isoformat() if row[11] else None
            })
        
        # Get total count
        cursor.execute(f"SELECT COUNT(*) FROM activity_feed WHERE {where_sql}", query_params)
        total_count = cursor.fetchone()[0]
        
        return success_response({
            'activities': activities,
            'total_count': total_count,
            'limit': limit,
            'offset': offset
        })
    
    except Exception as e:
        logger.error(f'Error getting activity feed: {str(e)}')
        return error_response(500, 'Failed to get activity feed')
    
    finally:
        if conn:
            release_connection(conn)


def get_user_activity(customer_id: str, current_user_role: str, user_id: str, params: Dict) -> Dict:
    """Get activity feed for specific user."""
    # Add user_id filter to params
    params['user_id'] = user_id
    return get_activity_feed(customer_id, current_user_role, params)


def get_resource_activity(customer_id: str, current_user_role: str, 
                          resource_type: str, resource_id: str, params: Dict) -> Dict:
    """Get activity feed for specific resource."""
    # Add resource filters to params
    params['resource_type'] = resource_type
    params['resource_id'] = resource_id
    return get_activity_feed(customer_id, current_user_role, params)


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
