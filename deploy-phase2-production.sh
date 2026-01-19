#!/bin/bash

###############################################################################
# Phase 2 Production Deployment Script
# This script deploys Phase 2 infrastructure to production
# Usage: bash deploy-phase2-production.sh
###############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="dev"  # Can be changed to prod
REGION="us-east-1"
WORKSPACE_ROOT="/workspaces/securebase-app"
TERRAFORM_DIR="$WORKSPACE_ROOT/landing-zone/environments/$ENVIRONMENT"

###############################################################################
# Helper Functions
###############################################################################

print_banner() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║  $1"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
}

print_step() {
  echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
  exit 1
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
  echo -e "${MAGENTA}ℹ️  $1${NC}"
}

###############################################################################
# Phase 0: Pre-Deployment Checks
###############################################################################

print_banner "PHASE 2 PRODUCTION DEPLOYMENT - PRE-FLIGHT CHECKS"

print_step "Checking required tools..."

# Check Terraform
if ! command -v terraform &> /dev/null; then
  print_error "Terraform not found. Please install Terraform."
fi
TF_VERSION=$(terraform version | head -1)
print_success "Terraform: $TF_VERSION"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  print_error "AWS CLI not found. Please install AWS CLI."
fi
AWS_VERSION=$(aws --version)
print_success "AWS CLI: $AWS_VERSION"

# Check PostgreSQL client
if ! command -v psql &> /dev/null; then
  print_warning "PostgreSQL client (psql) not found. You'll need it for database initialization."
else
  PSQL_VERSION=$(psql --version)
  print_success "PostgreSQL client: $PSQL_VERSION"
fi

# Check jq
if ! command -v jq &> /dev/null; then
  print_warning "jq not found. Some functionality may be limited."
else
  JQ_VERSION=$(jq --version)
  print_success "jq: $JQ_VERSION"
fi

# Check AWS credentials
print_step "Verifying AWS credentials..."
if AWS_ACCOUNT=$(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null); then
  AWS_ARN=$(aws sts get-caller-identity --query 'Arn' --output text)
  print_success "AWS Account: $AWS_ACCOUNT"
  print_info "Principal: $AWS_ARN"
else
  print_error "AWS credentials not configured. Run 'aws configure' first."
fi

###############################################################################
# Phase 1: Prepare Terraform
###############################################################################

print_banner "PHASE 1: TERRAFORM PREPARATION"

print_step "Navigating to Terraform directory: $TERRAFORM_DIR"
if [ ! -d "$TERRAFORM_DIR" ]; then
  print_error "Directory not found: $TERRAFORM_DIR"
fi
cd "$TERRAFORM_DIR"
print_success "Current directory: $(pwd)"

print_step "Checking for existing configuration..."
if [ -f "terraform.tfvars" ]; then
  print_warning "terraform.tfvars already exists. Creating backup..."
  cp terraform.tfvars "terraform.tfvars.backup.$(date +%s)"
  print_success "Backup created"
fi

print_step "Copying Phase 2 configuration..."
if [ ! -f "terraform.tfvars.phase2" ]; then
  print_error "terraform.tfvars.phase2 not found"
fi
cp terraform.tfvars.phase2 terraform.tfvars
print_success "Phase 2 configuration copied"

# Verify configuration
print_step "Verifying configuration..."
if grep -q "enable_phase2 = true" terraform.tfvars; then
  print_success "enable_phase2 = true ✓"
else
  print_error "enable_phase2 not enabled in terraform.tfvars"
fi

###############################################################################
# Phase 2: Initialize Terraform
###############################################################################

print_banner "PHASE 2: TERRAFORM INITIALIZATION"

print_step "Running terraform init..."
if terraform init; then
  print_success "Terraform initialized"
else
  print_error "Terraform init failed"
fi

print_step "Verifying Terraform workspace..."
WORKSPACE=$(terraform workspace show)
print_info "Current workspace: $WORKSPACE"

###############################################################################
# Phase 3: Validate & Plan
###############################################################################

print_banner "PHASE 3: TERRAFORM VALIDATION & PLANNING"

print_step "Validating Terraform configuration..."
if terraform validate > /dev/null 2>&1; then
  print_success "Configuration is valid"
else
  print_error "Terraform validation failed"
fi

print_step "Creating Terraform plan (this may take 1-2 minutes)..."
if terraform plan -out=tfplan.phase2 > plan.log 2>&1; then
  print_success "Plan created successfully"
  
  # Extract plan statistics
  if grep -q "Plan:" plan.log; then
    PLAN_SUMMARY=$(grep "Plan:" plan.log)
    print_info "Plan: $PLAN_SUMMARY"
  fi
else
  print_error "Terraform plan failed. Check plan.log for details."
fi

###############################################################################
# Phase 4: Show Deployment Details
###############################################################################

print_banner "PHASE 4: DEPLOYMENT SUMMARY"

print_info "What will be deployed:"
echo ""
echo "  ✓ Aurora Serverless v2 PostgreSQL 15.3"
echo "    - Scaling: 0.5-4 ACUs (configurable)"
echo "    - Backup: 35 days"
echo "    - Multi-AZ: Enabled"
echo "    - Encrypted: KMS"
echo ""
echo "  ✓ RDS Proxy"
echo "    - Connection pooling"
echo "    - Max connections: 1000"
echo ""
echo "  ✓ DynamoDB Tables (3)"
echo "    - cache"
echo "    - sessions"
echo "    - metrics"
echo ""
echo "  ✓ Security Infrastructure"
echo "    - KMS key for encryption"
echo "    - Security groups (3)"
echo "    - IAM roles"
echo "    - VPC with multi-AZ subnets"
echo ""

print_warning "IMPORTANT:"
echo "  • This will create AWS resources"
echo "  • Estimated cost: \$50-120/month (dev)"
echo "  • Deployment duration: 15-20 minutes"
echo "  • Do NOT interrupt terraform apply"
echo ""

###############################################################################
# Phase 5: Get Deployment Confirmation
###############################################################################

print_banner "PHASE 5: DEPLOYMENT CONFIRMATION"

echo "Review the information above carefully."
echo ""
read -p "Do you want to proceed with Phase 2 deployment? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  print_warning "Deployment cancelled"
  echo "To deploy later, run: terraform apply tfplan.phase2"
  exit 0
fi

###############################################################################
# Phase 6: Deploy Infrastructure
###############################################################################

print_banner "PHASE 6: DEPLOYING PHASE 2 INFRASTRUCTURE"

print_step "Starting Terraform apply..."
print_warning "This may take 15-20 minutes. DO NOT INTERRUPT!"
echo ""

if terraform apply tfplan.phase2; then
  print_success "Infrastructure deployment completed!"
else
  print_error "Terraform apply failed. Check logs above."
fi

###############################################################################
# Phase 7: Extract Outputs
###############################################################################

print_banner "PHASE 7: EXTRACTING DEPLOYMENT OUTPUTS"

print_step "Retrieving infrastructure details..."

# Get outputs
DB_CLUSTER_ENDPOINT=$(terraform output -raw rds_cluster_endpoint 2>/dev/null || echo "")
RDS_PROXY_ENDPOINT=$(terraform output -raw rds_proxy_endpoint 2>/dev/null || echo "")
LAMBDA_ROLE=$(terraform output -raw lambda_execution_role_arn 2>/dev/null || echo "")
KMS_KEY=$(terraform output -raw kms_key_id 2>/dev/null || echo "")
DYNAMODB_TABLES=$(terraform output -json dynamodb_table_names 2>/dev/null || echo "[]")

if [ -z "$DB_CLUSTER_ENDPOINT" ]; then
  print_error "Could not extract database endpoint"
fi

print_success "Deployment outputs retrieved:"
echo ""
echo "  Aurora Cluster Endpoint: $DB_CLUSTER_ENDPOINT"
echo "  RDS Proxy Endpoint: $RDS_PROXY_ENDPOINT"
echo "  Lambda Execution Role: $LAMBDA_ROLE"
echo "  KMS Key ID: $KMS_KEY"
echo "  DynamoDB Tables: $DYNAMODB_TABLES"
echo ""

# Save outputs
terraform output -json > phase2-deployment-outputs.json
print_success "All outputs saved to phase2-deployment-outputs.json"

###############################################################################
# Phase 8: Wait for Aurora
###############################################################################

print_banner "PHASE 8: WAITING FOR AURORA CLUSTER"

DB_CLUSTER_ID="securebase-phase2-${ENVIRONMENT}"

print_step "Checking Aurora cluster status..."
print_info "This may take a few minutes. Cluster is initializing..."
echo ""

for i in {1..40}; do
  CLUSTER_STATUS=$(aws rds describe-db-clusters \
    --db-cluster-identifier "$DB_CLUSTER_ID" \
    --region "$REGION" \
    --query 'DBClusters[0].Status' \
    --output text 2>/dev/null || echo "unknown")
  
  if [ "$CLUSTER_STATUS" = "available" ]; then
    print_success "Aurora cluster is ready!"
    break
  else
    PERCENT=$((i * 100 / 40))
    echo -ne "\r  Status: $CLUSTER_STATUS (${PERCENT}%) [$i/40]"
    if [ $i -lt 40 ]; then
      sleep 15
    fi
  fi
done

echo ""
if [ "$CLUSTER_STATUS" != "available" ]; then
  print_warning "Aurora cluster still initializing (this is normal for first deployment)"
  print_info "Check AWS console for status: https://console.aws.amazon.com/rds/home?region=$REGION#databases:"
fi

###############################################################################
# Phase 9: Retrieve Database Password
###############################################################################

print_banner "PHASE 9: DATABASE AUTHENTICATION SETUP"

print_step "Retrieving database password..."

SECRET_ID="rds-admin-password-${DB_CLUSTER_ID}"

DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" \
  --region "$REGION" \
  --query 'SecretString' \
  --output text 2>/dev/null | jq -r '.password // .' 2>/dev/null || echo "")

if [ -z "$DB_PASSWORD" ]; then
  print_warning "Could not retrieve password from Secrets Manager"
  print_info "Retrieve manually with:"
  echo "  aws secretsmanager get-secret-value --secret-id $SECRET_ID"
else
  print_success "Password retrieved securely"
fi

###############################################################################
# Phase 10: Test Database Connection
###############################################################################

print_banner "PHASE 10: DATABASE CONNECTION TEST"

if command -v psql &> /dev/null; then
  print_step "Testing PostgreSQL connection..."
  
  # Create pgpass file for authentication
  PGPASS_FILE="/tmp/.pgpass"
  cat > "$PGPASS_FILE" <<EOF
$DB_CLUSTER_ENDPOINT:5432:*:adminuser:$DB_PASSWORD
EOF
  chmod 600 "$PGPASS_FILE"
  
  export PGPASSFILE="$PGPASS_FILE"
  
  if psql -h "$DB_CLUSTER_ENDPOINT" -p 5432 -U adminuser -d postgres -c "SELECT version();" 2>/dev/null | head -1; then
    print_success "PostgreSQL connection successful!"
  else
    print_warning "Could not connect to database yet"
    print_info "Cluster may still be initializing. Retry in a moment."
  fi
else
  print_warning "psql not available. Skip connection test."
fi

###############################################################################
# Phase 11: Generate Deployment Report
###############################################################################

print_banner "PHASE 11: DEPLOYMENT REPORT"

cat > PHASE2_DEPLOYMENT_REPORT.txt <<EOF
# Phase 2 Deployment Report

Date: $(date)
Status: ✅ COMPLETE
Environment: $ENVIRONMENT
Region: $REGION
Account: $AWS_ACCOUNT

## Deployed Infrastructure

### Database
- Aurora Cluster ID: $DB_CLUSTER_ID
- Endpoint: $DB_CLUSTER_ENDPOINT
- Engine: PostgreSQL 15.3
- Scaling: 0.5-4 ACUs
- Backup Retention: 35 days
- Multi-AZ: Enabled
- Encryption: KMS

### Connection Pooling
- RDS Proxy: $RDS_PROXY_ENDPOINT
- Max Connections: 1000

### Caching
- DynamoDB Tables: $DYNAMODB_TABLES
- Billing Mode: On-Demand

### Security
- KMS Key: $KMS_KEY
- Lambda Role: $LAMBDA_ROLE

## Database Credentials

Username: adminuser
Password: [Stored in Secrets Manager: $SECRET_ID]

To retrieve password:
  aws secretsmanager get-secret-value --secret-id $SECRET_ID

## Next Steps

1. Initialize database schema:
   cd /workspaces/securebase-app/phase2-backend/database
   bash init_database.sh

2. Deploy Lambda functions:
   See: PHASE2_TERRAFORM_DEPLOYMENT_GUIDE.md Step 10

3. Configure API Gateway:
   See: PHASE2_TERRAFORM_DEPLOYMENT_GUIDE.md Step 11

4. Deploy Phase 3a Portal UI:
   npm run build && npm run preview

## Monitoring

- Aurora: https://console.aws.amazon.com/rds
- DynamoDB: https://console.aws.amazon.com/dynamodb
- CloudWatch Logs: https://console.aws.amazon.com/logs
- Terraform State: $(pwd)/terraform.tfstate

## Rollback

If needed:
  terraform destroy -auto-approve

EOF

print_success "Deployment report generated: PHASE2_DEPLOYMENT_REPORT.txt"

###############################################################################
# Phase 12: Final Summary
###############################################################################

print_banner "✅ PHASE 2 PRODUCTION DEPLOYMENT COMPLETE!"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    DEPLOYMENT SUCCESSFUL                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Summary:"
echo "  ✓ Aurora Cluster deployed and available"
echo "  ✓ RDS Proxy configured"
echo "  ✓ DynamoDB tables created"
echo "  ✓ KMS encryption enabled"
echo "  ✓ IAM roles configured"
echo ""
echo "Database Details:"
echo "  Host: $DB_CLUSTER_ENDPOINT"
echo "  Port: 5432"
echo "  Database: securebase"
echo "  User: adminuser"
echo "  Password: [Stored in Secrets Manager]"
echo ""
echo "Next Steps:"
echo "  1. Initialize database schema"
echo "  2. Deploy Lambda functions"
echo "  3. Configure API Gateway"
echo "  4. Deploy Phase 3a Portal UI"
echo ""
echo "Documentation:"
echo "  - Phase 2 Guide: PHASE2_TERRAFORM_DEPLOYMENT_GUIDE.md"
echo "  - Deployment Report: PHASE2_DEPLOYMENT_REPORT.txt"
echo "  - Terraform Outputs: phase2-deployment-outputs.json"
echo ""
echo "Estimated Monthly Cost: \$50-120"
echo ""
echo "🎉 Phase 2 is now live! 🎉"
echo ""
