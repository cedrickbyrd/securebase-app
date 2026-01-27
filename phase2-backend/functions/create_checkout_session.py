"""
Create Stripe Checkout Session
Initiates payment flow for new customers
"""

import json
import os
import stripe
import hashlib
import time
from datetime import datetime, timedelta
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

# Rate limiting configuration
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds
RATE_LIMIT_MAX_REQUESTS = 5  # Max 5 signups per IP per hour


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
        # Get client IP for rate limiting
        client_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
        
        # Check rate limit
        if not check_rate_limit(client_ip):
            return {
                'statusCode': 429,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Retry-After': '3600',
                },
                'body': json.dumps({
                    'error': 'Rate limit exceeded. Maximum 5 signups per hour per IP address.'
                })
            }
        
        # Parse request
        body = json.loads(event['body'])
        tier = body.get('tier', 'standard').lower()
        customer_email = body.get('email')
        customer_name = body.get('name')
        use_pilot = body.get('use_pilot_coupon', False)
        
        # Validate inputs
        validation_error = validate_inputs(tier, customer_email, customer_name)
        if validation_error:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({'error': validation_error})
            }
        
        price_id = PRICE_IDS[tier]
        
        if not price_id:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': f'Price ID not configured for tier: {tier}'})
            }
        
        # Check if customer already exists with active subscription
        conn = get_db_connection()
        sql = """
            SELECT id, stripe_customer_id, subscription_status 
            FROM customers 
            WHERE email = %s
        """
        existing = execute_query(conn, sql, (customer_email,))
        conn.close()
        
        if existing and existing[0][2] in ['active', 'trialing']:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'error': 'An active subscription already exists for this email address.'
                })
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
            'client_reference_id': customer_email,  # For idempotency
            'metadata': {
                'tier': tier,
                'customer_name': customer_name,
                'signup_timestamp': datetime.utcnow().isoformat(),
            },
            'subscription_data': {
                'metadata': {
                    'tier': tier,
                    'customer_name': customer_name,
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
        
        # Record rate limit attempt
        record_rate_limit_attempt(client_ip)
        
        # Log signup attempt for audit
        log_signup_attempt(customer_email, tier, client_ip, 'checkout_created')
        
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
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': f'Payment provider error: {str(e)}'})
        }
    
    except Exception as e:
        print(f"Error creating checkout session: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': 'Internal server error'})
        }


def validate_inputs(tier, email, name):
    """
    Validate signup inputs
    Returns error message or None if valid
    """
    import re
    
    # Validate email format
    if not email:
        return 'Email is required'
    
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return 'Invalid email format'
    
    # Block disposable email domains
    disposable_domains = ['tempmail.com', 'guerrillamail.com', 'mailinator.com', '10minutemail.com']
    email_domain = email.split('@')[1].lower()
    if email_domain in disposable_domains:
        return 'Disposable email addresses are not allowed'
    
    # Validate name
    if not name or len(name.strip()) < 2:
        return 'Company name is required (minimum 2 characters)'
    
    if len(name) > 100:
        return 'Company name is too long (maximum 100 characters)'
    
    # Validate tier
    if tier not in PRICE_IDS:
        return f'Invalid tier: {tier}. Must be one of: {", ".join(PRICE_IDS.keys())}'
    
    return None


def check_rate_limit(client_ip):
    """
    Check if client IP has exceeded rate limit
    Returns True if within limit, False if exceeded
    """
    try:
        import boto3
        dynamodb = boto3.resource('dynamodb')
        table_name = os.environ.get('RATE_LIMIT_TABLE', 'securebase-signup-rate-limits')
        table = dynamodb.Table(table_name)
        
        # Get current timestamp
        current_time = int(time.time())
        window_start = current_time - RATE_LIMIT_WINDOW
        
        # Hash IP for privacy
        ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
        
        # Query attempts in current window
        response = table.get_item(
            Key={'ip_hash': ip_hash}
        )
        
        if 'Item' in response:
            item = response['Item']
            attempts = item.get('attempts', [])
            
            # Filter attempts within current window
            recent_attempts = [ts for ts in attempts if ts > window_start]
            
            if len(recent_attempts) >= RATE_LIMIT_MAX_REQUESTS:
                print(f"Rate limit exceeded for IP: {client_ip[:10]}...")
                return False
        
        return True
        
    except Exception as e:
        # If rate limiting fails, allow the request (fail open)
        print(f"Rate limit check failed: {e}")
        return True


def record_rate_limit_attempt(client_ip):
    """Record a signup attempt for rate limiting"""
    try:
        import boto3
        dynamodb = boto3.resource('dynamodb')
        table_name = os.environ.get('RATE_LIMIT_TABLE', 'securebase-signup-rate-limits')
        table = dynamodb.Table(table_name)
        
        current_time = int(time.time())
        window_start = current_time - RATE_LIMIT_WINDOW
        
        # Hash IP for privacy
        ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
        
        # Get existing attempts
        response = table.get_item(
            Key={'ip_hash': ip_hash}
        )
        
        attempts = []
        if 'Item' in response:
            attempts = response['Item'].get('attempts', [])
        
        # Add current attempt and filter old ones
        attempts.append(current_time)
        attempts = [ts for ts in attempts if ts > window_start]
        
        # Update DynamoDB
        table.put_item(
            Item={
                'ip_hash': ip_hash,
                'attempts': attempts,
                'last_attempt': current_time,
                'ttl': current_time + RATE_LIMIT_WINDOW
            }
        )
        
    except Exception as e:
        print(f"Failed to record rate limit attempt: {e}")


def log_signup_attempt(email, tier, client_ip, status):
    """Log signup attempt for audit trail"""
    try:
        conn = get_db_connection()
        
        # Create audit event
        sql = """
            INSERT INTO audit_events (
                customer_id, event_type, action,
                actor_email, actor_ip_address,
                status, metadata
            )
            VALUES (
                NULL, 'signup_attempt', 'checkout_session_created',
                %s, %s, %s, %s
            )
        """
        
        metadata = json.dumps({
            'tier': tier,
            'timestamp': datetime.utcnow().isoformat(),
            'ip_hash': hashlib.sha256(client_ip.encode()).hexdigest()[:16]
        })
        
        from db_utils import execute_update
        execute_update(conn, sql, (email, client_ip, status, metadata))
        conn.close()
        
    except Exception as e:
        print(f"Failed to log signup attempt: {e}")


if __name__ == "__main__":
    # Local testing
    test_event = {
        'body': json.dumps({
            'tier': 'healthcare',
            'email': 'test@example.com',
            'name': 'Test Hospital',
            'use_pilot_coupon': True
        }),
        'requestContext': {
            'identity': {
                'sourceIp': '192.0.2.1'
            }
        }
    }
    
    response = lambda_handler(test_event, {})
    print(json.dumps(json.loads(response['body']), indent=2))
