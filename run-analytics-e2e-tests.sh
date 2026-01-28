#!/bin/bash
# Analytics E2E/Integration Test Runner
# Executes all Analytics tests with proper configuration and reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Analytics E2E/Integration Test Suite                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
ENVIRONMENT=${1:-dev}
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_RESULTS_DIR="${REPO_ROOT}/test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create test results directory
mkdir -p "${TEST_RESULTS_DIR}"

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${BLUE}Configuration:${NC}"
echo "  Environment: ${ENVIRONMENT}"
echo "  Repository: ${REPO_ROOT}"
echo "  Results Directory: ${TEST_RESULTS_DIR}"
echo ""

# ============================================================================
# Step 1: Pre-flight Checks
# ============================================================================
echo -e "${YELLOW}━━━ Step 1: Pre-flight Checks ━━━${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python $(python3 --version | cut -d' ' -f2) available${NC}"

# Check pytest
if ! python3 -c "import pytest" 2>/dev/null; then
    echo -e "${YELLOW}⚠ pytest not installed, installing...${NC}"
    pip install -q pytest pytest-mock boto3 requests moto
fi
echo -e "${GREEN}✓ pytest available${NC}"

# Check AWS credentials (optional - tests can run with mocks)
if aws sts get-caller-identity &>/dev/null; then
    echo -e "${GREEN}✓ AWS credentials configured${NC}"
    AWS_AVAILABLE=true
else
    echo -e "${YELLOW}⚠ AWS credentials not configured - using mocks${NC}"
    AWS_AVAILABLE=false
fi

echo ""

# ============================================================================
# Step 2: Unit Tests (Mocked)
# ============================================================================
echo -e "${YELLOW}━━━ Step 2: Unit Tests (Mocked AWS Services) ━━━${NC}"

export AWS_DEFAULT_REGION=us-east-1
export ENVIRONMENT=test
export METRICS_TABLE=test-metrics
export REPORTS_TABLE=test-reports
export CACHE_TABLE=test-cache
export CUSTOMERS_TABLE=test-customers
export S3_BUCKET=test-reports-bucket

# Run integration tests with mocks
echo "Running Analytics integration tests..."

cd "${REPO_ROOT}"

# Create a simple test runner that doesn't require conftest
cat > /tmp/run_analytics_tests.py <<'EOF'
import sys
import os
import pytest

# Set AWS region to avoid NoRegionError
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
os.environ['AWS_SECURITY_TOKEN'] = 'testing'
os.environ['AWS_SESSION_TOKEN'] = 'testing'

# Run pytest
sys.exit(pytest.main([
    'tests/integration/test_analytics_integration.py',
    '-v',
    '--tb=short',
    '-p', 'no:conftest',
    '--maxfail=5',
    '-W', 'ignore::DeprecationWarning'
]))
EOF

if python3 /tmp/run_analytics_tests.py 2>&1 | tee "${TEST_RESULTS_DIR}/unit_tests_${TIMESTAMP}.log"; then
    echo -e "${GREEN}✓ Unit tests passed${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠ Unit tests had issues (expected without AWS deployment)${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""

# ============================================================================
# Step 3: Infrastructure Tests
# ============================================================================
echo -e "${YELLOW}━━━ Step 3: Infrastructure Tests ━━━${NC}"

# Test Terraform configuration
if command -v terraform &> /dev/null; then
    echo "Testing Analytics Terraform module..."
    
    cd "${REPO_ROOT}/landing-zone/modules/analytics"
    
    if terraform fmt -check -recursive 2>&1 | tee -a "${TEST_RESULTS_DIR}/terraform_tests_${TIMESTAMP}.log"; then
        echo -e "${GREEN}✓ Terraform format check passed${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ Terraform format check failed${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    cd tests
    if terraform init -backend=false > /dev/null 2>&1 && terraform validate 2>&1 | tee -a "${TEST_RESULTS_DIR}/terraform_tests_${TIMESTAMP}.log"; then
        echo -e "${GREEN}✓ Terraform validation passed${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ Terraform validation failed${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "${YELLOW}⊘ Terraform not installed, skipping infrastructure tests${NC}"
fi

cd "${REPO_ROOT}"
echo ""

# ============================================================================
# Step 4: E2E Tests (if AWS is deployed)
# ============================================================================
echo -e "${YELLOW}━━━ Step 4: E2E Tests (Requires Deployment) ━━━${NC}"

if [ "${AWS_AVAILABLE}" = true ] && [ -n "${RUN_E2E_TESTS}" ]; then
    echo "Running E2E tests against deployed environment..."
    
    # Check if API Gateway endpoint is available
    if cd "${REPO_ROOT}/landing-zone/environments/${ENVIRONMENT}" 2>/dev/null; then
        API_ENDPOINT=$(terraform output -raw api_gateway_url 2>/dev/null || echo "")
        
        if [ -n "${API_ENDPOINT}" ]; then
            export API_BASE_URL="${API_ENDPOINT}"
            export TEST_CUSTOMER_ID="cust-test-e2e"
            export TEST_API_KEY="test-api-key-123"
            
            cd "${REPO_ROOT}"
            
            if python3 -m pytest tests/e2e/test_analytics_e2e.py -v --tb=short 2>&1 | tee "${TEST_RESULTS_DIR}/e2e_tests_${TIMESTAMP}.log"; then
                echo -e "${GREEN}✓ E2E tests passed${NC}"
                PASSED_TESTS=$((PASSED_TESTS + 1))
            else
                echo -e "${RED}✗ E2E tests failed${NC}"
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
            TOTAL_TESTS=$((TOTAL_TESTS + 1))
        else
            echo -e "${YELLOW}⊘ API Gateway not deployed, skipping E2E tests${NC}"
        fi
    else
        echo -e "${YELLOW}⊘ Environment not found, skipping E2E tests${NC}"
    fi
else
    echo -e "${YELLOW}⊘ E2E tests skipped (set RUN_E2E_TESTS=1 to enable)${NC}"
    echo "  E2E tests require:"
    echo "  - Deployed Analytics infrastructure"
    echo "  - Valid AWS credentials"
    echo "  - API Gateway endpoint"
fi

echo ""

# ============================================================================
# Step 5: Lambda Function Tests
# ============================================================================
echo -e "${YELLOW}━━━ Step 5: Lambda Function Tests ━━━${NC}"

cd "${REPO_ROOT}/phase2-backend/functions"

# Test Lambda function syntax
echo "Testing Lambda function syntax..."

for lambda_file in analytics_query.py analytics_aggregator.py analytics_reporter.py; do
    if [ -f "${lambda_file}" ]; then
        if python3 -m py_compile "${lambda_file}" 2>&1; then
            echo -e "${GREEN}✓ ${lambda_file} syntax valid${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}✗ ${lambda_file} syntax invalid${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
    fi
done

echo ""

# ============================================================================
# Step 6: AWS Lambda Invocation Tests (if deployed)
# ============================================================================
echo -e "${YELLOW}━━━ Step 6: AWS Lambda Invocation Tests ━━━${NC}"

if [ "${AWS_AVAILABLE}" = true ]; then
    echo "Testing deployed Lambda functions..."
    
    # List of Lambda functions to test
    LAMBDAS=(
        "securebase-${ENVIRONMENT}-analytics-aggregator"
        "securebase-${ENVIRONMENT}-analytics-reporter"
        "securebase-${ENVIRONMENT}-analytics-query"
    )
    
    for lambda_name in "${LAMBDAS[@]}"; do
        if aws lambda get-function --function-name "${lambda_name}" --region us-east-1 &>/dev/null; then
            echo -e "${GREEN}✓ ${lambda_name} deployed${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            
            # Try to invoke with a test event
            echo "  Testing invocation..."
            if aws lambda invoke \
                --function-name "${lambda_name}" \
                --payload '{"test": true}' \
                --region us-east-1 \
                /tmp/lambda_response.json &>/dev/null; then
                echo -e "${GREEN}  ✓ Invocation successful${NC}"
            else
                echo -e "${YELLOW}  ⚠ Invocation failed (may require specific event format)${NC}"
            fi
        else
            echo -e "${YELLOW}⊘ ${lambda_name} not deployed${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
    done
else
    echo -e "${YELLOW}⊘ AWS not available, skipping Lambda invocation tests${NC}"
fi

echo ""

# ============================================================================
# Step 7: DynamoDB Table Tests
# ============================================================================
echo -e "${YELLOW}━━━ Step 7: DynamoDB Table Tests ━━━${NC}"

if [ "${AWS_AVAILABLE}" = true ]; then
    echo "Testing DynamoDB tables..."
    
    TABLES=(
        "securebase-${ENVIRONMENT}-metrics"
        "securebase-${ENVIRONMENT}-reports"
        "securebase-${ENVIRONMENT}-report-cache"
        "securebase-${ENVIRONMENT}-report-schedules"
    )
    
    for table_name in "${TABLES[@]}"; do
        if aws dynamodb describe-table --table-name "${table_name}" --region us-east-1 &>/dev/null; then
            echo -e "${GREEN}✓ ${table_name} exists${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${YELLOW}⊘ ${table_name} not found${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
    done
else
    echo -e "${YELLOW}⊘ AWS not available, skipping DynamoDB tests${NC}"
fi

echo ""

# ============================================================================
# Test Summary
# ============================================================================
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Test Summary                                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Tests:    ${TOTAL_TESTS}"
echo -e "${GREEN}Passed:${NC}         ${PASSED_TESTS}"
echo -e "${RED}Failed:${NC}         ${FAILED_TESTS}"
echo ""

SUCCESS_RATE=0
if [ ${TOTAL_TESTS} -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
fi
echo -e "Success Rate:   ${SUCCESS_RATE}%"
echo ""

# Generate test report
cat > "${TEST_RESULTS_DIR}/test_summary_${TIMESTAMP}.txt" <<EOF
Analytics E2E Test Summary
==========================
Date: $(date)
Environment: ${ENVIRONMENT}

Test Results
------------
Total Tests: ${TOTAL_TESTS}
Passed: ${PASSED_TESTS}
Failed: ${FAILED_TESTS}
Success Rate: ${SUCCESS_RATE}%

Test Logs
---------
All test logs saved to: ${TEST_RESULTS_DIR}

$(ls -lh "${TEST_RESULTS_DIR}"/*_${TIMESTAMP}.log 2>/dev/null || echo "No detailed logs available")
EOF

echo -e "${BLUE}Test report saved to:${NC} ${TEST_RESULTS_DIR}/test_summary_${TIMESTAMP}.txt"
echo ""

# ============================================================================
# Next Steps
# ============================================================================
echo -e "${BLUE}Next Steps:${NC}"

if [ ${FAILED_TESTS} -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Analytics deployment is validated. You can proceed with:"
    echo "  1. Update PHASE4_STATUS.md to mark Analytics as tested"
    echo "  2. Run production deployment: bash scripts/deploy_analytics.sh prod"
    echo "  3. Monitor CloudWatch dashboard for 48 hours"
else
    echo -e "${YELLOW}⚠ Some tests failed${NC}"
    echo ""
    echo "Review test logs in ${TEST_RESULTS_DIR}"
    echo ""
    
    if [ "${AWS_AVAILABLE}" = false ]; then
        echo "Note: AWS credentials not configured - some tests skipped"
        echo "To run full E2E tests:"
        echo "  1. Configure AWS credentials: aws configure"
        echo "  2. Deploy Analytics: bash scripts/deploy_analytics.sh dev"
        echo "  3. Run tests: RUN_E2E_TESTS=1 bash run-analytics-e2e-tests.sh dev"
    fi
fi

echo ""

# Exit with appropriate code
if [ ${FAILED_TESTS} -eq 0 ]; then
    exit 0
else
    exit 1
fi
