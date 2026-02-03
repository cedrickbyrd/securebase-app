#!/bin/bash
# Phase 4 Component 2: RBAC Integration Validation
# Validates that all RBAC components are properly integrated

# Don't exit on errors - we want to see all results
set +e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔍 SecureBase RBAC Integration Validation"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    ((WARNINGS++))
}

echo "1. Backend Components"
echo "---------------------"

# Check Lambda functions exist
if [ -f "phase2-backend/functions/user_management.py" ]; then
    check_pass "user_management.py exists"
else
    check_fail "user_management.py not found"
fi

if [ -f "phase2-backend/functions/session_management.py" ]; then
    check_pass "session_management.py exists"
else
    check_fail "session_management.py not found"
fi

if [ -f "phase2-backend/functions/activity_feed.py" ]; then
    check_pass "activity_feed.py exists"
else
    check_fail "activity_feed.py not found"
fi

if [ -f "phase2-backend/functions/rbac_engine.py" ]; then
    check_pass "rbac_engine.py exists"
else
    check_fail "rbac_engine.py not found"
fi

# Check database schema
if [ -f "phase2-backend/database/rbac_schema.sql" ]; then
    check_pass "rbac_schema.sql exists"
    
    # Verify schema has required tables
    if grep -qi "CREATE TABLE.*users[^_]" phase2-backend/database/rbac_schema.sql; then
        check_pass "users table defined in schema"
    else
        check_fail "users table not found in schema"
    fi
    
    if grep -qi "CREATE TABLE.*user_sessions" phase2-backend/database/rbac_schema.sql; then
        check_pass "user_sessions table defined in schema"
    else
        check_fail "user_sessions table not found in schema"
    fi
    
    if grep -qi "CREATE TABLE.*activity_feed" phase2-backend/database/rbac_schema.sql; then
        check_pass "activity_feed table defined in schema"
    else
        check_fail "activity_feed table not found in schema"
    fi
else
    check_fail "rbac_schema.sql not found"
fi

echo ""
echo "2. Infrastructure (Terraform)"
echo "-----------------------------"

# Check RBAC Terraform module
if [ -f "landing-zone/modules/rbac/main.tf" ]; then
    check_pass "RBAC Terraform module exists"
    
    # Check for Lambda resources
    if grep -q "aws_lambda_function.*user_management" landing-zone/modules/rbac/main.tf; then
        check_pass "user_management Lambda defined"
    else
        check_fail "user_management Lambda not defined"
    fi
    
    if grep -q "aws_lambda_function.*session_management" landing-zone/modules/rbac/main.tf; then
        check_pass "session_management Lambda defined"
    else
        check_fail "session_management Lambda not defined"
    fi
    
    # Check for DynamoDB tables
    if grep -q "aws_dynamodb_table.*user_sessions" landing-zone/modules/rbac/main.tf; then
        check_pass "user_sessions DynamoDB table defined"
    else
        check_fail "user_sessions DynamoDB table not defined"
    fi
else
    check_fail "RBAC Terraform module not found"
fi

# Check if RBAC module is instantiated in main.tf
if grep -q 'module "rbac"' landing-zone/main.tf; then
    check_pass "RBAC module instantiated in main.tf"
else
    check_fail "RBAC module not instantiated in main.tf"
fi

# Check API Gateway integration
if [ -f "landing-zone/modules/api-gateway/main.tf" ]; then
    check_pass "API Gateway module exists"
    
    # Check for RBAC routes
    if grep -q "aws_api_gateway_resource.*users" landing-zone/modules/api-gateway/main.tf; then
        check_pass "/users API route defined"
    else
        check_fail "/users API route not defined"
    fi
    
    if grep -q "aws_api_gateway_resource.*auth_login" landing-zone/modules/api-gateway/main.tf; then
        check_pass "/auth/login API route defined"
    else
        check_fail "/auth/login API route not defined"
    fi
    
    if grep -q "aws_api_gateway_resource.*activity" landing-zone/modules/api-gateway/main.tf; then
        check_pass "/activity API route defined"
    else
        check_fail "/activity API route not defined"
    fi
    
    # Check for CORS modules
    if grep -q "module.*cors_users" landing-zone/modules/api-gateway/main.tf; then
        check_pass "CORS configured for /users"
    else
        check_warn "CORS may not be configured for /users"
    fi
else
    check_fail "API Gateway module not found"
fi

# Check API Gateway variables
if [ -f "landing-zone/modules/api-gateway/variables.tf" ]; then
    if grep -q "user_management_lambda" landing-zone/modules/api-gateway/variables.tf; then
        check_pass "user_management Lambda variables defined"
    else
        check_fail "user_management Lambda variables not defined"
    fi
    
    if grep -q "session_management_lambda" landing-zone/modules/api-gateway/variables.tf; then
        check_pass "session_management Lambda variables defined"
    else
        check_fail "session_management Lambda variables not defined"
    fi
else
    check_fail "API Gateway variables file not found"
fi

echo ""
echo "3. Frontend Components"
echo "----------------------"

# Check TeamManagement component
if [ -f "phase3a-portal/src/components/TeamManagement.jsx" ]; then
    check_pass "TeamManagement.jsx exists"
    
    # Check for key features
    if grep -q "getUsers\|createUser\|updateUser" phase3a-portal/src/components/TeamManagement.jsx; then
        check_pass "User management functions present"
    else
        check_warn "User management functions may be incomplete"
    fi
else
    check_fail "TeamManagement.jsx not found"
fi

# Check teamService
if [ -f "phase3a-portal/src/services/teamService.js" ]; then
    check_pass "teamService.js exists"
    
    # Check for API functions
    if grep -q "createUser\|getUsers\|login\|verifyMFA" phase3a-portal/src/services/teamService.js; then
        check_pass "Team service API functions defined"
    else
        check_warn "Team service may be incomplete"
    fi
else
    check_fail "teamService.js not found"
fi

# Check App.jsx integration
if [ -f "phase3a-portal/src/App.jsx" ]; then
    check_pass "App.jsx exists"
    
    # Check TeamManagement import
    if grep -q "import.*TeamManagement" phase3a-portal/src/App.jsx; then
        check_pass "TeamManagement imported in App.jsx"
    else
        check_fail "TeamManagement not imported in App.jsx"
    fi
    
    # Check route definition
    if grep -q 'path="/team"' phase3a-portal/src/App.jsx; then
        check_pass "/team route defined"
    else
        check_fail "/team route not defined"
    fi
    
    # Check Users icon import
    if grep -q "Users.*from.*lucide-react" phase3a-portal/src/App.jsx; then
        check_pass "Users icon imported"
    else
        check_warn "Users icon may not be imported"
    fi
    
    # Check navigation item
    if grep -q "canManageTeam" phase3a-portal/src/App.jsx; then
        check_pass "Team navigation logic implemented"
    else
        check_warn "Team navigation logic may be missing"
    fi
else
    check_fail "App.jsx not found"
fi

echo ""
echo "4. Documentation"
echo "----------------"

# Check documentation files
if [ -f "docs/RBAC_DESIGN.md" ]; then
    check_pass "RBAC_DESIGN.md exists"
else
    check_warn "RBAC_DESIGN.md not found"
fi

if [ -f "docs/TEAM_COLLABORATION_GUIDE.md" ]; then
    check_pass "TEAM_COLLABORATION_GUIDE.md exists"
else
    check_warn "TEAM_COLLABORATION_GUIDE.md not found"
fi

if [ -f "docs/AUDIT_LOG_SCHEMA.md" ]; then
    check_pass "AUDIT_LOG_SCHEMA.md exists"
else
    check_warn "AUDIT_LOG_SCHEMA.md not found"
fi

if [ -f "docs/RBAC_DEPLOYMENT_GUIDE.md" ]; then
    check_pass "RBAC_DEPLOYMENT_GUIDE.md exists"
else
    check_warn "RBAC_DEPLOYMENT_GUIDE.md not found (newly created)"
fi

if [ -f "docs/MFA_ENFORCEMENT_POLICY.md" ]; then
    check_pass "MFA_ENFORCEMENT_POLICY.md exists"
else
    check_warn "MFA_ENFORCEMENT_POLICY.md not found (newly created)"
fi

echo ""
echo "5. Tests"
echo "--------"

# Check test files
if [ -f "phase2-backend/functions/test_user_management.py" ]; then
    check_pass "test_user_management.py exists"
else
    check_warn "test_user_management.py not found"
fi

if [ -f "phase2-backend/functions/test_session_management.py" ]; then
    check_pass "test_session_management.py exists"
else
    check_warn "test_session_management.py not found"
fi

if [ -f "phase2-backend/functions/test_rbac_integration.py" ]; then
    check_pass "test_rbac_integration.py exists"
else
    check_warn "test_rbac_integration.py not found"
fi

if [ -f "phase3a-portal/src/components/__tests__/TeamManagement.test.jsx" ] || [ -f "phase3a-portal/src/__tests__/TeamManagement.test.jsx" ]; then
    check_pass "TeamManagement.test.jsx exists"
else
    check_warn "TeamManagement frontend tests not found"
fi

echo ""
echo "6. Deployment Tools"
echo "-------------------"

# Check packaging script
if [ -f "phase2-backend/functions/package-rbac-lambdas.sh" ]; then
    check_pass "package-rbac-lambdas.sh exists"
    
    if [ -x "phase2-backend/functions/package-rbac-lambdas.sh" ]; then
        check_pass "package-rbac-lambdas.sh is executable"
    else
        check_warn "package-rbac-lambdas.sh not executable"
    fi
else
    check_fail "package-rbac-lambdas.sh not found"
fi

# Check if Lambda zips can be created
if [ -d "phase2-backend/deploy" ]; then
    ZIP_COUNT=$(ls phase2-backend/deploy/{user_management,session_management,activity_feed,rbac_engine}.zip 2>/dev/null | wc -l)
    if [ "$ZIP_COUNT" -eq 4 ]; then
        check_pass "All 4 RBAC Lambda packages exist"
    elif [ "$ZIP_COUNT" -gt 0 ]; then
        check_warn "Only $ZIP_COUNT/4 Lambda packages found"
    else
        check_warn "Lambda packages not created yet (run package-rbac-lambdas.sh)"
    fi
else
    check_warn "Deploy directory doesn't exist yet"
fi

echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ RBAC Integration Validation: SUCCESS${NC}"
    echo ""
    echo "All critical components are in place!"
    echo ""
    echo "Next steps:"
    echo "1. Package Lambda functions: cd phase2-backend/functions && ./package-rbac-lambdas.sh"
    echo "2. Deploy database schema: psql -h \$RDS_ENDPOINT -f phase2-backend/database/rbac_schema.sql"
    echo "3. Deploy infrastructure: cd landing-zone && terraform apply"
    echo "4. Test API endpoints"
    echo "5. Deploy frontend"
    exit 0
else
    echo -e "${RED}❌ RBAC Integration Validation: FAILED${NC}"
    echo ""
    echo "Please fix the failed checks above before deployment."
    exit 1
fi
