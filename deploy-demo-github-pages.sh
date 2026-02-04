#!/bin/bash

# ============================================================================
# SecureBase Demo - GitHub Pages Deployment
# ============================================================================
# Description: Deploy customer portal demo to GitHub Pages (100% free)
# Prerequisites: GitHub repository with Pages enabled
# Usage: ./deploy-demo-github-pages.sh
# ============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  SecureBase Demo - GitHub Pages Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================================
# Pre-flight Checks
# ============================================================================

echo -e "${YELLOW}[1/7] Running pre-flight checks...${NC}"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git not found${NC}"
    echo "Install git from https://git-scm.com"
    exit 1
fi

echo -e "${GREEN}✓ git found${NC}"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not in a git repository${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Git repository detected${NC}"

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
# GitHub Pages Configuration
# ============================================================================

echo -e "${YELLOW}[2/7] Configuring GitHub Pages...${NC}"

# Get repository info
REPO_URL=$(git config --get remote.origin.url)
REPO_NAME=$(basename -s .git "$REPO_URL")
REPO_OWNER=$(echo "$REPO_URL" | sed -n 's/.*[:/]\([^/]*\)\/[^/]*$/\1/p')

echo "Repository: ${REPO_OWNER}/${REPO_NAME}"
echo ""

# Detect if GitHub Pages is already configured
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: ${CURRENT_BRANCH}"

# Check if gh-pages branch exists
if git show-ref --verify --quiet refs/heads/gh-pages; then
    echo -e "${GREEN}✓ gh-pages branch exists${NC}"
else
    echo -e "${YELLOW}⚠  gh-pages branch doesn't exist (will be created)${NC}"
fi

echo ""

# ============================================================================
# Install Dependencies
# ============================================================================

echo -e "${YELLOW}[3/7] Installing dependencies...${NC}"
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

echo -e "${YELLOW}[4/7] Configuring demo environment...${NC}"

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

# Set base path for GitHub Pages (required for proper routing)
echo "VITE_BASE_URL=/securebase-app/" >> .env
echo -e "${GREEN}✓ Base URL configured for GitHub Pages${NC}"

echo ""

# ============================================================================
# Build Application
# ============================================================================

echo -e "${YELLOW}[5/7] Building application for demo...${NC}"

# Clean previous build
if [ -d "dist" ]; then
    echo "Cleaning previous build..."
    rm -rf dist
fi

# Build
echo "Building with Vite..."
npm run build -- --mode demo --base=/securebase-app/

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

# Add .nojekyll file to prevent GitHub Pages from ignoring files starting with _
touch dist/.nojekyll
echo -e "${GREEN}✓ .nojekyll file created${NC}"

# Create 404.html that redirects to index.html for SPA routing
cp dist/index.html dist/404.html
echo -e "${GREEN}✓ 404.html created for SPA routing${NC}"

echo -e "${GREEN}✓ Build completed successfully${NC}"
echo ""

# ============================================================================
# Deploy to GitHub Pages
# ============================================================================

echo -e "${YELLOW}[6/7] Deploying to GitHub Pages...${NC}"
echo ""

# Save current branch
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Stash any uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "Stashing uncommitted changes..."
    git stash
    STASHED=true
else
    STASHED=false
fi

# Create or checkout gh-pages branch
if git show-ref --verify --quiet refs/heads/gh-pages; then
    echo "Checking out gh-pages branch..."
    git checkout gh-pages
else
    echo "Creating gh-pages branch..."
    git checkout --orphan gh-pages
    git rm -rf .
fi

# Copy built files to root
echo "Copying build files..."
cp -r dist/* .

# Create CNAME file if custom domain is set
# Uncomment and edit if you have a custom domain:
# echo "demo.securebase.io" > CNAME

# Add all files
git add -A

# Commit
COMMIT_MSG="Deploy demo to GitHub Pages - $(date '+%Y-%m-%d %H:%M:%S')"
if git diff --cached --quiet; then
    echo "No changes to commit"
else
    echo "Committing changes..."
    git commit -m "$COMMIT_MSG"
fi

# Push to GitHub
echo "Pushing to GitHub..."
git push origin gh-pages

echo -e "${GREEN}✓ Deployment pushed to GitHub${NC}"

# Return to original branch
echo "Returning to ${ORIGINAL_BRANCH} branch..."
git checkout "$ORIGINAL_BRANCH"

# Restore stashed changes
if [ "$STASHED" = true ]; then
    echo "Restoring stashed changes..."
    git stash pop
fi

echo ""
echo -e "${GREEN}✓ Deployment complete${NC}"
echo ""

# ============================================================================
# Post-Deployment Instructions
# ============================================================================

echo -e "${YELLOW}[7/7] Post-deployment setup...${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  📝 GitHub Pages Setup Instructions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "1. Enable GitHub Pages in your repository:"
echo "   • Go to: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/pages"
echo "   • Source: Deploy from a branch"
echo "   • Branch: gh-pages"
echo "   • Folder: / (root)"
echo "   • Click 'Save'"
echo ""

echo "2. Wait 1-2 minutes for deployment to complete"
echo ""

echo "3. Your demo will be available at:"
echo -e "   ${GREEN}https://${REPO_OWNER}.github.io/${REPO_NAME}/${NC}"
echo ""

echo "4. Optional - Custom Domain:"
echo "   • Uncomment CNAME creation in this script"
echo "   • Set your domain (e.g., demo.securebase.io)"
echo "   • Add DNS CNAME record pointing to ${REPO_OWNER}.github.io"
echo "   • Configure in GitHub Pages settings"
echo ""

# ============================================================================
# Success Summary
# ============================================================================

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉 GitHub Pages Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Demo URL (once Pages is enabled):"
echo -e "${BLUE}https://${REPO_OWNER}.github.io/${REPO_NAME}/${NC}"
echo ""

echo "Next steps:"
echo "  1. Enable GitHub Pages (see instructions above)"
echo "  2. Wait 1-2 minutes for deployment"
echo "  3. Visit the URL to verify"
echo "  4. Share with your team!"
echo ""

echo "Demo Features:"
echo "  ✓ 100% free hosting (GitHub Pages)"
echo "  ✓ Auto-login enabled"
echo "  ✓ 5 mock customers with realistic data"
echo "  ✓ Full portal functionality (read-only)"
echo "  ✓ Mobile responsive design"
echo ""

echo "To redeploy after changes:"
echo "  ./deploy-demo-github-pages.sh"
echo ""

echo -e "${GREEN}Happy demoing! 🚀${NC}"
echo ""
