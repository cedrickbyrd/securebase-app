"""
User Management Lambda for SecureBase Phase 4.

Handles:
  - User CRUD operations (create, read, update, delete)
  - User role assignments
  - User permission management
  - User profile updates
  - Password management
  - Account lockout/unlock

Environment variables:
  - RDS_HOST: RDS Proxy endpoint
  - RDS_DATABASE: securebase
  - RDS_USER: securebase_app
  - RDS_PASSWORD: (from Secrets Manager)

Event format (API Gateway):
  {
    "httpMethod": "POST|GET|PUT|DELETE",
    "path": "/users/{user_id}",
    "headers": {
      "Authorization": "Bearer <session_token>"
    },
    "body": "{...}"
  }
"""

import os
import sys
import json
import logging
import hashlib
import secrets
from typing import Dict, List, Optional
from datetime import datetime, timedelta

import bcrypt
import boto3
from botocore.exceptions import ClientError

# Import database utilities
sys.path.insert(0, '/opt/python')
from db_utils import (
    get_connection, release_connection, execute_query, query_all, query_one,
    DatabaseError
)

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize AWS clients
ses = boto3.client('ses')


class UserManagementError(Exception):
    """Custom exception for user management operations."""
    pass


def lambda_handler(event, context):
    """
    Main Lambda handler for user management operations.
    
    Supported operations:
    - POST /users - Create new user
    - GET /users - List users
    - GET /users/{user_id} - Get user details
    - PUT /users/{user_id} - Update user
    - DELETE /users/{user_id} - Delete user
    - PUT /users/{user_id}/role - Update user role
    - PUT /users/{user_id}/status - Update user status
    - POST /users/{user_id}/reset-password - Reset password
    - POST /users/{user_id}/unlock - Unlock account
    """
    try:
        http_method = event.get('httpMethod')
        path = event.get('path', '')
        path_params = event.get('pathParameters', {})
        query_params = event.get('queryStringParameters', {}) or {}
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        
        # Extract user context from authorizer
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        customer_id = authorizer.get('customer_id')
        current_user_id = authorizer.get('user_id')
        current_user_role = authorizer.get('role')
        
        if not customer_id or not current_user_id:
            return error_response(401, 'Unauthorized: Missing authentication context')
        
        # Route to appropriate handler
        if http_method == 'POST' and path == '/users':
            return create_user(customer_id, current_user_id, current_user_role, body)
        
        elif http_method == 'GET' and path == '/users':
            return list_users(customer_id, current_user_role, query_params)
        
        elif http_method == 'GET' and '/users/' in path:
            user_id = path_params.get('user_id')
            return get_user(customer_id, current_user_role, user_id)
        
        elif http_method == 'PUT' and '/users/' in path and '/role' in path:
            user_id = path_params.get('user_id')
            return update_user_role(customer_id, current_user_id, current_user_role, user_id, body)
        
        elif http_method == 'PUT' and '/users/' in path and '/status' in path:
            user_id = path_params.get('user_id')
            return update_user_status(customer_id, current_user_id, current_user_role, user_id, body)
        
        elif http_method == 'PUT' and '/users/' in path:
            user_id = path_params.get('user_id')
            return update_user(customer_id, current_user_id, current_user_role, user_id, body)
        
        elif http_method == 'DELETE' and '/users/' in path:
            user_id = path_params.get('user_id')
            return delete_user(customer_id, current_user_id, current_user_role, user_id)
        
        elif http_method == 'POST' and '/reset-password' in path:
            user_id = path_params.get('user_id')
            return reset_user_password(customer_id, current_user_id, current_user_role, user_id)
        
        elif http_method == 'POST' and '/unlock' in path:
            user_id = path_params.get('user_id')
            return unlock_user_account(customer_id, current_user_id, current_user_role, user_id)
        
        else:
            return error_response(404, f'Not found: {http_method} {path}')
    
    except Exception as e:
        logger.error(f'Error in user management: {str(e)}', exc_info=True)
        return error_response(500, f'Internal server error: {str(e)}')


def create_user(customer_id: str, current_user_id: str, current_user_role: str, data: Dict) -> Dict:
    """Create a new user."""
    # Check permission: Only admin and manager can create users
    if current_user_role not in ['admin', 'manager']:
        return error_response(403, 'Forbidden: Only admins and managers can create users')
    
    # Validate required fields
    required_fields = ['email', 'full_name', 'role']
    for field in required_fields:
        if field not in data:
            return error_response(400, f'Missing required field: {field}')
    
    email = data['email'].lower().strip()
    full_name = data['full_name'].strip()
    role = data.get('role', 'viewer')
    
    # Validate role
    valid_roles = ['admin', 'manager', 'analyst', 'viewer']
    if role not in valid_roles:
        return error_response(400, f'Invalid role. Must be one of: {", ".join(valid_roles)}')
    
    # Manager cannot create admin users
    if current_user_role == 'manager' and role == 'admin':
        return error_response(403, 'Forbidden: Managers cannot create admin users')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Set RLS context
        cursor.execute(
            "SELECT set_user_context(%s::uuid, %s::uuid, %s)",
            (customer_id, current_user_id, 'admin')
        )
        
        # Check if user already exists
        cursor.execute(
            "SELECT id FROM users WHERE customer_id = %s AND email = %s",
            (customer_id, email)
        )
        if cursor.fetchone():
            return error_response(409, 'User with this email already exists')
        
        # Generate temporary password
        temp_password = secrets.token_urlsafe(16)
        password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create user
        cursor.execute("""
            INSERT INTO users (
                customer_id, email, full_name, password_hash,
                role, status, must_change_password, created_by,
                job_title, department, phone, timezone, locale
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, email, full_name, role, status, created_at
        """, (
            customer_id, email, full_name, password_hash,
            role, 'active', True, current_user_id,
            data.get('job_title'), data.get('department'), data.get('phone'),
            data.get('timezone', 'UTC'), data.get('locale', 'en-US')
        ))
        
        user = cursor.fetchone()
        user_id = user[0]
        
        # Log activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, resource_type, resource_id, resource_name,
                metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id, current_user_id, email, 'user_created',
            f'User {full_name} ({email}) created with role {role}',
            'users', str(user_id), full_name,
            json.dumps({'role': role, 'created_by': str(current_user_id)})
        ))
        
        # Assign default permissions based on role
        assign_default_permissions(cursor, customer_id, user_id, role, current_user_id)
        
        conn.commit()
        
        # Send welcome email with temporary password
        send_welcome_email(email, full_name, temp_password)
        
        return success_response({
            'user_id': str(user_id),
            'email': user[1],
            'full_name': user[2],
            'role': user[3],
            'status': user[4],
            'created_at': user[5].isoformat() if user[5] else None,
            'temporary_password': temp_password  # Only returned on creation
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error creating user: {str(e)}')
        raise UserManagementError(f'Failed to create user: {str(e)}')
    
    finally:
        if conn:
            release_connection(conn)


def list_users(customer_id: str, current_user_role: str, params: Dict) -> Dict:
    """List users in customer account."""
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
        
        if params.get('role'):
            where_clauses.append('role = %s')
            query_params.append(params['role'])
        
        if params.get('status'):
            where_clauses.append('status = %s')
            query_params.append(params['status'])
        
        if params.get('search'):
            where_clauses.append('(email ILIKE %s OR full_name ILIKE %s)')
            search_term = f"%{params['search']}%"
            query_params.extend([search_term, search_term])
        
        where_sql = ' AND '.join(where_clauses)
        
        # Pagination
        limit = min(int(params.get('limit', 50)), 100)
        offset = int(params.get('offset', 0))
        
        # Get users
        cursor.execute(f"""
            SELECT 
                id, email, full_name, role, status,
                job_title, department, phone, timezone,
                mfa_enabled, last_login_at, created_at, updated_at
            FROM users
            WHERE {where_sql}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """, query_params + [limit, offset])
        
        users = []
        for row in cursor.fetchall():
            users.append({
                'id': str(row[0]),
                'email': row[1],
                'full_name': row[2],
                'role': row[3],
                'status': row[4],
                'job_title': row[5],
                'department': row[6],
                'phone': row[7],
                'timezone': row[8],
                'mfa_enabled': row[9],
                'last_login_at': row[10].isoformat() if row[10] else None,
                'created_at': row[11].isoformat() if row[11] else None,
                'updated_at': row[12].isoformat() if row[12] else None
            })
        
        # Get total count
        cursor.execute(f"SELECT COUNT(*) FROM users WHERE {where_sql}", query_params)
        total_count = cursor.fetchone()[0]
        
        return success_response({
            'users': users,
            'total_count': total_count,
            'limit': limit,
            'offset': offset
        })
    
    except Exception as e:
        logger.error(f'Error listing users: {str(e)}')
        raise UserManagementError(f'Failed to list users: {str(e)}')
    
    finally:
        if conn:
            release_connection(conn)


def get_user(customer_id: str, current_user_role: str, user_id: str) -> Dict:
    """Get user details."""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Set RLS context
        cursor.execute(
            "SELECT set_customer_context(%s::uuid, %s)",
            (customer_id, 'admin')
        )
        
        cursor.execute("""
            SELECT 
                id, email, full_name, role, status,
                job_title, department, phone, timezone, locale,
                avatar_url, mfa_enabled, last_login_at, last_login_ip,
                failed_login_attempts, locked_until, password_changed_at,
                must_change_password, preferences, metadata,
                created_at, updated_at
            FROM users
            WHERE id = %s AND customer_id = %s
        """, (user_id, customer_id))
        
        row = cursor.fetchone()
        if not row:
            return error_response(404, 'User not found')
        
        # Get user permissions
        cursor.execute("""
            SELECT resource_type, resource_id, actions, expires_at
            FROM user_permissions
            WHERE user_id = %s AND customer_id = %s
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        """, (user_id, customer_id))
        
        permissions = []
        for perm in cursor.fetchall():
            permissions.append({
                'resource_type': perm[0],
                'resource_id': perm[1],
                'actions': perm[2],
                'expires_at': perm[3].isoformat() if perm[3] else None
            })
        
        return success_response({
            'id': str(row[0]),
            'email': row[1],
            'full_name': row[2],
            'role': row[3],
            'status': row[4],
            'job_title': row[5],
            'department': row[6],
            'phone': row[7],
            'timezone': row[8],
            'locale': row[9],
            'avatar_url': row[10],
            'mfa_enabled': row[11],
            'last_login_at': row[12].isoformat() if row[12] else None,
            'last_login_ip': str(row[13]) if row[13] else None,
            'failed_login_attempts': row[14],
            'locked_until': row[15].isoformat() if row[15] else None,
            'password_changed_at': row[16].isoformat() if row[16] else None,
            'must_change_password': row[17],
            'preferences': row[18],
            'metadata': row[19],
            'created_at': row[20].isoformat() if row[20] else None,
            'updated_at': row[21].isoformat() if row[21] else None,
            'permissions': permissions
        })
    
    except Exception as e:
        logger.error(f'Error getting user: {str(e)}')
        raise UserManagementError(f'Failed to get user: {str(e)}')
    
    finally:
        if conn:
            release_connection(conn)


def update_user(customer_id: str, current_user_id: str, current_user_role: str, 
                user_id: str, data: Dict) -> Dict:
    """Update user profile."""
    # Users can update their own profile, admins can update anyone
    if current_user_id != user_id and current_user_role not in ['admin', 'manager']:
        return error_response(403, 'Forbidden: You can only update your own profile')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Set RLS context
        cursor.execute(
            "SELECT set_user_context(%s::uuid, %s::uuid, %s)",
            (customer_id, current_user_id, 'admin')
        )
        
        # Build update query
        update_fields = []
        update_values = []
        
        allowed_fields = [
            'full_name', 'job_title', 'department', 'phone',
            'timezone', 'locale', 'avatar_url', 'preferences'
        ]
        
        for field in allowed_fields:
            if field in data:
                update_fields.append(f"{field} = %s")
                update_values.append(data[field])
        
        if not update_fields:
            return error_response(400, 'No valid fields to update')
        
        update_values.extend([user_id, customer_id])
        
        cursor.execute(f"""
            UPDATE users
            SET {', '.join(update_fields)}
            WHERE id = %s AND customer_id = %s
            RETURNING id, email, full_name, role, status, updated_at
        """, update_values)
        
        row = cursor.fetchone()
        if not row:
            return error_response(404, 'User not found')
        
        # Log activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, resource_type, resource_id, changes
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id, current_user_id, row[1], 'user_updated',
            f'User {row[2]} updated',
            'users', str(user_id),
            json.dumps({k: v for k, v in data.items() if k in allowed_fields})
        ))
        
        conn.commit()
        
        return success_response({
            'id': str(row[0]),
            'email': row[1],
            'full_name': row[2],
            'role': row[3],
            'status': row[4],
            'updated_at': row[5].isoformat() if row[5] else None
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error updating user: {str(e)}')
        raise UserManagementError(f'Failed to update user: {str(e)}')
    
    finally:
        if conn:
            release_connection(conn)


def update_user_role(customer_id: str, current_user_id: str, current_user_role: str,
                     user_id: str, data: Dict) -> Dict:
    """Update user role."""
    # Only admins can change roles
    if current_user_role != 'admin':
        return error_response(403, 'Forbidden: Only admins can change user roles')
    
    new_role = data.get('role')
    if not new_role or new_role not in ['admin', 'manager', 'analyst', 'viewer']:
        return error_response(400, 'Invalid role')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Set RLS context
        cursor.execute(
            "SELECT set_user_context(%s::uuid, %s::uuid, %s)",
            (customer_id, current_user_id, 'admin')
        )
        
        # Get current role
        cursor.execute(
            "SELECT role, email, full_name FROM users WHERE id = %s AND customer_id = %s",
            (user_id, customer_id)
        )
        row = cursor.fetchone()
        if not row:
            return error_response(404, 'User not found')
        
        old_role = row[0]
        user_email = row[1]
        user_name = row[2]
        
        # Update role
        cursor.execute("""
            UPDATE users
            SET role = %s
            WHERE id = %s AND customer_id = %s
            RETURNING id, email, full_name, role, updated_at
        """, (new_role, user_id, customer_id))
        
        updated = cursor.fetchone()
        
        # Clear existing permissions and assign new defaults
        cursor.execute("DELETE FROM user_permissions WHERE user_id = %s", (user_id,))
        assign_default_permissions(cursor, customer_id, user_id, new_role, current_user_id)
        
        # Log activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, resource_type, resource_id, changes
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id, current_user_id, user_email, 'role_changed',
            f'User {user_name} role changed from {old_role} to {new_role}',
            'users', str(user_id),
            json.dumps({'old_role': old_role, 'new_role': new_role})
        ))
        
        conn.commit()
        
        return success_response({
            'id': str(updated[0]),
            'email': updated[1],
            'full_name': updated[2],
            'role': updated[3],
            'updated_at': updated[4].isoformat() if updated[4] else None,
            'old_role': old_role,
            'new_role': new_role
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error updating user role: {str(e)}')
        raise UserManagementError(f'Failed to update user role: {str(e)}')
    
    finally:
        if conn:
            release_connection(conn)


def update_user_status(customer_id: str, current_user_id: str, current_user_role: str,
                       user_id: str, data: Dict) -> Dict:
    """Update user status (activate, suspend, etc.)."""
    # Only admins and managers can change status
    if current_user_role not in ['admin', 'manager']:
        return error_response(403, 'Forbidden: Only admins and managers can change user status')
    
    new_status = data.get('status')
    if not new_status or new_status not in ['active', 'inactive', 'suspended']:
        return error_response(400, 'Invalid status')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Set RLS context
        cursor.execute(
            "SELECT set_user_context(%s::uuid, %s::uuid, %s)",
            (customer_id, current_user_id, 'admin')
        )
        
        cursor.execute("""
            UPDATE users
            SET status = %s
            WHERE id = %s AND customer_id = %s
            RETURNING id, email, full_name, status
        """, (new_status, user_id, customer_id))
        
        row = cursor.fetchone()
        if not row:
            return error_response(404, 'User not found')
        
        # If suspending, invalidate all sessions
        if new_status == 'suspended':
            cursor.execute("""
                UPDATE user_sessions
                SET is_active = false, logged_out_at = CURRENT_TIMESTAMP,
                    logout_reason = 'account_suspended'
                WHERE user_id = %s AND is_active = true
            """, (user_id,))
        
        # Log activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, resource_type, resource_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id, current_user_id, row[1], 'user_updated',
            f'User {row[2]} status changed to {new_status}',
            'users', str(user_id)
        ))
        
        conn.commit()
        
        return success_response({
            'id': str(row[0]),
            'email': row[1],
            'full_name': row[2],
            'status': row[3]
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error updating user status: {str(e)}')
        raise UserManagementError(f'Failed to update user status: {str(e)}')
    
    finally:
        if conn:
            release_connection(conn)


def delete_user(customer_id: str, current_user_id: str, current_user_role: str, user_id: str) -> Dict:
    """Delete user (soft delete by setting status to inactive)."""
    # Only admins can delete users
    if current_user_role != 'admin':
        return error_response(403, 'Forbidden: Only admins can delete users')
    
    # Prevent self-deletion
    if current_user_id == user_id:
        return error_response(400, 'Cannot delete your own account')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Set RLS context
        cursor.execute(
            "SELECT set_user_context(%s::uuid, %s::uuid, %s)",
            (customer_id, current_user_id, 'admin')
        )
        
        # Get user info
        cursor.execute(
            "SELECT email, full_name FROM users WHERE id = %s AND customer_id = %s",
            (user_id, customer_id)
        )
        row = cursor.fetchone()
        if not row:
            return error_response(404, 'User not found')
        
        user_email = row[0]
        user_name = row[1]
        
        # Soft delete: set status to inactive
        cursor.execute("""
            UPDATE users
            SET status = 'inactive'
            WHERE id = %s AND customer_id = %s
        """, (user_id, customer_id))
        
        # Invalidate all sessions
        cursor.execute("""
            UPDATE user_sessions
            SET is_active = false, logged_out_at = CURRENT_TIMESTAMP,
                logout_reason = 'account_deleted'
            WHERE user_id = %s AND is_active = true
        """, (user_id,))
        
        # Log activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, resource_type, resource_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id, current_user_id, user_email, 'user_deleted',
            f'User {user_name} ({user_email}) deleted',
            'users', str(user_id)
        ))
        
        conn.commit()
        
        return success_response({
            'message': 'User deleted successfully',
            'user_id': str(user_id),
            'email': user_email
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error deleting user: {str(e)}')
        raise UserManagementError(f'Failed to delete user: {str(e)}')
    
    finally:
        if conn:
            release_connection(conn)


def reset_user_password(customer_id: str, current_user_id: str, current_user_role: str, user_id: str) -> Dict:
    """Reset user password and send email with new temporary password."""
    # Admins can reset anyone's password, users can reset their own
    if current_user_id != user_id and current_user_role not in ['admin', 'manager']:
        return error_response(403, 'Forbidden: Cannot reset other users\' passwords')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Set RLS context
        cursor.execute(
            "SELECT set_user_context(%s::uuid, %s::uuid, %s)",
            (customer_id, current_user_id, 'admin')
        )
        
        # Get user info
        cursor.execute(
            "SELECT email, full_name FROM users WHERE id = %s AND customer_id = %s",
            (user_id, customer_id)
        )
        row = cursor.fetchone()
        if not row:
            return error_response(404, 'User not found')
        
        user_email = row[0]
        user_name = row[1]
        
        # Generate new temporary password
        temp_password = secrets.token_urlsafe(16)
        password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Update password
        cursor.execute("""
            UPDATE users
            SET password_hash = %s,
                must_change_password = true,
                password_changed_at = CURRENT_TIMESTAMP,
                failed_login_attempts = 0,
                locked_until = NULL
            WHERE id = %s AND customer_id = %s
        """, (password_hash, user_id, customer_id))
        
        # Invalidate all existing sessions
        cursor.execute("""
            UPDATE user_sessions
            SET is_active = false, logged_out_at = CURRENT_TIMESTAMP,
                logout_reason = 'password_reset'
            WHERE user_id = %s AND is_active = true
        """, (user_id,))
        
        # Log activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, resource_type, resource_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id, current_user_id, user_email, 'user_updated',
            f'Password reset for user {user_name}',
            'users', str(user_id)
        ))
        
        conn.commit()
        
        # Send email with new password
        send_password_reset_email(user_email, user_name, temp_password)
        
        return success_response({
            'message': 'Password reset successfully',
            'user_id': str(user_id),
            'email': user_email,
            'temporary_password': temp_password  # Only returned for testing, remove in production
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error resetting password: {str(e)}')
        raise UserManagementError(f'Failed to reset password: {str(e)}')
    
    finally:
        if conn:
            release_connection(conn)


def unlock_user_account(customer_id: str, current_user_id: str, current_user_role: str, user_id: str) -> Dict:
    """Unlock a locked user account."""
    # Only admins can unlock accounts
    if current_user_role != 'admin':
        return error_response(403, 'Forbidden: Only admins can unlock accounts')
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Set RLS context
        cursor.execute(
            "SELECT set_user_context(%s::uuid, %s::uuid, %s)",
            (customer_id, current_user_id, 'admin')
        )
        
        cursor.execute("""
            UPDATE users
            SET failed_login_attempts = 0,
                locked_until = NULL
            WHERE id = %s AND customer_id = %s
            RETURNING id, email, full_name
        """, (user_id, customer_id))
        
        row = cursor.fetchone()
        if not row:
            return error_response(404, 'User not found')
        
        # Log activity
        cursor.execute("""
            INSERT INTO activity_feed (
                customer_id, user_id, user_email, activity_type,
                description, resource_type, resource_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id, current_user_id, row[1], 'user_updated',
            f'Account unlocked for user {row[2]}',
            'users', str(user_id)
        ))
        
        conn.commit()
        
        return success_response({
            'message': 'Account unlocked successfully',
            'user_id': str(row[0]),
            'email': row[1]
        })
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f'Error unlocking account: {str(e)}')
        raise UserManagementError(f'Failed to unlock account: {str(e)}')
    
    finally:
        if conn:
            release_connection(conn)


def assign_default_permissions(cursor, customer_id: str, user_id: str, role: str, granted_by: str):
    """Assign default permissions based on user role."""
    permissions_map = {
        'admin': [
            ('customers', None, ['read', 'create', 'update', 'delete']),
            ('invoices', None, ['read', 'create', 'update', 'delete']),
            ('api_keys', None, ['read', 'create', 'update', 'delete']),
            ('usage_metrics', None, ['read']),
            ('support_tickets', None, ['read', 'create', 'update', 'delete']),
            ('notifications', None, ['read', 'create']),
            ('audit_events', None, ['read']),
            ('reports', None, ['read', 'create', 'update', 'delete']),
            ('analytics', None, ['read']),
            ('users', None, ['read', 'create', 'update', 'delete']),
            ('settings', None, ['read', 'update']),
        ],
        'manager': [
            ('invoices', None, ['read', 'create', 'update']),
            ('api_keys', None, ['read', 'create', 'update', 'delete']),
            ('usage_metrics', None, ['read']),
            ('support_tickets', None, ['read', 'create', 'update']),
            ('notifications', None, ['read', 'create']),
            ('audit_events', None, ['read']),
            ('reports', None, ['read', 'create', 'update', 'delete']),
            ('analytics', None, ['read']),
            ('users', None, ['read', 'create', 'update']),
        ],
        'analyst': [
            ('invoices', None, ['read']),
            ('usage_metrics', None, ['read']),
            ('support_tickets', None, ['read', 'create']),
            ('audit_events', None, ['read']),
            ('reports', None, ['read', 'create']),
            ('analytics', None, ['read']),
        ],
        'viewer': [
            ('invoices', None, ['read']),
            ('usage_metrics', None, ['read']),
            ('support_tickets', None, ['read']),
            ('reports', None, ['read']),
        ]
    }
    
    permissions = permissions_map.get(role, [])
    
    for resource_type, resource_id, actions in permissions:
        cursor.execute("""
            INSERT INTO user_permissions (
                user_id, customer_id, resource_type, resource_id, actions, granted_by
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, resource_type, resource_id) DO UPDATE
            SET actions = EXCLUDED.actions
        """, (user_id, customer_id, resource_type, resource_id, actions, granted_by))


def send_welcome_email(email: str, name: str, temp_password: str):
    """Send welcome email with temporary password."""
    try:
        ses.send_email(
            Source='noreply@securebase.aws',
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': 'Welcome to SecureBase'},
                'Body': {
                    'Html': {
                        'Data': f"""
                        <html>
                        <body>
                            <h2>Welcome to SecureBase, {name}!</h2>
                            <p>Your account has been created. Here are your login credentials:</p>
                            <p><strong>Email:</strong> {email}</p>
                            <p><strong>Temporary Password:</strong> {temp_password}</p>
                            <p>Please log in and change your password immediately.</p>
                            <p>For security, this password will expire in 24 hours.</p>
                        </body>
                        </html>
                        """
                    }
                }
            }
        )
        logger.info(f'Welcome email sent to {email}')
    except Exception as e:
        logger.error(f'Failed to send welcome email to {email}: {str(e)}')


def send_password_reset_email(email: str, name: str, temp_password: str):
    """Send password reset email with temporary password."""
    try:
        ses.send_email(
            Source='noreply@securebase.aws',
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': 'SecureBase - Password Reset'},
                'Body': {
                    'Html': {
                        'Data': f"""
                        <html>
                        <body>
                            <h2>Password Reset - SecureBase</h2>
                            <p>Hello {name},</p>
                            <p>Your password has been reset. Here is your temporary password:</p>
                            <p><strong>Temporary Password:</strong> {temp_password}</p>
                            <p>Please log in and change your password immediately.</p>
                            <p>If you did not request this password reset, please contact support immediately.</p>
                        </body>
                        </html>
                        """
                    }
                }
            }
        )
        logger.info(f'Password reset email sent to {email}')
    except Exception as e:
        logger.error(f'Failed to send password reset email to {email}: {str(e)}')


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
