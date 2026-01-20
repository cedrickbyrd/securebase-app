# 🚀 SecureBase Monetization - Launch NOW

## Current Status: READY TO DEPLOY ✅

All code is written and ready. Follow these steps to go live:

---

## 🎯 Step 1: Get Stripe Account (5 minutes)

### Create Account
1. Visit: https://dashboard.stripe.com/register
2. Sign up with your email
3. Complete verification (can use test mode immediately)

### Get API Keys
1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy **Publishable key** (starts with `pk_test_...`)
3. Click "Reveal test key" and copy **Secret key** (starts with `sk_test_...`)

**Save these keys - you'll need them in the next steps!**

---

## 🎯 Step 2: Store Stripe Keys in AWS (3 minutes)

```bash
# Replace YOUR_SECRET_KEY with your actual sk_test_... key
aws secretsmanager create-secret \
  --name securebase/stripe/secret-key \
  --description "Stripe Secret Key for SecureBase Payments" \
  --secret-string "sk_test_YOUR_SECRET_KEY_HERE" \
  --region us-east-1

# You'll configure the webhook secret later after deployment
```

---

## 🎯 Step 3: Configure Portal Environment (2 minutes)

```bash
cd /workspaces/securebase-app/phase3a-portal

# Create .env file with your Stripe publishable key
cat > .env << 'EOF'
# Stripe Configuration (use pk_test_... for testing)
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE

# API Configuration
VITE_API_BASE_URL=https://api.securebase.io
VITE_PORTAL_URL=https://portal.securebase.io
EOF

# Install Stripe.js dependency
npm install @stripe/stripe-js
```

---

## 🎯 Step 4: Package Lambda Functions (2 minutes)

```bash
cd /workspaces/securebase-app/phase2-backend

# Create deploy directory
mkdir -p deploy

# Package Stripe webhook
cd functions
zip -r ../deploy/stripe_webhook.zip stripe_webhook.py
zip -r ../deploy/create_checkout_session.zip create_checkout_session.py

echo "✅ Lambda packages created in phase2-backend/deploy/"
```

---

## 🎯 Step 5: Add Variables to Terraform (1 minute)

```bash
cd /workspaces/securebase-app/landing-zone/environments/dev

# Add portal URL variable
cat >> variables.tf << 'EOF'

variable "portal_url" {
  description = "Customer portal URL"
  type        = string
  default     = "https://portal.securebase.io"
}
EOF

# Add to terraform.tfvars
echo 'portal_url = "https://portal.securebase.io"' >> terraform.tfvars
```

---

## 🎯 Step 6: Deploy Payment Infrastructure (5 minutes)

```bash
cd /workspaces/securebase-app/landing-zone/environments/dev

# Initialize Terraform (if not already done)
terraform init

# Review the payment functions that will be created
terraform plan

# Deploy!
terraform apply -auto-approve

# Save the webhook URL for next step
terraform output stripe_webhook_url
# Example output: https://abcd1234.lambda-url.us-east-1.on.aws/
```

---

## 🎯 Step 7: Configure Stripe Webhook (3 minutes)

### Add Webhook Endpoint
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Paste your Lambda webhook URL (from terraform output above)
4. Click **"Select events"**
5. Select these events:
   - ✅ `checkout.session.completed`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
6. Click **"Add endpoint"**

### Save Webhook Secret
1. Click on your newly created endpoint
2. Click **"Reveal"** under "Signing secret"
3. Copy the secret (starts with `whsec_...`)
4. Store in AWS:

```bash
aws secretsmanager create-secret \
  --name securebase/stripe/webhook-secret \
  --secret-string "whsec_YOUR_WEBHOOK_SECRET_HERE" \
  --region us-east-1

# Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name securebase-dev-stripe-webhook \
  --environment Variables="{STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE}" \
  --region us-east-1
```

---

## 🎯 Step 8: Create Stripe Products (5 minutes)

### Option A: Using Stripe CLI (Recommended)
```bash
# Install Stripe CLI if not installed
# macOS: brew install stripe/stripe-cli/stripe
# Linux: See https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Create products and prices
stripe products create \
  --name "SecureBase Healthcare" \
  --description "HIPAA-compliant AWS Landing Zone" \
  --metadata[tier]=healthcare

# Get the product ID from output (prod_xxxxx), then create price:
stripe prices create \
  --product prod_YOUR_HEALTHCARE_PRODUCT_ID \
  --currency usd \
  --unit-amount 1500000 \
  --recurring[interval]=month

# Repeat for other tiers:
# Fintech: $8,000/mo (800000 cents)
# Government: $25,000/mo (2500000 cents)
# Standard: $2,000/mo (200000 cents)

# Create pilot coupon (50% off, 6 months)
stripe coupons create \
  --percent-off 50 \
  --duration repeating \
  --duration-in-months 6 \
  --max-redemptions 20 \
  --name "Pilot Program 50% Off"
```

### Option B: Using Stripe Dashboard (Manual)
1. Go to: https://dashboard.stripe.com/test/products
2. Click **"+ Add product"**
3. Create each tier:
   - **Healthcare**: $15,000/month, recurring
   - **Fintech**: $8,000/month, recurring
   - **Government**: $25,000/month, recurring
   - **Standard**: $2,000/month, recurring
4. Save each **Price ID** (price_xxxxx)
5. Update Lambda environment variables with these IDs

---

## 🎯 Step 9: Update Lambda with Product IDs (2 minutes)

```bash
# Update checkout Lambda with your Stripe price IDs
aws lambda update-function-configuration \
  --function-name securebase-dev-create-checkout \
  --environment Variables="{
    STRIPE_PRICE_HEALTHCARE=price_YOUR_HEALTHCARE_PRICE_ID,
    STRIPE_PRICE_FINTECH=price_YOUR_FINTECH_PRICE_ID,
    STRIPE_PRICE_GOVERNMENT=price_YOUR_GOVERNMENT_PRICE_ID,
    STRIPE_PRICE_STANDARD=price_YOUR_STANDARD_PRICE_ID,
    STRIPE_PILOT_COUPON=YOUR_COUPON_ID,
    PORTAL_URL=https://portal.securebase.io
  }" \
  --region us-east-1
```

---

## 🎯 Step 10: Test Payment Flow (5 minutes)

### Test Checkout API
```bash
# Get checkout API URL
CHECKOUT_URL=$(terraform output -raw checkout_api_url)

# Test creating a checkout session
curl -X POST $CHECKOUT_URL \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "fintech",
    "email": "test@example.com",
    "name": "Test Company",
    "use_pilot_coupon": true
  }'

# Expected response:
# {
#   "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_xxxxx",
#   "session_id": "cs_test_xxxxx"
# }
```

### Test Full Payment Flow
1. Visit the checkout URL from the response above
2. Use Stripe test card: `4242 4242 4242 4242`
3. Expiry: Any future date
4. CVC: Any 3 digits
5. Complete checkout
6. Verify webhook was called (check Lambda logs):

```bash
aws logs tail /aws/lambda/securebase-dev-stripe-webhook --follow
```

---

## 🎯 Step 11: Build & Deploy Portal (10 minutes)

```bash
cd /workspaces/securebase-app/phase3a-portal

# Install dependencies
npm install

# Build for production
npm run build

# Deploy to your hosting platform
# Option A: AWS S3 + CloudFront
aws s3 sync dist/ s3://portal.securebase.io/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"

# Option B: Vercel
# npx vercel --prod

# Option C: Netlify
# npx netlify deploy --prod --dir=dist
```

---

## 🎯 Step 12: Launch Sales & Marketing (Ongoing)

### Immediate Actions (Day 1)
- [ ] Update LinkedIn profile with SecureBase messaging
- [ ] Create Calendly link for demo bookings
- [ ] Set up email sequences in your outreach tool
- [ ] Launch pricing page (portal.securebase.io/signup)

### Week 1 Goals
- [ ] Send 100 LinkedIn connection requests to CTOs
- [ ] Send 250 cold emails to target companies
- [ ] Book 5 demo calls
- [ ] Start 3 free trials

### Week 2-4 Goals
- [ ] 10 demo calls completed
- [ ] 5 trials converted to paid
- [ ] $10,000 MRR achieved

---

## ✅ Launch Checklist

### Infrastructure
- [ ] Stripe account created (test mode)
- [ ] Stripe API keys stored in AWS Secrets Manager
- [ ] Lambda functions packaged and deployed
- [ ] Stripe webhook configured
- [ ] Stripe products created (4 tiers)
- [ ] Pilot coupon created (50% off, 6 months)

### Portal
- [ ] @stripe/stripe-js installed
- [ ] .env configured with Stripe public key
- [ ] Portal built (`npm run build`)
- [ ] Portal deployed to hosting
- [ ] Signup page accessible online

### Testing
- [ ] Checkout API returns valid session URL
- [ ] Test payment completes successfully
- [ ] Webhook receives payment events
- [ ] Database updates with customer record
- [ ] Email notifications sent (if configured)

### Sales & Marketing
- [ ] Demo calendar link created
- [ ] LinkedIn profile optimized
- [ ] Cold email templates ready
- [ ] Pricing page accessible
- [ ] Revenue tracking spreadsheet set up

---

## 🚨 Troubleshooting

### "Stripe signature verification failed"
- Check webhook secret is correct in Lambda environment
- Verify webhook URL matches Lambda function URL exactly

### "Payment method required"
- In Stripe Dashboard → Products → Edit product
- Enable "Collect payment details before trial ends"

### "Customer not created in database"
- Check Lambda CloudWatch logs for errors
- Verify database connection string is correct
- Ensure RLS policies allow INSERT operations

### "Portal shows CORS error"
- Update Lambda CORS configuration
- Add portal domain to allowed origins

---

## 📊 Revenue Tracking

### Daily Metrics (Check in Stripe Dashboard)
- Trials started: https://dashboard.stripe.com/test/subscriptions?status=trialing
- Active subscriptions: https://dashboard.stripe.com/test/subscriptions?status=active
- MRR: https://dashboard.stripe.com/test/revenue

### Weekly Review
Create a spreadsheet to track:
- LinkedIn connections sent
- Cold emails sent
- Demo calls booked
- Trials started
- Conversions (trial → paid)
- MRR growth
- Churn rate

---

## 🎉 You're Live!

Once all checklist items are complete:

1. **Switch Stripe to LIVE mode**
   - Go to: https://dashboard.stripe.com/settings/account
   - Complete account verification
   - Get LIVE API keys (pk_live_..., sk_live_...)
   - Update all secrets and environment variables

2. **Start outreach**
   - LinkedIn: 100 connections/week
   - Email: 250 outreaches/week
   - Demos: 5 calls/week

3. **Track results**
   - Goal: 5 customers in Month 1
   - Target: $10,000 MRR
   - Growth: 3x monthly

**You're now generating revenue! 💰🚀**

---

## 📞 Next Steps

Ready to execute? Start with Step 1 and work through sequentially.

**Estimated total time: 45-60 minutes**

Questions? Check [MONETIZATION_COMPLETE.md](MONETIZATION_COMPLETE.md) for detailed documentation.
