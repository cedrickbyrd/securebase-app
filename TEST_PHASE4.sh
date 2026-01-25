#!/bin/bash
# Phase 4 Component 1: Analytics Testing Script
# Tests Lambda function locally and on AWS

set -e

echo "🧪 SecureBase Phase 4 Analytics - Testing Suite"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Determine repository root
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "Testing: $test_name... "
    
    if eval "$test_command" > /tmp/test_output.txt 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Error: $(cat /tmp/test_output.txt | head -1)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "📋 Test Suite: Phase 4 Analytics & Reporting"
echo ""

# --- Pre-Deployment Tests (Local) ---
echo "=== Pre-Deployment Tests (Local) ==="
echo ""

# Test 1: Check Lambda function exists
run_test "Lambda function file exists" \
    "test -f $REPO_ROOT/phase2-backend/functions/report_engine.py"

# Test 2: Check Lambda function syntax
run_test "Lambda function Python syntax" \
    "python3 -m py_compile $REPO_ROOT/phase2-backend/functions/report_engine.py"

# Test 3: Check test events exist
run_test "Test events directory exists" \
    "test -d $REPO_ROOT/phase2-backend/functions/test-events"

# Test 4: Validate test event JSON
run_test "GET analytics test event valid JSON" \
    "python3 -m json.tool $REPO_ROOT/phase2-backend/functions/test-events/get-analytics.json > /dev/null"

run_test "Export CSV test event valid JSON" \
    "python3 -m json.tool $REPO_ROOT/phase2-backend/functions/test-events/export-csv.json > /dev/null"

# Test 5: Check Terraform modules exist
run_test "Analytics Terraform module exists" \
    "test -d $REPO_ROOT/landing-zone/modules/analytics"

run_test "Analytics DynamoDB config exists" \
    "test -f $REPO_ROOT/landing-zone/modules/analytics/dynamodb.tf"

run_test "Analytics Lambda config exists" \
    "test -f $REPO_ROOT/landing-zone/modules/analytics/lambda.tf"

# Test 6: Check deployment scripts
run_test "Automated deployment script exists" \
    "test -f $REPO_ROOT/DEPLOY_PHASE4_NOW.sh"

run_test "Lambda packaging script exists" \
    "test -f $REPO_ROOT/phase2-backend/functions/package-lambda.sh"

run_test "Lambda layer build script exists" \
    "test -f $REPO_ROOT/phase2-backend/layers/reporting/build-layer.sh"

echo ""
echo "=== AWS Deployment Check ==="
echo ""

# Check if AWS CLI is configured
if aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${GREEN}✓ AWS credentials configured${NC}"
    AWS_CONFIGURED=true
    
    # Get account info
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=$(aws configure get region || echo "us-east-1")
    echo "  Account: $AWS_ACCOUNT"
    echo "  Region: $AWS_REGION"
else
    echo -e "${YELLOW}⚠ AWS credentials not configured${NC}"
    echo "  Skipping AWS deployment tests"
    AWS_CONFIGURED=false
fi

echo ""

if [ "$AWS_CONFIGURED" = true ]; then
    echo "=== Post-Deployment Tests (AWS) ==="
    echo ""
    
    # Test Lambda function deployment
    if aws lambda get-function --function-name securebase-dev-report-engine --region us-east-1 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Lambda function deployed${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Get function info
        FUNC_SIZE=$(aws lambda get-function --function-name securebase-dev-report-engine --region us-east-1 --query 'Configuration.CodeSize' --output text)
        FUNC_MEMORY=$(aws lambda get-function --function-name securebase-dev-report-engine --region us-east-1 --query 'Configuration.MemorySize' --output text)
        FUNC_TIMEOUT=$(aws lambda get-function --function-name securebase-dev-report-engine --region us-east-1 --query 'Configuration.Timeout' --output text)
        
        echo "  Size: $FUNC_SIZE bytes"
        echo "  Memory: ${FUNC_MEMORY}MB"
        echo "  Timeout: ${FUNC_TIMEOUT}s"
        
        # Test Lambda invocation
        echo ""
        echo -n "Testing: Lambda invocation (GET analytics)... "
        if aws lambda invoke \
            --function-name securebase-dev-report-engine \
            --payload file://phase2-backend/functions/test-events/get-analytics.json \
            --region us-east-1 \
            /tmp/lambda-output.json > /dev/null 2>&1; then
            
            # Check if response is valid
            if python3 -m json.tool /tmp/lambda-output.json > /dev/null 2>&1; then
                STATUS_CODE=$(cat /tmp/lambda-output.json | python3 -c "import sys, json; print(json.load(sys.stdin).get('statusCode', 0))")
                if [ "$STATUS_CODE" = "200" ]; then
                    echo -e "${GREEN}✓ PASSED${NC}"
                    echo "  Status Code: $STATUS_CODE"
                    TESTS_PASSED=$((TESTS_PASSED + 1))
                else
                    echo -e "${RED}✗ FAILED${NC}"
                    echo "  Status Code: $STATUS_CODE (expected 200)"
                    TESTS_FAILED=$((TESTS_FAILED + 1))
                fi
            else
                echo -e "${RED}✗ FAILED (invalid JSON response)${NC}"
                TESTS_FAILED=$((TESTS_FAILED + 1))
            fi
        else
            echo -e "${RED}✗ FAILED${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        echo -e "${YELLOW}⚠ Lambda function not deployed yet${NC}"
        echo "  Deploy with: ./DEPLOY_PHASE4_NOW.sh"
    fi
    
    # Test DynamoDB tables
    echo ""
    echo "Checking DynamoDB tables..."
    
    for table in "securebase-dev-reports" "securebase-dev-report-schedules" "securebase-dev-report-cache" "securebase-dev-metrics"; do
        if aws dynamodb describe-table --table-name "$table" --region us-east-1 > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Table exists: $table${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${YELLOW}⚠ Table not found: $table${NC}"
            echo "  Deploy with: cd landing-zone && terraform apply"
        fi
    done
    
    # Test S3 bucket
    echo ""
    echo "Checking S3 bucket..."
    BUCKET_NAME="securebase-dev-report-exports-$AWS_ACCOUNT"
    
    if aws s3 ls "s3://$BUCKET_NAME" --region us-east-1 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ S3 bucket exists: $BUCKET_NAME${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${YELLOW}⚠ S3 bucket not found: $BUCKET_NAME${NC}"
    fi
    
    # Test Lambda layer
    echo ""
    echo "Checking Lambda layer..."
    
    if aws lambda list-layer-versions --layer-name securebase-dev-reporting --region us-east-1 --max-items 1 > /dev/null 2>&1; then
        LAYER_VERSION=$(aws lambda list-layer-versions --layer-name securebase-dev-reporting --region us-east-1 --max-items 1 --query 'LayerVersions[0].Version' --output text)
        echo -e "${GREEN}✓ Lambda layer exists: securebase-dev-reporting (version $LAYER_VERSION)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${YELLOW}⚠ Lambda layer not found${NC}"
        echo "  Build and deploy with: cd phase2-backend/layers/reporting && ./build-layer.sh"
    fi
fi

echo ""
echo "================================================"
echo "📊 Test Results Summary"
echo "================================================"
echo ""
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    if [ "$AWS_CONFIGURED" = false ]; then
        echo "Next steps:"
        echo "  1. Configure AWS credentials: aws configure"
        echo "  2. Deploy to AWS: ./DEPLOY_PHASE4_NOW.sh"
        echo "  3. Run tests again: ./TEST_PHASE4.sh"
    else
        echo "🎉 Phase 4 Component 1 is fully operational!"
        echo ""
        echo "Next steps:"
        echo "  1. Test frontend: cd phase3a-portal && npm run dev"
        echo "  2. View API endpoints: cd landing-zone && terraform output api_endpoints"
        echo "  3. Monitor logs: aws logs tail /aws/lambda/securebase-dev-report-engine --follow"
    fi
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Review the errors above and:"
    echo "  1. Check deployment status"
    echo "  2. Review CloudWatch logs"
    echo "  3. Verify Terraform state"
    exit 1
fi
