#!/bin/bash
# 🌐 SecureBase Signup Page Quick Deploy
# Deploys signup page to Vercel in 5 minutes

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🌐 SecureBase Signup Page Deploy"
echo "==============================="
echo ""

cd phase3a-portal

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check environment file exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production not found!"
    echo "Please update .env.production with your Stripe keys and price IDs"
    exit 1
fi

# Build for production
echo "🏗️  Building for production..."
npm run build

# Install Vercel if not available
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

echo ""
echo "🚀 Deploying to Vercel..."
echo "========================"
echo ""

# Deploy to production
vercel --prod

echo ""
echo -e "${GREEN}✅ Signup page deployed!${NC}"
echo ""
echo "📋 Next Steps:"
echo "1. Copy the deployment URL from above"  
echo "2. Test signup flow with your live Stripe keys"
echo "3. Configure Stripe webhook with Lambda URL"
echo "4. Start sending LinkedIn messages!"
echo ""
echo "💰 Ready to start selling!"