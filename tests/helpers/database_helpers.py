"""
Database helper utilities for integration tests
Phase 4: Integration Testing Infrastructure
"""

import psycopg2
from typing import Dict, List, Optional, Any, Tuple
from contextlib import contextmanager


class DatabaseHelper:
    """Helper class for database operations in tests"""
    
    def __init__(self, connection):
        """
        Initialize database helper
        
        Args:
            connection: psycopg2 database connection
        """
        self.connection = connection
    
    def execute_query(self, query: str, params: Optional[Tuple] = None) -> None:
        """
        Execute a SQL query without returning results
        
        Args:
            query: SQL query string
            params: Query parameters
        """
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)
            self.connection.commit()
    
    def query_one(self, query: str, params: Optional[Tuple] = None) -> Optional[Dict]:
        """
        Query and return one row as dictionary
        
        Args:
            query: SQL query string
            params: Query parameters
        
        Returns:
            Dictionary with column names as keys, or None
        """
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)
            row = cursor.fetchone()
            
            if row is None:
                return None
            
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
    
    def query_all(self, query: str, params: Optional[Tuple] = None) -> List[Dict]:
        """
        Query and return all rows as list of dictionaries
        
        Args:
            query: SQL query string
            params: Query parameters
        
        Returns:
            List of dictionaries with column names as keys
        """
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            if not rows:
                return []
            
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
    
    def insert_test_data(self, table: str, data: Dict) -> Optional[str]:
        """
        Insert test data into table
        
        Args:
            table: Table name
            data: Dictionary of column: value pairs
        
        Returns:
            ID of inserted row if applicable
        """
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['%s'] * len(data))
        values = tuple(data.values())
        
        query = f"""
            INSERT INTO {table} ({columns})
            VALUES ({placeholders})
            RETURNING id
        """
        
        with self.connection.cursor() as cursor:
            cursor.execute(query, values)
            result = cursor.fetchone()
            self.connection.commit()
            return result[0] if result else None
    
    def cleanup_test_data(self, customer_id_prefix: str = 'test-'):
        """
        Clean up test data from all tables
        
        Args:
            customer_id_prefix: Prefix for test customer IDs
        """
        tables = [
            'activity_feed',
            'user_sessions',
            'user_permissions',
            'users',
            'notifications',
            'audit_logs',
            'analytics_reports',
            'webhooks',
            'scheduled_reports'
        ]
        
        for table in tables:
            try:
                query = f"DELETE FROM {table} WHERE customer_id LIKE %s"
                self.execute_query(query, (f'{customer_id_prefix}%',))
            except psycopg2.Error:
                # Table might not exist, continue
                pass
    
    def count_rows(self, table: str, where_clause: str = '', params: Optional[Tuple] = None) -> int:
        """
        Count rows in table
        
        Args:
            table: Table name
            where_clause: Optional WHERE clause (without WHERE keyword)
            params: Query parameters for where clause
        
        Returns:
            Number of rows
        """
        query = f"SELECT COUNT(*) FROM {table}"
        if where_clause:
            query += f" WHERE {where_clause}"
        
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()[0]
    
    def table_exists(self, table: str, schema: str = 'public') -> bool:
        """
        Check if table exists
        
        Args:
            table: Table name
            schema: Schema name (default: public)
        
        Returns:
            True if table exists, False otherwise
        """
        query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = %s
                AND table_name = %s
            )
        """
        
        with self.connection.cursor() as cursor:
            cursor.execute(query, (schema, table))
            return cursor.fetchone()[0]
    
    @contextmanager
    def transaction(self):
        """
        Context manager for database transactions
        
        Usage:
            with db_helper.transaction():
                # Do database operations
                # Automatically commits on success or rolls back on error
        """
        try:
            yield self
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise


def create_test_user(db_helper: DatabaseHelper, user_data: Dict) -> str:
    """
    Create a test user in database
    
    Args:
        db_helper: DatabaseHelper instance
        user_data: User data dictionary
    
    Returns:
        User ID
    """
    required_fields = {
        'user_id': user_data.get('user_id', f'test-user-{id(user_data)}'),
        'customer_id': user_data['customer_id'],
        'email': user_data['email'],
        'name': user_data['name'],
        'role': user_data.get('role', 'viewer'),
        'status': user_data.get('status', 'active'),
        'password_hash': 'test-hash',  # Not a real hash for testing
        'mfa_enabled': user_data.get('mfa_enabled', False),
        'created_at': 'NOW()',
        'updated_at': 'NOW()'
    }
    
    return db_helper.insert_test_data('users', required_fields)


def create_test_session(db_helper: DatabaseHelper, session_data: Dict) -> str:
    """
    Create a test session in database
    
    Args:
        db_helper: DatabaseHelper instance
        session_data: Session data dictionary
    
    Returns:
        Session ID
    """
    required_fields = {
        'session_id': session_data['session_id'],
        'user_id': session_data['user_id'],
        'customer_id': session_data['customer_id'],
        'token_hash': 'test-token-hash',
        'ip_address': session_data.get('ip_address', '127.0.0.1'),
        'user_agent': session_data.get('user_agent', 'Test Agent'),
        'created_at': 'NOW()',
        'expires_at': session_data['expires_at'],
        'last_activity': 'NOW()'
    }
    
    return db_helper.insert_test_data('user_sessions', required_fields)
