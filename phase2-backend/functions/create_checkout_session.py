"""
Create Stripe Checkout Session
Initiates payment flow for new customers
"""

import json
import os
import stripe
from db_utils import get_db_connection, execute_query

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Pricing tier mapping
PRICE_IDS = {
    'healthcare': os.environ.get('STRIPE_PRICE_HEALTHCARE'),
    'fintech': os.environ.get('STRIPE_PRICE_FINTECH'),
    'government': os.environ.get('STRIPE_PRICE_GOVERNMENT'),
    'standard': os.environ.get('STRIPE_PRICE_STANDARD'),
}


def lambda_handler(event, context):
    """
    Create Stripe checkout session
    
    POST /checkout
    Body: {
        "tier": "healthcare",
        "email": "customer@example.com",
        "name": "Acme Corp",
        "use_pilot_coupon": true
    }
    """
    
    try:
        # Parse request
        body = json.loads(event['body'])
        tier = body.get('tier', 'standard').lower()
        customer_email = body.get('email')
        customer_name = body.get('name')
        use_pilot = body.get('use_pilot_coupon', False)
        
        # Validate inputs
        if not customer_email or not customer_name:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Email and name required'})
            }
        
        if tier not in PRICE_IDS:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Invalid tier: {tier}'})
            }
        
        price_id = PRICE_IDS[tier]
        
        if not price_id:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': f'Price ID not configured for tier: {tier}'})
            }
        
        # Check if customer already exists
        conn = get_db_connection()
        sql = "SELECT id, stripe_customer_id FROM customers WHERE email = %s"
        existing = execute_query(conn, sql, (customer_email,))
        conn.close()
        
        if existing and existing[0][1]:  # Has Stripe ID
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Customer already has active subscription'})
            }
        
        # Build checkout session parameters
        session_params = {
            'payment_method_types': ['card'],
            'line_items': [{
                'price': price_id,
                'quantity': 1,
            }],
            'mode': 'subscription',
            'success_url': f"{os.environ.get('PORTAL_URL')}/success?session_id={{CHECKOUT_SESSION_ID}}",
            'cancel_url': f"{os.environ.get('PORTAL_URL')}/signup?cancelled=true",
            'customer_email': customer_email,
            'metadata': {
                'tier': tier,
                'customer_name': customer_name,
            },
            'subscription_data': {
                'metadata': {
                    'tier': tier,
                },
                'trial_period_days': 30,  # 30-day free trial
            },
        }
        
        # Add pilot coupon if requested
        if use_pilot:
            pilot_coupon = os.environ.get('STRIPE_PILOT_COUPON')
            if pilot_coupon:
                session_params['discounts'] = [{
                    'coupon': pilot_coupon,
                }]
        
        # Create Stripe checkout session
        session = stripe.checkout.Session.create(**session_params)
        
        # Return checkout URL
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'checkout_url': session.url,
                'session_id': session.id,
            })
        }
        
    except stripe.error.StripeError as e:
        print(f"Stripe error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': f'Payment provider error: {str(e)}'})
        }
    
    except Exception as e:
        print(f"Error creating checkout session: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }


if __name__ == "__main__":
    # Local testing
    test_event = {
        'body': json.dumps({
            'tier': 'healthcare',
            'email': 'test@example.com',
            'name': 'Test Hospital',
            'use_pilot_coupon': True
        })
    }
    
    response = lambda_handler(test_event, {})
    print(json.dumps(json.loads(response['body']), indent=2))
