#!/bin/bash
# Fix stale Terraform cache

set -e

echo "🧹 Clearing Terraform cache and locks..."

# Navigate to landing zone
cd "$(dirname "$0")"

# Remove all Terraform cache/state files
rm -rf .terraform 2>/dev/null || true
rm -rf .terraform.lock.hcl 2>/dev/null || true
rm -rf environments/dev/.terraform 2>/dev/null || true
rm -rf environments/dev/.terraform.lock.hcl 2>/dev/null || true
rm -rf environments/dev/tfplan-*.out 2>/dev/null || true
rm -rf environments/dev/crash.log 2>/dev/null || true

echo "✅ Cache cleared"
echo ""
echo "Now run:"
echo "  cd landing-zone/environments/dev"
echo "  terraform init -upgrade"
echo "  terraform plan -lock=false -var-file=terraform.tfvars"
