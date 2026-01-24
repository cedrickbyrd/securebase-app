#!/bin/bash
# Phase 4 Infrastructure Testing Script
# Tests all Phase 4 Terraform modules (Analytics, RBAC)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "Phase 4 Infrastructure Tests"
echo "================================"
echo ""

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    local working_dir=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${YELLOW}Running:${NC} $test_name"
    
    if [ -n "$working_dir" ]; then
        cd "$working_dir"
    fi
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS:${NC} $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL:${NC} $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    if [ -n "$working_dir" ]; then
        cd - > /dev/null
    fi
    echo ""
}

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$SCRIPT_DIR"

echo "Repository root: $REPO_ROOT"
echo ""

# Test 1: Analytics Module - Format Check (or skip if terraform not available)
echo "=== Analytics Module Tests ==="
if command -v terraform &> /dev/null; then
    run_test \
        "Analytics: Format Check" \
        "terraform fmt -check -recursive" \
        "$REPO_ROOT/landing-zone/modules/analytics"

    # Test 2: Analytics Module - Validate
    run_test \
        "Analytics: Init and Validate" \
        "terraform init -backend=false > /dev/null && terraform validate" \
        "$REPO_ROOT/landing-zone/modules/analytics/tests"

    # Test 3: Analytics Module - Plan (dry run)
    run_test \
        "Analytics: Plan Test" \
        "terraform plan -detailed-exitcode || [ \$? -eq 2 ]" \
        "$REPO_ROOT/landing-zone/modules/analytics/tests"
else
    echo -e "${YELLOW}⊘ SKIP:${NC} Terraform not installed, skipping Analytics module Terraform tests"
    echo ""
fi

echo ""
echo "=== RBAC Module Tests ==="

if command -v terraform &> /dev/null; then
    # Test 4: RBAC Module - Format Check
    run_test \
        "RBAC: Format Check" \
        "terraform fmt -check -recursive" \
        "$REPO_ROOT/landing-zone/modules/rbac"

    # Test 5: RBAC Module - Validate
    run_test \
        "RBAC: Init and Validate" \
        "terraform init -backend=false > /dev/null && terraform validate" \
        "$REPO_ROOT/landing-zone/modules/rbac/tests"

    # Test 6: RBAC Module - Plan (dry run)
    run_test \
        "RBAC: Plan Test" \
        "terraform plan -detailed-exitcode || [ \$? -eq 2 ]" \
        "$REPO_ROOT/landing-zone/modules/rbac/tests"
else
    echo -e "${YELLOW}⊘ SKIP:${NC} Terraform not installed, skipping RBAC module Terraform tests"
    echo ""
fi

echo ""
echo "=== Module Structure Tests ==="

# Test 7: Required files exist - Analytics
run_test \
    "Analytics: Required Files" \
    "test -f $REPO_ROOT/landing-zone/modules/analytics/variables.tf && \
     test -f $REPO_ROOT/landing-zone/modules/analytics/outputs.tf && \
     (test -f $REPO_ROOT/landing-zone/modules/analytics/main.tf || \
      test -f $REPO_ROOT/landing-zone/modules/analytics/dynamodb.tf)" \
    ""

# Test 8: Required files exist - RBAC
run_test \
    "RBAC: Required Files" \
    "test -f $REPO_ROOT/landing-zone/modules/rbac/main.tf && \
     test -f $REPO_ROOT/landing-zone/modules/rbac/variables.tf && \
     test -f $REPO_ROOT/landing-zone/modules/rbac/outputs.tf" \
    ""

# Test 9: Test files exist
run_test \
    "Test Infrastructure" \
    "test -f $REPO_ROOT/landing-zone/modules/analytics/tests/main.tf && \
     test -f $REPO_ROOT/landing-zone/modules/rbac/tests/main.tf" \
    ""

# Test 10: CI/CD workflow exists
run_test \
    "CI/CD Workflow" \
    "test -f $REPO_ROOT/.github/workflows/terraform-phase4.yml" \
    ""

echo ""
echo "================================"
echo "Test Summary"
echo "================================"
echo -e "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:${NC}       $PASSED_TESTS"
echo -e "${RED}Failed:${NC}       $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
