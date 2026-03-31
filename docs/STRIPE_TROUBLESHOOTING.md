# Stripe Integration Troubleshooting Guide

## Problem: Users Reaching /signup but Stripe Connection Failing

This guide addresses issues where users can access the signup page but encounter errors when trying to complete the payment flow.

---

## Root Causes & Solutions

### 1. Missing Stripe Public Key (Frontend)

**Symptom**: Users see error "checkout_url is undefined" or generic error messages

**Root Cause**: `VITE_STRIPE_PUBLIC_KEY` environment variable not set

**Solution**:

#### For Development:
```bash
# In phase3a-portal/.env or root .env
VITE_STRIPE_PUBLIC_KEY=pk_test_51ABC...XYZ
```

#### For Production:
```bash
# In phase3a-portal/.env.production
VITE_STRIPE_PUBLIC_KEY=pk_live_51ABC...XYZ
```

**How to get your key**:
1. Go to https://dashboard.stripe.com/apikeys
2. Copy the "Publishable key" (starts with `pk_test_` or `pk_live_`)
3. Add to your `.env` file
4. Restart your dev server or rebuild for production

---

### 2. Missing Stripe Secret Key (Backend)

**Symptom**: Backend returns 503 error "Payment system is currently unavailable"

**Root Cause**: `STRIPE_SECRET_KEY` not set in Lambda environment variables

**Solution**:

Set the environment variable in your Lambda function:

```bash
# Via AWS Console:
# Lambda > Functions > securebase-dev-checkout > Configuration > Environment variables

STRIPE_SECRET_KEY=sk_test_51ABC...XYZ  # or sk_live_... for production
```

**Via Terraform**:
```hcl
# landing-zone/modules/lambda-functions/main.tf
resource "aws_lambda_function" "checkout" {
  environment {
    variables = {
      STRIPE_SECRET_KEY = var.stripe_secret_key  # Pass from terraform.tfvars
      # ... other vars
    }
  }
}
```

---

### 3. Missing Stripe Price IDs

**Symptom**: Backend returns "The [tier] tier is temporarily unavailable"

**Root Cause**: Price IDs not configured for one or more tiers

**Required Environment Variables** (Backend Lambda):
```bash
STRIPE_PRICE_STANDARD=price_1ABC...XYZ
STRIPE_PRICE_FINTECH=price_1DEF...XYZ
STRIPE_PRICE_HEALTHCARE=price_1GHI...XYZ
STRIPE_PRICE_GOVERNMENT=price_1JKL...XYZ
```

**How to get price IDs**:
1. Go to https://dashboard.stripe.com/products
2. Create a product for each tier (or use existing)
3. Add a recurring price (monthly subscription)
4. Copy the Price ID (starts with `price_`)
5. Set in Lambda environment variables

**Pricing Reference**:
- Standard: $20/month
- Fintech: $80/month
- Healthcare: $150/month
- Government: $250/month

---

### 4. Missing Pilot Coupon (Optional)

**Symptom**: Pilot program discount not applied even when checkbox is checked

**Root Cause**: `STRIPE_PILOT_COUPON` not set in Lambda environment

**Solution**:

1. Create a coupon in Stripe Dashboard:
   - Go to https://dashboard.stripe.com/coupons
   - Create coupon: 50% off, 6 months duration
   - Copy the Coupon ID (e.g., `50OFF6MO`)

2. Set in Lambda:
```bash
STRIPE_PILOT_COUPON=50OFF6MO
```

---

### 5. Missing Portal URL

**Symptom**: Stripe checkout succeeds but redirect URLs are broken

**Root Cause**: `PORTAL_URL` not set in Lambda environment

**Solution**:
```bash
PORTAL_URL=https://portal.securebase.com  # Your actual portal URL
```

This is used for:
- Success redirect: `{PORTAL_URL}/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel redirect: `{PORTAL_URL}/signup?cancelled=true`

---

## Quick Verification Checklist

### Frontend Configuration
- [ ] `VITE_STRIPE_PUBLIC_KEY` set in `.env`
- [ ] `VITE_STRIPE_PUBLIC_KEY` set in `.env.production`
- [ ] Key starts with `pk_test_` (dev) or `pk_live_` (prod)
- [ ] Dev server restarted after adding key
- [ ] Production build regenerated after adding key

### Backend Configuration (Lambda)
- [ ] `STRIPE_SECRET_KEY` set
- [ ] `STRIPE_PRICE_STANDARD` set
- [ ] `STRIPE_PRICE_FINTECH` set
- [ ] `STRIPE_PRICE_HEALTHCARE` set
- [ ] `STRIPE_PRICE_GOVERNMENT` set
- [ ] `STRIPE_PILOT_COUPON` set (optional)
- [ ] `PORTAL_URL` set
- [ ] Lambda function redeployed after setting env vars

### Stripe Dashboard
- [ ] API keys are from the correct mode (test vs live)
- [ ] API keys are not restricted (or restrictions allow Checkout Sessions)
- [ ] Products and prices are created
- [ ] Prices are set to "recurring" mode
- [ ] Coupon created (if using pilot program)

---

## Testing the Fix

### 1. Test Frontend Configuration

```bash
cd phase3a-portal
npm run dev

# Open browser console (F12)
# Navigate to /signup
# Look for any errors about VITE_STRIPE_PUBLIC_KEY
```

If configured correctly, you should NOT see:
- ❌ "VITE_STRIPE_PUBLIC_KEY not configured!"

### 2. Test Backend Configuration

```bash
# Make a test API call
curl -X POST https://your-api-gateway.com/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "standard",
    "email": "test@example.com",
    "name": "Test Company",
    "use_pilot_coupon": false
  }'

# Should return:
# {
#   "checkout_url": "https://checkout.stripe.com/c/pay/...",
#   "session_id": "cs_test_..."
# }
```

### 3. Check Lambda Logs

```bash
# Via AWS Console:
# CloudWatch > Log Groups > /aws/lambda/securebase-dev-checkout > Latest stream

# Look for errors:
# ❌ "CRITICAL: STRIPE_SECRET_KEY environment variable not set!"
# ❌ "WARNING: Missing Stripe price IDs for tiers: ..."
# ❌ "ERROR: Price ID not configured for tier: standard"
```

---

## Common Error Messages & Meanings

| Error Message | Cause | Fix |
|---------------|-------|-----|
| "Payment system is currently unavailable" | `STRIPE_SECRET_KEY` not set | Set Lambda env var |
| "The [tier] tier is temporarily unavailable" | Price ID missing for that tier | Set `STRIPE_PRICE_{TIER}` |
| "Payment provider configuration error" | Invalid Stripe API key | Check key in Stripe Dashboard |
| "Payment provider temporarily unavailable" | Network issue or Stripe is down | Retry after a few minutes |
| "Rate limit exceeded" | Too many requests | Wait 1 hour or implement backoff |
| "This email was recently used" | Email rate limiting (30 days) | Use different email or wait |

---

## Monitoring & Logging

### CloudWatch Metrics to Monitor

1. **Lambda Errors**:
   - Metric: `Errors`
   - Threshold: > 0
   - Alert: Send SNS notification

2. **Lambda Duration**:
   - Metric: `Duration`
   - Threshold: > 5000ms (5 seconds)
   - Alert: Performance degradation

3. **API Gateway 5XX Errors**:
   - Metric: `5XXError`
   - Threshold: > 1% of requests
   - Alert: Backend issues

### Lambda Logs to Monitor

Set up CloudWatch Insights queries:

```sql
-- Find all Stripe configuration errors
fields @timestamp, @message
| filter @message like /CRITICAL|WARNING|ERROR/
| filter @message like /STRIPE/
| sort @timestamp desc
| limit 100
```

```sql
-- Find all failed checkout attempts
fields @timestamp, @message
| filter @message like /error/
| filter @message like /checkout/
| stats count() by bin(5m)
```

---

## Production Deployment Checklist

Before enabling signup in production:

- [ ] All Stripe keys switched from test mode to live mode
- [ ] Price IDs pointing to live products (not test)
- [ ] Webhook endpoints configured in Stripe Dashboard
- [ ] Webhook secret (`STRIPE_WEBHOOK_SECRET`) set in Lambda
- [ ] Test at least one successful signup end-to-end
- [ ] Verify customer record created in database
- [ ] Verify email notifications sent
- [ ] Verify Stripe Dashboard shows new subscription
- [ ] CloudWatch alarms configured
- [ ] Rate limiting tested (5 signups/hour per IP)
- [ ] Email rate limiting tested (30-day window)

---

## Advanced Troubleshooting

### Check Stripe Dashboard for Failed Payments

1. Go to https://dashboard.stripe.com/payments
2. Look for failed Checkout Sessions
3. Click on a session to see detailed error
4. Common issues:
   - Card declined
   - Insufficient funds
   - Card number incorrect
   - Expired card

### Check Database for Customer Records

```sql
-- Connect to Aurora PostgreSQL
SELECT id, email, stripe_customer_id, subscription_status, created_at
FROM customers
WHERE email = 'test@example.com'
ORDER BY created_at DESC;
```

### Check DynamoDB for Rate Limiting

```bash
# Via AWS Console:
# DynamoDB > Tables > securebase-dev-rate-limits > Items

# Look for entries with:
# - pk = "IP#xxx.xxx.xxx.xxx"
# - ttl = future timestamp
# - request_count >= 5
```

### Enable Debug Logging

Temporarily add verbose logging to Lambda:

```python
# At top of create_checkout_session.py
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

# Add debug statements
logger.debug(f"STRIPE_SECRET_KEY set: {bool(stripe.api_key)}")
logger.debug(f"Price IDs: {PRICE_IDS}")
logger.debug(f"Request body: {body}")
```

---

## Support & Resources

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Stripe Docs**: https://stripe.com/docs/api
- **Stripe Status**: https://status.stripe.com
- **AWS Lambda Logs**: CloudWatch > Log Groups > /aws/lambda/securebase-dev-checkout
- **SecureBase Support**: support@tximhotep.com

---

## Environment Variables Reference Card

### Frontend (phase3a-portal)

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `VITE_STRIPE_PUBLIC_KEY` | ✅ Yes | `pk_test_...` | Stripe publishable key for checkout |
| `VITE_API_BASE_URL` | ✅ Yes | `https://api...` | Backend API endpoint |
| `VITE_PILOT_PROGRAM_ENABLED` | ⚠️ Optional | `true` | Enable pilot discount checkbox |

### Backend (Lambda Functions)

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `STRIPE_SECRET_KEY` | ✅ Yes | `sk_test_...` | Stripe secret key for API calls |
| `STRIPE_PRICE_STANDARD` | ✅ Yes | `price_1ABC...` | Standard tier price ID |
| `STRIPE_PRICE_FINTECH` | ✅ Yes | `price_1DEF...` | Fintech tier price ID |
| `STRIPE_PRICE_HEALTHCARE` | ✅ Yes | `price_1GHI...` | Healthcare tier price ID |
| `STRIPE_PRICE_GOVERNMENT` | ✅ Yes | `price_1JKL...` | Government tier price ID |
| `STRIPE_PILOT_COUPON` | ⚠️ Optional | `50OFF6MO` | Coupon ID for 50% off 6 months |
| `STRIPE_WEBHOOK_SECRET` | ✅ Yes | `whsec_...` | Webhook signature verification |
| `PORTAL_URL` | ✅ Yes | `https://portal...` | Redirect URL after checkout |
| `RATE_LIMIT_TABLE` | ✅ Yes | `securebase-dev-rate-limits` | DynamoDB table for rate limiting |

---

## Quick Fix Script

Run this script to check your configuration:

```bash
#!/bin/bash
# stripe-config-check.sh

echo "=== Frontend Configuration ==="
cd phase3a-portal
if grep -q "VITE_STRIPE_PUBLIC_KEY=pk_" .env; then
  echo "✅ .env has VITE_STRIPE_PUBLIC_KEY"
else
  echo "❌ .env missing VITE_STRIPE_PUBLIC_KEY"
fi

if grep -q "VITE_STRIPE_PUBLIC_KEY=pk_" .env.production; then
  echo "✅ .env.production has VITE_STRIPE_PUBLIC_KEY"
else
  echo "❌ .env.production missing VITE_STRIPE_PUBLIC_KEY"
fi

echo ""
echo "=== Backend Configuration ==="
echo "Run this AWS CLI command to check Lambda env vars:"
echo "aws lambda get-function-configuration --function-name securebase-dev-checkout --query 'Environment.Variables' --output json"
```

Make executable and run:
```bash
chmod +x stripe-config-check.sh
./stripe-config-check.sh
```

---

**Last Updated**: 2026-03-31  
**Version**: 1.0
