#!/bin/bash

# Phase 3a Portal - Local Frontend Test Runner
# ============================================================================
# This script automates build, run, and basic smoke checks for the portal
# Uses curl for basic endpoint checks and Playwright for browser tests
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
PORTAL_DIR="../../phase3a-portal"
TEST_PORT=5173
BUILD_DIR="dist"
SERVER_PID=""
PLAYWRIGHT_AVAILABLE=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Function to cleanup background processes
cleanup() {
    if [ ! -z "$SERVER_PID" ] && ps -p $SERVER_PID > /dev/null 2>&1; then
        print_status "Stopping dev server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================
print_status "==================================================================="
print_status "Phase 3a Portal - Frontend Test Runner"
print_status "==================================================================="
echo ""

print_status "Step 1: Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js found: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

NPM_VERSION=$(npm --version)
print_success "npm found: v$NPM_VERSION"

# Check if curl is available for smoke tests
if command -v curl &> /dev/null; then
    print_success "curl found (will run HTTP smoke tests)"
    CURL_AVAILABLE=true
else
    print_warning "curl not found (skipping HTTP smoke tests)"
    CURL_AVAILABLE=false
fi

# Check if Playwright is available
if [ -f "$PORTAL_DIR/node_modules/.bin/playwright" ] || command -v playwright &> /dev/null; then
    print_success "Playwright found (will run browser tests)"
    PLAYWRIGHT_AVAILABLE=true
else
    print_warning "Playwright not found (skipping browser tests)"
    print_warning "Install with: npm install -D @playwright/test && npx playwright install"
fi

echo ""

# ============================================================================
# Step 2: Navigate to Portal Directory
# ============================================================================
print_status "Step 2: Navigating to portal directory..."

if [ ! -d "$PORTAL_DIR" ]; then
    print_error "Portal directory not found: $PORTAL_DIR"
    exit 1
fi

cd "$PORTAL_DIR"
print_success "Changed to directory: $(pwd)"
echo ""

# ============================================================================
# Step 3: Install Dependencies
# ============================================================================
print_status "Step 3: Installing dependencies..."

if [ ! -f "package.json" ]; then
    print_error "package.json not found in portal directory"
    exit 1
fi

npm ci --silent
print_success "Dependencies installed"
echo ""

# ============================================================================
# Step 4: Configure Demo Mode
# ============================================================================
print_status "Step 4: Configuring demo mode..."

# Copy demo environment file
if [ -f ".env.demo" ]; then
    cp .env.demo .env
    print_success "Copied .env.demo to .env"
else
    print_warning ".env.demo not found, creating minimal .env"
    cat > .env << EOF
VITE_USE_MOCK_API=true
VITE_DEMO_MODE=true
VITE_SHOW_DEMO_BANNER=true
VITE_ENV=demo
VITE_API_BASE_URL=https://demo-api.securebase.io/v1
EOF
    print_success "Created .env with mock API enabled"
fi

# Verify mock mode is enabled
if grep -q "VITE_USE_MOCK_API=true" .env; then
    print_success "Mock API mode enabled"
else
    print_warning "VITE_USE_MOCK_API not set to true in .env"
fi

echo ""

# ============================================================================
# Step 5: Build Portal
# ============================================================================
print_status "Step 5: Building portal for demo..."

# Clean previous build
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
    print_status "Cleaned previous build"
fi

# Build for demo
if npm run build:demo > /tmp/build.log 2>&1; then
    print_success "Build completed successfully"
else
    print_error "Build failed. Check /tmp/build.log for details"
    tail -20 /tmp/build.log
    exit 1
fi

# Verify build output
if [ ! -d "$BUILD_DIR" ] || [ ! -f "$BUILD_DIR/index.html" ]; then
    print_error "Build output not found in $BUILD_DIR"
    exit 1
fi

print_success "Build output verified in $BUILD_DIR/"
echo ""

# ============================================================================
# Step 6: Run Production Build Tests
# ============================================================================
print_status "Step 6: Testing production build..."

# Check if serve is available
if ! command -v npx &> /dev/null; then
    print_warning "npx not available, skipping production build test"
else
    print_status "Starting static server on port $TEST_PORT..."
    
    # Start server in background
    npx serve -s "$BUILD_DIR" -l $TEST_PORT > /tmp/serve.log 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 3
    
    # Check if server is running
    if ! ps -p $SERVER_PID > /dev/null 2>&1; then
        print_error "Failed to start server"
        cat /tmp/serve.log
        exit 1
    fi
    
    print_success "Server running on http://localhost:$TEST_PORT (PID: $SERVER_PID)"
    
    # Run smoke tests with curl if available
    if [ "$CURL_AVAILABLE" = true ]; then
        echo ""
        print_status "Running HTTP smoke tests..."
        
        # Test 1: Homepage loads
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$TEST_PORT | grep -q "200"; then
            print_success "✓ Homepage loads (HTTP 200)"
        else
            print_error "✗ Homepage failed to load"
        fi
        
        # Test 2: index.html exists
        if curl -s http://localhost:$TEST_PORT/index.html | grep -q "<html"; then
            print_success "✓ index.html contains HTML"
        else
            print_error "✗ index.html not found or invalid"
        fi
        
        # Test 3: Check for React root
        if curl -s http://localhost:$TEST_PORT | grep -q 'id="root"'; then
            print_success "✓ React root element found"
        else
            print_warning "✗ React root element not found"
        fi
        
        # Test 4: Check for Vite build
        if curl -s http://localhost:$TEST_PORT | grep -q "type=\"module\""; then
            print_success "✓ Vite module scripts detected"
        else
            print_warning "✗ Vite scripts not detected"
        fi
    fi
fi

echo ""

# ============================================================================
# Step 7: Run Playwright Tests (if available)
# ============================================================================
if [ "$PLAYWRIGHT_AVAILABLE" = true ]; then
    print_status "Step 7: Running Playwright browser tests..."
    
    # Check if check_demo_login.js exists
    if [ -f "../../tests/frontend/check_demo_login.js" ]; then
        print_status "Running demo login test..."
        
        # Set base URL for Playwright
        export BASE_URL="http://localhost:$TEST_PORT"
        
        if node ../../tests/frontend/check_demo_login.js; then
            print_success "Playwright tests passed"
        else
            print_error "Playwright tests failed"
        fi
    else
        print_warning "check_demo_login.js not found, skipping"
    fi
else
    print_warning "Step 7: Skipping Playwright tests (not installed)"
fi

echo ""

# ============================================================================
# Step 8: Summary
# ============================================================================
print_status "==================================================================="
print_status "Test Summary"
print_status "==================================================================="
echo ""

echo "✅ Prerequisites verified"
echo "✅ Dependencies installed"
echo "✅ Demo mode configured"
echo "✅ Build completed successfully"

if [ "$CURL_AVAILABLE" = true ]; then
    echo "✅ HTTP smoke tests completed"
else
    echo "⚠️  HTTP smoke tests skipped (curl not available)"
fi

if [ "$PLAYWRIGHT_AVAILABLE" = true ]; then
    echo "✅ Playwright browser tests completed"
else
    echo "⚠️  Playwright tests skipped (not installed)"
fi

echo ""
print_success "All tests completed!"
echo ""

# ============================================================================
# Step 9: Manual Testing Instructions
# ============================================================================
print_status "==================================================================="
print_status "Manual Testing"
print_status "==================================================================="
echo ""

if [ ! -z "$SERVER_PID" ] && ps -p $SERVER_PID > /dev/null 2>&1; then
    print_status "Portal is running at: ${GREEN}http://localhost:$TEST_PORT${NC}"
    echo ""
    echo "To test manually:"
    echo "  1. Open http://localhost:$TEST_PORT in your browser"
    echo "  2. Login with demo credentials:"
    echo "     - Username: demo"
    echo "     - Password: demo"
    echo "  3. Verify dashboard, invoices, API keys, and compliance pages"
    echo ""
    echo "Press Ctrl+C to stop the server and exit"
    echo ""
    
    # Keep server running until interrupted
    wait $SERVER_PID
else
    print_status "To run the portal manually:"
    echo ""
    echo "  cd $PORTAL_DIR"
    echo "  npm run dev"
    echo ""
    echo "Then open http://localhost:5173 and login with demo/demo"
fi

echo ""
print_status "For full test instructions, see: tests/frontend/README.md"
echo ""
