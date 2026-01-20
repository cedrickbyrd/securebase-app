#!/bin/bash
# Deploy Analytics Module - Phase 4
# Complete deployment of Advanced Analytics & Reporting

set -e

echo "🚀 Deploying Phase 4: Advanced Analytics & Reporting"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}
WORKSPACE_ROOT="/workspaces/securebase-app"

echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Region:${NC} $AWS_REGION"
echo ""

# Step 1: Build Lambda Layer for ReportLab/openpyxl
echo -e "${YELLOW}Step 1: Building Lambda Layer...${NC}"
cd "$WORKSPACE_ROOT/phase2-backend/layers/reporting"

if [ ! -f "build-layer.sh" ]; then
    echo "❌ build-layer.sh not found"
    exit 1
fi

chmod +x build-layer.sh
./build-layer.sh

if [ ! -f "reporting-layer.zip" ]; then
    echo "❌ Layer build failed"
    exit 1
fi

echo -e "${GREEN}✓ Lambda layer built${NC}"
echo ""

# Step 2: Publish Lambda Layer to AWS
echo -e "${YELLOW}Step 2: Publishing Lambda Layer...${NC}"

LAYER_VERSION=$(aws lambda publish-layer-version \
    --layer-name "securebase-$ENVIRONMENT-reporting" \
    --description "ReportLab + openpyxl for report generation (Phase 4)" \
    --zip-file fileb://reporting-layer.zip \
    --compatible-runtimes python3.11 \
    --region $AWS_REGION \
    --query 'LayerVersionArn' \
    --output text)

if [ -z "$LAYER_VERSION" ]; then
    echo "❌ Layer publish failed"
    exit 1
fi

echo -e "${GREEN}✓ Lambda layer published${NC}"
echo -e "  ARN: $LAYER_VERSION"
echo ""

# Step 3: Package Lambda Function
echo -e "${YELLOW}Step 3: Packaging report_engine Lambda...${NC}"
cd "$WORKSPACE_ROOT/phase2-backend/functions"

# Create deployment directory
mkdir -p ../deploy

# Zip the Lambda function
zip -r ../deploy/report_engine.zip report_engine.py

if [ ! -f "../deploy/report_engine.zip" ]; then
    echo "❌ Lambda packaging failed"
    exit 1
fi

echo -e "${GREEN}✓ Lambda packaged${NC}"
echo ""

# Step 4: Deploy Infrastructure with Terraform
echo -e "${YELLOW}Step 4: Deploying Terraform Infrastructure...${NC}"
cd "$WORKSPACE_ROOT/landing-zone"

# Initialize Terraform (if needed)
if [ ! -d ".terraform" ]; then
    terraform init
fi

# Add layer ARN to terraform.tfvars (or create if doesn't exist)
TFVARS_FILE="terraform.tfvars"
if grep -q "reporting_layer_arn" $TFVARS_FILE 2>/dev/null; then
    # Update existing
    sed -i "s|reporting_layer_arn.*|reporting_layer_arn = \"$LAYER_VERSION\"|" $TFVARS_FILE
else
    # Add new
    echo "" >> $TFVARS_FILE
    echo "# Phase 4: Analytics Lambda Layer" >> $TFVARS_FILE
    echo "reporting_layer_arn = \"$LAYER_VERSION\"" >> $TFVARS_FILE
fi

# Plan
echo ""
echo -e "${BLUE}Running terraform plan...${NC}"
terraform plan -out=analytics.tfplan

# Confirm
read -p "Apply Terraform changes? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Apply
terraform apply analytics.tfplan
rm analytics.tfplan

echo -e "${GREEN}✓ Terraform deployed${NC}"
echo ""

# Step 5: Get API Gateway Endpoint
echo -e "${YELLOW}Step 5: Retrieving API Endpoints...${NC}"

API_ENDPOINT=$(terraform output -raw api_gateway_endpoint 2>/dev/null || echo "Not available")

echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo ""
echo "=================================================="
echo "📊 Analytics Module Deployed"
echo "=================================================="
echo ""
echo "🌐 API Endpoints:"
echo "  Base URL: $API_ENDPOINT"
echo "  GET  $API_ENDPOINT/analytics"
echo "  POST $API_ENDPOINT/analytics"
echo "  GET  $API_ENDPOINT/analytics/reports"
echo "  POST $API_ENDPOINT/analytics/reports"
echo ""
echo "📦 DynamoDB Tables:"
echo "  - securebase-$ENVIRONMENT-reports"
echo "  - securebase-$ENVIRONMENT-report-schedules"
echo "  - securebase-$ENVIRONMENT-report-cache"
echo "  - securebase-$ENVIRONMENT-metrics"
echo ""
echo "🪣 S3 Bucket:"
echo "  - securebase-$ENVIRONMENT-reports-*"
echo ""
echo "🔧 Lambda Functions:"
echo "  - securebase-$ENVIRONMENT-report-engine"
echo ""
echo "📚 Next Steps:"
echo "  1. Test API endpoints with: curl -X GET $API_ENDPOINT/analytics -H 'Authorization: Bearer TOKEN'"
echo "  2. Open frontend: cd phase3a-portal && npm run dev"
echo "  3. Navigate to Analytics tab in customer portal"
echo ""
