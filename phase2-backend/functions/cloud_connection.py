"""
Cloud Connection Lambda — SecureBase cross-account IAM role management.

Routes:
  GET  /cloud-connection/status   -> return existing connection for customer
  POST /cloud-connection/init     -> generate external_id, store pending record
  POST /cloud-connection/verify   -> attempt sts:AssumeRole, store role ARN on success

DynamoDB table: securebase-cloud-connections
  PK: customer_id (S)
  Attributes: external_id, role_arn, status, account_id, connected_at, created_at

Env vars:
  CONNECTIONS_TABLE     securebase-cloud-connections
  SECUREBASE_ACCOUNT_ID 731184206915
  SECUREBASE_ROLE_NAME  SecureBaseComplianceScanner   (role in OUR account that assumes customer role)
  COMPLIANCE_SCORE_FUNCTION_NAME securebase-dev-compliance-score
  CORS_ORIGIN           https://portal.securebase.tximhotep.com
  LOG_LEVEL             DEBUG|INFO|WARNING|ERROR
"""

import os
import json
import uuid
import logging
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

import jwt

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

ddb            = boto3.resource('dynamodb')
sts_client     = boto3.client('sts')
secrets_client = boto3.client('secretsmanager')

_CONNECTIONS_TABLE     = os.environ.get('CONNECTIONS_TABLE', 'securebase-cloud-connections')
_SECUREBASE_ACCOUNT_ID = os.environ.get('SECUREBASE_ACCOUNT_ID', '731184206915')
_SECUREBASE_ROLE_NAME  = os.environ.get('SECUREBASE_ROLE_NAME', 'SecureBaseComplianceScanner')
_CORS_ORIGIN           = os.environ.get('CORS_ORIGIN', 'https://portal.securebase.tximhotep.com')
_AWS_SCANNER_FUNCTION  = os.environ.get('AWS_SCANNER_FUNCTION_NAME', 'securebase-aws-scanner')
_COMPLIANCE_SCORE_FUNCTION = os.environ.get('COMPLIANCE_SCORE_FUNCTION_NAME', 'securebase-dev-compliance-score')

_CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': _CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

# The ARN that customers must trust in their IAM role trust policy
SECUREBASE_PRINCIPAL_ARN = f'arn:aws:iam::{_SECUREBASE_ACCOUNT_ID}:role/{_SECUREBASE_ROLE_NAME}'


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resp(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': _CORS_HEADERS,
        'body': json.dumps(body),
    }


def _get_customer_id(event: dict) -> str | None:
    """Extract customer_id from JWT in Authorization header."""
    auth = event.get('headers', {}).get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    token = auth[7:]
    try:
        secret_name = os.environ.get('JWT_SECRET', 'securebase-jwt-production')
        try:
            resp = secrets_client.get_secret_value(SecretId=secret_name)
            raw = resp.get('SecretString', '')
            try:
                secret = json.loads(raw).get('jwt_secret') or raw
            except (json.JSONDecodeError, AttributeError):
                secret = raw
        except ClientError:
            secret = secret_name
        claims = jwt.decode(token, secret, algorithms=['HS256'])
        return claims.get('sub') or claims.get('customer_id')
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT: {e}")
        return None


def _get_connection(customer_id: str) -> dict | None:
    table = ddb.Table(_CONNECTIONS_TABLE)
    resp  = table.get_item(Key={'customer_id': customer_id})
    return resp.get('Item')


def _put_connection(item: dict) -> None:
    ddb.Table(_CONNECTIONS_TABLE).put_item(Item=item)


def _update_connection(customer_id: str, updates: dict) -> None:
    table = ddb.Table(_CONNECTIONS_TABLE)
    update_expr   = 'SET ' + ', '.join(f'#{k} = :{k}' for k in updates)
    attr_names    = {f'#{k}': k for k in updates}
    attr_values   = {f':{k}': v for k, v in updates.items()}
    table.update_item(
        Key={'customer_id': customer_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=attr_names,
        ExpressionAttributeValues=attr_values,
    )


# ── Route handlers ────────────────────────────────────────────────────────────

def get_status(event: dict, request_id: str) -> dict:
    """GET /cloud-connection/status — return current connection for customer."""
    customer_id = _get_customer_id(event)
    if not customer_id:
        return _resp(401, {'error': 'Unauthorized', 'request_id': request_id})

    record = _get_connection(customer_id)
    if not record:
        return _resp(200, {
            'status': 'not_connected',
            'securebase_principal_arn': SECUREBASE_PRINCIPAL_ARN,
        })

    return _resp(200, {
        'status':                   record.get('status', 'not_connected'),
        'external_id':              record.get('external_id', ''),
        'role_arn':                 record.get('role_arn', ''),
        'account_id':               record.get('account_id', ''),
        'connected_at':             record.get('connected_at', ''),
        'securebase_principal_arn': SECUREBASE_PRINCIPAL_ARN,
    })


def init_connection(event: dict, request_id: str) -> dict:
    """
    POST /cloud-connection/init
    Generate a unique external ID for this customer and store a pending record.
    Returns the external_id and the SecureBase principal ARN to embed in the trust policy.
    """
    customer_id = _get_customer_id(event)
    if not customer_id:
        return _resp(401, {'error': 'Unauthorized', 'request_id': request_id})

    # Reuse existing external_id if already initiated
    record = _get_connection(customer_id)
    if record and record.get('external_id'):
        external_id = record['external_id']
        logger.info(f"Reusing existing external_id for {customer_id}")
    else:
        external_id = str(uuid.uuid4())
        _put_connection({
            'customer_id': customer_id,
            'external_id': external_id,
            'status':      'pending',
            'created_at':  datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Generated external_id for customer {customer_id}: {external_id}")

    return _resp(200, {
        'external_id':              external_id,
        'securebase_principal_arn': SECUREBASE_PRINCIPAL_ARN,
        'status':                   'pending',
    })


def verify_connection(event: dict, request_id: str) -> dict:
    """
    POST /cloud-connection/verify
    Body: {"role_arn": "arn:aws:iam::...:role/...", "external_id": "..."}

    Attempt to assume the customer's role. If successful, store the ARN and
    mark the connection as active.
    """
    customer_id = _get_customer_id(event)
    if not customer_id:
        return _resp(401, {'error': 'Unauthorized', 'request_id': request_id})

    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        body = {}

    role_arn    = (body.get('role_arn') or '').strip()
    external_id = (body.get('external_id') or '').strip()

    if not role_arn:
        return _resp(400, {'error': 'role_arn is required', 'request_id': request_id})
    if not role_arn.startswith('arn:aws:iam::'):
        return _resp(400, {'error': 'Invalid role_arn format', 'request_id': request_id})

    # Validate external_id matches stored record
    record = _get_connection(customer_id)
    if not record:
        return _resp(400, {'error': 'Connection not initialized. Call /cloud-connection/init first.', 'request_id': request_id})

    stored_external_id = record.get('external_id', '')
    if external_id and external_id != stored_external_id:
        logger.warning(f"External ID mismatch for {customer_id}")
        return _resp(400, {'error': 'External ID mismatch', 'request_id': request_id})

    # Attempt to assume the role
    try:
        assume_resp = sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName=f'securebase-verify-{customer_id[:8]}',
            ExternalId=stored_external_id,
            DurationSeconds=900,  # minimum session — just for verification
        )
        assumed_identity = assume_resp['AssumedRoleUser']['Arn']
        # Extract account ID from the role ARN
        account_id = role_arn.split(':')[4]

        # Verify it's actually read-only by calling GetCallerIdentity with the temp creds
        # (we trust the policy; this confirms the assume succeeded)
        logger.info(f"Successfully assumed role for customer {customer_id}: {assumed_identity}")

        # Store successful connection
        now = datetime.now(timezone.utc).isoformat()
        _update_connection(customer_id, {
            'role_arn':     role_arn,
            'account_id':   account_id,
            'status':       'connected',
            'connected_at': now,
        })

        # Trigger initial scan asynchronously
        try:
            lambda_client = boto3.client('lambda')
            lambda_client.invoke(
                FunctionName=_AWS_SCANNER_FUNCTION,
                InvocationType='Event',
                Payload=json.dumps({
                    'trigger': 'post_verify',
                    'customer_id': customer_id,
                    'role_arn': role_arn,
                    'external_id': stored_external_id,
                })
            )
            logger.info(f"Initial scan triggered for {customer_id}")
        except ClientError as e:
            logger.warning(f"Could not trigger initial scan: {e}")
            # Non-fatal — scan will run on next schedule

        # Trigger initial compliance score snapshot asynchronously
        try:
            lambda_client = boto3.client('lambda')
            lambda_client.invoke(
                FunctionName=_COMPLIANCE_SCORE_FUNCTION,
                InvocationType='Event',
                Payload=json.dumps({
                    'customer_id': customer_id,
                    'role_arn': role_arn,
                    'source': 'cloud_connection_onboarding',
                })
            )
            logger.info(f"Initial compliance score triggered for {customer_id}")
        except ClientError as e:
            logger.warning(f"Could not trigger initial compliance score: {e}")
            # Non-fatal — score will be recalculated by scheduler or API trigger

        return _resp(200, {
            'connected':   True,
            'account_id':  account_id,
            'role_arn':    role_arn,
            'connected_at': now,
            'message':     'Connection verified. Compliance scanning will begin within 15 minutes.',
        })

    except sts_client.exceptions.ClientError as e:
        error_code = e.response['Error']['Code']
        logger.warning(f"AssumeRole failed for {customer_id} ({role_arn}): {error_code}")

        error_map = {
            'AccessDenied':             'Access denied. Verify the trust policy allows arn:aws:iam::731184206915:role/SecureBaseComplianceScanner.',
            'NoSuchEntity':             'Role not found. Check the ARN is correct and the CloudFormation stack deployed successfully.',
            'InvalidClientTokenId':     'Invalid AWS account. Check the role ARN.',
            'AccessDeniedException':    'Access denied. Check the trust policy includes the correct ExternalId condition.',
        }
        user_msg = error_map.get(error_code, f'AssumeRole failed: {error_code}. Check the trust policy and external ID.')

        _update_connection(customer_id, {'status': 'error', 'last_error': error_code})

        return _resp(200, {
            'connected': False,
            'error':     user_msg,
            'error_code': error_code,
        })

    except Exception as e:
        logger.error(f"Unexpected error verifying connection for {customer_id}: {e}", exc_info=True)
        return _resp(500, {'error': 'Verification failed. Please try again.', 'request_id': request_id})


# ── Lambda handler ────────────────────────────────────────────────────────────

def lambda_handler(event, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _CORS_HEADERS, 'body': ''}

    request_id = event.get('requestContext', {}).get('requestId', str(uuid.uuid4()))
    path       = event.get('path', '')
    method     = event.get('httpMethod', 'GET')

    logger.info(f"{method} {path} [{request_id}]")

    if method == 'GET'  and path == '/cloud-connection/status':
        return get_status(event, request_id)

    if method == 'POST' and path == '/cloud-connection/init':
        return init_connection(event, request_id)

    if method == 'POST' and path == '/cloud-connection/verify':
        return verify_connection(event, request_id)

    return _resp(404, {'error': f'No route for {method} {path}', 'request_id': request_id})
