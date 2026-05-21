"""Unit tests for the HIPAA compliance assessment Lambda."""

import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

FUNCTIONS_DIR = os.path.join(
    os.path.dirname(__file__), '..', '..', 'phase6-backend', 'functions'
)
sys.path.insert(0, os.path.abspath(FUNCTIONS_DIR))


def _make_context():
    ctx = MagicMock()
    ctx.aws_request_id = 'test-request-id-hipaa-001'
    return ctx


class TestBuildAssessmentPayload:
    def _get_module(self):
        with patch('boto3.resource'), patch('boto3.client'):
            import importlib
            import hipaa_compliance_assessment
            importlib.reload(hipaa_compliance_assessment)
            return hipaa_compliance_assessment

    def test_payload_matches_dashboard_shape(self):
        mod = self._get_module()
        compliance_map = {rule['config_rule']: 'COMPLIANT' for rule in mod.ALL_RULES}

        payload = mod._build_assessment_payload('tenant-123', compliance_map)

        assert payload['overallScore'] == pytest.approx(100.0)
        assert payload['riskLevel'] == 'low'
        assert set(payload['safeguards'].keys()) == {'administrative', 'physical', 'technical'}
        assert payload['safeguards']['administrative']['passed'] == 5
        assert payload['safeguards']['physical']['passed'] == 3
        assert payload['safeguards']['technical']['passed'] == 5
        assert isinstance(payload['findings'], list)
        assert isinstance(payload['phiLocations'], list)
        assert isinstance(payload['phiAccessLog'], list)

    def test_unresolved_controls_become_findings(self):
        mod = self._get_module()
        compliance_map = {
            'mfa-enabled-for-iam-console-access': 'NON_COMPLIANT',
            'iam-password-policy': 'INSUFFICIENT_DATA',
            'guardduty-enabled-centralized': 'COMPLIANT',
            'cloudtrail-enabled': 'COMPLIANT',
            'secretsmanager-rotation-enabled-check': 'COMPLIANT',
            'ec2-imdsv2-check': 'NON_COMPLIANT',
            's3-bucket-public-read-prohibited': 'COMPLIANT',
            's3-bucket-public-write-prohibited': 'COMPLIANT',
            'encrypted-volumes': 'COMPLIANT',
            'rds-storage-encrypted': 'COMPLIANT',
            's3-bucket-ssl-requests-only': 'COMPLIANT',
            'vpc-flow-logs-enabled': 'COMPLIANT',
            'api-gw-ssl-enabled': 'INSUFFICIENT_DATA',
        }

        payload = mod._build_assessment_payload('tenant-123', compliance_map)

        assert payload['overallScore'] < 100
        assert payload['findings']
        assert any(finding['control'] == '164.308(a)(4)' for finding in payload['findings'])
        assert any(finding['status'] == 'in_progress' for finding in payload['findings'])


class TestLambdaHandler:
    def _get_module(self):
        with patch('boto3.resource'), patch('boto3.client'):
            import importlib
            import hipaa_compliance_assessment
            importlib.reload(hipaa_compliance_assessment)
            return hipaa_compliance_assessment

    def test_handler_defaults_to_platform_session_when_role_missing(self):
        mod = self._get_module()

        with patch.object(mod, '_assess_tenant', return_value={'overallScore': 84.6, 'findings': []}) as mock_assess, \
             patch.object(mod.boto3, 'Session', return_value=MagicMock()) as mock_session:
            result = mod.lambda_handler({'customer_id': 'tenant-123'}, _make_context())

        assert result['overallScore'] == pytest.approx(84.6)
        mock_session.assert_called_once_with()
        called_args, called_kwargs = mock_assess.call_args
        assert called_args[0] == 'tenant-123'
        assert called_kwargs['role_mode'] == 'platform'
        assert called_kwargs['dry_run'] is False

    def test_handler_assumes_role_when_role_arn_is_provided(self):
        mod = self._get_module()

        with patch.object(mod, '_assess_tenant', return_value={'overallScore': 92.0, 'findings': []}) as mock_assess, \
             patch.object(mod.boto3, 'client') as mock_boto_client, \
             patch.object(mod.boto3, 'Session', return_value=MagicMock()) as mock_session, \
             patch.dict('os.environ', {'SECUREBASE_EXTERNAL_ID': 'external-id-123'}, clear=False):
            mock_boto_client.return_value.assume_role.return_value = {
                'Credentials': {
                    'AccessKeyId': 'ak',
                    'SecretAccessKey': 'sk',
                    'SessionToken': 'st',
                }
            }

            result = mod.lambda_handler(
                {'customer_id': 'tenant-123', 'role_arn': 'arn:aws:iam::123456789012:role/SecureBaseReadOnlyRole'},
                _make_context(),
            )

        assert result['overallScore'] == pytest.approx(92.0)
        called_args, called_kwargs = mock_assess.call_args
        assert called_args[0] == 'tenant-123'
        assert called_kwargs['role_mode'] == 'cross_account'
        assert called_kwargs['session'] is mock_session.return_value

    def test_api_gateway_request_returns_proxy_response(self):
        mod = self._get_module()

        with patch.object(mod, '_assess_tenant', return_value={'overallScore': 88.0, 'findings': []}), \
             patch.object(mod.boto3, 'Session', return_value=MagicMock()):
            response = mod.lambda_handler({
                'httpMethod': 'GET',
                'path': '/compliance/hipaa',
                'requestContext': {'authorizer': {'customer_id': 'tenant-456'}},
            }, _make_context())

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['overallScore'] == pytest.approx(88.0)

    def test_api_gateway_missing_customer_id_returns_400(self):
        mod = self._get_module()

        response = mod.lambda_handler({
            'httpMethod': 'GET',
            'path': '/compliance/hipaa',
            'requestContext': {'authorizer': {}},
        }, _make_context())

        assert response['statusCode'] == 400
