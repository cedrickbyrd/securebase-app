#!/bin/bash
# Validate Phase 4 Component 2 Deployment
# Checks that all RBAC resources are deployed correctly

set -e

echo "🔍 Validating Phase 4 Component 2 Deployment"
echo "============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Region:${NC} $AWS_REGION"
echo ""

ERRORS=0
WARNINGS=0

# Function to check resource
check_resource() {
    local resource_type=$1
    local resource_name=$2
    local check_command=$3
    
    if eval $check_command &>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $resource_type: $resource_name"
        return 0
    else
        echo -e "  ${RED}✗${NC} $resource_type: $resource_name"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Check DynamoDB Tables
echo -e "${YELLOW}Checking DynamoDB Tables...${NC}"
check_resource "DynamoDB Table" "securebase-${ENVIRONMENT}-user-sessions" \
    "aws dynamodb describe-table --table-name securebase-${ENVIRONMENT}-user-sessions --region $AWS_REGION"

check_resource "DynamoDB Table" "securebase-${ENVIRONMENT}-user-invites" \
    "aws dynamodb describe-table --table-name securebase-${ENVIRONMENT}-user-invites --region $AWS_REGION"

check_resource "DynamoDB Table" "securebase-${ENVIRONMENT}-activity-feed" \
    "aws dynamodb describe-table --table-name securebase-${ENVIRONMENT}-activity-feed --region $AWS_REGION"

echo ""

# Check Lambda Functions
echo -e "${YELLOW}Checking Lambda Functions...${NC}"
check_resource "Lambda Function" "securebase-${ENVIRONMENT}-user-management" \
    "aws lambda get-function --function-name securebase-${ENVIRONMENT}-user-management --region $AWS_REGION"

check_resource "Lambda Function" "securebase-${ENVIRONMENT}-session-management" \
    "aws lambda get-function --function-name securebase-${ENVIRONMENT}-session-management --region $AWS_REGION"

check_resource "Lambda Function" "securebase-${ENVIRONMENT}-permission-management" \
    "aws lambda get-function --function-name securebase-${ENVIRONMENT}-permission-management --region $AWS_REGION"

echo ""

# Check Lambda Function States
echo -e "${YELLOW}Checking Lambda Function States...${NC}"
for func in user-management session-management permission-management; do
    STATE=$(aws lambda get-function \
        --function-name "securebase-${ENVIRONMENT}-${func}" \
        --region $AWS_REGION \
        --query 'Configuration.State' \
        --output text 2>/dev/null || echo "Not Found")
    
    UPDATE_STATUS=$(aws lambda get-function \
        --function-name "securebase-${ENVIRONMENT}-${func}" \
        --region $AWS_REGION \
        --query 'Configuration.LastUpdateStatus' \
        --output text 2>/dev/null || echo "Not Found")
    
    if [ "$STATE" = "Active" ] && [ "$UPDATE_STATUS" = "Successful" ]; then
        echo -e "  ${GREEN}✓${NC} ${func}: ${STATE} (${UPDATE_STATUS})"
    elif [ "$STATE" = "Pending" ]; then
        echo -e "  ${YELLOW}⚠${NC} ${func}: ${STATE} (${UPDATE_STATUS})"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "  ${RED}✗${NC} ${func}: ${STATE} (${UPDATE_STATUS})"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

# Check IAM Roles
echo -e "${YELLOW}Checking IAM Roles...${NC}"
check_resource "IAM Role" "securebase-${ENVIRONMENT}-user-management-role" \
    "aws iam get-role --role-name securebase-${ENVIRONMENT}-user-management-role"

check_resource "IAM Role" "securebase-${ENVIRONMENT}-session-management-role" \
    "aws iam get-role --role-name securebase-${ENVIRONMENT}-session-management-role"

check_resource "IAM Role" "securebase-${ENVIRONMENT}-permission-management-role" \
    "aws iam get-role --role-name securebase-${ENVIRONMENT}-permission-management-role"

echo ""

# Check CloudWatch Log Groups
echo -e "${YELLOW}Checking CloudWatch Log Groups...${NC}"
check_resource "Log Group" "/aws/lambda/securebase-${ENVIRONMENT}-user-management" \
    "aws logs describe-log-groups --log-group-name-prefix /aws/lambda/securebase-${ENVIRONMENT}-user-management --region $AWS_REGION | grep -q logGroupName"

check_resource "Log Group" "/aws/lambda/securebase-${ENVIRONMENT}-session-management" \
    "aws logs describe-log-groups --log-group-name-prefix /aws/lambda/securebase-${ENVIRONMENT}-session-management --region $AWS_REGION | grep -q logGroupName"

check_resource "Log Group" "/aws/lambda/securebase-${ENVIRONMENT}-permission-management" \
    "aws logs describe-log-groups --log-group-name-prefix /aws/lambda/securebase-${ENVIRONMENT}-permission-management --region $AWS_REGION | grep -q logGroupName"

echo ""

# Check Secrets Manager
echo -e "${YELLOW}Checking Secrets Manager...${NC}"
check_resource "Secret" "securebase/${ENVIRONMENT}/jwt-secret" \
    "aws secretsmanager describe-secret --secret-id securebase/${ENVIRONMENT}/jwt-secret --region $AWS_REGION"

echo ""

# Check Lambda Deployment Packages
echo -e "${YELLOW}Checking Lambda Deployment Packages...${NC}"
if [ -f "phase2-backend/deploy/user_management.zip" ]; then
    SIZE=$(du -h phase2-backend/deploy/user_management.zip | cut -f1)
    echo -e "  ${GREEN}✓${NC} user_management.zip ($SIZE)"
else
    echo -e "  ${RED}✗${NC} user_management.zip (not found)"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "phase2-backend/deploy/session_management.zip" ]; then
    SIZE=$(du -h phase2-backend/deploy/session_management.zip | cut -f1)
    echo -e "  ${GREEN}✓${NC} session_management.zip ($SIZE)"
else
    echo -e "  ${RED}✗${NC} session_management.zip (not found)"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "phase2-backend/deploy/permission_management.zip" ]; then
    SIZE=$(du -h phase2-backend/deploy/permission_management.zip | cut -f1)
    echo -e "  ${GREEN}✓${NC} permission_management.zip ($SIZE)"
else
    echo -e "  ${RED}✗${NC} permission_management.zip (not found)"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Summary
echo "============================================="
echo -e "${BLUE}Validation Summary${NC}"
echo "============================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓✓✓ All checks passed! ✓✓✓${NC}"
    echo ""
    echo "Phase 4 Component 2 deployment is complete and healthy."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warnings found${NC}"
    echo ""
    echo "Deployment is mostly healthy but has some warnings."
    echo "Review the warnings above."
    exit 0
else
    echo -e "${RED}✗ $ERRORS errors found${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS warnings found${NC}"
    fi
    echo ""
    echo "Deployment has issues that need to be addressed."
    echo "Review the errors above and run the deployment script again."
    exit 1
fi
