#!/bin/bash
# 🚀 Deploy SecureBase Signup to GitHub Pages

set -e  # Exit on any error

echo "🌐 Building SecureBase Signup for GitHub Pages"
echo "=============================================="

# Navigate to portal directory
cd phase3a-portal

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build for production with GitHub Pages base path
echo "🏗️  Building production bundle..."
npm run build

# Navigate back to root
cd ..

# Create/update docs folder
echo "📋 Setting up docs folder for GitHub Pages..."
rm -rf docs
mkdir -p docs
cp -r phase3a-portal/dist/* docs/

# Create .nojekyll file to disable Jekyll processing
touch docs/.nojekyll

# Create CNAME file if you want custom domain (optional)
# echo "signup.securebase.com" > docs/CNAME

echo ""
echo "🎉 BUILD COMPLETE!"
echo "=================="
echo ""
echo "📋 Next Steps:"
echo "1. Run: git add . && git commit -m '🚀 Deploy signup page' && git push"
echo "2. Go to: https://github.com/cedrickbyrd/securebase-app/settings/pages"
echo "3. Set Source to 'Deploy from a branch'"
echo "4. Choose 'main' branch and '/docs' folder"
echo "5. Save settings"
echo ""
echo "🌐 Your signup URL will be:"
echo "   https://cedrickbyrd.github.io/securebase-app/"
echo ""
echo "💰 Ready to start earning revenue! 🚀"