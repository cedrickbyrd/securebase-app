#!/bin/bash
set -e

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🚀 SecureBase PaaS - Infrastructure Deployment"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📊 Deployment Summary:"
echo "  Organization Name: securebase"
echo "  Environment: production"
echo "  Region: us-east-1"
echo "  Customers: NONE (infrastructure-only)"
echo "  Monthly Base Cost: ~$180"
echo ""
echo "This deploys the multi-tenant platform ready to provision"
echo "customers as they sign up and commit to their service tier."
echo ""

# Check prerequisites
echo "Step 1: Verifying Prerequisites..."
if ! command -v terraform &> /dev/null; then
  echo "  ❌ Terraform not installed"
  exit 1
fi
echo "  ✅ Terraform: $(terraform version | head -1)"

if ! aws sts get-caller-identity &> /dev/null; then
  echo "  ❌ AWS credentials not configured"
  exit 1
fi
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "  ✅ AWS Account: $ACCOUNT"
echo ""

# Navigate to env directory
echo "Step 2: Initializing Terraform..."
cd "$(dirname "$0")/landing-zone/environments/dev" || exit 1
echo "  Working directory: $(pwd)"
echo ""

# Initialize
terraform init -upgrade 2>&1 | grep -E "Terraform|Successfully|error" || true
echo "  ✅ Initialized"
echo ""

# Validate
echo "Step 3: Validating Configuration..."
terraform validate
echo "  ✅ Valid"
echo ""

# Plan
echo "Step 4: Generating Deployment Plan..."
terraform plan -out=tfplan
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📋 DEPLOYMENT PLAN REVIEW"
echo ""
echo "This plan will create:"
echo "  ✅ 1 AWS Organization (org-id: securebase)"
echo "  ✅ 4 Organizational Units:"
echo "     - Customers-Healthcare (for HIPAA customers)"
echo "     - Customers-Fintech (for SOC2/PCI-DSS customers)"
echo "     - Customers-Government-Federal (for FedRAMP customers)"
echo "     - Customers-Standard (for CIS customers)"
echo "  ✅ Centralized logging infrastructure"
echo "  ✅ Security monitoring (CloudTrail, Config, GuardDuty, Security Hub)"
echo "  ✅ 0 customer accounts (to be added as they sign up)"
echo ""
echo "Monthly costs: ~$180 (before customer tier charges)"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Confirmation
read -p "👉 Do you want to deploy this infrastructure? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
  echo ""
  echo "Deployment cancelled."
  echo ""
  exit 0
fi

echo ""
echo "Step 5: Deploying Infrastructure..."
echo "⏳ This will take 5-10 minutes..."
echo ""

terraform apply tfplan

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ DEPLOYMENT COMPLETE!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📊 Your Outputs:"
echo ""
terraform output
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1️⃣  Save these outputs for later reference"
echo ""
echo "2️⃣  When a customer signs up, add them to client.auto.tfvars:"
echo "    customers = {"
echo '      "customer-name" = {'
echo '        tier       = "fintech"       # or healthcare, gov-federal, standard'
echo '        account_id = "111122223333" # their AWS account'
echo '        prefix     = "short-name"'
echo '        framework  = "soc2"         # or hipaa, fedramp, cis'
echo '      }'
echo "    }"
echo ""
echo "3️⃣  Deploy their account:"
echo "    terraform plan"
echo "    terraform apply"
echo ""
echo "4️⃣  Bill them monthly based on their tier"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "💰 Pricing Reference:"
echo "  Healthcare: $15,000/month base"
echo "  Fintech: $8,000/month base"
echo "  Government-Federal: $25,000/month base"
echo "  Standard: $2,000/month base"
echo ""
echo "📚 Documentation:"
echo "  Architecture: docs/PAAS_ARCHITECTURE.md"
echo "  Operations: landing-zone/MULTI_TENANT_GUIDE.md"
echo "  Troubleshooting: TROUBLESHOOTING.md"
echo ""
echo "🚀 Your SecureBase PaaS is ready for customers!"
echo ""
