#!/bin/bash
# Manual Terraform Syntax Validation Script
# This script performs basic syntax checks on the modified Terraform files
# without requiring a full Terraform installation.

set -e

echo "=================================="
echo "Terraform Syntax Validation"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check function
check_file() {
    local file=$1
    echo -n "Checking $file... "
    
    # Basic HCL syntax checks
    
    # Check for unclosed braces
    open_braces=$(grep -o "{" "$file" | wc -l)
    close_braces=$(grep -o "}" "$file" | wc -l)
    
    if [ "$open_braces" -ne "$close_braces" ]; then
        echo -e "${RED}FAIL${NC}"
        echo "  Error: Unmatched braces (open: $open_braces, close: $close_braces)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
    
    # Check for syntax patterns that should exist after our changes
    case "$file" in
        *"netlify-sites/main.tf")
            # Should have data sources, not resources for netlify_site
            if grep -q 'resource "netlify_site"' "$file"; then
                echo -e "${RED}FAIL${NC}"
                echo "  Error: Found 'resource \"netlify_site\"' - should be 'data \"netlify_site\"'"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
            
            # Should have netlify_environment_variable, not netlify_env_var
            if grep -q 'resource "netlify_env_var"' "$file"; then
                echo -e "${RED}FAIL${NC}"
                echo "  Error: Found 'netlify_env_var' - should be 'netlify_environment_variable'"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
            
            # Should NOT have netlify_build_hook resource
            if grep -q 'resource "netlify_build_hook"' "$file"; then
                echo -e "${RED}FAIL${NC}"
                echo "  Error: Found 'netlify_build_hook' resource - should be removed"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
            
            # Should have data source for marketing site
            if ! grep -q 'data "netlify_site" "marketing"' "$file"; then
                echo -e "${RED}FAIL${NC}"
                echo "  Error: Missing 'data \"netlify_site\" \"marketing\"'"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
            
            # Should have data source for portal_demo site
            if ! grep -q 'data "netlify_site" "portal_demo"' "$file"; then
                echo -e "${RED}FAIL${NC}"
                echo "  Error: Missing 'data \"netlify_site\" \"portal_demo\"'"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
            ;;
            
        *"netlify-sites/outputs.tf")
            # Should reference data sources, not resources
            # Check for resource references without 'data.' prefix
            if grep -E '(^|[^a-z_])netlify_site\.(marketing|portal_demo)' "$file" | grep -v 'data\.netlify_site'; then
                echo -e "${RED}FAIL${NC}"
                echo "  Error: Found 'netlify_site.*' without 'data.' prefix"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
            
            # Should NOT have build_hook outputs
            if grep -q 'netlify_build_hook' "$file"; then
                echo -e "${RED}FAIL${NC}"
                echo "  Error: Found build_hook reference - should be removed"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
            ;;
            
        *"netlify-sites/versions.tf")
            # Should have version constraint ~> 0.4.0
            if ! grep -q 'version.*=.*"~> 0.4.0"' "$file"; then
                echo -e "${RED}FAIL${NC}"
                echo "  Error: Missing version constraint '~> 0.4.0'"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
            ;;
            
        *"api-gateway/main.tf")
            # Should NOT have throttle_settings block
            if grep -q 'throttle_settings {' "$file"; then
                echo -e "${RED}FAIL${NC}"
                echo "  Error: Found 'throttle_settings' - should be inside 'settings' block"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
            
            # Should have settings block with throttle nested inside
            if ! grep -A 3 'settings {' "$file" | grep -q 'throttle {'; then
                echo -e "${YELLOW}WARNING${NC}"
                echo "  Warning: Could not verify 'settings { throttle {' pattern"
            fi
            ;;
            
        *"analytics/dynamodb.tf")
            # Should have filter block in lifecycle configuration
            if ! grep -A 10 'rule {' "$file" | grep -q 'filter {}'; then
                echo -e "${RED}FAIL${NC}"
                echo "  Error: Missing 'filter {}' block in lifecycle configuration"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
            ;;
    esac
    
    echo -e "${GREEN}PASS${NC}"
    return 0
}

echo "Checking modified Terraform files..."
echo ""

# Check all modified files
check_file "landing-zone/modules/netlify-sites/main.tf"
check_file "landing-zone/modules/netlify-sites/outputs.tf"
check_file "landing-zone/modules/netlify-sites/versions.tf"
check_file "landing-zone/modules/api-gateway/main.tf"
check_file "landing-zone/modules/analytics/dynamodb.tf"

echo ""
echo "=================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All syntax checks passed!${NC}"
    echo "=================================="
    echo ""
    echo "Next steps:"
    echo "1. Run 'terraform init' in landing-zone/environments/dev"
    echo "2. Run 'terraform validate' to verify with Terraform"
    echo "3. For Netlify module: Create sites manually in Netlify UI first"
    echo ""
    echo "See TERRAFORM_VALIDATION_FIXES.md for detailed instructions."
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s)${NC}"
    echo "=================================="
    exit 1
fi
