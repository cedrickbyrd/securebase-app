#!/bin/bash
set -e

echo "🚀 SecureBase PaaS - Deployment Script"
echo "======================================"
echo ""

# Step 1: Verify prerequisites
echo "Step 1: Checking Prerequisites"
echo "  Checking Terraform..."
if ! command -v terraform &> /dev/null; then
  echo "  ❌ Terraform not installed. Please install Terraform >= 1.5.0"
  exit 1
fi
TERRAFORM_VERSION=$(terraform version | head -1)
echo "  ✅ $TERRAFORM_VERSION"

echo "  Checking AWS CLI..."
if ! command -v aws &> /dev/null; then
  echo "  ❌ AWS CLI not installed. Please install AWS CLI"
  exit 1
fi
echo "  ✅ AWS CLI installed"

echo "  Checking AWS Credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
  echo "  ❌ AWS credentials not configured"
  echo "     Run: aws configure"
  exit 1
fi
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ARN=$(aws sts get-caller-identity --query Arn --output text)
echo "  ✅ AWS Credentials Valid"
echo "     Account: $ACCOUNT"
echo "     Identity: $ARN"
echo ""

# Step 2: Navigate to environment directory
echo "Step 2: Navigating to Environment Directory"
cd "$(dirname "$0")/landing-zone/environments/dev" || exit 1
echo "  ✅ Current directory: $(pwd)"
echo ""

# Step 3: Initialize Terraform
echo "Step 3: Initializing Terraform"
terraform init
echo "  ✅ Terraform Initialized"
echo ""

# Step 4: Validate configuration
echo "Step 4: Validating Configuration"
terraform validate
echo "  ✅ Configuration Valid"
echo ""

# Step 5: Generate plan
echo "Step 5: Generating Deployment Plan"
terraform plan -out=tfplan
echo "  ✅ Plan Generated (saved to tfplan)"
echo ""

# Step 6: Show summary and ask for confirmation
echo "======================================"
echo "REVIEW THE PLAN ABOVE CAREFULLY"
echo "======================================"
echo ""
echo "This plan will:"
echo "  • Create 1 AWS Organization"
echo "  • Create 4 Organizational Units (Healthcare, Fintech, Gov-Federal, Standard)"
echo "  • Create 4 Customer AWS Accounts"
echo "  • Attach tier-specific security policies"
echo "  • Set up centralized logging"
echo "  • Enable compliance monitoring"
echo ""
echo "Cost: AWS Organizations is free. Other services (~$180/month for management account)"
echo ""
read -p "Do you want to proceed with terraform apply? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Deployment cancelled."
  exit 0
fi

echo ""
echo "Step 6: Applying Configuration (this may take 5-10 minutes)"
terraform apply tfplan
echo "  ✅ Infrastructure Deployed!"
echo ""

# Step 7: Show outputs
echo "======================================"
echo "DEPLOYMENT COMPLETE!"
echo "======================================"
echo ""
echo "Your outputs:"
terraform output
echo ""
echo "Next Steps:"
echo "  1. Review the organization in AWS Console"
echo "  2. Set up IAM Identity Center for customer access"
echo "  3. Start building the backend API (see docs/PAAS_ARCHITECTURE.md)"
echo ""
echo "✅ SecureBase PaaS is now live!"
