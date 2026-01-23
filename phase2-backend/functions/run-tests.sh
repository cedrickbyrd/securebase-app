#!/bin/bash
#
# Run Phase 4 Analytics & Reporting Tests
# Executes unit tests, integration tests, and generates coverage report
#
# Usage:
#   ./run-tests.sh           # Run all tests
#   ./run-tests.sh unit      # Run only unit tests
#   ./run-tests.sh integration  # Run only integration tests
#   ./run-tests.sh coverage  # Generate detailed coverage report

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Change to functions directory
cd "$(dirname "$0")"

print_status "Phase 4 Analytics & Reporting - Test Suite"
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed"
    exit 1
fi

print_success "Python 3 found: $(python3 --version)"

# Check if pytest is installed
if ! python3 -c "import pytest" &> /dev/null; then
    print_warning "pytest not found. Installing test dependencies..."
    pip3 install -q -r test-requirements.txt || {
        print_error "Failed to install test dependencies"
        exit 1
    }
    print_success "Test dependencies installed"
fi

# Determine which tests to run
TEST_TYPE="${1:-all}"

case "$TEST_TYPE" in
    unit)
        print_status "Running unit tests only..."
        python3 -m pytest test_report_engine.py -v \
            --cov=report_engine \
            --cov-report=term-missing \
            --cov-report=html:htmlcov \
            -x
        ;;
    
    integration)
        print_status "Running integration tests only..."
        python3 -m pytest test_integration.py -v \
            --cov=report_engine \
            --cov-report=term-missing \
            -x
        ;;
    
    coverage)
        print_status "Running all tests with detailed coverage..."
        python3 -m pytest test_report_engine.py test_integration.py -v \
            --cov=report_engine \
            --cov-report=term-missing \
            --cov-report=html:htmlcov \
            --cov-report=json:coverage.json \
            --cov-fail-under=90
        
        print_success "Coverage report generated:"
        echo "  - Terminal: shown above"
        echo "  - HTML: htmlcov/index.html"
        echo "  - JSON: coverage.json"
        ;;
    
    all|*)
        print_status "Running all tests..."
        python3 -m pytest test_report_engine.py test_integration.py -v \
            --cov=report_engine \
            --cov-report=term-missing \
            --cov-report=html:htmlcov \
            --cov-report=json:coverage.json \
            -x
        
        RESULT=$?
        
        if [ $RESULT -eq 0 ]; then
            print_success "All tests passed!"
            echo ""
            print_status "Coverage report generated in htmlcov/index.html"
        else
            print_error "Some tests failed!"
            exit $RESULT
        fi
        
        # Check coverage threshold (only if coverage.json was generated)
        if [ -f "coverage.json" ]; then
            COVERAGE=$(python3 -c "import json; print(json.load(open('coverage.json'))['totals']['percent_covered'])")
            COVERAGE_INT=${COVERAGE%.*}
            
            if [ "$COVERAGE_INT" -ge 90 ]; then
                print_success "Coverage: ${COVERAGE}% (>= 90% requirement met)"
            else
                print_warning "Coverage: ${COVERAGE}% (< 90% requirement)"
            fi
        fi
        ;;
esac

echo ""
print_status "Test suite completed"

exit 0
