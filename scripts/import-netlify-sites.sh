#!/bin/bash
# Import existing Netlify sites into Terraform state
# Usage: ./scripts/import-netlify-sites.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "Netlify Site Import Script"
echo "=========================================="
echo ""

# Prerequisites check
echo "Checking prerequisites..."

# 1. Check Terraform installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform not installed${NC}"
    exit 1
fi

# 2. Check Netlify CLI installed
if ! command -v netlify &> /dev/null; then
    echo -e "${RED}❌ Netlify CLI not installed${NC}"
    echo "Install with: npm install -g netlify-cli"
    exit 1
fi

# 3. Check Netlify token set
if [ -z "$TF_VAR_netlify_token" ]; then
    echo -e "${YELLOW}⚠️  TF_VAR_netlify_token not set${NC}"
    echo ""
    read -p "Enter your Netlify API token: " -s NETLIFY_TOKEN
    echo
    export TF_VAR_netlify_token="$NETLIFY_TOKEN"
fi

echo -e "${GREEN}✅ Prerequisites met${NC}"
echo ""

# Get Site IDs from Netlify
echo "Fetching Netlify site information..."
echo ""

# Login check
netlify status &> /dev/null || netlify login

# Get site IDs - user will need to provide these
echo "Please provide the Site IDs from Netlify Dashboard:"
echo "  1. Go to https://app.netlify.com/sites/securebase-app/settings/general"
echo "  2. Copy the 'Site ID' (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
echo ""

read -p "Enter Site ID for securebase-app.netlify.app: " MARKETING_SITE_ID
read -p "Enter Site ID for securebase-demo.netlify.app: " DEMO_SITE_ID

echo ""
echo "Site IDs captured:"
echo "  Marketing: $MARKETING_SITE_ID"
echo "  Demo: $DEMO_SITE_ID"
echo ""

# Navigate to Terraform directory
cd "$(dirname "$0")/../landing-zone/environments/dev"

echo "Current directory: $(pwd)"
echo ""

# Initialize Terraform
echo "1️⃣  Initializing Terraform..."
terraform init

echo ""
echo "2️⃣  Importing existing sites into Terraform state..."
echo ""

# Import marketing site data source
echo "Importing marketing site (securebase-app)..."
# Note: Data sources don't need import, but environment variables do
# We'll import the environment variable resources

# Import environment variables for marketing site
echo "  - Importing NODE_VERSION environment variable..."
terraform import 'module.netlify_sites.netlify_environment_variable.marketing_node_version' "${MARKETING_SITE_ID}:NODE_VERSION" || echo "  ⚠️  Variable may not exist yet, will be created"

echo "  - Importing VITE_ENV environment variable..."
terraform import 'module.netlify_sites.netlify_environment_variable.marketing_vite_env' "${MARKETING_SITE_ID}:VITE_ENV" || echo "  ⚠️  Variable may not exist yet, will be created"

echo ""
echo "Importing demo portal site (securebase-demo)..."

# Import environment variables for demo site
echo "  - Importing NODE_VERSION environment variable..."
terraform import 'module.netlify_sites.netlify_environment_variable.portal_demo_node_version' "${DEMO_SITE_ID}:NODE_VERSION" || echo "  ⚠️  Variable may not exist yet, will be created"

echo "  - Importing VITE_USE_MOCK_API environment variable..."
terraform import 'module.netlify_sites.netlify_environment_variable.portal_demo_mock_api' "${DEMO_SITE_ID}:VITE_USE_MOCK_API" || echo "  ⚠️  Variable may not exist yet, will be created"

echo "  - Importing VITE_ENV environment variable..."
terraform import 'module.netlify_sites.netlify_environment_variable.portal_demo_vite_env' "${DEMO_SITE_ID}:VITE_ENV" || echo "  ⚠️  Variable may not exist yet, will be created"

echo "  - Importing VITE_ANALYTICS_ENABLED environment variable..."
terraform import 'module.netlify_sites.netlify_environment_variable.portal_demo_analytics' "${DEMO_SITE_ID}:VITE_ANALYTICS_ENABLED" || echo "  ⚠️  Variable may not exist yet, will be created"

echo ""
echo "3️⃣  Verifying import..."
echo ""

# Run terraform plan to verify
terraform plan -target=module.netlify_sites

echo ""
echo "=========================================="
echo "Import Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review the plan above"
echo "  2. If plan shows 'No changes', import was successful"
echo "  3. If plan shows changes, resources will be created/updated to match Terraform config"
echo "  4. Run: terraform apply -target=module.netlify_sites"
echo ""
