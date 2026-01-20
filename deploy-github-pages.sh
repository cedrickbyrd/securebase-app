#!/bin/bash
# 🚀 Deploy SecureBase Signup to GitHub Pages

echo "🌐 Building SecureBase Signup for GitHub Pages"
echo "=============================================="

cd phase3a-portal

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build for production
echo "🏗️  Building production bundle..."
npm run build

# Copy to docs folder (GitHub Pages alternative)
echo "📋 Copying to docs folder..."
mkdir -p ../docs
cp -r dist/* ../docs/

echo ""
echo "🎉 BUILD COMPLETE!"
echo "=================="
echo ""
echo "📋 Next Steps:"
echo "1. Commit and push all changes"
echo "2. Go to: https://github.com/cedrickbyrd/securebase-app/settings/pages"
echo "3. Set Source to 'Deploy from a branch'"
echo "4. Choose 'main' branch and '/docs' folder"
echo "5. Save settings"
echo ""
echo "🌐 Your signup URL will be:"
echo "   https://cedrickbyrd.github.io/securebase-app/"
echo ""
echo "💰 Ready to start earning revenue! 🚀"