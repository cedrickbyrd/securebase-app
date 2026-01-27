# Pilot Customer Signup Workflow

## Overview

This document describes the end-to-end self-service customer signup workflow for SecureBase. The workflow enables customers to sign up, pay via Stripe, and have their AWS infrastructure automatically provisioned.

## Architecture

```
┌─────────────────┐
│  Customer       │
│  Browser        │
└────────┬────────┘
         │
         │ 1. Submit Signup Form
         ▼
┌─────────────────────────┐
│  Signup.jsx Component   │
│  (Phase 3a Portal)      │
└────────┬────────────────┘
         │
         │ 2. POST /checkout
         ▼
┌──────────────────────────────────┐
│  create_checkout_session.py      │
│  - Validate inputs               │
│  - Check rate limits             │
│  - Create Stripe session         │
└────────┬─────────────────────────┘
         │
         │ 3. Redirect to Stripe
         ▼
┌─────────────────────┐
│  Stripe Checkout    │
│  (30-day trial)     │
└────────┬────────────┘
         │
         │ 4. checkout.session.completed webhook
         ▼
┌──────────────────────────────────┐
│  stripe_webhook.py               │
│  - Verify signature              │
│  - Create customer record        │
│  - Invoke trigger_onboarding     │
└────────┬─────────────────────────┘
         │
         │ 5. Async Lambda Invocation
         ▼
┌──────────────────────────────────┐
│  trigger_onboarding.py           │
│  - Generate API key              │
│  - Create admin user             │
│  - Send welcome email            │
│  - Queue infrastructure          │
└────────┬─────────────────────────┘
         │
         │ 6. SNS → onboard-customer.sh
         ▼
┌──────────────────────────────────┐
│  Infrastructure Provisioning     │
│  - Terraform apply               │
│  - AWS Organizations setup       │
│  - IAM Identity Center           │
└──────────────────────────────────┘
```

## Components

### 1. Frontend (React)

**File**: `phase3a-portal/src/components/Signup.jsx`

Features:
- Tier selection (Standard, Fintech, Healthcare, Government)
- Pilot program discount toggle (50% off for 6 months)
- Form validation
- Loading states
- Error handling

**API Service**: `phase3a-portal/src/services/apiService.js`
- `createCheckoutSession()` - Initiates payment flow
- `verifySignup()` - Verifies successful signup

### 2. Backend Lambda Functions

#### create_checkout_session.py

**Purpose**: Create Stripe Checkout session

**Features**:
- Input validation (email, company name, tier)
- Disposable email blocking
- Rate limiting (5 signups/hour/IP)
- Duplicate customer detection
- Audit logging

**Environment Variables**:
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_STANDARD=price_...
STRIPE_PRICE_FINTECH=price_...
STRIPE_PRICE_HEALTHCARE=price_...
STRIPE_PRICE_GOVERNMENT=price_...
STRIPE_PILOT_COUPON=pilot50off
PORTAL_URL=https://portal.securebase.io
RATE_LIMIT_TABLE=securebase-signup-rate-limits
```

**API Endpoint**: `POST /checkout`

**Request**:
```json
{
  "tier": "healthcare",
  "email": "admin@hospital.com",
  "name": "Hospital Corp",
  "use_pilot_coupon": true
}
```

**Response**:
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_..."
}
```

#### stripe_webhook.py

**Purpose**: Process Stripe webhook events

**Events Handled**:
- `checkout.session.completed` - New customer signup
- `invoice.payment_succeeded` - Payment received
- `invoice.payment_failed` - Payment failed
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Cancellation

**Environment Variables**:
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
SNS_TOPIC_ARN=arn:aws:sns:...
ONBOARDING_FUNCTION_NAME=securebase-trigger-onboarding
```

**Webhook Configuration**:
```bash
# Configure in Stripe Dashboard
https://api.securebase.io/webhooks/stripe

# Events to subscribe:
- checkout.session.completed
- invoice.payment_succeeded
- invoice.payment_failed
- customer.subscription.updated
- customer.subscription.deleted
```

#### trigger_onboarding.py

**Purpose**: Orchestrate customer onboarding

**Actions**:
1. Generate API key (SHA-256 hashed, stored in database)
2. Create admin user with temporary password
3. Send welcome email with API key
4. Send password setup email
5. Log audit events
6. Trigger infrastructure provisioning via SNS

**Environment Variables**:
```bash
SES_SENDER_EMAIL=noreply@securebase.io
SNS_TOPIC_ARN=arn:aws:sns:...
ONBOARDING_TOPIC_ARN=arn:aws:sns:...:infrastructure-provisioning
PORTAL_URL=https://portal.securebase.io
```

### 3. Database Schema

**Schema Changes** (`phase2-backend/database/schema.sql`):

```sql
-- Customers table additions
ALTER TABLE customers 
ADD COLUMN stripe_subscription_id TEXT UNIQUE,
ADD COLUMN subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN trial_end_date TIMESTAMP;

-- Invoices table additions
ALTER TABLE invoices
ADD COLUMN stripe_invoice_id TEXT UNIQUE,
ADD COLUMN stripe_payment_intent_id TEXT;

-- Make AWS Org fields nullable (populated after provisioning)
ALTER TABLE customers 
ALTER COLUMN aws_org_id DROP NOT NULL,
ALTER COLUMN aws_management_account_id DROP NOT NULL;
```

**Migration**: `phase2-backend/database/migrations/001_add_stripe_fields.sql`

### 4. Automation Scripts

**File**: `scripts/onboard-customer.sh`

**New Flags**:
- `--api-triggered` - Skip interactive prompts
- `--customer-id <id>` - Use existing customer ID
- `--skip-terraform` - Database only (no infrastructure)

**Usage**:
```bash
# Manual onboarding
./onboard-customer.sh \
  --name "Hospital Corp" \
  --tier healthcare \
  --framework hipaa \
  --email admin@hospital.com

# API-triggered (from webhook)
./onboard-customer.sh \
  --name "Hospital Corp" \
  --tier healthcare \
  --framework hipaa \
  --email admin@hospital.com \
  --customer-id "abc-123" \
  --api-triggered \
  --skip-terraform
```

## Security Features

### 1. Rate Limiting

- **Limit**: 5 signups per IP address per hour
- **Storage**: DynamoDB table with TTL
- **Privacy**: IP addresses are hashed (SHA-256)
- **Behavior**: Returns 429 status when exceeded

### 2. Input Validation

- Email format validation (RFC 5322)
- Disposable email blocking (tempmail.com, etc.)
- Company name length (2-100 chars)
- Tier validation against allowed values
- Duplicate customer prevention

### 3. PCI Compliance

- **No card data storage** - Stripe handles all payment info
- Customer redirected to Stripe Checkout
- Only Stripe IDs stored in database
- Webhook signature verification

### 4. Audit Logging

All signup events logged to `audit_events` table:
- Checkout session creation
- Webhook processing
- Customer creation
- Onboarding completion
- Infrastructure provisioning

### 5. Idempotent Webhooks

- `client_reference_id` prevents duplicate charges
- Stripe webhook event IDs tracked
- Database constraints prevent duplicate customers

## Testing

### Integration Tests

**File**: `tests/integration/test_signup_flow.py`

Tests:
- Checkout session creation
- Invalid email handling
- Duplicate customer detection
- Webhook processing
- Onboarding trigger
- Input validation
- Rate limiting
- Audit logging

**Run**:
```bash
cd tests/integration
python test_signup_flow.py
```

### E2E Tests

**File**: `tests/e2e/test_pilot_signup.py`

Tests complete flow:
1. Checkout session creation
2. Webhook handling
3. Onboarding automation
4. Email delivery
5. API key generation
6. User creation

**Run**:
```bash
cd tests/e2e
python test_pilot_signup.py
```

## Deployment

### 1. Database Migration

```bash
cd phase2-backend/database
psql -h $RDS_HOST -U $RDS_USER -d securebase < migrations/001_add_stripe_fields.sql
```

### 2. Lambda Functions

```bash
# Package functions
cd phase2-backend/functions
zip -r create_checkout_session.zip create_checkout_session.py
zip -r stripe_webhook.zip stripe_webhook.py
zip -r trigger_onboarding.zip trigger_onboarding.py

# Deploy via AWS CLI
aws lambda update-function-code \
  --function-name securebase-create-checkout-session \
  --zip-file fileb://create_checkout_session.zip

aws lambda update-function-code \
  --function-name securebase-stripe-webhook \
  --zip-file fileb://stripe_webhook.zip

aws lambda update-function-code \
  --function-name securebase-trigger-onboarding \
  --zip-file fileb://trigger_onboarding.zip
```

### 3. DynamoDB Rate Limit Table

```bash
aws dynamodb create-table \
  --table-name securebase-signup-rate-limits \
  --attribute-definitions \
    AttributeName=ip_hash,AttributeType=S \
  --key-schema \
    AttributeName=ip_hash,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --time-to-live-specification \
    Enabled=true,AttributeName=ttl
```

### 4. Stripe Configuration

1. **Create Products & Prices**:
   ```bash
   # Standard tier
   stripe prices create \
     --unit-amount 200000 \
     --currency usd \
     --recurring[interval]=month \
     --product=prod_standard

   # Fintech tier
   stripe prices create \
     --unit-amount 800000 \
     --currency usd \
     --recurring[interval]=month \
     --product=prod_fintech

   # Healthcare tier
   stripe prices create \
     --unit-amount 1500000 \
     --currency usd \
     --recurring[interval]=month \
     --product=prod_healthcare

   # Government tier
   stripe prices create \
     --unit-amount 2500000 \
     --currency usd \
     --recurring[interval]=month \
     --product=prod_government
   ```

2. **Create Pilot Coupon**:
   ```bash
   stripe coupons create \
     --percent-off 50 \
     --duration repeating \
     --duration-in-months 6 \
     --id pilot50off \
     --name "Pilot Program - 50% off for 6 months"
   ```

3. **Configure Webhook**:
   ```bash
   stripe webhooks create \
     --url https://api.securebase.io/webhooks/stripe \
     --enabled-events checkout.session.completed \
     --enabled-events invoice.payment_succeeded \
     --enabled-events invoice.payment_failed \
     --enabled-events customer.subscription.updated \
     --enabled-events customer.subscription.deleted
   ```

### 5. Environment Variables

Update Lambda environment variables:

```bash
# create_checkout_session
aws lambda update-function-configuration \
  --function-name securebase-create-checkout-session \
  --environment Variables="{
    STRIPE_SECRET_KEY=sk_live_...,
    STRIPE_PRICE_STANDARD=price_...,
    STRIPE_PRICE_FINTECH=price_...,
    STRIPE_PRICE_HEALTHCARE=price_...,
    STRIPE_PRICE_GOVERNMENT=price_...,
    STRIPE_PILOT_COUPON=pilot50off,
    PORTAL_URL=https://portal.securebase.io,
    RATE_LIMIT_TABLE=securebase-signup-rate-limits
  }"

# stripe_webhook
aws lambda update-function-configuration \
  --function-name securebase-stripe-webhook \
  --environment Variables="{
    STRIPE_SECRET_KEY=sk_live_...,
    STRIPE_WEBHOOK_SECRET=whsec_...,
    SNS_TOPIC_ARN=arn:aws:sns:...,
    ONBOARDING_FUNCTION_NAME=securebase-trigger-onboarding
  }"

# trigger_onboarding
aws lambda update-function-configuration \
  --function-name securebase-trigger-onboarding \
  --environment Variables="{
    SES_SENDER_EMAIL=noreply@securebase.io,
    SNS_TOPIC_ARN=arn:aws:sns:...,
    ONBOARDING_TOPIC_ARN=arn:aws:sns:...:infrastructure,
    PORTAL_URL=https://portal.securebase.io
  }"
```

## Monitoring

### CloudWatch Metrics

- `SignupAttempts` - Total signup attempts
- `RateLimitExceeded` - Blocked by rate limit
- `ValidationErrors` - Failed validation
- `StripeErrors` - Payment provider errors
- `OnboardingSuccess` - Completed onboardings

### CloudWatch Logs

- `/aws/lambda/securebase-create-checkout-session`
- `/aws/lambda/securebase-stripe-webhook`
- `/aws/lambda/securebase-trigger-onboarding`

### Alarms

```bash
# Failed signups
aws cloudwatch put-metric-alarm \
  --alarm-name signup-failure-rate \
  --metric-name ValidationErrors \
  --namespace SecureBase/Signup \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold

# Webhook failures
aws cloudwatch put-metric-alarm \
  --alarm-name webhook-processing-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --dimensions Name=FunctionName,Value=securebase-stripe-webhook \
  --statistic Sum \
  --period 60 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

## Troubleshooting

### Webhook Not Triggering

1. Check Stripe webhook logs
2. Verify webhook secret matches
3. Check Lambda execution role permissions
4. Review CloudWatch logs

### Customer Not Created

1. Check database logs for constraint violations
2. Verify email uniqueness
3. Check RLS policies
4. Review webhook payload

### Email Not Sent

1. Verify SES sender identity
2. Check SES sending limits
3. Review IAM permissions
4. Check CloudWatch logs

### Rate Limit Issues

1. Check DynamoDB table exists
2. Verify TTL is enabled
3. Review Lambda IAM permissions for DynamoDB
4. Check IP hashing logic

## Rollback Plan

If issues arise:

1. **Disable signup component**:
   ```javascript
   // In Signup.jsx
   const SIGNUP_ENABLED = false;
   ```

2. **Revert Lambda functions**:
   ```bash
   aws lambda update-function-code \
     --function-name securebase-create-checkout-session \
     --s3-bucket securebase-lambda-artifacts \
     --s3-key previous-version.zip
   ```

3. **Replay failed webhooks**:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Find failed events
   - Click "Resend"

4. **Database rollback** (if needed):
   ```sql
   -- Rollback migration
   ALTER TABLE customers DROP COLUMN IF EXISTS stripe_subscription_id;
   ALTER TABLE customers DROP COLUMN IF EXISTS subscription_status;
   ALTER TABLE customers DROP COLUMN IF EXISTS trial_end_date;
   ```

## Success Metrics

### Functional Requirements ✅

- Customer can complete signup in < 5 minutes
- Payment processed via Stripe with 30-day trial
- Customer record created in Aurora database
- API key generated and emailed
- Welcome email sent with login credentials
- Customer can access dashboard within 10 minutes

### Non-Functional Requirements ✅

- Signup process handles errors gracefully
- Idempotent webhook processing
- Audit trail for all signup events
- Secure payment handling (PCI compliant)
- Rate limiting prevents abuse

## References

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Phase 2 Backend Documentation](../../phase2-backend/README.md)
- [Customer Portal Documentation](../../phase3a-portal/README.md)
