#!/bin/bash
# test-demo-live.sh
# Smoke tests for live demo deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEMO_URL="${DEMO_URL:-http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com}"
TIMEOUT=10
MAX_LOAD_TIME=5000  # milliseconds

echo "======================================"
echo "Live Demo Smoke Test Suite"
echo "======================================"
echo ""
echo "Testing: $DEMO_URL"
echo ""

# Track test results
PASSED=0
FAILED=0

# Helper function for test results
test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: $2"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC}: $2"
    ((FAILED++))
  fi
}

# Test 1: HTTP Status Check
echo "Test 1: HTTP Status Check"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DEMO_URL" 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" -eq 200 ]; then
  test_result 0 "Demo URL is accessible (HTTP $HTTP_STATUS)"
else
  test_result 1 "Demo URL returned HTTP $HTTP_STATUS"
fi
echo ""

# Test 2: Content Verification
echo "Test 2: HTML Content Verification"
CONTENT=$(curl -s --max-time $TIMEOUT "$DEMO_URL" 2>/dev/null || echo "")

# Check for DOCTYPE
if echo "$CONTENT" | grep -q "<!DOCTYPE html>"; then
  test_result 0 "HTML has proper DOCTYPE (not in quirks mode)"
else
  test_result 1 "HTML missing DOCTYPE declaration"
fi

# Check for SecureBase branding
if echo "$CONTENT" | grep -qi "SecureBase"; then
  test_result 0 "Page contains SecureBase branding"
else
  test_result 1 "Page missing SecureBase branding"
fi

# Check for root div
if echo "$CONTENT" | grep -q 'id="root"'; then
  test_result 0 "React root element present"
else
  test_result 1 "React root element missing"
fi

# Check for mock-api.js reference
if echo "$CONTENT" | grep -q 'mock-api.js'; then
  test_result 0 "Mock API script referenced in HTML"
else
  test_result 1 "Mock API script reference missing"
fi
echo ""

# Test 3: Mock API Accessibility
echo "Test 3: Mock API Accessibility"
MOCK_API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DEMO_URL/mock-api.js" 2>/dev/null || echo "000")
if [ "$MOCK_API_STATUS" -eq 200 ]; then
  test_result 0 "Mock API file is accessible (HTTP $MOCK_API_STATUS)"
  
  # Check mock-api.js content
  MOCK_API_CONTENT=$(curl -s --max-time $TIMEOUT "$DEMO_URL/mock-api.js" 2>/dev/null || echo "")
  if echo "$MOCK_API_CONTENT" | grep -q "MOCK API LOADED"; then
    test_result 0 "Mock API contains expected code"
  else
    test_result 1 "Mock API file is empty or corrupted"
  fi
else
  test_result 1 "Mock API file not accessible (HTTP $MOCK_API_STATUS)"
fi
echo ""

# Test 4: Demo Data Accessibility
echo "Test 4: Demo Data Accessibility"
DEMO_DATA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DEMO_URL/demo-data.json" 2>/dev/null || echo "000")
if [ "$DEMO_DATA_STATUS" -eq 200 ]; then
  test_result 0 "Demo data file is accessible (HTTP $DEMO_DATA_STATUS)"
  
  # Verify it's valid JSON
  DEMO_DATA=$(curl -s --max-time $TIMEOUT "$DEMO_URL/demo-data.json" 2>/dev/null || echo "")
  if echo "$DEMO_DATA" | python3 -m json.tool > /dev/null 2>&1; then
    test_result 0 "Demo data is valid JSON"
    
    # Check for customers array
    if echo "$DEMO_DATA" | grep -q '"customers"'; then
      test_result 0 "Demo data contains customer records"
    else
      test_result 1 "Demo data missing customer records"
    fi
  else
    test_result 1 "Demo data is not valid JSON"
  fi
else
  test_result 1 "Demo data file not accessible (HTTP $DEMO_DATA_STATUS)"
fi
echo ""

# Test 5: Static Assets
echo "Test 5: Static Assets Check"

# Check for JavaScript bundle
JS_ASSETS=$(echo "$CONTENT" | grep -oP 'src="/assets/[^"]+\.js"' | wc -l)
if [ "$JS_ASSETS" -gt 0 ]; then
  test_result 0 "JavaScript bundles referenced ($JS_ASSETS found)"
else
  test_result 1 "No JavaScript bundles found"
fi

# Check for CSS bundle
CSS_ASSETS=$(echo "$CONTENT" | grep -oP 'href="/assets/[^"]+\.css"' | wc -l)
if [ "$CSS_ASSETS" -gt 0 ]; then
  test_result 0 "CSS bundles referenced ($CSS_ASSETS found)"
else
  test_result 1 "No CSS bundles found"
fi
echo ""

# Test 6: Performance Check
echo "Test 6: Performance Check"
# Measure time to first byte
START_TIME=$(date +%s%N)
curl -s -o /dev/null --max-time $TIMEOUT "$DEMO_URL" 2>/dev/null
END_TIME=$(date +%s%N)
LOAD_TIME=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to milliseconds

if [ "$LOAD_TIME" -lt "$MAX_LOAD_TIME" ]; then
  test_result 0 "Page loads in acceptable time (${LOAD_TIME}ms < ${MAX_LOAD_TIME}ms)"
else
  test_result 1 "Page load time is slow (${LOAD_TIME}ms > ${MAX_LOAD_TIME}ms)"
fi
echo ""

# Test 7: Security Headers (Optional)
echo "Test 7: Security Headers"
HEADERS=$(curl -s -I --max-time $TIMEOUT "$DEMO_URL" 2>/dev/null || echo "")

# Check Cache-Control for HTML
if echo "$HEADERS" | grep -qi "cache-control"; then
  CACHE_CONTROL=$(echo "$HEADERS" | grep -i "cache-control" | head -1)
  test_result 0 "Cache-Control header present: $CACHE_CONTROL"
else
  test_result 1 "Cache-Control header missing"
fi
echo ""

# Test 8: Connectivity Test
echo "Test 8: Connectivity & Availability"
# Ping the URL multiple times to check consistency
CONSECUTIVE_PASSES=0
for i in {1..3}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$DEMO_URL" 2>/dev/null || echo "000")
  if [ "$STATUS" -eq 200 ]; then
    ((CONSECUTIVE_PASSES++))
  fi
  sleep 1
done

if [ "$CONSECUTIVE_PASSES" -eq 3 ]; then
  test_result 0 "Demo is consistently available (3/3 checks passed)"
elif [ "$CONSECUTIVE_PASSES" -gt 0 ]; then
  test_result 1 "Demo availability is inconsistent ($CONSECUTIVE_PASSES/3 checks passed)"
else
  test_result 1 "Demo is not available (0/3 checks passed)"
fi
echo ""

# Summary
echo "======================================"
echo "Test Results Summary"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All smoke tests passed!${NC}"
  echo ""
  echo "Demo is ready for use:"
  echo "  URL: $DEMO_URL"
  echo "  Credentials: demo/demo"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
  echo ""
  exit 1
fi
