"""
Database utility functions for SecureBase Lambda functions.
This module provides connection pooling, RLS context management, and common queries.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal

import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor, Json
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# Connection pool (reused across Lambda invocations)
_connection_pool = None


class DatabaseError(Exception):
    """Custom exception for database operations."""
    pass


def get_connection_pool(
    host: str = None,
    port: int = 5432,
    database: str = None,
    user: str = None,
    password: str = None,
    min_connections: int = 1,
    max_connections: int = 5
):
    """
    Get or create a connection pool.
    Uses RDS Proxy endpoint for connection pooling.
    
    Args:
        host: RDS Proxy endpoint
        port: PostgreSQL port
        database: Database name
        user: Database user
        password: Database password
        min_connections: Minimum pool size
        max_connections: Maximum pool size (limited by RDS Proxy)
    
    Returns:
        psycopg2.pool.SimpleConnectionPool
    """
    global _connection_pool
    
    if _connection_pool is not None:
        return _connection_pool
    
    # Get credentials from environment or Secrets Manager
    host = host or os.environ.get('RDS_HOST')
    database = database or os.environ.get('RDS_DATABASE', 'securebase')
    user = user or os.environ.get('RDS_USER', 'securebase_app')
    password = password or _get_secret('rds_password')
    
    if not all([host, database, user, password]):
        raise DatabaseError("Missing database connection parameters")
    
    try:
        _connection_pool = psycopg2.pool.SimpleConnectionPool(
            min_connections,
            max_connections,
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
            sslmode='require',  # Enforce TLS
            connect_timeout=5,
            options="-c statement_timeout=30000"  # 30 second query timeout
        )
        logger.info(f"Connection pool created: {min_connections}-{max_connections} connections")
        return _connection_pool
    except psycopg2.Error as e:
        logger.error(f"Failed to create connection pool: {str(e)}")
        raise DatabaseError(f"Connection pool initialization failed: {str(e)}")


def get_connection():
    """Get a connection from the pool."""
    try:
        pool = get_connection_pool()
        conn = pool.getconn()
        return conn
    except Exception as e:
        logger.error(f"Failed to get connection: {str(e)}")
        raise DatabaseError(f"Connection acquisition failed: {str(e)}")


def release_connection(conn):
    """Release a connection back to the pool."""
    if conn and _connection_pool:
        _connection_pool.putconn(conn)


def _get_secret(secret_name: str) -> str:
    """Retrieve secret from AWS Secrets Manager."""
    try:
        secrets_client = boto3.client('secretsmanager')
        response = secrets_client.get_secret_value(SecretId=secret_name)
        
        if 'SecretString' in response:
            secret = json.loads(response['SecretString'])
            if isinstance(secret, dict) and secret_name in secret:
                return secret[secret_name]
            return response['SecretString']
        return response['SecretBinary']
    except ClientError as e:
        logger.error(f"Failed to retrieve secret {secret_name}: {str(e)}")
        raise DatabaseError(f"Secret retrieval failed: {str(e)}")


def set_rls_context(customer_id: str, role: str = 'customer') -> None:
    """
    Set RLS context for the current session.
    Must be called at the start of each Lambda invocation with customer context.
    
    Args:
        customer_id: UUID of the customer
        role: 'customer' or 'admin'
    
    Raises:
        DatabaseError: If context setting fails
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT set_customer_context(%s, %s)", (customer_id, role))
            conn.commit()
        logger.debug(f"RLS context set for customer {customer_id} as {role}")
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Failed to set RLS context: {str(e)}")
        raise DatabaseError(f"RLS context setting failed: {str(e)}")
    finally:
        release_connection(conn)


def query_one(query: str, params: tuple = None, dict_cursor: bool = True) -> Optional[Dict]:
    """
    Execute a SELECT query and return a single row.
    
    Args:
        query: SQL query string
        params: Query parameters
        dict_cursor: Return as dict (True) or tuple (False)
    
    Returns:
        Dict/tuple of the first row, or None if no rows
    """
    conn = get_connection()
    try:
        cursor_factory = RealDictCursor if dict_cursor else None
        with conn.cursor(cursor_factory=cursor_factory) as cur:
            cur.execute(query, params or ())
            result = cur.fetchone()
        return result
    except psycopg2.Error as e:
        logger.error(f"Query failed: {str(e)}")
        raise DatabaseError(f"Query execution failed: {str(e)}")
    finally:
        release_connection(conn)


def query_many(query: str, params: tuple = None, dict_cursor: bool = True) -> List[Dict]:
    """
    Execute a SELECT query and return all rows.
    
    Args:
        query: SQL query string
        params: Query parameters
        dict_cursor: Return as dict (True) or tuple (False)
    
    Returns:
        List of dicts/tuples
    """
    conn = get_connection()
    try:
        cursor_factory = RealDictCursor if dict_cursor else None
        with conn.cursor(cursor_factory=cursor_factory) as cur:
            cur.execute(query, params or ())
            results = cur.fetchall()
        return results or []
    except psycopg2.Error as e:
        logger.error(f"Query failed: {str(e)}")
        raise DatabaseError(f"Query execution failed: {str(e)}")
    finally:
        release_connection(conn)


def execute_one(query: str, params: tuple = None) -> int:
    """
    Execute an INSERT/UPDATE/DELETE query.
    
    Args:
        query: SQL query string
        params: Query parameters
    
    Returns:
        Number of affected rows
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            conn.commit()
            return cur.rowcount
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Execution failed: {str(e)}")
        raise DatabaseError(f"Query execution failed: {str(e)}")
    finally:
        release_connection(conn)


def execute_many(query: str, param_list: List[tuple]) -> int:
    """
    Execute multiple INSERT/UPDATE/DELETE queries in a batch.
    
    Args:
        query: SQL query string
        param_list: List of parameter tuples
    
    Returns:
        Total number of affected rows
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.executemany(query, param_list)
            conn.commit()
            return cur.rowcount
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Batch execution failed: {str(e)}")
        raise DatabaseError(f"Batch execution failed: {str(e)}")
    finally:
        release_connection(conn)


def get_customer_by_id(customer_id: str) -> Optional[Dict]:
    """Get customer details by ID."""
    return query_one(
        "SELECT * FROM customers WHERE id = %s",
        (customer_id,)
    )


def get_customer_by_email(email: str) -> Optional[Dict]:
    """Get customer details by email."""
    return query_one(
        "SELECT * FROM customers WHERE email = %s",
        (email,)
    )


def create_customer(
    name: str,
    tier: str,
    framework: str,
    email: str,
    billing_email: str,
    aws_org_id: str,
    aws_management_account_id: str,
    **kwargs
) -> Dict:
    """
    Create a new customer.
    
    Args:
        name: Customer name
        tier: 'standard', 'fintech', 'healthcare', 'gov-federal'
        framework: 'soc2', 'hipaa', 'fedramp', 'cis'
        email: Customer contact email
        billing_email: Billing contact email
        aws_org_id: AWS Organization ID
        aws_management_account_id: AWS management account
        **kwargs: Additional fields (payment_method, tags, custom_config)
    
    Returns:
        Created customer dict
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO customers 
                (name, tier, framework, email, billing_email, aws_org_id, 
                 aws_management_account_id, payment_method, tags, custom_config)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                name, tier, framework, email, billing_email,
                aws_org_id, aws_management_account_id,
                kwargs.get('payment_method', 'aws_marketplace'),
                Json(kwargs.get('tags', {})),
                Json(kwargs.get('custom_config', {}))
            ))
            result = cur.fetchone()
            conn.commit()
            return dict(result)
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Customer creation failed: {str(e)}")
        raise DatabaseError(f"Customer creation failed: {str(e)}")
    finally:
        release_connection(conn)


def log_audit_event(
    customer_id: str,
    event_type: str,
    action: str,
    actor_email: str,
    resource_type: str = None,
    resource_id: str = None,
    status: str = 'success',
    error_message: str = None,
    request_id: str = None,
    metadata: Dict = None
) -> Dict:
    """
    Log an audit event. Records to immutable audit_events table.
    
    Args:
        customer_id: UUID of customer
        event_type: Type of event (e.g., 'api_call', 'billing', 'access')
        action: Specific action (e.g., 'list_invoices', 'create_api_key')
        actor_email: Email of who performed the action
        resource_type: Type of resource affected
        resource_id: ID of resource affected
        status: 'success' or 'failure'
        error_message: Error message if failed
        request_id: Unique request identifier
        metadata: Additional context
    
    Returns:
        Created audit event dict
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO audit_events
                (customer_id, event_type, action, resource_type, resource_id,
                 actor_email, status, error_message, request_id, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                customer_id, event_type, action, resource_type, resource_id,
                actor_email, status, error_message, request_id,
                Json(metadata or {})
            ))
            result = cur.fetchone()
            conn.commit()
            return dict(result)
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Audit event logging failed: {str(e)}")
        # Don't raise - audit failures shouldn't break the request
        return {}
    finally:
        release_connection(conn)


def get_usage_metrics(customer_id: str, month: str) -> Optional[Dict]:
    """
    Get usage metrics for a customer for a specific month.
    
    Args:
        customer_id: Customer UUID
        month: Month in YYYY-MM-01 format
    
    Returns:
        Usage metrics dict or None
    """
    return query_one(
        "SELECT * FROM usage_metrics WHERE customer_id = %s AND month = %s",
        (customer_id, month)
    )


def create_usage_metrics(customer_id: str, month: str, metrics: Dict) -> Dict:
    """Create usage metrics record."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO usage_metrics
                (customer_id, month, log_storage_gb, nat_gateway_bytes_processed,
                 cloudtrail_events_logged, config_rule_evaluations, guardduty_findings)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                customer_id, month,
                metrics.get('log_storage_gb', 0),
                metrics.get('nat_gateway_bytes_processed', 0),
                metrics.get('cloudtrail_events_logged', 0),
                metrics.get('config_rule_evaluations', 0),
                metrics.get('guardduty_findings', 0)
            ))
            result = cur.fetchone()
            conn.commit()
            return dict(result)
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Usage metrics creation failed: {str(e)}")
        raise DatabaseError(f"Usage metrics creation failed: {str(e)}")
    finally:
        release_connection(conn)


def calculate_charges(customer_id: str, month: str) -> Dict:
    """
    Calculate monthly charges for a customer using the calculate_monthly_charges function.
    
    Args:
        customer_id: Customer UUID
        month: Month in YYYY-MM-01 format
    
    Returns:
        Dict with tier_base_cost, usage_charges, usage_total, volume_discount, 
        subtotal, tax_amount, total_amount
    """
    return query_one(
        """
        SELECT 
            tier_base_cost::NUMERIC as tier_base_cost,
            usage_charges,
            usage_total::NUMERIC as usage_total,
            volume_discount::NUMERIC as volume_discount,
            subtotal::NUMERIC as subtotal,
            tax_amount::NUMERIC as tax_amount,
            total_amount::NUMERIC as total_amount
        FROM calculate_monthly_charges(%s, %s)
        """,
        (customer_id, month)
    )


def create_invoice(
    customer_id: str,
    month: str,
    tier_base_cost: Decimal,
    usage_charges: Dict,
    usage_total: Decimal,
    volume_discount: Decimal,
    subtotal: Decimal,
    tax_amount: Decimal,
    total_amount: Decimal,
    issued_at: datetime = None
) -> Dict:
    """Create an invoice."""
    conn = get_connection()
    try:
        # Generate invoice number
        invoice_number = f"INV-{customer_id.hex()[:8].upper()}-{month.replace('-', '')}"
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO invoices
                (customer_id, invoice_number, month, tier_base_cost, usage_charges,
                 usage_total, volume_discount, subtotal, tax_amount, total_amount,
                 status, issued_at, due_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                customer_id, invoice_number, month,
                tier_base_cost, Json(usage_charges),
                usage_total, volume_discount, subtotal, tax_amount, total_amount,
                'issued', issued_at or datetime.now(),
                (issued_at or datetime.now()) + timedelta(days=30)
            ))
            result = cur.fetchone()
            conn.commit()
            return dict(result)
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Invoice creation failed: {str(e)}")
        raise DatabaseError(f"Invoice creation failed: {str(e)}")
    finally:
        release_connection(conn)


def get_api_key_by_prefix(prefix: str) -> Optional[Dict]:
    """Get API key details by prefix (for validation)."""
    return query_one(
        "SELECT * FROM api_keys WHERE key_prefix = %s AND is_active = true",
        (prefix,)
    )


def update_api_key_usage(api_key_id: str) -> None:
    """Update last_used_at timestamp for an API key."""
    execute_one(
        "UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = %s",
        (api_key_id,)
    )


def create_api_key(
    customer_id: str,
    name: str,
    key_prefix: str,
    key_hash: str,
    scopes: List[str] = None
) -> Dict:
    """Create an API key."""
    conn = get_connection()
    try:
        set_rls_context(customer_id)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO api_keys
                (customer_id, name, key_prefix, key_hash, scopes)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *
            """, (
                customer_id, name, key_prefix, key_hash,
                scopes or ['read:invoices', 'read:metrics']
            ))
            result = cur.fetchone()
            conn.commit()
            return dict(result)
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"API key creation failed: {str(e)}")
        raise DatabaseError(f"API key creation failed: {str(e)}")
    finally:
        release_connection(conn)


def get_invoices(customer_id: str, limit: int = 12) -> List[Dict]:
    """Get recent invoices for a customer (RLS protected)."""
    set_rls_context(customer_id)
    return query_many(
        """
        SELECT * FROM invoices 
        WHERE customer_id = %s 
        ORDER BY month DESC 
        LIMIT %s
        """,
        (customer_id, limit)
    )
