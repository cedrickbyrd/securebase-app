#!/bin/bash

# SecureBase Frontend Testing Quick Reference
# Run this script to test the Phase 3a Customer Portal

set -e

echo "======================================"
echo "SecureBase Frontend Testing"
echo "======================================"
echo ""

# Navigate to Phase 3a Portal
cd "$(dirname "$0")/phase3a-portal"

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🧪 Running tests..."
npm test -- --run

echo ""
echo "📊 Test summary:"
echo "- Test framework: Vitest 1.6.1"
echo "- Coverage thresholds: 90% (lines, functions, branches, statements)"
echo "- Total tests: 106 across 15 test files"
echo ""

echo "✅ Testing complete!"
echo ""
echo "📖 For more details, see:"
echo "   - FRONTEND_TEST_RESULTS.md"
echo "   - FRONTEND_TESTING_SUMMARY.md"
echo ""
echo "🎯 Additional commands:"
echo "   npm run test:ui       # Interactive test UI"
echo "   npm run test:coverage # Coverage report"
echo "   npm run build         # Production build"
echo "   npm run dev           # Development server"
echo ""
