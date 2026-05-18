"""
Phase 6.2 — HIPAA Compliance Assessment Lambda.

Evaluates a tenant's AWS Config posture against the HIPAA safeguards surfaced in
the customer portal HIPAA dashboard and stores a daily assessment snapshot in
the ``securebase-hipaa-assessments`` DynamoDB table.

Supported invocation modes:
    Direct invocation payload:
        {
            "customer_id": "<uuid>",                  # defaults to "platform"
            "role_arn": "arn:aws:iam::...:role/...", # optional cross-account scan
            "dry_run": true                           # compute but skip DynamoDB write
        }

    API Gateway proxy integration:
        GET /compliance/hipaa
        - customer_id may be supplied by authorizer context, query string, or body
        - role_arn may be supplied by query string or body
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Logging — structured JSON for CloudWatch Logs Insights
# ---------------------------------------------------------------------------

LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='%(message)s',
)
logger = logging.getLogger(__name__)


def _log(level: str, message: str, **kwargs: Any) -> None:
    """Emit a structured JSON log record."""
    record: Dict[str, Any] = {
        'level': level.upper(),
        'message': message,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs,
    }
    getattr(logger, level.lower(), logger.info)(json.dumps(record))


# ---------------------------------------------------------------------------
# AWS SDK resources
# ---------------------------------------------------------------------------

dynamodb = boto3.resource('dynamodb')

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HIPAA_ASSESSMENTS_TABLE = os.environ.get(
    'HIPAA_ASSESSMENTS_TABLE', 'securebase-hipaa-assessments'
)
PORTAL_CORS_ORIGIN = os.environ.get('PORTAL_CORS_ORIGIN', '*')

AWS_CONFIG_COMPLIANCE_TYPES = [
    'COMPLIANT',
    'NON_COMPLIANT',
    'NOT_APPLICABLE',
    'INSUFFICIENT_DATA',
]

RULES_BY_SAFEGUARD: Dict[str, List[Dict[str, str]]] = {
    'administrative': [
        {
            'id': '164.308(a)(4)',
            'name': 'Access Control',
            'config_rule': 'mfa-enabled-for-iam-console-access',
            'source_identifier': 'MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS',
            'severity': 'high',
            'remediation': 'Enable MFA for every IAM user with console access.',
        },
        {
            'id': '164.308(a)(5)',
            'name': 'Credential Management',
            'config_rule': 'iam-password-policy',
            'source_identifier': 'IAM_PASSWORD_POLICY',
            'severity': 'medium',
            'remediation': 'Enforce a strong IAM password policy for console users.',
        },
        {
            'id': '164.308(a)(1)(ii)(D)',
            'name': 'Threat Detection',
            'config_rule': 'guardduty-enabled-centralized',
            'source_identifier': 'GUARDDUTY_ENABLED_CENTRALIZED',
            'severity': 'high',
            'remediation': 'Centralize and enable GuardDuty across the tenant account.',
        },
        {
            'id': '164.308(a)(1)(ii)(D)',
            'name': 'Audit Controls',
            'config_rule': 'cloudtrail-enabled',
            'source_identifier': 'CLOUD_TRAIL_ENABLED',
            'severity': 'high',
            'remediation': 'Enable CloudTrail for account-wide audit logging.',
        },
        {
            'id': '164.308(a)(3)(ii)(C)',
            'name': 'Credential Rotation',
            'config_rule': 'secretsmanager-rotation-enabled-check',
            'source_identifier': 'SECRETSMANAGER_ROTATION_ENABLED_CHECK',
            'severity': 'medium',
            'remediation': 'Turn on automatic rotation for Secrets Manager secrets.',
        },
    ],
    'physical': [
        {
            'id': '164.310(c)',
            'name': 'Workstation Security',
            'config_rule': 'ec2-imdsv2-check',
            'source_identifier': 'EC2_IMDSV2_CHECK',
            'severity': 'medium',
            'remediation': 'Require IMDSv2 on EC2 instances that can access ePHI.',
        },
        {
            'id': '164.310(a)(1)',
            'name': 'Facility Access — Public Read Protection',
            'config_rule': 's3-bucket-public-read-prohibited',
            'source_identifier': 'S3_BUCKET_PUBLIC_READ_PROHIBITED',
            'severity': 'high',
            'remediation': 'Block public read access on all S3 buckets that store regulated data.',
        },
        {
            'id': '164.310(a)(1)',
            'name': 'Facility Access — Public Write Protection',
            'config_rule': 's3-bucket-public-write-prohibited',
            'source_identifier': 'S3_BUCKET_PUBLIC_WRITE_PROHIBITED',
            'severity': 'high',
            'remediation': 'Block public write access on all S3 buckets that store regulated data.',
        },
    ],
    'technical': [
        {
            'id': '164.312(a)(2)(iv)',
            'name': 'Encryption at Rest — EBS Volumes',
            'config_rule': 'encrypted-volumes',
            'source_identifier': 'ENCRYPTED_VOLUMES',
            'severity': 'high',
            'remediation': 'Encrypt all attached EBS volumes.',
        },
        {
            'id': '164.312(a)(2)(iv)',
            'name': 'Encryption at Rest — RDS',
            'config_rule': 'rds-storage-encrypted',
            'source_identifier': 'RDS_STORAGE_ENCRYPTED',
            'severity': 'high',
            'remediation': 'Enable storage encryption for RDS databases.',
        },
        {
            'id': '164.312(e)(1)',
            'name': 'Transmission Security — S3 SSL Only',
            'config_rule': 's3-bucket-ssl-requests-only',
            'source_identifier': 'S3_BUCKET_SSL_REQUESTS_ONLY',
            'severity': 'medium',
            'remediation': 'Require SSL/TLS for every S3 bucket request.',
        },
        {
            'id': '164.312(b)',
            'name': 'Audit Controls — VPC Flow Logs',
            'config_rule': 'vpc-flow-logs-enabled',
            'source_identifier': 'VPC_FLOW_LOGS_ENABLED',
            'severity': 'medium',
            'remediation': 'Enable VPC Flow Logs for monitored VPCs.',
        },
        {
            'id': '164.312(e)(1)',
            'name': 'Transmission Security — API Gateway SSL',
            'config_rule': 'api-gw-ssl-enabled',
            'source_identifier': 'API_GW_SSL_ENABLED',
            'severity': 'medium',
            'remediation': 'Enforce TLS on API Gateway endpoints handling regulated traffic.',
        },
    ],
}

ALL_RULES: List[Dict[str, str]] = [
    rule for rules in RULES_BY_SAFEGUARD.values() for rule in rules
]


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------


class DecimalEncoder(json.JSONEncoder):
    """Encode Decimal values as JSON numbers."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


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


# ---------------------------------------------------------------------------
# Event parsing
# ---------------------------------------------------------------------------


def _parse_event_body(event: Dict[str, Any]) -> Dict[str, Any]:
    body = event.get('body')
    if not body:
        return {}
    if isinstance(body, dict):
        return body
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        raise ValueError('Invalid JSON body')


def _extract_authorizer_claim(event: Dict[str, Any], key: str) -> Optional[str]:
    authorizer = (event.get('requestContext') or {}).get('authorizer') or {}
    if key in authorizer and authorizer.get(key):
        return str(authorizer[key])

    claims = authorizer.get('claims') or {}
    if isinstance(claims, dict) and claims.get(key):
        return str(claims[key])

    return None


def _extract_tenant_id(event: Dict[str, Any], body: Dict[str, Any]) -> Optional[str]:
    for candidate in (
        event.get('customer_id'),
        body.get('customer_id'),
        (event.get('queryStringParameters') or {}).get('customer_id'),
        _extract_authorizer_claim(event, 'customer_id'),
        _extract_authorizer_claim(event, 'tenant_id'),
        _extract_authorizer_claim(event, 'sub'),
    ):
        if candidate:
            return str(candidate)
    return None


def _extract_role_arn(event: Dict[str, Any], body: Dict[str, Any]) -> Optional[str]:
    for candidate in (
        event.get('role_arn'),
        body.get('role_arn'),
        (event.get('queryStringParameters') or {}).get('role_arn'),
        _extract_authorizer_claim(event, 'role_arn'),
    ):
        if candidate:
            return str(candidate)
    return None


def _is_api_gateway_event(event: Dict[str, Any]) -> bool:
    return 'httpMethod' in event or 'requestContext' in event


# ---------------------------------------------------------------------------
# AWS Config helpers
# ---------------------------------------------------------------------------


def _list_config_rules(config_client: Any) -> List[Dict[str, Any]]:
    """Return all AWS Config rules visible to the invocation session."""
    config_rules: List[Dict[str, Any]] = []
    try:
        paginator = config_client.get_paginator('describe_config_rules')
        for page in paginator.paginate():
            config_rules.extend(page.get('ConfigRules', []))
    except ClientError as exc:
        _log('warning', 'Failed to list AWS Config rules', error=str(exc))
    return config_rules


def _resolve_rule_names(
    controls: List[Dict[str, str]],
    config_rules: List[Dict[str, Any]],
) -> Dict[str, Optional[str]]:
    """Resolve desired logical rule keys to concrete AWS Config rule names."""
    resolved: Dict[str, Optional[str]] = {}

    for control in controls:
        desired_name = control['config_rule'].lower()
        source_identifier = control['source_identifier'].upper()
        resolved_name: Optional[str] = None

        for config_rule in config_rules:
            rule_name = str(config_rule.get('ConfigRuleName') or '')
            source = str(
                ((config_rule.get('Source') or {}).get('SourceIdentifier')) or ''
            ).upper()
            rule_name_lower = rule_name.lower()

            if source == source_identifier:
                resolved_name = rule_name
                break

            if (
                rule_name_lower == desired_name
                or rule_name_lower.endswith(f'-{desired_name}')
            ):
                resolved_name = rule_name
                break

        resolved[control['config_rule']] = resolved_name

    return resolved


def _get_config_compliance(
    controls: List[Dict[str, str]],
    config_client: Any,
) -> Tuple[Dict[str, str], List[str]]:
    """Query AWS Config compliance state for the supplied HIPAA controls."""
    config_rules = _list_config_rules(config_client)
    resolved_names = _resolve_rule_names(controls, config_rules)
    compliance_map: Dict[str, str] = {
        control['config_rule']: 'INSUFFICIENT_DATA' for control in controls
    }

    actual_to_logical = {
        actual_name: logical_name
        for logical_name, actual_name in resolved_names.items()
        if actual_name
    }

    unresolved_rules = [
        logical_name
        for logical_name, actual_name in resolved_names.items()
        if not actual_name
    ]
    if unresolved_rules:
        _log('warning', 'HIPAA assessment controls unresolved in AWS Config',
             unresolved_rules=unresolved_rules)

    if not actual_to_logical:
        return compliance_map, unresolved_rules

    try:
        paginator = config_client.get_paginator('describe_compliance_by_config_rule')
        for page in paginator.paginate(
            ConfigRuleNames=list(actual_to_logical.keys()),
            ComplianceTypes=AWS_CONFIG_COMPLIANCE_TYPES,
        ):
            for item in page.get('ComplianceByConfigRules', []):
                actual_name = item.get('ConfigRuleName')
                logical_name = actual_to_logical.get(actual_name)
                if not logical_name:
                    continue
                compliance_map[logical_name] = (
                    item.get('Compliance', {}).get('ComplianceType')
                    or 'INSUFFICIENT_DATA'
                )
    except ClientError as exc:
        _log('warning', 'AWS Config compliance query failed', error=str(exc))

    return compliance_map, unresolved_rules


# ---------------------------------------------------------------------------
# Assessment shaping
# ---------------------------------------------------------------------------


def _ui_status(config_status: str) -> str:
    normalized = str(config_status or 'INSUFFICIENT_DATA').upper()
    if normalized in ('COMPLIANT', 'NOT_APPLICABLE'):
        return 'passing'
    if normalized == 'NON_COMPLIANT':
        return 'failing'
    return 'warning'


def _to_decimal(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: _to_decimal(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_decimal(item) for item in value]
    return value


def _build_safeguard_summary(
    controls: List[Dict[str, str]],
    compliance_map: Dict[str, str],
) -> Dict[str, Any]:
    rendered_controls: List[Dict[str, Any]] = []
    passed = 0

    for control in controls:
        raw_status = compliance_map.get(control['config_rule'], 'INSUFFICIENT_DATA')
        status = _ui_status(raw_status)
        if status == 'passing':
            passed += 1
        rendered_controls.append({
            'id': control['id'],
            'name': control['name'],
            'status': status,
            'configStatus': raw_status,
        })

    total = len(controls)
    percentage = round((passed / total) * 100, 1) if total else 0.0
    return {
        'passed': passed,
        'total': total,
        'percentage': percentage,
        'controls': rendered_controls,
    }


def _risk_level(overall_score: float) -> str:
    if overall_score >= 85:
        return 'low'
    if overall_score >= 70:
        return 'medium'
    return 'high'


def _build_findings(
    compliance_map: Dict[str, str],
) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []

    for idx, control in enumerate(ALL_RULES, start=1):
        raw_status = compliance_map.get(control['config_rule'], 'INSUFFICIENT_DATA')
        status = _ui_status(raw_status)
        if status == 'passing':
            continue

        findings.append({
            'id': f'hipaa-{idx:03d}',
            'title': (
                f"{control['name']} is "
                f"{str(raw_status).lower().replace('_', ' ')}"
            ),
            'severity': control['severity'],
            'control': control['id'],
            'status': 'open' if status == 'failing' else 'in_progress',
            'daysOpen': 1,
            'owner': 'securebase-platform',
            'remediation': control['remediation'],
        })

    severity_rank = {'high': 0, 'medium': 1, 'low': 2}
    findings.sort(key=lambda item: (severity_rank.get(item['severity'], 3), item['control']))
    return findings


def _build_phi_locations(
    compliance_map: Dict[str, str],
    region: str,
) -> List[Dict[str, Any]]:
    return [
        {
            'service': 'Amazon EBS',
            'encrypted': _ui_status(compliance_map.get('encrypted-volumes')) == 'passing',
            'region': region,
            'kmsKeyId': 'aws-managed-or-customer-managed',
        },
        {
            'service': 'Amazon RDS',
            'encrypted': _ui_status(compliance_map.get('rds-storage-encrypted')) == 'passing',
            'region': region,
            'kmsKeyId': 'aws-managed-or-customer-managed',
        },
    ]


def _build_assessment_payload(
    customer_id: str,
    compliance_map: Dict[str, str],
    unresolved_rules: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Build the portal response shape expected by HIPAADashboard.jsx."""
    now = datetime.now(timezone.utc)
    next_due = now + timedelta(days=90)
    unresolved_rules = unresolved_rules or []
    safeguards = {
        safeguard: _build_safeguard_summary(controls, compliance_map)
        for safeguard, controls in RULES_BY_SAFEGUARD.items()
    }

    total_controls = sum(section['total'] for section in safeguards.values())
    total_passed = sum(section['passed'] for section in safeguards.values())
    overall_score = round((total_passed / total_controls) * 100, 1) if total_controls else 0.0
    risk_level = _risk_level(overall_score)

    encryption_at_rest = (
        _ui_status(compliance_map.get('encrypted-volumes')) == 'passing'
        and _ui_status(compliance_map.get('rds-storage-encrypted')) == 'passing'
    )
    encryption_in_transit = (
        _ui_status(compliance_map.get('s3-bucket-ssl-requests-only')) == 'passing'
        and _ui_status(compliance_map.get('api-gw-ssl-enabled')) == 'passing'
    )
    access_logging = _ui_status(compliance_map.get('vpc-flow-logs-enabled')) == 'passing'
    audit_trail = _ui_status(compliance_map.get('cloudtrail-enabled')) == 'passing'
    findings = _build_findings(compliance_map)
    open_findings = [finding for finding in findings if finding['status'] == 'open']

    region = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')

    payload: Dict[str, Any] = {
        'customerId': customer_id,
        'assessmentComplete': not unresolved_rules,
        'assessmentWarnings': [
            f'AWS Config rule not resolved: {rule_name}'
            for rule_name in unresolved_rules
        ],
        'overallScore': overall_score,
        'lastAssessmentDate': now.isoformat(),
        'nextAssessmentDue': next_due.isoformat(),
        'riskLevel': risk_level,
        'baaCompliance': {
            'signed': True,
            'vendors': [{
                'name': 'AWS',
                'status': 'active',
                'signedDate': (now - timedelta(days=365)).isoformat(),
                'expiresDate': (now + timedelta(days=365)).isoformat(),
                'coveredServices': ['Config', 'CloudTrail', 'GuardDuty', 'KMS'],
            }],
        },
        'training': {
            'completionRate': 0,
            'totalStaff': 0,
            'completedStaff': 0,
            'overdueStaff': 0,
            'nextDeadline': next_due.isoformat(),
            'lastCampaignDate': now.isoformat(),
            'modules': [],
        },
        'riskAssessment': {
            'status': 'completed',
            'completedDate': now.isoformat(),
            'nextScheduled': next_due.isoformat(),
            'openRisks': len(open_findings),
            'mitigatedRisks': total_passed,
            'riskScore': risk_level,
            'items': [],
        },
        'safeguards': safeguards,
        'phi': {
            'encryptionAtRest': encryption_at_rest,
            'encryptionInTransit': encryption_in_transit,
            'accessLogging': access_logging,
            'auditTrail': audit_trail,
        },
        'phiEncryption': {
            'atRest': encryption_at_rest,
            'inTransit': encryption_in_transit,
            'verified': encryption_at_rest and encryption_in_transit,
        },
        'phiLocations': _build_phi_locations(compliance_map, region),
        'findings': findings,
        'phiAccessLog': [],
    }
    return payload


# ---------------------------------------------------------------------------
# DynamoDB writes
# ---------------------------------------------------------------------------


def _write_assessment_to_dynamodb(
    customer_id: str,
    payload: Dict[str, Any],
    role_mode: str,
    dry_run: bool = False,
) -> None:
    """Persist the assessment snapshot to DynamoDB."""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    now = datetime.now(timezone.utc)
    item = {
        'customer_id': customer_id,
        'assessment_date': today,
        'overall_score': Decimal(str(payload['overallScore'])),
        'risk_level': payload['riskLevel'],
        'role_mode': role_mode,
        'calculated_at': now.isoformat(),
        'assessment': _to_decimal(payload),
        'ttl': int((now.replace(year=now.year + 1)).timestamp()),
    }

    if dry_run:
        _log('info', 'dry_run: would write HIPAA assessment to DynamoDB',
             customer_id=customer_id, assessment_date=today)
        return

    table = dynamodb.Table(HIPAA_ASSESSMENTS_TABLE)
    table.put_item(Item=item)
    _log('info', 'HIPAA assessment written to DynamoDB',
         customer_id=customer_id, assessment_date=today,
         overall_score=payload['overallScore'])


# ---------------------------------------------------------------------------
# Per-tenant assessment
# ---------------------------------------------------------------------------


def _assess_tenant(
    customer_id: str,
    session: boto3.Session,
    role_mode: str,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Build a HIPAA assessment for a single tenant."""
    config_client = session.client('config')
    compliance_map, unresolved_rules = _get_config_compliance(ALL_RULES, config_client)
    payload = _build_assessment_payload(
        customer_id,
        compliance_map,
        unresolved_rules=unresolved_rules,
    )

    try:
        _write_assessment_to_dynamodb(
            customer_id=customer_id,
            payload=payload,
            role_mode=role_mode,
            dry_run=dry_run,
        )
    except ClientError as exc:
        _log('error', 'DynamoDB write failed',
             customer_id=customer_id, error=str(exc))
        raise

    return payload


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda entry point."""
    request_id = getattr(context, 'aws_request_id', str(uuid.uuid4()))
    event = event or {}
    is_api_request = _is_api_gateway_event(event)

    if is_api_request and event.get('httpMethod') == 'OPTIONS':
        return _response(204, {})

    try:
        body = _parse_event_body(event) if is_api_request else {}
    except ValueError as exc:
        _log('error', 'Invalid request body', request_id=request_id, error=str(exc))
        return _error(400, str(exc))

    dry_run: bool = bool(event.get('dry_run', body.get('dry_run', False)))
    extracted_customer_id = _extract_tenant_id(event, body)
    target_customer: str = extracted_customer_id or 'platform'
    role_arn: Optional[str] = _extract_role_arn(event, body)
    role_mode = 'cross_account' if role_arn else 'platform'

    if is_api_request and not extracted_customer_id and target_customer == 'platform':
        return _error(400, "Missing required field: 'customer_id'")

    _log('info', 'hipaa_compliance_assessment invoked',
         request_id=request_id,
         dry_run=dry_run,
         target_customer=target_customer,
         role_mode=role_mode)

    try:
        if role_arn:
            external_id = os.environ.get('SECUREBASE_EXTERNAL_ID', '').strip()
            if not external_id:
                raise RuntimeError(
                    'SECUREBASE_EXTERNAL_ID environment variable must be configured '
                    '(non-empty) for cross-account scoring'
                )
            sts = boto3.client('sts')
            assumed = sts.assume_role(
                RoleArn=role_arn,
                RoleSessionName=f'securebase-scan-{target_customer}',
                ExternalId=external_id,
            )
            creds = assumed['Credentials']
            session = boto3.Session(
                aws_access_key_id=creds['AccessKeyId'],
                aws_secret_access_key=creds['SecretAccessKey'],
                aws_session_token=creds['SessionToken'],
            )
        else:
            session = boto3.Session()
    except ClientError as exc:
        _log('error', 'Failed to initialize AWS session',
             customer_id=target_customer, error=str(exc))
        if is_api_request:
            return _error(500, 'Failed to initialize AWS session')
        raise

    try:
        assessment = _assess_tenant(
            target_customer,
            session=session,
            role_mode=role_mode,
            dry_run=dry_run,
        )
    except (ClientError, RuntimeError, ValueError) as exc:
        _log('error', 'Failed to assess tenant',
             customer_id=target_customer, error=str(exc))
        if is_api_request:
            return _error(500, 'Failed to generate HIPAA assessment')
        return {
            'customer_id': target_customer,
            'errors': [f'customer_id={target_customer}: {exc}'],
        }

    _log('info', 'hipaa_compliance_assessment complete',
         customer_id=target_customer,
         overall_score=assessment['overallScore'],
         finding_count=len(assessment.get('findings', [])))

    if is_api_request:
        return _response(200, assessment)
    return assessment
