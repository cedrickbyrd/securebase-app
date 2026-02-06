#!/bin/bash
# Test SecureBase Demo Backend API
# Usage: ./test_api.sh <api_endpoint>

set -e

API_ENDPOINT=${1:-""}

if [ -z "$API_ENDPOINT" ]; then
    echo "Usage: $0 <api_endpoint>"
    echo "Example: $0 https://abc123.execute-api.us-east-1.amazonaws.com/demo"
    exit 1
fi

echo "Testing SecureBase Demo Backend API"
echo "Endpoint: $API_ENDPOINT"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local path=$3
    local data=$4
    local headers=$5
    local expected_status=$6
    
    echo -n "Testing $name... "
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_ENDPOINT$path" \
            -H "Content-Type: application/json" \
            $headers \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_ENDPOINT$path" $headers)
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $status_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        if [ -n "$body" ]; then
            echo "$body" | jq -C '.' 2>/dev/null || echo "$body"
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $status_code)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "$body"
    fi
    echo ""
}

echo "=========================================="
echo "1. Health Check"
echo "=========================================="
test_endpoint "Health Check" "GET" "/health" "" "" "200"

echo "=========================================="
echo "2. Authentication"
echo "=========================================="

# Test login with valid credentials
test_endpoint "Login (HealthCorp)" "POST" "/auth" \
    '{"action":"login","email":"admin@healthcorp.example.com","password":"demo-healthcare-2026"}' \
    "" "200"

# Extract token
TOKEN=$(curl -s -X POST "$API_ENDPOINT/auth" \
    -H "Content-Type: application/json" \
    -d '{"action":"login","email":"admin@healthcorp.example.com","password":"demo-healthcare-2026"}' \
    | jq -r '.token')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ Got JWT token${NC}"
    echo "Token: ${TOKEN:0:50}..."
else
    echo -e "${RED}✗ Failed to get token${NC}"
    exit 1
fi
echo ""

# Test invalid login
test_endpoint "Login (Invalid Credentials)" "POST" "/auth" \
    '{"action":"login","email":"admin@healthcorp.example.com","password":"wrong-password"}' \
    "" "401"

echo "=========================================="
echo "3. Customers API"
echo "=========================================="

# Test without auth
test_endpoint "Get Customers (No Auth)" "GET" "/customers" \
    "" "" "401"

# Test with auth
test_endpoint "Get Customers (With Auth)" "GET" "/customers" \
    "" "-H 'Authorization: Bearer $TOKEN'" "200"

# Test single customer
test_endpoint "Get Single Customer" "GET" "/customers/demo-customer-001" \
    "" "-H 'Authorization: Bearer $TOKEN'" "200"

# Test non-existent customer
test_endpoint "Get Non-existent Customer" "GET" "/customers/invalid-id" \
    "" "-H 'Authorization: Bearer $TOKEN'" "404"

echo "=========================================="
echo "4. Invoices API"
echo "=========================================="

# Test all invoices
test_endpoint "Get All Invoices" "GET" "/invoices" \
    "" "-H 'Authorization: Bearer $TOKEN'" "200"

# Test filtered invoices
test_endpoint "Get Customer Invoices" "GET" "/invoices?customer_id=demo-customer-001" \
    "" "-H 'Authorization: Bearer $TOKEN'" "200"

# Test single invoice
test_endpoint "Get Single Invoice" "GET" "/invoices/inv_2026_02_demo-customer-001" \
    "" "-H 'Authorization: Bearer $TOKEN'" "200"

echo "=========================================="
echo "5. Metrics API"
echo "=========================================="

test_endpoint "Get Metrics" "GET" "/metrics" \
    "" "-H 'Authorization: Bearer $TOKEN'" "200"

echo "=========================================="
echo "6. CORS Preflight"
echo "=========================================="

test_endpoint "OPTIONS /auth" "OPTIONS" "/auth" "" "" "200"
test_endpoint "OPTIONS /customers" "OPTIONS" "/customers" "" "" "200"

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    exit 1
fi
