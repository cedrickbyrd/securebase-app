# Pilot Customer Signup - Quick Reference

## 🚀 Quick Start

### Deploy Signup Workflow

```bash
# Deploy to dev environment
./deploy-signup-workflow.sh dev

# Deploy to staging
./deploy-signup-workflow.sh staging

# Deploy to production
./deploy-signup-workflow.sh prod
```

### Test Signup Flow

```bash
# Run all tests
python tests/integration/test_signup_flow.py
python tests/e2e/test_pilot_signup.py

# Test with Stripe test mode
curl -X POST https://api-dev.securebase.io/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "fintech",
    "email": "test@example.com",
    "name": "Test Company",
    "use_pilot_coupon": true
  }'
```

## 📋 Components Checklist

### Backend
- [x] `create_checkout_session.py` - Stripe checkout
- [x] `stripe_webhook.py` - Webhook handler
- [x] `trigger_onboarding.py` - Onboarding automation
- [x] Database schema updates
- [x] Rate limiting (DynamoDB)
- [x] Input validation
- [x] Audit logging

### Frontend
- [x] `Signup.jsx` - Signup form
- [x] `apiService.js` - API integration
- [x] Tier selection
- [x] Pilot discount toggle
- [x] Error handling
- [x] Loading states

### Automation
- [x] `onboard-customer.sh` - Infrastructure provisioning
- [x] API-triggered mode
- [x] Email templates
- [x] API key generation

### Testing
- [x] Integration tests
- [x] E2E tests
- [x] Input validation tests
- [x] Rate limiting tests

## 🔑 Required Environment Variables

### create_checkout_session
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

### stripe_webhook
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SNS_TOPIC_ARN=arn:aws:sns:...
ONBOARDING_FUNCTION_NAME=securebase-trigger-onboarding
```

### trigger_onboarding
```bash
SES_SENDER_EMAIL=noreply@securebase.io
SNS_TOPIC_ARN=arn:aws:sns:...
ONBOARDING_TOPIC_ARN=arn:aws:sns:...:infrastructure
PORTAL_URL=https://portal.securebase.io
```

## 🎯 API Endpoints

### POST /checkout
Create Stripe checkout session

**Request:**
```json
{
  "tier": "healthcare",
  "email": "admin@hospital.com",
  "name": "Hospital Corp",
  "use_pilot_coupon": true
}
```

**Response:**
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_..."
}
```

### POST /webhooks/stripe
Stripe webhook endpoint (internal)

**Events:**
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## 🔐 Security Features

- ✅ Rate limiting: 5 signups/hour/IP
- ✅ Email validation (RFC 5322)
- ✅ Disposable email blocking
- ✅ Duplicate customer prevention
- ✅ PCI compliance (Stripe handles cards)
- ✅ Webhook signature verification
- ✅ IP address hashing
- ✅ Audit trail logging

## 📊 Monitoring

### CloudWatch Logs
- `/aws/lambda/securebase-create-checkout-session`
- `/aws/lambda/securebase-stripe-webhook`
- `/aws/lambda/securebase-trigger-onboarding`

### Key Metrics
- SignupAttempts
- RateLimitExceeded
- ValidationErrors
- StripeErrors
- OnboardingSuccess

### Alarms
```bash
# View active alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix signup

# Check recent failures
aws logs tail /aws/lambda/securebase-create-checkout-session \
  --since 1h --filter-pattern "ERROR"
```

## 🐛 Troubleshooting

### Webhook not triggering
```bash
# Check Stripe webhook logs
stripe logs tail

# Verify webhook secret
aws secretsmanager get-secret-value \
  --secret-id securebase/prod/stripe \
  --query "SecretString" | jq -r .webhook_secret

# Test webhook locally
stripe trigger checkout.session.completed
```

### Email not sent
```bash
# Check SES sending limits
aws ses get-send-quota

# Verify sender identity
aws ses list-verified-email-addresses

# Check Lambda logs
aws logs tail /aws/lambda/securebase-trigger-onboarding --since 1h
```

### Rate limit issues
```bash
# Check DynamoDB table
aws dynamodb scan --table-name securebase-signup-rate-limits

# Clear rate limit for IP
aws dynamodb delete-item \
  --table-name securebase-signup-rate-limits \
  --key '{"ip_hash": {"S": "abc123..."}}'
```

## 📝 Common Tasks

### Replay failed webhook
1. Go to Stripe Dashboard
2. Developers → Webhooks
3. Find failed event
4. Click "Resend"

### Manual onboarding
```bash
./scripts/onboard-customer.sh \
  --name "Company Name" \
  --tier fintech \
  --framework soc2 \
  --email admin@company.com
```

### Check customer status
```sql
SELECT 
  name, email, tier, subscription_status, 
  trial_end_date, created_at
FROM customers
WHERE email = 'customer@example.com';
```

### Resend welcome email
```bash
# Invoke trigger_onboarding manually
aws lambda invoke \
  --function-name securebase-trigger-onboarding \
  --payload '{"customer_id": "...", "tier": "fintech", "email": "...", "name": "..."}' \
  response.json
```

## 🚨 Emergency Procedures

### Disable signup
```javascript
// In Signup.jsx
const SIGNUP_ENABLED = false;
```

### Rollback Lambda
```bash
aws lambda update-function-code \
  --function-name securebase-create-checkout-session \
  --s3-bucket securebase-lambda-artifacts \
  --s3-key previous-version.zip
```

### Pause webhooks
1. Stripe Dashboard → Webhooks
2. Click webhook endpoint
3. Click "..." → Disable

## 📚 Documentation

- Full Documentation: `docs/SIGNUP_WORKFLOW.md`
- API Reference: `API_REFERENCE.md`
- Database Schema: `phase2-backend/database/schema.sql`
- Migration Guide: `phase2-backend/database/migrations/`

## ✅ Success Criteria

- [ ] Customer completes signup in < 5 minutes
- [ ] Payment processed via Stripe (30-day trial)
- [ ] Customer record created in database
- [ ] API key generated and emailed
- [ ] Welcome email sent
- [ ] Customer can login to portal within 10 minutes
- [ ] Audit trail logged
- [ ] Infrastructure provisioning queued
