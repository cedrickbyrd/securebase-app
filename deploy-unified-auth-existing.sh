#!/bin/bash
# Deploy Unified Authentication Updates to Existing Infrastructure
# Sprint Day 2 - Issue 2: Unify Authentication Architecture

set -e  # Exit on error

echo "🚀 SecureBase Unified Authentication Deployment (Existing Infrastructure)"
echo "========================================================================"
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
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
    echo ""
}

# Package auth functions with unified session support
package_auth_functions() {
    echo "📦 Packaging authentication functions..."
    
    cd /Users/cedrickbyrd/projects/securebase-terraform/securebase-app/phase2-backend/functions
    
    # Package auth_v2 with session management enhancements
    if [ -f "auth_v2.py" ]; then
        cp session_management_unified.py auth_v2_unified.py
        zip -r auth-v2-enhanced.zip auth_v2.py auth_v2_unified.py
        echo -e "${GREEN}✅ auth_v2 package created${NC}"
    fi
    
    # Package validate_session if it exists
    if [ -f "validate_session.py" ]; then
        zip -r validate-session-enhanced.zip validate_session.py session_management_unified.py
        echo -e "${GREEN}✅ validate_session package created${NC}"
    fi
    
    cd -
    echo ""
}

# Update Lambda environment variables for cookie support
update_lambda_config() {
    echo "🔧 Updating Lambda configurations..."
    
    CSRF_SECRET=$(openssl rand -base64 32)
    
    # Update auth-v2 function
    echo "Updating securebase-auth-v2..."
    aws lambda update-function-configuration \
        --function-name securebase-auth-v2 \
        --environment Variables="{
            \"JWT_SECRET\":\"securebase-jwt-secret-1aa6f154bbb064ff4fb6e910b0645a38\",
            \"USERS_TABLE\":\"securebase-users\",
            \"CORS_ORIGIN\":\"https://securebase.tximhotep.com,https://www.securebase.tximhotep.com,https://demo.securebase.tximhotep.com\",
            \"COOKIE_DOMAIN\":\".tximhotep.com\",
            \"CSRF_SECRET\":\"$CSRF_SECRET\",
            \"SESSION_DURATION\":\"86400\"
        }" \
        --region us-east-1 \
        --no-cli-pager
    
    # Update validate-session function
    echo "Updating securebase-validate-session..."
    aws lambda update-function-configuration \
        --function-name securebase-validate-session \
        --environment Variables="{
            \"COOKIE_DOMAIN\":\".tximhotep.com\",
            \"CSRF_SECRET\":\"$CSRF_SECRET\"
        }" \
        --region us-east-1 \
        --no-cli-pager
    
    echo -e "${GREEN}✅ Lambda configurations updated${NC}"
    echo ""
}

# Update API Gateway CORS manually via AWS CLI
update_api_gateway_cors() {
    echo "🌐 Updating API Gateway CORS settings..."
    
    # Find the API Gateway
    API_ID=$(aws apigateway get-rest-apis --region us-east-1 \
        --query "items[?contains(name, 'securebase')].id" \
        --output text | head -1)
    
    if [ -z "$API_ID" ]; then
        echo -e "${YELLOW}⚠️  Could not find API Gateway automatically${NC}"
        echo "Please update CORS settings manually in AWS Console:"
        echo "1. Enable 'Access-Control-Allow-Credentials'"
        echo "2. Add allowed origins: securebase.tximhotep.com, demo.securebase.tximhotep.com"
        echo "3. Add allowed headers: Cookie, X-CSRF-Token"
        echo "4. Expose headers: Set-Cookie, X-CSRF-Token"
    else
        echo "Found API Gateway: $API_ID"
        echo "Note: CORS updates via CLI are complex. Please verify in AWS Console."
    fi
    
    echo ""
}

# Deploy frontend applications
deploy_frontend() {
    echo "🎨 Preparing Frontend Deployment Instructions..."
    
    cat > frontend-deployment.md << 'EOF'
# Frontend Deployment Instructions

## Marketing Site (securebase.tximhotep.com)

1. Update environment variables:
```bash
cd /Users/cedrickbyrd/projects/securebase-terraform/securebase-app
echo "VITE_USE_UNIFIED_AUTH=true" >> .env.production
echo "VITE_API_ENDPOINT=https://api.securebase.tximhotep.com" >> .env.production
```

2. Build the application:
```bash
npm run build
```

3. Deploy to Netlify:
```bash
netlify deploy --prod --dir=dist
```

## Portal (demo.securebase.tximhotep.com)

1. Update environment variables:
```bash
cd phase3a-portal
echo "VITE_USE_UNIFIED_AUTH=true" >> .env.production
echo "VITE_API_ENDPOINT=https://api.securebase.tximhotep.com" >> .env.production
```

2. Build the application:
```bash
npm run build
```

3. Deploy to Netlify:
```bash
netlify deploy --prod --dir=dist --site=demo-securebase
```

## Testing

After deployment, test cross-domain authentication:
1. Login at https://securebase.tximhotep.com
2. Check cookies in DevTools
3. Navigate to https://demo.securebase.tximhotep.com
4. Verify session is maintained
EOF

    echo -e "${GREEN}✅ Frontend deployment instructions saved to frontend-deployment.md${NC}"
    echo ""
}

# Test existing auth endpoints
test_auth_endpoints() {
    echo "🧪 Testing Current Auth Endpoints..."
    
    # Test health check
    echo -n "Testing API health... "
    HEALTH_STATUS=$(curl -s -w "\n%{http_code}" https://api.securebase.tximhotep.com/health 2>/dev/null | tail -1)
    if [ "$HEALTH_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${YELLOW}⚠️  Status: $HEALTH_STATUS${NC}"
    fi
    
    # Test auth endpoint
    echo -n "Testing auth endpoint... "
    AUTH_STATUS=$(curl -s -w "\n%{http_code}" -X POST https://api.securebase.tximhotep.com/auth \
        -H "Content-Type: application/json" \
        -d '{"test":"true"}' 2>/dev/null | tail -1)
    if [ "$AUTH_STATUS" = "200" ] || [ "$AUTH_STATUS" = "400" ] || [ "$AUTH_STATUS" = "401" ]; then
        echo -e "${GREEN}✅ Responding${NC}"
    else
        echo -e "${YELLOW}⚠️  Status: $AUTH_STATUS${NC}"
    fi
    
    echo ""
}

# Main deployment flow
main() {
    check_prerequisites
    
    echo "This script will:"
    echo "1. Package authentication functions with cookie support"
    echo "2. Update Lambda environment variables"
    echo "3. Provide instructions for API Gateway CORS updates"
    echo "4. Generate frontend deployment instructions"
    echo ""
    
    echo "Current Lambda functions:"
    aws lambda list-functions --region us-east-1 \
        --query "Functions[?contains(FunctionName, 'auth') || contains(FunctionName, 'session')].[FunctionName]" \
        --output table
    
    echo ""
    read -p "Continue with deployment? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
    
    echo ""
    
    # Execute deployment steps
    package_auth_functions
    update_lambda_config
    update_api_gateway_cors
    deploy_frontend
    test_auth_endpoints
    
    echo ""
    echo "🎉 Configuration Complete!"
    echo ""
    echo "Next steps:"
    echo "1. Review and update API Gateway CORS settings in AWS Console"
    echo "2. Deploy frontend applications using frontend-deployment.md"
    echo "3. Test cross-domain authentication"
    echo ""
    echo "Important notes:"
    echo "- CSRF secret has been set for both auth functions"
    echo "- Cookie domain is configured as .tximhotep.com"
    echo "- Session duration is 24 hours (86400 seconds)"
    echo ""
}

# Run main function
main