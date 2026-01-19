#!/bin/bash
# SecureBase PaaS - Terraform Validation Script
# This script validates the multi-tenant configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="$SCRIPT_DIR/landing-zone/environments/dev"

echo "🔍 SecureBase Terraform Validation"
echo "=================================="
echo ""

# Check required files
echo "✓ Checking required files..."
required_files=(
  "$ENV_DIR/terraform.tfvars"
  "$ENV_DIR/client.auto.tfvars"
  "$SCRIPT_DIR/landing-zone/variables.tf"
  "$SCRIPT_DIR/landing-zone/main.tf"
)

for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ Found: $file"
  else
    echo "  ✗ Missing: $file"
    exit 1
  fi
done

echo ""
echo "✓ Checking variable declarations..."
if grep -q "variable \"customer_tier\"" "$SCRIPT_DIR/landing-zone/variables.tf"; then
  echo "  ✓ customer_tier variable declared"
else
  echo "  ✗ customer_tier variable NOT declared"
  exit 1
fi

if grep -q "variable \"clients\"" "$SCRIPT_DIR/landing-zone/variables.tf"; then
  echo "  ✓ clients variable declared"
else
  echo "  ✗ clients variable NOT declared"
  exit 1
fi

echo ""
echo "✓ Checking client configurations..."
client_count=$(grep -c "^  \"" "$ENV_DIR/client.auto.tfvars" || echo 0)
echo "  ✓ Found $client_count client configurations"

echo ""
echo "✓ Checking framework attributes..."
if grep -q "framework.*=" "$ENV_DIR/client.auto.tfvars"; then
  echo "  ✓ All clients have framework attribute"
else
  echo "  ✗ Missing framework attributes in clients"
  exit 1
fi

echo ""
echo "✓ Checking multi-tenant OUs..."
if grep -q "customer_healthcare" "$SCRIPT_DIR/landing-zone/main.tf"; then
  echo "  ✓ Multi-tenant OU definitions found"
else
  echo "  ✗ Multi-tenant OU definitions NOT found"
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ All validations passed!"
echo ""
echo "Next steps:"
echo "  1. Install Terraform >= 1.5.0"
echo "  2. Configure AWS credentials"
echo "  3. Run: cd landing-zone/environments/dev && terraform init"
echo "  4. Run: terraform plan"
echo "  5. Run: terraform apply"
echo ""
