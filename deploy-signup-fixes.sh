#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SecureBase Signup Handler Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not found${NC}"
    exit 1
fi

# Set environment
ENVIRONMENT="${1:-dev}"
AWS_REGION="${2:-us-east-1}"

echo -e "\n${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Region: ${AWS_REGION}${NC}\n"

echo -e "${GREEN}Step 1: Packaging Lambda functions...${NC}"

# Create deployment package
PACKAGE_DIR="lambda-package"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Copy Lambda code
cp lambda/signup_handler.py "$PACKAGE_DIR/"
cp lambda/db.py "$PACKAGE_DIR/"

# Install dependencies
pip install -t "$PACKAGE_DIR" pg8000 boto3 --upgrade --quiet

# Create zip
cd "$PACKAGE_DIR"
zip -r ../signup_handler.zip . -q
cd ..

echo -e "${GREEN}✓ Lambda package created${NC}"

echo -e "\n${GREEN}Step 2: Deploying Lambda function...${NC}"

LAMBDA_FUNCTION_NAME="securebase-${ENVIRONMENT}-signup-handler"

aws lambda update-function-code \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --zip-file fileb://signup_handler.zip \
    --region "$AWS_REGION"

echo -e "${GREEN}✓ Lambda function updated${NC}"

echo -e "\n${GREEN}Step 3: Waiting for update...${NC}"
aws lambda wait function-updated \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION"

echo -e "\n${GREEN}Deployment Complete!${NC}"

# Cleanup
rm -rf "$PACKAGE_DIR" signup_handler.zip

echo -e "\n${YELLOW}Next: Run database migration manually:${NC}"
echo -e "psql -h YOUR_RDS_HOST -U YOUR_USER -d securebase \\"
echo -e "  -f phase2-backend/database/migrations/004_unify_customer_schema.sql"
