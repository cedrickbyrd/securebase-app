#!/bin/bash
# Quick E2E Test Script
# Tests the complete SecureBase stack without full deployment

set -e

echo "🧪 SecureBase E2E Test Suite"
echo "=============================="
echo ""

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Please install Terraform first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Test 1: Terraform validation
echo "📋 Test 1: Validating Terraform configuration..."
cd /workspaces/securebase-app/landing-zone
terraform init -backend=false > /dev/null 2>&1
if terraform validate; then
    echo "✅ Terraform configuration is valid"
else
    echo "❌ Terraform validation failed"
    exit 1
fi
echo ""

# Test 2: Check Lambda packages
echo "📦 Test 2: Checking Lambda function source files..."
FUNCTIONS=(
    "/workspaces/securebase-app/phase2-backend/functions/auth_v2.py"
    "/workspaces/securebase-app/phase2-backend/functions/webhook_manager.py"
    "/workspaces/securebase-app/phase2-backend/functions/billing-worker.py"
    "/workspaces/securebase-app/phase2-backend/functions/support_tickets.py"
    "/workspaces/securebase-app/phase2-backend/functions/cost_forecasting.py"
)

for func in "${FUNCTIONS[@]}"; do
    if [ -f "$func" ]; then
        echo "  ✅ $(basename $func)"
    else
        echo "  ❌ Missing: $(basename $func)"
        exit 1
    fi
done
echo ""

# Test 3: Check React portal
echo "⚛️  Test 3: Checking React portal configuration..."
cd /workspaces/securebase-app/phase3a-portal

if [ -f "package.json" ]; then
    echo "  ✅ package.json found"
else
    echo "  ❌ package.json missing"
    exit 1
fi

if [ -f "vite.config.js" ]; then
    echo "  ✅ vite.config.js found"
else
    echo "  ❌ vite.config.js missing"
    exit 1
fi

# Count React components
COMPONENT_COUNT=$(find src/components -name "*.jsx" 2>/dev/null | wc -l)
echo "  ✅ Found $COMPONENT_COUNT React components"
echo ""

# Test 4: Check API Gateway module
echo "🌐 Test 4: Checking API Gateway module..."
if [ -f "/workspaces/securebase-app/landing-zone/modules/api-gateway/main.tf" ]; then
    echo "  ✅ API Gateway module found"
else
    echo "  ❌ API Gateway module missing"
    exit 1
fi
echo ""

# Test 5: Check marketing site
echo "📄 Test 5: Checking marketing site..."
if [ -f "/workspaces/securebase-app/marketing/pilot-program.html" ]; then
    echo "  ✅ Pilot program landing page found"
else
    echo "  ❌ Marketing site missing"
    exit 1
fi
echo ""

# Summary
echo "=============================="
echo "🎉 All Tests Passed!"
echo "=============================="
echo ""
echo "Ready for deployment:"
echo "1. Package Lambda functions:"
echo "   bash scripts/deploy-e2e.sh"
echo ""
echo "2. Or deploy manually:"
echo "   cd landing-zone"
echo "   terraform init"
echo "   terraform plan"
echo "   terraform apply"
echo ""
