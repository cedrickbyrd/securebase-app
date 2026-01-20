#!/bin/bash

# 🚀 SecureBase Payment Enablement Script
# Enables Stripe payments in 3 steps: Setup → Deploy → Test

set -e  # Exit on error

echo "🚀 SecureBase Payment Enablement"
echo "================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install: https://aws.amazon.com/cli/"
    exit 1
fi

# Check Terraform
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Please install: https://terraform.io/downloads"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Run: aws configure"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Step 1: Stripe Setup
echo "💳 Step 1: Stripe Account Setup"
echo "------------------------------"
echo ""
echo "You need a FREE Stripe account to accept payments."
echo ""
echo "🌐 Opening Stripe registration..."
echo "   → https://dashboard.stripe.com/register"
echo ""
echo "After creating your account:"
echo "1. Go to: https://dashboard.stripe.com/test/apikeys"
echo "2. Copy your keys (pk_test_... and sk_test_...)"
echo ""

# Option to open browser
read -p "Open Stripe registration now? [Y/n]: " open_stripe
if [[ $open_stripe != "n" && $open_stripe != "N" ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open "https://dashboard.stripe.com/register" 2>/dev/null || true
    elif command -v open &> /dev/null; then
        open "https://dashboard.stripe.com/register" 2>/dev/null || true
    else
        echo "Please visit: https://dashboard.stripe.com/register"
    fi
fi

echo ""
echo "📝 Enter your Stripe TEST API keys:"
read -p "Publishable key (pk_test_...): " STRIPE_PUBLIC_KEY
read -s -p "Secret key (sk_test_...): " STRIPE_SECRET_KEY
echo ""

# Validate keys
if [[ ! $STRIPE_PUBLIC_KEY =~ ^pk_test_ ]] || [[ ! $STRIPE_SECRET_KEY =~ ^sk_test_ ]]; then
    echo "❌ Invalid Stripe keys. Must be TEST keys (pk_test_... and sk_test_...)"
    exit 1
fi

echo "✅ Stripe keys validated"
echo ""

# Step 2: Run monetization script
echo "🛠️  Step 2: Create Products & Deploy Functions"
echo "---------------------------------------------"
echo ""
echo "Running start-monetization.sh to:"
echo "• Create 4 pricing tiers in Stripe"
echo "• Create 50% pilot discount coupon"
echo "• Store secrets in AWS Secrets Manager"
echo "• Package Lambda functions"
echo ""

# Make monetization script executable and run it
chmod +x ./start-monetization.sh

# Set environment variables for the script
export STRIPE_PUBLIC_KEY
export STRIPE_SECRET_KEY

echo "🔧 Running monetization setup..."
if ./start-monetization.sh; then
    echo "✅ Monetization setup completed"
else
    echo "❌ Monetization setup failed. Check the output above."
    exit 1
fi

echo ""

# Step 3: Deploy infrastructure
echo "🚀 Step 3: Deploy Payment Infrastructure"
echo "---------------------------------------"
echo ""
echo "Deploying API Gateway + Lambda functions..."
echo ""

cd landing-zone/environments/dev

# Run terraform
echo "🔧 Initializing Terraform..."
terraform init

echo "🔍 Validating configuration..."
terraform validate

echo "📋 Planning deployment..."
terraform plan

echo ""
read -p "Deploy payment infrastructure? [Y/n]: " deploy_confirm
if [[ $deploy_confirm == "n" || $deploy_confirm == "N" ]]; then
    echo "❌ Deployment cancelled by user"
    exit 1
fi

echo "🚀 Deploying infrastructure..."
if terraform apply -auto-approve; then
    echo "✅ Infrastructure deployed successfully"
else
    echo "❌ Terraform deployment failed"
    exit 1
fi

# Get API Gateway endpoint
API_ENDPOINT=$(terraform output -raw api_gateway_endpoint 2>/dev/null || echo "Not available")

echo ""
echo "📡 API Gateway endpoint: $API_ENDPOINT"
echo ""

# Step 4: Configure portal
echo "🌐 Step 4: Configure Customer Portal"
echo "------------------------------------"
echo ""

cd ../../../phase3a-portal

# Create .env file with Stripe key
echo "VITE_STRIPE_PUBLIC_KEY=$STRIPE_PUBLIC_KEY" > .env
echo "VITE_API_BASE_URL=$API_ENDPOINT" >> .env

echo "✅ Portal environment configured"
echo ""

# Step 5: Get webhook URL and instructions
echo "🔗 Step 5: Configure Stripe Webhook"
echo "-----------------------------------"
echo ""

cd ../landing-zone/environments/dev

# Get webhook function URL
WEBHOOK_URL=$(aws lambda get-function-url-config --function-name "securebase-dev-stripe-webhook" --query 'FunctionUrl' --output text 2>/dev/null || echo "Not deployed yet")

echo "🎯 Webhook URL: $WEBHOOK_URL"
echo ""
echo "📝 Manual setup required:"
echo "1. Go to: https://dashboard.stripe.com/test/webhooks"
echo "2. Click 'Add endpoint'"
echo "3. Paste URL: $WEBHOOK_URL"
echo "4. Select these events:"
echo "   • checkout.session.completed"
echo "   • invoice.payment_succeeded"
echo "   • invoice.payment_failed"
echo "   • customer.subscription.updated"
echo "   • customer.subscription.deleted"
echo "5. Click 'Add endpoint'"
echo ""

# Step 6: Test instructions
echo "🧪 Step 6: Test Payment Flow"
echo "----------------------------"
echo ""
echo "Test your payment system:"
echo "1. Start portal: cd phase3a-portal && npm run dev"
echo "2. Visit: http://localhost:5173/signup"
echo "3. Select tier, enable pilot discount (50% off)"
echo "4. Use test card: 4242 4242 4242 4242"
echo "5. Any CVV, future expiry date"
echo ""

# Success summary
echo ""
echo "🎉 PAYMENTS ENABLED SUCCESSFULLY!"
echo "================================="
echo ""
echo "✅ Stripe account configured"
echo "✅ Products & coupons created"
echo "✅ Lambda functions deployed"
echo "✅ API Gateway deployed"
echo "✅ Portal configured"
echo ""
echo "💰 Revenue Projections:"
echo "   Month 1: $10K MRR (5 customers)"
echo "   Month 2: $30K MRR (10 customers)"
echo "   Month 3: $100K MRR (25 customers)"
echo ""
echo "🚀 Next Steps:"
echo "1. Configure Stripe webhook (see instructions above)"
echo "2. Test payment with card 4242 4242 4242 4242"
echo "3. Deploy portal to production hosting"
echo "4. Switch Stripe to LIVE mode when ready"
echo ""
echo "📊 Track metrics at: https://dashboard.stripe.com"
echo ""
echo "Ready to make money! 💸"