"""
Unit tests for tenant_metrics Lambda function.
Phase 5.2: Tenant/Customer Dashboard Backend
"""

import json
import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
from decimal import Decimal

# Import the module under test
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from tenant_metrics import (
    lambda_handler,
    get_tenant_metrics,
    get_compliance_status,
    get_usage_metrics,
    get_cost_metrics,
    get_audit_trail,
    get_drift_events,
    calculate_mttr,
    calculate_drift_frequency,
    get_top_drifting_controls,
    DecimalEncoder
)


class TestTenantMetrics(unittest.TestCase):
    """Test cases for tenant metrics Lambda endpoints."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.mock_context = Mock()
        self.tenant_id = 'tenant_test_123'
        
        # Mock event for /tenant/metrics
        self.metrics_event = {
            "httpMethod": "GET",
            "path": "/tenant/metrics",
            "queryStringParameters": {"timeRange": "30d"},
            "headers": {"Authorization": "Bearer mock_token"}
        }
        
        # Mock event for /tenant/compliance
        self.compliance_event = {
            "httpMethod": "GET",
            "path": "/tenant/compliance",
            "queryStringParameters": {"framework": "soc2"},
            "headers": {"Authorization": "Bearer mock_token"}
        }
    
    @patch('tenant_metrics.extract_tenant_id')
    @patch('tenant_metrics.get_compliance_status_data')
    @patch('tenant_metrics.get_usage_metrics_data')
    @patch('tenant_metrics.get_cost_metrics_data')
    def test_get_tenant_metrics_success(self, mock_cost, mock_usage, mock_compliance, mock_extract):
        """Test successful tenant metrics retrieval."""
        # Mock tenant extraction
        mock_extract.return_value = self.tenant_id
        
        # Mock data functions
        mock_compliance.return_value = {'score': 94.5}
        mock_usage.return_value = {'apiCalls': {'total': 45320}}
        mock_cost.return_value = {'currentMonth': 1245.67}
        
        # Call handler
        response = lambda_handler(self.metrics_event, self.mock_context)
        
        # Verify response
        self.assertEqual(response["statusCode"], 200)
        self.assertIn("Content-Type", response["headers"])
        self.assertEqual(response["headers"]["Content-Type"], "application/json")
        
        # Parse and verify body
        body = json.loads(response["body"])
        self.assertIn("compliance", body)
        self.assertIn("usage", body)
        self.assertIn("costs", body)
        self.assertIn("timestamp", body)
        self.assertEqual(body["compliance"]["score"], 94.5)
    
    @patch('tenant_metrics.extract_tenant_id')
    def test_unauthorized_request(self, mock_extract):
        """Test request with invalid auth token."""
        # Mock tenant extraction to raise ValueError
        mock_extract.side_effect = ValueError('Invalid or missing authorization token')
        
        # Call handler
        response = lambda_handler(self.metrics_event, self.mock_context)
        
        # Verify 401 response
        self.assertEqual(response["statusCode"], 401)
        body = json.loads(response["body"])
        self.assertIn("error", body)
    
    def test_invalid_path(self):
        """Test request with invalid path."""
        event = {
            "httpMethod": "GET",
            "path": "/tenant/invalid",
            "headers": {"Authorization": "Bearer mock_token"}
        }
        
        with patch('tenant_metrics.extract_tenant_id') as mock_extract:
            mock_extract.return_value = self.tenant_id
            response = lambda_handler(event, self.mock_context)
        
        # Verify 404 response
        self.assertEqual(response["statusCode"], 404)
        body = json.loads(response["body"])
        self.assertEqual(body["error"], "Not found")
    
    @patch('tenant_metrics.extract_tenant_id')
    @patch('tenant_metrics.get_compliance_status_data')
    def test_get_compliance_status(self, mock_data, mock_extract):
        """Test compliance status endpoint."""
        mock_extract.return_value = self.tenant_id
        mock_data.return_value = {
            'score': 94.5,
            'violations': {'critical': 2, 'high': 5},
            'frameworks': {
                'soc2': {'passed': 78, 'total': 82}
            }
        }
        
        response = lambda_handler(self.compliance_event, self.mock_context)
        
        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertEqual(body["score"], 94.5)
        self.assertEqual(body["violations"]["critical"], 2)
        self.assertEqual(body["frameworks"]["soc2"]["passed"], 78)
    
    def test_calculate_mttr(self):
        """Test MTTR calculation."""
        events = [
            {
                'status': 'resolved',
                'detection_timestamp': '2026-03-25T10:00:00Z',
                'resolution_timestamp': '2026-03-25T14:00:00Z'
            },
            {
                'status': 'resolved',
                'detection_timestamp': '2026-03-26T09:00:00Z',
                'resolution_timestamp': '2026-03-26T15:00:00Z'
            }
        ]
        
        mttr = calculate_mttr(events)
        
        # Expected: (4 hours + 6 hours) / 2 = 5 hours
        self.assertEqual(mttr, 5.0)
    
    def test_calculate_drift_frequency(self):
        """Test drift frequency calculation."""
        events = [
            {'control_category': 'Access Control'},
            {'control_category': 'Access Control'},
            {'control_category': 'Audit and Accountability'},
            {'control_category': 'Encryption'}
        ]
        
        frequency = calculate_drift_frequency(events)
        
        # Verify results
        self.assertEqual(len(frequency), 3)
        self.assertEqual(frequency[0]['category'], 'Access Control')
        self.assertEqual(frequency[0]['count'], 2)
    
    def test_get_top_drifting_controls(self):
        """Test top drifting controls extraction."""
        events = [
            {'control_id': 'AC-2', 'control_name': 'Account Management'},
            {'control_id': 'AC-2', 'control_name': 'Account Management'},
            {'control_id': 'IA-5', 'control_name': 'Authenticator Management'}
        ]
        
        top_controls = get_top_drifting_controls(events, limit=2)
        
        # Verify results
        self.assertEqual(len(top_controls), 2)
        self.assertEqual(top_controls[0]['count'], 2)
        self.assertIn('AC-2', top_controls[0]['control'])
    
    def test_decimal_encoder(self):
        """Test DecimalEncoder for DynamoDB Decimal types."""
        data = {
            'cost': Decimal('123.45'),
            'count': Decimal('10'),
            'name': 'test'
        }
        
        # Encode to JSON
        json_str = json.dumps(data, cls=DecimalEncoder)
        decoded = json.loads(json_str)
        
        # Verify Decimal converted to float
        self.assertEqual(decoded['cost'], 123.45)
        self.assertEqual(decoded['count'], 10)
        self.assertEqual(decoded['name'], 'test')
    
    @patch('tenant_metrics.extract_tenant_id')
    @patch('tenant_metrics.dynamodb')
    def test_get_audit_trail(self, mock_dynamodb, mock_extract):
        """Test audit trail retrieval."""
        mock_extract.return_value = self.tenant_id
        
        # Mock DynamoDB table
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.query.return_value = {
            'Items': [
                {
                    'event_id': 'evt_001',
                    'timestamp': '2026-03-28T10:00:00Z',
                    'resource_type': 'Policy',
                    'action': 'Updated'
                }
            ]
        }
        
        event = {
            "httpMethod": "GET",
            "path": "/tenant/audit-trail",
            "queryStringParameters": {"limit": "10", "offset": "0"},
            "headers": {"Authorization": "Bearer mock_token"}
        }
        
        response = lambda_handler(event, self.mock_context)
        
        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertIn("events", body)
        self.assertEqual(len(body["events"]), 1)
        self.assertEqual(body["events"][0]["event_id"], "evt_001")
    
    @patch('tenant_metrics.extract_tenant_id')
    @patch('tenant_metrics.dynamodb')
    def test_get_drift_events(self, mock_dynamodb, mock_extract):
        """Test drift events retrieval."""
        mock_extract.return_value = self.tenant_id
        
        # Mock DynamoDB table
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.query.return_value = {
            'Items': [
                {
                    'violation_id': 'viol_001',
                    'control_id': 'AC-2',
                    'severity': 'critical',
                    'status': 'open'
                }
            ]
        }
        
        event = {
            "httpMethod": "GET",
            "path": "/tenant/drift-events",
            "queryStringParameters": {"timeRange": "30d", "severity": "critical"},
            "headers": {"Authorization": "Bearer mock_token"}
        }
        
        response = lambda_handler(event, self.mock_context)
        
        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertIn("events", body)
        self.assertIn("analytics", body)
        self.assertEqual(body["events"][0]["violation_id"], "viol_001")
    
    def test_cors_headers(self):
        """Test CORS headers in response."""
        with patch('tenant_metrics.extract_tenant_id') as mock_extract:
            mock_extract.return_value = self.tenant_id
            response = lambda_handler(self.metrics_event, self.mock_context)
        
        # Verify CORS headers
        self.assertIn("Access-Control-Allow-Origin", response["headers"])
        self.assertEqual(response["headers"]["Access-Control-Allow-Origin"], "*")
        self.assertIn("Access-Control-Allow-Methods", response["headers"])


class TestHelperFunctions(unittest.TestCase):
    """Test helper functions in tenant_metrics module."""
    
    def test_calculate_mttr_empty_events(self):
        """Test MTTR calculation with no resolved events."""
        events = [
            {'status': 'open'},
            {'status': 'in_progress'}
        ]
        
        mttr = calculate_mttr(events)
        self.assertEqual(mttr, 0.0)
    
    def test_calculate_drift_frequency_empty(self):
        """Test drift frequency with empty events."""
        events = []
        
        frequency = calculate_drift_frequency(events)
        self.assertEqual(len(frequency), 0)
    
    def test_get_top_drifting_controls_limit(self):
        """Test top controls respects limit parameter."""
        events = [
            {'control_id': f'AC-{i}', 'control_name': f'Control {i}'}
            for i in range(20)
        ]
        
        top_controls = get_top_drifting_controls(events, limit=5)
        self.assertEqual(len(top_controls), 5)


if __name__ == '__main__':
    unittest.main()
