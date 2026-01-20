#!/bin/bash
# Quick Build Script for Phase 4 Analytics
# Run this to prepare all deployment artifacts

set -e

echo "🔨 Building Phase 4 Analytics Deployment Artifacts"
echo "=================================================="

WORKSPACE_ROOT="$(pwd)"

# Step 1: Create deployment directory
echo "📁 Creating deployment directory..."
mkdir -p phase2-backend/deploy

# Step 2: Package Lambda function (no dependencies needed - boto3 is in runtime)
echo "📦 Packaging report_engine Lambda..."
cd phase2-backend/functions
zip -j ../deploy/report_engine.zip report_engine.py
cd "$WORKSPACE_ROOT"

if [ -f "phase2-backend/deploy/report_engine.zip" ]; then
    SIZE=$(du -h phase2-backend/deploy/report_engine.zip | cut -f1)
    echo "✅ Lambda packaged: report_engine.zip ($SIZE)"
else
    echo "❌ Lambda packaging failed"
    exit 1
fi

echo ""
echo "✅ Build Complete!"
echo ""
echo "📦 Artifacts Created:"
echo "  - phase2-backend/deploy/report_engine.zip"
echo ""
echo "🚀 Next Steps:"
echo "  1. Build Lambda layer manually:"
echo "     cd phase2-backend/layers/reporting"
echo "     mkdir -p python/lib/python3.11/site-packages"
echo "     pip install -r requirements.txt -t python/lib/python3.11/site-packages"
echo "     zip -r reporting-layer.zip python/"
echo ""
echo "  2. Publish layer to AWS:"
echo "     aws lambda publish-layer-version \\"
echo "       --layer-name securebase-dev-reporting \\"
echo "       --zip-file fileb://reporting-layer.zip \\"
echo "       --compatible-runtimes python3.11 \\"
echo "       --region us-east-1"
echo ""
echo "  3. Update terraform.tfvars with layer ARN"
echo "  4. Deploy: cd landing-zone && terraform apply"
