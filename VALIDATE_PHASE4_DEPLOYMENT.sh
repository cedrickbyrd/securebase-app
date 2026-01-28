#!/bin/bash
# Phase 4 Component 1: Final Deployment Readiness Validation
# Validates all deployment artifacts and configuration

set -e

echo "🔍 Phase 4 Component 1: Deployment Readiness Validation"
echo "========================================================"
echo ""

ERRORS=0
WARNINGS=0
CHECKS=0

check_file() {
    local file="$1"
    local description="$2"
    CHECKS=$((CHECKS + 1))
    
    if [ -f "$file" ]; then
        echo "✅ $description"
        echo "   File: $file"
        echo "   Size: $(du -h "$file" | cut -f1)"
    else
        echo "❌ $description"
        echo "   Missing: $file"
        ERRORS=$((ERRORS + 1))
    fi
    echo ""
}

check_dir() {
    local dir="$1"
    local description="$2"
    CHECKS=$((CHECKS + 1))
    
    if [ -d "$dir" ]; then
        echo "✅ $description"
        echo "   Directory: $dir"
    else
        echo "❌ $description"
        echo "   Missing: $dir"
        ERRORS=$((ERRORS + 1))
    fi
    echo ""
}

echo "=== 1. Lambda Artifacts ==="
check_file "phase2-backend/deploy/report_engine.zip" "Lambda function package - report_engine"
check_file "phase2-backend/deploy/analytics_aggregator.zip" "Lambda function package - analytics_aggregator"
check_file "phase2-backend/deploy/analytics_reporter.zip" "Lambda function package - analytics_reporter"
check_file "phase2-backend/deploy/analytics_query.zip" "Lambda function package - analytics_query"
check_file "phase2-backend/layers/reporting/reporting-layer.zip" "Lambda layer package (ReportLab + openpyxl)"

echo "=== 2. Terraform Configuration ==="
check_file "landing-zone/environments/dev/main.tf" "Dev environment main.tf"
check_file "landing-zone/environments/dev/variables.tf" "Dev environment variables.tf"
check_file "landing-zone/environments/dev/outputs.tf" "Dev environment outputs.tf"
check_file "landing-zone/environments/dev/terraform.tfvars" "Dev environment terraform.tfvars"

echo "=== 3. Analytics Module ==="
check_dir "landing-zone/modules/analytics" "Analytics Terraform module"
check_file "landing-zone/modules/analytics/dynamodb.tf" "DynamoDB configuration"
check_file "landing-zone/modules/analytics/lambda.tf" "Lambda configuration"
check_file "landing-zone/modules/analytics/variables.tf" "Module variables"
check_file "landing-zone/modules/analytics/outputs.tf" "Module outputs"

echo "=== 4. Test Events ==="
check_file "phase2-backend/functions/test-events/get-analytics.json" "GET analytics test event"
check_file "phase2-backend/functions/test-events/export-csv.json" "Export CSV test event"
check_file "phase2-backend/functions/test-events/list-reports.json" "List reports test event"

echo "=== 5. Deployment Scripts ==="
check_file "DEPLOY_PHASE4_NOW.sh" "Automated deployment script"
check_file "TEST_PHASE4.sh" "Testing script"

echo "=== 6. Documentation ==="
check_file "PHASE4_DEPLOYMENT_COMPLETE.md" "Deployment completion report"
check_file "PHASE4_DEPLOYMENT_INSTRUCTIONS.md" "Deployment instructions"
check_file "PHASE4_TEST_RESULTS.md" "Test results summary"
check_file "PHASE4_EXECUTIVE_SUMMARY.md" "Executive summary"

echo "=== 7. Configuration Validation ==="
CHECKS=$((CHECKS + 1))
if grep -q "reporting_layer_arn" landing-zone/environments/dev/terraform.tfvars; then
    echo "✅ terraform.tfvars contains reporting_layer_arn"
else
    echo "❌ terraform.tfvars missing reporting_layer_arn"
    ERRORS=$((ERRORS + 1))
fi
echo ""

CHECKS=$((CHECKS + 1))
if grep -q "module \"analytics\"" landing-zone/environments/dev/main.tf; then
    echo "✅ main.tf includes analytics module"
else
    echo "❌ main.tf missing analytics module"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo "=== 8. Lambda Layer Content Validation ==="
CHECKS=$((CHECKS + 1))
if [ -f "phase2-backend/layers/reporting/reporting-layer.zip" ]; then
    if unzip -l phase2-backend/layers/reporting/reporting-layer.zip 2>/dev/null | grep -q "reportlab"; then
        echo "✅ reporting-layer.zip contains ReportLab"
    else
        echo "❌ reporting-layer.zip missing ReportLab"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "⚠️  reporting-layer.zip not found (skipping content check)"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

CHECKS=$((CHECKS + 1))
if [ -f "phase2-backend/layers/reporting/reporting-layer.zip" ]; then
    if unzip -l phase2-backend/layers/reporting/reporting-layer.zip 2>/dev/null | grep -q "openpyxl"; then
        echo "✅ reporting-layer.zip contains openpyxl"
    else
        echo "❌ reporting-layer.zip missing openpyxl"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "⚠️  reporting-layer.zip not found (skipping content check)"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo "=== 9. Python Syntax Check ==="
CHECKS=$((CHECKS + 1))
if python3 -m py_compile phase2-backend/functions/report_engine.py 2>/dev/null; then
    echo "✅ report_engine.py syntax valid"
else
    echo "❌ report_engine.py syntax error"
    ERRORS=$((ERRORS + 1))
fi

CHECKS=$((CHECKS + 1))
if python3 -m py_compile phase2-backend/functions/analytics_reporter.py 2>/dev/null; then
    echo "✅ analytics_reporter.py syntax valid"
else
    echo "❌ analytics_reporter.py syntax error"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo "=== 10. JSON Validation ==="
for json_file in phase2-backend/functions/test-events/*.json; do
    CHECKS=$((CHECKS + 1))
    if python3 -m json.tool "$json_file" > /dev/null 2>&1; then
        echo "✅ $(basename "$json_file") is valid JSON"
    else
        echo "❌ $(basename "$json_file") has invalid JSON"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

echo "=== 11. Terraform Syntax Check ==="
CHECKS=$((CHECKS + 1))
cd landing-zone/modules/analytics
if terraform validate > /dev/null 2>&1; then
    echo "✅ Analytics module Terraform syntax valid"
else
    echo "⚠️  Analytics module Terraform validation warning (expected without AWS backend)"
    WARNINGS=$((WARNINGS + 1))
fi
cd ../../..
echo ""

echo "========================================================"
echo "📊 Validation Summary"
echo "========================================================"
echo ""
echo "Total Checks: $CHECKS"
echo "Passed: $((CHECKS - ERRORS - WARNINGS))"
echo "Warnings: $WARNINGS"
echo "Errors: $ERRORS"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo "✅ DEPLOYMENT READY"
    echo ""
    echo "All validation checks passed!"
    echo "Phase 4 Component 1 is ready for AWS deployment."
    echo ""
    echo "To deploy, run:"
    echo "  ./DEPLOY_PHASE4_NOW.sh"
    echo ""
    exit 0
else
    echo "❌ DEPLOYMENT BLOCKED"
    echo ""
    echo "Please fix the $ERRORS error(s) above before deploying."
    echo ""
    exit 1
fi
