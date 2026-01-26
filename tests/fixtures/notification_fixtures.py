"""
Test fixtures for notification integration tests
Phase 4: Integration Testing - Notifications Component
"""

import pytest
from datetime import datetime, timedelta


@pytest.fixture
def sample_notification_event():
    """Sample notification event"""
    return {
        'event_id': 'test-event-001',
        'event_type': 'report.generated',
        'customer_id': 'test-customer-001',
        'user_id': 'test-admin-001',
        'severity': 'info',
        'title': 'Monthly Report Ready',
        'message': 'Your monthly cost analysis report is ready for download.',
        'metadata': {
            'report_id': 'test-report-001',
            'report_name': 'Monthly Cost Analysis',
            'download_url': 'https://example.com/reports/test-report-001'
        },
        'timestamp': datetime.utcnow().isoformat()
    }


@pytest.fixture
def sample_critical_alert():
    """Sample critical alert event"""
    return {
        'event_id': 'test-alert-001',
        'event_type': 'security.critical',
        'customer_id': 'test-customer-001',
        'severity': 'critical',
        'title': 'Critical Security Finding Detected',
        'message': 'A critical security vulnerability has been detected in your environment.',
        'metadata': {
            'finding_id': 'finding-001',
            'resource': 'i-1234567890abcdef0',
            'cve_id': 'CVE-2024-1234'
        },
        'timestamp': datetime.utcnow().isoformat()
    }


@pytest.fixture
def sample_user_preferences():
    """Sample user notification preferences"""
    return {
        'user_id': 'test-admin-001',
        'customer_id': 'test-customer-001',
        'channels': {
            'email': {
                'enabled': True,
                'address': 'admin@testcustomer.example.com'
            },
            'sms': {
                'enabled': True,
                'phone': '+15550100'
            },
            'in_app': {
                'enabled': True
            },
            'webhook': {
                'enabled': False,
                'url': None
            }
        },
        'severity_filters': {
            'critical': ['email', 'sms', 'in_app'],
            'high': ['email', 'in_app'],
            'medium': ['in_app'],
            'low': ['in_app'],
            'info': ['in_app']
        },
        'quiet_hours': {
            'enabled': True,
            'start': '22:00',
            'end': '08:00',
            'timezone': 'America/New_York',
            'bypass_critical': True
        }
    }


@pytest.fixture
def sample_notification_templates():
    """Sample notification templates"""
    return {
        'email': {
            'report_generated': {
                'subject': 'Report Ready: {{report_name}}',
                'body': '''
                Hi {{user_name}},
                
                Your {{report_name}} is ready for download.
                
                Download: {{download_url}}
                
                Generated: {{timestamp}}
                
                Thanks,
                SecureBase Team
                '''
            },
            'user_invited': {
                'subject': 'Welcome to SecureBase',
                'body': '''
                Hi {{user_name}},
                
                You've been invited to join {{customer_name}} on SecureBase.
                
                Activate your account: {{activation_url}}
                
                Thanks,
                SecureBase Team
                '''
            }
        },
        'sms': {
            'critical_alert': {
                'body': 'CRITICAL: {{title}}. Check SecureBase dashboard.'
            }
        }
    }


@pytest.fixture
def sample_batch_events():
    """Sample batch of notification events"""
    event_types = [
        'user.login', 'report.generated', 'security.finding',
        'compliance.check', 'cost.threshold'
    ]
    
    events = []
    for i in range(50):
        events.append({
            'event_id': f'batch-event-{i:03d}',
            'event_type': event_types[i % len(event_types)],
            'customer_id': 'test-customer-001',
            'severity': 'info' if i % 5 != 0 else 'high',
            'title': f'Test Event {i}',
            'message': f'Test notification message {i}',
            'timestamp': (datetime.utcnow() - timedelta(minutes=i)).isoformat()
        })
    
    return events


@pytest.fixture
def sample_webhook_config():
    """Sample webhook configuration"""
    return {
        'webhook_id': 'test-webhook-001',
        'customer_id': 'test-customer-001',
        'url': 'https://webhook.example.com/securebase',
        'secret': 'test-webhook-secret-123',
        'events': [
            'report.generated',
            'security.critical',
            'user.created',
            'compliance.failed'
        ],
        'enabled': True,
        'retry_policy': {
            'max_retries': 3,
            'retry_delay': 60,
            'backoff_multiplier': 2
        }
    }


@pytest.fixture
def sample_notification_delivery_log():
    """Sample notification delivery log"""
    return [
        {
            'delivery_id': f'delivery-{i:05d}',
            'notification_id': f'notification-{i:05d}',
            'channel': ['email', 'sms', 'in_app'][i % 3],
            'status': 'delivered' if i % 10 != 0 else 'failed',
            'attempts': 1 if i % 10 != 0 else 3,
            'delivered_at': (datetime.utcnow() - timedelta(hours=i)).isoformat() if i % 10 != 0 else None,
            'error': None if i % 10 != 0 else 'Connection timeout'
        }
        for i in range(100)
    ]
