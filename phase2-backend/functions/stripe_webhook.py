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
        response = secretsmanager.get_secret_value(SecretId='securebase/stripe/secret-key')
        return response['SecretString']
    except Exception as e:
        print(f"Error fetching Stripe key: {e}")
        return os.environ.get('STRIPE_SECRET_KEY')


def lambda_handler(event, context):
    """
    Process Stripe webhook events

    Events handled:
    - checkout.session.completed: Routes to hipaa_assessment handler OR standard
      subscription handler based on session metadata tier.
    - invoice.payment_succeeded: Successful payment
    - invoice.payment_failed: Failed payment
    - customer.subscription.updated: Plan change
    - customer.subscription.deleted: Cancellation
    """

    # Verify webhook signature
    sig_header = event['headers'].get('stripe-signature')

    try:
        webhook_event = stripe.Webhook.construct_event(
            event['body'], sig_header, WEBHOOK_SECRET
        )
    except ValueError:
        return {'statusCode': 400, 'body': json.dumps({'error': 'Invalid payload'})}
    except stripe.error.SignatureVerificationError:
        return {'statusCode': 400, 'body': json.dumps({'error': 'Invalid signature'})}

    event_type = webhook_event['type']
    data = webhook_event['data']['object']

    print(f"Processing webhook: {event_type}")

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
            return {'statusCode': 200, 'body': json.dumps({'received': True})}
        except Exception as e:
            print(f"Error handling {event_type}: {e}")
            return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
    else:
        print(f"Unhandled event type: {event_type}")
        return {'statusCode': 200, 'body': json.dumps({'received': True, 'unhandled': True})}


# ---------------------------------------------------------------------------
# checkout.session.completed — router
# ---------------------------------------------------------------------------

def handle_checkout_completed(session):
    """
    Route checkout.session.completed to the correct handler.

    hipaa_assessment (mode='payment'):
        Applies $1,995 balance credit to the Stripe customer then auto-creates
        the Healthcare subscription (30-day trial + pilot coupon).  The credit
        is automatically deducted from the first Healthcare invoice when the
        trial ends.

    All other tiers (mode='subscription'):
        Standard flow — create/update the customer record and trigger onboarding.
    """
    tier = session.get('metadata', {}).get('tier', 'standard')

    if tier == 'hipaa_assessment':
        handle_hipaa_assessment_completed(session)
    else:
        handle_subscription_checkout_completed(session)


# ---------------------------------------------------------------------------
# HIPAA Assessment → Healthcare auto-enrollment
# ---------------------------------------------------------------------------

def handle_hipaa_assessment_completed(session):
    """
    HIPAA Assessment one-time payment completed (mode='payment').

    Step 1 — Apply -$1,995 balance credit to the Stripe customer.
              Negative customer balance is automatically applied as credit on
              the next invoice, so the first Healthcare charge is offset.

    Step 2 — Create a Healthcare subscription with a 30-day trial and the
              pilot coupon (50% off recurring, if STRIPE_PILOT_COUPON is set).

    Step 3 — Persist the customer record (create or update) and audit log.

    Step 4 — SNS notification + async onboarding trigger.
    """
    customer_email = (
        session.get('customer_email')
        or session.get('customer_details', {}).get('email')
        or session.get('metadata', {}).get('company_email')
    )
    stripe_customer_id = session.get('customer')
    metadata = session.get('metadata', {})
    customer_name = metadata.get('customer_name', (customer_email.split('@')[0] if customer_email else 'customer'))

    if not stripe_customer_id:
        raise ValueError("checkout.session.completed missing Stripe customer ID for hipaa_assessment flow")
    if not customer_email:
        raise ValueError("checkout.session.completed missing customer email for hipaa_assessment flow")

    # Credit amount — stored as USD integer string in session metadata
    try:
        assessment_credit_usd = int(metadata.get('assessment_credit', '1995'))
        assessment_credit_cents = assessment_credit_usd * 100
    except (ValueError, TypeError):
        assessment_credit_usd = 1995
        assessment_credit_cents = 199500

    upgrade_to_tier = metadata.get('upgrade_to', 'healthcare')
    healthcare_price_id = os.environ.get('STRIPE_PRICE_HEALTHCARE')
    pilot_coupon = os.environ.get('STRIPE_PILOT_COUPON')

    print(
        f"HIPAA Assessment completed for {customer_email} "
        f"(Stripe customer: {stripe_customer_id}). "
        f"Applying ${assessment_credit_usd} credit and enrolling in {upgrade_to_tier}."
    )

    # ------------------------------------------------------------------
    # Step 1: Apply balance credit
    # stripe.Customer.balance is stored in *cents* and negative = credit.
    # ------------------------------------------------------------------
    try:
        stripe.Customer.modify(
            stripe_customer_id,
            balance=-assessment_credit_cents,
            metadata={
                'assessment_credit_applied': str(assessment_credit_usd),
                'assessment_session_id': session.get('id', ''),
                'credit_applied_at': datetime.utcnow().isoformat(),
            }
        )
        print(f"Applied -${assessment_credit_usd} balance credit to {stripe_customer_id}")
    except stripe.error.StripeError as e:
        print(f"ERROR applying balance credit to {stripe_customer_id}: {e}")
        raise  # Re-raise so Stripe retries the webhook

    # ------------------------------------------------------------------
    # Step 2: Create Healthcare subscription
    # ------------------------------------------------------------------
    if not healthcare_price_id:
        print("ERROR: STRIPE_PRICE_HEALTHCARE not configured — cannot auto-enroll.")
        raise RuntimeError("STRIPE_PRICE_HEALTHCARE environment variable is not set")

    try:
        subscription_params = {
            'customer': stripe_customer_id,
            'items': [{'price': healthcare_price_id}],
            'trial_period_days': 30,
            'metadata': {
                'tier': upgrade_to_tier,
                'customer_name': customer_name,
                'source': 'hipaa_assessment_auto_enrollment',
                'assessment_session_id': session.get('id', ''),
                'assessment_credit_usd': str(assessment_credit_usd),
                'compliance_framework': 'HIPAA',
            },
        }
        if pilot_coupon:
            subscription_params['coupon'] = pilot_coupon

        healthcare_sub = stripe.Subscription.create(**subscription_params)
        stripe_subscription_id = healthcare_sub['id']
        trial_end_ts = healthcare_sub.get('trial_end')
        trial_end_str = (
            datetime.fromtimestamp(trial_end_ts).isoformat() if trial_end_ts else 'N/A'
        )
        print(
            f"Healthcare subscription {stripe_subscription_id} created for "
            f"{customer_email} (trial_end: {trial_end_str})"
        )
    except stripe.error.StripeError as e:
        print(f"ERROR creating Healthcare subscription for {stripe_customer_id}: {e}")
        raise

    # ------------------------------------------------------------------
    # Step 3: Persist customer record
    # ------------------------------------------------------------------
    conn = get_db_connection()
    customer_id = None
    try:
        import uuid
        sql_check = "SELECT id FROM customers WHERE email = %s"
        existing = execute_query(conn, sql_check, (customer_email,))

        if existing:
            customer_id = existing[0][0]
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
                conn, sql_update,
                (stripe_customer_id, stripe_subscription_id, upgrade_to_tier, customer_email)
            )
        else:
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
            result = execute_update(
                conn, sql_insert,
                (customer_id, customer_name, customer_email, customer_email,
                 upgrade_to_tier, 'hipaa', 'trial',
                 stripe_customer_id, stripe_subscription_id,
                 'trialing', 'stripe', True)
            )

        if result:
            customer_id, customer_name = result[0]
            print(f"Customer record persisted: {customer_name} ({customer_email})")

        # Audit log
        sql_audit = """
            INSERT INTO audit_events (
                customer_id, event_type, action,
                actor_email, status, metadata
            ) VALUES (%s, %s, %s, %s, %s, %s)
        """
        audit_meta = json.dumps({
            'assessment_tier': 'hipaa_assessment',
            'enrolled_tier': upgrade_to_tier,
            'assessment_credit_usd': assessment_credit_usd,
            'stripe_subscription_id': stripe_subscription_id,
            'stripe_customer_id': stripe_customer_id,
            'timestamp': datetime.utcnow().isoformat(),
        })
        execute_update(
            conn, sql_audit,
            (customer_id, 'hipaa_assessment_enrollment', 'healthcare_subscription_created',
             customer_email, 'success', audit_meta)
        )

    except Exception as e:
        print(f"Error persisting HIPAA assessment customer record: {e}")
        raise
    finally:
        conn.close()

    # ------------------------------------------------------------------
    # Step 4: Notify ops + trigger async onboarding
    # ------------------------------------------------------------------
    send_notification(
        subject=f"HIPAA Assessment Sold + Healthcare Enrolled: {customer_name}",
        message=(
            f"Customer {customer_name} ({customer_email}) completed the HIPAA Readiness "
            f"Assessment (${assessment_credit_usd}).\n"
            f"A -${assessment_credit_usd} balance credit has been applied to their Stripe account.\n"
            f"Healthcare subscription {stripe_subscription_id} created with 30-day trial.\n"
            f"The assessment fee will be deducted from the first invoice after trial end."
        )
    )

    if customer_id:
        trigger_onboarding(customer_id, upgrade_to_tier)


# ---------------------------------------------------------------------------
# Standard subscription checkout
# ---------------------------------------------------------------------------

def handle_subscription_checkout_completed(session):
    """
    Standard subscription checkout completed.
    Create or update the customer record and trigger onboarding.
    """
    conn = get_db_connection()

    try:
        customer_email = session['customer_email']
        stripe_customer_id = session['customer']
        stripe_subscription_id = session['subscription']

        tier = session['metadata'].get('tier', 'standard')
        customer_name = session['metadata'].get('customer_name', customer_email.split('@')[0])

        sql_check = "SELECT id, name FROM customers WHERE email = %s"
        existing = execute_query(conn, sql_check, (customer_email,))

        if existing:
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
                conn, sql_update,
                (stripe_customer_id, stripe_subscription_id, tier, customer_email)
            )
        else:
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
            framework_map = {
                'standard': 'cis', 'fintech': 'soc2',
                'healthcare': 'hipaa', 'government': 'fedramp'
            }
            framework = framework_map.get(tier, 'cis')
            result = execute_update(
                conn, sql_insert,
                (customer_id, customer_name, customer_email, customer_email,
                 tier, framework, 'trial',
                 stripe_customer_id, stripe_subscription_id,
                 'trialing', 'stripe', True)
            )

        if result:
            customer_id, customer_name = result[0]
            print(f"Customer activated: {customer_name} ({customer_email})")
            send_notification(
                subject=f"New Customer: {customer_name}",
                message=f"Customer {customer_name} ({customer_email}) signed up for {tier} tier.\nCustomer ID: {customer_id}"
            )
            trigger_onboarding(customer_id, tier)

    except Exception as e:
        print(f"Error in checkout completion: {e}")
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Invoice / subscription event handlers (unchanged)
# ---------------------------------------------------------------------------

def handle_payment_succeeded(invoice):
    conn = get_db_connection()
    try:
        stripe_invoice_id = invoice['id']
        stripe_customer_id = invoice['customer']
        amount_paid = invoice['amount_paid'] / 100

        sql_customer = "SELECT id FROM customers WHERE stripe_customer_id = %s"
        customer_result = execute_query(conn, sql_customer, (stripe_customer_id,))
        if not customer_result:
            print(f"Customer not found for Stripe ID: {stripe_customer_id}")
            return

        customer_id = customer_result[0][0]
        sql_update = """
            UPDATE invoices
            SET status = 'paid', paid_at = %s,
                stripe_payment_intent_id = %s, updated_at = NOW()
            WHERE stripe_invoice_id = %s
        """
        paid_at = datetime.fromtimestamp(invoice['status_transitions']['paid_at'])
        payment_intent_id = invoice.get('payment_intent')
        execute_update(conn, sql_update, (paid_at, payment_intent_id, stripe_invoice_id))
        print(f"Invoice {stripe_invoice_id} marked as paid: ${amount_paid}")
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
    conn = get_db_connection()
    try:
        stripe_invoice_id = invoice['id']
        stripe_customer_id = invoice['customer']
        sql_update = """
            UPDATE invoices
            SET status = 'payment_failed', updated_at = NOW()
            WHERE stripe_invoice_id = %s
        """
        execute_update(conn, sql_update, (stripe_invoice_id,))
        sql_select_customer = """
            SELECT email, name
            FROM customers
            WHERE stripe_customer_id = %s
        """
        result = execute_query(conn, sql_select_customer, (stripe_customer_id,))
        if result:
            email, name = result[0]
            send_notification(
                subject=f"Payment Failed: {name}",
                message=f"Payment failed for invoice {stripe_invoice_id}. Customer: {email}"
            )
            print(f"Payment failed for {email} - invoice {stripe_invoice_id}")
    except Exception as e:
        print(f"Error handling failed payment: {e}")
        raise
    finally:
        conn.close()


def handle_subscription_updated(subscription):
    conn = get_db_connection()
    try:
        stripe_subscription_id = subscription['id']
        status = subscription['status']
        sql_update = """
            UPDATE customers
            SET subscription_status = %s, updated_at = NOW()
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
    conn = get_db_connection()
    try:
        stripe_subscription_id = subscription['id']
        sql_update = """
            UPDATE customers
            SET subscription_status = 'cancelled', updated_at = NOW()
            WHERE stripe_subscription_id = %s
            RETURNING email, name
        """
        result = execute_update(conn, sql_update, (stripe_subscription_id,))
        if result:
            email, name = result[0]
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
    print(f"Payment intent succeeded: {payment_intent['id']}")


def handle_payment_intent_failed(payment_intent):
    print(f"Payment intent failed: {payment_intent['id']}")


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def send_notification(subject, message):
    try:
        topic_arn = os.environ.get('SNS_TOPIC_ARN')
        if topic_arn:
            sns.publish(TopicArn=topic_arn, Subject=subject, Message=message)
    except Exception as e:
        print(f"Error sending notification: {e}")


def trigger_onboarding(customer_id, tier):
    try:
        conn = get_db_connection()
        sql = "SELECT email, name FROM customers WHERE id = %s"
        result = execute_query(conn, sql, (customer_id,))
        conn.close()
        if not result:
            print(f"Customer not found: {customer_id}")
            return
        email, name = result[0]
        lambda_client = boto3.client('lambda')
        function_name = os.environ.get('ONBOARDING_FUNCTION_NAME', 'securebase-trigger-onboarding')
        lambda_client.invoke(
            FunctionName=function_name,
            InvocationType='Event',
            Payload=json.dumps({'customer_id': customer_id, 'tier': tier, 'email': email, 'name': name})
        )
        print(f"Onboarding triggered for {name} ({email})")
    except Exception as e:
        print(f"Error triggering onboarding: {e}")


if __name__ == "__main__":
    # Local testing stub
    test_event = {
        'headers': {'stripe-signature': 'test'},
        'body': json.dumps({
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'id': 'cs_test_xxx',
                    'customer_email': 'test@hospital.com',
                    'customer': 'cus_test123',
                    'subscription': None,
                    'metadata': {
                        'tier': 'hipaa_assessment',
                        'customer_name': 'Test Hospital',
                        'upgrade_to': 'healthcare',
                        'assessment_credit': '1995',
                    }
                }
            }
        })
    }
    # response = lambda_handler(test_event, {})
    # print(response)
