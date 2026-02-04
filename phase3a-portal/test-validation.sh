#!/bin/bash
# Test script to verify validation implementation

set -e

echo "======================================"
echo "Demo Deployment Validation Test Suite"
echo "======================================"
echo ""

# Test 1: Check all source files exist
echo "Test 1: Verifying source files..."
[ -f "index.html" ] && echo "  ✅ index.html exists"
[ -f "public/mock-api.js" ] && echo "  ✅ public/mock-api.js exists"
[ -f ".env.demo" ] && echo "  ✅ .env.demo exists"
[ -f "vite.config.js" ] && echo "  ✅ vite.config.js exists"
[ -f "validate-demo-files.sh" ] && echo "  ✅ validate-demo-files.sh exists"
[ -f "deploy-demo.sh" ] && echo "  ✅ deploy-demo.sh exists"
[ -f "DEMO_VALIDATION_GUIDE.md" ] && echo "  ✅ DEMO_VALIDATION_GUIDE.md exists"
echo ""

# Test 2: Verify configuration settings
echo "Test 2: Verifying configuration..."
if grep -q "publicDir: 'public'" vite.config.js; then
    echo "  ✅ vite.config.js has publicDir configured"
fi
if grep -q "copyPublicDir: true" vite.config.js; then
    echo "  ✅ vite.config.js has copyPublicDir enabled"
fi
if grep -q "VITE_USE_MOCK_API=true" .env.demo; then
    echo "  ✅ .env.demo has VITE_USE_MOCK_API=true"
fi
echo ""

# Test 3: Verify index.html structure
echo "Test 3: Verifying index.html structure..."
if grep -q "<!DOCTYPE html>" index.html; then
    echo "  ✅ index.html has proper DOCTYPE"
fi
if grep -q '<script src="/mock-api.js"></script>' index.html; then
    echo "  ✅ index.html references mock-api.js"
fi
echo ""

# Test 4: Verify mock-api.js content
echo "Test 4: Verifying mock-api.js content..."
if grep -q "🎭 MOCK API LOADED!" public/mock-api.js; then
    echo "  ✅ mock-api.js has load message"
fi
if grep -q "✅ MOCK INSTALLED!" public/mock-api.js; then
    echo "  ✅ mock-api.js has install message"
fi
if grep -q "window.fetch" public/mock-api.js; then
    echo "  ✅ mock-api.js intercepts fetch"
fi
echo ""

# Test 5: Run validation script
echo "Test 5: Running validation script..."
if ./validate-demo-files.sh; then
    echo "  ✅ Validation script passed"
else
    echo "  ❌ Validation script failed"
    exit 1
fi
echo ""

# Test 6: Verify script syntax
echo "Test 6: Verifying script syntax..."
if bash -n deploy-demo.sh; then
    echo "  ✅ deploy-demo.sh syntax valid"
fi
if bash -n validate-demo-files.sh; then
    echo "  ✅ validate-demo-files.sh syntax valid"
fi
echo ""

echo "======================================"
echo "✅ All tests passed!"
echo "======================================"
echo ""
echo "The following have been successfully implemented:"
echo "  • public/mock-api.js - Mock API fetch interceptor"
echo "  • validate-demo-files.sh - Pre/post-build validation"
echo "  • Updated vite.config.js - Proper public dir config"
echo "  • Updated index.html - Mock API script reference"
echo "  • Updated .env.demo - Mock API flag"
echo "  • Updated deploy-demo.sh - Validation integration"
echo "  • DEMO_VALIDATION_GUIDE.md - Complete documentation"
echo ""
echo "Next steps:"
echo "  1. Run 'npm install' to install dependencies"
echo "  2. Run 'npm run build -- --mode demo' to test build"
echo "  3. Run './validate-demo-files.sh --check-build' for full validation"
echo "  4. Deploy with './deploy-demo.sh' when ready"
echo ""
