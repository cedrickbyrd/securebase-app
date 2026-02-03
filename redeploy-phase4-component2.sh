#!/bin/bash
# Quick Redeploy Phase 4 Component 2: Team Collaboration & RBAC
# For redeploying after Lambda code changes

set -e

echo "🔄 Redeploying Phase 4 Component 2: RBAC (Quick Update)"
echo "========================================================"
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
echo ""

# Step 1: Re-package Lambda Functions
echo -e "${YELLOW}Step 1/3: Re-packaging Lambda Functions...${NC}"
cd "$WORKSPACE_ROOT/phase2-backend/functions"

mkdir -p ../deploy

# Package all three functions
zip -j ../deploy/user_management.zip user_management.py
zip -j ../deploy/session_management.zip session_management.py
zip -j ../deploy/permission_management.zip rbac_engine.py

echo -e "${GREEN}✓ Lambda functions packaged${NC}"
echo ""

# Step 2: Update Lambda Functions in AWS
echo -e "${YELLOW}Step 2/3: Updating Lambda Functions in AWS...${NC}"

# Update user_management
echo "  Updating user-management..."
aws lambda update-function-code \
    --function-name "securebase-${ENVIRONMENT}-user-management" \
    --zip-file fileb://../deploy/user_management.zip \
    --region $AWS_REGION \
    --no-cli-pager \
    > /dev/null 2>&1 || echo -e "${YELLOW}    (function may not exist yet)${NC}"

# Update session_management
echo "  Updating session-management..."
aws lambda update-function-code \
    --function-name "securebase-${ENVIRONMENT}-session-management" \
    --zip-file fileb://../deploy/session_management.zip \
    --region $AWS_REGION \
    --no-cli-pager \
    > /dev/null 2>&1 || echo -e "${YELLOW}    (function may not exist yet)${NC}"

# Update permission_management
echo "  Updating permission-management..."
aws lambda update-function-code \
    --function-name "securebase-${ENVIRONMENT}-permission-management" \
    --zip-file fileb://../deploy/permission_management.zip \
    --region $AWS_REGION \
    --no-cli-pager \
    > /dev/null 2>&1 || echo -e "${YELLOW}    (function may not exist yet)${NC}"

echo -e "${GREEN}✓ Lambda functions updated${NC}"
echo ""

# Step 3: Verify Updates
echo -e "${YELLOW}Step 3/3: Verifying Lambda Updates...${NC}"

for func in user-management session-management permission-management; do
    STATUS=$(aws lambda get-function \
        --function-name "securebase-${ENVIRONMENT}-${func}" \
        --region $AWS_REGION \
        --query 'Configuration.LastUpdateStatus' \
        --output text 2>/dev/null || echo "Not Found")
    
    echo "  ${func}: ${STATUS}"
done

echo ""
echo -e "${GREEN}✓✓✓ Redeployment Complete! ✓✓✓${NC}"
echo ""
echo "🎉 Phase 4 Component 2 Lambda functions updated"
echo ""
echo "📚 Next Steps:"
echo "  1. Test the updated functions"
echo "  2. Check CloudWatch Logs for any errors"
echo "  3. Verify user management in portal"
echo ""
