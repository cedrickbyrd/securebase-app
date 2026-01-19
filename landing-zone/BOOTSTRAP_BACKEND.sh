#!/usr/bin/env bash
set -euo pipefail

# Bootstrap remote Terraform state backend in AWS (S3; optional DynamoDB)
# Usage:
#   ENV=dev REGION=us-east-1 ORG=securebase bash BOOTSTRAP_BACKEND.sh
# Defaults:
ENV=${ENV:-dev}
REGION=${REGION:-us-east-1}
ORG=${ORG:-securebase}

BUCKET="${ORG}-terraform-state-${ENV}"
TABLE="${ORG}-terraform-locks-${ENV}"

echo "Bootstrap remote backend in region ${REGION} for env ${ENV}" 
command -v aws >/dev/null 2>&1 || { echo "AWS CLI not found. Please install and configure credentials."; exit 1; }

# Identify caller
aws sts get-caller-identity >/dev/null || { echo "AWS credentials not configured."; exit 1; }

# Create S3 bucket (region-aware)
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "S3 bucket already exists: $BUCKET"
else
  echo "Creating S3 bucket: $BUCKET"
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION"
  fi
fi

# Enable bucket versioning
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled

# Enable default encryption (AES256)
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Block public access
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "Note: Using S3 lockfile by default (use_lockfile=true). DynamoDB-based locking is optional."
if aws dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  echo "DynamoDB table exists: $TABLE (optional)"
else
  echo "Skipping DynamoDB creation (optional). To create later: aws dynamodb create-table --table-name $TABLE ..."
fi

cat <<EOT

✅ Backend bootstrap complete.

Add/update backend config file:
  landing-zone/environments/${ENV}/backend.hcl

Example contents:
  bucket = "${BUCKET}"
  key    = "landing-zone/terraform.tfstate"
  region = "${REGION}"
  encrypt = true
  use_lockfile = true

Then initialize/migrate:
  cd landing-zone
  terraform init -backend-config=environments/${ENV}/backend.hcl -upgrade

If migrating existing local state:
  terraform init -migrate-state -backend-config=environments/${ENV}/backend.hcl
EOT
