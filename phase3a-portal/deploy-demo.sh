#!/bin/bash

# ============================================================================
# Phase 3A Customer Portal - Demo Deployment Script
# ============================================================================
# Description: Deploy Phase 3A portal to AWS S3 + CloudFront (Demo)
# Author: SecureBase Team
# Date: January 30, 2026
# ============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# CI Mode Detection
AUTO_APPROVE=false
QUIET_MODE=false

if [ "$CI" = "true" ] || [ "$1" = "--ci" ]; then
  AUTO_APPROVE=true
  QUIET_MODE=true
  echo "Running in CI mode (non-interactive)"
fi

# Configuration
ENVIRONMENT="demo"
S3_BUCKET="securebase-phase3a-demo"
CLOUDFRONT_DISTRIBUTION_ID="EGY0W64KNE7BO"
AWS_REGION="us-east-1"
BUILD_DIR="dist"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Phase 3A Customer Portal - Demo Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================================
# Step 1: Pre-deployment Checks
# ============================================================================
echo -e "${YELLOW}[1/9] Running pre-deployment checks...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run from phase3a-portal directory.${NC}"
    exit 1
fi

# Run validation script
if [ -f "validate-demo-files.sh" ]; then
    echo -e "${YELLOW}Running file validation...${NC}"
    if ! ./validate-demo-files.sh; then
        echo -e "${RED}Error: Pre-deployment validation failed.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Warning: validate-demo-files.sh not found. Skipping validation.${NC}"
fi

# Check if .env.demo exists
if [ ! -f ".env.demo" ]; then
    echo -e "${RED}Error: .env.demo file not found.${NC}"
    echo -e "${YELLOW}Please create .env.demo with required environment variables.${NC}"
    exit 1
fi

# Check if demo-data.json exists
if [ ! -f "demo-data.json" ]; then
    echo -e "${RED}Error: demo-data.json file not found.${NC}"
    echo -e "${YELLOW}Demo data is required for demo environment.${NC}"
    exit 1
fi

# Check AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed.${NC}"
    echo -e "${YELLOW}Install it from: https://aws.amazon.com/cli/${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured.${NC}"
    echo -e "${YELLOW}Run: aws configure${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
echo ""

# ============================================================================
# Step 2: Install Dependencies
# ============================================================================
echo -e "${YELLOW}[2/9] Installing dependencies...${NC}"

if [ ! -d "node_modules" ]; then
    npm install
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi
echo ""

# ============================================================================
# Step 3: Run Linting
# ============================================================================
echo -e "${YELLOW}[3/9] Running linter...${NC}"

npm run lint || {
    echo -e "${YELLOW}Warning: Linting found issues. Continuing anyway...${NC}"
}
echo ""

# ============================================================================
# Step 4: Build Production Bundle
# ============================================================================
echo -e "${YELLOW}[4/9] Building production bundle for demo...${NC}"

# Copy demo env to .env for build
cp .env.demo .env

# Build the application
npm run build -- --mode demo

# Check if build was successful
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}Error: Build failed. dist/ directory not found.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build completed successfully${NC}"
echo ""

# ============================================================================
# Step 5: Validate Build Output
# ============================================================================
echo -e "${YELLOW}[5/9] Validating build output...${NC}"

# Check critical files exist
if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo -e "${RED}Error: dist/index.html not created during build.${NC}"
    exit 1
fi

if [ ! -f "$BUILD_DIR/mock-api.js" ]; then
    echo -e "${YELLOW}Warning: dist/mock-api.js not found. Copying manually...${NC}"
    if [ -f "public/mock-api.js" ]; then
        cp public/mock-api.js "$BUILD_DIR/mock-api.js"
        echo -e "${GREEN}✓ Manually copied mock-api.js to dist/${NC}"
    else
        echo -e "${RED}Error: public/mock-api.js source file not found.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ mock-api.js exists in dist/${NC}"
fi

# Verify DOCTYPE in dist/index.html
if grep -q "<!DOCTYPE html>" "$BUILD_DIR/index.html"; then
    echo -e "${GREEN}✓ dist/index.html has proper DOCTYPE${NC}"
else
    echo -e "${RED}Error: dist/index.html missing DOCTYPE.${NC}"
    exit 1
fi

# Verify mock-api.js reference in dist/index.html
if grep -q "mock-api.js" "$BUILD_DIR/index.html"; then
    echo -e "${GREEN}✓ dist/index.html references mock-api.js${NC}"
else
    echo -e "${RED}Error: dist/index.html does not reference mock-api.js.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build validation passed${NC}"
echo ""

# ============================================================================
# Step 6: Copy demo data to build directory
# ============================================================================
echo -e "${YELLOW}[6/9] Copying demo data to build directory...${NC}"

cp demo-data.json "$BUILD_DIR/demo-data.json"

echo -e "${GREEN}✓ Demo data copied${NC}"
echo ""

# ============================================================================
# Step 7: Create S3 Bucket (if it doesn't exist)
# ============================================================================
echo -e "${YELLOW}[7/9] Checking S3 bucket...${NC}"

if aws s3 ls "s3://$S3_BUCKET" 2>&1 | grep -q 'NoSuchBucket'; then
    echo -e "${YELLOW}Creating S3 bucket: $S3_BUCKET${NC}"
    
    if [ "$AWS_REGION" == "us-east-1" ]; then
        aws s3 mb "s3://$S3_BUCKET" --region $AWS_REGION
    else
        aws s3 mb "s3://$S3_BUCKET" --region $AWS_REGION --create-bucket-configuration LocationConstraint=$AWS_REGION
    fi
    
    # Enable static website hosting
    aws s3 website "s3://$S3_BUCKET" \
        --index-document index.html \
        --error-document index.html
    
    # Set bucket policy for public read access
    cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$S3_BUCKET/*"
    }
  ]
}
EOF
    
    aws s3api put-bucket-policy --bucket "$S3_BUCKET" --policy file:///tmp/bucket-policy.json
    
    echo -e "${GREEN}✓ S3 bucket created and configured${NC}"
else
    echo -e "${GREEN}✓ S3 bucket exists${NC}"
fi

# Always configure S3 website hosting (ensures error document is set for SPA routing)
echo -e "${YELLOW}Configuring S3 static website hosting...${NC}"
aws s3 website "s3://$S3_BUCKET" \
    --index-document index.html \
    --error-document index.html
echo -e "${GREEN}✓ S3 website hosting configured for SPA routing${NC}"
echo ""

# ============================================================================
# Step 8: Deploy to S3
# ============================================================================
echo -e "${YELLOW}[8/9] Deploying to S3...${NC}"

# Sync build directory to S3 with cache control for static assets
aws s3 sync "$BUILD_DIR/" "s3://$S3_BUCKET/" \
    --delete \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "*.html" \
    --exclude "*.json"

# Upload HTML and JSON files with no-cache headers
aws s3 sync "$BUILD_DIR/" "s3://$S3_BUCKET/" \
    --exclude "*" \
    --include "*.html" \
    --include "*.json" \
    --cache-control "no-cache,no-store,must-revalidate"

echo -e "${GREEN}✓ Files uploaded to S3${NC}"
echo ""

# ============================================================================
# Step 9: Invalidate CloudFront Cache (if configured)
# ============================================================================
echo -e "${YELLOW}[9/9] CloudFront cache invalidation...${NC}"

if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "${YELLOW}Invalidating CloudFront cache...${NC}"
    
    INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)
    
    echo -e "${GREEN}✓ Invalidation created: $INVALIDATION_OUTPUT${NC}"
    
    if [ "$QUIET_MODE" = false ]; then
        echo -e "${YELLOW}⏳ Waiting for cache invalidation to complete...${NC}"
        aws cloudfront wait invalidation-completed \
            --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
            --id "$INVALIDATION_OUTPUT"
        echo -e "${GREEN}✓ CloudFront cache fully invalidated${NC}"
    else
        echo -e "${YELLOW}⏳ Cache invalidation in progress (background)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ CloudFront distribution ID not set. Skipping cache invalidation.${NC}"
    echo -e "${YELLOW}  To enable, set CLOUDFRONT_DISTRIBUTION_ID in this script.${NC}"
fi
echo ""

# ============================================================================
# Deployment Summary
# ============================================================================
DEMO_URL="http://$S3_BUCKET.s3-website-$AWS_REGION.amazonaws.com"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Deployment Successful!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Demo Environment:${NC}"
echo -e "  S3 Bucket:       s3://$S3_BUCKET"
echo -e "  S3 Website URL:  $DEMO_URL"
echo -e "  Region:          $AWS_REGION"
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "  CloudFront URL:  https://dxft3rdv46wz7.cloudfront.net"
    echo -e "  Distribution ID: $CLOUDFRONT_DISTRIBUTION_ID"
fi
echo ""

# Output for GitHub Actions
if [ "$CI" = "true" ]; then
  echo "demo_url=$DEMO_URL" >> $GITHUB_OUTPUT
  echo "deployment_status=success" >> $GITHUB_OUTPUT
fi

echo -e "${BLUE}Demo Features:${NC}"
echo -e "  • Auto-login enabled (no signup required)"
echo -e "  • Read-only mode (all write operations disabled)"
echo -e "  • Sample data with 5 mock customers"
echo -e "  • Data resets every 24 hours"
echo -e "  • Demo banner with CTAs visible"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Test the demo deployment at the URL above"
echo -e "  2. Verify demo banner is visible"
echo -e "  3. Test read-only mode (try creating/editing)"
echo -e "  4. Share demo link with sales team"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo -e "  - phase3a-portal/DEMO_ENVIRONMENT.md"
echo -e "  - README.md (demo section)"
echo ""
