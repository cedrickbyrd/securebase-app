#!/bin/bash

echo "🚀 Deploying Realistic Demo Environment"
echo "========================================"

# Step 1: Build portal with updated components
echo ""
echo "Step 1: Building portal..."
cd phase3a-portal

# Make sure we have the latest
npm install

# Build
npm run build

if [ $? -eq 0 ]; then
  echo "✅ Build successful!"
else
  echo "❌ Build failed"
  exit 1
fi

# Step 2: Deploy instructions
echo ""
echo "========================================"
echo "✅ Build Complete!"
echo "========================================"
echo ""
echo "📦 Built files are in: dist/"
echo ""
echo "🚀 Next steps:"
echo ""
echo "1. Deploy to Netlify:"
echo "   - Drag the 'dist' folder to Netlify dashboard"
echo "   - Or run: netlify deploy --prod --dir=dist"
echo ""
echo "2. Test the demo:"
echo "   - URL: https://demo.securebase.tximhotep.com"
echo "   - Email: demo@securebase.tximhotep.com"
echo "   - Password: SecureBaseDemo2026!"
echo ""
echo "3. Demo flow:"
echo "   - Login → Dashboard → Download Report → Logout"
echo ""
echo "========================================"
