"""
Pilot Slot Availability Lambda
Returns the number of remaining slots for a given pilot SKU.

GET /pilot/availability?sku=pilot_compliance

DynamoDB table: securebase-pilot-slots
  Partition Key: sku (String)
  Attributes:
    slots_total    (Number) – maximum slots for this SKU
    slots_claimed  (Number) – how many have been purchased so far
"""

import json
import os
import boto3
from botocore.exceptions import ClientError

DYNAMODB_TABLE = os.environ.get('PILOT_SLOTS_TABLE', 'securebase-pilot-slots')
CORS_ORIGIN = os.environ.get('CORS_ORIGIN', '*')

_dynamodb = None


def _get_table():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource('dynamodb').Table(DYNAMODB_TABLE)
    return _dynamodb


def _cors_headers():
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
    }


def lambda_handler(event, context):
    """
    Return slot availability for a pilot SKU.

    Query params:
        sku  (required) – e.g. "pilot_compliance"

    Response body (200):
        {
          "sku": "pilot_compliance",
          "slots_total": 5,
          "slots_claimed": 2,
          "slots_remaining": 3,
          "available": true
        }
    """
    # Handle CORS pre-flight
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 204, 'headers': _cors_headers(), 'body': ''}

    sku = (
        event.get('queryStringParameters') or {}
    ).get('sku', '').strip().lower()

    if not sku:
        return {
            'statusCode': 400,
            'headers': _cors_headers(),
            'body': json.dumps({'error': 'Missing required query parameter: sku'}),
        }

    try:
        table = _get_table()
        response = table.get_item(Key={'sku': sku})
    except ClientError as exc:
        print(f'DynamoDB error fetching sku={sku}: {exc}')
        return {
            'statusCode': 503,
            'headers': _cors_headers(),
            'body': json.dumps({'error': 'Unable to retrieve availability. Please try again.'}),
        }

    item = response.get('Item')
    if item is None:
        # SKU not found — treat as unavailable rather than error
        return {
            'statusCode': 404,
            'headers': _cors_headers(),
            'body': json.dumps({
                'error': f'Unknown pilot SKU: {sku}',
                'sku': sku,
                'available': False,
            }),
        }

    slots_total = int(item.get('slots_total', 0))
    slots_claimed = int(item.get('slots_claimed', 0))
    slots_remaining = max(slots_total - slots_claimed, 0)

    return {
        'statusCode': 200,
        'headers': _cors_headers(),
        'body': json.dumps({
            'sku': sku,
            'slots_total': slots_total,
            'slots_claimed': slots_claimed,
            'slots_remaining': slots_remaining,
            'available': slots_remaining > 0,
        }),
    }
