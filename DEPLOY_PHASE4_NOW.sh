#!/bin/bash
# SecureBase Phase 4 Component 1: Analytics Deployment Script
# Run this to deploy Advanced Analytics & Reporting to AWS

set -e

echo "🚀 SecureBase Phase 4 Component 1: Analytics Deployment"
echo "=========================================================="
echo ""

# Step 1: Package Lambda Function
echo "📦 Step 1/5: Packaging Lambda function..."
cd /workspaces/securebase-app/phase2-backend/functions
rm -f ../deploy/report_engine.zip
mkdir -p ../deploy
zip -j ../deploy/report_engine.zip report_engine.py
echo "✅ Lambda function packaged: $(du -h ../deploy/report_engine.zip | cut -f1)"
echo ""

# Step 2: Build Lambda Layer
echo "🔨 Step 2/5: Building Lambda layer with dependencies..."
cd /workspaces/securebase-app/phase2-backend/layers/reporting
rm -rf python reporting-layer.zip
mkdir -p python/lib/python3.11/site-packages
pip install -q -r requirements.txt -t python/lib/python3.11/site-packages
zip -r -q reporting-layer.zip python/
echo "✅ Lambda layer built: $(du -h reporting-layer.zip | cut -f1)"
echo ""

# Step 3: Publish Lambda Layer to AWS
echo "☁️  Step 3/5: Publishing Lambda layer to AWS..."
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --description "ReportLab + openpyxl for Phase 4 Analytics" \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1 \
  --query 'LayerVersionArn' \
  --output text)

echo "✅ Layer published: $LAYER_ARN"
echo ""

# Step 4: Update Terraform with Layer ARN
echo "📝 Step 4/5: Configuring Terraform..."
cd /workspaces/securebase-app/landing-zone

# Check if terraform.tfvars exists, create if not
if [ ! -f terraform.tfvars ]; then
  echo "# SecureBase Configuration" > terraform.tfvars
  echo "environment = \"dev\"" >> terraform.tfvars
  echo "org_name = \"SecureBase\"" >> terraform.tfvars
  echo "target_region = \"us-east-1\"" >> terraform.tfvars
fi

# Add or update layer ARN in tfvars
if grep -q "reporting_layer_arn" terraform.tfvars; then
  sed -i "s|reporting_layer_arn = .*|reporting_layer_arn = \"$LAYER_ARN\"|" terraform.tfvars
else
  echo "" >> terraform.tfvars
  echo "# Phase 4: Analytics Lambda Layer" >> terraform.tfvars
  echo "reporting_layer_arn = \"$LAYER_ARN\"" >> terraform.tfvars
fi

echo "✅ Terraform configured"
echo ""

# Step 5: Deploy Infrastructure with Terraform
echo "🏗️  Step 5/5: Deploying infrastructure to AWS..."
terraform init -upgrade
terraform plan -out=phase4-analytics.tfplan
echo ""
echo "📋 Terraform plan created. Review above output."
echo ""
read -p "Deploy to AWS? (yes/no): " CONFIRM

if [ "$CONFIRM" = "yes" ]; then
  terraform apply phase4-analytics.tfplan
  echo ""
  echo "✅ Deployment complete!"
  echo ""
  echo "🎉 Phase 4 Component 1: Analytics & Reporting deployed successfully!"
  echo ""
  echo "📊 Next steps:"
  echo "   1. Test API endpoints: terraform output api_endpoints"
  echo "   2. Test Lambda function: aws lambda invoke --function-name securebase-dev-report-engine test-output.json"
  echo "   3. View logs: aws logs tail /aws/lambda/securebase-dev-report-engine --follow"
  echo "   4. Access portal: Open phase3a-portal and test Analytics dashboard"
  echo ""
else
  echo "❌ Deployment cancelled"
  exit 1
fi
