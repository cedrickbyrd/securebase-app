#!/bin/bash
# Deploy Unified Authentication Updates
# Sprint Day 2 - Issue 2: Unify Authentication Architecture

set -e  # Exit on error

echo "🚀 SecureBase Unified Authentication Deployment Script"
echo "====================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
        exit 1
    fi
    
    if ! command -v netlify &> /dev/null; then
        echo -e "${YELLOW}⚠️  Netlify CLI not found. Frontend deployment will be skipped.${NC}"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
    echo ""
}

# Deploy Lambda function updates
deploy_lambda() {
    echo "📦 Deploying Session Management Lambda..."
    
    FUNCTION_NAME="securebase-dev-session-management"
    ZIP_FILE="phase2-backend/deploy/session-management.zip"
    
    # Check if function exists
    if aws lambda get-function --function-name $FUNCTION_NAME --region us-east-1 &> /dev/null; then
        echo "Updating function code..."
        aws lambda update-function-code \
            --function-name $FUNCTION_NAME \
            --zip-file fileb://$ZIP_FILE \
            --region us-east-1
        
        # Wait for update to complete
        echo "Waiting for function update to complete..."
        aws lambda wait function-updated \
            --function-name $FUNCTION_NAME \
            --region us-east-1
        
        # Generate CSRF secret
        CSRF_SECRET=$(openssl rand -base64 32)
        
        # Update environment variables
        echo "Updating environment variables..."
        aws lambda update-function-configuration \
            --function-name $FUNCTION_NAME \
            --environment Variables="{
                \"COOKIE_DOMAIN\":\".tximhotep.com\",
                \"CSRF_SECRET\":\"$CSRF_SECRET\"
            }" \
            --region us-east-1 \
            --no-cli-pager
        
        echo -e "${GREEN}✅ Lambda function updated successfully${NC}"
    else
        echo -e "${RED}❌ Lambda function $FUNCTION_NAME not found${NC}"
        echo "Please ensure the function exists or deploy via Terraform first"
        return 1
    fi
    echo ""
}

# Deploy frontend applications
deploy_frontend() {
    if ! command -v netlify &> /dev/null; then
        echo -e "${YELLOW}⚠️  Skipping frontend deployment (Netlify CLI not found)${NC}"
        return 0
    fi
    
    echo "🎨 Deploying Frontend Applications..."
    
    # Marketing Site
    echo "Building marketing site..."
    cd /Users/cedrickbyrd/projects/securebase-terraform/securebase-app
    
    # Create production env file
    cat > .env.production << EOF
VITE_USE_UNIFIED_AUTH=true
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com
VITE_API_BASE_URL=https://api.securebase.tximhotep.com
VITE_DEMO_MODE=false
EOF
    
    npm run build
    
    echo "Deploying marketing site to Netlify..."
    netlify deploy --prod --dir=dist
    
    # Portal
    echo "Building portal..."
    cd phase3a-portal
    
    # Create production env file
    cat > .env.production << EOF
VITE_USE_UNIFIED_AUTH=true
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com
VITE_DEMO_MODE=false
EOF
    
    npm run build
    
    echo "Deploying portal to Netlify..."
    netlify deploy --prod --dir=dist --site=demo-securebase
    
    cd ..
    echo -e "${GREEN}✅ Frontend applications deployed${NC}"
    echo ""
}

# Test deployment
test_deployment() {
    echo "🧪 Testing Deployment..."
    
    API_URL="https://api.securebase.tximhotep.com"
    
    # Test health check
    echo -n "Testing API health check... "
    if curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" | grep -q "200"; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ FAILED${NC}"
    fi
    
    # Test CORS headers
    echo -n "Testing CORS with credentials... "
    CORS_TEST=$(curl -s -I -X OPTIONS "$API_URL/auth/login" \
        -H "Origin: https://securebase.tximhotep.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type")
    
    if echo "$CORS_TEST" | grep -q "Access-Control-Allow-Credentials: true"; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${YELLOW}⚠️  Credentials header not found${NC}"
    fi
    
    echo ""
}

# Main deployment flow
main() {
    check_prerequisites
    
    echo "This script will deploy:"
    echo "1. Updated Session Management Lambda with cookie support"
    echo "2. Frontend applications with unified auth enabled"
    echo ""
    read -p "Continue with deployment? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
    
    echo ""
    
    # Deploy components
    if deploy_lambda; then
        echo -e "${GREEN}✅ Lambda deployment successful${NC}"
    else
        echo -e "${RED}❌ Lambda deployment failed${NC}"
        exit 1
    fi
    
    deploy_frontend
    test_deployment
    
    echo ""
    echo "🎉 Deployment Complete!"
    echo ""
    echo "Next steps:"
    echo "1. Test login at https://securebase.tximhotep.com"
    echo "2. Verify cookies are set (check DevTools > Application > Cookies)"
    echo "3. Navigate to https://demo.securebase.tximhotep.com"
    echo "4. Confirm session is maintained across domains"
    echo ""
    echo "To rollback:"
    echo "- Set VITE_USE_UNIFIED_AUTH=false and redeploy frontends"
    echo ""
}

# Run main function
main