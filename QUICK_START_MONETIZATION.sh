#!/bin/bash
# SecureBase Monetization Quick Start
# Deploys payment infrastructure WITHOUT Stripe keys (can add later)

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}💰 SecureBase Monetization - Quick Start${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Package Lambda Functions
echo -e "${BLUE}Step 1: Packaging Payment Functions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd phase2-backend/functions

# Create deploy directory if it doesn't exist
mkdir -p ../deploy

# Add Stripe to requirements
if ! grep -q "stripe" requirements.txt; then
    echo "stripe>=7.0.0" >> requirements.txt
    echo "✓ Added Stripe to requirements.txt"
fi

# Package webhook function
if [ -f "stripe_webhook.py" ]; then
    echo "Packaging stripe_webhook.py..."
    zip -q ../deploy/stripe_webhook.zip stripe_webhook.py
    echo -e "${GREEN}✓${NC} Created: ../deploy/stripe_webhook.zip"
fi

# Package checkout function
if [ -f "create_checkout_session.py" ]; then
    echo "Packaging create_checkout_session.py..."
    zip -q ../deploy/create_checkout_session.zip create_checkout_session.py
    echo -e "${GREEN}✓${NC} Created: ../deploy/create_checkout_session.zip"
fi

cd ../../

echo ""
echo -e "${GREEN}✓ Lambda functions packaged successfully!${NC}"
echo ""

# Step 2: Add Stripe dependency to Portal
echo -e "${BLUE}Step 2: Preparing Customer Portal${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd phase3a-portal

# Check if @stripe/stripe-js is in package.json
if ! grep -q "@stripe/stripe-js" package.json; then
    echo "Adding @stripe/stripe-js to package.json..."
    npm install --save @stripe/stripe-js
    echo -e "${GREEN}✓${NC} Stripe.js added to dependencies"
else
    echo -e "${GREEN}✓${NC} Stripe.js already in dependencies"
fi

# Create environment template
cat > .env.example << 'ENV'
# SecureBase Portal Environment Variables

# Stripe (get from https://dashboard.stripe.com/test/apikeys)
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY_HERE

# API Configuration
VITE_API_BASE_URL=https://api.securebase.io
VITE_PORTAL_URL=https://portal.securebase.io
ENV

echo -e "${GREEN}✓${NC} Created .env.example template"

# Create actual .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠️${NC}  Created .env - you need to add your Stripe public key"
else
    echo -e "${GREEN}✓${NC} .env already exists"
fi

cd ..

echo ""
echo -e "${GREEN}✓ Portal preparation complete!${NC}"
echo ""

# Step 3: Create Terraform Configuration for Payment Lambdas
echo -e "${BLUE}Step 3: Creating Terraform Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat > landing-zone/environments/dev/payment-functions.tf << 'TERRAFORM'
# SecureBase Payment Processing Lambda Functions

# IAM Role for Payment Functions
resource "aws_iam_role" "payment_lambda_role" {
  name = "securebase-${var.environment}-payment-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = {
    Name        = "SecureBase Payment Lambda Role"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Policy for database access and logging
resource "aws_iam_role_policy" "payment_lambda_policy" {
  name = "payment-lambda-policy"
  role = aws_iam_role.payment_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.region}:*:secret:securebase/stripe/*",
          "arn:aws:secretsmanager:${var.region}:*:secret:securebase/${var.environment}/db/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.payment_alerts.arn
      }
    ]
  })
}

# SNS Topic for payment alerts
resource "aws_sns_topic" "payment_alerts" {
  name = "securebase-${var.environment}-payment-alerts"

  tags = {
    Name        = "SecureBase Payment Alerts"
    Environment = var.environment
  }
}

# Stripe Webhook Lambda Function
resource "aws_lambda_function" "stripe_webhook" {
  filename         = "../../phase2-backend/deploy/stripe_webhook.zip"
  function_name    = "securebase-${var.environment}-stripe-webhook"
  role            = aws_iam_role.payment_lambda_role.arn
  handler         = "stripe_webhook.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 512

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      SNS_TOPIC_ARN       = aws_sns_topic.payment_alerts.arn
      DB_SECRET_ARN       = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:securebase/${var.environment}/db"
      STRIPE_SECRET_ARN   = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:securebase/stripe/secret-key"
      STRIPE_WEBHOOK_ARN  = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:securebase/stripe/webhook-secret"
    }
  }

  tags = {
    Name        = "SecureBase Stripe Webhook"
    Environment = var.environment
  }
}

# Checkout Session Lambda Function
resource "aws_lambda_function" "create_checkout" {
  filename         = "../../phase2-backend/deploy/create_checkout_session.zip"
  function_name    = "securebase-${var.environment}-create-checkout"
  role            = aws_iam_role.payment_lambda_role.arn
  handler         = "create_checkout_session.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      ENVIRONMENT             = var.environment
      DB_SECRET_ARN          = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:securebase/${var.environment}/db"
      STRIPE_SECRET_ARN      = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:securebase/stripe/secret-key"
      PORTAL_URL             = var.portal_url
    }
  }

  tags = {
    Name        = "SecureBase Checkout Session"
    Environment = var.environment
  }
}

# Lambda Function URLs (for direct invocation)
resource "aws_lambda_function_url" "stripe_webhook" {
  function_name      = aws_lambda_function.stripe_webhook.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["*"]
    allow_methods = ["POST"]
    allow_headers = ["stripe-signature", "content-type"]
  }
}

resource "aws_lambda_function_url" "create_checkout" {
  function_name      = aws_lambda_function.create_checkout.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["*"]
    allow_methods = ["POST"]
    allow_headers = ["content-type"]
  }
}

# Outputs
output "stripe_webhook_url" {
  description = "URL for Stripe webhook"
  value       = aws_lambda_function_url.stripe_webhook.function_url
}

output "checkout_api_url" {
  description = "URL for checkout API"
  value       = aws_lambda_function_url.create_checkout.function_url
}

output "payment_alerts_topic_arn" {
  description = "SNS topic for payment alerts"
  value       = aws_sns_topic.payment_alerts.arn
}
TERRAFORM

echo -e "${GREEN}✓${NC} Created payment-functions.tf"

# Add portal_url variable if not exists
if ! grep -q "portal_url" landing-zone/environments/dev/terraform.tfvars; then
    echo "" >> landing-zone/environments/dev/terraform.tfvars
    echo "# Portal Configuration" >> landing-zone/environments/dev/terraform.tfvars
    echo 'portal_url = "https://portal.securebase.io"' >> landing-zone/environments/dev/terraform.tfvars
    echo -e "${GREEN}✓${NC} Added portal_url to terraform.tfvars"
fi

echo ""
echo -e "${GREEN}✓ Terraform configuration ready!${NC}"
echo ""

# Step 4: Summary & Next Steps
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Monetization Infrastructure Ready!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📦 Created:"
echo "  • Lambda deployment packages (phase2-backend/deploy/)"
echo "  • Terraform payment functions config (payment-functions.tf)"
echo "  • Portal environment template (.env.example)"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo ""
echo "1️⃣  Get Stripe API Keys (5 minutes)"
echo "   → Visit: https://dashboard.stripe.com/test/apikeys"
echo "   → Copy 'Publishable key' (pk_test_...)"
echo "   → Copy 'Secret key' (sk_test_...)"
echo ""
echo "2️⃣  Configure Environment (2 minutes)"
echo "   → Edit: phase3a-portal/.env"
echo "   → Set: VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY"
echo ""
echo "3️⃣  Store Stripe Secret in AWS (3 minutes)"
echo "   → Run:"
echo "     aws secretsmanager create-secret \\"
echo "       --name securebase/stripe/secret-key \\"
echo "       --secret-string 'sk_test_YOUR_SECRET_KEY' \\"
echo "       --region us-east-1"
echo ""
echo "4️⃣  Deploy Payment Functions (5 minutes)"
echo "   → cd landing-zone/environments/dev"
echo "   → terraform init"
echo "   → terraform apply"
echo ""
echo "5️⃣  Configure Stripe Webhook (2 minutes)"
echo "   → Get webhook URL from terraform output"
echo "   → Add to: https://dashboard.stripe.com/test/webhooks"
echo "   → Select events:"
echo "     - checkout.session.completed"
echo "     - invoice.payment_succeeded"
echo "     - invoice.payment_failed"
echo "     - customer.subscription.updated"
echo "     - customer.subscription.deleted"
echo ""
echo "6️⃣  Build & Deploy Portal (10 minutes)"
echo "   → cd phase3a-portal"
echo "   → npm install"
echo "   → npm run build"
echo "   → Deploy dist/ to your hosting (S3, Vercel, etc.)"
echo ""
echo -e "${GREEN}💰 Total time to revenue: ~30 minutes!${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📚 Documentation:"
echo "  • Full Guide: MONETIZATION_COMPLETE.md"
echo "  • API Reference: API_REFERENCE.md"
echo "  • Sales Playbook: REVENUE_READY.md"
echo ""
echo -e "${GREEN}Ready to start generating revenue! 🚀${NC}"
echo ""
