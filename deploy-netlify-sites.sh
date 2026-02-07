#!/bin/bash
# Quick Start Script for Netlify Terraform Deployment
# This script helps set up and deploy the Netlify sites module

set -e

echo "=========================================="
echo "Netlify Terraform Quick Start"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# Check Terraform
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform not found${NC}"
    echo "Please install Terraform: https://www.terraform.io/downloads"
    exit 1
else
    echo -e "${GREEN}✅ Terraform installed:${NC} $(terraform version | head -n1)"
fi

# Check Netlify token
if [ -z "$TF_VAR_netlify_token" ]; then
    echo -e "${YELLOW}⚠️  NETLIFY_TOKEN not set${NC}"
    echo ""
    echo "To deploy Netlify sites, you need to set your Netlify API token:"
    echo ""
    echo "  1. Generate token at: https://app.netlify.com/user/applications#personal-access-tokens"
    echo "  2. Set environment variable:"
    echo ""
    echo "     export TF_VAR_netlify_token=\"your-netlify-token-here\""
    echo ""
    echo "Or use AWS Secrets Manager (see docs/NETLIFY_TERRAFORM_SETUP.md)"
    echo ""
    read -p "Do you want to set the token now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your Netlify API token: " -s NETLIFY_TOKEN
        echo
        export TF_VAR_netlify_token="$NETLIFY_TOKEN"
        echo -e "${GREEN}✅ Token set for this session${NC}"
    else
        echo -e "${YELLOW}Skipping Netlify deployment${NC}"
        exit 0
    fi
else
    echo -e "${GREEN}✅ Netlify token found${NC}"
fi

echo ""
echo "=========================================="
echo "Deploying Netlify Sites"
echo "=========================================="
echo ""

# Navigate to correct directory
cd "$(dirname "$0")/landing-zone/environments/dev"

echo "Current directory: $(pwd)"
echo ""

# Initialize Terraform
echo "1️⃣  Initializing Terraform..."
terraform init

# Validate configuration
echo ""
echo "2️⃣  Validating configuration..."
terraform validate

# Plan deployment (target only Netlify module)
echo ""
echo "3️⃣  Planning Netlify deployment..."
terraform plan -target=module.netlify_sites -out=netlify-tfplan

# Show summary
echo ""
echo "=========================================="
echo "Deployment Plan Summary"
echo "=========================================="
echo ""
echo "Resources to be created:"
echo "  - Marketing site (securebase.io)"
echo "  - Portal demo site (portal-demo.securebase.io)"
echo "  - Environment variables"
echo "  - Build hooks"
echo "  - Deploy keys"
echo ""

# Ask for confirmation
read -p "Do you want to apply this plan? (yes/no) " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Apply deployment
echo ""
echo "4️⃣  Applying deployment..."
terraform apply netlify-tfplan

# Show outputs
echo ""
echo "=========================================="
echo "Deployment Complete! 🎉"
echo "=========================================="
echo ""
echo "📊 Netlify Sites:"
terraform output netlify_deployment_summary

echo ""
echo "Next Steps:"
echo ""
echo "1. Configure DNS for custom domains:"
echo "   - securebase.io → A record to Netlify"
echo "   - portal-demo.securebase.io → CNAME to Netlify"
echo ""
echo "2. Verify sites are accessible:"
echo "   - Marketing: https://securebase.io"
echo "   - Portal Demo: https://portal-demo.securebase.io"
echo ""
echo "3. Check Netlify dashboard: https://app.netlify.com/sites"
echo ""
echo "4. Read full documentation: docs/NETLIFY_TERRAFORM_SETUP.md"
echo ""
