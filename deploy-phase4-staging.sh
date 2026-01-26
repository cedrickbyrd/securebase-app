#!/bin/bash
# Deploy Phase 4 Analytics to Staging Environment
# Complete deployment of Advanced Analytics & Reporting to AWS Staging

set -e

echo "🚀 Deploying Phase 4 Analytics to STAGING Environment"
echo "======================================================="

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
echo -e "${BLUE}Workspace:${NC} $WORKSPACE_ROOT"
echo ""

# Pre-flight checks
echo -e "${YELLOW}Pre-flight Checks...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS CLI installed${NC}"

# Check Terraform
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform not found. Please install Terraform.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Terraform installed${NC}"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS credentials configured${NC}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${BLUE}AWS Account:${NC} $ACCOUNT_ID"
echo ""

# Step 1: Verify Lambda Layer (already built)
echo -e "${YELLOW}Step 1: Verifying Lambda Layer...${NC}"
cd "$WORKSPACE_ROOT/phase2-backend/layers/reporting"

if [ ! -f "reporting-layer.zip" ]; then
    echo -e "${YELLOW}Building Lambda layer...${NC}"
    chmod +x build-layer.sh
    ./build-layer.sh
fi

LAYER_SIZE=$(du -h reporting-layer.zip | cut -f1)
echo -e "${GREEN}✓ Lambda layer ready ($LAYER_SIZE)${NC}"
echo ""

# Step 2: Publish Lambda Layer to AWS Staging
echo -e "${YELLOW}Step 2: Publishing Lambda Layer to AWS Staging...${NC}"

LAYER_VERSION=$(aws lambda publish-layer-version \
    --layer-name "securebase-${ENVIRONMENT}-reporting" \
    --description "ReportLab + openpyxl for report generation (Phase 4 Staging)" \
    --zip-file fileb://reporting-layer.zip \
    --compatible-runtimes python3.11 \
    --region $AWS_REGION \
    --query 'LayerVersionArn' \
    --output text 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Layer publish failed: $LAYER_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Lambda layer published${NC}"
echo -e "  ${BLUE}ARN:${NC} $LAYER_VERSION"
echo ""

# Step 3: Verify Lambda Function Package
echo -e "${YELLOW}Step 3: Verifying Lambda Function Package...${NC}"
cd "$WORKSPACE_ROOT/phase2-backend/deploy"

if [ ! -f "report_engine.zip" ]; then
    echo -e "${YELLOW}Packaging report_engine Lambda...${NC}"
    cd ../functions
    zip -r ../deploy/report_engine.zip report_engine.py
fi

LAMBDA_SIZE=$(du -h report_engine.zip | cut -f1)
echo -e "${GREEN}✓ Lambda package ready ($LAMBDA_SIZE)${NC}"
echo ""

# Step 4: Update Terraform Variables with Layer ARN
echo -e "${YELLOW}Step 4: Updating Terraform Variables...${NC}"
cd "$WORKSPACE_ROOT/landing-zone/environments/staging"

# Add or update reporting_layer_arn in terraform.tfvars
if grep -q "reporting_layer_arn" terraform.tfvars 2>/dev/null; then
    # Update existing
    sed -i.bak "s|reporting_layer_arn.*|reporting_layer_arn = \"$LAYER_VERSION\"|" terraform.tfvars
else
    # Add new
    echo "" >> terraform.tfvars
    echo "# Phase 4: Analytics Lambda Layer" >> terraform.tfvars
    echo "reporting_layer_arn = \"$LAYER_VERSION\"" >> terraform.tfvars
fi

echo -e "${GREEN}✓ Terraform variables updated${NC}"
echo ""

# Step 5: Initialize Terraform
echo -e "${YELLOW}Step 5: Initializing Terraform...${NC}"

if [ ! -d ".terraform" ]; then
    terraform init -backend-config=backend.hcl
else
    terraform init -upgrade
fi

echo -e "${GREEN}✓ Terraform initialized${NC}"
echo ""

# Step 6: Validate Terraform
echo -e "${YELLOW}Step 6: Validating Terraform Configuration...${NC}"
terraform validate

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Terraform validation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Terraform configuration valid${NC}"
echo ""

# Step 7: Terraform Plan
echo -e "${YELLOW}Step 7: Running Terraform Plan...${NC}"
terraform plan -out=staging-analytics.tfplan

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Terraform plan failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Terraform plan created: staging-analytics.tfplan${NC}"
echo ""

# Step 8: Confirm and Apply
echo -e "${YELLOW}Step 8: Ready to Deploy Infrastructure${NC}"
echo -e "${BLUE}This will create the following resources in AWS:${NC}"
echo "  • 4 DynamoDB Tables (reports, schedules, cache, metrics)"
echo "  • 1 S3 Bucket (report exports)"
echo "  • 1 Lambda Function (report-engine)"
echo "  • CloudWatch Log Group"
echo "  • IAM Roles and Policies"
echo ""

read -p "Apply Terraform changes? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled. Run this script again when ready.${NC}"
    exit 0
fi

terraform apply staging-analytics.tfplan
rm -f staging-analytics.tfplan

echo -e "${GREEN}✓ Terraform applied successfully${NC}"
echo ""

# Step 9: Retrieve Outputs
echo -e "${YELLOW}Step 9: Retrieving Deployment Information...${NC}"

API_ENDPOINT=$(terraform output -raw api_gateway_endpoint 2>/dev/null || echo "Not available")
REPORT_ENGINE_ARN=$(terraform output -raw analytics_report_engine_arn 2>/dev/null || echo "Not available")

echo -e "${GREEN}✓ Deployment outputs retrieved${NC}"
echo ""

# Step 10: Verify Deployment
echo -e "${YELLOW}Step 10: Verifying Deployment...${NC}"

echo -e "${BLUE}Checking DynamoDB tables...${NC}"
TABLES=$(aws dynamodb list-tables --region $AWS_REGION --query "TableNames[?contains(@, 'securebase-staging')]" --output text)
TABLE_COUNT=$(echo "$TABLES" | wc -w)
echo -e "  Found ${TABLE_COUNT} tables: ${TABLES}"

echo -e "${BLUE}Checking Lambda function...${NC}"
LAMBDA_STATUS=$(aws lambda get-function --function-name "securebase-staging-report-engine" --region $AWS_REGION --query 'Configuration.State' --output text 2>/dev/null || echo "Not found")
echo -e "  Status: ${LAMBDA_STATUS}"

echo -e "${BLUE}Checking S3 bucket...${NC}"
S3_BUCKET=$(aws s3 ls | grep "securebase-staging-reports" || echo "Not found")
echo -e "  Bucket: ${S3_BUCKET}"

echo ""
echo -e "${GREEN}✓✓✓ Deployment Complete! ✓✓✓${NC}"
echo ""
echo "================================================================"
echo "📊 Phase 4 Analytics - Staging Environment Deployed"
echo "================================================================"
echo ""
echo "🌐 API Endpoints:"
echo "  Base URL: $API_ENDPOINT"
echo "  GET  $API_ENDPOINT/analytics"
echo "  POST $API_ENDPOINT/analytics"
echo "  GET  $API_ENDPOINT/analytics/reports"
echo "  POST $API_ENDPOINT/analytics/reports"
echo ""
echo "📦 DynamoDB Tables:"
echo "  - securebase-staging-reports"
echo "  - securebase-staging-report-schedules"
echo "  - securebase-staging-report-cache"
echo "  - securebase-staging-metrics"
echo ""
echo "🪣 S3 Bucket:"
echo "  - securebase-staging-reports-${ACCOUNT_ID}"
echo ""
echo "🔧 Lambda Function:"
echo "  - securebase-staging-report-engine"
echo "  ARN: $REPORT_ENGINE_ARN"
echo ""
echo "📚 Next Steps:"
echo "  1. Run integration tests: cd $WORKSPACE_ROOT && ./test-phase4-staging.sh"
echo "  2. Test API endpoints (see PHASE4_TESTING_GUIDE.md)"
echo "  3. Update frontend: phase3a-portal/.env (VITE_API_BASE_URL=$API_ENDPOINT)"
echo "  4. Review CloudWatch logs: /aws/lambda/securebase-staging-report-engine"
echo ""
echo "💰 Cost Tracking:"
echo "  - Target: <$50/month for staging"
echo "  - Monitor: AWS Cost Explorer (tag: Environment=staging)"
echo ""
echo "🔄 Rollback Plan:"
echo "  If issues found: cd landing-zone/environments/staging && terraform destroy"
echo ""
