#!/usr/bin/env bash
# =============================================================================
# create_ssm_params.sh
# Creates all 9 SSM parameters required by the signup/onboarding Lambdas.
# Run AFTER you have your Aurora cluster, Cognito pool, and CodeBuild project.
#
# Usage:
#   bash scripts/create_ssm_params.sh
#
# Edit the VALUES section below before running.
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

# =============================================================================
# !! EDIT THESE VALUES BEFORE RUNNING !!
# =============================================================================
DB_RESOURCE_ARN="arn:aws:rds:us-east-1:ACCOUNT_ID:cluster:securebase-aurora-cluster"
DB_SECRET_ARN="arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:securebase/db-XXXXXX"
DB_NAME="securebase"
DB_URL="postgresql://USER:PASS@HOST:5432/securebase"
SES_FROM="noreply@securebase.tximhotep.com"
COGNITO_USER_POOL_ID="us-east-1_XXXXXXXXX"
PROVISIONER_FUNCTION="securebase-account-provisioner"
ORG_ID="o-XXXXXXXXXX"
CODEBUILD_PROJECT="securebase-customer-baseline"
# =============================================================================

put_param() {
  local name=$1
  local value=$2
  local type=${3:-SecureString}
  echo "▶ $name"
  aws ssm put-parameter \
    --name "$name" \
    --value "$value" \
    --type "$type" \
    --region "$REGION" \
    --overwrite \
    --output text \
    --query 'Version' | xargs echo "  version:"
}

echo "=== Creating SSM Parameters ==="
echo "Region: $REGION"
echo ""

put_param "/securebase/db/resource_arn"        "$DB_RESOURCE_ARN"       "SecureString"
put_param "/securebase/db/secret_arn"          "$DB_SECRET_ARN"         "SecureString"
put_param "/securebase/db/name"                "$DB_NAME"               "String"
put_param "/securebase/db/url"                 "$DB_URL"                "SecureString"
put_param "/securebase/ses/from_address"       "$SES_FROM"              "String"
put_param "/securebase/cognito/user_pool_id"   "$COGNITO_USER_POOL_ID"  "String"
put_param "/securebase/provisioner/function"   "$PROVISIONER_FUNCTION"  "String"
put_param "/securebase/aws/org_id"             "$ORG_ID"                "String"
put_param "/securebase/codebuild/project_name" "$CODEBUILD_PROJECT"     "String"

echo ""
echo "✅ All 9 SSM parameters created in $REGION"