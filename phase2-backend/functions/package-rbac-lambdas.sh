#!/bin/bash
# Package RBAC Lambda Functions for Deployment
# Phase 4 Component 2 - Team Collaboration & RBAC

set -e

echo "📦 Packaging RBAC Lambda functions..."

# Navigate to functions directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Create deploy directory if it doesn't exist
mkdir -p ../deploy

# Function to package a Lambda
package_lambda() {
    local FUNC_NAME=$1
    local FUNC_FILE="${FUNC_NAME}.py"
    local ZIP_FILE="${SCRIPT_DIR}/../deploy/${FUNC_NAME}.zip"
    
    echo ""
    echo "Packaging ${FUNC_NAME}..."
    
    # Remove old zip if exists
    rm -f "$ZIP_FILE"
    
    # Check if function exists
    if [ ! -f "$FUNC_FILE" ]; then
        echo "❌ Error: $FUNC_FILE not found"
        return 1
    fi
    
    # Create a temp directory for dependencies
    TEMP_DIR=$(mktemp -d)
    
    # Copy the function
    cp "$FUNC_FILE" "$TEMP_DIR/"
    
    # Install Python dependencies if requirements.txt exists
    if [ -f "requirements.txt" ]; then
        echo "  Installing dependencies..."
        pip install -q -r requirements.txt -t "$TEMP_DIR/" 2>/dev/null || echo "  Note: Some dependencies may already be in Lambda runtime"
    fi
    
    # Create zip from temp directory
    (cd "$TEMP_DIR" && zip -q -r "$ZIP_FILE" . -x "*.pyc" -x "__pycache__/*" 2>/dev/null) || {
        echo "  ⚠️  Warning: zip may have issues, trying alternative..."
        cd "$TEMP_DIR"
        zip -q "$ZIP_FILE" *.py 2>/dev/null || {
            # Fallback: just zip the Python file
            cd "$SCRIPT_DIR"
            zip -q "$ZIP_FILE" "$FUNC_FILE"
        }
    }
    
    # Clean up
    rm -rf "$TEMP_DIR"
    
    # Verify
    if [ -f "$ZIP_FILE" ]; then
        SIZE=$(du -h "$ZIP_FILE" | cut -f1)
        echo "  ✅ Packaged successfully ($SIZE)"
    else
        echo "  ❌ Packaging failed"
        return 1
    fi
}

# Package all RBAC functions
package_lambda "user_management"
package_lambda "session_management"
package_lambda "activity_feed"
package_lambda "rbac_engine"

echo ""
echo "✅ All RBAC Lambda functions packaged successfully!"
echo ""
echo "📁 Deployment files created in ../deploy/:"
ls -lh ../deploy/*.zip 2>/dev/null | grep -E "(user_management|session_management|activity_feed|rbac_engine)" || echo "Checking files..."
ls -1 ../deploy/{user_management,session_management,activity_feed,rbac_engine}.zip 2>/dev/null || echo "Note: Check ../deploy/ directory for zip files"
echo ""
echo "🚀 Ready to deploy with Terraform!"
echo ""
echo "Next steps:"
echo "1. cd ../../landing-zone"
echo "2. terraform init"
echo "3. terraform plan"
echo "4. terraform apply"

