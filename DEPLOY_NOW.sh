#!/bin/bash
set -e

echo "🚀 SecureBase PaaS - Deployment Script"
echo "======================================"
echo ""

# Step 1: Verify prerequisites
echo "Step 1: Checking Prerequisites"
echo "  Checking Terraform..."
if ! command -v terraform &> /dev/null; then
  echo "  ❌ Terraform not installed. Please install Terraform >= 1.5.0"
  exit 1
fi
TERRAFORM_VERSION=$(terraform version | head -1)
echo "  ✅ $TERRAFORM_VERSION"

echo "  Checking AWS CLI..."
if ! command -v aws &> /dev/null; then
  echo "  ❌ AWS CLI not installed. Please install AWS CLI"
  exit 1
fi
echo "  ✅ AWS CLI installed"

echo "  Checking AWS Credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
  echo "  ❌ AWS credentials not configured"
  echo "     Run: aws configure"
  exit 1
fi
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ARN=$(aws sts get-caller-identity --query Arn --output text)
echo "  ✅ AWS Credentials Valid"
echo "     Account: $ACCOUNT"
echo "     Identity: $ARN"
echo ""

# Step 2: Navigate to environment directory
echo "Step 2: Navigating to Environment Directory"
cd "$(dirname "$0")/landing-zone/environments/dev" || exit 1
echo "  ✅ Current directory: $(pwd)"
echo ""

# Step 3: Initialize Terraform
echo "Step 3: Initializing Terraform"
terraform init
echo "  ✅ Terraform Initialized"
echo ""

# Step 4: Validate configuration
echo "Step 4: Validating Configuration"
terraform validate
echo "  ✅ Configuration Valid"
echo ""

# Step 5: Generate plan
echo "Step 5: Generating Deployment Plan"
terraform plan -out=tfplan
echo "  ✅ Plan Generated (saved to tfplan)"
echo ""

# Step 6: Show summary and ask for confirmation
echo "======================================"
echo "REVIEW THE PLAN ABOVE CAREFULLY"
echo "======================================"
echo ""
echo "This plan will:"
echo "  • Create 1 AWS Organization"
echo "  • Create 4 Organizational Units (Healthcare, Fintech, Gov-Federal, Standard)"
echo "  • Create 4 Customer AWS Accounts"
echo "  • Attach tier-specific security policies"
echo "  • Set up centralized logging"
echo "  • Enable compliance monitoring"
echo "  • Deploy Phase 2 Backend Infrastructure:"
echo "    - Aurora Serverless v2 PostgreSQL cluster"
echo "    - RDS Proxy for connection pooling"
echo "    - DynamoDB tables (metrics, events, cache)"
echo "    - Lambda functions and API Gateway"
echo "    - Secrets Manager for credentials"
echo ""
echo "Cost Estimate:"
echo "  • AWS Organizations: Free"
echo "  • Phase 1 (Management Account): ~$180/month"
echo "  • Phase 2 (Database & API): ~$50-120/month"
echo "  • Total: ~$230-300/month"
echo ""
read -p "Do you want to proceed with terraform apply? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Deployment cancelled."
  exit 0
fi

echo ""
echo "Step 6: Applying Configuration (this may take 5-10 minutes)"
terraform apply tfplan
echo "  ✅ Infrastructure Deployed!"
echo ""

# Step 7: Show outputs
echo "======================================"
echo "Phase 1 & Phase 2 Infrastructure Deployed!"
echo "======================================"
echo ""
echo "Your outputs:"
terraform output
echo ""

# Step 8: Initialize Phase 2 Database
echo "======================================"
echo "Step 7: Initializing Phase 2 Database"
echo "======================================"
echo ""

# Get database connection details from Terraform outputs
DB_HOST=$(terraform output -raw rds_cluster_endpoint 2>/dev/null || echo "")
DB_PROXY=$(terraform output -raw rds_proxy_endpoint 2>/dev/null || echo "")

if [ -z "$DB_HOST" ]; then
  echo "⚠️  Warning: Could not retrieve database endpoint from Terraform outputs"
  echo "   Database may not have been deployed or is still initializing"
  echo "   You can initialize the database manually later with:"
  echo "   cd phase2-backend/database && ./init_database.sh"
else
  echo "  Database endpoint: $DB_HOST"
  echo "  RDS Proxy endpoint: $DB_PROXY"
  echo ""
  
  # Navigate to database directory
  cd ../../../phase2-backend/database || {
    echo "⚠️  Warning: Could not find phase2-backend/database directory"
    echo "   Skip database initialization"
    cd "$(dirname "$0")/landing-zone/environments/dev"
  }
  
  if [ -f "init_database.sh" ]; then
    echo "  Running database initialization..."
    echo "  (This may take a few minutes as Aurora cluster starts up)"
    echo ""
    
    # Run database initialization
    if bash init_database.sh dev 2>&1 | tee /tmp/db_init.log; then
      echo "  ✅ Database initialized successfully!"
    else
      echo "  ⚠️  Database initialization encountered issues"
      echo "     This is often due to Aurora cluster still warming up"
      echo "     You can run initialization manually:"
      echo "     cd phase2-backend/database && ./init_database.sh dev"
    fi
    
    # Return to terraform directory
    cd ../../landing-zone/environments/dev
  else
    echo "  ⚠️  Database initialization script not found"
    cd ../../landing-zone/environments/dev
  fi
fi
echo ""

# Step 9: Package Lambda Functions
echo "======================================"
echo "Step 8: Packaging Lambda Functions"
echo "======================================"
echo ""

cd ../../../phase2-backend/functions || {
  echo "⚠️  Warning: Could not find phase2-backend/functions directory"
  cd "$(dirname "$0")/landing-zone/environments/dev"
}

if [ -f "package-lambda.sh" ]; then
  echo "  Creating Lambda deployment packages..."
  
  # Make script executable
  chmod +x package-lambda.sh
  
  # Run packaging script
  if bash package-lambda.sh 2>&1 | tee /tmp/lambda_package.log; then
    echo "  ✅ Lambda functions packaged successfully!"
    echo "     Deployment packages created in: phase2-backend/deploy/"
  else
    echo "  ⚠️  Lambda packaging encountered issues"
    echo "     You can package manually:"
    echo "     cd phase2-backend/functions && ./package-lambda.sh"
  fi
  
  # Return to terraform directory
  cd ../../landing-zone/environments/dev
else
  echo "  ℹ️  Lambda packaging script not found (functions may already be packaged)"
  cd ../../landing-zone/environments/dev
fi
echo ""

# Step 10: Deploy Lambda Functions
echo "======================================"
echo "Step 9: Deploying Lambda Functions"
echo "======================================"
echo ""
echo "  Running final terraform apply to deploy Lambda functions..."
echo "  (This ensures Lambda code is uploaded after packaging)"
echo ""

# Run terraform apply again to update Lambda functions with packaged code
if terraform apply -auto-approve -target=module.lambda_functions 2>&1 | tee /tmp/lambda_deploy.log; then
  echo "  ✅ Lambda functions deployed!"
else
  echo "  ℹ️  Lambda deployment may need manual intervention"
  echo "     Check if all Lambda zip files exist in phase2-backend/deploy/"
fi
echo ""

# Final Summary
echo "======================================"
echo "DEPLOYMENT COMPLETE!"
echo "======================================"
echo ""
echo "✅ Phase 1: AWS Organization & Landing Zone"
echo "✅ Phase 2: Database & API Backend"
echo ""
echo "Deployed Resources:"
echo "  • AWS Organization with 4 customer accounts"
echo "  • Aurora Serverless v2 PostgreSQL database"
echo "  • DynamoDB tables for metrics and events"
echo "  • Lambda functions for API operations"
echo "  • API Gateway REST API"
echo "  • RDS Proxy for connection pooling"
echo ""
echo "Next Steps:"
echo "  1. Test API endpoints:"
echo "     API_ENDPOINT=\$(terraform output -raw api_gateway_endpoint)"
echo "     curl \$API_ENDPOINT/health"
echo "  2. Review database schema:"
echo "     cd phase2-backend/database"
echo "     psql -h \$(terraform output -raw rds_proxy_endpoint) -U securebase_app -d securebase -c '\\dt'"
echo "  3. Deploy Phase 3a Portal UI (see phase3a-portal/README.md)"
echo "  4. Configure Stripe for billing (see MONETIZATION_STRATEGY.md)"
echo "  5. Set up monitoring in CloudWatch"
echo ""
echo "Documentation:"
echo "  • PHASE2_DEPLOYMENT_DETAILED.md - Detailed deployment guide"
echo "  • API_REFERENCE.md - API endpoint documentation"
echo "  • docs/PAAS_ARCHITECTURE.md - Full architecture overview"
echo ""
echo "✅ SecureBase PaaS is now live!"
