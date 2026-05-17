"""Unit tests for phase6-backend/functions/compliance_history_api.py."""

import importlib
import json
import os
import sys
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError

FUNCTIONS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'phase6-backend', 'functions')
)
if FUNCTIONS_DIR not in sys.path:
    sys.path.insert(0, FUNCTIONS_DIR)


def _ctx() -> MagicMock:
    ctx = MagicMock()
    ctx.aws_request_id = 'test-request-id'
    return ctx


def _event(qs=None, authorizer=None, method='GET'):
    auth_payload = {'customer_id': 'tenant-123'} if authorizer is None else authorizer
    return {
        'httpMethod': method,
        'queryStringParameters': qs or {},
        'requestContext': {
            'authorizer': auth_payload,
        },
    }


def _load_module():
    import compliance_history_api
    return importlib.reload(compliance_history_api)


class ComplianceHistoryApiTests(unittest.TestCase):
    def setUp(self):
        self.score_items = [
            {'PK': 'CUSTOMER#tenant-123', 'SK': 'FRAMEWORK#SOC2#DATE#2026-05-17', 'framework': 'SOC2', 'score_date': '2026-05-17', 'score': Decimal('84')},
            {'PK': 'CUSTOMER#tenant-123', 'SK': 'FRAMEWORK#SOC2#DATE#2026-05-10', 'framework': 'SOC2', 'score_date': '2026-05-10', 'score': Decimal('78')},
            {'PK': 'CUSTOMER#tenant-123', 'SK': 'FRAMEWORK#SOC2#DATE#2026-04-17', 'framework': 'SOC2', 'score_date': '2026-04-17', 'score': Decimal('79')},
            {'PK': 'CUSTOMER#tenant-123', 'SK': 'FRAMEWORK#HIPAA#DATE#2026-05-17', 'framework': 'HIPAA', 'score_date': '2026-05-17', 'score': Decimal('72')},
            {'PK': 'CUSTOMER#tenant-123', 'SK': 'FRAMEWORK#HIPAA#DATE#2026-04-17', 'framework': 'HIPAA', 'score_date': '2026-04-17', 'score': Decimal('72')},
            {'PK': 'CUSTOMER#tenant-123', 'SK': 'FRAMEWORK#FedRAMP#DATE#2026-05-17', 'framework': 'FedRAMP', 'score_date': '2026-05-17', 'score': Decimal('55')},
            {'PK': 'CUSTOMER#tenant-123', 'SK': 'FRAMEWORK#FedRAMP#DATE#2026-04-17', 'framework': 'FedRAMP', 'score_date': '2026-04-17', 'score': Decimal('60')},
        ]
        self.violation_items = [
            {
                'PK': 'CUSTOMER#tenant-123',
                'SK': 'CONTROL#SOC2#CC6.1#DATE#2026-05-17',
                'framework': 'SOC2',
                'control_id': 'CC6.1',
                'control_name': 'Logical and Physical Access Controls',
                'rule_name': 'iam-user-mfa-enabled',
                'severity': 'CRITICAL',
                'status': 'NON_COMPLIANT',
                'recorded_date': '2026-05-15',
            },
            {
                'PK': 'CUSTOMER#tenant-123',
                'SK': 'CONTROL#HIPAA#164.312#DATE#2026-05-17',
                'framework': 'HIPAA',
                'control_id': 'HIPAA-164.312(b)',
                'control_name': 'Audit Controls',
                'rule_name': 'cloudtrail-enabled',
                'severity': 'HIGH',
                'status': 'NON_COMPLIANT',
                'recorded_date': '2026-05-14',
            },
        ]

    def _build_module_with_tables(self, score_table_side_effect=None, violation_table_side_effect=None):
        with patch('boto3.resource') as mock_resource:
            mod = _load_module()
            mod.dynamodb = mock_resource.return_value

            score_table = MagicMock()
            if score_table_side_effect:
                score_table.query.side_effect = score_table_side_effect
            else:
                score_table.query.return_value = {'Items': self.score_items}

            violation_table = MagicMock()
            if violation_table_side_effect:
                violation_table.query.side_effect = violation_table_side_effect
            else:
                violation_table.query.return_value = {'Items': self.violation_items}

            def select_table(name):
                if name == mod.COMPLIANCE_SCORES_TABLE:
                    return score_table
                if name == mod.CONTROL_VIOLATIONS_TABLE:
                    return violation_table
                raise AssertionError(f'unexpected table {name}')

            mod.dynamodb.Table.side_effect = select_table
            return mod

    def test_unauthenticated_request_returns_401(self):
        mod = self._build_module_with_tables()
        result = mod.lambda_handler(_event(authorizer={}), _ctx())
        self.assertEqual(result['statusCode'], 401)

    def test_invalid_framework_returns_400(self):
        mod = self._build_module_with_tables()
        result = mod.lambda_handler(_event(qs={'framework': 'PCI'}), _ctx())
        self.assertEqual(result['statusCode'], 400)

    def test_invalid_days_returns_400(self):
        mod = self._build_module_with_tables()
        result = mod.lambda_handler(_event(qs={'days': '45'}), _ctx())
        self.assertEqual(result['statusCode'], 400)

    def test_all_frameworks_response_shape(self):
        mod = self._build_module_with_tables()
        result = mod.lambda_handler(_event(qs={'days': '90', 'framework': 'all'}), _ctx())
        self.assertEqual(result['statusCode'], 200)

        body = json.loads(result['body'])
        self.assertEqual(body['tenant_id'], 'tenant-123')
        self.assertIn('generated_at', body)
        self.assertIn('frameworks', body)
        self.assertEqual(set(body['frameworks'].keys()), {'SOC2', 'HIPAA', 'FedRAMP'})

        soc2 = body['frameworks']['SOC2']
        self.assertEqual(soc2['current_score'], 84.0)
        self.assertEqual(soc2['status'], 'Passing')
        self.assertEqual(soc2['trend'], 'Improving')
        self.assertIn('history', soc2)
        self.assertIn('violations', soc2)
        self.assertEqual(soc2['violations'][0]['control_id'], 'CC6.1')

        hipaa = body['frameworks']['HIPAA']
        self.assertEqual(hipaa['status'], 'At Risk')

        fedramp = body['frameworks']['FedRAMP']
        self.assertEqual(fedramp['status'], 'Failing')
        self.assertEqual(fedramp['trend'], 'Declining')

    def test_framework_filter_returns_single_framework(self):
        mod = self._build_module_with_tables()
        result = mod.lambda_handler(_event(qs={'framework': 'SOC2', 'days': '30'}), _ctx())
        self.assertEqual(result['statusCode'], 200)
        body = json.loads(result['body'])
        self.assertEqual(list(body['frameworks'].keys()), ['SOC2'])

    def test_options_returns_200(self):
        mod = self._build_module_with_tables()
        result = mod.lambda_handler({'httpMethod': 'OPTIONS'}, _ctx())
        self.assertEqual(result['statusCode'], 200)

    def test_non_get_returns_405(self):
        mod = self._build_module_with_tables()
        result = mod.lambda_handler(_event(method='POST'), _ctx())
        self.assertEqual(result['statusCode'], 405)

    def test_dynamodb_error_returns_503(self):
        err = ClientError(
            {'Error': {'Code': 'ProvisionedThroughputExceededException', 'Message': 'Rate exceeded'}},
            'Query',
        )
        mod = self._build_module_with_tables(score_table_side_effect=err)
        result = mod.lambda_handler(_event(), _ctx())
        self.assertEqual(result['statusCode'], 503)


if __name__ == '__main__':
    unittest.main()
