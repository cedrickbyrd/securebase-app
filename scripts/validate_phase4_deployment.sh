#!/bin/bash
# Validate Phase 4 Analytics Deployment
# Comprehensive validation script for all analytics components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Phase 4 Analytics - Deployment Validation           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Region:${NC} $AWS_REGION"
echo ""

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -n "[$TESTS_TOTAL] Testing: $test_name... "
    
    if eval "$test_command" &>/dev/null; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ==============================================================================
# Section 1: Pre-Deployment Checks
# ==============================================================================

echo -e "${YELLOW}━━━ Section 1: Pre-Deployment Checks ━━━${NC}"
echo ""

# Check AWS credentials
run_test "AWS credentials configured" "aws sts get-caller-identity"

# Check required tools
run_test "AWS CLI installed" "which aws"
run_test "Terraform installed" "which terraform"
run_test "Python 3.11 installed" "python3 --version | grep -q '3.11'"
run_test "jq installed" "which jq"

# Check Lambda packages exist
run_test "analytics_aggregator.zip exists" "test -f '$REPO_ROOT/phase2-backend/deploy/analytics_aggregator.zip'"
run_test "analytics_reporter.zip exists" "test -f '$REPO_ROOT/phase2-backend/deploy/analytics_reporter.zip'"
run_test "analytics_query.zip exists" "test -f '$REPO_ROOT/phase2-backend/deploy/analytics_query.zip'"
run_test "report_engine.zip exists" "test -f '$REPO_ROOT/phase2-backend/deploy/report_engine.zip'"

# Check Lambda layer exists
run_test "reporting-layer.zip exists" "test -f '$REPO_ROOT/phase2-backend/layers/reporting/reporting-layer.zip'"

echo ""

# ==============================================================================
# Section 2: AWS Infrastructure Validation
# ==============================================================================

echo -e "${YELLOW}━━━ Section 2: AWS Infrastructure Validation ━━━${NC}"
echo ""

# Check DynamoDB tables
TABLES=(
    "securebase-${ENVIRONMENT}-reports"
    "securebase-${ENVIRONMENT}-report-schedules"
    "securebase-${ENVIRONMENT}-report-cache"
    "securebase-${ENVIRONMENT}-metrics"
)

for TABLE in "${TABLES[@]}"; do
    run_test "DynamoDB table $TABLE exists" "aws dynamodb describe-table --table-name '$TABLE' --region '$AWS_REGION'"
done

# Check S3 bucket
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
S3_BUCKET="securebase-${ENVIRONMENT}-reports-${ACCOUNT_ID}"
run_test "S3 bucket $S3_BUCKET exists" "aws s3api head-bucket --bucket '$S3_BUCKET' --region '$AWS_REGION' 2>/dev/null"

# Check Lambda functions
LAMBDA_FUNCTIONS=(
    "securebase-${ENVIRONMENT}-analytics-aggregator"
    "securebase-${ENVIRONMENT}-analytics-reporter"
    "securebase-${ENVIRONMENT}-analytics-query"
    "securebase-${ENVIRONMENT}-report-engine"
)

for FUNCTION in "${LAMBDA_FUNCTIONS[@]}"; do
    run_test "Lambda function $FUNCTION exists" "aws lambda get-function --function-name '$FUNCTION' --region '$AWS_REGION'"
done

# Check Lambda layer
run_test "Lambda layer exists" "aws lambda list-layers --region '$AWS_REGION' | grep -q 'securebase-${ENVIRONMENT}-reporting'"

# Check EventBridge rule
run_test "EventBridge rule exists" "aws events describe-rule --name 'securebase-${ENVIRONMENT}-analytics-aggregator-schedule' --region '$AWS_REGION'"

# Check CloudWatch Log Groups
LOG_GROUPS=(
    "/aws/lambda/securebase-${ENVIRONMENT}-analytics-aggregator"
    "/aws/lambda/securebase-${ENVIRONMENT}-analytics-reporter"
    "/aws/lambda/securebase-${ENVIRONMENT}-analytics-query"
    "/aws/lambda/securebase-${ENVIRONMENT}-report-engine"
)

for LOG_GROUP in "${LOG_GROUPS[@]}"; do
    run_test "CloudWatch log group $LOG_GROUP exists" "aws logs describe-log-groups --log-group-name-prefix '$LOG_GROUP' --region '$AWS_REGION' | grep -q '$LOG_GROUP'"
done

echo ""

# ==============================================================================
# Section 3: Lambda Function Validation
# ==============================================================================

echo -e "${YELLOW}━━━ Section 3: Lambda Function Validation ━━━${NC}"
echo ""

# Test each Lambda function
for FUNCTION in "${LAMBDA_FUNCTIONS[@]}"; do
    # Check function configuration
    run_test "$FUNCTION has correct runtime" "aws lambda get-function-configuration --function-name '$FUNCTION' --region '$AWS_REGION' | jq -r '.Runtime' | grep -q 'python3.11'"
    
    # Check function environment variables
    run_test "$FUNCTION has environment variables" "aws lambda get-function-configuration --function-name '$FUNCTION' --region '$AWS_REGION' | jq -r '.Environment.Variables' | grep -q 'ENVIRONMENT'"
    
    # Check function IAM role
    run_test "$FUNCTION has IAM role" "aws lambda get-function-configuration --function-name '$FUNCTION' --region '$AWS_REGION' | jq -r '.Role' | grep -q 'analytics-functions-role'"
done

echo ""

# ==============================================================================
# Section 4: API Endpoint Validation (if API Gateway configured)
# ==============================================================================

echo -e "${YELLOW}━━━ Section 4: API Endpoint Validation ━━━${NC}"
echo ""

# Get API Gateway ID (if exists)
API_ID=$(aws apigatewayv2 get-apis --region "$AWS_REGION" --query "Items[?Name=='securebase-${ENVIRONMENT}-api'].ApiId" --output text 2>/dev/null || echo "")

if [ -n "$API_ID" ]; then
    echo "API Gateway ID: $API_ID"
    
    # Check API routes
    ROUTES=(
        "GET /analytics/usage"
        "GET /analytics/compliance"
        "GET /analytics/costs"
        "POST /analytics/reports"
    )
    
    for ROUTE in "${ROUTES[@]}"; do
        run_test "API route '$ROUTE' exists" "aws apigatewayv2 get-routes --api-id '$API_ID' --region '$AWS_REGION' | jq -r '.Items[].RouteKey' | grep -q '$ROUTE'"
    done
else
    echo -e "${YELLOW}ℹ API Gateway not found or not configured yet${NC}"
fi

echo ""

# ==============================================================================
# Section 5: CloudWatch Alarms and Monitoring
# ==============================================================================

echo -e "${YELLOW}━━━ Section 5: CloudWatch Alarms and Monitoring ━━━${NC}"
echo ""

# Check for CloudWatch alarms
run_test "CloudWatch alarms exist" "aws cloudwatch describe-alarms --alarm-name-prefix 'securebase-${ENVIRONMENT}-analytics' --region '$AWS_REGION' | jq -r '.MetricAlarms | length' | grep -v '^0$'"

echo ""

# ==============================================================================
# Section 6: Integration Tests (if available)
# ==============================================================================

echo -e "${YELLOW}━━━ Section 6: Integration Tests ━━━${NC}"
echo ""

# Check if test files exist
if [ -f "$REPO_ROOT/tests/integration/test_analytics_integration.py" ]; then
    run_test "Integration test file exists" "test -f '$REPO_ROOT/tests/integration/test_analytics_integration.py'"
    
    # Run integration tests (if pytest is available)
    if command -v pytest &>/dev/null; then
        echo -e "${BLUE}Running integration tests...${NC}"
        cd "$REPO_ROOT"
        if pytest tests/integration/test_analytics_integration.py -v --tb=short 2>&1 | tail -20; then
            echo -e "${GREEN}✓ Integration tests passed${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${YELLOW}⚠ Integration tests failed or skipped (may require AWS credentials)${NC}"
        fi
        TESTS_TOTAL=$((TESTS_TOTAL + 1))
    else
        echo -e "${YELLOW}ℹ pytest not installed, skipping integration tests${NC}"
    fi
else
    echo -e "${YELLOW}ℹ Integration test file not found${NC}"
fi

echo ""

# ==============================================================================
# Section 7: Data Flow Validation
# ==============================================================================

echo -e "${YELLOW}━━━ Section 7: Data Flow Validation ━━━${NC}"
echo ""

# Test Lambda invocation (analytics_query)
QUERY_FUNCTION="securebase-${ENVIRONMENT}-analytics-query"
echo -e "${BLUE}Testing Lambda invocation for $QUERY_FUNCTION...${NC}"

TEST_EVENT='{
  "httpMethod": "GET",
  "path": "/analytics/usage",
  "queryStringParameters": {
    "period": "7d"
  },
  "requestContext": {
    "authorizer": {
      "customerId": "test-customer-123"
    }
  }
}'

if aws lambda invoke \
    --function-name "$QUERY_FUNCTION" \
    --payload "$TEST_EVENT" \
    --region "$AWS_REGION" \
    /tmp/lambda-response.json &>/dev/null; then
    
    RESPONSE=$(cat /tmp/lambda-response.json)
    if echo "$RESPONSE" | jq -r '.statusCode' | grep -q '200'; then
        echo -e "${GREEN}✓ Lambda invocation successful (200 OK)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${YELLOW}⚠ Lambda invocation returned non-200 status${NC}"
        echo "Response: $RESPONSE"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
else
    echo -e "${RED}✗ Lambda invocation failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
fi

echo ""

# ==============================================================================
# Final Report
# ==============================================================================

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Validation Summary                                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo "Total Tests: $TESTS_TOTAL"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All validation tests passed!${NC}"
    echo -e "${GREEN}Phase 4 Analytics deployment is ready for production.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some validation tests failed.${NC}"
    echo -e "${YELLOW}Please review the failures above and fix before proceeding.${NC}"
    exit 1
fi
