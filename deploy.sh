#!/bin/bash
# SecureBase PaaS - Correct Deployment Script
# This script ensures you deploy from the right directory with fresh state

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="$SCRIPT_DIR/landing-zone/environments/dev"

echo "🚀 SecureBase PaaS - Deployment Script"
echo "======================================"
echo ""

# Step 1: Clean old state (if migrating from root)
echo "Step 1: Cleaning old state files (if any)..."
if [ -f "$SCRIPT_DIR/landing-zone/.terraform/terraform.tfstate" ]; then
  echo "  Found stale state in root directory, backing up..."
  mv "$SCRIPT_DIR/landing-zone/.terraform" "$SCRIPT_DIR/landing-zone/.terraform.backup.$(date +%s)"
fi
echo "  ✓ Cleaned"
echo ""

# Step 2: Navigate to environment directory
echo "Step 2: Changing to environment directory..."
cd "$ENV_DIR"
echo "  Current directory: $(pwd)"
echo "  ✓ Ready"
echo ""

# Step 3: Verify configuration files
echo "Step 3: Verifying configuration files..."
if [ ! -f "terraform.tfvars" ]; then
  echo "  ✗ ERROR: terraform.tfvars not found!"
  exit 1
fi
if [ ! -f "client.auto.tfvars" ]; then
  echo "  ✗ ERROR: client.auto.tfvars not found!"
  exit 1
fi
echo "  ✓ Both configuration files present"
echo ""

# Step 4: Initialize Terraform
echo "Step 4: Initializing Terraform..."
terraform init
echo "  ✓ Initialized"
echo ""

# Step 5: Validate configuration
echo "Step 5: Validating configuration..."
terraform validate
echo "  ✓ Configuration valid"
echo ""

# Step 6: Plan deployment
echo "Step 6: Planning deployment..."
terraform plan -out=tfplan
echo "  ✓ Plan generated"
echo ""

# Step 7: Review plan
echo "Step 7: Review the plan above carefully!"
echo "  Press ENTER to continue with deployment, or CTRL+C to cancel..."
read

# Step 8: Apply configuration
echo ""
echo "Step 8: Applying configuration..."
terraform apply tfplan
echo "  ✓ Applied"
echo ""

# Step 9: Display outputs
echo "Step 9: Deployment Complete! Here are your outputs:"
echo "======================================================"
terraform output
echo ""
echo "✅ SecureBase PaaS is now live!"
echo ""
echo "Next steps:"
echo "  1. Note the organization_id and client_account_ids"
echo "  2. Set up IAM Identity Center in the management account"
echo "  3. Configure customer access via permission sets"
echo "  4. Begin building the backend API (see docs/PAAS_ARCHITECTURE.md)"
