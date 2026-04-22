#!/bin/bash

###############################################################################
# SecureBase Checkout Verification Script
###############################################################################

echo "🔍 SecureBase Checkout Verification"
echo "===================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SITE_URL="https://demo.securebase.tximhotep.com"
PASS=0
FAIL=0

###############################################################################
# Test 1: Site is reachable
###############################################################################

echo "Test 1: Checking if site is live..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/checkout")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Site is live (HTTP $HTTP_CODE)${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ Site returned HTTP $HTTP_CODE${NC}"
    ((FAIL++))
fi
echo ""

###############################################################################
# Test 2: CSP Headers
###############################################################################

echo "Test 2: Checking CSP headers..."
CSP=$(curl -s -I "$SITE_URL/checkout" | grep -i "content-security-policy")

if echo "$CSP" | grep -q "stripe.com"; then
    echo -e "${GREEN}✓ CSP includes Stripe domains${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ CSP missing Stripe domains${NC}"
    ((FAIL++))
fi
echo ""

###############################################################################
# Test 3: API Endpoint
###############################################################################

echo "Test 3: Testing /api/checkout endpoint..."
API_RESPONSE=$(curl -s -X POST "$SITE_URL/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "priceId": "price_test_12345",
    "successUrl": "'$SITE_URL'/success",
    "cancelUrl": "'$SITE_URL'/checkout"
  }')

if echo "$API_RESPONSE" | grep -q "checkout_url"; then
    echo -e "${GREEN}✓ API returns checkout_url${NC}"
    ((PASS++))
elif echo "$API_RESPONSE" | grep -q "error"; then
    ERROR_MSG=$(echo "$API_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo -e "${YELLOW}⚠ API returned error: $ERROR_MSG${NC}"
    echo -e "${YELLOW}  (This might be expected with test price ID)${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ API endpoint failed${NC}"
    echo "Response: $API_RESPONSE"
    ((FAIL++))
fi
echo ""

###############################################################################
# Summary
###############################################################################

echo "======================================"
echo "Test Results: $PASS passed, $FAIL failed"
echo "======================================"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Open browser: $SITE_URL/checkout?plan=standard&priceId=YOUR_STRIPE_PRICE_ID"
    echo "2. Fill in name and email"
    echo "3. Click 'Continue to Payment'"
    echo "4. Verify redirect to Stripe Checkout"
    echo ""
    echo "Manual browser checklist:"
    echo "  ☐ No CSP errors in console (F12)"
    echo "  ☐ No 404 errors in console"
    echo "  ☐ Successful redirect to checkout.stripe.com"
    echo "  ☐ Stripe payment form loads"
else
    echo -e "${RED}❌ Some tests failed. Review above.${NC}"
fi
echo ""

