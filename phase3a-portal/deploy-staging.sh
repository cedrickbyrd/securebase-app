#!/bin/bash

# ============================================================================
# Phase 3A Customer Portal - Staging Deployment Script
# ============================================================================
# Description: Deploy Phase 3A portal to AWS S3 + CloudFront (Staging)
# Author: SecureBase Team
# Date: January 26, 2026
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
ENVIRONMENT="staging"
S3_BUCKET="securebase-phase3a-staging"
CLOUDFRONT_DISTRIBUTION_ID=""  # Add your CloudFront distribution ID here
AWS_REGION="us-east-1"
BUILD_DIR="dist"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Phase 3A Customer Portal - Staging Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================================
# Step 1: Pre-deployment Checks
# ============================================================================
echo -e "${YELLOW}[1/7] Running pre-deployment checks...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run from phase3a-portal directory.${NC}"
    exit 1
fi

# Check if .env.staging exists
if [ ! -f ".env.staging" ]; then
    echo -e "${RED}Error: .env.staging file not found.${NC}"
    echo -e "${YELLOW}Please create .env.staging with required environment variables.${NC}"
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
echo -e "${YELLOW}[2/7] Installing dependencies...${NC}"

if [ ! -d "node_modules" ]; then
    npm install
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi
echo ""

# ============================================================================
# Step 3: Run Linting
# ============================================================================
echo -e "${YELLOW}[3/7] Running linter...${NC}"

npm run lint || {
    echo -e "${YELLOW}Warning: Linting found issues. Continuing anyway...${NC}"
}
echo ""

# ============================================================================
# Step 4: Build Production Bundle
# ============================================================================
echo -e "${YELLOW}[4/7] Building production bundle for staging...${NC}"

# Copy staging env to .env for build
cp .env.staging .env

# Build the application
npm run build

# Check if build was successful
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}Error: Build failed. dist/ directory not found.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build completed successfully${NC}"
echo ""

# ============================================================================
# Step 5: Create S3 Bucket (if it doesn't exist)
# ============================================================================
echo -e "${YELLOW}[5/7] Checking S3 bucket...${NC}"

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
echo ""

# ============================================================================
# Step 6: Deploy to S3
# ============================================================================
echo -e "${YELLOW}[6/7] Deploying to S3...${NC}"

# Sync build directory to S3
aws s3 sync "$BUILD_DIR/" "s3://$S3_BUCKET/" \
    --delete \
    --cache-control "max-age=31536000" \
    --exclude "*.html" \
    --exclude "*.json"

# Upload HTML files with no-cache headers
aws s3 sync "$BUILD_DIR/" "s3://$S3_BUCKET/" \
    --exclude "*" \
    --include "*.html" \
    --include "*.json" \
    --cache-control "no-cache, no-store, must-revalidate"

echo -e "${GREEN}✓ Files uploaded to S3${NC}"
echo ""

# ============================================================================
# Step 7: Invalidate CloudFront Cache (if configured)
# ============================================================================
echo -e "${YELLOW}[7/7] CloudFront cache invalidation...${NC}"

if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "${YELLOW}Invalidating CloudFront cache...${NC}"
    
    aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths "/*"
    
    echo -e "${GREEN}✓ CloudFront cache invalidated${NC}"
else
    echo -e "${YELLOW}⚠ CloudFront distribution ID not set. Skipping cache invalidation.${NC}"
    echo -e "${YELLOW}  To enable, set CLOUDFRONT_DISTRIBUTION_ID in this script.${NC}"
fi
echo ""

# ============================================================================
# Deployment Summary
# ============================================================================
STAGING_URL="http://$S3_BUCKET.s3-website-$AWS_REGION.amazonaws.com"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Deployment Successful!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Staging Environment:${NC}"
echo -e "  S3 Bucket:       s3://$S3_BUCKET"
echo -e "  S3 Website URL:  $STAGING_URL"
echo -e "  Region:          $AWS_REGION"
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "  CloudFront:      https://staging-portal.securebase.com"
fi
echo ""

# Output for GitHub Actions
if [ "$CI" = "true" ]; then
  echo "::set-output name=staging_url::$STAGING_URL"
  echo "::set-output name=deployment_status::success"
fi

echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Test the staging deployment at the URL above"
echo -e "  2. Run integration tests"
echo -e "  3. Validate all Phase 3A features"
echo -e "  4. Review performance metrics"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo -e "  - PHASE3A_DEPLOYMENT_GUIDE.md"
echo -e "  - PHASE3A_STATUS.md"
echo ""
