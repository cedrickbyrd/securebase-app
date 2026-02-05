"""
SecureBase Phase 2: Monthly Billing Worker

Calculates monthly invoices based on usage metrics
Triggered by EventBridge on 1st of each month at 00:00 UTC
"""

import json
import boto3
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, date, timedelta
from decimal import Decimal
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
RDS_ENDPOINT = os.environ.get('RDS_ENDPOINT')
RDS_PORT = os.environ.get('RDS_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'securebase')

# AWS Clients
secrets_client = boto3.client('secretsmanager')
ses_client = boto3.client('ses')
cloudwatch = boto3.client('cloudwatch')
dynamodb = boto3.resource('dynamodb')

metrics_table = dynamodb.Table(os.environ.get('METRICS_TABLE', 'securebase-metrics'))


def get_db_connection():
    """Get PostgreSQL connection via RDS Proxy"""
    try:
        secret_response = secrets_client.get_secret_value(
            SecretId=os.environ.get('RDS_SECRET_ARN')
        )
        secret_dict = json.loads(secret_response['SecretString'])
        
        conn = psycopg2.connect(
            host=RDS_ENDPOINT,
            port=int(RDS_PORT),
            database=DB_NAME,
            user=secret_dict['username'],
            password=secret_dict['password'],
            sslmode='require'
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        raise


def lambda_handler(event, context):
    """
    Main handler for monthly billing calculation
    
    Triggered by EventBridge rule:
    - cron(0 0 1 * ? *)  = 1st of each month at 00:00 UTC
    """
    try:
        logger.info("Starting monthly billing calculation")
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get all active customers
        cur.execute("""
            SELECT id, name, tier, billing_email, status
            FROM customers
            WHERE status = 'active'
            ORDER BY created_at ASC
        """)
        
        customers = cur.fetchall()
        logger.info(f"Processing {len(customers)} active customers")
        
        processed_count = 0
        error_count = 0
        
        for customer in customers:
            try:
                customer_id = customer['id']
                customer_name = customer['name']
                tier = customer['tier']
                billing_email = customer['billing_email']
                
                logger.info(f"Processing invoice for {customer_name} ({tier})")
                
                # Get usage metrics for last month
                usage_metrics = get_usage_metrics(cur, customer_id)
                
                # Get tier base cost
                tier_cost = get_tier_base_cost(cur, tier)
                logger.info(f"Tier base cost: ${tier_cost:.2f}")
                
                # Calculate usage charges
                usage_charges = calculate_usage_charges(usage_metrics, tier)
                usage_total = sum(usage_charges.values())
                logger.info(f"Usage charges: ${usage_total:.2f}")
                
                # Apply volume discount (5% for customers over $5k/month)
                if tier_cost + usage_total > 5000:
                    volume_discount = 0.05
                else:
                    volume_discount = 0.0
                
                # Calculate tax (8% sales tax)
                subtotal = tier_cost + usage_total
                discounted_subtotal = subtotal * (1 - volume_discount)
                tax_amount = Decimal(str(discounted_subtotal)) * Decimal('0.08')
                total_amount = Decimal(str(discounted_subtotal)) + tax_amount
                
                # Create invoice in database
                invoice_id = create_invoice(
                    cur, customer_id, tier_cost, usage_charges,
                    usage_total, volume_discount, float(tax_amount), float(total_amount)
                )
                
                # Send invoice email
                try:
                    send_invoice_email(
                        billing_email, customer_name, invoice_id,
                        tier_cost, usage_total, volume_discount,
                        float(tax_amount), float(total_amount)
                    )
                    logger.info(f"Invoice email sent to {billing_email}")
                except Exception as e:
                    logger.error(f"Failed to send invoice email: {str(e)}")
                
                # Log audit event
                log_audit_event(
                    cur, customer_id, 'invoice_generated',
                    f'Monthly invoice {invoice_id} created for {datetime.now().strftime("%B %Y")}'
                )
                
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Error processing customer {customer_id}: {str(e)}")
                error_count += 1
                continue
        
        conn.commit()
        cur.close()
        conn.close()
        
        # Publish CloudWatch metric
        cloudwatch.put_metric_data(
            Namespace='SecureBase/Billing',
            MetricData=[
                {
                    'MetricName': 'InvoicesProcessed',
                    'Value': processed_count,
                    'Unit': 'Count',
                    'Timestamp': datetime.utcnow()
                },
                {
                    'MetricName': 'InvoiceErrors',
                    'Value': error_count,
                    'Unit': 'Count',
                    'Timestamp': datetime.utcnow()
                }
            ]
        )
        
        result = {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Billing calculation complete',
                'processed': processed_count,
                'errors': error_count,
                'month': datetime.now().strftime('%Y-%m')
            })
        }
        
        logger.info(f"Billing complete: {processed_count} processed, {error_count} errors")
        return result
        
    except Exception as e:
        logger.exception(f"Billing worker error: {str(e)}")
        return error_response('Billing calculation failed', 500)


def get_usage_metrics(cur, customer_id):
    """Get monthly usage metrics from Aurora"""
    # Get previous month's metrics
    current_month = date.today()
    first_day_this_month = current_month.replace(day=1)
    last_day_prev_month = first_day_this_month - timedelta(days=1)
    first_day_prev_month = last_day_prev_month.replace(day=1)
    
    cur.execute("""
        SELECT 
            account_count, ou_count, scp_count,
            cloudtrail_events_logged, config_rule_evaluations, guardduty_findings,
            log_storage_gb, archive_storage_gb,
            nat_gateway_bytes_processed, vpn_connections_count,
            custom_ec2_instances, custom_rds_instances, custom_s3_buckets
        FROM usage_metrics
        WHERE customer_id = %s AND month = %s
    """, (customer_id, first_day_prev_month))
    
    result = cur.fetchone()
    
    if not result:
        logger.warning(f"No usage metrics found for {customer_id}")
        return {}
    
    return {
        'accounts': result['account_count'] or 0,
        'ous': result['ou_count'] or 0,
        'scps': result['scp_count'] or 0,
        'cloudtrail_events': result['cloudtrail_events_logged'] or 0,
        'config_evaluations': result['config_rule_evaluations'] or 0,
        'guardduty_findings': result['guardduty_findings'] or 0,
        'log_storage_gb': float(result['log_storage_gb'] or 0),
        'archive_storage_gb': float(result['archive_storage_gb'] or 0),
        'nat_bytes': result['nat_gateway_bytes_processed'] or 0,
        'vpn_connections': result['vpn_connections_count'] or 0,
        'ec2_instances': result['custom_ec2_instances'] or 0,
        'rds_instances': result['custom_rds_instances'] or 0,
        's3_buckets': result['custom_s3_buckets'] or 0
    }


def get_tier_base_cost(cur, tier):
    """Get base tier cost from database"""
    tier_pricing = {
        'standard': 2000.00,
        'fintech': 8000.00,
        'healthcare': 15000.00,
        'gov-federal': 25000.00
    }
    return tier_pricing.get(tier, 2000.00)


def calculate_usage_charges(usage_metrics, tier):
    """
    Calculate per-unit charges based on tier and usage
    Returns dict with line items
    """
    
    # Pricing rules by tier (discounts for higher tiers)
    pricing = {
        'standard': {
            'log_storage_gb': 0.03,
            'nat_bytes': 0.045 / (1024**3),
            'cloudtrail_events': 0.0000002,
            'config_evaluations': 0.001,
            'guardduty_findings': 0.05,
        },
        'fintech': {
            'log_storage_gb': 0.025,
            'nat_bytes': 0.040 / (1024**3),
            'cloudtrail_events': 0.00000015,
            'config_evaluations': 0.0008,
            'guardduty_findings': 0.04,
        },
        'healthcare': {
            'log_storage_gb': 0.025,
            'nat_bytes': 0.040 / (1024**3),
            'cloudtrail_events': 0.00000015,
            'config_evaluations': 0.0008,
            'guardduty_findings': 0.04,
        },
        'gov-federal': {
            'log_storage_gb': 0.020,
            'nat_bytes': 0.035 / (1024**3),
            'cloudtrail_events': 0.0000001,
            'config_evaluations': 0.0006,
            'guardduty_findings': 0.03,
        }
    }
    
    tier_pricing = pricing.get(tier, pricing['standard'])
    charges = {}
    
    # Calculate each charge category
    charges['log_storage'] = max(0, usage_metrics.get('log_storage_gb', 0) * tier_pricing['log_storage_gb'])
    charges['nat_processing'] = max(0, usage_metrics.get('nat_bytes', 0) * tier_pricing['nat_bytes'])
    charges['cloudtrail'] = max(0, usage_metrics.get('cloudtrail_events', 0) * tier_pricing['cloudtrail_events'])
    charges['config_evaluations'] = max(0, usage_metrics.get('config_evaluations', 0) * tier_pricing['config_evaluations'])
    charges['guardduty_findings'] = max(0, usage_metrics.get('guardduty_findings', 0) * tier_pricing['guardduty_findings'])
    
    logger.info(f"Charges calculated: {charges}")
    
    return charges


def create_invoice(cur, customer_id, tier_cost, usage_charges, usage_total, volume_discount, tax_amount, total_amount):
    """Create invoice record in Aurora"""
    
    current_month = date.today().replace(day=1)
    invoice_number = f"INV-{current_month.year}-{current_month.month:02d}-{datetime.now().strftime('%s')[-6:]}"
    
    cur.execute("""
        INSERT INTO invoices (
            customer_id, invoice_number, month, tier_base_cost, usage_charges,
            usage_total, volume_discount, subtotal, tax_amount, total_amount,
            status, issued_at, due_at
        ) VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            'issued', NOW(), NOW() + INTERVAL '30 days'
        )
        RETURNING id
    """, (
        customer_id, invoice_number, current_month,
        tier_cost, json.dumps(usage_charges),
        usage_total, volume_discount,
        tier_cost + usage_total,
        tax_amount, total_amount
    ))
    
    invoice_id = cur.fetchone()['id']
    logger.info(f"Invoice created: {invoice_id}")
    
    return invoice_id


def send_invoice_email(billing_email, customer_name, invoice_id, tier_cost, usage_total, volume_discount, tax_amount, total_amount):
    """Send invoice via SES"""
    
    subtotal = tier_cost + usage_total
    discounted_subtotal = subtotal * (1 - volume_discount)
    
    email_body = f"""
Dear {customer_name},

Your SecureBase monthly invoice is ready for payment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVOICE: {invoice_id}
PERIOD: {datetime.now().strftime('%B %Y')}
DUE DATE: {(datetime.now() + timedelta(days=30)).strftime('%B %d, %Y')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BASE TIER COST:        ${tier_cost:>10.2f}
USAGE CHARGES:         ${usage_total:>10.2f}
────────────────────────────────────
SUBTOTAL:              ${subtotal:>10.2f}

VOLUME DISCOUNT ({int(volume_discount*100)}%):   -${(subtotal * volume_discount):>9.2f}
DISCOUNTED SUBTOTAL:   ${discounted_subtotal:>10.2f}

SALES TAX (8%):        ${tax_amount:>10.2f}
────────────────────────────────────
TOTAL DUE:             ${total_amount:>10.2f}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View your invoice and payment options in the SecureBase customer portal:
https://portal.securebase.io/invoices/{invoice_id}

Questions? Contact billing@securebase.io

Best regards,
SecureBase Billing Team
"""
    
    ses_client.send_email(
        Source='billing@securebase.io',
        Destination={'ToAddresses': [billing_email]},
        Message={
            'Subject': {'Data': f'SecureBase Invoice {invoice_id} - {datetime.now().strftime("%B %Y")}'},
            'Body': {'Text': {'Data': email_body}}
        }
    )


def log_audit_event(cur, customer_id, event_type, action):
    """Log audit event to database"""
    cur.execute("""
        INSERT INTO audit_events (customer_id, event_type, action, actor_email, status)
        VALUES (%s, %s, %s, 'billing-system', 'success')
    """, (customer_id, event_type, action))


def error_response(message, status_code):
    """Standard error response"""
    return {
        'statusCode': status_code,
        'body': json.dumps({'error': message})
    }
