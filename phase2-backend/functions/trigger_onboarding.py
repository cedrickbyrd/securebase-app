"""
Trigger Onboarding Automation for SecureBase
Orchestrates customer provisioning after successful payment
"""

import json
import os
import boto3
import uuid
from datetime import datetime, timedelta
from db_utils import (
    get_db_connection,
    execute_query,
    execute_update
)

# Initialize AWS clients
sns = boto3.client('sns')
ses = boto3.client('ses')
lambda_client = boto3.client('lambda')


def lambda_handler(event, context):
    """
    Trigger automated onboarding workflow
    
    Input:
    {
        "customer_id": "uuid",
        "tier": "healthcare",
        "email": "customer@example.com",
        "name": "Customer Name"
    }
    """
    
    try:
        # Parse input
        body = json.loads(event.get('body', '{}')) if isinstance(event.get('body'), str) else event
        customer_id = body.get('customer_id')
        tier = body.get('tier', 'standard')
        email = body.get('email')
        name = body.get('name')
        
        if not customer_id or not email:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'customer_id and email required'})
            }
        
        print(f"Starting onboarding for customer {customer_id} ({name})")
        
        # Step 1: Generate API key
        api_key = generate_api_key(customer_id, email)
        
        # Step 2: Create initial admin user
        user_id = create_admin_user(customer_id, email, name)
        
        # Step 3: Send welcome email
        send_welcome_email(customer_id, email, name, tier, api_key)
        
        # Step 4: Create audit event
        log_onboarding_event(customer_id, email, 'onboarding_completed')
        
        # Step 5: Trigger infrastructure provisioning (async)
        trigger_infrastructure_provisioning(customer_id, tier, name, email)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'customer_id': customer_id,
                'user_id': user_id,
                'message': 'Onboarding initiated successfully'
            })
        }
        
    except Exception as e:
        print(f"Error in onboarding: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


def generate_api_key(customer_id, email):
    """Generate and store API key for customer"""
    conn = get_db_connection()
    
    try:
        # Generate secure API key
        key_prefix = "sk_live"
        key_secret = uuid.uuid4().hex + uuid.uuid4().hex  # 64 chars
        full_key = f"{key_prefix}_{key_secret}"
        
        # Hash for storage
        import hashlib
        key_hash = hashlib.sha256(full_key.encode()).hexdigest()
        
        # Store in database
        sql = """
            INSERT INTO api_keys (
                customer_id, key_hash, key_prefix, 
                name, scopes, expires_at, status
            )
            VALUES (%s, %s, %s, %s, %s, NULL, 'active')
            RETURNING id
        """
        
        scopes = ['read:invoices', 'read:metrics', 'read:compliance', 'write:support']
        
        result = execute_update(
            conn,
            sql,
            (customer_id, key_hash, key_prefix, 'Default API Key', json.dumps(scopes))
        )
        
        if result:
            print(f"API key generated for customer {customer_id}")
            return full_key
        else:
            raise Exception("Failed to create API key")
            
    except Exception as e:
        print(f"Error generating API key: {e}")
        raise
    finally:
        conn.close()


def create_admin_user(customer_id, email, name):
    """Create initial admin user for customer portal"""
    conn = get_db_connection()
    
    try:
        # Check if user already exists
        sql_check = "SELECT id FROM users WHERE email = %s AND customer_id = %s"
        existing = execute_query(conn, sql_check, (email, customer_id))
        
        if existing:
            print(f"User already exists: {email}")
            return existing[0][0]
        
        # Create new user
        import bcrypt
        
        # Generate temporary password
        temp_password = uuid.uuid4().hex[:16]
        password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        sql_insert = """
            INSERT INTO users (
                id, customer_id, email, name, 
                password_hash, role, status, 
                must_change_password, email_verified
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """
        
        user_id = str(uuid.uuid4())
        
        result = execute_update(
            conn,
            sql_insert,
            (user_id, customer_id, email, name, password_hash, 'admin', 'active', True, False)
        )
        
        if result:
            print(f"Admin user created: {email}")
            
            # Send password reset email (via SES)
            send_password_setup_email(email, name, temp_password)
            
            return user_id
        else:
            raise Exception("Failed to create admin user")
            
    except Exception as e:
        print(f"Error creating admin user: {e}")
        raise
    finally:
        conn.close()


def send_welcome_email(customer_id, email, name, tier, api_key):
    """Send welcome email with credentials and onboarding info"""
    
    try:
        portal_url = os.environ.get('PORTAL_URL', 'https://portal.securebase.io')
        
        subject = f"Welcome to SecureBase - Your {tier.title()} Account is Ready!"
        
        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .api-key {{ background: #fff; padding: 15px; border-left: 4px solid #667eea; 
                          font-family: monospace; word-break: break-all; }}
                .button {{ display: inline-block; background: #667eea; color: white; 
                         padding: 12px 30px; text-decoration: none; border-radius: 5px; 
                         margin: 20px 0; }}
                .section {{ margin: 20px 0; }}
                .checklist {{ list-style: none; padding: 0; }}
                .checklist li {{ padding: 10px; background: white; margin: 5px 0; 
                               border-radius: 5px; }}
                .checklist li:before {{ content: "☐ "; color: #667eea; font-weight: bold; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Welcome to SecureBase!</h1>
                    <p>Your AWS Landing Zone is being provisioned</p>
                </div>
                
                <div class="content">
                    <p>Hello {name},</p>
                    
                    <p>Thank you for choosing SecureBase! Your <strong>{tier.title()}</strong> 
                    tier account has been created and your infrastructure is being provisioned.</p>
                    
                    <div class="section">
                        <h2>🔑 Your API Key</h2>
                        <p>Use this key to access the SecureBase API:</p>
                        <div class="api-key">
                            {api_key}
                        </div>
                        <p><em>⚠️ This is the only time you'll see this key. Store it securely!</em></p>
                    </div>
                    
                    <div class="section">
                        <h2>🚀 Get Started</h2>
                        <a href="{portal_url}/login" class="button">Access Customer Portal</a>
                        <p>You'll receive a separate email to set up your password.</p>
                    </div>
                    
                    <div class="section">
                        <h2>📋 What's Next?</h2>
                        <ul class="checklist">
                            <li>Set up your password (check your email)</li>
                            <li>Configure multi-factor authentication (MFA)</li>
                            <li>Review your compliance dashboard</li>
                            <li>Add additional team members</li>
                            <li>Deploy your first workload</li>
                        </ul>
                    </div>
                    
                    <div class="section">
                        <h2>📊 Your Account Details</h2>
                        <ul>
                            <li><strong>Tier:</strong> {tier.title()}</li>
                            <li><strong>Trial Period:</strong> 30 days (ends {(datetime.now() + timedelta(days=30)).strftime('%B %d, %Y')})</li>
                            <li><strong>Portal:</strong> <a href="{portal_url}">{portal_url}</a></li>
                            <li><strong>Documentation:</strong> <a href="https://docs.securebase.io">docs.securebase.io</a></li>
                        </ul>
                    </div>
                    
                    <div class="section">
                        <h2>💬 Need Help?</h2>
                        <p>Our team is here to support you:</p>
                        <ul>
                            <li>📧 Email: support@securebase.io</li>
                            <li>📚 Documentation: docs.securebase.io</li>
                            <li>💬 Live Chat: Available in the portal</li>
                        </ul>
                    </div>
                    
                    <p>Welcome aboard! 🚀</p>
                    <p>The SecureBase Team</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        Welcome to SecureBase!
        
        Hello {name},
        
        Your {tier.title()} tier account has been created!
        
        API Key: {api_key}
        ⚠️ Store this securely - you won't see it again!
        
        Portal: {portal_url}/login
        
        What's Next:
        - Set up your password (check your email)
        - Configure MFA
        - Review compliance dashboard
        - Add team members
        
        Need help? Email support@securebase.io
        
        The SecureBase Team
        """
        
        # Send via SES
        sender = os.environ.get('SES_SENDER_EMAIL', 'noreply@securebase.io')
        
        ses.send_email(
            Source=sender,
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': subject},
                'Body': {
                    'Text': {'Data': text_body},
                    'Html': {'Data': html_body}
                }
            }
        )
        
        print(f"Welcome email sent to {email}")
        
        # Also send SNS notification for monitoring
        sns_topic = os.environ.get('SNS_TOPIC_ARN')
        if sns_topic:
            sns.publish(
                TopicArn=sns_topic,
                Subject=f"New Customer Onboarded: {name}",
                Message=f"Customer {name} ({email}) signed up for {tier} tier.\nCustomer ID: {customer_id}"
            )
        
    except Exception as e:
        print(f"Error sending welcome email: {e}")
        # Don't fail onboarding if email fails
        pass


def send_password_setup_email(email, name, temp_password):
    """Send password setup email"""
    try:
        portal_url = os.environ.get('PORTAL_URL', 'https://portal.securebase.io')
        sender = os.environ.get('SES_SENDER_EMAIL', 'noreply@securebase.io')
        
        subject = "Set Up Your SecureBase Password"
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2>Set Up Your Password</h2>
            <p>Hello {name},</p>
            <p>Your SecureBase account has been created. Use this temporary password to log in:</p>
            <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #667eea; 
                       font-family: monospace; font-size: 16px;">
                {temp_password}
            </div>
            <p><strong>You'll be prompted to change this password on your first login.</strong></p>
            <p><a href="{portal_url}/login" 
                  style="display: inline-block; background: #667eea; color: white; 
                         padding: 12px 30px; text-decoration: none; border-radius: 5px; 
                         margin: 20px 0;">
                Log In Now
            </a></p>
            <p>This temporary password expires in 24 hours.</p>
        </body>
        </html>
        """
        
        text_body = f"""
        Hello {name},
        
        Your SecureBase account has been created.
        
        Temporary Password: {temp_password}
        
        Log in at: {portal_url}/login
        
        You'll be prompted to change this password on first login.
        This temporary password expires in 24 hours.
        """
        
        ses.send_email(
            Source=sender,
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': subject},
                'Body': {
                    'Text': {'Data': text_body},
                    'Html': {'Data': html_body}
                }
            }
        )
        
        print(f"Password setup email sent to {email}")
        
    except Exception as e:
        print(f"Error sending password setup email: {e}")


def log_onboarding_event(customer_id, email, event_type):
    """Log onboarding completion to audit table"""
    conn = get_db_connection()
    
    try:
        sql = """
            INSERT INTO audit_events (
                customer_id, event_type, action,
                actor_email, status, metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        metadata = json.dumps({
            'onboarding_timestamp': datetime.now().isoformat(),
            'triggered_by': 'stripe_webhook'
        })
        
        execute_update(
            conn,
            sql,
            (customer_id, event_type, 'customer_onboarded', email, 'success', metadata)
        )
        
        print(f"Audit event logged: {event_type}")
        
    except Exception as e:
        print(f"Error logging audit event: {e}")
    finally:
        conn.close()


def trigger_infrastructure_provisioning(customer_id, tier, name, email):
    """
    Trigger infrastructure provisioning via onboarding script
    This runs asynchronously and updates the customer record when complete
    """
    
    try:
        # For now, we'll invoke the onboarding script via SNS
        # In production, this could trigger Step Functions or ECS tasks
        
        sns_topic = os.environ.get('ONBOARDING_TOPIC_ARN')
        if not sns_topic:
            print("No onboarding topic configured - skipping infrastructure provisioning")
            return
        
        message = {
            'customer_id': customer_id,
            'tier': tier,
            'name': name,
            'email': email,
            'framework': get_framework_for_tier(tier),
            'action': 'provision_infrastructure'
        }
        
        sns.publish(
            TopicArn=sns_topic,
            Subject=f"Provision Infrastructure: {name}",
            Message=json.dumps(message)
        )
        
        print(f"Infrastructure provisioning triggered for {customer_id}")
        
    except Exception as e:
        print(f"Error triggering infrastructure provisioning: {e}")


def get_framework_for_tier(tier):
    """Map tier to default compliance framework"""
    mapping = {
        'standard': 'cis',
        'fintech': 'soc2',
        'healthcare': 'hipaa',
        'government': 'fedramp'
    }
    return mapping.get(tier, 'cis')


if __name__ == "__main__":
    # Local testing
    test_event = {
        'customer_id': str(uuid.uuid4()),
        'tier': 'healthcare',
        'email': 'test@example.com',
        'name': 'Test Hospital'
    }
    
    response = lambda_handler(test_event, {})
    print(json.dumps(json.loads(response['body']), indent=2))
