"""
Test fixtures for RBAC integration tests
Phase 4: Integration Testing - RBAC Component
"""

import pytest
from datetime import datetime, timedelta
import secrets


@pytest.fixture
def sample_roles():
    """Sample role definitions"""
    return {
        'admin': {
            'role': 'admin',
            'permissions': [
                'users:create', 'users:read', 'users:update', 'users:delete',
                'reports:create', 'reports:read', 'reports:update', 'reports:delete',
                'settings:read', 'settings:update',
                'audit:read'
            ],
            'description': 'Full administrative access'
        },
        'manager': {
            'role': 'manager',
            'permissions': [
                'users:create', 'users:read', 'users:update',
                'reports:create', 'reports:read', 'reports:update',
                'settings:read'
            ],
            'description': 'Team management and reporting'
        },
        'analyst': {
            'role': 'analyst',
            'permissions': [
                'reports:create', 'reports:read',
                'users:read'
            ],
            'description': 'Analytics and reporting'
        },
        'viewer': {
            'role': 'viewer',
            'permissions': ['reports:read'],
            'description': 'Read-only access to reports'
        }
    }


@pytest.fixture
def sample_user_data():
    """Sample user creation data"""
    return {
        'email': f'testuser-{secrets.token_hex(4)}@example.com',
        'name': 'Test User',
        'role': 'analyst',
        'department': 'Engineering',
        'phone': '+1-555-0100'
    }


@pytest.fixture
def sample_session_data():
    """Sample session data"""
    return {
        'session_id': f'session-{secrets.token_hex(16)}',
        'user_id': 'test-analyst-001',
        'customer_id': 'test-customer-001',
        'ip_address': '192.168.1.100',
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'created_at': datetime.utcnow().isoformat(),
        'expires_at': (datetime.utcnow() + timedelta(hours=8)).isoformat(),
        'last_activity': datetime.utcnow().isoformat()
    }


@pytest.fixture
def sample_mfa_setup():
    """Sample MFA setup data"""
    return {
        'secret': secrets.token_hex(16),
        'qr_code_url': 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        'backup_codes': [secrets.token_hex(4) for _ in range(10)]
    }


@pytest.fixture
def sample_activity_log():
    """Sample activity log entries"""
    actions = [
        'user.login', 'user.logout', 'user.created', 'user.updated',
        'report.created', 'report.viewed', 'settings.updated',
        'password.changed', 'mfa.enabled', 'session.terminated'
    ]
    
    return [
        {
            'activity_id': f'activity-{i:05d}',
            'user_id': 'test-admin-001',
            'customer_id': 'test-customer-001',
            'action': actions[i % len(actions)],
            'resource_type': actions[i % len(actions)].split('.')[0],
            'resource_id': f'resource-{i}',
            'ip_address': f'192.168.1.{100 + (i % 155)}',
            'timestamp': (datetime.utcnow() - timedelta(hours=i)).isoformat(),
            'metadata': {'detail': f'Test action {i}'}
        }
        for i in range(100)
    ]


@pytest.fixture
def sample_permission_test_cases():
    """Test cases for permission validation"""
    return [
        {
            'role': 'admin',
            'action': 'users:delete',
            'expected': True,
            'description': 'Admin can delete users'
        },
        {
            'role': 'manager',
            'action': 'users:delete',
            'expected': False,
            'description': 'Manager cannot delete users'
        },
        {
            'role': 'analyst',
            'action': 'reports:create',
            'expected': True,
            'description': 'Analyst can create reports'
        },
        {
            'role': 'viewer',
            'action': 'reports:create',
            'expected': False,
            'description': 'Viewer cannot create reports'
        },
        {
            'role': 'viewer',
            'action': 'reports:read',
            'expected': True,
            'description': 'Viewer can read reports'
        }
    ]


@pytest.fixture
def multi_tenant_users():
    """Users from multiple tenants for isolation testing"""
    return [
        {
            'user_id': 'tenant-a-user-001',
            'customer_id': 'test-customer-a',
            'email': 'user@customer-a.example.com',
            'role': 'admin'
        },
        {
            'user_id': 'tenant-b-user-001',
            'customer_id': 'test-customer-b',
            'email': 'user@customer-b.example.com',
            'role': 'admin'
        }
    ]
