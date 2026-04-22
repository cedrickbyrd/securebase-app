import json
import os
import stripe

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

def lambda_handler(event, context):
    """
    Create a Stripe Checkout Session
    """
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    }
    
    # Handle OPTIONS preflight request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'CORS preflight'})
        }
    
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        # Support both naming conventions - check if key exists, not just if it's truthy
        price_id = body.get('price_id') if 'price_id' in body else body.get('priceId')
        customer_email = body.get('customer_email') if 'customer_email' in body else body.get('email')
        success_url = body.get('success_url', 'http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}')
        cancel_url = body.get('cancel_url', 'http://localhost:3000/pricing')
        
        if not price_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Missing price_id or priceId'})
            }
        
        # Create Checkout Session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            customer_email=customer_email,
            success_url=success_url,
            cancel_url=cancel_url,
            allow_promotion_codes=True,
            billing_address_collection='required',
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'sessionId': session.id,
                'checkout_url': session.url,
                'url': session.url
            })
        }
        
    except stripe.error.InvalidRequestError as e:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': str(e),
                'type': 'invalid_request'
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': str(e),
                'type': 'server_error'
            })
        }
