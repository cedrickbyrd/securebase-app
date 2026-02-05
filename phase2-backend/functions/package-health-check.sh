#!/bin/bash
# Package Health Check Lambda Function for Deployment
# This creates a deployment-ready zip file

set -e

echo "📦 Packaging health_check Lambda function..."

# Navigate to functions directory
cd "$(dirname "$0")"

# Create deploy directory if it doesn't exist
mkdir -p ../deploy

# Remove old zip if exists
rm -f ../deploy/health_check.zip

# Create zip with just the Python file
# boto3 and other AWS SDKs are already included in Lambda Python 3.11 runtime
# db_utils will be provided by the Lambda Layer
zip -j ../deploy/health_check.zip health_check.py

# Verify
if [ -f "../deploy/health_check.zip" ]; then
    SIZE=$(du -h ../deploy/health_check.zip | cut -f1)
    echo "✅ Lambda packaged successfully"
    echo "   File: ../deploy/health_check.zip"
    echo "   Size: $SIZE"
    echo ""
    echo "📋 Contents:"
    unzip -l ../deploy/health_check.zip
else
    echo "❌ Packaging failed"
    exit 1
fi

echo ""
echo "🚀 Ready to deploy!"
echo ""
echo "Next steps:"
echo "1. Ensure db_utils Lambda Layer is deployed (provides database utilities)"
echo "2. Deploy with Terraform: cd ../../../landing-zone/environments/dev && terraform apply"
echo "3. Attach Lambda Layer to function (if not done by Terraform)"
echo "4. Test endpoint: curl https://[api-id].execute-api.us-east-1.amazonaws.com/prod/health"
