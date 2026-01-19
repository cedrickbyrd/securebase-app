#!/bin/bash
# SecureBase PaaS - Deployment Diagnostics
# Diagnose common deployment issues

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔍 SecureBase PaaS - Deployment Diagnostics"
echo "==========================================="
echo ""

# Check 1: Are we in the right directory?
echo "Check 1: Are you in the correct directory?"
if [ "$(basename "$PWD")" = "dev" ] && [ -f "terraform.tfvars" ]; then
  echo -e "${GREEN}✓ PASS${NC}: You are in landing-zone/environments/dev/"
else
  echo -e "${RED}✗ FAIL${NC}: You are NOT in landing-zone/environments/dev/"
  echo "  Current directory: $PWD"
  echo "  Required directory: $SCRIPT_DIR/landing-zone/environments/dev/"
  echo ""
  echo "  To fix: cd landing-zone/environments/dev"
  exit 1
fi
echo ""

# Check 2: Configuration files present?
echo "Check 2: Are configuration files present?"
if [ -f "terraform.tfvars" ] && [ -f "client.auto.tfvars" ]; then
  echo -e "${GREEN}✓ PASS${NC}: Both terraform.tfvars and client.auto.tfvars found"
else
  echo -e "${RED}✗ FAIL${NC}: Missing configuration files"
  [ ! -f "terraform.tfvars" ] && echo "  Missing: terraform.tfvars"
  [ ! -f "client.auto.tfvars" ] && echo "  Missing: client.auto.tfvars"
  exit 1
fi
echo ""

# Check 3: Stale state in root?
echo "Check 3: Is there stale state in the root directory?"
if [ -d "$SCRIPT_DIR/landing-zone/.terraform" ]; then
  echo -e "${YELLOW}⚠️  WARNING${NC}: Found .terraform directory in root landing-zone/"
  echo "  This is old state from running terraform in the wrong directory"
  echo "  To fix: cd landing-zone/environments/dev && terraform init"
  echo "          This will create fresh state in the right location"
else
  echo -e "${GREEN}✓ PASS${NC}: No stale state in root directory"
fi
echo ""

# Check 4: Variables declared?
echo "Check 4: Are required variables declared?"
if grep -q "variable \"customer_tier\"" "$SCRIPT_DIR/landing-zone/environments/dev/variables.tf"; then
  echo -e "${GREEN}✓ PASS${NC}: customer_tier variable declared"
else
  echo -e "${RED}✗ FAIL${NC}: customer_tier variable NOT declared"
  exit 1
fi

if grep -q "variable \"clients\"" "$SCRIPT_DIR/landing-zone/environments/dev/variables.tf"; then
  echo -e "${GREEN}✓ PASS${NC}: clients variable declared"
else
  echo -e "${RED}✗ FAIL${NC}: clients variable NOT declared"
  exit 1
fi
echo ""

# Check 5: Client configurations valid?
echo "Check 5: Are client configurations valid?"
if grep -q "framework" client.auto.tfvars; then
  echo -e "${GREEN}✓ PASS${NC}: All clients have framework attribute"
else
  echo -e "${RED}✗ FAIL${NC}: Some clients missing framework attribute"
  echo "  Each client needs: framework = \"hipaa\" | \"soc2\" | \"fedramp\" | \"cis\""
  exit 1
fi
echo ""

# Check 6: Terraform installed?
echo "Check 6: Is Terraform installed?"
if command -v terraform &> /dev/null; then
  VERSION=$(terraform version | head -1)
  echo -e "${GREEN}✓ PASS${NC}: $VERSION"
else
  echo -e "${RED}✗ FAIL${NC}: Terraform not found in PATH"
  exit 1
fi
echo ""

# Check 7: AWS credentials configured?
echo "Check 7: Are AWS credentials configured?"
if aws sts get-caller-identity &> /dev/null; then
  ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
  USER=$(aws sts get-caller-identity --query Arn --output text)
  echo -e "${GREEN}✓ PASS${NC}: AWS credentials found"
  echo "  Account: $ACCOUNT"
  echo "  Identity: $USER"
else
  echo -e "${RED}✗ FAIL${NC}: AWS credentials not configured"
  echo "  Run: aws configure"
  exit 1
fi
echo ""

# Summary
echo "==========================================="
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "You're ready to deploy. Run:"
echo "  terraform init"
echo "  terraform plan"
echo "  terraform apply"
echo ""
