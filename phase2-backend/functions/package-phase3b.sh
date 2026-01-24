#!/bin/bash
# Package Phase 3b Lambda Functions
# This script creates deployment packages for Phase 3b Lambda functions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTIONS_DIR="${SCRIPT_DIR}"
DEPLOY_DIR="${SCRIPT_DIR}/../deploy/phase3b"

echo "=========================================="
echo "Phase 3b Lambda Packaging Script"
echo "=========================================="

# Create deployment directory
mkdir -p "${DEPLOY_DIR}"

# Phase 3b Functions to package
PHASE3B_FUNCTIONS=(
    "support_tickets"
    "webhook_manager"
    "cost_forecasting"
)

echo ""
echo "Packaging Phase 3b Lambda Functions..."
echo ""

MISSING_FUNCTIONS=0

for function in "${PHASE3B_FUNCTIONS[@]}"; do
    echo "→ Packaging ${function}..."
    
    # Check if function file exists
    if [ ! -f "${FUNCTIONS_DIR}/${function}.py" ]; then
        echo "  ❌ ERROR: ${function}.py not found"
        MISSING_FUNCTIONS=$((MISSING_FUNCTIONS + 1))
        continue
    fi
    
    # Create temporary directory for this function
    temp_dir=$(mktemp -d)
    
    # Copy function file
    cp "${FUNCTIONS_DIR}/${function}.py" "${temp_dir}/lambda_function.py"
    
    # Copy shared lambda_layer utilities if they exist
    if [ -d "${FUNCTIONS_DIR}/../lambda_layer/python" ]; then
        cp -r "${FUNCTIONS_DIR}/../lambda_layer/python"/* "${temp_dir}/"
    fi
    
    # Create zip file
    cd "${temp_dir}"
    zip -r "${DEPLOY_DIR}/${function}.zip" . > /dev/null 2>&1
    cd - > /dev/null
    
    # Clean up temp directory
    rm -rf "${temp_dir}"
    
    # Get file size
    size=$(du -h "${DEPLOY_DIR}/${function}.zip" | cut -f1)
    echo "  ✓ Created ${function}.zip (${size})"
done

echo ""

if [ $MISSING_FUNCTIONS -gt 0 ]; then
    echo "=========================================="
    echo "❌ ERROR: ${MISSING_FUNCTIONS} function(s) not found"
    echo "Packaging incomplete. Please ensure all required .py files exist."
    echo "=========================================="
    exit 1
fi

echo "=========================================="
echo "✓ Phase 3b Lambda packaging complete!"
echo ""
echo "Packages created in: ${DEPLOY_DIR}"
echo ""
ls -lh "${DEPLOY_DIR}"
echo ""
echo "Next steps:"
echo "1. Review the packages in ${DEPLOY_DIR}"
echo "2. Update Terraform variables to reference these packages"
echo "3. Run 'terraform plan' to review infrastructure changes"
echo "4. Run 'terraform apply' to deploy Phase 3b infrastructure"
echo "=========================================="
