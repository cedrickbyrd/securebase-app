#!/bin/bash

# ============================================
# Phase 2 Deployment Checklist
# ============================================
# Copy-paste commands to deploy Phase 2 step-by-step
# Each section should complete successfully before moving to the next
#
# Prerequisites:
#   - AWS CLI configured with credentials
#   - Terraform 1.5+ installed
#   - Phase 1 deployed (terraform apply completed)
#   - psql client installed (apt-get install postgresql-client)
#   - jq installed (apt-get install jq)
#   - Git repository clean (git status)

set -e

echo "============================================"
echo "Phase 2: Serverless Database & API"
echo "============================================"
echo ""

# Color coding
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
TERRAFORM_DIR="landing-zone/environments/${ENVIRONMENT}"

# ============================================
# STEP 1: Deploy Aurora Infrastructure
# ============================================
echo -e "${YELLOW}[STEP 1/6] Deploy Aurora Infrastructure${NC}"
echo "This will create Aurora Serverless cluster, RDS Proxy, DynamoDB, and KMS"
echo ""
echo "Run the following commands:"
echo ""
echo "cd $TERRAFORM_DIR"
echo "terraform plan -out=phase2.tfplan"
echo "# Review the plan - should show ~15 new resources"
echo "terraform apply phase2.tfplan"
echo ""
echo -e "${GREEN}Expected time: 10-15 minutes${NC}"
read -p "Press enter when Aurora cluster is created (check AWS Console RDS tab)..."

# ============================================
# STEP 2: Initialize Database Schema
# ============================================
echo -e "${YELLOW}[STEP 2/6] Initialize Database Schema${NC}"
echo "This will create PostgreSQL schema with RLS policies and initial data"
echo ""
echo "Run the following commands:"
echo ""
echo "cd phase2-backend/database"
echo "chmod +x init_database.sh"
echo "./init_database.sh $ENVIRONMENT"
echo ""
read -p "Press enter when database initialization completes..."

# ============================================
# STEP 3: Store Secrets in Secrets Manager
# ============================================
echo -e "${YELLOW}[STEP 3/6] Store Secrets in Secrets Manager${NC}"
echo "This will store JWT secret and database credentials"
echo ""
echo "Run the following commands:"
echo ""
echo "# Generate JWT secret"
echo "aws secretsmanager create-secret \\"
echo "  --name phase2/jwt_secret \\"
echo "  --description 'JWT signing key for session tokens' \\"
echo "  --secret-string \$(openssl rand -base64 32) \\"
echo "  --region $AWS_REGION"
echo ""
echo "# Verify RDS app credentials were stored"
echo "aws secretsmanager describe-secret \\"
echo "  --secret-id phase2/rds/app \\"
echo "  --region $AWS_REGION"
echo ""
read -p "Press enter after secrets are stored..."

# ============================================
# STEP 4: Build and Deploy Lambda Layer
# ============================================
echo -e "${YELLOW}[STEP 4/6] Build and Deploy Lambda Layer${NC}"
echo "This will create database utilities layer for Lambda functions"
echo ""
echo "Run the following commands:"
echo ""
echo "cd phase2-backend"
echo ""
echo "# Install dependencies"
echo "pip install -r requirements.txt -t lambda_layer/python/"
echo ""
echo "# Package layer"
echo "cd lambda_layer"
echo "zip -r ../db_utils_layer.zip ."
echo "cd .."
echo ""
echo "# Upload to Lambda Layers"
echo "LAYER_ARN=\$(aws lambda publish-layer-version \\"
echo "  --layer-name securebase-db-utils \\"
echo "  --zip-file fileb://db_utils_layer.zip \\"
echo "  --compatible-runtimes python3.11 \\"
echo "  --region $AWS_REGION \\"
echo "  --query 'LayerVersionArn' \\"
echo "  --output text)"
echo ""
echo "echo 'Layer ARN: \$LAYER_ARN'"
echo "# Save this Layer ARN for next step"
echo ""
read -p "Press enter after Lambda layer is deployed..."

# ============================================
# STEP 5: Deploy Lambda Functions
# ============================================
echo -e "${YELLOW}[STEP 5/6] Deploy Lambda Functions${NC}"
echo "This will deploy auth and billing worker Lambda functions"
echo ""
echo "Get RDS Proxy endpoint from Terraform output:"
echo ""
echo "cd $TERRAFORM_DIR"
echo "RDS_PROXY=\$(terraform output -raw rds_proxy_endpoint)"
echo "echo \$RDS_PROXY"
echo ""
echo "Then deploy auth function:"
echo ""
echo "cd /path/to/phase2-backend/functions"
echo "zip -r ../auth_lambda.zip auth_v2.py"
echo ""
echo "aws lambda create-function \\"
echo "  --function-name securebase-auth \\"
echo "  --runtime python3.11 \\"
echo "  --role arn:aws:iam::\$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \\"
echo "  --handler auth_v2.lambda_handler \\"
echo "  --zip-file fileb://../auth_lambda.zip \\"
echo "  --timeout 30 \\"
echo "  --memory-size 256 \\"
echo "  --layers \$LAYER_ARN \\"
echo "  --environment 'Variables={RDS_HOST=\$RDS_PROXY,RDS_DATABASE=securebase,RDS_USER=securebase_app,DDB_TABLE_CACHE=securebase-cache,LOG_LEVEL=INFO}' \\"
echo "  --region $AWS_REGION"
echo ""
read -p "Press enter after Lambda functions are deployed..."

# ============================================
# STEP 6: Test and Validate
# ============================================
echo -e "${YELLOW}[STEP 6/6] Test and Validate${NC}"
echo ""
echo "Run these tests to verify Phase 2 deployment:"
echo ""
echo "# Test 1: Connect to database"
echo "psql -h \$RDS_PROXY -U securebase_app -d securebase -c 'SELECT COUNT(*) FROM customers;'"
echo ""
echo "# Test 2: List created tables"
echo "psql -h \$RDS_PROXY -U securebase_app -d securebase -c '\\dt'"
echo ""
echo "# Test 3: Verify RLS policies"
echo "psql -h \$RDS_PROXY -U securebase_app -d securebase -c 'SELECT COUNT(*) FROM pg_policies;'"
echo ""
echo "# Test 4: Invoke auth Lambda (should return 401 for invalid key)"
echo "aws lambda invoke \\"
echo "  --function-name securebase-auth \\"
echo "  --payload '{\"headers\":{\"Authorization\":\"Bearer invalid_key\"},\"requestContext\":{\"requestId\":\"test-123\"}}' \\"
echo "  --region $AWS_REGION \\"
echo "  response.json"
echo ""
echo "cat response.json"
echo ""

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Phase 2 Deployment Checklist Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Next steps:"
echo "1. Deploy API Gateway (manual or Terraform)"
echo "2. Run integration tests"
echo "3. Load test with 10 concurrent customers"
echo "4. Verify no cross-tenant data leakage"
echo ""
echo "Documentation:"
echo "- Schema: phase2-backend/database/schema.sql"
echo "- Deployment Guide: PHASE2_DEPLOYMENT_DETAILED.md"
echo "- Status: PHASE2_STATUS.md"
echo ""
echo "Estimated time to completion: 2-3 weeks"
echo ""
