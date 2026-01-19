#!/bin/bash

# SecureBase Terraform Plan & Validate Commands
# Quick reference for testing and deploying

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          SecureBase Terraform Testing Guide               ║"
echo "╚════════════════════════════════════════════════════════════╝"

# ============================================
# 1. VALIDATE CONFIGURATION
# ============================================

echo ""
echo "📋 STEP 1: Validate Terraform Configuration"
echo "─────────────────────────────────────────────"

cd landing-zone

terraform fmt -check 2>/dev/null || {
  echo "⚠️  Format issues detected. Running auto-fix..."
  terraform fmt -recursive
}

terraform validate
echo "✅ Configuration is valid"

# ============================================
# 2. INITIALIZE BACKEND
# ============================================

echo ""
echo "🔧 STEP 2: Initialize Terraform Backend"
echo "─────────────────────────────────────────"

cd environments/dev

# Uncomment this line to enable S3 backend (requires bootstrap)
# terraform init -backend-config="bucket=securebase-tf-state-dev" -backend-config="key=orchestrator/terraform.tfstate" -backend-config="dynamodb_table=securebase-tf-lock"

# Use local backend for now (development only)
terraform init
echo "✅ Backend initialized"

# ============================================
# 3. PLAN INFRASTRUCTURE
# ============================================

echo ""
echo "📊 STEP 3: Generate Terraform Plan"
echo "──────────────────────────────────"

terraform plan -out=tfplan -lock=false

echo ""
echo "Plan saved to: tfplan"
echo ""

# Show plan summary
echo "📈 Plan Summary:"
terraform show tfplan -json | jq '.resource_changes | {
  "Created": [.[] | select(.change.actions==[\"create\"])] | length,
  "Updated": [.[] | select(.change.actions==[\"update\"])] | length,
  "Deleted": [.[] | select(.change.actions==[\"delete\"])] | length
}'

# ============================================
# 4. OPTIONAL: APPLY PLAN
# ============================================

echo ""
echo "🚀 STEP 4: Apply Infrastructure (OPTIONAL)"
echo "──────────────────────────────────────────"
echo ""
echo "To apply the plan, run:"
echo "  terraform apply tfplan"
echo ""
echo "To destroy resources (cleanup), run:"
echo "  terraform destroy"

