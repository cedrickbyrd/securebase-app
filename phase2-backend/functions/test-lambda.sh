#!/bin/bash
# Test Lambda Function Locally
# Requires AWS SAM CLI: pip install aws-sam-cli

set -e

echo "🧪 Testing report_engine Lambda function"
echo "========================================"

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ AWS SAM CLI not found"
    echo "Install it with: pip install aws-sam-cli"
    exit 1
fi

# Navigate to functions directory
cd "$(dirname "$0")"

# Test 1: Get Analytics
echo ""
echo "Test 1: GET /analytics"
echo "----------------------"
sam local invoke -e test-events/get-analytics.json 2>&1 | grep -A 20 "START RequestId"

# Test 2: Export CSV
echo ""
echo "Test 2: POST /analytics (CSV Export)"
echo "------------------------------------"
sam local invoke -e test-events/export-csv.json 2>&1 | grep -A 20 "START RequestId"

# Test 3: List Reports
echo ""
echo "Test 3: GET /analytics/reports"
echo "------------------------------"
sam local invoke -e test-events/list-reports.json 2>&1 | grep -A 20 "START RequestId"

echo ""
echo "✅ Local tests complete"
echo ""
echo "To test individual events:"
echo "  sam local invoke -e test-events/get-analytics.json"
echo "  sam local invoke -e test-events/export-csv.json"
echo "  sam local invoke -e test-events/export-pdf.json"
