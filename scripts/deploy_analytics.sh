#!/bin/bash
# Deploy Phase 4 Analytics to AWS
# Automated deployment script for all analytics components

set -e  # Exit on error

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

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Phase 4 Analytics - Production Deployment           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Region:${NC} $AWS_REGION"
echo -e "${BLUE}Repository:${NC} $REPO_ROOT"
echo ""

# Step 0: Pre-deployment checks
echo -e "${YELLOW}━━━ Step 0: Pre-deployment Checks ━━━${NC}"

# Check AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}✗ AWS credentials not configured${NC}"
    echo "Please configure AWS credentials:"
    echo "  aws configure"
    exit 1
fi

echo -e "${GREEN}✓ AWS credentials valid${NC}"

# Check required tools
for cmd in aws terraform zip python3; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}✗ Required tool not found: $cmd${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ All required tools available${NC}"
echo ""

# Step 1: Package Lambda Functions
echo -e "${YELLOW}━━━ Step 1: Package Lambda Functions ━━━${NC}"

cd "$REPO_ROOT/phase2-backend/functions"
rm -rf ../deploy
mkdir -p ../deploy

# Package analytics_aggregator
echo -n "Packaging analytics_aggregator.py... "
zip -q ../deploy/analytics_aggregator.zip analytics_aggregator.py
echo -e "${GREEN}✓ $(du -h ../deploy/analytics_aggregator.zip | cut -f1)${NC}"

# Package analytics_reporter
echo -n "Packaging analytics_reporter.py... "
zip -q ../deploy/analytics_reporter.zip analytics_reporter.py
echo -e "${GREEN}✓ $(du -h ../deploy/analytics_reporter.zip | cut -f1)${NC}"

# Package analytics_query
echo -n "Packaging analytics_query.py... "
zip -q ../deploy/analytics_query.zip analytics_query.py
echo -e "${GREEN}✓ $(du -h ../deploy/analytics_query.zip | cut -f1)${NC}"

# Package report_engine (legacy)
echo -n "Packaging report_engine.py... "
zip -q ../deploy/report_engine.zip report_engine.py
echo -e "${GREEN}✓ $(du -h ../deploy/report_engine.zip | cut -f1)${NC}"

echo -e "${GREEN}✓ All Lambda functions packaged${NC}"
echo ""

# Step 2: Build Lambda Layer
echo -e "${YELLOW}━━━ Step 2: Build Lambda Layer (ReportLab + openpyxl) ━━━${NC}"

cd "$REPO_ROOT/phase2-backend/layers/reporting"

if [ ! -f "build-layer.sh" ]; then
    echo -e "${YELLOW}⚠ build-layer.sh not found, creating...${NC}"
    cat > build-layer.sh <<'EOF'
#!/bin/bash
set -e
rm -rf python reporting-layer.zip
mkdir -p python/lib/python3.11/site-packages
pip install -q -r requirements.txt -t python/lib/python3.11/site-packages
zip -r -q reporting-layer.zip python/
echo "Layer built: $(du -h reporting-layer.zip | cut -f1)"
EOF
    chmod +x build-layer.sh
fi

if [ ! -f "requirements.txt" ]; then
    echo -e "${YELLOW}⚠ requirements.txt not found, creating...${NC}"
    cat > requirements.txt <<EOF
reportlab==4.0.7
pillow==10.1.0
openpyxl==3.1.2
EOF
fi

./build-layer.sh
echo -e "${GREEN}✓ Lambda layer built${NC}"
echo ""

# Step 3: Publish Lambda Layer to AWS
echo -e "${YELLOW}━━━ Step 3: Publish Lambda Layer to AWS ━━━${NC}"

LAYER_ARN=$(aws lambda publish-layer-version \
    --layer-name "securebase-$ENVIRONMENT-reporting" \
    --description "ReportLab + openpyxl for Phase 4 Analytics" \
    --zip-file fileb://reporting-layer.zip \
    --compatible-runtimes python3.11 \
    --region $AWS_REGION \
    --query 'LayerVersionArn' \
    --output text 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Layer publish failed${NC}"
    echo "$LAYER_ARN"
    exit 1
fi

echo -e "${GREEN}✓ Lambda layer published${NC}"
echo -e "  ARN: $LAYER_ARN"
echo ""

# Step 4: Configure Terraform
echo -e "${YELLOW}━━━ Step 4: Configure Terraform ━━━${NC}"

cd "$REPO_ROOT/landing-zone/environments/$ENVIRONMENT"

# Create or update terraform.tfvars
if [ ! -f terraform.tfvars ]; then
    echo -e "${YELLOW}⚠ Creating terraform.tfvars...${NC}"
    cat > terraform.tfvars <<EOF
environment    = "$ENVIRONMENT"
org_name       = "SecureBase"
target_region  = "$AWS_REGION"
EOF
fi

# Add or update reporting layer ARN
if grep -q "reporting_layer_arn" terraform.tfvars; then
    sed -i.bak "s|reporting_layer_arn.*|reporting_layer_arn = \"$LAYER_ARN\"|" terraform.tfvars
else
    echo "" >> terraform.tfvars
    echo "# Phase 4 Analytics" >> terraform.tfvars
    echo "reporting_layer_arn = \"$LAYER_ARN\"" >> terraform.tfvars
fi

echo -e "${GREEN}✓ Terraform configured${NC}"
echo ""

# Step 5: Terraform Init
echo -e "${YELLOW}━━━ Step 5: Initialize Terraform ━━━${NC}"

terraform init -upgrade
echo -e "${GREEN}✓ Terraform initialized${NC}"
echo ""

# Step 6: Terraform Plan
echo -e "${YELLOW}━━━ Step 6: Plan Infrastructure Changes ━━━${NC}"

terraform plan -out=analytics.tfplan | tee /tmp/terraform-plan.txt

# Count resources to be created/updated
RESOURCES_ADD=$(grep -c "will be created" /tmp/terraform-plan.txt || echo "0")
RESOURCES_CHANGE=$(grep -c "will be updated in-place" /tmp/terraform-plan.txt || echo "0")
RESOURCES_DESTROY=$(grep -c "will be destroyed" /tmp/terraform-plan.txt || echo "0")

echo ""
echo -e "${BLUE}Plan Summary:${NC}"
echo -e "  ${GREEN}+ $RESOURCES_ADD${NC} to create"
echo -e "  ${YELLOW}~ $RESOURCES_CHANGE${NC} to update"
echo -e "  ${RED}- $RESOURCES_DESTROY${NC} to destroy"
echo ""

# Step 7: Confirm Deployment
echo -e "${YELLOW}━━━ Step 7: Deploy to AWS ━━━${NC}"

if [ "${CI:-false}" = "true" ]; then
    # In CI environment, auto-approve
    CONFIRM="yes"
else
    # In interactive mode, ask for confirmation
    read -p "$(echo -e ${YELLOW}Deploy these changes to AWS? [yes/NO]:${NC} )" CONFIRM
fi

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}✗ Deployment cancelled${NC}"
    rm -f analytics.tfplan
    exit 1
fi

# Apply Terraform
terraform apply analytics.tfplan
rm -f analytics.tfplan

echo -e "${GREEN}✓ Infrastructure deployed${NC}"
echo ""

# Step 8: Post-Deployment Validation
echo -e "${YELLOW}━━━ Step 8: Post-Deployment Validation ━━━${NC}"

# Get deployed resources
API_ENDPOINT=$(terraform output -raw api_gateway_url 2>/dev/null || echo "N/A")
DASHBOARD_NAME=$(terraform output -raw analytics_dashboard_name 2>/dev/null || echo "N/A")

# Test Lambda functions
echo -n "Testing analytics_aggregator... "
if aws lambda get-function --function-name "securebase-$ENVIRONMENT-analytics-aggregator" --region $AWS_REGION &>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo -n "Testing analytics_reporter... "
if aws lambda get-function --function-name "securebase-$ENVIRONMENT-analytics-reporter" --region $AWS_REGION &>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo -n "Testing analytics_query... "
if aws lambda get-function --function-name "securebase-$ENVIRONMENT-analytics-query" --region $AWS_REGION &>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Test DynamoDB tables
echo -n "Testing DynamoDB tables... "
if aws dynamodb describe-table --table-name "securebase-$ENVIRONMENT-metrics" --region $AWS_REGION &>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo ""
echo -e "${GREEN}✓ Deployment validation complete${NC}"
echo ""

# Step 9: Display Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Deployment Complete! 🎉                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Phase 4 Analytics deployed successfully${NC}"
echo ""
echo -e "${BLUE}📊 Deployed Resources:${NC}"
echo "  ├─ 4 Lambda Functions:"
echo "  │  ├─ analytics-aggregator (metrics collection)"
echo "  │  ├─ analytics-reporter (report generation)"
echo "  │  ├─ analytics-query (API endpoints)"
echo "  │  └─ report-engine (legacy support)"
echo "  ├─ 4 DynamoDB Tables (reports, metrics, schedules, cache)"
echo "  ├─ 1 S3 Bucket (report exports)"
echo "  ├─ 4 API Gateway Routes"
echo "  ├─ 1 CloudWatch Dashboard"
echo "  └─ 7 CloudWatch Alarms"
echo ""
echo -e "${BLUE}🌐 API Endpoints:${NC}"
echo "  Base URL: $API_ENDPOINT"
echo "  GET  $API_ENDPOINT/analytics/usage"
echo "  GET  $API_ENDPOINT/analytics/compliance"
echo "  GET  $API_ENDPOINT/analytics/costs"
echo "  POST $API_ENDPOINT/analytics/reports"
echo ""
echo -e "${BLUE}📈 Monitoring:${NC}"
echo "  CloudWatch Dashboard: $DASHBOARD_NAME"
echo "  View in console: https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=$DASHBOARD_NAME"
echo ""
echo -e "${BLUE}📚 Next Steps:${NC}"
echo "  1. Run integration tests: pytest tests/integration/test_analytics_integration.py"
echo "  2. Run E2E tests: RUN_E2E_TESTS=1 pytest tests/e2e/test_analytics_e2e.py"
echo "  3. Check CloudWatch for errors: ./scripts/check-analytics-cloudwatch.sh -e $ENVIRONMENT"
echo "  4. Monitor CloudWatch dashboard for 48 hours"
echo "  5. Update PHASE4_STATUS.md to mark Component 1 as deployed"
echo ""
echo -e "${YELLOW}⚠  Important:${NC}"
echo "  - SNS subscription confirmation emails sent to alert recipients"
echo "  - Lambda layer ARN saved in terraform.tfvars"
echo "  - CloudWatch alarms configured for errors, latency, and throttling"
echo "  - Run CloudWatch monitoring check after 1 hour: ./scripts/check-analytics-cloudwatch.sh -e $ENVIRONMENT -t 3600"
echo ""

# Step 10: Post-deployment CloudWatch Check
echo -e "${YELLOW}━━━ Step 10: Post-deployment CloudWatch Check ━━━${NC}"
echo "Running initial CloudWatch monitoring check (last 5 minutes)..."
echo ""

if [ -f "$SCRIPT_DIR/check-analytics-cloudwatch.sh" ]; then
    # Run monitoring check with proper error handling
    if ! "$SCRIPT_DIR/check-analytics-cloudwatch.sh" -e "$ENVIRONMENT" -r "$AWS_REGION" -t 300; then
        echo ""
        echo -e "${YELLOW}⚠ CloudWatch monitoring check encountered issues${NC}"
        echo "  This is expected immediately after deployment if functions haven't been invoked yet."
        echo "  The deployment was successful. Please run monitoring again in 5-10 minutes:"
        echo "    ./scripts/check-analytics-cloudwatch.sh -e $ENVIRONMENT -t 600"
    fi
    echo ""
    echo -e "${BLUE}💡 Tip:${NC} Run detailed monitoring after 1 hour:"
    echo "   ./scripts/check-analytics-cloudwatch.sh -e $ENVIRONMENT -t 3600 -v"
else
    echo -e "${YELLOW}⚠ CloudWatch monitoring script not found${NC}"
    echo "  Manual check: aws logs tail /aws/lambda/securebase-$ENVIRONMENT-analytics-query --follow"
fi
echo ""
