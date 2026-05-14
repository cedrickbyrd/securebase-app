#!/bin/bash
# Update existing auth Lambda functions with cookie support

set -e

echo "🔧 Updating Lambda Functions for Unified Authentication"
echo "======================================================"
echo ""

# Generate CSRF secret
CSRF_SECRET=$(openssl rand -base64 32)
echo "Generated CSRF Secret: ${CSRF_SECRET:0:10}..."

# Update auth-v2 function
echo ""
echo "Updating securebase-auth-v2..."
aws lambda update-function-configuration \
    --function-name securebase-auth-v2 \
    --environment "Variables={JWT_SECRET=securebase-jwt-secret-1aa6f154bbb064ff4fb6e910b0645a38,USERS_TABLE=securebase-users,CORS_ORIGIN=https://securebase.tximhotep.com,COOKIE_DOMAIN=.tximhotep.com,CSRF_SECRET=$CSRF_SECRET,SESSION_DURATION=86400,ENABLE_COOKIES=true}" \
    --region us-east-1 \
    --no-cli-pager

# Update validate-session function
echo ""
echo "Updating securebase-validate-session..."
aws lambda update-function-configuration \
    --function-name securebase-validate-session \
    --environment "Variables={COOKIE_DOMAIN=.tximhotep.com,CSRF_SECRET=$CSRF_SECRET,ENABLE_COOKIES=true}" \
    --region us-east-1 \
    --no-cli-pager

echo ""
echo "✅ Lambda functions updated successfully!"
echo ""
echo "Environment variables set:"
echo "- COOKIE_DOMAIN: .tximhotep.com"
echo "- SESSION_DURATION: 86400 (24 hours)"
echo "- ENABLE_COOKIES: true"
echo "- CSRF protection enabled"
echo ""