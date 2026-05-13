"""
Phase 6.2 — Compliance Score Recalculator Lambda.

Runs daily at 02:00 UTC via an EventBridge scheduled rule.  For each active
tenant, it queries AWS Config, Security Hub, and GuardDuty to determine which
compliance controls are passing or failing, maps findings to SOC 2 / HIPAA /
FedRAMP controls using JSON mapping files, calculates a weighted score (0–100),
and writes a daily snapshot to DynamoDB (``securebase-compliance-scores`` table).

Handler:
    ``compliance_score_recalculator.lambda_handler``

Trigger:
    EventBridge schedule: ``cron(0 2 * * ? *)``  — daily at 02:00 UTC

Event Schema:
    {}   (no payload required for scheduled runs)

    Optionally pass:
    {
        "customer_id": "<uuid>",   # recalculate for one tenant only
        "dry_run": true            # compute scores but skip DynamoDB write
    }

Environment Variables:
    COMPLIANCE_SCORES_TABLE   DynamoDB table name (default: securebase-compliance-scores)
    MAPPINGS_BUCKET           S3 bucket containing soc2/hipaa/fedramp mapping JSON files
    RDS_HOST                  Aurora Serverless v2 endpoint (via RDS Proxy)
    RDS_DATABASE              Database name (default: securebase)
    RDS_USER                  Application database user
    AWS_DEFAULT_REGION        AWS region for API calls (default: us-east-1)
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
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError

# Import shared database utilities from the Lambda layer.
sys.path.insert(0, '/opt/python')
from db_utils import (
    query_many,
    DatabaseError,
)

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
# AWS SDK clients
# ---------------------------------------------------------------------------

config_client = boto3.client('config')
securityhub_client = boto3.client('securityhub')
guardduty_client = boto3.client('guardduty')
dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COMPLIANCE_SCORES_TABLE = os.environ.get(
    'COMPLIANCE_SCORES_TABLE', 'securebase-compliance-scores'
)
MAPPINGS_BUCKET = os.environ.get('MAPPINGS_BUCKET', '')

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
_LOCAL_MAPPINGS_DIR = os.path.join(os.path.dirname(__file__), '..', 'compliance')


# ---------------------------------------------------------------------------
# Mapping file loading
# ---------------------------------------------------------------------------


def _load_mapping(framework: str) -> Dict[str, Any]:
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


def _get_config_compliance(rule_names: List[str]) -> Dict[str, str]:
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
# DynamoDB write
# ---------------------------------------------------------------------------


def _write_score_to_dynamodb(
    customer_id: str,
    framework: str,
    score: float,
    violations: Dict[str, int],
    controls_total: int,
    controls_passing: int,
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
    table.put_item(Item=item)
    _log('info', 'compliance score written to DynamoDB',
         customer_id=customer_id, framework=framework, score=score,
         controls_total=controls_total, controls_passing=controls_passing)


# ---------------------------------------------------------------------------
# Per-tenant scoring
# ---------------------------------------------------------------------------


def _score_tenant(
    customer_id: str,
    dry_run: bool = False,
) -> Dict[str, float]:
    """Run compliance scoring for all three frameworks for a single tenant.

    Args:
        customer_id: Tenant UUID.
        dry_run:     If True, skip DynamoDB writes.

    Returns:
        Dict mapping framework → score (0–100).
    """
    scores: Dict[str, float] = {}

    for framework in ('SOC2', 'HIPAA', 'FedRAMP'):
        try:
            mapping = _load_mapping(framework)
        except FileNotFoundError as exc:
            _log('warning', 'Mapping file not found, skipping framework',
                 customer_id=customer_id, framework=framework, error=str(exc))
            continue

        controls: List[Dict[str, Any]] = mapping.get('controls', [])
        rule_names = [c['config_rule'] for c in controls if c.get('config_rule')]

        compliance_map = _get_config_compliance(rule_names)
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
                dry_run=dry_run,
            )
        except ClientError as exc:
            _log('error', 'DynamoDB write failed',
                 customer_id=customer_id, framework=framework, error=str(exc))

        scores[framework] = score

    return scores


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda entry point — recalculate compliance scores for all (or one) tenant.

    Args:
        event:   EventBridge scheduled event or manual invocation payload.
        context: Lambda context object.

    Returns:
        Dict containing:
            - ``tenants_processed`` (int): Number of tenants scored.
            - ``scores``            (dict): Mapping of customer_id → framework scores.
            - ``errors``            (list): List of error messages for failed tenants.
    """
    request_id = getattr(context, 'aws_request_id', str(uuid.uuid4()))
    dry_run: bool = bool(event.get('dry_run', False))
    target_customer: Optional[str] = event.get('customer_id')

    _log('info', 'compliance_score_recalculator invoked',
         request_id=request_id,
         dry_run=dry_run,
         target_customer=target_customer or 'all')

    # ------------------------------------------------------------------
    # Load customer list
    # ------------------------------------------------------------------
    try:
        if target_customer:
            rows = query_many(
                "SELECT id FROM customers WHERE id = %s AND status = 'active'",
                (target_customer,),
            )
        else:
            rows = query_many(
                "SELECT id FROM customers WHERE status = 'active'",
            )
    except DatabaseError as exc:
        _log('error', 'Failed to load customer list', error=str(exc))
        raise RuntimeError(f"Database error loading customers: {exc}") from exc

    customer_ids = [str(row['id']) for row in (rows or [])]
    _log('info', 'customers loaded for scoring', count=len(customer_ids))

    # ------------------------------------------------------------------
    # Score each tenant
    # ------------------------------------------------------------------
    all_scores: Dict[str, Dict[str, float]] = {}
    errors: List[str] = []

    for customer_id in customer_ids:
        try:
            scores = _score_tenant(customer_id, dry_run=dry_run)
            all_scores[customer_id] = scores
        except Exception as exc:  # noqa: BLE001
            error_msg = f"customer_id={customer_id}: {exc}"
            _log('error', 'Failed to score tenant',
                 customer_id=customer_id, error=str(exc))
            errors.append(error_msg)

    _log('info', 'compliance_score_recalculator complete',
         tenants_processed=len(all_scores),
         error_count=len(errors))

    return {
        'tenants_processed': len(all_scores),
        'scores': all_scores,
        'errors': errors,
    }
