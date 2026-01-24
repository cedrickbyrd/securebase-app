"""
Lambda Database Connection Pooling
Optimized connection management for Aurora PostgreSQL

Performance Benefits:
- Reduces cold start latency (reuses connections)
- Prevents connection exhaustion
- Handles connection errors gracefully
"""

import os
import json
import logging
from contextlib import contextmanager
from functools import lru_cache

try:
    import psycopg2
    from psycopg2 import pool
except ImportError as e:
    raise ImportError(
        "psycopg2-binary is required for database connection pooling. "
        "Install it in your Lambda layer: pip install psycopg2-binary"
    ) from e

try:
    import boto3
except ImportError as e:
    raise ImportError(
        "boto3 is required for AWS service integration. "
        "It should be available in the Lambda runtime by default."
    ) from e

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Global connection pool (persists across Lambda invocations)
_connection_pool = None

# Secrets Manager client (reuse across invocations)
_secrets_client = None


@lru_cache(maxsize=1)
def get_secrets_client():
    """Get cached Secrets Manager client"""
    global _secrets_client
    if _secrets_client is None:
        _secrets_client = boto3.client('secretsmanager')
    return _secrets_client


@lru_cache(maxsize=1)
def get_db_credentials():
    """
    Fetch database credentials from Secrets Manager (cached)
    
    Returns:
        dict: Database connection parameters
    """
    secret_name = os.environ.get('DB_SECRET_NAME', 'securebase/prod/database')
    
    try:
        client = get_secrets_client()
        response = client.get_secret_value(SecretId=secret_name)
        secret = json.loads(response['SecretString'])
        
        return {
            'host': secret.get('host', os.environ.get('DB_HOST')),
            'port': int(secret.get('port', os.environ.get('DB_PORT', 5432))),
            'database': secret.get('dbname', os.environ.get('DB_NAME')),
            'user': secret.get('username', os.environ.get('DB_USER')),
            'password': secret.get('password', os.environ.get('DB_PASSWORD')),
        }
    except Exception as e:
        logger.error(f"Error fetching database credentials: {e}")
        # Fallback to environment variables
        return {
            'host': os.environ['DB_HOST'],
            'port': int(os.environ.get('DB_PORT', 5432)),
            'database': os.environ['DB_NAME'],
            'user': os.environ['DB_USER'],
            'password': os.environ['DB_PASSWORD'],
        }


def get_connection_pool():
    """
    Get or create connection pool
    
    Uses SimpleConnectionPool for Lambda (1-5 connections)
    Persists across warm Lambda invocations
    
    Returns:
        psycopg2.pool.SimpleConnectionPool: Connection pool
    """
    global _connection_pool
    
    if _connection_pool is None:
        logger.info("Creating new database connection pool")
        
        creds = get_db_credentials()
        
        try:
            _connection_pool = psycopg2.pool.SimpleConnectionPool(
                minconn=1,                    # Minimum 1 connection
                maxconn=5,                    # Maximum 5 connections (Lambda limit)
                host=creds['host'],
                port=creds['port'],
                database=creds['database'],
                user=creds['user'],
                password=creds['password'],
                connect_timeout=5,            # 5 second connect timeout
                # Performance optimizations
                options='-c statement_timeout=30000',  # 30 second query timeout
                # Connection pooling settings
                keepalives=1,                 # Enable TCP keepalive
                keepalives_idle=30,           # Start keepalive after 30s idle
                keepalives_interval=10,       # Send keepalive every 10s
                keepalives_count=5,           # Drop connection after 5 failed keepalives
                # SSL settings (if needed)
                sslmode='prefer',             # Use SSL if available
            )
            logger.info("Database connection pool created successfully")
        except Exception as e:
            logger.error(f"Error creating connection pool: {e}")
            raise
    
    return _connection_pool


@contextmanager
def get_db_connection():
    """
    Context manager for database connections
    
    Usage:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM customers")
            results = cursor.fetchall()
    
    Yields:
        psycopg2.connection: Database connection from pool
    """
    pool = get_connection_pool()
    conn = None
    
    try:
        # Get connection from pool
        conn = pool.getconn()
        
        # Verify connection is alive
        try:
            conn.isolation_level
        except (psycopg2.InterfaceError, psycopg2.OperationalError):
            # Connection is dead, close and get new one
            logger.warning("Stale connection detected, reconnecting...")
            pool.putconn(conn, close=True)
            conn = pool.getconn()
        
        yield conn
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise
        
    finally:
        if conn:
            # Return connection to pool
            pool.putconn(conn)


def execute_query(query, params=None, fetch=True):
    """
    Execute a database query with connection pooling
    
    Args:
        query (str): SQL query
        params (tuple, optional): Query parameters
        fetch (bool): Whether to fetch results
    
    Returns:
        list: Query results (if fetch=True)
        int: Rows affected (if fetch=False)
    """
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            
            if fetch:
                return cursor.fetchall()
            else:
                conn.commit()
                return cursor.rowcount


def execute_query_dict(query, params=None):
    """
    Execute query and return results as list of dictionaries
    
    Args:
        query (str): SQL query
        params (tuple, optional): Query parameters
    
    Returns:
        list: Query results as dictionaries
    """
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]


def set_rls_context(conn, customer_id):
    """
    Set Row-Level Security context for multi-tenancy
    
    Args:
        conn: Database connection
        customer_id (str): Customer ID to set in session
    """
    with conn.cursor() as cursor:
        cursor.execute(
            "SET app.current_customer_id = %s",
            (customer_id,)
        )


def health_check():
    """
    Database health check
    
    Returns:
        dict: Health status
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                
                return {
                    'status': 'healthy',
                    'database': 'connected',
                    'result': result[0]
                }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            'status': 'unhealthy',
            'error': str(e)
        }


def close_all_connections():
    """
    Close all connections in pool
    
    Call this at end of Lambda execution if needed (cleanup)
    Note: Usually not necessary as pool persists across invocations
    """
    global _connection_pool
    
    if _connection_pool:
        logger.info("Closing all database connections")
        _connection_pool.closeall()
        _connection_pool = None


# Performance metrics
def get_pool_stats():
    """
    Get connection pool statistics
    
    Returns:
        dict: Pool statistics
    """
    pool = get_connection_pool()
    
    # Note: SimpleConnectionPool doesn't expose detailed stats
    # For production, consider using ThreadedConnectionPool
    return {
        'pool_initialized': _connection_pool is not None,
        'pool_type': 'SimpleConnectionPool',
        'min_connections': 1,
        'max_connections': 5,
    }


# Example Lambda handler using connection pooling
def lambda_handler(event, context):
    """
    Example Lambda handler with connection pooling
    
    Performance characteristics:
    - Cold start: ~1-2s (creates pool)
    - Warm start: ~50-100ms (reuses connections)
    """
    try:
        # Extract customer ID from event
        customer_id = event.get('customer_id')
        
        if not customer_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'customer_id required'})
            }
        
        # Use connection pooling
        with get_db_connection() as conn:
            # Set RLS context
            set_rls_context(conn, customer_id)
            
            # Execute query
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM invoices WHERE customer_id = %s ORDER BY invoice_date DESC LIMIT 10",
                    (customer_id,)
                )
                
                columns = [desc[0] for desc in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Cache-Control': 'max-age=300, private'
            },
            'body': json.dumps({
                'invoices': results,
                'pool_stats': get_pool_stats()
            }, default=str)
        }
        
    except Exception as e:
        logger.error(f"Error in Lambda handler: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }


# Alternative: Using RDS Proxy (recommended for production)
def get_rds_proxy_connection():
    """
    Connect via RDS Proxy for better connection management
    
    RDS Proxy Benefits:
    - Automatic connection pooling
    - Reduced Lambda cold starts
    - Automatic failover
    - IAM authentication support
    
    Usage:
        Set DB_HOST to RDS Proxy endpoint
        Example: securebase-prod-proxy.proxy-abc123.us-east-1.rds.amazonaws.com
    """
    # RDS Proxy handles pooling, so use regular connection
    creds = get_db_credentials()
    
    return psycopg2.connect(
        host=creds['host'],
        port=creds['port'],
        database=creds['database'],
        user=creds['user'],
        password=creds['password'],
        connect_timeout=5,
        sslmode='prefer'
    )
