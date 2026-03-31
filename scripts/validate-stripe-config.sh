#!/bin/bash

# Stripe Configuration Validation Script
# Checks if all required Stripe environment variables are properly configured

set -e

echo "=================================================="
echo "  SecureBase Stripe Configuration Validator"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

errors=0
warnings=0

# Function to check if a variable is set in a file
check_env_var() {
    local file=$1
    local var_name=$2
    local var_pattern=$3
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ File not found: $file${NC}"
        ((errors++))
        return 1
    fi
    
    if grep -q "^$var_name=$var_pattern" "$file"; then
        echo -e "${GREEN}✅ $var_name is set in $file${NC}"
        return 0
    else
        echo -e "${RED}❌ $var_name is NOT set or invalid in $file${NC}"
        ((errors++))
        return 1
    fi
}

# Function to check if a variable exists (even if empty)
check_env_var_exists() {
    local file=$1
    local var_name=$2
    
    if [ ! -f "$file" ]; then
        echo -e "${YELLOW}⚠️  File not found: $file${NC}"
        ((warnings++))
        return 1
    fi
    
    if grep -q "^$var_name=" "$file"; then
        echo -e "${GREEN}✅ $var_name exists in $file${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  $var_name not found in $file${NC}"
        ((warnings++))
        return 1
    fi
}

echo "=== Frontend Configuration Check ==="
echo ""

# Check root .env
echo "Checking root .env file..."
check_env_var ".env" "VITE_STRIPE_PUBLIC_KEY" "pk_"
echo ""

# Check phase3a-portal/.env.production
echo "Checking phase3a-portal/.env.production..."
check_env_var "phase3a-portal/.env.production" "VITE_STRIPE_PUBLIC_KEY" "pk_"
echo ""

# Check if keys are placeholder values
echo "Checking for placeholder values..."
if grep -q "VITE_STRIPE_PUBLIC_KEY=pk_.*YOUR.*KEY" .env 2>/dev/null; then
    echo -e "${RED}❌ .env contains placeholder Stripe key (YOUR_KEY_HERE)${NC}"
    echo -e "   Please replace with actual Stripe key from https://dashboard.stripe.com/apikeys"
    ((errors++))
fi

if grep -q "VITE_STRIPE_PUBLIC_KEY=pk_.*YOUR.*KEY" phase3a-portal/.env.production 2>/dev/null; then
    echo -e "${RED}❌ .env.production contains placeholder Stripe key (YOUR_KEY_HERE)${NC}"
    echo -e "   Please replace with actual Stripe key from https://dashboard.stripe.com/apikeys"
    ((errors++))
fi
echo ""

# Check live-config.js
echo "Checking phase3a-portal/src/config/live-config.js..."
if grep -q "pk_live_YOUR_KEY_HERE" phase3a-portal/src/config/live-config.js 2>/dev/null; then
    echo -e "${YELLOW}⚠️  live-config.js still has placeholder key (will use env var as fallback)${NC}"
    ((warnings++))
else
    echo -e "${GREEN}✅ live-config.js is configured to use environment variables${NC}"
fi
echo ""

echo "=== Backend Configuration Check ==="
echo ""

echo "Checking backend Lambda configuration..."
echo "Note: This script cannot check Lambda environment variables."
echo "Please verify manually in AWS Console or with AWS CLI:"
echo ""
echo "  aws lambda get-function-configuration \\"
echo "    --function-name securebase-dev-checkout \\"
echo "    --query 'Environment.Variables' --output json"
echo ""
echo "Required Lambda environment variables:"
echo "  - STRIPE_SECRET_KEY"
echo "  - STRIPE_PRICE_STANDARD"
echo "  - STRIPE_PRICE_FINTECH"
echo "  - STRIPE_PRICE_HEALTHCARE"
echo "  - STRIPE_PRICE_GOVERNMENT"
echo "  - STRIPE_PILOT_COUPON (optional)"
echo "  - STRIPE_WEBHOOK_SECRET"
echo "  - PORTAL_URL"
echo "  - RATE_LIMIT_TABLE"
echo ""

echo "=== Code Quality Checks ==="
echo ""

# Check if create_checkout_session.py has improved error handling
if grep -q "stripe.error.AuthenticationError" phase2-backend/functions/create_checkout_session.py; then
    echo -e "${GREEN}✅ Enhanced Stripe error handling is present${NC}"
else
    echo -e "${YELLOW}⚠️  Enhanced Stripe error handling not found${NC}"
    ((warnings++))
fi
echo ""

# Check if validation is present
if grep -q "if not stripe.api_key:" phase2-backend/functions/create_checkout_session.py; then
    echo -e "${GREEN}✅ Stripe API key validation is present${NC}"
else
    echo -e "${YELLOW}⚠️  Stripe API key validation not found${NC}"
    ((warnings++))
fi
echo ""

echo "=== Summary ==="
echo ""
echo -e "Errors: ${RED}$errors${NC}"
echo -e "Warnings: ${YELLOW}$warnings${NC}"
echo ""

if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Stripe integration should work correctly.${NC}"
    exit 0
elif [ $errors -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration has warnings. Review and fix before production deployment.${NC}"
    exit 0
else
    echo -e "${RED}❌ Configuration has errors. Signup will NOT work until fixed.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Add VITE_STRIPE_PUBLIC_KEY to .env and .env.production files"
    echo "2. Get your Stripe key from: https://dashboard.stripe.com/apikeys"
    echo "3. Use pk_test_... for development/staging"
    echo "4. Use pk_live_... for production"
    echo "5. Re-run this script to verify"
    echo ""
    echo "See docs/STRIPE_TROUBLESHOOTING.md for detailed instructions."
    exit 1
fi
