"""
Trigger Onboarding Automation for SecureBase
Orchestrates customer provisioning after successful payment.

Critical path (must succeed):
  1. write_invite_token()  — DynamoDB, no DB dependency
  2. send_invite_email()   — SES

Best-effort (logged but non-fatal):
  3. generate_api_key()    — Aurora via db_utils
  4. create_admin_user()   — Aurora via db_utils
  5. send_welcome_email()  — SES
  6. log_onboarding_event() — Aurora via db_utils
  7. trigger_infrastructure_provisioning() — SNS
"""

import json
import os
import boto3
import uuid
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

# db_utils is bundled in the Lambda layer (/opt/python) or the zip
try:
    from db_utils import get_connection, query_many, execute_one
    _DB_AVAILABLE = True
except ImportError:
    _DB_AVAILABLE = False

# AWS clients
sns           = boto3.client('sns')
ses           = boto3.client('ses', region_name=os.environ.get('AWS_SES_REGION', 'us-east-1'))
lambda_client = boto3.client('lambda')
ddb           = boto3.resource('dynamodb')

_TOKENS_TABLE = os.environ.get('TOKENS_TABLE', 'securebase-tokens')
_PORTAL_URL   = os.environ.get('APP_URL', 'https://portal.securebase.tximhotep.com')
_FROM_EMAIL   = os.environ.get('FROM_EMAIL', 'onboarding@tximhotep.com')


# ── Main handler ──────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    try:
        body        = json.loads(event.get('body', '{}')) if isinstance(event.get('body'), str) else event
        customer_id = body.get('customer_id')
        tier        = body.get('tier', 'standard')
        email       = body.get('email')
        name        = body.get('name', email)

        if not customer_id or not email:
            return {'statusCode': 400, 'body': json.dumps({'error': 'customer_id and email required'})}

        print(f"Starting onboarding for customer {customer_id} ({name})")

        # ── Critical path: invite token + email ───────────────────────────
        invite_token = write_invite_token(email, tier)
        send_invite_email(email, name, tier, invite_token)

        # ── Best-effort: Aurora DB steps ──────────────────────────────────
        api_key = None
        user_id = None

        if _DB_AVAILABLE:
            try:
                api_key = generate_api_key(customer_id, email)
            except Exception as e:
                print(f"[non-fatal] generate_api_key failed: {e}")

            try:
                user_id = create_admin_user(customer_id, email, name)
            except Exception as e:
                print(f"[non-fatal] create_admin_user failed: {e}")

            try:
                log_onboarding_event(customer_id, email, 'onboarding_completed')
            except Exception as e:
                print(f"[non-fatal] log_onboarding_event failed: {e}")
        else:
            print("[non-fatal] db_utils not available — skipping Aurora steps")

        # ── Best-effort: welcome email with API key ───────────────────────
        if api_key:
            try:
                send_welcome_email(customer_id, email, name, tier, api_key)
            except Exception as e:
                print(f"[non-fatal] send_welcome_email failed: {e}")

        # ── Best-effort: infra provisioning ──────────────────────────────
        try:
            trigger_infrastructure_provisioning(customer_id, tier, name, email)
        except Exception as e:
            print(f"[non-fatal] trigger_infrastructure_provisioning failed: {e}")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success':     True,
                'customer_id': customer_id,
                'user_id':     user_id,
                'message':     'Onboarding initiated successfully'
            })
        }

    except Exception as e:
        print(f"Fatal error in onboarding: {e}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}


# ── Invite token (DynamoDB — no Aurora dependency) ────────────────────────────

def write_invite_token(email: str, tier: str) -> str:
    token      = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    pilot_ends = (datetime.now(timezone.utc) + timedelta(days=180)).date().isoformat()

    tier_map = {
        'standard':   ('standard',   ''),
        'fintech':    ('fintech',     ''),
        'healthcare': ('healthcare',  'healthcare_pilot'),
        'government': ('government',  'government_pilot'),
    }
    plan, pilot_tier = tier_map.get(tier, (tier, ''))

    ddb.Table(_TOKENS_TABLE).put_item(Item={
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
    invite_url = f"{_PORTAL_URL}/accept-invite?token={token}"
    subject    = "Activate your SecureBase account"

    html_body = f"""<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;">
  <div style="background:#0066CC;padding:32px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;">SecureBase</h1>
    <p style="color:#cce0ff;margin:8px 0 0;">Your {tier.title()} portal is ready</p>
  </div>
  <div style="background:#f9f9f9;padding:32px;border-radius:0 0 8px 8px;">
    <p>Hi {name},</p>
    <p>Your SecureBase account has been provisioned. Click the button below to set your
    password and access your dashboard.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="{invite_url}"
         style="background:#0066CC;color:white;padding:14px 32px;
                text-decoration:none;border-radius:6px;font-size:16px;">
        Activate my account
      </a>
    </div>
    <p style="color:#666;font-size:13px;">
      This link is valid for 30 days. If you did not request this account,
      you can safely ignore this email.
    </p>
    <p style="color:#666;font-size:13px;">Or copy this URL:<br>
      <a href="{invite_url}" style="color:#0066CC;">{invite_url}</a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;">
    <p style="color:#999;font-size:12px;margin:0;">
      SecureBase by TxImhotep LLC &mdash; {_PORTAL_URL}
    </p>
  </div>
</body>
</html>"""

    text_body = f"""Hi {name},

Your SecureBase {tier.title()} account is ready.

Activate your account:
{invite_url}

This link is valid for 30 days.

SecureBase by TxImhotep LLC
"""

    ses.send_email(
        Source=_FROM_EMAIL,
        Destination={'ToAddresses': [email]},
        Message={
            'Subject': {'Data': subject},
            'Body': {'Text': {'Data': text_body}, 'Html': {'Data': html_body}},
        }
    )
    print(f"Invite email sent to {email}")


# ── Aurora DB steps (best-effort) ─────────────────────────────────────────────

def generate_api_key(customer_id, email):
    key_secret = uuid.uuid4().hex + uuid.uuid4().hex
    full_key   = f"sk_live_{key_secret}"
    key_hash   = hashlib.sha256(full_key.encode()).hexdigest()
    scopes     = json.dumps(['read:invoices', 'read:metrics', 'read:compliance', 'write:support'])

    sql = """
        INSERT INTO api_keys (customer_id, key_hash, key_prefix, name, scopes, expires_at, status)
        VALUES (%s, %s, %s, %s, %s, NULL, 'active')
    """
    execute_one(sql, (customer_id, key_hash, 'sk_live', 'Default API Key', scopes))
    print(f"API key generated for customer {customer_id}")
    return full_key


def create_admin_user(customer_id, email, name):
    existing = query_many(
        "SELECT id FROM users WHERE email = %s AND customer_id = %s",
        (email, customer_id)
    )
    if existing:
        print(f"User already exists: {email}")
        return existing[0]['id']

    user_id = str(uuid.uuid4())
    execute_one(
        """
        INSERT INTO users (id, customer_id, email, name, role, status, must_change_password, email_verified)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (user_id, customer_id, email, name, 'admin', 'active', True, False)
    )
    print(f"Admin user record created: {email}")
    return user_id


def log_onboarding_event(customer_id, email, event_type):
    metadata = json.dumps({
        'onboarding_timestamp': datetime.now().isoformat(),
        'triggered_by': 'stripe_webhook'
    })
    execute_one(
        """
        INSERT INTO audit_events (customer_id, event_type, action, actor_email, status, metadata)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (customer_id, event_type, 'customer_onboarded', email, 'success', metadata)
    )
    print(f"Audit event logged: {event_type}")


def send_welcome_email(customer_id, email, name, tier, api_key):
    subject   = f"Welcome to SecureBase — your {tier.title()} account details"
    trial_end = (datetime.now() + timedelta(days=30)).strftime('%B %d, %Y')

    html_body = f"""<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;">
  <div style="background:#0066CC;padding:32px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;">Welcome to SecureBase</h1>
  </div>
  <div style="background:#f9f9f9;padding:32px;border-radius:0 0 8px 8px;">
    <p>Hi {name},</p>
    <p>Your <strong>{tier.title()}</strong> account is active. Here are your API credentials:</p>
    <div style="background:white;padding:16px;border-left:4px solid #0066CC;
                font-family:monospace;word-break:break-all;margin:16px 0;">{api_key}</div>
    <p style="color:#c00;font-size:13px;">⚠️ Store this key securely — it will not be shown again.</p>
    <p>Trial ends: {trial_end}</p>
    <p>Questions? sales@securebase.tximhotep.com</p>
    <p>The SecureBase Team</p>
  </div>
</body>
</html>"""

    text_body = f"""Welcome to SecureBase, {name}!

API Key: {api_key}
Store this securely — it will not be shown again.

Trial ends: {trial_end}
Questions? sales@securebase.tximhotep.com
"""

    ses.send_email(
        Source=_FROM_EMAIL,
        Destination={'ToAddresses': [email]},
        Message={
            'Subject': {'Data': subject},
            'Body': {'Text': {'Data': text_body}, 'Html': {'Data': html_body}},
        }
    )
    print(f"Welcome email sent to {email}")

    sns_topic = os.environ.get('SNS_TOPIC_ARN')
    if sns_topic:
        sns.publish(
            TopicArn=sns_topic,
            Subject=f"New Customer Onboarded: {name}",
            Message=f"Customer {name} ({email}) — {tier}\nCustomer ID: {customer_id}"
        )


def trigger_infrastructure_provisioning(customer_id, tier, name, email):
    sns_topic = os.environ.get('ONBOARDING_TOPIC_ARN')
    if not sns_topic:
        print("No onboarding topic configured — skipping infra provisioning")
        return

    sns.publish(
        TopicArn=sns_topic,
        Subject=f"Provision Infrastructure: {name}",
        Message=json.dumps({
            'customer_id': customer_id,
            'tier':        tier,
            'name':        name,
            'email':       email,
            'framework':   {'standard':'cis','fintech':'soc2','healthcare':'hipaa','government':'fedramp'}.get(tier,'cis'),
            'action':      'provision_infrastructure'
        })
    )
    print(f"Infra provisioning triggered for {customer_id}")


if __name__ == "__main__":
    response = lambda_handler({
        'customer_id': str(uuid.uuid4()),
        'tier': 'healthcare',
        'email': 'test@example.com',
        'name': 'Test Hospital'
    }, {})
    print(json.dumps(json.loads(response['body']), indent=2))
