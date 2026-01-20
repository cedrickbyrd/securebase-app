#!/bin/bash
# Package Lambda Function for Deployment
# This creates a deployment-ready zip file

set -e

echo "📦 Packaging report_engine Lambda function..."

# Navigate to functions directory
cd "$(dirname "$0")"

# Create deploy directory if it doesn't exist
mkdir -p ../deploy

# Remove old zip if exists
rm -f ../deploy/report_engine.zip

# Create zip with just the Python file
# boto3 is already included in Lambda Python 3.11 runtime
zip -j ../deploy/report_engine.zip report_engine.py

# Verify
if [ -f "../deploy/report_engine.zip" ]; then
    SIZE=$(du -h ../deploy/report_engine.zip | cut -f1)
    echo "✅ Lambda packaged successfully"
    echo "   File: ../deploy/report_engine.zip"
    echo "   Size: $SIZE"
    echo ""
    echo "📋 Contents:"
    unzip -l ../deploy/report_engine.zip
else
    echo "❌ Packaging failed"
    exit 1
fi

echo ""
echo "🚀 Ready to deploy!"
echo ""
echo "Next steps:"
echo "1. Build Lambda layer: cd ../layers/reporting && ./build-layer.sh"
echo "2. Publish layer to AWS"
echo "3. Deploy with Terraform: cd ../../../landing-zone && terraform apply"
