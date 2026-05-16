"""
Trigger Onboarding Automation for SecureBase
Orchestrates customer provisioning after successful payment
"""

import json
import os
import boto3
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from db_utils import (
    get_db_connection,
    execute_query,
    execute_update
)

# Initialize AWS clients
sns = boto3.client('sns')
ses = boto3.client('ses', region_name=os.environ.get('AWS_SES_REGION', 'us-east-1'))
lambda_client = boto3.client('lambda')
ddb = boto3.resource('dynamodb')

_TOKENS_TABLE = os.environ.get('TOKENS_TABLE', 'securebase-tokens')
_PORTAL_URL   = os.environ.get('APP_URL', 'https://portal.securebase.tximhotep.com')
_FROM_EMAIL   = os.environ.get('FROM_EMAIL', 'onboarding@tximhotep.com')


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
        body = json.loads(event.get('body', '{}')) if isinstance(event.get('body'), str) else event
        customer_id = body.get('customer_id')
        tier        = body.get('tier', 'standard')
        email       = body.get('email')
        name        = body.get('name')

        if not customer_id or not email:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'customer_id and email required'})
            }

        print(f"Starting onboarding for customer {customer_id} ({name})")

        # Step 1: Generate API key
        api_key = generate_api_key(customer_id, email)

        # Step 2: Create initial admin user record (no temp password — invite-token flow)
        user_id = create_admin_user(customer_id, email, name)

        # Step 3: Write invite token to DynamoDB and send invite-link email
        invite_token = write_invite_token(email, tier)
        send_invite_email(email, name, tier, invite_token)

        # Step 4: Send welcome/API-key email
        send_welcome_email(customer_id, email, name, tier, api_key)

        # Step 5: Create audit event
        log_onboarding_event(customer_id, email, 'onboarding_completed')

        # Step 6: Trigger infrastructure provisioning (async)
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


# ── New: invite token ─────────────────────────────────────────────────────────

def write_invite_token(email: str, tier: str) -> str:
    """
    Generate a secure invite token, write it to securebase-tokens,
    and return the token string.
    """
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    pilot_ends = (datetime.now(timezone.utc) + timedelta(days=180)).date().isoformat()

    tier_map = {
        'standard':   ('standard',          ''),
        'fintech':    ('fintech',            ''),
        'healthcare': ('healthcare',         'healthcare_pilot'),
        'government': ('government',         'government_pilot'),
    }
    plan, pilot_tier = tier_map.get(tier, (tier, ''))

    table = ddb.Table(_TOKENS_TABLE)
    table.put_item(Item={
        'token':      token,
        'email':      email,
        'type':       'invite',
        'status':     'active',
        'plan':       plan,
        'pilot_tier': pilot_tier,
        'pilot_ends': pilot_ends,
        'created_at': datetime.now(timezone.utc).date().isoformat(),
        'expires_at': expires_at,
    })

    print(f"Invite token written for {email}")
    return token


def send_invite_email(email: str, name: str, tier: str, token: str) -> None:
    """Send the portal activation email with the invite link."""
    invite_url = f"{_PORTAL_URL}/accept-invite?token={token}"

    subject = "Activate your SecureBase account"

    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background: #0066CC; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">SecureBase</h1>
        <p style="color: #cce0ff; margin: 8px 0 0;">Your {tier.title()} portal is ready</p>
      </div>
      <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 8px 8px;">
        <p>Hi {name},</p>
        <p>Your SecureBase account has been provisioned. Click the button below to set your
        password and access your dashboard.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{invite_url}"
             style="background: #0066CC; color: white; padding: 14px 32px;
                    text-decoration: none; border-radius: 6px; font-size: 16px;">
            Activate my account
          </a>
        </div>
        <p style="color: #666; font-size: 13px;">
          This link is valid for 30 days. If you did not request this account,
          you can safely ignore this email.
        </p>
        <p style="color: #666; font-size: 13px;">Or copy this URL into your browser:<br>
          <a href="{invite_url}" style="color: #0066CC;">{invite_url}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          SecureBase by TxImhotep LLC &mdash; {_PORTAL_URL}
        </p>
      </div>
    </body>
    </html>
    """

    text_body = f"""Hi {name},

Your SecureBase {tier.title()} account is ready.

Activate your account here:
{invite_url}

This link is valid for 30 days.

SecureBase by TxImhotep LLC
"""

    try:
        ses.send_email(
            Source=_FROM_EMAIL,
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': subject},
                'Body': {
                    'Text': {'Data': text_body},
                    'Html': {'Data': html_body},
                },
            }
        )
        print(f"Invite email sent to {email}")
    except Exception as e:
        print(f"Error sending invite email to {email}: {e}")
        # Don't fail onboarding if email fails — token is already in DynamoDB


# ── Existing functions (unchanged) ────────────────────────────────────────────

def generate_api_key(customer_id, email):
    """Generate and store API key for customer"""
    conn = get_db_connection()

    try:
        import hashlib
        key_prefix = "sk_live"
        key_secret = uuid.uuid4().hex + uuid.uuid4().hex
        full_key   = f"{key_prefix}_{key_secret}"
        key_hash   = hashlib.sha256(full_key.encode()).hexdigest()

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
            conn, sql,
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
    """Create initial admin user record — no password set (invite-token flow handles it)."""
    conn = get_db_connection()

    try:
        sql_check = "SELECT id FROM users WHERE email = %s AND customer_id = %s"
        existing  = execute_query(conn, sql_check, (email, customer_id))

        if existing:
            print(f"User already exists: {email}")
            return existing[0][0]

        sql_insert = """
            INSERT INTO users (
                id, customer_id, email, name,
                role, status, must_change_password, email_verified
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """

        user_id = str(uuid.uuid4())
        result  = execute_update(
            conn, sql_insert,
            (user_id, customer_id, email, name, 'admin', 'active', True, False)
        )

        if result:
            print(f"Admin user record created: {email}")
            return user_id
        else:
            raise Exception("Failed to create admin user")

    except Exception as e:
        print(f"Error creating admin user: {e}")
        raise
    finally:
        conn.close()


def send_welcome_email(customer_id, email, name, tier, api_key):
    """Send welcome email with API key and account details."""
    try:
        subject = f"Welcome to SecureBase — your {tier.title()} account details"

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: #0066CC; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to SecureBase</h1>
          </div>
          <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 8px 8px;">
            <p>Hi {name},</p>
            <p>Your <strong>{tier.title()}</strong> account is active. Here are your API credentials:</p>
            <div style="background: white; padding: 16px; border-left: 4px solid #0066CC;
                        font-family: monospace; word-break: break-all; margin: 16px 0;">
              {api_key}
            </div>
            <p style="color: #c00; font-size: 13px;">
              ⚠️ Store this key securely — it will not be shown again.
            </p>
            <p>Trial period: 30 days (ends {(datetime.now() + timedelta(days=30)).strftime('%B %d, %Y')})</p>
            <p>Questions? Reply to this email or contact sales@securebase.tximhotep.com</p>
            <p>The SecureBase Team</p>
          </div>
        </body>
        </html>
        """

        text_body = f"""Welcome to SecureBase, {name}!

Your {tier.title()} account is active.

API Key: {api_key}
Store this securely — it will not be shown again.

Trial ends: {(datetime.now() + timedelta(days=30)).strftime('%B %d, %Y')}

Questions? sales@securebase.tximhotep.com
"""

        ses.send_email(
            Source=_FROM_EMAIL,
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': subject},
                'Body': {
                    'Text': {'Data': text_body},
                    'Html': {'Data': html_body},
                },
            }
        )
        print(f"Welcome email sent to {email}")

        sns_topic = os.environ.get('SNS_TOPIC_ARN')
        if sns_topic:
            sns.publish(
                TopicArn=sns_topic,
                Subject=f"New Customer Onboarded: {name}",
                Message=f"Customer {name} ({email}) signed up for {tier} tier.\nCustomer ID: {customer_id}"
            )

    except Exception as e:
        print(f"Error sending welcome email: {e}")


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
            conn, sql,
            (customer_id, event_type, 'customer_onboarded', email, 'success', metadata)
        )

        print(f"Audit event logged: {event_type}")

    except Exception as e:
        print(f"Error logging audit event: {e}")
    finally:
        conn.close()


def trigger_infrastructure_provisioning(customer_id, tier, name, email):
    """Trigger infrastructure provisioning via SNS (async)."""
    try:
        sns_topic = os.environ.get('ONBOARDING_TOPIC_ARN')
        if not sns_topic:
            print("No onboarding topic configured — skipping infrastructure provisioning")
            return

        message = {
            'customer_id': customer_id,
            'tier':        tier,
            'name':        name,
            'email':       email,
            'framework':   get_framework_for_tier(tier),
            'action':      'provision_infrastructure'
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
    mapping = {
        'standard':   'cis',
        'fintech':    'soc2',
        'healthcare': 'hipaa',
        'government': 'fedramp'
    }
    return mapping.get(tier, 'cis')


if __name__ == "__main__":
    test_event = {
        'customer_id': str(uuid.uuid4()),
        'tier': 'healthcare',
        'email': 'test@example.com',
        'name': 'Test Hospital'
    }
    response = lambda_handler(test_event, {})
    print(json.dumps(json.loads(response['body']), indent=2))
