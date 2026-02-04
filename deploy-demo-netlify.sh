#!/bin/bash

# ============================================================================
# SecureBase Demo - One-Command Netlify Deployment
# ============================================================================
# Description: Deploy customer portal demo to Netlify in one command
# Prerequisites: Netlify CLI installed (npm install -g netlify-cli)
# Usage: ./deploy-demo-netlify.sh
# ============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  SecureBase Demo - Netlify Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================================
# Pre-flight Checks
# ============================================================================

echo -e "${YELLOW}[1/6] Running pre-flight checks...${NC}"

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo -e "${RED}❌ Netlify CLI not found${NC}"
    echo ""
    echo "Install with:"
    echo "  npm install -g netlify-cli"
    echo ""
    echo "Or use the web UI: https://app.netlify.com"
    exit 1
fi

echo -e "${GREEN}✓ Netlify CLI found${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}⚠  Not in project root. Changing directory...${NC}"
    cd "$(dirname "$0")"
fi

if [ ! -d "phase3a-portal" ]; then
    echo -e "${RED}❌ phase3a-portal directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Project structure verified${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "Install Node.js 18+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}⚠  Node.js version $NODE_VERSION detected. Version 18+ recommended.${NC}"
else
    echo -e "${GREEN}✓ Node.js $(node -v) found${NC}"
fi

echo ""

# ============================================================================
# Install Dependencies
# ============================================================================

echo -e "${YELLOW}[2/6] Installing dependencies...${NC}"
cd phase3a-portal

if [ ! -d "node_modules" ]; then
    echo "Installing packages (this may take a few minutes)..."
    npm install
else
    echo "Dependencies already installed. Skipping..."
fi

echo -e "${GREEN}✓ Dependencies ready${NC}"
echo ""

# ============================================================================
# Configure Demo Environment
# ============================================================================

echo -e "${YELLOW}[3/6] Configuring demo environment...${NC}"

# Copy demo environment file
if [ -f ".env.demo" ]; then
    cp .env.demo .env
    echo -e "${GREEN}✓ Demo environment configured${NC}"
else
    echo -e "${YELLOW}⚠  .env.demo not found, creating from defaults...${NC}"
    cat > .env <<EOF
VITE_USE_MOCK_API=true
VITE_ENV=demo
VITE_ANALYTICS_ENABLED=false
VITE_API_BASE_URL=https://demo-api.securebase.io/v1
VITE_WS_URL=wss://demo-ws.securebase.io
EOF
    echo -e "${GREEN}✓ Default demo environment created${NC}"
fi

echo ""

# ============================================================================
# Build Application
# ============================================================================

echo -e "${YELLOW}[4/6] Building application for demo...${NC}"

# Clean previous build
if [ -d "dist" ]; then
    echo "Cleaning previous build..."
    rm -rf dist
fi

# Build
echo "Building with Vite..."
npm run build -- --mode demo

# Verify build output
if [ ! -f "dist/index.html" ]; then
    echo -e "${RED}❌ Build failed - dist/index.html not found${NC}"
    exit 1
fi

# Copy demo data
if [ -f "demo-data.json" ]; then
    cp demo-data.json dist/demo-data.json
    echo -e "${GREEN}✓ Demo data included in build${NC}"
fi

echo -e "${GREEN}✓ Build completed successfully${NC}"
echo ""

# ============================================================================
# Deploy to Netlify
# ============================================================================

echo -e "${YELLOW}[5/6] Deploying to Netlify...${NC}"
echo ""
echo "This will deploy the customer portal with:"
echo "  • Mock API enabled (no real backend)"
echo "  • Demo mode indicators"
echo "  • Read-only functionality"
echo "  • Sample data for 5 customers"
echo ""

# Check if already linked to a Netlify site
if [ -f ".netlify/state.json" ]; then
    echo "Site already linked. Deploying to existing site..."
    echo ""
    netlify deploy --prod --dir=dist
else
    echo "First time deployment. This will create a new Netlify site."
    echo ""
    echo "You'll be prompted to:"
    echo "  1. Authorize Netlify (if first time)"
    echo "  2. Choose your team"
    echo "  3. Create new site or link existing"
    echo "  4. Confirm build directory (dist)"
    echo ""
    
    netlify deploy --prod --dir=dist
fi

DEPLOY_EXIT_CODE=$?

if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    echo ""
    echo "Common issues:"
    echo "  • Not logged into Netlify: Run 'netlify login'"
    echo "  • Build directory wrong: Should be 'dist'"
    echo "  • Network issues: Check internet connection"
    echo ""
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Deployment successful!${NC}"
echo ""

# ============================================================================
# Post-Deployment Validation
# ============================================================================

echo -e "${YELLOW}[6/6] Running post-deployment checks...${NC}"

# Get the deployed URL from Netlify state
if [ -f ".netlify/state.json" ]; then
    SITE_ID=$(cat .netlify/state.json | grep -o '"siteId":"[^"]*' | cut -d'"' -f4)
    if [ -n "$SITE_ID" ]; then
        # Get site info
        SITE_URL=$(netlify status --json 2>/dev/null | grep -o '"url":"[^"]*' | head -1 | cut -d'"' -f4)
        
        if [ -n "$SITE_URL" ]; then
            echo ""
            echo -e "${GREEN}✓ Site URL: ${SITE_URL}${NC}"
            
            # Wait a moment for deployment to propagate
            echo ""
            echo "Waiting 5 seconds for deployment to propagate..."
            sleep 5
            
            # Test the site
            echo "Testing deployment..."
            HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" "${SITE_URL}" || echo "000")
            
            if [ "$HTTP_CODE" = "200" ]; then
                echo -e "${GREEN}✓ Site is accessible (HTTP ${HTTP_CODE})${NC}"
            else
                echo -e "${YELLOW}⚠  Site returned HTTP ${HTTP_CODE} (may still be deploying)${NC}"
            fi
        fi
    fi
fi

# ============================================================================
# Success Summary
# ============================================================================

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉 Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -n "$SITE_URL" ]; then
    echo "Your demo is live at:"
    echo -e "${BLUE}${SITE_URL}${NC}"
    echo ""
fi

echo "Next steps:"
echo "  1. Open the URL in your browser"
echo "  2. Verify demo banner is visible"
echo "  3. Test navigation and features"
echo "  4. Share with your team!"
echo ""

echo "Demo Features:"
echo "  ✓ Auto-login enabled"
echo "  ✓ 5 mock customers with realistic data"
echo "  ✓ Full portal functionality (read-only)"
echo "  ✓ Professional, production-ready UI"
echo "  ✓ Mobile responsive design"
echo ""

echo "Management:"
echo "  • View deployments: netlify open"
echo "  • Site dashboard: https://app.netlify.com"
echo "  • Custom domain: Configure in Netlify settings"
echo "  • Analytics: Available in Netlify dashboard"
echo ""

echo "To redeploy after changes:"
echo "  cd phase3a-portal"
echo "  npm run build"
echo "  netlify deploy --prod --dir=dist"
echo ""

echo -e "${GREEN}Happy demoing! 🚀${NC}"
echo ""
