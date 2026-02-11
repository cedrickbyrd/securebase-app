#!/bin/bash
set -e

# Deploy Demo Counter Infrastructure
# This script deploys the DynamoDB + Lambda + API Gateway stack

echo "🚀 Deploying Demo Counter Infrastructure..."
echo ""

# Variables
REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-demo}"

echo "Configuration:"
echo "  Region: $REGION"
echo "  Environment: $ENVIRONMENT"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Please install Terraform 1.0+"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install and configure AWS CLI"
    exit 1
fi

# Verify AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Run 'aws configure'"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Initialize Terraform
echo "Initializing Terraform..."
terraform init

# Plan deployment
echo ""
echo "Planning deployment..."
terraform plan \
  -var="aws_region=$REGION" \
  -var="environment=$ENVIRONMENT" \
  -out=tfplan

# Confirm deployment
echo ""
read -p "Deploy infrastructure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deployment cancelled"
    rm -f tfplan
    exit 0
fi

# Apply Terraform
echo ""
echo "Applying Terraform configuration..."
terraform apply tfplan
rm -f tfplan

# Get outputs
echo ""
echo "📊 Deployment Complete!"
echo ""
echo "Outputs:"
terraform output

# Update .env.demo
API_ENDPOINT=$(terraform output -raw api_endpoint)

echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Update phase3a-portal/.env.demo with:"
echo "   VITE_DEMO_COUNTER_ENABLED=true"
echo "   VITE_DEMO_COUNTER_API=$API_ENDPOINT"
echo ""
echo "2. Rebuild and redeploy the portal:"
echo "   cd phase3a-portal"
echo "   npm run build:demo"
echo "   ./deploy-demo.sh"
echo ""
echo "3. Test the API endpoint:"
echo "   curl $API_ENDPOINT"
echo ""

# Test endpoint
echo "Testing API endpoint..."
sleep 2
RESPONSE=$(curl -s "$API_ENDPOINT")
echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "customerIndex"; then
    echo ""
    echo "✅ API endpoint is working!"
else
    echo ""
    echo "⚠️  API endpoint responded but format may be incorrect"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "💰 Estimated monthly cost: \$0.50-1.00 (for typical demo traffic)"
echo ""
