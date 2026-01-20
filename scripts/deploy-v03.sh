#!/bin/bash
# Complete v0.3 Deployment Script
# Packages Lambda functions and deploys complete infrastructure

set -e

echo "🚀 SecureBase v0.3 Complete Deployment"
echo "======================================="
echo ""

# Step 1: Package Lambda functions
echo "📦 Step 1: Packaging Lambda functions..."
cd /workspaces/securebase-app/phase2-backend/functions
mkdir -p ../deploy

for func in auth_v2 webhook_manager billing-worker support_tickets cost_forecasting; do
    source_file="${func//-/_}.py"
    if [ ! -f "$source_file" ]; then
        source_file="${func}.py"
    fi
    
    if [ -f "$source_file" ]; then
        echo "  → Packaging $func..."
        zip -q "../deploy/${func}.zip" "$source_file"
        echo "    ✅ $(du -h ../deploy/${func}.zip | cut -f1)"
    else
        echo "    ⚠️  $source_file not found, skipping"
    fi
done

echo ""
echo "✅ Lambda packages created:"
ls -lh ../deploy/*.zip 2>/dev/null || echo "  No packages found"

# Step 2: Terraform init
echo ""
echo "🔧 Step 2: Initializing Terraform..."
cd /workspaces/securebase-app/landing-zone

if terraform init -upgrade; then
    echo "✅ Terraform initialized"
else
    echo "❌ Terraform init failed"
    exit 1
fi

# Step 3: Terraform validate
echo ""
echo "✔️  Step 3: Validating Terraform configuration..."
if terraform validate; then
    echo "✅ Configuration valid"
else
    echo "❌ Validation failed"
    exit 1
fi

# Step 4: Terraform plan
echo ""
echo "📋 Step 4: Creating deployment plan..."
if terraform plan -out=tfplan-v03; then
    echo "✅ Plan created successfully"
else
    echo "❌ Planning failed"
    exit 1
fi

# Step 5: Review and confirm
echo ""
echo "======================================"
echo "🎯 Ready to Deploy"
echo "======================================"
echo ""
echo "This will deploy:"
echo "  • 5 Lambda functions (auth, webhooks, billing, support, forecasting)"
echo "  • API Gateway REST API with 5 endpoints"
echo "  • CloudWatch logs and alarms"
echo "  • JWT authorizer"
echo "  • Security headers and CORS"
echo ""
echo "Estimated deployment time: 5-10 minutes"
echo "Estimated monthly cost: +$36/month (10M API calls)"
echo ""

read -p "Deploy now? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deployment cancelled"
    echo "Plan saved to tfplan-v03 - run 'terraform apply tfplan-v03' to deploy later"
    exit 0
fi

# Step 6: Apply
echo ""
echo "🚀 Step 6: Deploying infrastructure..."
if terraform apply tfplan-v03; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed"
    exit 1
fi

# Step 7: Get API endpoint
echo ""
echo "📊 Step 7: Extracting API Gateway endpoint..."
API_ENDPOINT=$(terraform output -raw api_gateway_endpoint 2>/dev/null || echo "Not available")

echo ""
echo "======================================"
echo "🎉 Deployment Complete!"
echo "======================================"
echo ""
echo "API Gateway Endpoint:"
echo "  $API_ENDPOINT"
echo ""
echo "Next steps:"
echo "1. Configure React portal:"
echo "   cd /workspaces/securebase-app/phase3a-portal"
echo "   echo 'VITE_API_BASE_URL=$API_ENDPOINT' > .env"
echo "   npm install && npm run dev"
echo ""
echo "2. Test API:"
echo "   curl $API_ENDPOINT/auth -X POST -H 'Authorization: Bearer test-key'"
echo ""
echo "3. View logs:"
echo "   aws logs tail /aws/lambda/securebase-dev-auth-v2 --follow"
echo ""
