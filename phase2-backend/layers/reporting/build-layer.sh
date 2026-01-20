#!/bin/bash
# Build Lambda Layer for Report Engine
# Phase 4 - Advanced Analytics

set -e

echo "🔨 Building Lambda Layer for Reporting..."

# Create layer directory structure
mkdir -p python/lib/python3.11/site-packages

# Install dependencies
pip install -r requirements.txt -t python/lib/python3.11/site-packages

# Create zip file
zip -r reporting-layer.zip python/

echo "✅ Layer built: reporting-layer.zip"
echo "📦 Size: $(du -h reporting-layer.zip | cut -f1)"

# Upload to S3 (optional)
# aws s3 cp reporting-layer.zip s3://YOUR-BUCKET/lambda-layers/

# Publish layer (optional)
# aws lambda publish-layer-version \
#   --layer-name securebase-reporting \
#   --description "ReportLab + openpyxl for report generation" \
#   --zip-file fileb://reporting-layer.zip \
#   --compatible-runtimes python3.11

echo "💡 To deploy, run:"
echo "   aws lambda publish-layer-version --layer-name securebase-reporting --zip-file fileb://reporting-layer.zip"
