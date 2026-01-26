"""
Test fixtures for analytics integration tests
Phase 4: Integration Testing - Analytics Component
"""

import pytest
from datetime import datetime, timedelta
import json


@pytest.fixture
def sample_analytics_report():
    """Sample analytics report data"""
    return {
        'report_id': 'test-report-001',
        'customer_id': 'test-customer-001',
        'name': 'Monthly Cost Analysis',
        'type': 'cost',
        'schedule': 'monthly',
        'format': 'pdf',
        'created_at': datetime.utcnow().isoformat(),
        'created_by': 'test-admin-001',
        'parameters': {
            'date_range': 'last_30_days',
            'grouping': 'service',
            'include_forecasts': True
        }
    }


@pytest.fixture
def sample_cost_data():
    """Sample cost data for analytics"""
    base_date = datetime.utcnow() - timedelta(days=30)
    data = []
    
    services = ['EC2', 'RDS', 'Lambda', 'S3', 'CloudWatch']
    for day in range(30):
        date = base_date + timedelta(days=day)
        for service in services:
            data.append({
                'date': date.strftime('%Y-%m-%d'),
                'service': service,
                'cost': round(100 + (day * 2) + (hash(service) % 50), 2),
                'usage_hours': round(24 * (0.8 + (hash(service) % 20) / 100), 2)
            })
    
    return data


@pytest.fixture
def sample_security_findings():
    """Sample security findings for analytics"""
    severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    findings = []
    
    for i in range(20):
        findings.append({
            'finding_id': f'finding-{i:03d}',
            'severity': severities[i % len(severities)],
            'title': f'Security Finding {i}',
            'description': f'Test security finding description {i}',
            'resource_id': f'resource-{i}',
            'status': 'ACTIVE' if i % 3 != 0 else 'RESOLVED',
            'first_seen': (datetime.utcnow() - timedelta(days=i)).isoformat(),
            'last_seen': datetime.utcnow().isoformat()
        })
    
    return findings


@pytest.fixture
def sample_compliance_status():
    """Sample compliance status data"""
    return {
        'framework': 'CIS',
        'total_controls': 150,
        'passing_controls': 142,
        'failing_controls': 8,
        'compliance_percentage': 94.67,
        'last_assessed': datetime.utcnow().isoformat(),
        'failing_controls_detail': [
            {'control_id': '1.1', 'title': 'Avoid root account usage', 'severity': 'HIGH'},
            {'control_id': '2.3', 'title': 'Enable encryption at rest', 'severity': 'MEDIUM'},
            {'control_id': '3.5', 'title': 'Configure VPC flow logs', 'severity': 'MEDIUM'},
        ]
    }


@pytest.fixture
def sample_dashboard_metrics():
    """Sample dashboard metrics"""
    return {
        'total_cost_mtd': 12450.67,
        'cost_change_pct': -5.3,
        'active_resources': 156,
        'security_findings': 8,
        'compliance_score': 94.67,
        'active_users': 12,
        'api_requests_today': 1847,
        'uptime_percentage': 99.98,
        'last_updated': datetime.utcnow().isoformat()
    }


@pytest.fixture
def sample_report_export(tmp_path):
    """Sample report export file paths"""
    return {
        'csv': tmp_path / 'report.csv',
        'pdf': tmp_path / 'report.pdf',
        'excel': tmp_path / 'report.xlsx',
        'json': tmp_path / 'report.json'
    }


@pytest.fixture
def sample_scheduled_report():
    """Sample scheduled report configuration"""
    return {
        'schedule_id': 'test-schedule-001',
        'report_id': 'test-report-001',
        'customer_id': 'test-customer-001',
        'frequency': 'weekly',
        'day_of_week': 'monday',
        'time': '09:00',
        'timezone': 'America/New_York',
        'recipients': [
            'admin@testcustomer.example.com',
            'analyst@testcustomer.example.com'
        ],
        'format': 'pdf',
        'enabled': True,
        'next_run': (datetime.utcnow() + timedelta(days=1)).isoformat()
    }


@pytest.fixture
def large_dataset():
    """Large dataset for pagination testing"""
    return [
        {
            'id': f'record-{i:05d}',
            'timestamp': (datetime.utcnow() - timedelta(hours=i)).isoformat(),
            'value': round(100 * (1 + i * 0.01), 2),
            'category': f'category-{i % 10}'
        }
        for i in range(10000)
    ]
