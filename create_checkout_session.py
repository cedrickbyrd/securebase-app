import json
import os
import stripe

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Keep these as fallbacks
PRICE_IDS = {
    'healthcare': os.environ.get('STRIPE_PRICE_HEALTHCARE', 'price_healthcare'),
    'fintech': os.environ.get('STRIPE_PRICE_FINTECH', 'price_fintech'),
    'government': os.environ.get('STRIPE_PRICE_GOVERNMENT', 'price_government'),
    'standard': os.environ.get('STRIPE_PRICE_STANDARD', 'price_standard'),
}

def lambda_handler(event, context):
    print("Event:", json.dumps(event))
    
    try:
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event
        
        email = body.get('email')
        name = body.get('name')
        
        # FIX: Use priceId from request, fall back to tier lookup
        price_id = body.get('priceId')
        if not price_id:
            tier = body.get('tier', 'standard')
            price_id = PRICE_IDS.get(tier)
        
        use_pilot_coupon = body.get('use_pilot_coupon', False)
        
        if not email or not name:
            return respond(400, {'error': 'Missing email or name'})
        
        if not price_id:
            return respond(400, {'error': 'Missing priceId or tier'})
        
        # Use successUrl and cancelUrl from request if provided
        success_url = body.get('successUrl')
        cancel_url = body.get('cancelUrl')
        
        if not success_url or not cancel_url:
            portal_url = os.environ.get('PORTAL_URL', 'https://securebase.tximhotep.com')
            success_url = success_url or f"{portal_url}/success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = cancel_url or f"{portal_url}/signup?cancelled=true"
        
        session_params = {
            'payment_method_types': ['card'],
            'line_items': [{'price': price_id, 'quantity': 1}],
            'mode': 'subscription',
            'success_url': success_url,
            'cancel_url': cancel_url,
            'customer_email': email,
            'metadata': {'customer_name': name}
        }
        
        if use_pilot_coupon:
            coupon = os.environ.get('STRIPE_PILOT_COUPON')
            if coupon:
                session_params['discounts'] = [{'coupon': coupon}]
        
        session = stripe.checkout.Session.create(**session_params)
        
        return respond(200, {'checkout_url': session.url, 'session_id': session.id})
        
    except Exception as e:
        print(f"Error: {e}")
        return respond(500, {'error': str(e)})

def respond(code, body):
    return {
        'statusCode': code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body)
    }
