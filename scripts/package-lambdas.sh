#!/bin/bash
# Lambda Deployment Script for SecureBase Phase 2 Backend
# Packages and deploys all Lambda functions

set -e

echo "🚀 SecureBase Lambda Deployment"
echo "================================"

# Variables
REGION="us-east-1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUNCTIONS_DIR="$ROOT/phase2-backend/functions"
DEPLOY_DIR="$ROOT/phase2-backend/deploy"

# Create deployment directory
mkdir -p "$DEPLOY_DIR"

# Function to package Lambda
package_lambda() {
    local function_name=$1
    local source_file=$2
    
    echo ""
    echo "📦 Packaging $function_name..."
    
    # Create temp directory
    temp_dir="$DEPLOY_DIR/${function_name}_temp"
    mkdir -p "$temp_dir"
    
    # Copy source file
    cp "$FUNCTIONS_DIR/$source_file" "$temp_dir/lambda_function.py"
    
    # Install dependencies if requirements exist
    if [ -f "$FUNCTIONS_DIR/requirements.txt" ]; then
        echo "  📥 Installing dependencies..."
        pip install -r "$FUNCTIONS_DIR/requirements.txt" -t "$temp_dir" --quiet
    fi
    
    # Create ZIP package
    cd "$temp_dir"
    zip -r "$DEPLOY_DIR/${function_name}.zip" . -q
    cd - > /dev/null
    
    # Cleanup temp directory
    rm -rf "$temp_dir"
    
    echo "  ✅ Package created: ${function_name}.zip ($(du -h $DEPLOY_DIR/${function_name}.zip | cut -f1))"
}

# Package all Lambda functions
echo ""
echo "Packaging Lambda functions..."

package_lambda "auth_v2" "auth_v2.py"
package_lambda "webhook_manager" "webhook_manager.py"
package_lambda "billing_worker" "billing-worker.py"
package_lambda "support_tickets" "support_tickets.py"
package_lambda "cost_forecasting" "cost_forecasting.py"

echo ""
echo "✅ All Lambda functions packaged successfully!"
echo ""
echo "Package location: $DEPLOY_DIR"
ls -lh "$DEPLOY_DIR"/*.zip

echo ""
echo "📋 Next steps:"
echo "1. Deploy infrastructure: cd landing-zone/environments/dev && terraform apply"
echo "2. Lambda packages will be deployed automatically via Terraform"
echo ""
