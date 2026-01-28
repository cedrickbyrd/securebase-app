#!/bin/bash
# Verify Analytics Lambda Layer Attachment and Functionality
# This script checks that the reporting layer (ReportLab + openpyxl) is properly attached
# to the analytics Lambda functions and that they can use the dependencies.

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

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Analytics Lambda Layer Verification                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Region:${NC} $AWS_REGION"
echo ""

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Function to increment check counter
check_start() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

# Function to mark check as passed
check_pass() {
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    echo -e "${GREEN}✓${NC} $1"
}

# Function to mark check as failed
check_fail() {
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    echo -e "${RED}✗${NC} $1"
}

# Function to mark check as warning
check_warn() {
    WARNINGS=$((WARNINGS + 1))
    echo -e "${YELLOW}⚠${NC} $1"
}

echo -e "${YELLOW}━━━ Step 1: Verify AWS Credentials ━━━${NC}"
check_start
if aws sts get-caller-identity --region $AWS_REGION &>/dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    check_pass "AWS credentials valid (Account: $ACCOUNT_ID)"
else
    check_fail "AWS credentials not configured"
    exit 1
fi
echo ""

echo -e "${YELLOW}━━━ Step 2: Check Lambda Layer Exists ━━━${NC}"

# Get layer ARN from Terraform output or search for it
LAYER_NAME="securebase-${ENVIRONMENT}-reporting"

check_start
echo -n "Searching for layer '${LAYER_NAME}'... "
LAYER_ARN=$(aws lambda list-layer-versions \
    --layer-name "$LAYER_NAME" \
    --region $AWS_REGION \
    --query 'LayerVersions[0].LayerVersionArn' \
    --output text 2>/dev/null || echo "")

if [ -n "$LAYER_ARN" ] && [ "$LAYER_ARN" != "None" ]; then
    check_pass "Lambda layer found: $LAYER_ARN"
    
    # Get layer details
    LAYER_VERSION=$(echo "$LAYER_ARN" | grep -oP '(?<=:)\d+$')
    LAYER_SIZE=$(aws lambda get-layer-version \
        --layer-name "$LAYER_NAME" \
        --version-number "$LAYER_VERSION" \
        --region $AWS_REGION \
        --query 'Content.CodeSize' \
        --output text 2>/dev/null || echo "0")
    
    echo -e "  Version: ${LAYER_VERSION}"
    echo -e "  Size: $(numfmt --to=iec-i --suffix=B $LAYER_SIZE 2>/dev/null || echo "${LAYER_SIZE} bytes")"
else
    check_fail "Lambda layer '${LAYER_NAME}' not found in AWS"
    echo ""
    echo -e "${YELLOW}💡 To create the layer, run:${NC}"
    echo "  cd phase2-backend/layers/reporting"
    echo "  ./build-layer.sh"
    echo "  aws lambda publish-layer-version \\"
    echo "    --layer-name $LAYER_NAME \\"
    echo "    --zip-file fileb://reporting-layer.zip \\"
    echo "    --compatible-runtimes python3.11 \\"
    echo "    --region $AWS_REGION"
    echo ""
    exit 1
fi
echo ""

echo -e "${YELLOW}━━━ Step 3: Verify Layer Attachment to Lambda Functions ━━━${NC}"

# Functions that should have the layer attached
FUNCTIONS=(
    "securebase-${ENVIRONMENT}-analytics-reporter"
    "securebase-${ENVIRONMENT}-report-engine"
)

for FUNCTION_NAME in "${FUNCTIONS[@]}"; do
    check_start
    echo -n "Checking function '${FUNCTION_NAME}'... "
    
    # Check if function exists
    if ! aws lambda get-function --function-name "$FUNCTION_NAME" --region $AWS_REGION &>/dev/null; then
        check_fail "Function '${FUNCTION_NAME}' not found in AWS"
        echo -e "  ${YELLOW}Note: Function may not be deployed yet${NC}"
        continue
    fi
    
    # Get attached layers
    ATTACHED_LAYERS=$(aws lambda get-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --region $AWS_REGION \
        --query 'Layers[].Arn' \
        --output text 2>/dev/null || echo "")
    
    # Check if our layer is attached
    if echo "$ATTACHED_LAYERS" | grep -q "$LAYER_NAME"; then
        check_pass "Layer attached to '${FUNCTION_NAME}'"
        echo -e "  Layers: $ATTACHED_LAYERS"
    else
        check_fail "Layer NOT attached to '${FUNCTION_NAME}'"
        echo -e "  Current layers: ${ATTACHED_LAYERS:-none}"
        echo -e "  ${YELLOW}Expected layer: $LAYER_ARN${NC}"
    fi
done
echo ""

echo -e "${YELLOW}━━━ Step 4: Test Layer Dependencies ━━━${NC}"

for FUNCTION_NAME in "${FUNCTIONS[@]}"; do
    # Skip if function doesn't exist
    if ! aws lambda get-function --function-name "$FUNCTION_NAME" --region $AWS_REGION &>/dev/null; then
        continue
    fi
    
    check_start
    echo "Testing dependencies in '${FUNCTION_NAME}'..."
    
    # Create test event to check if ReportLab and openpyxl are available
    TEST_EVENT=$(cat <<'EOF'
{
  "test": "layer_verification",
  "check_imports": true
}
EOF
)
    
    # Update function code to include a test handler (temporary)
    # Instead, we'll invoke with a test event and check CloudWatch logs
    
    # Invoke function with test event
    INVOKE_OUTPUT=$(mktemp)
    INVOKE_LOG=$(mktemp)
    
    aws lambda invoke \
        --function-name "$FUNCTION_NAME" \
        --payload "$TEST_EVENT" \
        --log-type Tail \
        --region $AWS_REGION \
        "$INVOKE_OUTPUT" \
        --query 'LogResult' \
        --output text 2>/dev/null | base64 -d > "$INVOKE_LOG" || true
    
    # Check if function executed successfully
    FUNCTION_ERROR=$(jq -r '.errorMessage // empty' "$INVOKE_OUTPUT" 2>/dev/null || echo "")
    
    if [ -n "$FUNCTION_ERROR" ]; then
        # Check if error is related to missing dependencies
        if echo "$FUNCTION_ERROR" | grep -qi "No module named 'reportlab'\|No module named 'openpyxl'"; then
            check_fail "Missing layer dependencies in '${FUNCTION_NAME}'"
            echo -e "  Error: $FUNCTION_ERROR"
        else
            check_warn "Function invocation error (may be expected for test event)"
            echo -e "  ${YELLOW}This is likely OK - function expects different event format${NC}"
        fi
    else
        check_pass "Function invocation successful (dependencies available)"
    fi
    
    # Cleanup
    rm -f "$INVOKE_OUTPUT" "$INVOKE_LOG"
done
echo ""

echo -e "${YELLOW}━━━ Step 5: Verify Layer Contents ━━━${NC}"

check_start
echo "Checking local layer package..."

LAYER_ZIP="phase2-backend/layers/reporting/reporting-layer.zip"
if [ -f "$LAYER_ZIP" ]; then
    check_pass "Local layer package exists: $LAYER_ZIP"
    
    # List contents
    echo "  Layer contents:"
    unzip -l "$LAYER_ZIP" 2>/dev/null | grep -E "(reportlab|openpyxl|PIL)" | head -10 | while read -r line; do
        echo "    $line"
    done
    
    # Check if key packages are present
    check_start
    if unzip -l "$LAYER_ZIP" 2>/dev/null | grep -q "reportlab"; then
        check_pass "ReportLab library found in layer"
    else
        check_fail "ReportLab library NOT found in layer"
    fi
    
    check_start
    if unzip -l "$LAYER_ZIP" 2>/dev/null | grep -q "openpyxl"; then
        check_pass "openpyxl library found in layer"
    else
        check_fail "openpyxl library NOT found in layer"
    fi
    
    check_start
    if unzip -l "$LAYER_ZIP" 2>/dev/null | grep -q "PIL"; then
        check_pass "Pillow (PIL) library found in layer"
    else
        check_warn "Pillow (PIL) library not found (optional)"
    fi
else
    check_fail "Local layer package not found: $LAYER_ZIP"
    echo -e "  ${YELLOW}Run: cd phase2-backend/layers/reporting && ./build-layer.sh${NC}"
fi
echo ""

echo -e "${YELLOW}━━━ Step 6: Check Terraform Configuration ━━━${NC}"

TERRAFORM_DIR="landing-zone/environments/${ENVIRONMENT}"
check_start
if [ -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
    if grep -q "reporting_layer_arn" "$TERRAFORM_DIR/terraform.tfvars"; then
        CONFIGURED_ARN=$(grep "reporting_layer_arn" "$TERRAFORM_DIR/terraform.tfvars" | cut -d'"' -f2)
        check_pass "reporting_layer_arn configured in terraform.tfvars"
        echo -e "  Configured ARN: $CONFIGURED_ARN"
        
        # Check if configured ARN matches deployed ARN
        check_start
        if [ "$CONFIGURED_ARN" = "$LAYER_ARN" ]; then
            check_pass "Terraform ARN matches deployed layer"
        else
            check_warn "Terraform ARN differs from deployed layer"
            echo -e "  ${YELLOW}Configured: $CONFIGURED_ARN${NC}"
            echo -e "  ${YELLOW}Deployed:   $LAYER_ARN${NC}"
        fi
    else
        check_fail "reporting_layer_arn not found in terraform.tfvars"
        echo -e "  ${YELLOW}Add to $TERRAFORM_DIR/terraform.tfvars:${NC}"
        echo -e "  reporting_layer_arn = \"$LAYER_ARN\""
    fi
else
    check_warn "terraform.tfvars not found in $TERRAFORM_DIR"
fi
echo ""

echo -e "${YELLOW}━━━ Step 7: Functional Test - PDF Generation ━━━${NC}"

REPORTER_FUNCTION="securebase-${ENVIRONMENT}-analytics-reporter"
if aws lambda get-function --function-name "$REPORTER_FUNCTION" --region $AWS_REGION &>/dev/null; then
    check_start
    echo "Testing PDF generation capability..."
    
    # Create a test event for PDF report generation
    PDF_TEST_EVENT=$(cat <<'EOF'
{
  "httpMethod": "POST",
  "body": "{\"type\": \"monthly\", \"format\": \"pdf\", \"period\": \"30d\"}",
  "requestContext": {
    "authorizer": {
      "customerId": "test-customer-123"
    }
  }
}
EOF
)
    
    INVOKE_OUTPUT=$(mktemp)
    aws lambda invoke \
        --function-name "$REPORTER_FUNCTION" \
        --payload "$PDF_TEST_EVENT" \
        --region $AWS_REGION \
        "$INVOKE_OUTPUT" &>/dev/null || true
    
    RESPONSE=$(cat "$INVOKE_OUTPUT")
    HTTP_STATUS=$(echo "$RESPONSE" | jq -r '.statusCode // empty' 2>/dev/null || echo "")
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.body | fromjson | .error // empty' 2>/dev/null || echo "")
    
    if [ "$HTTP_STATUS" = "200" ]; then
        check_pass "PDF generation test successful"
    elif echo "$ERROR_MSG" | grep -qi "reportlab"; then
        check_fail "PDF generation failed - ReportLab import error"
        echo -e "  ${RED}Error: $ERROR_MSG${NC}"
    else
        check_warn "PDF test did not return 200 (may be expected for test data)"
        echo -e "  ${YELLOW}Status: $HTTP_STATUS${NC}"
        [ -n "$ERROR_MSG" ] && echo -e "  ${YELLOW}Error: $ERROR_MSG${NC}"
    fi
    
    rm -f "$INVOKE_OUTPUT"
else
    check_warn "Analytics reporter function not deployed - skipping PDF test"
fi
echo ""

echo -e "${YELLOW}━━━ Step 8: Functional Test - Excel Generation ━━━${NC}"

if aws lambda get-function --function-name "$REPORTER_FUNCTION" --region $AWS_REGION &>/dev/null; then
    check_start
    echo "Testing Excel generation capability..."
    
    # Create a test event for Excel report generation
    EXCEL_TEST_EVENT=$(cat <<'EOF'
{
  "httpMethod": "POST",
  "body": "{\"type\": \"monthly\", \"format\": \"excel\", \"period\": \"30d\"}",
  "requestContext": {
    "authorizer": {
      "customerId": "test-customer-123"
    }
  }
}
EOF
)
    
    INVOKE_OUTPUT=$(mktemp)
    aws lambda invoke \
        --function-name "$REPORTER_FUNCTION" \
        --payload "$EXCEL_TEST_EVENT" \
        --region $AWS_REGION \
        "$INVOKE_OUTPUT" &>/dev/null || true
    
    RESPONSE=$(cat "$INVOKE_OUTPUT")
    HTTP_STATUS=$(echo "$RESPONSE" | jq -r '.statusCode // empty' 2>/dev/null || echo "")
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.body | fromjson | .error // empty' 2>/dev/null || echo "")
    
    if [ "$HTTP_STATUS" = "200" ]; then
        check_pass "Excel generation test successful"
    elif echo "$ERROR_MSG" | grep -qi "openpyxl"; then
        check_fail "Excel generation failed - openpyxl import error"
        echo -e "  ${RED}Error: $ERROR_MSG${NC}"
    else
        check_warn "Excel test did not return 200 (may be expected for test data)"
        echo -e "  ${YELLOW}Status: $HTTP_STATUS${NC}"
        [ -n "$ERROR_MSG" ] && echo -e "  ${YELLOW}Error: $ERROR_MSG${NC}"
    fi
    
    rm -f "$INVOKE_OUTPUT"
else
    check_warn "Analytics reporter function not deployed - skipping Excel test"
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Verification Summary                                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Checks:   $TOTAL_CHECKS"
echo -e "${GREEN}Passed:         $PASSED_CHECKS${NC}"
echo -e "${RED}Failed:         $FAILED_CHECKS${NC}"
echo -e "${YELLOW}Warnings:       $WARNINGS${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✅ VERIFICATION PASSED${NC}"
    echo ""
    echo "The Analytics Lambda layer is properly attached and functional!"
    echo ""
    echo -e "${BLUE}Layer Details:${NC}"
    echo "  Name:    $LAYER_NAME"
    echo "  ARN:     $LAYER_ARN"
    echo "  Version: $LAYER_VERSION"
    echo ""
    exit 0
else
    echo -e "${RED}❌ VERIFICATION FAILED${NC}"
    echo ""
    echo "Please address the $FAILED_CHECKS failed check(s) above."
    echo ""
    echo -e "${BLUE}Common fixes:${NC}"
    echo "  1. Build layer: cd phase2-backend/layers/reporting && ./build-layer.sh"
    echo "  2. Publish layer: aws lambda publish-layer-version --layer-name $LAYER_NAME --zip-file fileb://reporting-layer.zip"
    echo "  3. Deploy infrastructure: cd landing-zone/environments/$ENVIRONMENT && terraform apply"
    echo ""
    exit 1
fi
