#!/bin/bash

# SecureBase Analytics Installation Script
# This script helps you quickly integrate analytics into your existing project

set -e

echo "🚀 SecureBase Analytics Installation"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: No package.json found. Please run this from your project root."
    exit 1
fi

echo "📦 Installing analytics files..."

# Create directories if they don't exist
mkdir -p src/utils
mkdir -p src/hooks
mkdir -p src/components/examples

# Copy files
echo "  → Copying utils/analytics.js"
cp securebase-analytics/src/utils/analytics.js src/utils/

echo "  → Copying hooks/useAnalytics.js"
cp securebase-analytics/src/hooks/useAnalytics.js src/hooks/

echo "  → Copying example components"
cp securebase-analytics/src/components/*.jsx src/components/examples/

echo ""
echo "✅ Files installed successfully!"
echo ""

# Check GA4 configuration
echo "🔍 Checking GA4 configuration..."
if grep -q "gtag" public/index.html 2>/dev/null || grep -q "gtag" src/app/layout.tsx 2>/dev/null; then
    echo "  ✅ GA4 script found"
else
    echo "  ⚠️  GA4 script not detected"
    echo ""
    echo "  Add this to your index.html or _document.js:"
    echo ""
    echo "  <script async src=\"https://www.googletagmanager.com/gtag/js?id=GA4-XXXXXXX\"></script>"
    echo "  <script>"
    echo "    window.dataLayer = window.dataLayer || [];"
    echo "    function gtag(){dataLayer.push(arguments);}"
    echo "    gtag('js', new Date());"
    echo "    window.GA4_MEASUREMENT_ID = 'GA4-XXXXXXX';"
    echo "    gtag('config', window.GA4_MEASUREMENT_ID);"
    echo "  </script>"
    echo ""
fi

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Add GA4 script to your HTML (if not already done)"
echo "2. Update your AuthProvider with user identification:"
echo "   import { identifyUser } from './utils/analytics';"
echo ""
echo "3. Start tracking events:"
echo "   import { ComplianceEvents } from './utils/analytics';"
echo "   ComplianceEvents.policyScanInitiated('SOC2', 'full');"
echo ""
echo "4. Follow the setup guide in:"
echo "   securebase-analytics/README.md"
echo ""
echo "5. Configure GA4 dashboards using:"
echo "   securebase-analytics/config/GA4_DASHBOARD_CONFIG.md"
echo ""
echo "🎉 Installation complete! Happy tracking!"
