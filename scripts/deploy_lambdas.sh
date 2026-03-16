#!/usr/bin/env bash
# =============================================================================
# deploy_lambdas.sh
# Packages and deploys all 4 signup/onboarding Lambda functions to AWS.
# Run from repo root. Requires: aws cli, python3, zip.
#
# Usage:
#   bash scripts/deploy_lambdas.sh
#
# Set these before running (or export from your shell):
#   AWS_REGION        default: us-east-1
#   LAMBDA_ROLE_ARN   IAM role ARN for Lambda execution
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ROLE_ARN="${LAMBDA_ROLE_ARN:-}"
RUNTIME="python3.11"
TIMEOUT=900   # 15 min — provisioner can run long
MEMORY=256

if [[ -z "$ROLE_ARN" ]]; then
  echo "❌ LAMBDA_ROLE_ARN is not set. Export it and re-run."
  echo "   export LAMBDA_ROLE_ARN=arn:aws:iam::<account_id>:role/securebase-lambda-role"
  exit 1
fi

FUNCTIONS=(
  "securebase-signup-handler:lambda/signup_handler.py:signup_handler.handler:120:256"
  "securebase-account-provisioner:lambda/account_provisioner.py:account_provisioner.handler:900:256"
  "securebase-onboarding-status:lambda/onboarding_status.py:onboarding_status.handler:30:128"
  "securebase-verify-email:lambda/verify_email.py:verify_email.lambda_handler:30:128"
)

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

deploy_function() {
  local name=$1
  local src=$2
  local handler=$3
  local timeout=$4
  local memory=$5

  echo ""
  echo "▶ Deploying $name..."

  # Package
  local zip="$TMPDIR/${name}.zip"
  local fname=$(basename $src)
  cp "$src" "$TMPDIR/$fname"
  (cd "$TMPDIR" && zip "${name}.zip" "$fname")

  # Create or update
  if aws lambda get-function --function-name "$name" --region "$REGION" \
      --query 'Configuration.FunctionName' --output text 2>/dev/null | grep -q "$name"; then
    echo "  Updating existing function..."
    aws lambda update-function-code \
      --function-name "$name" \
      --zip-file "fileb://$zip" \
      --region "$REGION" \
      --output table \
      --query '{FunctionName:FunctionName,CodeSize:CodeSize,LastModified:LastModified}'

    aws lambda update-function-configuration \
      --function-name "$name" \
      --timeout "$timeout" \
      --memory-size "$memory" \
      --region "$REGION" \
      --output text \
      --query 'FunctionArn' | xargs echo "  ARN:"
  else
    echo "  Creating new function..."
    aws lambda create-function \
      --function-name "$name" \
      --runtime "$RUNTIME" \
      --role "$ROLE_ARN" \
      --handler "$handler" \
      --timeout "$timeout" \
      --memory-size "$memory" \
      --zip-file "fileb://$zip" \
      --region "$REGION" \
      --environment "Variables={ALLOWED_ORIGIN=https://securebase.tximhotep.com,PORTAL_URL=https://securebase.tximhotep.com}" \
      --output text \
      --query 'FunctionArn' | xargs echo "  ARN:"
  fi
  echo "  ✅ $name deployed"
}

echo "=== SecureBase Lambda Deployment ==="
echo "Region:  $REGION"
echo "Role:    $ROLE_ARN"
echo ""

for fn in "${FUNCTIONS[@]}"; do
  IFS=':' read -r name src handler timeout memory <<< "$fn"
  deploy_function "$name" "$src" "$handler" "$timeout" "$memory"
done

echo ""
echo "=== All functions deployed ==="
echo ""
echo "Copy these ARNs into terraform/terraform.tfvars:"
echo ""
for fn in "${FUNCTIONS[@]}"; do
  IFS=':' read -r name src handler timeout memory <<< "$fn"
  arn=$(aws lambda get-function --function-name "$name" --region "$REGION" \
    --query 'Configuration.FunctionArn' --output text 2>/dev/null || echo "NOT_FOUND")
  echo "  $name"
  echo "    ARN:  $arn"
done