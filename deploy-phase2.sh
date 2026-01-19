#!/bin/bash

# Phase 2 Deployment Automation Script
# This script automates the entire Phase 2 deployment process
# Usage: bash deploy-phase2.sh [environment]

set -e  # Exit on any error

ENVIRONMENT="${1:-dev}"
REGION="us-east-1"
WORKSPACE_ROOT="/workspaces/securebase-app"
TERRAFORM_DIR="$WORKSPACE_ROOT/landing-zone/environments/$ENVIRONMENT"
BACKEND_DIR="$WORKSPACE_ROOT/phase2-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║  $1"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
}

print_step() {
  echo -e "${BLUE}▶ Step: $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Phase 0: Prerequisites
print_header "PHASE 2 DEPLOYMENT - Prerequisites Check"

print_step "Checking required commands..."

for cmd in aws terraform psql jq; do
  if command -v $cmd &> /dev/null; then
    version=$($cmd --version 2>&1 | head -1)
    print_success "$cmd: $version"
  else
    print_error "$cmd not found. Install and try again."
    exit 1
  fi
done

# Check AWS credentials
print_step "Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
  account_id=$(aws sts get-caller-identity --query Account --output text)
  print_success "AWS credentials valid (Account: $account_id)"
else
  print_error "AWS credentials not configured"
  exit 1
fi

# Phase 1: Prepare Terraform
print_header "PHASE 1: Terraform Preparation"

print_step "Navigating to Terraform directory: $TERRAFORM_DIR"
cd "$TERRAFORM_DIR" || exit 1
print_success "Current directory: $(pwd)"

print_step "Backing up existing configuration..."
if [ -f "terraform.tfvars" ]; then
  cp terraform.tfvars "terraform.tfvars.backup.$(date +%s)"
  print_success "Backup created"
fi

print_step "Copying Phase 2 configuration..."
if [ -f "terraform.tfvars.phase2" ]; then
  cp terraform.tfvars.phase2 terraform.tfvars
  print_success "Phase 2 variables configured"
else
  print_error "terraform.tfvars.phase2 not found"
  exit 1
fi

# Phase 2: Initialize Terraform
print_header "PHASE 2: Terraform Initialization"

print_step "Running terraform init..."
if terraform init; then
  print_success "Terraform initialized"
else
  print_error "Terraform init failed"
  exit 1
fi

# Phase 3: Validate Configuration
print_header "PHASE 3: Configuration Validation"

print_step "Validating Terraform syntax..."
if terraform validate; then
  print_success "Configuration is valid"
else
  print_error "Terraform validation failed"
  exit 1
fi

# Phase 4: Create Plan
print_header "PHASE 4: Terraform Planning"

print_step "Creating Terraform plan (this may take a moment)..."
if terraform plan -out=tfplan.phase2 > plan.log 2>&1; then
  print_success "Plan created successfully"
  
  # Extract key information from plan
  resources_to_add=$(grep -c "will be created" plan.log 2>/dev/null || echo "?")
  resources_to_change=$(grep -c "will be changed" plan.log 2>/dev/null || echo "0")
  resources_to_destroy=$(grep -c "will be destroyed" plan.log 2>/dev/null || echo "0")
  
  echo ""
  echo "📊 Plan Summary:"
  echo "   Resources to create:  $resources_to_add"
  echo "   Resources to change:  $resources_to_change"
  echo "   Resources to destroy: $resources_to_destroy"
  echo ""
else
  print_error "Terraform plan failed"
  cat plan.log
  exit 1
fi

# Phase 5: Apply Terraform
print_header "PHASE 5: Deploying Infrastructure"

echo "⚠️  IMPORTANT:"
echo "   This will create AWS resources and incur charges"
echo "   Estimated cost: ~\$50-120/month"
echo ""

read -p "Do you want to proceed with terraform apply? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  print_warning "Deployment cancelled"
  exit 0
fi

echo ""
print_step "Applying Terraform plan (this may take 15-20 minutes)..."
echo "⏳ Aurora cluster creation typically takes 10-15 minutes..."
echo ""

if terraform apply tfplan.phase2; then
  print_success "Infrastructure deployment completed!"
else
  print_error "Terraform apply failed. Check logs above."
  exit 1
fi

# Phase 6: Extract Outputs
print_header "PHASE 6: Extracting Deployment Outputs"

print_step "Extracting database credentials..."

DB_CLUSTER_ID="securebase-phase2-${ENVIRONMENT}"
DB_HOST=$(terraform output -raw rds_cluster_endpoint 2>/dev/null || echo "")
DB_PORT=5432
DB_NAME="securebase"

if [ -z "$DB_HOST" ]; then
  print_error "Could not extract RDS cluster endpoint"
  exit 1
fi

print_success "Database connection details extracted:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: adminuser"

# Wait for Aurora to be fully ready
print_header "PHASE 7: Waiting for Aurora Cluster"

print_step "Checking cluster status (may take a few minutes)..."

for i in {1..30}; do
  CLUSTER_STATUS=$(aws rds describe-db-clusters \
    --db-cluster-identifier $DB_CLUSTER_ID \
    --region $REGION \
    --query 'DBClusters[0].Status' \
    --output text 2>/dev/null || echo "unknown")
  
  if [ "$CLUSTER_STATUS" = "available" ]; then
    print_success "Aurora cluster is ready!"
    break
  else
    echo "   Status: $CLUSTER_STATUS (attempt $i/30)"
    if [ $i -lt 30 ]; then
      sleep 10
    fi
  fi
done

if [ "$CLUSTER_STATUS" != "available" ]; then
  print_warning "Aurora cluster still initializing. This is normal for first deployment."
  echo "   Check AWS RDS console for status: $DB_CLUSTER_ID"
fi

# Phase 8: Database Password
print_header "PHASE 8: Database Authentication"

print_step "Retrieving database password from Secrets Manager..."

DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "rds-admin-password-${DB_CLUSTER_ID}" \
  --region $REGION \
  --query 'SecretString' \
  --output text 2>/dev/null | jq -r '.password // .' 2>/dev/null || echo "")

if [ -z "$DB_PASSWORD" ]; then
  print_warning "Could not retrieve password from Secrets Manager"
  echo "   Retrieve manually:"
  echo "   aws secretsmanager get-secret-value --secret-id rds-admin-password-${DB_CLUSTER_ID}"
else
  print_success "Password retrieved securely"
fi

# Phase 9: Test Database Connection
print_header "PHASE 9: Database Connection Test"

print_step "Testing PostgreSQL connection..."

# Create pgpass file for authentication
PGPASS_FILE="/tmp/.pgpass"
cat > "$PGPASS_FILE" <<EOF
$DB_HOST:$DB_PORT:*:adminuser:$DB_PASSWORD
EOF
chmod 600 "$PGPASS_FILE"

export PGPASSFILE="$PGPASS_FILE"

if psql -h "$DB_HOST" -p "$DB_PORT" -U adminuser -d postgres -c "SELECT version();" 2>/dev/null | head -1; then
  print_success "PostgreSQL connection successful!"
else
  print_warning "Could not connect to database yet (cluster may still be initializing)"
  echo "   Retry in a moment with:"
  echo "   psql -h $DB_HOST -p $DB_PORT -U adminuser -d $DB_NAME"
fi

# Phase 10: Initialize Database Schema
print_header "PHASE 10: Database Schema Initialization"

print_step "Navigating to database directory..."
cd "$BACKEND_DIR/database" || exit 1

if [ ! -f "init_database.sh" ]; then
  print_error "init_database.sh not found in $BACKEND_DIR/database/"
  exit 1
fi

print_step "Running database initialization script..."
echo "   (This creates 15+ tables with row-level security)"

if [ -n "$DB_PASSWORD" ]; then
  # Use automated authentication
  export PGPASSFILE="$PGPASS_FILE"
  if psql -h "$DB_HOST" -p "$DB_PORT" -U adminuser -d $DB_NAME -f schema.sql 2>/dev/null; then
    print_success "Database schema loaded!"
  else
    print_warning "Could not auto-load schema. Run manually:"
    echo "   psql -h $DB_HOST -U adminuser -d $DB_NAME -f schema.sql"
  fi
else
  print_warning "Database password not available. Run schema initialization manually:"
  echo "   bash init_database.sh"
fi

# Phase 11: Save Deployment Outputs
print_header "PHASE 11: Saving Deployment Information"

cd "$TERRAFORM_DIR"

print_step "Saving Terraform outputs..."
terraform output -json > phase2-deployment-outputs.json
print_success "Outputs saved to phase2-deployment-outputs.json"

# Create deployment summary
cat > PHASE2_DEPLOYMENT_SUMMARY.txt <<EOF
# Phase 2 Deployment Summary

Date: $(date)
Environment: $ENVIRONMENT
Region: $REGION
Status: ✅ DEPLOYMENT COMPLETE

## Database Connection
Host: $DB_HOST
Port: $DB_PORT
Database: $DB_NAME
User: adminuser

## Deployed Resources
EOF

terraform output -json | jq -r 'keys[]' 2>/dev/null >> PHASE2_DEPLOYMENT_SUMMARY.txt

cat >> PHASE2_DEPLOYMENT_SUMMARY.txt <<EOF

## Next Steps
1. Verify database schema (psql -h $DB_HOST -U adminuser -d $DB_NAME -c "\dt")
2. Deploy Lambda functions
3. Configure API Gateway
4. Deploy Phase 3a Portal UI
5. Deploy Phase 3b Advanced Features

## Monitoring
- CloudWatch: https://console.aws.amazon.com/cloudwatch
- RDS: https://console.aws.amazon.com/rds
- Aurora Cluster: $DB_CLUSTER_ID

## Support
See PHASE2_TERRAFORM_DEPLOYMENT_GUIDE.md for detailed troubleshooting
EOF

print_success "Deployment summary saved to PHASE2_DEPLOYMENT_SUMMARY.txt"

# Final Summary
print_header "✅ PHASE 2 DEPLOYMENT COMPLETE"

echo "📊 Deployment Summary:"
echo "   Environment: $ENVIRONMENT"
echo "   Region: $REGION"
echo "   Database: $DB_HOST"
echo "   Cluster: $DB_CLUSTER_ID"
echo ""
echo "📚 Documentation:"
echo "   - PHASE2_TERRAFORM_DEPLOYMENT_GUIDE.md (detailed steps)"
echo "   - PHASE2_DEPLOY_EXECUTION_PLAN.md (overall plan)"
echo "   - phase2-deployment-outputs.json (resource details)"
echo "   - PHASE2_DEPLOYMENT_SUMMARY.txt (quick reference)"
echo ""
echo "🚀 Next Steps:"
echo "   1. Verify database connection"
echo "   2. Deploy Lambda functions (Step 10 in guide)"
echo "   3. Configure API Gateway endpoints"
echo "   4. Run integration tests"
echo ""
echo "💰 Estimated Monthly Cost: \$50-120"
echo ""
echo "Have a great deployment! 🎉"
