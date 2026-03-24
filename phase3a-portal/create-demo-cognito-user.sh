#!/bin/bash

echo "🔐 Creating Demo User in Cognito"
echo "================================="

# First, find your User Pool ID
echo "Finding User Pool..."
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --region us-east-1 \
  --query "UserPools[?contains(Name, 'securebase')].Id" \
  --output text | head -1)

if [ -z "$USER_POOL_ID" ]; then
  echo "❌ No Cognito User Pool found"
  echo "You may need to create one first or specify the pool ID manually"
  exit 1
fi

echo "✅ Found User Pool: $USER_POOL_ID"

# Create demo user
echo ""
echo "Creating demo user..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username demo@securebase.tximhotep.com \
  --user-attributes \
      Name=email,Value=demo@securebase.tximhotep.com \
      Name=email_verified,Value=true \
  --temporary-password "TempDemo2026!" \
  --message-action SUPPRESS \
  --region us-east-1

# Set permanent password
echo "Setting permanent password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username demo@securebase.tximhotep.com \
  --password "Demo2026!" \
  --permanent \
  --region us-east-1

echo ""
echo "=========================================="
echo "✅ Demo User Created!"
echo "=========================================="
echo ""
echo "Demo Credentials:"
echo "  Email: demo@securebase.tximhotep.com"
echo "  Password: Demo2026!"
echo ""
echo "User Pool ID: $USER_POOL_ID"
echo ""
echo "Next: Add these credentials to your login page"
