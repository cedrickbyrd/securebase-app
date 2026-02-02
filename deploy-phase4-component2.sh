#!/bin/bash
# Deploy Phase 4 Component 2: Team Collaboration & RBAC
# Deploys user management, session management, and RBAC infrastructure

set -e

echo "🚀 Deploying Phase 4 Component 2: Team Collaboration & RBAC"
echo "============================================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${ENVIRONMENT:-dev}"
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

# Step 1: Package Lambda Functions
echo -e "${YELLOW}Step 1/7: Packaging Lambda Functions...${NC}"
cd "$WORKSPACE_ROOT/phase2-backend/functions"

# Create deploy directory if it doesn't exist
mkdir -p ../deploy

# Package user_management
echo "  Packaging user_management.py..."
zip -j ../deploy/user_management.zip user_management.py
USER_MGT_SIZE=$(du -h ../deploy/user_management.zip | cut -f1)
echo -e "    ${GREEN}✓${NC} user_management.zip ($USER_MGT_SIZE)"

# Package session_management
echo "  Packaging session_management.py..."
zip -j ../deploy/session_management.zip session_management.py
SESSION_SIZE=$(du -h ../deploy/session_management.zip | cut -f1)
echo -e "    ${GREEN}✓${NC} session_management.zip ($SESSION_SIZE)"

# Package rbac_engine as permission_management (Terraform expects this name)
echo "  Packaging rbac_engine.py as permission_management.zip..."
zip -j ../deploy/permission_management.zip rbac_engine.py
RBAC_SIZE=$(du -h ../deploy/permission_management.zip | cut -f1)
echo -e "    ${GREEN}✓${NC} permission_management.zip ($RBAC_SIZE)"

echo -e "${GREEN}✓ All Lambda functions packaged${NC}"
echo ""

# Step 2: Verify Database Schema
echo -e "${YELLOW}Step 2/7: Verifying Database Schema...${NC}"
cd "$WORKSPACE_ROOT/phase2-backend/database"

if [ ! -f "rbac_schema.sql" ]; then
    echo -e "${RED}❌ rbac_schema.sql not found${NC}"
    exit 1
fi

SCHEMA_SIZE=$(wc -l < rbac_schema.sql)
echo -e "${GREEN}✓ RBAC schema found ($SCHEMA_SIZE lines)${NC}"
echo ""

# Step 3: Check JWT Secret (create if needed)
echo -e "${YELLOW}Step 3/7: Checking JWT Secret...${NC}"

JWT_SECRET_NAME="securebase/${ENVIRONMENT}/jwt-secret"
if aws secretsmanager describe-secret --secret-id "$JWT_SECRET_NAME" --region $AWS_REGION &>/dev/null; then
    echo -e "${GREEN}✓ JWT secret exists${NC}"
else
    echo -e "${YELLOW}  Creating JWT secret...${NC}"
    
    # Generate a secure random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    aws secretsmanager create-secret \
        --name "$JWT_SECRET_NAME" \
        --description "JWT signing secret for SecureBase $ENVIRONMENT" \
        --secret-string "$JWT_SECRET" \
        --region $AWS_REGION \
        --tags Key=Environment,Value=$ENVIRONMENT Key=Component,Value=RBAC \
        &>/dev/null
    
    echo -e "${GREEN}✓ JWT secret created${NC}"
fi

JWT_SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "$JWT_SECRET_NAME" --region $AWS_REGION --query ARN --output text)
echo -e "  ${BLUE}ARN:${NC} $JWT_SECRET_ARN"
echo ""

# Step 4: Update Terraform Configuration
echo -e "${YELLOW}Step 4/7: Updating Terraform Configuration...${NC}"
cd "$WORKSPACE_ROOT/landing-zone/environments/$ENVIRONMENT"

# Check if main.tf has RBAC module
if grep -q "module \"rbac\"" main.tf; then
    echo -e "${GREEN}✓ RBAC module already configured in main.tf${NC}"
else
    echo -e "${YELLOW}  Adding RBAC module to main.tf...${NC}"
    
    # Add RBAC module after analytics module
    cat >> main.tf << 'EOF'

# Phase 4 Component 2: Team Collaboration & RBAC Module
module "rbac" {
  source = "../../modules/rbac"
  
  environment          = var.environment
  database_endpoint    = module.securebase.aurora_endpoint
  database_name        = "securebase"
  database_secret_arn  = module.securebase.db_secret_arn
  jwt_secret_arn       = var.jwt_secret_arn
  tags                 = var.tags
}
EOF
    echo -e "${GREEN}✓ RBAC module added to main.tf${NC}"
fi

# Add JWT secret ARN to variables if not present
if ! grep -q "jwt_secret_arn" variables.tf; then
    echo -e "${YELLOW}  Adding jwt_secret_arn variable...${NC}"
    
    cat >> variables.tf << 'EOF'

variable "jwt_secret_arn" {
  description = "ARN of JWT secret in AWS Secrets Manager"
  type        = string
  default     = ""
}
EOF
    echo -e "${GREEN}✓ jwt_secret_arn variable added${NC}"
fi

# Create or update terraform.tfvars
if [ ! -f "terraform.tfvars" ]; then
    cp terraform.tfvars.example terraform.tfvars 2>/dev/null || touch terraform.tfvars
fi

# Add jwt_secret_arn to tfvars if not present
if ! grep -q "jwt_secret_arn" terraform.tfvars; then
    echo "" >> terraform.tfvars
    echo "# Phase 4 Component 2: JWT Secret" >> terraform.tfvars
    echo "jwt_secret_arn = \"$JWT_SECRET_ARN\"" >> terraform.tfvars
else
    # Update existing
    sed -i.bak "s|jwt_secret_arn.*|jwt_secret_arn = \"$JWT_SECRET_ARN\"|" terraform.tfvars
fi

echo -e "${GREEN}✓ Terraform configuration updated${NC}"
echo ""

# Step 5: Initialize Terraform
echo -e "${YELLOW}Step 5/7: Initializing Terraform...${NC}"

terraform init -upgrade

echo -e "${GREEN}✓ Terraform initialized${NC}"
echo ""

# Step 6: Terraform Plan
echo -e "${YELLOW}Step 6/7: Running Terraform Plan...${NC}"
terraform plan -out=component2.tfplan

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Terraform plan failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Terraform plan created: component2.tfplan${NC}"
echo ""

# Step 7: Confirm and Apply
echo -e "${YELLOW}Step 7/7: Ready to Deploy Infrastructure${NC}"
echo -e "${BLUE}This will create the following resources in AWS:${NC}"
echo "  • 3 DynamoDB Tables (user-sessions, user-invites, activity-feed)"
echo "  • 3 Lambda Functions (user-management, session-management, permission-management)"
echo "  • CloudWatch Log Groups"
echo "  • IAM Roles and Policies"
echo ""

read -p "Apply Terraform changes? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled. Run this script again when ready.${NC}"
    exit 0
fi

terraform apply component2.tfplan
rm -f component2.tfplan

echo -e "${GREEN}✓ Terraform applied successfully${NC}"
echo ""

# Step 8: Initialize Database Schema
echo -e "${YELLOW}Step 8/7 (Bonus): Initializing Database Schema...${NC}"
echo -e "${YELLOW}Note: This requires database access. You may need to run manually.${NC}"
echo ""
echo "To initialize the RBAC schema, run:"
echo -e "${BLUE}  cd $WORKSPACE_ROOT/phase2-backend/database${NC}"
echo -e "${BLUE}  psql -h <aurora-endpoint> -U securebase_app -d securebase -f rbac_schema.sql${NC}"
echo ""

# Step 9: Retrieve Outputs
echo -e "${YELLOW}Step 9/7: Retrieving Deployment Information...${NC}"

echo -e "${BLUE}DynamoDB Tables:${NC}"
aws dynamodb list-tables --region $AWS_REGION --query "TableNames[?contains(@, 'securebase-${ENVIRONMENT}')]" --output table

echo ""
echo -e "${BLUE}Lambda Functions:${NC}"
aws lambda list-functions --region $AWS_REGION --query "Functions[?contains(FunctionName, 'securebase-${ENVIRONMENT}')].FunctionName" --output table

echo ""
echo -e "${GREEN}✓✓✓ Deployment Complete! ✓✓✓${NC}"
echo ""
echo "================================================================"
echo "🎉 Phase 4 Component 2: Team Collaboration & RBAC Deployed"
echo "================================================================"
echo ""
echo "📦 DynamoDB Tables:"
echo "  - securebase-${ENVIRONMENT}-user-sessions"
echo "  - securebase-${ENVIRONMENT}-user-invites"
echo "  - securebase-${ENVIRONMENT}-activity-feed"
echo ""
echo "🔧 Lambda Functions:"
echo "  - securebase-${ENVIRONMENT}-user-management"
echo "  - securebase-${ENVIRONMENT}-session-management"
echo "  - securebase-${ENVIRONMENT}-permission-management"
echo ""
echo "🔐 Secrets:"
echo "  - JWT Secret: $JWT_SECRET_NAME"
echo ""
echo "📚 Next Steps:"
echo "  1. Initialize database schema (see Step 8 above)"
echo "  2. Test Lambda functions"
echo "  3. Configure API Gateway endpoints"
echo "  4. Test user management UI in portal"
echo "  5. Review CloudWatch logs"
echo ""
echo "📖 Documentation:"
echo "  - PHASE4_COMPONENT2_COMPLETE.md - Implementation details"
echo "  - docs/RBAC_DESIGN.md - Architecture"
echo "  - docs/TEAM_MANAGEMENT_API.md - API reference"
echo ""
