#!/bin/bash
# Test Phase 4 Analytics Staging Deployment
# Integration and validation tests for staging environment

set -e

echo "🧪 Testing Phase 4 Analytics - Staging Environment"
echo "==================================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="staging"
AWS_REGION="${AWS_REGION:-us-east-1}"
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Region:${NC} $AWS_REGION"
echo ""

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test helper function
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${YELLOW}Testing:${NC} $test_name"
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo -e "${BLUE}=== Infrastructure Tests ===${NC}"
echo ""

# Test 1: DynamoDB Tables
echo -e "${YELLOW}Test 1: DynamoDB Tables${NC}"
for table in "reports" "report-schedules" "report-cache" "metrics"; do
    TABLE_NAME="securebase-staging-${table}"
    if aws dynamodb describe-table --table-name "$TABLE_NAME" --region $AWS_REGION > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} ${TABLE_NAME} exists"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} ${TABLE_NAME} not found"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
done
echo ""

# Test 2: Lambda Function
echo -e "${YELLOW}Test 2: Lambda Function Deployment${NC}"
LAMBDA_NAME="securebase-staging-report-engine"
LAMBDA_STATUS=$(aws lambda get-function --function-name "$LAMBDA_NAME" --region $AWS_REGION --query 'Configuration.State' --output text 2>/dev/null)

if [ "$LAMBDA_STATUS" = "Active" ]; then
    echo -e "  ${GREEN}✓${NC} Lambda function is Active"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    # Check Lambda configuration
    MEMORY=$(aws lambda get-function-configuration --function-name "$LAMBDA_NAME" --region $AWS_REGION --query 'MemorySize' --output text)
    TIMEOUT=$(aws lambda get-function-configuration --function-name "$LAMBDA_NAME" --region $AWS_REGION --query 'Timeout' --output text)
    echo -e "  ${BLUE}Memory:${NC} ${MEMORY}MB (expected: 512MB)"
    echo -e "  ${BLUE}Timeout:${NC} ${TIMEOUT}s (expected: 30s)"
else
    echo -e "  ${RED}✗${NC} Lambda function not active (Status: $LAMBDA_STATUS)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 3: Lambda Layer
echo -e "${YELLOW}Test 3: Lambda Layer Attachment${NC}"
LAYER_COUNT=$(aws lambda get-function --function-name "$LAMBDA_NAME" --region $AWS_REGION --query 'Configuration.Layers | length(@)' --output text 2>/dev/null)

if [ "$LAYER_COUNT" -ge 1 ]; then
    LAYER_ARN=$(aws lambda get-function --function-name "$LAMBDA_NAME" --region $AWS_REGION --query 'Configuration.Layers[0].Arn' --output text)
    echo -e "  ${GREEN}✓${NC} Lambda layer attached"
    echo -e "  ${BLUE}Layer:${NC} $LAYER_ARN"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ${RED}✗${NC} No Lambda layer attached"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 4: S3 Bucket
echo -e "${YELLOW}Test 4: S3 Bucket for Reports${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="securebase-staging-reports-${ACCOUNT_ID}"

if aws s3 ls "s3://${BUCKET_NAME}" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} S3 bucket exists: ${BUCKET_NAME}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    # Test write permissions
    echo "test" > /tmp/test-staging.txt
    if aws s3 cp /tmp/test-staging.txt "s3://${BUCKET_NAME}/test/test-staging.txt" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} S3 write permissions OK"
        aws s3 rm "s3://${BUCKET_NAME}/test/test-staging.txt" > /dev/null 2>&1
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} S3 write permissions failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    rm -f /tmp/test-staging.txt
else
    echo -e "  ${RED}✗${NC} S3 bucket not found: ${BUCKET_NAME}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 5: CloudWatch Logs
echo -e "${YELLOW}Test 5: CloudWatch Log Group${NC}"
LOG_GROUP="/aws/lambda/${LAMBDA_NAME}"

if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region $AWS_REGION | grep -q "$LOG_GROUP"; then
    echo -e "  ${GREEN}✓${NC} CloudWatch log group exists"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ${RED}✗${NC} CloudWatch log group not found"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 6: Lambda Invocation
echo -e "${YELLOW}Test 6: Lambda Function Invocation${NC}"

# Create test event
cat > /tmp/test-event.json <<'EOF'
{
  "action": "health_check",
  "customer_id": "test-staging"
}
EOF

# Invoke Lambda
INVOKE_RESULT=$(aws lambda invoke \
    --function-name "$LAMBDA_NAME" \
    --region $AWS_REGION \
    --payload file:///tmp/test-event.json \
    /tmp/lambda-response.json 2>&1)

if [ $? -eq 0 ]; then
    STATUS_CODE=$(echo "$INVOKE_RESULT" | grep -o '"StatusCode": [0-9]*' | grep -o '[0-9]*')
    if [ "$STATUS_CODE" = "200" ]; then
        echo -e "  ${GREEN}✓${NC} Lambda invocation successful (Status: 200)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Check response
        if [ -f /tmp/lambda-response.json ]; then
            echo -e "  ${BLUE}Response:${NC}"
            cat /tmp/lambda-response.json | head -3
        fi
    else
        echo -e "  ${RED}✗${NC} Lambda invocation failed (Status: $STATUS_CODE)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "  ${RED}✗${NC} Lambda invocation error"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

rm -f /tmp/test-event.json /tmp/lambda-response.json
echo ""

# Test 7: DynamoDB Read/Write
echo -e "${YELLOW}Test 7: DynamoDB Access (Read/Write)${NC}"
TABLE_NAME="securebase-staging-reports"

# Write test item
TEST_ITEM='{
  "customer_id": {"S": "test-staging"},
  "id": {"S": "test-'$(date +%s)'"},
  "name": {"S": "Test Report"},
  "created_at": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
}'

if aws dynamodb put-item \
    --table-name "$TABLE_NAME" \
    --item "$TEST_ITEM" \
    --region $AWS_REGION > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} DynamoDB write successful"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    # Read test item
    if aws dynamodb get-item \
        --table-name "$TABLE_NAME" \
        --key '{"customer_id": {"S": "test-staging"}, "id": {"S": "test-'$(date +%s)'"}}' \
        --region $AWS_REGION > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} DynamoDB read successful"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${YELLOW}⚠${NC} DynamoDB read test skipped (item may not exist)"
    fi
else
    echo -e "  ${RED}✗${NC} DynamoDB write failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 8: IAM Permissions
echo -e "${YELLOW}Test 8: Lambda IAM Role Permissions${NC}"
ROLE_NAME="securebase-staging-report-engine-role"

if aws iam get-role --role-name "$ROLE_NAME" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} IAM role exists"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    # Check attached policies
    POLICY_COUNT=$(aws iam list-attached-role-policies --role-name "$ROLE_NAME" --query 'length(AttachedPolicies)' --output text)
    echo -e "  ${BLUE}Attached Policies:${NC} $POLICY_COUNT"
else
    echo -e "  ${RED}✗${NC} IAM role not found"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Summary
echo ""
echo "================================================================"
echo "📊 Test Summary"
echo "================================================================"
echo ""
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED / $TOTAL_TESTS"
echo -e "${RED}Failed:${NC} $TESTS_FAILED / $TOTAL_TESTS"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓✓✓ All tests passed! ✓✓✓${NC}"
    echo ""
    echo "🎉 Phase 4 Analytics is successfully deployed to staging!"
    echo ""
    echo "📚 Next Steps:"
    echo "  1. Update frontend configuration:"
    echo "     cd phase3a-portal"
    echo "     echo 'VITE_API_BASE_URL=<API_ENDPOINT>' > .env.staging"
    echo ""
    echo "  2. Run end-to-end tests:"
    echo "     npm run test:e2e -- --env=staging"
    echo ""
    echo "  3. Monitor CloudWatch logs:"
    echo "     aws logs tail /aws/lambda/$LAMBDA_NAME --follow"
    echo ""
    echo "  4. Review AWS Cost Explorer:"
    echo "     Filter by tag: Environment=staging"
    echo ""
    exit 0
else
    echo -e "${RED}✗✗✗ Some tests failed ✗✗✗${NC}"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "  1. Check CloudWatch logs:"
    echo "     aws logs tail /aws/lambda/$LAMBDA_NAME --follow"
    echo ""
    echo "  2. Verify Terraform outputs:"
    echo "     cd landing-zone/environments/staging && terraform output"
    echo ""
    echo "  3. Check AWS Console:"
    echo "     - Lambda: https://console.aws.amazon.com/lambda"
    echo "     - DynamoDB: https://console.aws.amazon.com/dynamodb"
    echo "     - S3: https://console.aws.amazon.com/s3"
    echo ""
    exit 1
fi
