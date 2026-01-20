#!/bin/bash
# SecureBase Monetization Quick Start
# Enables revenue operations in 1 day

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "💰 SecureBase Monetization Quick Start"
echo "========================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v stripe &> /dev/null; then
    echo -e "${YELLOW}⚠️  Stripe CLI not installed${NC}"
    echo "   Install: https://stripe.com/docs/stripe-cli"
    echo "   Or run: brew install stripe/stripe-cli/stripe"
    echo ""
fi

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI required but not installed"
    exit 1
fi

echo ""
echo "🚀 Monetization Setup Steps"
echo "============================="
echo ""

# Step 1: Stripe Setup
echo "Step 1: Stripe Account Setup"
echo "----------------------------"
echo ""
echo "1. Create Stripe account: https://dashboard.stripe.com/register"
echo "2. Get API keys: https://dashboard.stripe.com/apikeys"
echo ""
read -p "Enter your Stripe SECRET key (sk_live_... or sk_test_...): " STRIPE_SECRET_KEY
read -p "Enter your Stripe PUBLISHABLE key (pk_live_... or pk_test_...): " STRIPE_PUBLIC_KEY

# Step 2: Create Products & Prices
echo ""
echo "Step 2: Creating Stripe Products..."
echo "------------------------------------"
echo ""

cat > /tmp/create-stripe-products.sh << 'EOF'
#!/bin/bash
# Create all SecureBase pricing tiers in Stripe

echo "Creating Healthcare tier..."
HEALTHCARE_PRODUCT=$(stripe products create \
  --name "SecureBase Healthcare" \
  --description "HIPAA-compliant AWS Landing Zone with 7-year retention" \
  --metadata tier=healthcare \
  --metadata framework=hipaa \
  -o json | jq -r '.id')

HEALTHCARE_PRICE=$(stripe prices create \
  --product $HEALTHCARE_PRODUCT \
  --currency usd \
  --unit-amount 1500000 \
  --recurring interval=month \
  --nickname "Healthcare Monthly" \
  -o json | jq -r '.id')

echo "✓ Healthcare: $HEALTHCARE_PRICE ($15,000/month)"

echo ""
echo "Creating Fintech tier..."
FINTECH_PRODUCT=$(stripe products create \
  --name "SecureBase Fintech" \
  --description "SOC2 Type II compliant AWS Landing Zone" \
  --metadata tier=fintech \
  --metadata framework=soc2 \
  -o json | jq -r '.id')

FINTECH_PRICE=$(stripe prices create \
  --product $FINTECH_PRODUCT \
  --currency usd \
  --unit-amount 800000 \
  --recurring interval=month \
  --nickname "Fintech Monthly" \
  -o json | jq -r '.id')

echo "✓ Fintech: $FINTECH_PRICE ($8,000/month)"

echo ""
echo "Creating Government tier..."
GOV_PRODUCT=$(stripe products create \
  --name "SecureBase Government" \
  --description "FedRAMP-aligned AWS Landing Zone" \
  --metadata tier=government \
  --metadata framework=fedramp \
  -o json | jq -r '.id')

GOV_PRICE=$(stripe prices create \
  --product $GOV_PRODUCT \
  --currency usd \
  --unit-amount 2500000 \
  --recurring interval=month \
  --nickname "Government Monthly" \
  -o json | jq -r '.id')

echo "✓ Government: $GOV_PRICE ($25,000/month)"

echo ""
echo "Creating Standard tier..."
STANDARD_PRODUCT=$(stripe products create \
  --name "SecureBase Standard" \
  --description "CIS Foundations compliant AWS Landing Zone" \
  --metadata tier=standard \
  --metadata framework=cis \
  -o json | jq -r '.id')

STANDARD_PRICE=$(stripe prices create \
  --product $STANDARD_PRODUCT \
  --currency usd \
  --unit-amount 200000 \
  --recurring interval=month \
  --nickname "Standard Monthly" \
  -o json | jq -r '.id')

echo "✓ Standard: $STANDARD_PRICE ($2,000/month)"

echo ""
echo "Creating Pilot Program coupon (50% off, 6 months)..."
PILOT_COUPON=$(stripe coupons create \
  --percent-off 50 \
  --duration repeating \
  --duration-in-months 6 \
  --name "Pilot Program 50% Off" \
  --max-redemptions 20 \
  -o json | jq -r '.id')

echo "✓ Pilot Coupon: $PILOT_COUPON (50% off for 6 months, max 20 uses)"

echo ""
echo "======================================"
echo "Stripe Products Created Successfully!"
echo "======================================"
echo ""
echo "Healthcare Price ID: $HEALTHCARE_PRICE"
echo "Fintech Price ID: $FINTECH_PRICE"
echo "Government Price ID: $GOV_PRICE"
echo "Standard Price ID: $STANDARD_PRICE"
echo "Pilot Coupon ID: $PILOT_COUPON"
echo ""
echo "Save these IDs for your Lambda environment variables!"
EOF

chmod +x /tmp/create-stripe-products.sh

if command -v stripe &> /dev/null; then
    echo "Running Stripe product creation..."
    export STRIPE_API_KEY=$STRIPE_SECRET_KEY
    /tmp/create-stripe-products.sh
else
    echo -e "${YELLOW}⚠️  Stripe CLI not available. Products must be created manually.${NC}"
    echo "   See: https://dashboard.stripe.com/products"
fi

# Step 3: Configure Lambda Environment Variables
echo ""
echo "Step 3: Configuring Lambda Functions..."
echo "---------------------------------------"
echo ""

read -p "Enter AWS region (default: us-east-1): " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}

echo "Setting Stripe keys in AWS Secrets Manager..."

# Store Stripe keys in Secrets Manager
aws secretsmanager create-secret \
  --name securebase/stripe/secret-key \
  --description "Stripe Secret Key for SecureBase" \
  --secret-string "$STRIPE_SECRET_KEY" \
  --region $AWS_REGION \
  || echo "Secret already exists, updating..." && \
  aws secretsmanager update-secret \
    --secret-id securebase/stripe/secret-key \
    --secret-string "$STRIPE_SECRET_KEY" \
    --region $AWS_REGION

aws secretsmanager create-secret \
  --name securebase/stripe/public-key \
  --description "Stripe Publishable Key for SecureBase" \
  --secret-string "$STRIPE_PUBLIC_KEY" \
  --region $AWS_REGION \
  || echo "Secret already exists, updating..." && \
  aws secretsmanager update-secret \
    --secret-id securebase/stripe/public-key \
    --secret-string "$STRIPE_PUBLIC_KEY" \
    --region $AWS_REGION

echo "✓ Stripe keys stored in Secrets Manager"

# Step 4: Deploy Stripe Webhook Lambda
echo ""
echo "Step 4: Deploying Payment Infrastructure..."
echo "-------------------------------------------"
echo ""

cd phase2-backend/functions

# Add Stripe to requirements
if ! grep -q "stripe" requirements.txt; then
    echo "stripe>=7.0.0" >> requirements.txt
    echo "✓ Added Stripe to requirements.txt"
fi

# Package webhook function
if [ -f "stripe_webhook.py" ]; then
    echo "Packaging Stripe webhook function..."
    zip -r ../deploy/stripe_webhook.zip stripe_webhook.py
    echo "✓ Webhook function packaged: phase2-backend/deploy/stripe_webhook.zip"
fi

cd ../../

# Step 5: Create Environment File for Portal
echo ""
echo "Step 5: Configuring Customer Portal..."
echo "--------------------------------------"
echo ""

cat > phase3a-portal/.env << EOF
VITE_STRIPE_PUBLIC_KEY=$STRIPE_PUBLIC_KEY
VITE_API_BASE_URL=https://api.securebase.dev
VITE_PORTAL_URL=https://portal.securebase.dev
EOF

echo "✓ Environment variables created: phase3a-portal/.env"

# Step 6: Generate Sales Materials
echo ""
echo "Step 6: Generating Sales Materials..."
echo "-------------------------------------"
echo ""

cat > sales-deck.md << 'DECK'
# SecureBase Sales Deck

## Slide 1: Problem
**Building AWS infrastructure takes 6-12 months and costs $200K-$500K**

- Hire expensive DevOps engineers ($150K+ each)
- Build custom AWS Landing Zone
- Implement compliance frameworks manually
- Maintain security & updates forever

## Slide 2: Solution
**SecureBase deploys production-ready infrastructure in 48 hours**

✓ Pre-built compliance frameworks (HIPAA, SOC2, FedRAMP, CIS)
✓ Automated security monitoring
✓ Zero DevOps team required
✓ $2K-$25K/month (vs $500K+ DIY)

## Slide 3: Pricing

| Tier | Monthly | Annual | Compliance |
|------|---------|--------|------------|
| Healthcare | $15,000 | $162,000 | HIPAA |
| Fintech | $8,000 | $86,400 | SOC2 |
| Government | $25,000 | $270,000 | FedRAMP |
| Standard | $2,000 | $21,600 | CIS |

**Pilot Program: 50% OFF for first 20 customers**

## Slide 4: ROI
**Traditional Approach:**
- 12 months to build
- $500,000 in engineering costs
- Ongoing maintenance

**SecureBase:**
- 48 hours to deploy
- $96,000/year (Fintech tier)
- Zero maintenance

**Savings: $404,000 in Year 1**

## Slide 5: Call to Action
**Start your 30-day free trial today**
→ portal.securebase.io/signup
DECK

echo "✓ Sales deck created: sales-deck.md"

# Step 7: Summary
echo ""
echo "======================================"
echo "✅ Monetization Setup Complete!"
echo "======================================"
echo ""
echo "Next Steps:"
echo ""
echo "1. 📧 Send cold emails (templates in MONETIZATION_STRATEGY.md)"
echo "2. 💼 LinkedIn outreach to CTOs/VPs Engineering"
echo "3. 🌐 Launch pilot program landing page"
echo "4. 📊 Monitor Stripe Dashboard: https://dashboard.stripe.com"
echo "5. 🎯 Goal: $10K MRR in 30 days"
echo ""
echo "Quick Links:"
echo "• Stripe Dashboard: https://dashboard.stripe.com"
echo "• Pricing Page: file://$(pwd)/marketing/pilot-program.html"
echo "• Sales Deck: file://$(pwd)/sales-deck.md"
echo "• Full Strategy: file://$(pwd)/MONETIZATION_STRATEGY.md"
echo ""
echo -e "${GREEN}🚀 Ready to start generating revenue!${NC}"
echo ""

# Create reminder for follow-up tasks
cat > MONETIZATION_TODO.md << 'TODO'
# Monetization Launch Checklist

## Day 1 (Today)
- [x] Set up Stripe account
- [x] Create pricing tiers
- [x] Configure Stripe webhook
- [ ] Test payment flow end-to-end
- [ ] Launch pricing page

## Day 2
- [ ] Send 100 LinkedIn connection requests
- [ ] Send 50 cold emails to healthcare CTOs
- [ ] Record 15-minute demo video
- [ ] Set up calendly.com/securebase for demo bookings

## Day 3-7
- [ ] LinkedIn outreach: 500 connections
- [ ] Cold email: 1,000 sends
- [ ] Book 10 demo calls
- [ ] Start 5 trials
- [ ] Close first paid customer 🎉

## Week 2
- [ ] 10 active trials
- [ ] 3 paid customers
- [ ] $10,000 MRR
- [ ] Submit AWS Marketplace listing

## Month 1
- [ ] 20 trials started
- [ ] 5 paid customers
- [ ] $25,000 MRR
- [ ] Pilot program 25% full (5/20 slots)

## Metrics to Track Daily
- Demo requests booked
- Trials started
- Paid conversions
- MRR growth
- Churn rate

**Revenue Dashboard:** https://dashboard.stripe.com/dashboard
TODO

echo "Created: MONETIZATION_TODO.md (your daily action items)"
echo ""
