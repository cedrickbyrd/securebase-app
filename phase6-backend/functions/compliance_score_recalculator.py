"""
Phase 6.2 — Compliance Score Recalculator Lambda.

Runs daily at 02:00 UTC via an EventBridge scheduled rule. It queries AWS
Config compliance controls, calculates weighted SOC 2 / HIPAA / FedRAMP scores,
and writes snapshots to DynamoDB (``securebase-compliance-scores`` table).
When invoked with ``role_arn``, it assumes the customer role and performs
cross-account scoring.

Handler:
    ``compliance_score_recalculator.lambda_handler``

Trigger:
    EventBridge schedule: ``cron(0 2 * * ? *)``  — daily at 02:00 UTC

Event Schema:
    Scheduled (fan-out) run — empty payload:
        {}
        On an empty event the handler reads the tenant registry (active
        customers + their cross-account role_arn) and asynchronously
        self-invokes (InvocationType='Event') once per tenant. This keeps each
        invocation short and avoids the 10-minute Lambda timeout that a
        synchronous per-tenant loop would risk.

    Manual / fan-out child run — single tenant:
        {
            "customer_id": "<uuid>",                  # required for single-tenant scoring
            "role_arn": "arn:aws:iam::...:role/...", # optional cross-account scan
            "dry_run": true                           # compute scores but skip DynamoDB write
        }

    The ``platform`` account can be scored explicitly with
    {"customer_id": "platform"}.

Environment Variables:
    COMPLIANCE_SCORES_TABLE   DynamoDB table name (default: securebase-compliance-scores)
    MAPPINGS_BUCKET           S3 bucket containing soc2/hipaa/fedramp mapping JSON files
    DB_SECRET_ARN             Secrets Manager ARN holding the tenant-registry DB
                              credentials (host/port/dbname/username/password).
                              Required for the scheduled fan-out tenant read.
    DB_NAME                   Override database name (default: from secret / securebase)
    AWS_DEFAULT_REGION        AWS region for API calls (default: us-east-1)
    SELF_FUNCTION_NAME        This Lambda's own function name, used for the
                              per-tenant async self-invoke (defaults to the
                              AWS_LAMBDA_FUNCTION_NAME provided by the runtime).
    SECUREBASE_EXTERNAL_ID    Required for cross-account AssumeRole when role_arn is provided
    LOG_LEVEL                 DEBUG | INFO | WARNING | ERROR (default: INFO)

Scoring Model:
    Each control is weighted by its severity:
        CRITICAL  = 3.0
        HIGH      = 2.0
        MEDIUM    = 1.0
        LOW       = 0.5
    weighted_score = 100 × (sum of weights for PASSING controls)
                           ÷ (sum of weights for all controls)
    Zero total weight → score = 0.

Author: SecureBase Engineering
Phase: 6.2 — Compliance Automation
Python: 3.11
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import boto3
from boto3.dynamodb.conditions import Key
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

COMPLIANCE_SCORES_TABLE = os.environ.get(
    'COMPLIANCE_SCORES_TABLE', 'securebase-compliance-scores'
)
CONTROL_VIOLATION_TABLE = os.environ.get(
    'CONTROL_VIOLATION_TABLE', 'control_violation_log'
)
MAPPINGS_BUCKET = os.environ.get('MAPPINGS_BUCKET', '')

# Secrets Manager ARN for the tenant-registry (customers) database. Used by the
# scheduled fan-out path to enumerate active tenants.
DB_SECRET_ARN = os.environ.get('DB_SECRET_ARN', '')

# This Lambda's own function name — used for the per-tenant async self-invoke.
# The Lambda runtime always provides AWS_LAMBDA_FUNCTION_NAME; SELF_FUNCTION_NAME
# is an explicit override (and lets unit tests set it deterministically).
SELF_FUNCTION_NAME = (
    os.environ.get('SELF_FUNCTION_NAME')
    or os.environ.get('AWS_LAMBDA_FUNCTION_NAME', '')
)

# The platform account is always scored, in addition to any active tenants.
PLATFORM_CUSTOMER_ID = 'platform'

SEVERITY_WEIGHTS: Dict[str, float] = {
    'CRITICAL': 3.0,
    'HIGH': 2.0,
    'MEDIUM': 1.0,
    'LOW': 0.5,
    'INFORMATIONAL': 0.0,
}

FRAMEWORK_MAPPING_KEYS = {
    'SOC2': 'compliance/soc2_mapping.json',
    'HIPAA': 'compliance/hipaa_mapping.json',
    'FedRAMP': 'compliance/fedramp_mapping.json',
}

# Fallback: load mappings from Lambda package (when MAPPINGS_BUCKET is empty)
_LOCAL_MAPPINGS_DIR = os.path.join(os.path.dirname(__file__), 'compliance')


# ---------------------------------------------------------------------------
# Mapping file loading
# ---------------------------------------------------------------------------


def _load_mapping(framework: str, s3_client: Any) -> Dict[str, Any]:
    """Load the compliance control mapping JSON for a given framework.

    Tries S3 first (if MAPPINGS_BUCKET is configured), then falls back to the
    local ``../compliance/`` directory bundled with the Lambda package.

    Args:
        framework: 'SOC2', 'HIPAA', or 'FedRAMP'.

    Returns:
        Parsed mapping dict.

    Raises:
        FileNotFoundError: If the mapping file cannot be found in either location.
    """
    s3_key = FRAMEWORK_MAPPING_KEYS.get(framework)
    if MAPPINGS_BUCKET and s3_key:
        try:
            response = s3_client.get_object(Bucket=MAPPINGS_BUCKET, Key=s3_key)
            return json.loads(response['Body'].read())
        except ClientError as exc:
            _log('warning', 'Could not load mapping from S3, falling back to local',
                 framework=framework, error=str(exc))

    # Local fallback
    filename = s3_key.split('/')[-1] if s3_key else f"{framework.lower()}_mapping.json"
    local_path = os.path.join(_LOCAL_MAPPINGS_DIR, filename)
    if not os.path.exists(local_path):
        raise FileNotFoundError(
            f"Mapping file not found for framework '{framework}': {local_path}"
        )
    with open(local_path) as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# AWS Config compliance queries
# ---------------------------------------------------------------------------


def _get_config_compliance(rule_names: List[str], config_client: Any) -> Dict[str, str]:
    """Query AWS Config for the compliance status of specific rules.

    Args:
        rule_names: List of AWS Config managed rule names.

    Returns:
        Dict mapping rule_name → compliance status
        ('COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE', 'INSUFFICIENT_DATA').
    """
    compliance_map: Dict[str, str] = {}
    if not rule_names:
        return compliance_map

    try:
        paginator = config_client.get_paginator('describe_compliance_by_config_rule')
        for page in paginator.paginate(
            ConfigRuleNames=rule_names,
            ComplianceTypes=['COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE',
                             'INSUFFICIENT_DATA'],
        ):
            for item in page.get('ComplianceByConfigRules', []):
                rule_name = item['ConfigRuleName']
                compliance_type = item.get('Compliance', {}).get('ComplianceType',
                                                                  'INSUFFICIENT_DATA')
                compliance_map[rule_name] = compliance_type
    except ClientError as exc:
        _log('warning', 'AWS Config query failed', error=str(exc))

    return compliance_map


# ---------------------------------------------------------------------------
# Tenant registry (customers store) read
# ---------------------------------------------------------------------------


def _get_db_connection(secret_arn: str) -> Any:
    """Open a PostgreSQL connection to the tenant-registry database.

    Mirrors the connection helper used by the Phase 6 ``db_migrator`` Lambda:
    credentials are read from Secrets Manager, and psycopg2 is imported lazily
    (it is provided by the shared Lambda layer at ``/opt/python``) so that unit
    tests which never touch the database do not require the driver.

    Args:
        secret_arn: Secrets Manager ARN containing the DB credentials.

    Returns:
        An open psycopg2 connection.
    """
    import psycopg2  # Lazy import: provided by the Lambda layer, not unit tests.

    sm = boto3.client('secretsmanager')
    secret = json.loads(sm.get_secret_value(SecretId=secret_arn)['SecretString'])
    host = secret.get('host') or secret.get('hostname')
    port = int(secret.get('port', 5432))
    dbname = (
        os.environ.get('DB_NAME')
        or secret.get('dbname')
        or secret.get('database', 'securebase')
    )
    user = secret.get('username') or secret.get('user')
    password = secret.get('password')
    if not all([host, user, password]):
        raise ValueError(f"Incomplete credentials in secret {secret_arn}")
    return psycopg2.connect(
        host=host, port=port, dbname=dbname, user=user, password=password,
        sslmode='require', connect_timeout=10,
    )


def _get_active_tenants() -> List[Dict[str, Optional[str]]]:
    """Read active tenants and their cross-account role ARNs from the registry.

    Queries the ``customers`` table for tenants whose ``status = 'active'`` and
    returns one entry per tenant. Customer names / PII are never selected — only
    the opaque tenant ``id`` and the cross-account ``role_arn`` used for scoring.

    The ``cross_account_role_arn`` column may not exist on every deployment yet;
    the query degrades gracefully (falling back to a registry without it) and a
    tenant without a usable role_arn is still returned so the platform-account
    fallback scoring path applies.

    Returns:
        List of dicts: ``{"customer_id": <uuid>, "role_arn": <arn or None>}``.
        Returns an empty list if DB_SECRET_ARN is not configured or the read
        fails (the caller still scores the platform account).
    """
    if not DB_SECRET_ARN:
        _log('warning',
             'DB_SECRET_ARN not configured; cannot enumerate tenants, '
             'scoring platform account only')
        return []

    queries = (
        "SELECT id::text AS customer_id, cross_account_role_arn AS role_arn "
        "FROM customers WHERE status = 'active'",
        # Fallback for registries that have not yet added the role_arn column.
        "SELECT id::text AS customer_id, NULL AS role_arn "
        "FROM customers WHERE status = 'active'",
    )

    conn = None
    try:
        conn = _get_db_connection(DB_SECRET_ARN)
        last_exc: Optional[Exception] = None
        for sql in queries:
            try:
                with conn.cursor() as cur:
                    cur.execute(sql)
                    rows = cur.fetchall()
                tenants = [
                    {'customer_id': str(row[0]), 'role_arn': row[1]}
                    for row in rows
                    if row and row[0]
                ]
                _log('info', 'tenant registry read complete',
                     active_tenants=len(tenants))
                return tenants
            except Exception as exc:  # noqa: BLE001
                # Most likely an undefined-column error; roll back and retry the
                # fallback query on the same connection.
                last_exc = exc
                try:
                    conn.rollback()
                except Exception:  # noqa: BLE001
                    pass
        if last_exc is not None:
            raise last_exc
        return []
    except Exception as exc:  # noqa: BLE001
        _log('error', 'Failed to read tenant registry', error=str(exc))
        return []
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass


# ---------------------------------------------------------------------------
# Score calculation
# ---------------------------------------------------------------------------


def _calculate_weighted_score(
    controls: List[Dict[str, Any]],
    compliance_map: Dict[str, str],
) -> Tuple[float, Dict[str, int]]:
    """Calculate the weighted compliance score for a set of controls.

    Args:
        controls:       List of control dicts from the mapping file.
                        Each dict must have 'severity' and 'config_rule' keys.
        compliance_map: Dict of config_rule_name → compliance status.

    Returns:
        Tuple of (weighted_score_0_to_100, violation_counts_by_severity).

    Example:
        >>> controls = [
        ...     {"control_id": "CC6.1", "severity": "HIGH", "config_rule": "cloudtrail-enabled"},
        ...     {"control_id": "CC6.2", "severity": "MEDIUM", "config_rule": "mfa-enabled-for-iam-console-access"},
        ... ]
        >>> compliance_map = {"cloudtrail-enabled": "COMPLIANT", "mfa-enabled-for-iam-console-access": "NON_COMPLIANT"}
        >>> score, violations = _calculate_weighted_score(controls, compliance_map)
        # score = 100 * 2.0 / (2.0 + 1.0) ≈ 66.67
    """
    total_weight = 0.0
    passing_weight = 0.0
    violations: Dict[str, int] = {
        'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0,
    }

    for control in controls:
        severity = control.get('severity', 'MEDIUM').upper()
        weight = SEVERITY_WEIGHTS.get(severity, 1.0)
        rule = control.get('config_rule', '')

        status = compliance_map.get(rule, 'INSUFFICIENT_DATA')
        total_weight += weight

        if status == 'COMPLIANT':
            passing_weight += weight
        elif status == 'NON_COMPLIANT':
            severity_key = severity if severity in violations else 'MEDIUM'
            violations[severity_key] += 1

    if total_weight == 0:
        return 0.0, violations

    score = round(100.0 * passing_weight / total_weight, 2)
    return score, violations


# ---------------------------------------------------------------------------
# DynamoDB writes
# ---------------------------------------------------------------------------


def _write_score_to_dynamodb(
    customer_id: str,
    framework: str,
    score: float,
    violations: Dict[str, int],
    controls_total: int,
    controls_passing: int,
    cloudwatch_client: Any,
    dry_run: bool = False,
) -> None:
    """Write the daily compliance score to DynamoDB.

    Partition key: ``PK = CUSTOMER#{customer_id}``
    Sort key:      ``SK = FRAMEWORK#{framework}#DATE#{YYYY-MM-DD}``

    Args:
        customer_id:      Tenant UUID.
        framework:        'SOC2', 'HIPAA', or 'FedRAMP'.
        score:            Calculated score 0–100.
        violations:       Dict of violation counts by severity.
        controls_total:   Total number of controls evaluated.
        controls_passing: Number of passing controls.
        cloudwatch_client: boto3 CloudWatch client from invocation session.
        dry_run:          If True, log the item but skip the actual write.
    """
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    now = datetime.now(timezone.utc)
    item = {
        'PK': f'CUSTOMER#{customer_id}',
        'SK': f'FRAMEWORK#{framework}#DATE#{today}',
        'customer_id': customer_id,
        'framework': framework,
        'score_date': today,
        'score': Decimal(str(score)),
        'controls_total': controls_total,
        'controls_passing': controls_passing,
        'controls_failing': controls_total - controls_passing,
        'critical_violations': violations.get('CRITICAL', 0),
        'high_violations': violations.get('HIGH', 0),
        'medium_violations': violations.get('MEDIUM', 0),
        'low_violations': violations.get('LOW', 0),
        'calculated_at': now.isoformat(),
        'ttl': int(
            (now.replace(year=now.year + 1)).timestamp()
        ),
    }

    if dry_run:
        _log('info', 'dry_run: would write DynamoDB item',
             customer_id=customer_id, framework=framework, score=score)
        return

    table = dynamodb.Table(COMPLIANCE_SCORES_TABLE)
    try:
        previous = table.query(
            KeyConditionExpression=(
                Key('PK').eq(f'CUSTOMER#{customer_id}')
                & Key('SK').begins_with(f'FRAMEWORK#{framework}#DATE#')
            ),
            ScanIndexForward=False,
            Limit=1,
        ).get('Items', [])
        if previous:
            previous_score = float(previous[0].get('score', 0))
            drop = round(previous_score - score, 2)
            if drop > 10:
                _log(
                    'warning',
                    'compliance_score_drop_gt_10',
                    customer_id=customer_id,
                    framework=framework,
                    previous_score=previous_score,
                    current_score=score,
                    score_drop=drop,
                )
                try:
                    cloudwatch_client.put_metric_data(
                        Namespace='SecureBase/Compliance',
                        MetricData=[{
                            'MetricName': 'ComplianceScoreDrop',
                            'Dimensions': [
                                {'Name': 'TenantId', 'Value': customer_id},
                                {'Name': 'Framework', 'Value': framework},
                            ],
                            'Value': abs(drop),
                            'Unit': 'Count',
                        }],
                    )
                except ClientError as cw_exc:
                    _log(
                        'warning',
                        'Failed to publish ComplianceScoreDrop metric',
                        error=str(cw_exc),
                        customer_id=customer_id,
                        framework=framework,
                    )
    except ClientError as exc:
        # Best-effort check: a query failure should not block writing today's score.
        _log(
            'warning',
            'Failed to evaluate score drop',
            error=str(exc),
            customer_id=customer_id,
            framework=framework,
        )

    table.put_item(Item=item)
    _log('info', 'compliance score written to DynamoDB',
         customer_id=customer_id, framework=framework, score=score,
         controls_total=controls_total, controls_passing=controls_passing)


def _write_control_violations_to_dynamodb(
    customer_id: str,
    framework: str,
    controls: List[Dict[str, Any]],
    compliance_map: Dict[str, str],
    dry_run: bool = False,
) -> None:
    """Write per-control status snapshots to the control_violation_log table."""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    now = datetime.now(timezone.utc)
    table = dynamodb.Table(CONTROL_VIOLATION_TABLE)

    for control in controls:
        item = {
            'PK': f'CUSTOMER#{customer_id}',
            'SK': f"CONTROL#{framework}#{control.get('control_id', 'UNKNOWN')}#DATE#{today}",
            'customer_id': customer_id,
            'framework': framework,
            'recorded_date': today,
            'control_id': control.get('control_id'),
            'control_name': control.get('control_name'),
            'control_description': control.get('description'),
            'aws_config_rule': control.get('config_rule'),
            'severity': str(control.get('severity', 'MEDIUM')).upper(),
            'status': compliance_map.get(control.get('config_rule', ''), 'INSUFFICIENT_DATA'),
            'remediation_url': control.get('remediation_url'),
            'calculated_at': now.isoformat(),
            'ttl': int(
                (now.replace(year=now.year + 1)).timestamp()
            ),
        }

        if dry_run:
            continue

        table.put_item(Item=item)


# ---------------------------------------------------------------------------
# Per-tenant scoring
# ---------------------------------------------------------------------------


def _score_tenant(
    customer_id: str,
    session: boto3.Session,
    dry_run: bool = False,
) -> Dict[str, Optional[float]]:
    """Run compliance scoring for all three frameworks for a single tenant.

    Args:
        customer_id: Tenant UUID.
        dry_run:     If True, skip DynamoDB writes.

    Returns:
        Dict mapping framework → score (0–100), or ``None`` for a framework
        whose AWS Config query returned no data (its write is skipped so a
        spurious score=0 is never persisted).
    """
    scores: Dict[str, Optional[float]] = {}
    config_client = session.client('config')
    s3_client = session.client('s3')
    cloudwatch_client = session.client('cloudwatch')

    for framework in ('SOC2', 'HIPAA', 'FedRAMP'):
        try:
            mapping = _load_mapping(framework, s3_client)
        except FileNotFoundError as exc:
            _log('warning', 'Mapping file not found, skipping framework',
                 customer_id=customer_id, framework=framework, error=str(exc))
            continue

        controls: List[Dict[str, Any]] = mapping.get('controls', [])
        rule_names = [c['config_rule'] for c in controls if c.get('config_rule')]

        compliance_map = _get_config_compliance(rule_names, config_client)

        # If the Config query returned nothing (service error, throttle, or
        # Config not enabled in the target account), we have no real signal.
        # Persisting a score now would write a spurious 0 and trip the
        # >10-point drop alarm. Skip this framework entirely for this run.
        if rule_names and not compliance_map:
            _log('warning',
                 'Empty Config compliance map; skipping write to avoid '
                 'persisting a spurious score=0',
                 customer_id=customer_id, framework=framework,
                 rules_requested=len(rule_names))
            scores[framework] = None
            continue

        score, violations = _calculate_weighted_score(controls, compliance_map)

        controls_passing = sum(
            1 for c in controls
            if compliance_map.get(c.get('config_rule', ''), '') == 'COMPLIANT'
        )

        try:
            _write_score_to_dynamodb(
                customer_id=customer_id,
                framework=framework,
                score=score,
                violations=violations,
                controls_total=len(controls),
                controls_passing=controls_passing,
                cloudwatch_client=cloudwatch_client,
                dry_run=dry_run,
            )
            _write_control_violations_to_dynamodb(
                customer_id=customer_id,
                framework=framework,
                controls=controls,
                compliance_map=compliance_map,
                dry_run=dry_run,
            )
        except ClientError as exc:
            _log('error', 'DynamoDB write failed',
                 customer_id=customer_id, framework=framework, error=str(exc))

        scores[framework] = score

    return scores


# ---------------------------------------------------------------------------
# Session construction
# ---------------------------------------------------------------------------


def _build_session(target_customer: str, role_arn: Optional[str]) -> boto3.Session:
    """Build a boto3 Session for the target account.

    When ``role_arn`` is provided, assumes the customer's cross-account role
    using ``SECUREBASE_EXTERNAL_ID``; otherwise returns the Lambda's own
    (platform) session.

    Args:
        target_customer: Tenant UUID (or 'platform'), used for the session name.
        role_arn:        Optional cross-account role ARN to assume.

    Returns:
        A configured boto3 Session.
    """
    if not role_arn:
        return boto3.Session()

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
    return boto3.Session(
        aws_access_key_id=creds['AccessKeyId'],
        aws_secret_access_key=creds['SecretAccessKey'],
        aws_session_token=creds['SessionToken'],
    )


# ---------------------------------------------------------------------------
# Single-tenant scoring (manual invoke or fan-out child)
# ---------------------------------------------------------------------------


def _score_single_tenant(
    target_customer: str,
    role_arn: Optional[str],
    dry_run: bool,
    request_id: str,
) -> Dict[str, Any]:
    """Score exactly one tenant and return the standard result envelope."""
    all_scores: Dict[str, Dict[str, Optional[float]]] = {}
    errors: List[str] = []

    try:
        session = _build_session(target_customer, role_arn)
    except ClientError as exc:
        _log('error', 'Failed to initialize AWS session',
             customer_id=target_customer, error=str(exc))
        raise

    try:
        scores = _score_tenant(target_customer, session=session, dry_run=dry_run)
        all_scores[target_customer] = scores
    except Exception as exc:  # noqa: BLE001
        error_msg = f"customer_id={target_customer}: {exc}"
        _log('error', 'Failed to score tenant',
             customer_id=target_customer, error=str(exc))
        errors.append(error_msg)

    _log('info', 'compliance_score_recalculator single-tenant complete',
         request_id=request_id,
         tenants_processed=len(all_scores),
         error_count=len(errors))

    return {
        'mode': 'single_tenant',
        'tenants_processed': len(all_scores),
        'scores': all_scores,
        'errors': errors,
    }


# ---------------------------------------------------------------------------
# Scheduled fan-out (empty event) — async self-invoke per tenant
# ---------------------------------------------------------------------------


def _fan_out_tenants(dry_run: bool, request_id: str) -> Dict[str, Any]:
    """Enumerate active tenants and async self-invoke once per tenant.

    Each child invocation uses ``InvocationType='Event'`` (fire-and-forget) so
    the scheduled run returns immediately and no single invocation has to score
    every tenant serially — which would risk the 10-minute Lambda timeout.

    The platform account is always included so platform-level posture continues
    to be scored exactly as before.

    Returns:
        Result envelope with ``tenants_dispatched`` and any dispatch errors.
    """
    function_name = SELF_FUNCTION_NAME
    if not function_name:
        # Without a target name we cannot self-invoke; fall back to scoring the
        # platform account inline so the scheduled run is never a no-op.
        _log('error',
             'SELF_FUNCTION_NAME/AWS_LAMBDA_FUNCTION_NAME unset; cannot '
             'fan out, scoring platform account inline')
        return _score_single_tenant(PLATFORM_CUSTOMER_ID, None, dry_run, request_id)

    # Platform first, then each active tenant with its cross-account role_arn.
    targets: List[Dict[str, Optional[str]]] = [
        {'customer_id': PLATFORM_CUSTOMER_ID, 'role_arn': None}
    ]
    for tenant in _get_active_tenants():
        cid = tenant.get('customer_id')
        if not cid or cid == PLATFORM_CUSTOMER_ID:
            continue
        targets.append({'customer_id': cid, 'role_arn': tenant.get('role_arn')})

    lambda_client = boto3.client('lambda')
    dispatched = 0
    errors: List[str] = []

    for target in targets:
        payload: Dict[str, Any] = {'customer_id': target['customer_id']}
        if target.get('role_arn'):
            payload['role_arn'] = target['role_arn']
        if dry_run:
            payload['dry_run'] = True
        try:
            lambda_client.invoke(
                FunctionName=function_name,
                InvocationType='Event',
                Payload=json.dumps(payload).encode('utf-8'),
            )
            dispatched += 1
        except ClientError as exc:
            error_msg = f"customer_id={target['customer_id']}: {exc}"
            _log('error', 'Failed to dispatch per-tenant scoring invoke',
                 customer_id=target['customer_id'], error=str(exc))
            errors.append(error_msg)

    _log('info', 'compliance_score_recalculator fan-out complete',
         request_id=request_id,
         tenants_dispatched=dispatched,
         tenants_total=len(targets),
         error_count=len(errors))

    return {
        'mode': 'fan_out',
        'tenants_dispatched': dispatched,
        'tenants_total': len(targets),
        'errors': errors,
    }


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda entry point — recalculate compliance scores.

    Two dispatch modes:

    * **Scheduled fan-out** — when the event carries no ``customer_id`` (e.g. the
      daily EventBridge ``{}`` event), read the tenant registry and async
      self-invoke once per active tenant (plus the platform account). Returns
      ``{"mode": "fan_out", "tenants_dispatched": N, ...}``.

    * **Single-tenant** — when the event carries a ``customer_id`` (a manual
      invoke or a fan-out child), score that one tenant. Returns
      ``{"mode": "single_tenant", "tenants_processed": 1, "scores": {...}, ...}``.

    Args:
        event:   EventBridge scheduled event or manual invocation payload.
        context: Lambda context object.

    Returns:
        Result envelope (see modes above); always includes ``errors``.
    """
    request_id = getattr(context, 'aws_request_id', str(uuid.uuid4()))
    event = event or {}
    dry_run: bool = bool(event.get('dry_run', False))
    target_customer: Optional[str] = event.get('customer_id')
    role_arn: Optional[str] = event.get('role_arn')

    is_fan_out = not target_customer

    _log('info', 'compliance_score_recalculator invoked',
         request_id=request_id,
         dry_run=dry_run,
         mode='fan_out' if is_fan_out else 'single_tenant',
         target_customer=target_customer or '(fan-out)',
         role_mode='cross_account' if role_arn else 'platform')

    if is_fan_out:
        return _fan_out_tenants(dry_run=dry_run, request_id=request_id)

    return _score_single_tenant(
        target_customer=target_customer,
        role_arn=role_arn,
        dry_run=dry_run,
        request_id=request_id,
    )
