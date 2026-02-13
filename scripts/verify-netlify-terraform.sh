#!/bin/bash
# Verify Netlify sites are properly managed by Terraform

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Verifying Netlify Terraform State..."
echo ""

cd "$(dirname "$0")/../landing-zone/environments/dev"

# Check state
echo "1️⃣  Checking Terraform state..."
RESOURCES=$(terraform state list | grep netlify | wc -l)

if [ "$RESOURCES" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $RESOURCES Netlify resources in state${NC}"
    terraform state list | grep netlify
else
    echo -e "${RED}❌ No Netlify resources found in state${NC}"
    exit 1
fi

echo ""
echo "2️⃣  Running terraform plan..."
terraform plan -target=module.netlify_sites

echo ""
echo -e "${GREEN}✅ Verification complete${NC}"
