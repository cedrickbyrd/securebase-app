#!/bin/bash
# End-to-End Deployment Script for SecureBase v0.3
# Deploys Lambda functions + API Gateway + React portal

set -e

echo "🚀 SecureBase v0.3 End-to-End Deployment"
echo "=========================================="
echo ""

REGION="us-east-1"
ENVIRONMENT="dev"
PROJECT_ROOT="/workspaces/securebase-app"

# Step 1: Package Lambda functions
echo "📦 Step 1: Packaging Lambda functions..."
cd "$PROJECT_ROOT/phase2-backend/functions"

mkdir -p ../deploy

echo "  → Packaging auth_v2..."
zip -q ../deploy/auth_v2.zip auth_v2.py
echo "  ✅ auth_v2.zip created"

echo "  → Packaging webhook_manager..."
zip -q ../deploy/webhook_manager.zip webhook_manager.py
echo "  ✅ webhook_manager.zip created"

echo "  → Packaging billing_worker..."
zip -q ../deploy/billing_worker.zip billing-worker.py
echo "  ✅ billing_worker.zip created"

echo "  → Packaging support_tickets..."
zip -q ../deploy/support_tickets.zip support_tickets.py
echo "  ✅ support_tickets.zip created"

echo "  → Packaging cost_forecasting..."
zip -q ../deploy/cost_forecasting.zip cost_forecasting.py
echo "  ✅ cost_forecasting.zip created"

echo ""
echo "✅ All Lambda functions packaged"
ls -lh ../deploy/*.zip
echo ""

# Step 2: Terraform plan
echo "📋 Step 2: Running Terraform plan..."
cd "$PROJECT_ROOT/landing-zone"

terraform plan -out=tfplan
echo ""
echo "✅ Terraform plan complete"
echo ""

# Step 3: Confirm deployment
read -p "🚦 Deploy infrastructure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

# Step 4: Deploy infrastructure
echo ""
echo "🚀 Step 4: Deploying infrastructure..."
terraform apply tfplan
echo ""
echo "✅ Infrastructure deployed"
echo ""

# Step 5: Get API endpoint
echo "📊 Step 5: Extracting API Gateway endpoint..."
API_ENDPOINT=$(terraform output -raw api_gateway_endpoint 2>/dev/null || echo "")

if [ -z "$API_ENDPOINT" ]; then
    echo "⚠️  Could not extract API endpoint from Terraform output"
    echo "   You'll need to manually configure the React app"
else
    echo "✅ API Gateway Endpoint: $API_ENDPOINT"
    
    # Update React .env file
    echo ""
    echo "📝 Step 6: Configuring React portal..."
    cat > "$PROJECT_ROOT/phase3a-portal/.env" <<EOF
VITE_API_BASE_URL=$API_ENDPOINT
VITE_ENVIRONMENT=$ENVIRONMENT
EOF
    echo "✅ React environment configured"
fi

echo ""
echo "==========================================  ="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test API Gateway:"
echo "   curl $API_ENDPOINT/auth -X POST -H 'Authorization: Bearer YOUR_API_KEY'"
echo ""
echo "2. Start React portal:"
echo "   cd phase3a-portal && npm install && npm run dev"
echo ""
echo "3. Access portal at:"
echo "   http://localhost:5173"
echo ""
