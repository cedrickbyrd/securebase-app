#!/bin/bash
#
# Run all SecureBase tests
# Phase 4: Testing & Quality Assurance
#

set -e

echo "========================================="
echo "SecureBase Test Suite Runner"
echo "Phase 4: Testing & Quality Assurance"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0
PASSED=0
SKIPPED=0

# Function to run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    if eval "$test_command"; then
        echo -e "${GREEN}✓ $test_name PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ $test_name FAILED${NC}"
        ((FAILED++))
    fi
    echo ""
}

# Frontend Unit Tests
echo "========================================="
echo "1. Frontend Unit Tests (React)"
echo "========================================="
if [ -d "phase3a-portal" ]; then
    cd phase3a-portal
    if [ -f "package.json" ]; then
        run_test "Frontend Tests" "npm test -- --run 2>&1 | tail -20"
    else
        echo -e "${YELLOW}⊘ Skipping frontend tests (package.json not found)${NC}"
        ((SKIPPED++))
    fi
    cd ..
else
    echo -e "${YELLOW}⊘ Skipping frontend tests (phase3a-portal not found)${NC}"
    ((SKIPPED++))
fi

# Backend Unit Tests
echo "========================================="
echo "2. Backend Unit Tests (Python)"
echo "========================================="
if [ -d "phase2-backend/functions" ]; then
    cd phase2-backend/functions
    if command -v pytest &> /dev/null; then
        run_test "Backend Tests" "python -m pytest test_*.py -v 2>&1 | tail -30"
    elif command -v python3 &> /dev/null; then
        run_test "Backend Tests" "python3 -m unittest discover -s . -p 'test_*.py' 2>&1 | tail -30"
    else
        echo -e "${YELLOW}⊘ Skipping backend tests (Python not found)${NC}"
        ((SKIPPED++))
    fi
    cd ../..
else
    echo -e "${YELLOW}⊘ Skipping backend tests (phase2-backend not found)${NC}"
    ((SKIPPED++))
fi

# Integration Tests
echo "========================================="
echo "3. Integration Tests"
echo "========================================="
if [ -d "tests/integration" ]; then
    cd tests/integration
    if command -v python3 &> /dev/null; then
        run_test "Integration Tests" "python3 -m unittest discover -v 2>&1 | tail -20"
    else
        echo -e "${YELLOW}⊘ Skipping integration tests (Python not found)${NC}"
        ((SKIPPED++))
    fi
    cd ../..
else
    echo -e "${YELLOW}⊘ Skipping integration tests (tests/integration not found)${NC}"
    ((SKIPPED++))
fi

# Performance Tests
echo "========================================="
echo "4. Performance Tests"
echo "========================================="
if [ -d "tests/performance" ]; then
    cd tests/performance
    if command -v python3 &> /dev/null; then
        run_test "Performance Tests" "python3 -m unittest test_load.py 2>&1 | tail -20"
    else
        echo -e "${YELLOW}⊘ Skipping performance tests (Python not found)${NC}"
        ((SKIPPED++))
    fi
    cd ../..
else
    echo -e "${YELLOW}⊘ Skipping performance tests (tests/performance not found)${NC}"
    ((SKIPPED++))
fi

# Security Tests
echo "========================================="
echo "5. Security Tests"
echo "========================================="
if [ -d "tests/security" ]; then
    cd tests/security
    if command -v python3 &> /dev/null; then
        run_test "Security Tests" "python3 -m unittest test_security.py 2>&1 | tail -20"
    else
        echo -e "${YELLOW}⊘ Skipping security tests (Python not found)${NC}"
        ((SKIPPED++))
    fi
    cd ../..
else
    echo -e "${YELLOW}⊘ Skipping security tests (tests/security not found)${NC}"
    ((SKIPPED++))
fi

# Accessibility Tests
echo "========================================="
echo "6. Accessibility Tests"
echo "========================================="
if [ -d "tests/accessibility" ]; then
    cd tests/accessibility
    if command -v python3 &> /dev/null; then
        run_test "Accessibility Tests" "python3 -m unittest test_wcag.py 2>&1 | tail -20"
    else
        echo -e "${YELLOW}⊘ Skipping accessibility tests (Python not found)${NC}"
        ((SKIPPED++))
    fi
    cd ../..
else
    echo -e "${YELLOW}⊘ Skipping accessibility tests (tests/accessibility not found)${NC}"
    ((SKIPPED++))
fi

# Disaster Recovery Tests
echo "========================================="
echo "7. Disaster Recovery Tests"
echo "========================================="
if [ -d "tests/disaster-recovery" ]; then
    cd tests/disaster-recovery
    if command -v python3 &> /dev/null; then
        run_test "DR Tests" "python3 -m unittest test_backup_restore.py 2>&1 | tail -20"
    else
        echo -e "${YELLOW}⊘ Skipping DR tests (Python not found)${NC}"
        ((SKIPPED++))
    fi
    cd ../..
else
    echo -e "${YELLOW}⊘ Skipping DR tests (tests/disaster-recovery not found)${NC}"
    ((SKIPPED++))
fi

# Summary
echo "========================================="
echo "Test Suite Summary"
echo "========================================="
echo -e "${GREEN}Passed:  $PASSED${NC}"
echo -e "${RED}Failed:  $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
