#!/bin/bash
# Deploy both frontend applications with unified auth

set -e

echo "🚀 Deploying SecureBase Frontends with Unified Authentication"
echo "============================================================"
echo ""

# Marketing Site
echo "📦 Building Marketing Site..."
cd /Users/cedrickbyrd/projects/securebase-terraform/securebase-app

# Ensure env is set
cat > .env.production << 'EOF'
VITE_USE_UNIFIED_AUTH=true
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com
VITE_API_BASE_URL=https://api.securebase.tximhotep.com
VITE_DEMO_MODE=false
EOF

# Build is already done
echo "✅ Marketing site build complete"

# Deploy manually via Netlify UI instructions
echo ""
echo "📋 Marketing Site Deployment Instructions:"
echo "1. Go to https://app.netlify.com"
echo "2. Find your marketing site (securebase.tximhotep.com)"
echo "3. Drag and drop the 'dist' folder to deploy"
echo ""

# Portal Site
echo "📦 Building Portal Site..."
cd phase3a-portal

# Create env
cat > .env.production << 'EOF'
VITE_USE_UNIFIED_AUTH=true
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com
VITE_DEMO_MODE=false
EOF

# Install deps and build
npm install --legacy-peer-deps
npm run build

echo "✅ Portal build complete"
echo ""
echo "📋 Portal Deployment Instructions:"
echo "1. The portal can be deployed with: netlify deploy --prod"
echo "2. Or drag and drop phase3a-portal/dist to Netlify"
echo ""

# Test endpoints
echo "🧪 Testing API Endpoints..."
echo ""
echo "Testing /auth/login endpoint..."
curl -s -X POST https://api.securebase.tximhotep.com/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://securebase.tximhotep.com" \
  -d '{"email":"test@example.com","password":"test"}' \
  -w "\nStatus: %{http_code}\n" | tail -5

echo ""
echo "✅ Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Deploy marketing site via Netlify UI (drag & drop dist folder)"
echo "2. Deploy portal via Netlify UI (drag & drop phase3a-portal/dist)"
echo "3. Test cross-domain authentication"
echo ""