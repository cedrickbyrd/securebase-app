#!/bin/bash

###############################################################################
# Signup Flow Pre-Launch Test Runner
# 
# Run this before ANY marketing campaign to verify signup flow works
###############################################################################

set -e

echo "🚀 SecureBase Signup Flow - Pre-Launch Test Suite"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to test directory
cd "$(dirname "$0")/../.."

echo "📍 Working directory: $(pwd)"
echo ""

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ ERROR: npx not found. Please install Node.js first.${NC}"
    exit 1
fi

echo "🔧 Checking Playwright installation..."
if ! npx playwright --version &> /dev/null; then
    echo -e "${YELLOW}⚠️  Playwright not found. Installing...${NC}"
    npm install -D @playwright/test
    npx playwright install
    echo -e "${GREEN}✅ Playwright installed${NC}"
else
    echo -e "${GREEN}✅ Playwright ready${NC}"
fi
echo ""

# Function to run tests with retry
run_tests() {
    local test_name=$1
    local test_pattern=$2
    local max_retries=2
    local attempt=1

    while [ $attempt -le $max_retries ]; do
        echo "🧪 Running: $test_name (attempt $attempt/$max_retries)"
        
        if npx playwright test tests/e2e/signup-flow.spec.js -g "$test_pattern" --reporter=line; then
            echo -e "${GREEN}✅ $test_name PASSED${NC}"
            echo ""
            return 0
        else
            if [ $attempt -eq $max_retries ]; then
                echo -e "${RED}❌ $test_name FAILED after $max_retries attempts${NC}"
                echo ""
                return 1
            fi
            echo -e "${YELLOW}⚠️  Retrying...${NC}"
            attempt=$((attempt + 1))
            sleep 2
        fi
    done
}

# Track failures
CRITICAL_FAILURES=0
EDGE_FAILURES=0

echo "═══════════════════════════════════════════════════"
echo "🎯 CRITICAL PATH TESTS (Must Pass to Launch)"
echo "═══════════════════════════════════════════════════"
echo ""

# Run critical tests
if ! run_tests "Demo CTA Validation" "CRITICAL: Demo CTA"; then
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
fi

if ! run_tests "Signup Page Load" "CRITICAL: Signup page loads"; then
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
fi

if ! run_tests "Form Fields Validation" "CRITICAL: Signup form has all"; then
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
fi

if ! run_tests "Pricing Logic" "CRITICAL: Tier selection updates|CRITICAL: Pilot checkbox"; then
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
fi

if ! run_tests "Form Validation" "CRITICAL: Form validation"; then
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
fi

if ! run_tests "API Submission" "CRITICAL: Successfully filled form"; then
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
fi

if ! run_tests "End-to-End Flow" "CRITICAL: Demo to Signup flow"; then
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
fi

echo "═══════════════════════════════════════════════════"
echo "🔍 EDGE CASES & ERROR HANDLING"
echo "═══════════════════════════════════════════════════"
echo ""

# Run edge case tests (non-blocking)
if ! run_tests "Rate Limiting" "BLOCKING: Rate limiting"; then
    EDGE_FAILURES=$((EDGE_FAILURES + 1))
fi

if ! run_tests "Special Characters" "EDGE CASE: Special characters"; then
    EDGE_FAILURES=$((EDGE_FAILURES + 1))
fi

if ! run_tests "Security Tests" "SECURITY: Form prevents"; then
    EDGE_FAILURES=$((EDGE_FAILURES + 1))
fi

echo "═══════════════════════════════════════════════════"
echo "📱 PERFORMANCE & MOBILE"
echo "═══════════════════════════════════════════════════"
echo ""

if ! run_tests "Performance Check" "PERFORMANCE: Signup page loads"; then
    EDGE_FAILURES=$((EDGE_FAILURES + 1))
fi

if ! run_tests "Mobile Responsiveness" "MOBILE: Signup form is responsive"; then
    EDGE_FAILURES=$((EDGE_FAILURES + 1))
fi

# Final results
echo ""
echo "═══════════════════════════════════════════════════"
echo "📊 TEST RESULTS SUMMARY"
echo "═══════════════════════════════════════════════════"
echo ""

if [ $CRITICAL_FAILURES -eq 0 ]; then
    echo -e "${GREEN}✅ CRITICAL TESTS: ALL PASSED (0 failures)${NC}"
else
    echo -e "${RED}❌ CRITICAL TESTS: $CRITICAL_FAILURES FAILED${NC}"
fi

if [ $EDGE_FAILURES -eq 0 ]; then
    echo -e "${GREEN}✅ EDGE CASE TESTS: ALL PASSED (0 failures)${NC}"
else
    echo -e "${YELLOW}⚠️  EDGE CASE TESTS: $EDGE_FAILURES FAILED${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "🎯 LAUNCH DECISION"
echo "═══════════════════════════════════════════════════"
echo ""

if [ $CRITICAL_FAILURES -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ GO FOR LAUNCH${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "🚀 Signup flow is working end-to-end"
    echo "✅ Safe to send marketing traffic"
    echo "✅ Demo CTA → Signup → Checkout verified"
    echo ""
    
    if [ $EDGE_FAILURES -gt 0 ]; then
        echo -e "${YELLOW}⚠️  WARNING: $EDGE_FAILURES edge case test(s) failed${NC}"
        echo "   → Safe to launch, but fix these within 24 hours"
        echo "   → Monitor error rates closely"
        echo ""
    fi
    
    echo "📋 Next Steps:"
    echo "   1. ✅ Start demo outreach campaign"
    echo "   2. ✅ Monitor conversion funnel"
    echo "   3. ✅ Track demo → signup → checkout rates"
    echo "   4. ✅ Set up alerts for API failures"
    echo ""
    
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ DO NOT LAUNCH${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "🚫 CRITICAL FAILURES DETECTED"
    echo "❌ Customer acquisition is BROKEN"
    echo "❌ DO NOT send marketing traffic"
    echo ""
    echo "🔧 Action Required:"
    echo "   1. Review failed test output above"
    echo "   2. Fix critical issues immediately"
    echo "   3. Re-run this script: ./test-signup-flow.sh"
    echo "   4. Only launch after ALL critical tests pass"
    echo ""
    echo "💰 Revenue Impact:"
    echo "   → 100% of demo visitors cannot convert"
    echo "   → Every marketing dollar is wasted"
    echo "   → Fix IMMEDIATELY before spending on ads"
    echo ""
    
    exit 1
fi
