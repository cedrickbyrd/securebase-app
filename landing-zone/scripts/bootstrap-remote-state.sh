#!/usr/bin/env bash
# bootstrap-remote-state.sh
# Creates the S3 bucket and DynamoDB table required for Terraform remote state.
# Run once per environment before the first `terraform init -backend-config=backend.hcl`.
#
# Usage:
#   ./scripts/bootstrap-remote-state.sh [env]          # defaults to 'dev'
#   ./scripts/bootstrap-remote-state.sh staging
#   ./scripts/bootstrap-remote-state.sh production
#
# Prerequisites:
#   - AWS CLI v2 installed and configured with permissions to create S3 + DynamoDB resources
#   - aws sts get-caller-identity should succeed
set -euo pipefail

ENV=${1:-dev}
REGION=${AWS_REGION:-us-east-1}
BUCKET="securebase-terraform-state-${ENV}"
TABLE="securebase-terraform-locks"

echo "==================================================="
echo " SecureBase Terraform Remote State Bootstrap"
echo "---------------------------------------------------"
echo " Environment : ${ENV}"
echo " Region      : ${REGION}"
echo " S3 Bucket   : ${BUCKET}"
echo " DynamoDB    : ${TABLE}"

# Verify AWS credentials before doing anything
if ! aws sts get-caller-identity --query Account --output text > /dev/null 2>&1; then
  echo ""
  echo "❌ ERROR: AWS credentials are not configured or are invalid."
  echo "   Run 'aws configure' or set AWS_PROFILE / AWS_ROLE_ARN and try again."
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo " Account     : ${ACCOUNT_ID}"
echo "==================================================="
echo ""

# ── S3 Bucket ──────────────────────────────────────────────────────────────
if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "✅ S3 bucket '${BUCKET}' already exists — skipping creation."
else
  echo "🪣  Creating S3 bucket '${BUCKET}'..."

  if [ "${REGION}" = "us-east-1" ]; then
    aws s3api create-bucket \
      --bucket "${BUCKET}" \
      --region "${REGION}"
  else
    aws s3api create-bucket \
      --bucket "${BUCKET}" \
      --region "${REGION}" \
      --create-bucket-configuration LocationConstraint="${REGION}"
  fi

  # Block all public access
  aws s3api put-public-access-block \
    --bucket "${BUCKET}" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  # Enable versioning for state history
  aws s3api put-bucket-versioning \
    --bucket "${BUCKET}" \
    --versioning-configuration Status=Enabled

  # Enable AES-256 server-side encryption (FedRAMP requirement)
  aws s3api put-bucket-encryption \
    --bucket "${BUCKET}" \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        },
        "BucketKeyEnabled": true
      }]
    }'

  echo "✅ S3 bucket '${BUCKET}' created with versioning and AES-256 encryption."
fi

# ── DynamoDB Lock Table ─────────────────────────────────────────────────────
if aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" 2>/dev/null | grep -q '"TableStatus"'; then
  echo "✅ DynamoDB table '${TABLE}' already exists — skipping creation."
else
  echo "🗄️  Creating DynamoDB lock table '${TABLE}'..."

  aws dynamodb create-table \
    --table-name "${TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "${REGION}" \
    --tags Key=Project,Value=SecureBase Key=Environment,Value="${ENV}" Key=ManagedBy,Value=terraform

  echo "⏳ Waiting for table '${TABLE}' to become active..."
  aws dynamodb wait table-exists --table-name "${TABLE}" --region "${REGION}"
  echo "✅ DynamoDB lock table '${TABLE}' is active."
fi

echo ""
echo "==================================================="
echo " Bootstrap complete! Next steps:"
echo "---------------------------------------------------"
echo " 1. Verify backend.hcl in environments/${ENV}/:"
echo "      bucket         = \"${BUCKET}\""
echo "      key            = \"${ENV}/securebase.tfstate\""
echo "      region         = \"${REGION}\""
echo "      dynamodb_table = \"${TABLE}\""
echo "      encrypt        = true"
echo ""
echo " 2. Initialise Terraform with the remote backend:"
echo "      cd landing-zone/environments/${ENV}"
echo "      terraform init -backend-config=backend.hcl"
echo "==================================================="
