"""
pytest configuration for SecureBase integration tests
Phase 4: Integration Testing Infrastructure
"""

import pytest
import os
import sys
import psycopg2
from datetime import datetime
import boto3
from moto import mock_dynamodb, mock_s3, mock_sns, mock_sqs, mock_ses

# Add phase2-backend functions to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'phase2-backend', 'functions'))

# Test environment configuration
os.environ['ENVIRONMENT'] = 'test'
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
os.environ['AWS_ACCESS_KEY_ID'] = 'test'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'test'
os.environ['LOCALSTACK_ENDPOINT'] = 'http://localhost:4566'


# ============================================================================
# Session-scoped fixtures
# ============================================================================

@pytest.fixture(scope='session')
def test_config():
    """Test configuration"""
    return {
        'db_host': os.getenv('TEST_DB_HOST', 'localhost'),
        'db_port': int(os.getenv('TEST_DB_PORT', '5432')),
        'db_name': os.getenv('TEST_DB_NAME', 'securebase_test'),
        'db_user': os.getenv('TEST_DB_USER', 'test_user'),
        'db_password': os.getenv('TEST_DB_PASSWORD', 'test_password'),
        'localstack_endpoint': os.getenv('LOCALSTACK_ENDPOINT', 'http://localhost:4566'),
        'redis_host': os.getenv('TEST_REDIS_HOST', 'localhost'),
        'redis_port': int(os.getenv('TEST_REDIS_PORT', '6379')),
        'api_base_url': os.getenv('TEST_API_BASE_URL', 'http://localhost:3000'),
    }


@pytest.fixture(scope='session')
def db_connection(test_config):
    """Create database connection for session"""
    conn = psycopg2.connect(
        host=test_config['db_host'],
        port=test_config['db_port'],
        database=test_config['db_name'],
        user=test_config['db_user'],
        password=test_config['db_password']
    )
    yield conn
    conn.close()


# ============================================================================
# Function-scoped fixtures
# ============================================================================

@pytest.fixture
def db_cursor(db_connection):
    """Create database cursor for test"""
    cursor = db_connection.cursor()
    yield cursor
    db_connection.rollback()  # Rollback after each test
    cursor.close()


@pytest.fixture
def clean_database(db_cursor):
    """Clean database before test"""
    # Delete test data
    tables = [
        'activity_feed',
        'user_sessions',
        'user_permissions',
        'users',
        'notifications',
        'audit_logs',
        'analytics_reports',
        'webhooks'
    ]
    for table in tables:
        try:
            db_cursor.execute(f"DELETE FROM {table} WHERE customer_id LIKE 'test-%'")
        except psycopg2.Error:
            pass  # Table might not exist
    db_cursor.connection.commit()
    yield
    # Cleanup after test
    for table in tables:
        try:
            db_cursor.execute(f"DELETE FROM {table} WHERE customer_id LIKE 'test-%'")
        except psycopg2.Error:
            pass
    db_cursor.connection.commit()


@pytest.fixture
def test_customer():
    """Test customer data"""
    return {
        'customer_id': 'test-customer-001',
        'name': 'Test Customer Inc',
        'tier': 'standard',
        'framework': 'cis',
        'email': 'admin@testcustomer.example.com'
    }


@pytest.fixture
def test_admin_user(test_customer):
    """Test admin user"""
    return {
        'user_id': 'test-admin-001',
        'customer_id': test_customer['customer_id'],
        'email': 'admin@testcustomer.example.com',
        'name': 'Test Admin',
        'role': 'admin',
        'status': 'active',
        'mfa_enabled': True
    }


@pytest.fixture
def test_analyst_user(test_customer):
    """Test analyst user"""
    return {
        'user_id': 'test-analyst-001',
        'customer_id': test_customer['customer_id'],
        'email': 'analyst@testcustomer.example.com',
        'name': 'Test Analyst',
        'role': 'analyst',
        'status': 'active',
        'mfa_enabled': False
    }


@pytest.fixture
def test_viewer_user(test_customer):
    """Test viewer user"""
    return {
        'user_id': 'test-viewer-001',
        'customer_id': test_customer['customer_id'],
        'email': 'viewer@testcustomer.example.com',
        'name': 'Test Viewer',
        'role': 'viewer',
        'status': 'active',
        'mfa_enabled': False
    }


# ============================================================================
# AWS Mock fixtures
# ============================================================================

@pytest.fixture
def aws_credentials():
    """Mock AWS credentials for moto"""
    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_SECURITY_TOKEN'] = 'testing'
    os.environ['AWS_SESSION_TOKEN'] = 'testing'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'


@pytest.fixture
def dynamodb_mock(aws_credentials):
    """Mock DynamoDB for testing"""
    with mock_dynamodb():
        yield boto3.client('dynamodb', region_name='us-east-1')


@pytest.fixture
def s3_mock(aws_credentials):
    """Mock S3 for testing"""
    with mock_s3():
        s3 = boto3.client('s3', region_name='us-east-1')
        # Create test buckets
        s3.create_bucket(Bucket='securebase-test-reports')
        s3.create_bucket(Bucket='securebase-test-audit-logs')
        yield s3


@pytest.fixture
def sns_mock(aws_credentials):
    """Mock SNS for testing"""
    with mock_sns():
        yield boto3.client('sns', region_name='us-east-1')


@pytest.fixture
def sqs_mock(aws_credentials):
    """Mock SQS for testing"""
    with mock_sqs():
        yield boto3.client('sqs', region_name='us-east-1')


@pytest.fixture
def ses_mock(aws_credentials):
    """Mock SES for testing"""
    with mock_ses():
        yield boto3.client('ses', region_name='us-east-1')


# ============================================================================
# Performance testing fixtures
# ============================================================================

@pytest.fixture
def performance_monitor():
    """Monitor performance metrics during test"""
    import time
    start_time = time.time()
    metrics = {
        'start_time': start_time,
        'checkpoints': []
    }
    
    def checkpoint(name):
        """Record a performance checkpoint"""
        metrics['checkpoints'].append({
            'name': name,
            'time': time.time() - start_time
        })
    
    metrics['checkpoint'] = checkpoint
    yield metrics
    
    metrics['end_time'] = time.time()
    metrics['total_duration'] = metrics['end_time'] - start_time


# ============================================================================
# pytest configuration hooks
# ============================================================================

def pytest_configure(config):
    """Configure pytest"""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "performance: mark test as performance test"
    )
    config.addinivalue_line(
        "markers", "security: mark test as security test"
    )
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection"""
    for item in items:
        # Auto-mark tests in integration directory
        if "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        
        # Auto-mark performance tests
        if "performance" in item.name or "benchmark" in item.name:
            item.add_marker(pytest.mark.performance)
        
        # Auto-mark security tests
        if "security" in str(item.fspath) or "security" in item.name:
            item.add_marker(pytest.mark.security)
