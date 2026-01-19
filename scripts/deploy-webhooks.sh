#!/bin/bash
# Deploy Webhook System

set -e

echo "🚀 Deploying SecureBase Webhook System"
echo "======================================"

# 1. Package Lambda function
echo ""
echo "📦 Step 1: Packaging Lambda function..."
cd phase2-backend/functions

if [ ! -d "requests" ]; then
  pip install requests -t .
fi

zip -r webhook_manager.zip webhook_manager.py requests/ boto3/
mv webhook_manager.zip ../../landing-zone/modules/webhooks/

echo "✅ Lambda function packaged"

# 2. Deploy Terraform
echo ""
echo "🏗️  Step 2: Deploying infrastructure..."
cd ../../landing-zone/environments/dev

terraform init -upgrade
terraform plan -out=webhook-plan

read -p "Review plan and press Enter to apply (or Ctrl+C to cancel)..."

terraform apply webhook-plan

echo "✅ Infrastructure deployed"

# 3. Test webhook endpoint
echo ""
echo "🧪 Step 3: Testing webhook endpoints..."

API_URL=$(terraform output -raw api_gateway_url 2>/dev/null || echo "https://api.securebase.com/v1")

echo "Testing webhook creation endpoint..."
curl -X POST "$API_URL/webhooks" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/test",
    "events": ["invoice.created"],
    "description": "Test webhook"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "✅ Webhook system deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Update frontend .env with API_URL: $API_URL"
echo "  2. Deploy customer portal: cd ../../../phase3a-portal && npm run build"
echo "  3. Test webhook creation in portal at /webhooks"
echo "  4. Configure monitoring alerts in CloudWatch"
