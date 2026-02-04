#!/bin/bash
# Pre-deployment validation for live demo

echo "🔍 Validating demo files..."

ERRORS=0

# Check source files
[ -f "index.html" ] && echo "✅ index.html exists" || { echo "❌ index.html missing"; ERRORS=$((ERRORS+1)); }
[ -f "public/mock-api.js" ] && echo "✅ public/mock-api.js exists" || { echo "❌ public/mock-api.js missing"; ERRORS=$((ERRORS+1)); }
[ -f ".env.demo" ] && echo "✅ .env.demo exists" || { echo "❌ .env.demo missing"; ERRORS=$((ERRORS+1)); }
[ -f "vite.config.js" ] && echo "✅ vite.config.js exists" || { echo "❌ vite.config.js missing"; ERRORS=$((ERRORS+1)); }

# Check vite.config.js has publicDir set
if grep -q "publicDir" vite.config.js; then
  echo "✅ vite.config.js has publicDir configured"
else
  echo "❌ vite.config.js missing publicDir"
  ERRORS=$((ERRORS+1))
fi

# Check index.html has DOCTYPE
if grep -q "<!DOCTYPE html>" index.html; then
  echo "✅ index.html has DOCTYPE"
else
  echo "❌ index.html missing DOCTYPE"
  ERRORS=$((ERRORS+1))
fi

# Check index.html references mock-api.js
if grep -q "mock-api.js" index.html; then
  echo "✅ index.html references mock-api.js"
else
  echo "❌ index.html does NOT reference mock-api.js"
  ERRORS=$((ERRORS+1))
fi

# Build and check dist
if [ "$1" = "--check-build" ]; then
  echo ""
  echo "🔨 Building project..."
  npm run build -- --mode demo > /dev/null 2>&1
  
  [ -f "dist/index.html" ] && echo "✅ dist/index.html created" || { echo "❌ dist/index.html NOT created"; ERRORS=$((ERRORS+1)); }
  [ -f "dist/mock-api.js" ] && echo "✅ dist/mock-api.js created" || { echo "❌ dist/mock-api.js NOT created"; ERRORS=$((ERRORS+1)); }
  
  if [ -f "dist/index.html" ]; then
    grep -q "<!DOCTYPE html>" dist/index.html && echo "✅ dist/index.html has DOCTYPE" || { echo "❌ dist/index.html missing DOCTYPE"; ERRORS=$((ERRORS+1)); }
    grep -q "mock-api.js" dist/index.html && echo "✅ dist/index.html references mock-api.js" || { echo "❌ dist/index.html missing mock-api.js reference"; ERRORS=$((ERRORS+1)); }
  fi
fi

if [ $ERRORS -eq 0 ]; then
  echo ""
  echo "✅ All validation checks passed!"
  exit 0
else
  echo ""
  echo "❌ $ERRORS validation check(s) failed!"
  exit 1
fi
