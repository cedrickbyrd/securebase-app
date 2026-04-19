"""
Validate Stripe Session Lambda
Verifies that a Stripe Checkout session was successfully paid so the
/setup page can unlock the account-creation form.

GET /validate-session?session_id=cs_...

Returns 200 with customer metadata when the session is paid/complete,
and 402 if payment is still pending or the session is invalid.
"""

import json
import os
import stripe

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

CORS_ORIGIN = os.environ.get('CORS_ORIGIN', '*')

# Only sessions for these payment intents / modes are considered valid
_VALID_PAYMENT_STATUSES = {'paid', 'no_payment_required'}
_VALID_MODES = {'payment', 'subscription'}


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
    Validate a Stripe Checkout session and return sanitised customer info.

    Query params:
        session_id  (required) – Stripe checkout session ID (cs_...)

    Successful response (200):
        {
          "valid": true,
          "session_id": "cs_...",
          "customer_email": "buyer@example.com",
          "customer_name": "Acme Corp",
          "tier": "pilot_compliance",
          "amount_total": 495
        }

    Failed response (402 / 400):
        { "valid": false, "error": "..." }
    """
    # CORS pre-flight
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 204, 'headers': _cors_headers(), 'body': ''}

    if not stripe.api_key:
        return {
            'statusCode': 503,
            'headers': _cors_headers(),
            'body': json.dumps({'valid': False, 'error': 'Payment system temporarily unavailable.'}),
        }

    session_id = (
        event.get('queryStringParameters') or {}
    ).get('session_id', '').strip()

    if not session_id or not session_id.startswith('cs_'):
        return {
            'statusCode': 400,
            'headers': _cors_headers(),
            'body': json.dumps({'valid': False, 'error': 'Invalid or missing session_id.'}),
        }

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.InvalidRequestError:
        return {
            'statusCode': 400,
            'headers': _cors_headers(),
            'body': json.dumps({'valid': False, 'error': 'Checkout session not found.'}),
        }
    except stripe.error.StripeError as exc:
        print(f'Stripe error validating session {session_id}: {exc}')
        return {
            'statusCode': 503,
            'headers': _cors_headers(),
            'body': json.dumps({'valid': False, 'error': 'Unable to verify payment. Please try again.'}),
        }

    payment_status = getattr(session, 'payment_status', None)
    mode = getattr(session, 'mode', None)

    if payment_status not in _VALID_PAYMENT_STATUSES or mode not in _VALID_MODES:
        return {
            'statusCode': 402,
            'headers': _cors_headers(),
            'body': json.dumps({
                'valid': False,
                'error': 'Payment has not been completed for this session.',
                'payment_status': payment_status,
            }),
        }

    metadata = getattr(session, 'metadata', {}) or {}
    amount_total = getattr(session, 'amount_total', None)
    customer_email = getattr(session, 'customer_email', None) or metadata.get('customer_email')

    return {
        'statusCode': 200,
        'headers': _cors_headers(),
        'body': json.dumps({
            'valid': True,
            'session_id': session_id,
            'customer_email': customer_email,
            'customer_name': metadata.get('customer_name', ''),
            'tier': metadata.get('tier', ''),
            'amount_total': (amount_total // 100) if amount_total is not None else None,
        }),
    }
