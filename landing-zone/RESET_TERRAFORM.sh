#!/bin/bash

# ============================================
# Reset Terraform State & Cache
# ============================================
# Use this when terraform shows stale errors

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🔄 Resetting Terraform..."
echo ""

# Remove cache files
echo "Clearing cache..."
rm -rf "$SCRIPT_DIR/.terraform" 2>/dev/null || true
rm -f "$SCRIPT_DIR/.terraform.lock.hcl" 2>/dev/null || true
rm -f "$SCRIPT_DIR/environments/dev/.terraform" 2>/dev/null || true
rm -f "$SCRIPT_DIR/environments/dev/.terraform.lock.hcl" 2>/dev/null || true
rm -f "$SCRIPT_DIR/environments/dev/tfplan-*.out" 2>/dev/null || true

echo "✅ Cache cleared"
echo ""

# Re-init
echo "Reinitializing Terraform..."
cd "$SCRIPT_DIR/environments/dev"
terraform init -upgrade -lock=false

echo ""
echo "✅ Terraform reset complete"
echo ""
echo "Next: terraform plan -lock=false"
