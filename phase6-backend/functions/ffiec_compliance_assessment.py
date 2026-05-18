"""NIST CSF 2.0 compliance assessment API for the fintech portal.

The legacy FFIEC CAT dashboard now surfaces live NIST CSF 2.0 posture data
derived from AWS Config managed rules. This Lambda supports both:

1. API Gateway GET /compliance/ffiec
2. Direct invocation with {"customer_id": "...", "role_arn": "..."}
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import ClientError

LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO), format='%(message)s')
logger = logging.getLogger(__name__)

dynamodb = boto3.resource('dynamodb')

FFIEC_ASSESSMENTS_TABLE = os.environ.get(
    'FFIEC_ASSESSMENTS_TABLE',
    'securebase-ffiec-assessments',
)
PORTAL_CORS_ORIGIN = os.environ.get('PORTAL_CORS_ORIGIN', 'https://portal.securebase.tximhotep.com')

FRAMEWORK_NAME = 'NIST CSF 2.0'
SCORE_STATUS_PASSING = 'Passing'
SCORE_STATUS_AT_RISK = 'At Risk'
SCORE_STATUS_CRITICAL = 'Critical'

NIST_CSF_FUNCTIONS: List[Dict[str, Any]] = [
    {
        'function': 'GV',
        'name': 'Govern',
        'controls': [
            {
                'mappingId': 'GV.OC-01-iam-password-policy',
                'controlId': 'GV.OC-01',
                'title': 'organizational context',
                'configRule': 'IAM_PASSWORD_POLICY',
            },
            {
                'mappingId': 'GV.OC-03-cloudtrail-enabled',
                'controlId': 'GV.OC-03',
                'title': 'legal and regulatory requirements',
                'configRule': 'CLOUD_TRAIL_ENABLED',
            },
            {
                'mappingId': 'GV.SC-07-secrets-rotation',
                'controlId': 'GV.SC-07',
                'title': 'supply chain risk',
                'configRule': 'SECRETSMANAGER_ROTATION_ENABLED_CHECK',
            },
        ],
    },
    {
        'function': 'ID',
        'name': 'Identify',
        'controls': [
            {
                'mappingId': 'ID.AM-01-config-enabled',
                'controlId': 'ID.AM-01',
                'title': 'asset inventory',
                'configRule': 'AWS_CONFIG_ENABLED',
            },
            {
                'mappingId': 'ID.RA-01-guardduty',
                'controlId': 'ID.RA-01',
                'title': 'vulnerability identification',
                'configRule': 'GUARDDUTY_ENABLED_CENTRALIZED',
            },
            {
                'mappingId': 'ID.AM-08-s3-versioning',
                'controlId': 'ID.AM-08',
                'title': 'systems and software managed',
                'configRule': 'S3_BUCKET_VERSIONING_ENABLED',
            },
        ],
    },
    {
        'function': 'PR',
        'name': 'Protect',
        'controls': [
            {
                'mappingId': 'PR.AA-01-mfa-console',
                'controlId': 'PR.AA-01',
                'title': 'identity management',
                'configRule': 'MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS',
            },
            {
                'mappingId': 'PR.DS-01-encrypted-volumes',
                'controlId': 'PR.DS-01',
                'title': 'data at rest',
                'configRule': 'ENCRYPTED_VOLUMES',
            },
            {
                'mappingId': 'PR.DS-02-s3-ssl-only',
                'controlId': 'PR.DS-02',
                'title': 'data in transit',
                'configRule': 'S3_BUCKET_SSL_REQUESTS_ONLY',
            },
            {
                'mappingId': 'PR.AC-03-s3-public-read',
                'controlId': 'PR.AC-03',
                'title': 'remote access',
                'configRule': 'S3_BUCKET_PUBLIC_READ_PROHIBITED',
            },
            {
                'mappingId': 'PR.AC-03-s3-public-write',
                'controlId': 'PR.AC-03',
                'title': 'remote access',
                'configRule': 'S3_BUCKET_PUBLIC_WRITE_PROHIBITED',
            },
            {
                'mappingId': 'PR.DS-01-rds-storage-encrypted',
                'controlId': 'PR.DS-01',
                'title': 'data at rest',
                'configRule': 'RDS_STORAGE_ENCRYPTED',
            },
            {
                'mappingId': 'PR.AA-05-iam-inline-policy',
                'controlId': 'PR.AA-05',
                'title': 'access permissions',
                'configRule': 'IAM_NO_INLINE_POLICY_CHECK',
            },
        ],
    },
    {
        'function': 'DE',
        'name': 'Detect',
        'controls': [
            {
                'mappingId': 'DE.AE-02-cloudtrail-validation',
                'controlId': 'DE.AE-02',
                'title': 'anomaly analysis',
                'configRule': 'CLOUD_TRAIL_LOG_FILE_VALIDATION_ENABLED',
            },
            {
                'mappingId': 'DE.CM-01-vpc-flow-logs',
                'controlId': 'DE.CM-01',
                'title': 'networks monitored',
                'configRule': 'VPC_FLOW_LOGS_ENABLED',
            },
            {
                'mappingId': 'DE.CM-09-cloudwatch-alarm-actions',
                'controlId': 'DE.CM-09',
                'title': 'computing hardware monitored',
                'configRule': 'CLOUDWATCH_ALARM_ACTION_CHECK',
            },
        ],
    },
    {
        'function': 'RS',
        'name': 'Respond',
        'controls': [
            {
                'mappingId': 'RS.MA-01-kms-cmk',
                'controlId': 'RS.MA-01',
                'title': 'incident management',
                'configRule': 'KMS_CMK_NOT_SCHEDULED_FOR_DELETION',
            },
            {
                'mappingId': 'RS.CO-02-api-gw-ssl',
                'controlId': 'RS.CO-02',
                'title': 'encrypted API communication',
                'configRule': 'API_GW_SSL_ENABLED',
            },
        ],
    },
    {
        'function': 'RC',
        'name': 'Recover',
        'controls': [
            {
                'mappingId': 'RC.RP-01-rds-multi-az',
                'controlId': 'RC.RP-01',
                'title': 'recovery plan executed',
                'configRule': 'RDS_MULTI_AZ_SUPPORT',
            },
            {
                'mappingId': 'RC.RP-01-dynamodb-backup',
                'controlId': 'RC.RP-01',
                'title': 'recovery plan executed',
                'configRule': 'DYNAMODB_IN_BACKUP_PLAN',
            },
        ],
    },
]


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def _log(level: str, message: str, **kwargs: Any) -> None:
    payload = {
        'level': level.upper(),
        'message': message,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs,
    }
    getattr(logger, level.lower(), logger.info)(json.dumps(payload))


def _response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': PORTAL_CORS_ORIGIN,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        },
        'isBase64Encoded': False,
        'body': json.dumps(body, cls=DecimalEncoder),
    }


def _error(status_code: int, message: str) -> Dict[str, Any]:
    return _response(status_code, {'error': message})


def _score_status(score: float) -> str:
    if score >= 80:
        return SCORE_STATUS_PASSING
    if score >= 60:
        return SCORE_STATUS_AT_RISK
    return SCORE_STATUS_CRITICAL


def _extract_customer_id(event: Dict[str, Any]) -> Optional[str]:
    authorizer = (event.get('requestContext') or {}).get('authorizer') or {}

    for key in ('customer_id', 'tenant_id', 'sub'):
        value = authorizer.get(key)
        if value:
            return str(value)

    claims = authorizer.get('claims') or {}
    if isinstance(claims, dict):
        for key in ('customer_id', 'tenant_id', 'sub'):
            value = claims.get(key)
            if value:
                return str(value)

    return None


def _build_session(target_customer: str, role_arn: Optional[str]) -> boto3.Session:
    try:
        if role_arn:
            external_id = os.environ.get('SECUREBASE_EXTERNAL_ID', '').strip()
            if not external_id:
                raise RuntimeError(
                    'SECUREBASE_EXTERNAL_ID environment variable must be configured '
                    '(non-empty) whenever role_arn is provided'
                )
            sts = boto3.client('sts')
            assumed = sts.assume_role(
                RoleArn=role_arn,
                RoleSessionName=f'securebase-scan-{target_customer}',
                ExternalId=external_id,
            )
            creds = assumed['Credentials']
            return boto3.Session(
                aws_access_key_id=creds['AccessKeyId'],
                aws_secret_access_key=creds['SecretAccessKey'],
                aws_session_token=creds['SessionToken'],
            )
        return boto3.Session()
    except ClientError as exc:
        _log('error', 'Failed to initialize AWS session', customer_id=target_customer, error=str(exc))
        raise


def _get_config_compliance(rule_names: List[str], config_client: Any) -> Dict[str, str]:
    compliance_map: Dict[str, str] = {rule_name: 'INSUFFICIENT_DATA' for rule_name in rule_names}
    if not rule_names:
        return compliance_map

    try:
        paginator = config_client.get_paginator('describe_compliance_by_config_rule')
        for page in paginator.paginate(
            ConfigRuleNames=rule_names,
            ComplianceTypes=['COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE', 'INSUFFICIENT_DATA'],
        ):
            for item in page.get('ComplianceByConfigRules', []):
                rule_name = item.get('ConfigRuleName')
                if not rule_name:
                    continue
                compliance_map[rule_name] = item.get('Compliance', {}).get(
                    'ComplianceType',
                    'INSUFFICIENT_DATA',
                )
    except ClientError as exc:
        _log('warning', 'AWS Config query failed', error=str(exc))

    return compliance_map


def _control_payload(control: Dict[str, str], compliance_map: Dict[str, str]) -> Dict[str, Any]:
    status = compliance_map.get(control['configRule'], 'INSUFFICIENT_DATA')
    return {
        'mappingId': control['mappingId'],
        'controlId': control['controlId'],
        'title': control['title'],
        'configRule': control['configRule'],
        'status': status,
        'passed': status == 'COMPLIANT',
    }


def _build_assessment_payload(customer_id: str, compliance_map: Dict[str, str]) -> Dict[str, Any]:
    categories: List[Dict[str, Any]] = []
    total_controls = 0
    total_passed = 0
    assessed_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    for category in NIST_CSF_FUNCTIONS:
        controls = [
            _control_payload(control, compliance_map)
            for control in category['controls']
        ]
        passed = sum(1 for control in controls if control['passed'])
        total = len(controls)
        score = round((passed / total) * 100, 2) if total else 0.0

        categories.append({
            'function': category['function'],
            'name': category['name'],
            'score': score,
            'passed': passed,
            'total': total,
            'status': _score_status(score),
            'controls': controls,
        })

        total_controls += total
        total_passed += passed

    overall_score = round((total_passed / total_controls) * 100, 2) if total_controls else 0.0

    return {
        'customer_id': customer_id,
        'framework': FRAMEWORK_NAME,
        'overallScore': overall_score,
        'status': _score_status(overall_score),
        'passed': total_passed,
        'total': total_controls,
        'assessedAt': assessed_at,
        'categories': categories,
    }


def _to_dynamodb_value(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, list):
        return [_to_dynamodb_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _to_dynamodb_value(item) for key, item in value.items()}
    return value


def _write_snapshot(customer_id: str, payload: Dict[str, Any], dry_run: bool = False) -> None:
    now = datetime.now(timezone.utc)
    item = _to_dynamodb_value({
        'customer_id': customer_id,
        'framework': payload['framework'],
        'overallScore': payload['overallScore'],
        'status': payload['status'],
        'passed': payload['passed'],
        'total': payload['total'],
        'categories': payload['categories'],
        'assessedAt': payload['assessedAt'],
        'snapshot_id': str(uuid.uuid4()),
        'updated_at': now.isoformat(),
        'ttl': int(now.replace(year=now.year + 1).timestamp()),
    })

    if dry_run:
        _log('info', 'dry_run: would write ffiec assessment snapshot', customer_id=customer_id)
        return

    table = dynamodb.Table(FFIEC_ASSESSMENTS_TABLE)
    table.put_item(Item=item)
    _log(
        'info',
        'ffiec assessment snapshot written',
        customer_id=customer_id,
        table=FFIEC_ASSESSMENTS_TABLE,
        overall_score=payload['overallScore'],
    )


def _run_assessment(customer_id: str, role_arn: Optional[str], dry_run: bool = False) -> Dict[str, Any]:
    session = _build_session(customer_id, role_arn)
    config_client = session.client('config')

    rule_names = [
        control['configRule']
        for category in NIST_CSF_FUNCTIONS
        for control in category['controls']
    ]
    compliance_map = _get_config_compliance(rule_names, config_client)
    payload = _build_assessment_payload(customer_id, compliance_map)
    _write_snapshot(customer_id, payload, dry_run=dry_run)
    return payload


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    request_id = getattr(context, 'aws_request_id', str(uuid.uuid4()))
    event = event or {}
    method = event.get('httpMethod')

    _log('info', 'ffiec_compliance_assessment invoked', request_id=request_id)

    if method == 'OPTIONS':
        return _response(200, {})

    if method:
        if method != 'GET':
            return _error(405, 'Method not allowed')

        qs = event.get('queryStringParameters') or {}
        customer_id = qs.get('customer_id') or _extract_customer_id(event) or 'platform'
        role_arn = qs.get('role_arn')

        try:
            payload = _run_assessment(customer_id, role_arn=role_arn, dry_run=False)
        except RuntimeError as exc:
            _log('error', 'Cross-account configuration error', request_id=request_id, error=str(exc))
            return _error(500, str(exc))
        except ClientError as exc:
            _log('error', 'Failed to generate ffiec assessment', request_id=request_id, error=str(exc))
            return _error(503, 'Service temporarily unavailable')

        return _response(200, payload)

    dry_run = bool(event.get('dry_run', False))
    customer_id = event.get('customer_id') or 'platform'
    role_arn = event.get('role_arn')
    return _run_assessment(customer_id, role_arn=role_arn, dry_run=dry_run)
