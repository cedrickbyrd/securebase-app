#!/bin/bash
# SecureBase - One-Command Production Deployment
# This script automates the entire deployment process

set -e

echo "🚀 SecureBase Production Deployment"
echo "====================================="
echo ""

# Step 1: Configure AWS
echo "📋 Step 1/4: Configure AWS Credentials"
echo "---------------------------------------"
if ! aws sts get-caller-identity &>/dev/null; then
    echo "⚠️  AWS credentials not configured"
    bash configure-aws.sh
else
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo "✅ Using AWS Account: $ACCOUNT_ID"
fi
echo ""

# Step 2: Bootstrap Backend
echo "📋 Step 2/4: Bootstrap Backend (S3 + DynamoDB)"
echo "-----------------------------------------------"
bash bootstrap-backend.sh
echo ""

# Step 3: Initialize Terraform
echo "📋 Step 3/4: Initialize Terraform"
echo "----------------------------------"
cd environments/dev
terraform init -backend-config=backend.hcl -reconfigure
echo ""

# Step 4: Plan & Apply
echo "📋 Step 4/4: Deploy Infrastructure"
echo "-----------------------------------"
echo ""
echo "⚠️  Review the plan carefully before applying!"
echo ""
terraform plan -out=tfplan
echo ""
echo "Plan saved to tfplan"
echo ""
read -p "Deploy infrastructure? (yes/no): " CONFIRM

if [ "$CONFIRM" = "yes" ]; then
    echo ""
    echo "🚀 Deploying SecureBase infrastructure..."
    echo ""
    terraform apply tfplan
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📊 View outputs:"
    terraform output
    echo ""
    echo "📖 Next steps: See PRODUCTION_DEPLOY.md for post-deployment tasks"
else
    echo ""
    echo "❌ Deployment cancelled"
    echo ""
    echo "To deploy later:"
    echo "  cd environments/dev"
    echo "  terraform apply tfplan"
fi
