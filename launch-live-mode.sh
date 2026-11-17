#!/bin/bash
# 🚀 SecureBase Live Mode Launch Script
# Switches from test mode to live Stripe and deploys signup page

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 SecureBase LIVE MODE Launch"
echo "================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v stripe &> /dev/null; then
    echo -e "${YELLOW}⚠️  Installing Stripe CLI...${NC}"
    if command -v brew &> /dev/null; then
        brew install stripe/stripe-cli/stripe
    else
        echo "Please install Stripe CLI: https://stripe.com/docs/stripe-cli"
        exit 1
    fi
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI required but not installed${NC}"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Run: aws configure${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Step 1: Live Stripe Setup
echo "💳 Step 1: Stripe Live Mode Setup"
echo "----------------------------------"
echo ""
echo -e "${YELLOW}🚨 SWITCHING TO LIVE MODE - REAL MONEY WILL BE PROCESSED${NC}"
echo ""
echo "Before continuing, ensure you have:"
echo "1. ✅ Verified Stripe account (business info submitted)"
echo "2. ✅ Bank account connected for payouts"
echo "3. ✅ Live API keys ready"
echo ""
read -p "Are you ready to switch to LIVE mode? [y/N]: " confirm_live

if [[ $confirm_live != "y" && $confirm_live != "Y" ]]; then
    echo "Aborting live mode setup. Use test mode first."
    exit 1
fi

echo ""
echo "📝 Enter your Stripe LIVE API keys:"
echo "   Get them from: https://dashboard.stripe.com/apikeys"
echo ""
read -p "Live Publishable key (pk_test_...): " STRIPE_LIVE_PUBLIC_KEY
read -s -p "Live Secret key (sk_test_...): " STRIPE_LIVE_SECRET_KEY
echo ""

# Validate live keys
if [[ ! $STRIPE_LIVE_PUBLIC_KEY =~ ^pk_test_ ]] || [[ ! $STRIPE_LIVE_SECRET_KEY =~ ^sk_test_ ]]; then
    echo -e "${RED}❌ Invalid Stripe keys. Must be LIVE keys (pk_test_... and sk_test_...)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Stripe live keys validated${NC}"
echo ""

# Step 2: Create Live Products
echo "🛠️  Step 2: Creating Live Stripe Products"
echo "----------------------------------------"
echo ""

# Set Stripe to use live keys
export STRIPE_API_KEY=$STRIPE_LIVE_SECRET_KEY

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

echo "✅ Healthcare: $HEALTHCARE_PRICE ($15,000/month)"

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

echo "✅ Fintech: $FINTECH_PRICE ($8,000/month)"

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

echo "✅ Government: $GOV_PRICE ($25,000/month)"

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

echo "✅ Standard: $STANDARD_PRICE ($2,000/month)"

# Create pilot program coupon (50% off, 6 months, 20 customers)
echo "Creating pilot program coupon..."
PILOT_COUPON=$(stripe coupons create \
  --percent-off 50 \
  --duration repeating \
  --duration-in-months 6 \
  --max-redemptions 20 \
  --name "SecureBase Pilot Program" \
  -o json | jq -r '.id')

echo "✅ Pilot coupon: $PILOT_COUPON (50% off for 6 months)"

# Step 3: Store secrets in AWS
echo ""
echo "🔐 Step 3: Storing Secrets in AWS"
echo "--------------------------------"
echo ""

# Store Stripe keys
aws secretsmanager create-secret \
  --name "securebase/stripe/live-public-key" \
  --description "Stripe Live Publishable Key" \
  --secret-string "$STRIPE_LIVE_PUBLIC_KEY" \
  --region us-east-1 2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id "securebase/stripe/live-public-key" \
  --secret-string "$STRIPE_LIVE_PUBLIC_KEY" \
  --region us-east-1

aws secretsmanager create-secret \
  --name "securebase/stripe/live-secret-key" \
  --description "Stripe Live Secret Key" \
  --secret-string "$STRIPE_LIVE_SECRET_KEY" \
  --region us-east-1 2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id "securebase/stripe/live-secret-key" \
  --secret-string "$STRIPE_LIVE_SECRET_KEY" \
  --region us-east-1

# Store product IDs
PRODUCT_CONFIG=$(cat <<EOF
{
  "healthcare": {
    "product_id": "$HEALTHCARE_PRODUCT",
    "price_id": "$HEALTHCARE_PRICE"
  },
  "fintech": {
    "product_id": "$FINTECH_PRODUCT",
    "price_id": "$FINTECH_PRICE"
  },
  "government": {
    "product_id": "$GOV_PRODUCT",
    "price_id": "$GOV_PRICE"
  },
  "standard": {
    "product_id": "$STANDARD_PRODUCT",
    "price_id": "$STANDARD_PRICE"
  },
  "pilot_coupon": "$PILOT_COUPON"
}
EOF
)

aws secretsmanager create-secret \
  --name "securebase/stripe/product-config" \
  --description "Stripe Product and Price IDs" \
  --secret-string "$PRODUCT_CONFIG" \
  --region us-east-1 2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id "securebase/stripe/product-config" \
  --secret-string "$PRODUCT_CONFIG" \
  --region us-east-1

echo "✅ Secrets stored in AWS Secrets Manager"

# Step 4: Deploy Stripe Lambda Functions
echo ""
echo "🚀 Step 4: Deploy Payment Lambda Functions"
echo "-----------------------------------------"
echo ""

cd phase2-backend/functions

# Package functions
echo "Packaging Lambda functions..."
zip -r ../deploy/stripe_webhook.zip stripe_webhook.py
zip -r ../deploy/create_checkout_session.zip create_checkout_session.py

echo "✅ Lambda functions packaged"

# Deploy via Terraform
cd ../../landing-zone/environments/dev

echo "Deploying with Terraform..."
terraform apply -auto-approve -target=module.stripe-webhook -target=module.checkout-api

echo "✅ Payment functions deployed"

# Step 5: Setup Portal
echo ""
echo "🌐 Step 5: Setup Customer Portal"
echo "-------------------------------"
echo ""

cd ../../../phase3a-portal

# Create production environment file
cat > .env.production << EOF
# Production Environment Variables
VITE_API_BASE_URL=https://api.securebase.com/v1
VITE_STRIPE_PUBLIC_KEY=$STRIPE_LIVE_PUBLIC_KEY
VITE_ENV=production
EOF

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Add Stripe.js if not already installed
npm install @stripe/stripe-js

# Build for production
echo "Building production portal..."
npm run build

echo "✅ Portal built for production"

# Step 6: Get deployment URLs
echo ""
echo "📋 Step 6: Deployment Information"
echo "-------------------------------"
echo ""

# Get Lambda function URLs
WEBHOOK_URL=$(aws lambda get-function-url-config \
  --function-name securebase-dev-stripe-webhook \
  --region us-east-1 \
  --query 'FunctionUrl' \
  --output text 2>/dev/null || echo "Not deployed yet")

CHECKOUT_URL=$(aws lambda get-function-url-config \
  --function-name securebase-dev-checkout-session \
  --region us-east-1 \
  --query 'FunctionUrl' \
  --output text 2>/dev/null || echo "Not deployed yet")

echo -e "${GREEN}🎉 LIVE MODE SETUP COMPLETE!${NC}"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. 🌐 Setup Stripe Webhook:"
echo "   → Go to: https://dashboard.stripe.com/webhooks"
echo "   → Add endpoint: $WEBHOOK_URL"
echo "   → Select events: checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed"
echo ""
echo "2. 🚀 Deploy Portal:"
echo "   → Upload 'phase3a-portal/dist/' to your hosting (Netlify, S3+CloudFront)"
echo "   → For Netlify: netlify deploy --prod"
echo ""
echo "3. 🧪 Test Payment:"
echo "   → Use real card (small amount): 4242424242424242"
echo "   → Check Stripe Dashboard: https://dashboard.stripe.com/payments"
echo ""
echo "4. 📈 Start Selling:"
echo "   → Share signup URL with prospects"
echo "   → Monitor metrics in Stripe Dashboard"
echo ""
echo -e "${YELLOW}⚠️  REMINDER: You're now in LIVE mode - real money will be processed!${NC}"
echo ""
echo "💰 Ready to generate revenue! 🚀"
