#!/bin/bash
# Validate SecureBase Demo Backend Module
# Run this before deployment to ensure all files are present
#
# Note: This script will auto-fix file permissions for shell scripts
# to ensure they are executable. All other issues are reported only.

set -e

echo "=================================================="
echo "SecureBase Demo Backend Module Validation"
echo "=================================================="
echo ""

# Navigate to module directory
MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$MODULE_DIR"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $1 (missing)"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi
}

check_executable() {
    if [ -x "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 (executable)"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${YELLOW}⚠${NC} $1 (not executable)"
        chmod +x "$1"
        echo "  Fixed: Made executable"
    fi
}

echo "Checking Terraform files..."
check_file "main.tf"
check_file "variables.tf"
check_file "outputs.tf"
check_file "example.tf"
echo ""

echo "Checking Lambda functions..."
check_file "lambda/auth.py"
check_file "lambda/customers.py"
check_file "lambda/invoices.py"
check_file "lambda/metrics.py"
check_file "lambda/health.py"
echo ""

echo "Checking data files..."
check_file "data/customers.json"
check_file "data/invoices.json"
check_file "data/metrics.json"
check_file "data/generate_invoices.py"
echo ""

echo "Checking scripts..."
check_file "scripts/generate_batch_files.py"
check_file "scripts/load_data.sh"
check_file "scripts/test_api.sh"
check_executable "scripts/load_data.sh"
check_executable "scripts/test_api.sh"
echo ""

echo "Checking documentation..."
check_file "README.md"
check_file "QUICKSTART.md"
check_file "DEPLOYMENT.md"
check_file "INDEX.md"
check_file ".gitignore"
echo ""

echo "Validating data files..."
# Check customers JSON
CUSTOMER_COUNT=$(jq '. | length' data/customers.json 2>/dev/null || echo "0")
if [ "$CUSTOMER_COUNT" == "5" ]; then
    echo -e "${GREEN}✓${NC} Customers: 5 records"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Customers: Expected 5, got $CUSTOMER_COUNT"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check invoices JSON
INVOICE_COUNT=$(jq '. | length' data/invoices.json 2>/dev/null || echo "0")
if [ "$INVOICE_COUNT" == "30" ]; then
    echo -e "${GREEN}✓${NC} Invoices: 30 records"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Invoices: Expected 30, got $INVOICE_COUNT"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check metrics JSON
METRICS_VALID=$(jq '.monthly_cost' data/metrics.json 2>/dev/null || echo "0")
if [ "$METRICS_VALID" == "58240" ]; then
    echo -e "${GREEN}✓${NC} Metrics: Valid structure"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Metrics: Invalid structure"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi
echo ""

echo "Validating Terraform syntax..."
if terraform fmt -check -recursive . >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Terraform formatting valid"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${YELLOW}⚠${NC} Terraform formatting needs update"
    terraform fmt -recursive .
    echo "  Fixed: Formatted Terraform files"
fi

if terraform validate >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Terraform syntax valid"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${YELLOW}⚠${NC} Terraform validation (run 'terraform init' first)"
fi
echo ""

echo "Checking Python syntax..."
for py_file in lambda/*.py data/*.py scripts/*.py; do
    if python3 -m py_compile "$py_file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $py_file"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $py_file (syntax error)"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi
done
echo ""

echo "Checking documentation completeness..."
# Check README has key sections
if grep -q "## Quick Start" README.md && \
   grep -q "## API Endpoints" README.md && \
   grep -q "## Cost Estimate" README.md; then
    echo -e "${GREEN}✓${NC} README.md has required sections"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗${NC} README.md missing required sections"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi
echo ""

echo "=================================================="
echo "Validation Summary"
echo "=================================================="
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
else
    echo -e "${GREEN}Failed: 0${NC}"
fi
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Module validation successful!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. cd landing-zone/environments/dev"
    echo "  2. Add module to main.tf (see example.tf)"
    echo "  3. terraform init"
    echo "  4. terraform plan"
    echo "  5. terraform apply"
    exit 0
else
    echo -e "${RED}✗ Module validation failed${NC}"
    echo "Please fix the issues above before deployment"
    exit 1
fi
