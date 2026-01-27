"""
Stripe Webhook Handler for SecureBase
Processes payment events and updates customer records
"""

import json
import os
import boto3
import stripe
from datetime import datetime

# Import shared database utilities from Lambda Layer
from db_utils import (
    get_db_connection,
    execute_query,
    execute_update,
    get_customer_by_email
)

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')
WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')

# Initialize AWS clients
secretsmanager = boto3.client('secretsmanager')
sns = boto3.client('sns')


def get_stripe_key():
    """Fetch Stripe key from Secrets Manager"""
    try:
        response = secretsmanager.get_secret_value(
            SecretId='securebase/stripe/secret-key'
        )
        return response['SecretString']
    except Exception as e:
        print(f"Error fetching Stripe key: {e}")
        return os.environ.get('STRIPE_SECRET_KEY')


def lambda_handler(event, context):
    """
    Process Stripe webhook events
    
    Events handled:
    - checkout.session.completed: New subscription started
    - invoice.payment_succeeded: Successful payment
    - invoice.payment_failed: Failed payment
    - customer.subscription.updated: Plan change
    - customer.subscription.deleted: Cancellation
    """
    
    # Verify webhook signature
    sig_header = event['headers'].get('stripe-signature')
    
    try:
        webhook_event = stripe.Webhook.construct_event(
            event['body'],
            sig_header,
            WEBHOOK_SECRET
        )
    except ValueError:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid payload'})
        }
    except stripe.error.SignatureVerificationError:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid signature'})
        }
    
    event_type = webhook_event['type']
    data = webhook_event['data']['object']
    
    print(f"Processing webhook: {event_type}")
    
    # Route to appropriate handler
    handlers = {
        'checkout.session.completed': handle_checkout_completed,
        'invoice.payment_succeeded': handle_payment_succeeded,
        'invoice.payment_failed': handle_payment_failed,
        'customer.subscription.updated': handle_subscription_updated,
        'customer.subscription.deleted': handle_subscription_deleted,
        'payment_intent.succeeded': handle_payment_intent_succeeded,
        'payment_intent.payment_failed': handle_payment_intent_failed,
    }
    
    handler = handlers.get(event_type)
    
    if handler:
        try:
            handler(data)
            return {
                'statusCode': 200,
                'body': json.dumps({'received': True})
            }
        except Exception as e:
            print(f"Error handling {event_type}: {e}")
            return {
                'statusCode': 500,
                'body': json.dumps({'error': str(e)})
            }
    else:
        print(f"Unhandled event type: {event_type}")
        return {
            'statusCode': 200,
            'body': json.dumps({'received': True, 'unhandled': True})
        }


def handle_checkout_completed(session):
    """
    New customer signup completed
    Create customer record and trigger onboarding
    """
    conn = get_db_connection()
    
    try:
        customer_email = session['customer_email']
        stripe_customer_id = session['customer']
        stripe_subscription_id = session['subscription']
        
        # Get tier and name from metadata
        tier = session['metadata'].get('tier', 'standard')
        customer_name = session['metadata'].get('customer_name', customer_email.split('@')[0])
        
        # Check if customer already exists
        sql_check = "SELECT id, name FROM customers WHERE email = %s"
        existing = execute_query(conn, sql_check, (customer_email,))
        
        if existing:
            # Customer exists - just update Stripe IDs
            customer_id, name = existing[0]
            sql_update = """
                UPDATE customers 
                SET 
                    stripe_customer_id = %s,
                    stripe_subscription_id = %s,
                    tier = %s,
                    subscription_status = 'trialing',
                    trial_end_date = NOW() + INTERVAL '30 days',
                    updated_at = NOW()
                WHERE email = %s
                RETURNING id, name
            """
            
            result = execute_update(
                conn,
                sql_update,
                (stripe_customer_id, stripe_subscription_id, tier, customer_email)
            )
        else:
            # Create new customer record
            import uuid
            customer_id = str(uuid.uuid4())
            
            sql_insert = """
                INSERT INTO customers (
                    id, name, email, billing_email,
                    tier, framework, status,
                    stripe_customer_id, stripe_subscription_id,
                    subscription_status, trial_end_date,
                    payment_method, mfa_enforced
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW() + INTERVAL '30 days', %s, %s)
                RETURNING id, name
            """
            
            # Map tier to framework
            framework_map = {
                'standard': 'cis',
                'fintech': 'soc2',
                'healthcare': 'hipaa',
                'government': 'fedramp'
            }
            framework = framework_map.get(tier, 'cis')
            
            result = execute_update(
                conn,
                sql_insert,
                (customer_id, customer_name, customer_email, customer_email,
                 tier, framework, 'trial',
                 stripe_customer_id, stripe_subscription_id,
                 'trialing', 'stripe', True)
            )
        
        if result:
            customer_id, customer_name = result[0]
            print(f"Customer activated: {customer_name} ({customer_email})")
            
            # Send notification
            send_notification(
                subject=f"New Customer: {customer_name}",
                message=f"Customer {customer_name} ({customer_email}) signed up for {tier} tier.\nCustomer ID: {customer_id}"
            )
            
            # Trigger onboarding workflow
            trigger_onboarding(customer_id, tier)
        
    except Exception as e:
        print(f"Error in checkout completion: {e}")
        raise
    finally:
        conn.close()


def handle_payment_succeeded(invoice):
    """
    Payment succeeded - update invoice record
    """
    conn = get_db_connection()
    
    try:
        stripe_invoice_id = invoice['id']
        stripe_customer_id = invoice['customer']
        amount_paid = invoice['amount_paid'] / 100  # Convert cents to dollars
        
        # Find customer
        sql_customer = """
            SELECT id FROM customers 
            WHERE stripe_customer_id = %s
        """
        customer_result = execute_query(conn, sql_customer, (stripe_customer_id,))
        
        if not customer_result:
            print(f"Customer not found for Stripe ID: {stripe_customer_id}")
            return
        
        customer_id = customer_result[0][0]
        
        # Update invoice status
        sql_update = """
            UPDATE invoices 
            SET 
                status = 'paid',
                paid_at = %s,
                stripe_payment_intent_id = %s,
                updated_at = NOW()
            WHERE stripe_invoice_id = %s
        """
        
        paid_at = datetime.fromtimestamp(invoice['status_transitions']['paid_at'])
        payment_intent_id = invoice.get('payment_intent')
        
        execute_update(
            conn,
            sql_update,
            (paid_at, payment_intent_id, stripe_invoice_id)
        )
        
        print(f"Invoice {stripe_invoice_id} marked as paid: ${amount_paid}")
        
        # Send payment confirmation
        send_notification(
            subject=f"Payment Received: ${amount_paid}",
            message=f"Customer {customer_id} paid invoice {stripe_invoice_id}"
        )
        
    except Exception as e:
        print(f"Error processing payment: {e}")
        raise
    finally:
        conn.close()


def handle_payment_failed(invoice):
    """
    Payment failed - update invoice and notify customer
    """
    conn = get_db_connection()
    
    try:
        stripe_invoice_id = invoice['id']
        stripe_customer_id = invoice['customer']
        
        # Update invoice status
        sql_update = """
            UPDATE invoices 
            SET 
                status = 'payment_failed',
                updated_at = NOW()
            WHERE stripe_invoice_id = %s
        """
        
        execute_update(conn, sql_update, (stripe_invoice_id,))
        
        # Get customer email
        sql_customer = """
            SELECT email, name FROM customers 
            WHERE stripe_customer_id = %s
        """
        customer_result = execute_query(conn, sql_customer, (stripe_customer_id,))
        
        if customer_result:
            email, name = customer_result[0]
            
            # Send alert
            send_notification(
                subject=f"Payment Failed: {name}",
                message=f"Payment failed for invoice {stripe_invoice_id}. Customer: {email}"
            )
            
            # TODO: Send customer notification email
            print(f"Payment failed for {email} - invoice {stripe_invoice_id}")
        
    except Exception as e:
        print(f"Error handling failed payment: {e}")
        raise
    finally:
        conn.close()


def handle_subscription_updated(subscription):
    """
    Subscription updated (plan change, trial ending, etc.)
    """
    conn = get_db_connection()
    
    try:
        stripe_subscription_id = subscription['id']
        status = subscription['status']
        
        # Update customer subscription status
        sql_update = """
            UPDATE customers 
            SET 
                subscription_status = %s,
                updated_at = NOW()
            WHERE stripe_subscription_id = %s
        """
        
        execute_update(conn, sql_update, (status, stripe_subscription_id))
        
        print(f"Subscription {stripe_subscription_id} updated to: {status}")
        
    except Exception as e:
        print(f"Error updating subscription: {e}")
        raise
    finally:
        conn.close()


def handle_subscription_deleted(subscription):
    """
    Subscription cancelled
    """
    conn = get_db_connection()
    
    try:
        stripe_subscription_id = subscription['id']
        
        # Update customer status
        sql_update = """
            UPDATE customers 
            SET 
                subscription_status = 'cancelled',
                updated_at = NOW()
            WHERE stripe_subscription_id = %s
            RETURNING email, name
        """
        
        result = execute_update(conn, sql_update, (stripe_subscription_id,))
        
        if result:
            email, name = result[0]
            
            # Send cancellation alert
            send_notification(
                subject=f"Subscription Cancelled: {name}",
                message=f"Customer {name} ({email}) cancelled their subscription."
            )
            
            print(f"Subscription cancelled: {name} ({email})")
        
    except Exception as e:
        print(f"Error handling cancellation: {e}")
        raise
    finally:
        conn.close()


def handle_payment_intent_succeeded(payment_intent):
    """Handle successful payment intent"""
    print(f"Payment intent succeeded: {payment_intent['id']}")
    # Additional processing if needed


def handle_payment_intent_failed(payment_intent):
    """Handle failed payment intent"""
    print(f"Payment intent failed: {payment_intent['id']}")
    # Additional processing if needed


def send_notification(subject, message):
    """Send SNS notification for important events"""
    try:
        topic_arn = os.environ.get('SNS_TOPIC_ARN')
        if topic_arn:
            sns.publish(
                TopicArn=topic_arn,
                Subject=subject,
                Message=message
            )
    except Exception as e:
        print(f"Error sending notification: {e}")


def trigger_onboarding(customer_id, tier):
    """
    Trigger automated onboarding workflow
    - Send welcome email
    - Create initial AWS account
    - Generate API key
    """
    try:
        # Get customer details
        conn = get_db_connection()
        sql = "SELECT email, name FROM customers WHERE id = %s"
        result = execute_query(conn, sql, (customer_id,))
        conn.close()
        
        if not result:
            print(f"Customer not found: {customer_id}")
            return
        
        email, name = result[0]
        
        # Invoke trigger_onboarding Lambda
        lambda_client = boto3.client('lambda')
        function_name = os.environ.get('ONBOARDING_FUNCTION_NAME', 'securebase-trigger-onboarding')
        
        payload = {
            'customer_id': customer_id,
            'tier': tier,
            'email': email,
            'name': name
        }
        
        response = lambda_client.invoke(
            FunctionName=function_name,
            InvocationType='Event',  # Async invocation
            Payload=json.dumps(payload)
        )
        
        print(f"Onboarding triggered for {name} ({email})")
        
    except Exception as e:
        print(f"Error triggering onboarding: {e}")
        # Don't fail webhook if onboarding trigger fails
        pass


if __name__ == "__main__":
    # Local testing
    test_event = {
        'headers': {'stripe-signature': 'test'},
        'body': json.dumps({
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'customer_email': 'test@example.com',
                    'customer': 'cus_test123',
                    'subscription': 'sub_test123',
                    'metadata': {'tier': 'healthcare'}
                }
            }
        })
    }
    
    # Run handler
    # response = lambda_handler(test_event, {})
    # print(response)
