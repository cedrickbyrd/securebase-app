# Stripe Integration Quick Start

This guide provides quick links and commands for activating Stripe payment integration.

## 📋 Quick Links

- **Full Deployment Guide**: [STRIPE_DEPLOYMENT_CHECKLIST.md](./STRIPE_DEPLOYMENT_CHECKLIST.md)
- **Validation Workflow**: [.github/workflows/validate-stripe.yml](./.github/workflows/validate-stripe.yml)
- **Scripts Documentation**: [scripts/README.md](./scripts/README.md)

## 🚀 Quick Validation

### Validate Stripe Configuration (Local)

```bash
# Set your Stripe test key
export STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE

# Set price IDs (from Stripe dashboard)
export STRIPE_PRICE_HEALTHCARE=price_XXX
export STRIPE_PRICE_FINTECH=price_XXX
export STRIPE_PRICE_GOVERNMENT=price_XXX
export STRIPE_PRICE_STANDARD=price_XXX

# Run all validation checks
python scripts/validate-stripe.py --all
```

### Test Payment Flow (Local)

```bash
# Set API endpoint
export API_BASE_URL=https://your-api.execute-api.us-east-1.amazonaws.com/prod

# Set database connection
export DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Run end-to-end test
bash scripts/test-stripe-flow.sh
```

### Validate via GitHub Actions

1. Go to repository **Actions** tab
2. Select **Stripe Integration Validation** workflow
3. Click **Run workflow**
4. Select environment (test/production)
5. Click **Run workflow** button

## 📦 What Was Created

| File | Purpose | Lines |
|------|---------|-------|
| `STRIPE_DEPLOYMENT_CHECKLIST.md` | Complete deployment guide | 801 |
| `.github/workflows/validate-stripe.yml` | Automated validation workflow | 162 |
| `scripts/validate-stripe.py` | Python validation script | 265 |
| `scripts/test-stripe-flow.sh` | Bash test script | 267 |
| `scripts/README.md` | Scripts documentation | Updated |

## ⚡ Quick Commands Reference

### Stripe Product Creation

```bash
# Healthcare tier product
curl https://api.stripe.com/v1/products \
  -u "sk_test_YOUR_KEY:" \
  -d "name=SecureBase Healthcare" \
  -d "description=HIPAA-compliant AWS Landing Zone" \
  -d "metadata[tier]=healthcare"

# Create price (replace PRODUCT_ID)
curl https://api.stripe.com/v1/prices \
  -u "sk_test_YOUR_KEY:" \
  -d "product=PRODUCT_ID" \
  -d "currency=usd" \
  -d "unit_amount=1500000" \
  -d "recurring[interval]=month"
```

### AWS Secrets Manager

```bash
# Store Stripe secret key
aws secretsmanager create-secret \
  --name securebase/stripe/secret-key \
  --secret-string "sk_test_YOUR_KEY" \
  --region us-east-1

# Store webhook secret
aws secretsmanager create-secret \
  --name securebase/stripe/webhook-secret \
  --secret-string "whsec_YOUR_SECRET" \
  --region us-east-1
```

### Lambda Deployment

```bash
# Update checkout session Lambda
aws lambda update-function-code \
  --function-name securebase-create-checkout-session \
  --zip-file fileb://create_checkout_session.zip

# Update webhook Lambda
aws lambda update-function-code \
  --function-name securebase-stripe-webhook \
  --zip-file fileb://stripe_webhook.zip
```

## 🔍 Verification Checklist

Quick checklist to verify Stripe integration:

- [ ] Stripe test mode configured with products
- [ ] AWS Secrets Manager has Stripe keys
- [ ] Lambda functions deployed and configured
- [ ] API Gateway endpoints created
- [ ] Database schema includes Stripe columns
- [ ] Webhook endpoint configured in Stripe dashboard
- [ ] Validation script passes all checks
- [ ] End-to-end test completes successfully

## 📞 Next Steps

1. **Read the full guide**: [STRIPE_DEPLOYMENT_CHECKLIST.md](./STRIPE_DEPLOYMENT_CHECKLIST.md)
2. **Run validation**: `python scripts/validate-stripe.py --all`
3. **Test payment flow**: `bash scripts/test-stripe-flow.sh`
4. **Deploy to production**: Follow Part 6 of deployment checklist

## 🆘 Troubleshooting

Common issues and solutions:

### Validation Script Fails

```bash
# Check Python version (need 3.6+)
python3 --version

# Verify environment variables are set
env | grep STRIPE
```

### Test Script Can't Connect to Database

```bash
# Test database connection
psql "$DATABASE_URL" -c "SELECT 1"

# Verify DATABASE_URL format
# Should be: postgresql://user:pass@host:5432/dbname
```

### Webhook Not Received

1. Check CloudWatch logs for Lambda errors
2. Verify webhook URL in Stripe dashboard
3. Test webhook endpoint: `curl -I https://your-webhook-url`
4. Check API Gateway deployment stage

---

**For detailed instructions, see**: [STRIPE_DEPLOYMENT_CHECKLIST.md](./STRIPE_DEPLOYMENT_CHECKLIST.md)
