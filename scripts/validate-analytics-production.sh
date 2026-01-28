#!/bin/bash
#
# Production Analytics API Validation Script
# Validates Analytics API endpoints post-deployment
#
# Usage:
#   ./scripts/validate-analytics-production.sh production
#   ./scripts/validate-analytics-production.sh staging
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default to production if no environment specified
ENVIRONMENT="${1:-production}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|dev)$ ]]; then
    echo "Error: Invalid environment '$ENVIRONMENT'. Must be: production, staging, or dev"
    exit 1
fi

echo "============================================"
echo "Analytics API Production Validation"
echo "============================================"
echo "Environment: $ENVIRONMENT"
echo "Project Root: $PROJECT_ROOT"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not found"
    exit 1
fi

# Check if requests library is installed
if ! python3 -c "import requests" 2>/dev/null; then
    echo "Installing required Python dependencies..."
    pip3 install requests || {
        echo "Error: Failed to install requests library"
        exit 1
    }
fi

# Set output file
OUTPUT_FILE="$PROJECT_ROOT/validation-results-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).json"

# Run validation
echo "Running validation against $ENVIRONMENT environment..."
echo ""

cd "$PROJECT_ROOT"

if python3 tests/production/validate_analytics_api.py \
    --env "$ENVIRONMENT" \
    --verbose \
    --json-output "$OUTPUT_FILE"; then
    
    echo ""
    echo "============================================"
    echo "✅ VALIDATION PASSED"
    echo "============================================"
    echo "Results saved to: $OUTPUT_FILE"
    exit 0
else
    EXIT_CODE=$?
    echo ""
    echo "============================================"
    echo "❌ VALIDATION FAILED"
    echo "============================================"
    echo "Results saved to: $OUTPUT_FILE"
    echo "Exit code: $EXIT_CODE"
    exit $EXIT_CODE
fi
