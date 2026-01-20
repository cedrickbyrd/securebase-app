#!/bin/bash
# SecureBase Pre-Go-Live Test Runner
# Runs all critical tests before production deployment

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Log file
LOG_FILE="test-results-$(date +%Y%m%d-%H%M%S).log"

echo "🚀 SecureBase Pre-Go-Live Testing Suite" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Function to run a test
run_test() {
    local phase="$1"
    local test_name="$2"
    local test_cmd="$3"
    local critical="${4:-no}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "[$phase] $test_name... " | tee -a "$LOG_FILE"
    
    if eval "$test_cmd" >> "$LOG_FILE" 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}" | tee -a "$LOG_FILE"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        if [ "$critical" = "yes" ]; then
            echo -e "${RED}✗ FAIL (CRITICAL)${NC}" | tee -a "$LOG_FILE"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            echo "  ⚠️  Critical test failed. Stopping test suite." | tee -a "$LOG_FILE"
            exit 1
        else
            echo -e "${YELLOW}✗ FAIL${NC}" | tee -a "$LOG_FILE"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    fi
}

# Function to skip a test
skip_test() {
    local phase="$1"
    local test_name="$2"
    local reason="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    
    echo -e "[$phase] $test_name... ${BLUE}⊘ SKIP${NC} ($reason)" | tee -a "$LOG_FILE"
}

echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo " Phase 1: Local Validation" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 1.1 Configuration Files
run_test "1.1" "Validate PaaS configuration" \
    "test -x ./validate-paas.sh && ./validate-paas.sh" \
    "yes"

run_test "1.1" "Check terraform.tfvars exists" \
    "test -f landing-zone/environments/dev/terraform.tfvars" \
    "yes"

run_test "1.1" "Check client.auto.tfvars exists" \
    "test -f landing-zone/environments/dev/client.auto.tfvars" \
    "yes"

run_test "1.1" "Verify 10 customers configured" \
    "[ \$(grep -c '\".*\":' landing-zone/environments/dev/client.auto.tfvars) -ge 10 ]" \
    "yes"

# 1.2 Terraform Syntax
cd landing-zone/environments/dev

run_test "1.2" "Terraform init" \
    "terraform init -upgrade" \
    "yes"

run_test "1.2" "Terraform validate" \
    "terraform validate" \
    "yes"

run_test "1.2" "Terraform format check" \
    "terraform fmt -check -recursive ../../"

cd ../../..

# 1.3 Code Quality
run_test "1.3" "Python Lambda syntax (auth_v2)" \
    "python3 -m py_compile phase2-backend/functions/auth_v2.py" \
    "yes"

run_test "1.3" "Python Lambda syntax (billing_worker)" \
    "python3 -m py_compile phase2-backend/functions/billing-worker.py"

run_test "1.3" "Python Lambda syntax (report_engine)" \
    "python3 -m py_compile phase2-backend/functions/report_engine.py"

if [ -d "phase3a-portal/node_modules" ]; then
    run_test "1.3" "React Portal ESLint" \
        "cd phase3a-portal && npm run lint"
else
    skip_test "1.3" "React Portal ESLint" "node_modules not found"
fi

run_test "1.3" "Database schema SQL syntax" \
    "grep -q 'CREATE TABLE' phase2-backend/database/schema.sql" \
    "yes"

# 1.4 Documentation
run_test "1.4" "Copilot instructions exist" \
    "test -f .github/copilot-instructions.md"

run_test "1.4" "Project index exists" \
    "test -f PROJECT_INDEX.md"

run_test "1.4" "Getting started guide exists" \
    "test -f GETTING_STARTED.md"

echo "" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo " Phase 2: Infrastructure Planning" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

cd landing-zone/environments/dev

run_test "2.1" "Generate Terraform plan" \
    "terraform plan -out=pretest.tfplan" \
    "yes"

run_test "2.1" "Verify resource count (200-250 expected)" \
    "RESOURCE_COUNT=\$(terraform show -json pretest.tfplan | jq '.resource_changes | length'); [ \$RESOURCE_COUNT -ge 200 ] && [ \$RESOURCE_COUNT -le 300 ]"

run_test "2.2" "Check for resource deletions" \
    "! terraform show -json pretest.tfplan | jq -e '.resource_changes[] | select(.change.actions[] == \"delete\")' > /dev/null"

# Clean up
rm -f pretest.tfplan

cd ../../..

echo "" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo " Phase 3: File Structure Validation" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Phase 1 files
run_test "3.1" "Landing zone main.tf exists" \
    "test -f landing-zone/main.tf"

run_test "3.1" "Organization module exists" \
    "test -d landing-zone/modules/org"

run_test "3.1" "VPC module exists" \
    "test -d landing-zone/modules/vpc"

run_test "3.1" "IAM module exists" \
    "test -d landing-zone/modules/iam"

# Phase 2 files
run_test "3.2" "Database schema exists" \
    "test -f phase2-backend/database/schema.sql"

run_test "3.2" "Database init script exists" \
    "test -f phase2-backend/database/init_database.sh"

run_test "3.2" "Lambda layer exists" \
    "test -d phase2-backend/lambda_layer/python"

run_test "3.2" "Lambda packaging script exists" \
    "test -f phase2-backend/functions/package-lambda.sh"

# Phase 3a files
run_test "3.3" "Portal package.json exists" \
    "test -f phase3a-portal/package.json"

run_test "3.3" "Portal components exist" \
    "test -d phase3a-portal/src/components"

run_test "3.3" "API service exists" \
    "test -f phase3a-portal/src/services/apiService.js"

echo "" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo " Phase 4: Test Events & Scripts" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

run_test "4.1" "Lambda test events directory exists" \
    "test -d phase2-backend/functions/test-events"

if [ -f "phase2-backend/functions/test-events/get-analytics.json" ]; then
    run_test "4.1" "Test event JSON is valid" \
        "python3 -m json.tool phase2-backend/functions/test-events/get-analytics.json > /dev/null"
fi

run_test "4.2" "Phase 4 test script exists" \
    "test -f TEST_PHASE4.sh"

run_test "4.2" "Customer simulation script exists" \
    "test -f SIMULATE_ONBOARDING.sh"

run_test "4.2" "Multi-customer simulation exists" \
    "test -f SIMULATE_MULTI_CUSTOMER.sh"

echo "" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo " Phase 5: AWS Deployment Checks (Optional)" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Check if AWS CLI is configured
if aws sts get-caller-identity > /dev/null 2>&1; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=$(aws configure get region || echo "us-east-1")
    
    echo "  AWS Account: $AWS_ACCOUNT" | tee -a "$LOG_FILE"
    echo "  AWS Region: $AWS_REGION" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    run_test "5.1" "Check AWS Organization exists" \
        "aws organizations describe-organization > /dev/null"
    
    run_test "5.2" "Check Lambda function (if deployed)" \
        "aws lambda list-functions --query 'Functions[?starts_with(FunctionName, \`securebase-dev\`)].FunctionName' --output text | grep -q ."
    
    run_test "5.3" "Check Aurora cluster (if deployed)" \
        "aws rds describe-db-clusters --query 'DBClusters[?starts_with(DBClusterIdentifier, \`securebase-dev\`)].DBClusterIdentifier' --output text | grep -q ."
else
    skip_test "5.x" "AWS deployment checks" "AWS credentials not configured"
fi

echo "" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo " Test Results Summary" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "Total Tests:   $TOTAL_TESTS" | tee -a "$LOG_FILE"
echo -e "Passed:        ${GREEN}$PASSED_TESTS${NC}" | tee -a "$LOG_FILE"
echo -e "Failed:        ${RED}$FAILED_TESTS${NC}" | tee -a "$LOG_FILE"
echo -e "Skipped:       ${BLUE}$SKIPPED_TESTS${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo "Pass Rate: $PASS_RATE%" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}✓ ALL TESTS PASSED - READY FOR DEPLOYMENT${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "Next steps:" | tee -a "$LOG_FILE"
    echo "  1. Review PRE_GOLIVE_TESTING_CHECKLIST.md" | tee -a "$LOG_FILE"
    echo "  2. Deploy to dev: cd landing-zone/environments/dev && terraform apply" | tee -a "$LOG_FILE"
    echo "  3. Run integration tests: ./TEST_PHASE4.sh" | tee -a "$LOG_FILE"
    echo "  4. Verify customer isolation: ./SIMULATE_MULTI_CUSTOMER.sh" | tee -a "$LOG_FILE"
    echo "  5. Schedule production deployment" | tee -a "$LOG_FILE"
    exit 0
else
    echo -e "${RED}═══════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo -e "${RED}✗ TESTS FAILED - DO NOT DEPLOY${NC}" | tee -a "$LOG_FILE"
    echo -e "${RED}═══════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "Failed tests must be fixed before deployment." | tee -a "$LOG_FILE"
    echo "Review log file: $LOG_FILE" | tee -a "$LOG_FILE"
    exit 1
fi

echo "Completed: $(date)" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
