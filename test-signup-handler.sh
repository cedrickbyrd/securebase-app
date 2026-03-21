#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ENVIRONMENT="${1:-dev}"
AWS_REGION="${2:-us-east-1}"
TEST_EMAIL="test-$(date +%s)@example.com"

echo -e "${GREEN}Testing signup handler...${NC}\n"

# Auto-detect API endpoint
API_ID=$(aws apigatewayv2 get-apis \
    --region "$AWS_REGION" \
    --query "Items[?Name=='securebase-${ENVIRONMENT}-api'].ApiId" \
    --output text 2>/dev/null)

if [ -n "$API_ID" ]; then
    API_ENDPOINT="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${ENVIRONMENT}"
    echo -e "${GREEN}API endpoint: ${API_ENDPOINT}${NC}\n"
else
    echo -e "${RED}Error: Could not find API endpoint${NC}"
    exit 1
fi

SIGNUP_URL="${API_ENDPOINT}/signup"

echo -e "${YELLOW}Test 1: Successful signup${NC}"
RESPONSE=$(curl -s -X POST "$SIGNUP_URL" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}" \
    -d "{
        \"firstName\": \"Test\",
        \"lastName\": \"User\",
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"SecurePass123!\",
        \"orgName\": \"Test Org\",
        \"orgSize\": \"1-10\",
        \"industry\": \"technology\",
        \"awsRegion\": \"us-east-1\"
    }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓ PASS - Account created (201)${NC}"
else
    echo -e "${RED}✗ FAIL - Expected 201, got $HTTP_CODE${NC}"
fi

echo -e "\n${YELLOW}Test 2: Duplicate email${NC}"
RESPONSE=$(curl -s -X POST "$SIGNUP_URL" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}" \
    -d "{
        \"firstName\": \"Test2\",
        \"lastName\": \"User2\",
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"DifferentPass123!\",
        \"orgName\": \"Test Org 2\",
        \"orgSize\": \"11-50\",
        \"industry\": \"finance\",
        \"awsRegion\": \"us-west-2\"
    }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "409" ]; then
    echo -e "${GREEN}✓ PASS - Correctly rejected duplicate (409)${NC}"
else
    echo -e "${RED}✗ FAIL - Expected 409, got $HTTP_CODE${NC}"
fi

echo -e "\n${GREEN}Tests complete!${NC}"
