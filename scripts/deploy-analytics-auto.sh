#!/usr/bin/env bash
set -euo pipefail

# Auto-deploy Analytics (packages upload -> terraform apply -auto-approve)
# Usage:
#   ARTIFACT_BUCKET=my-bucket AWS_REGION=us-east-1 ./scripts/deploy-analytics-auto.sh
#   ARTIFACT_BUCKET=my-bucket ENVIRONMENT=staging ./scripts/deploy-analytics-auto.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENVIRONMENT="${ENVIRONMENT:-dev}"
ENV_DIR="$ROOT/landing-zone/environments/$ENVIRONMENT"
DEPLOY_DIR="$ROOT/phase2-backend/deploy"
LPACK_DIR="$ROOT/landing-zone/lambda-packages"
LAYER_DIR="$ROOT/lambda-layer"
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Pre-flight checks
if [ -z "$ARTIFACT_BUCKET" ]; then
  echo "ERROR: ARTIFACT_BUCKET must be set. Example: export ARTIFACT_BUCKET=my-bucket"
  exit 1
fi

# Check required tools
for cmd in aws terraform zip python3 jq; do
  if ! command -v $cmd &> /dev/null; then
    echo "ERROR: Required tool not found: $cmd"
    echo "Please install $cmd and try again."
    exit 1
  fi
done

# Check AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
  echo "ERROR: AWS credentials not configured or invalid"
  echo "Please configure AWS credentials:"
  echo "  aws configure"
  exit 1
fi

# Verify S3 bucket is accessible
if ! aws s3 ls "s3://$ARTIFACT_BUCKET/" --region "$AWS_REGION" &>/dev/null; then
  echo "ERROR: Cannot access S3 bucket: $ARTIFACT_BUCKET"
  echo "Please verify the bucket exists and you have permissions to access it."
  exit 1
fi

echo "Root: $ROOT"
echo "Environment: $ENVIRONMENT"
echo "Artifact bucket: $ARTIFACT_BUCKET"
echo "AWS region: $AWS_REGION"
echo ""

# 1) Package Lambdas (full packaging)
echo "==> Packaging Lambda functions (this may install dependencies)..."
if [ -x "$ROOT/scripts/package-lambdas.sh" ]; then
  (cd "$ROOT" && ./scripts/package-lambdas.sh)
elif [ -x "$ROOT/scripts/quick-package.sh" ]; then
  echo "Warning: scripts/package-lambdas.sh not found or not executable. Using quick-package.sh"
  (cd "$ROOT" && ./scripts/quick-package.sh)
else
  echo "ERROR: Neither package-lambdas.sh nor quick-package.sh found"
  exit 1
fi

# Verify packaging succeeded
if [ ! -d "$DEPLOY_DIR" ] || ! compgen -G "$DEPLOY_DIR/*.zip" > /dev/null; then
  echo "ERROR: Lambda packaging failed - no zip files found in $DEPLOY_DIR"
  exit 1
fi

# 2) Build Lambda layer
echo "==> Building Python Lambda layer..."
mkdir -p "$LAYER_DIR/python"
# Install dependencies into layer directory using explicit Python version
if [ -f "$ROOT/phase2-backend/requirements.txt" ]; then
  python3 -m pip install -r "$ROOT/phase2-backend/requirements.txt" -t "$LAYER_DIR/python" --upgrade
else
  echo "No requirements.txt found at phase2-backend/requirements.txt; skipping pip install."
fi

mkdir -p "$LPACK_DIR"
cd "$LAYER_DIR"
zip -r -q "$LPACK_DIR/lambda-layer.zip" python
cd "$ROOT"

# Verify layer was created
if [ ! -f "$LPACK_DIR/lambda-layer.zip" ]; then
  echo "ERROR: Failed to create lambda-layer.zip"
  exit 1
fi
echo "Layer packaged: $LPACK_DIR/lambda-layer.zip"

# 3) Ensure all function zips are in landing-zone/lambda-packages for terraform local fileexists usage
echo "==> Copying function packages into $LPACK_DIR (so Terraform sees them)"
mkdir -p "$LPACK_DIR"
if compgen -G "$DEPLOY_DIR/*.zip" > /dev/null; then
  cp -v "$DEPLOY_DIR"/*.zip "$LPACK_DIR/"
else
  echo "ERROR: No zip packages found in $DEPLOY_DIR"
  exit 1
fi

ls -lh "$LPACK_DIR"

# 4) Upload artifacts to S3 for archival / remote reference
echo "==> Uploading artifacts to s3://$ARTIFACT_BUCKET/phase4/"
for f in "$LPACK_DIR"/*.zip; do
  [ -f "$f" ] || continue
  key="phase4/$(basename "$f")"
  echo " Uploading $(basename "$f") -> s3://$ARTIFACT_BUCKET/$key"
  if ! aws --region "$AWS_REGION" s3 cp "$f" "s3://$ARTIFACT_BUCKET/$key" 2>&1; then
    echo "ERROR: Failed to upload $(basename "$f") to S3."
    echo "  Destination: s3://$ARTIFACT_BUCKET/$key"
    echo "  AWS Region: $AWS_REGION"
    echo ""
    echo "Troubleshooting tips:"
    echo "  1. Verify AWS credentials are configured: aws sts get-caller-identity"
    echo "  2. Verify bucket exists: aws s3 ls s3://$ARTIFACT_BUCKET --region $AWS_REGION"
    echo "  3. Verify bucket permissions: ensure your IAM user/role has s3:PutObject on $ARTIFACT_BUCKET"
    echo "  4. Verify the bucket is in the correct region: $AWS_REGION"
    echo "  5. Check network connectivity to AWS S3"
    exit 1
  fi
done

echo "All artifacts uploaded."

# 5) Terraform init/plan/apply (auto-approve)
echo "==> Running Terraform init/plan/apply in $ENV_DIR"
if [ ! -d "$ENV_DIR" ]; then
  echo "ERROR: Terraform environment directory not found: $ENV_DIR"
  exit 1
fi

cd "$ENV_DIR"

echo "Initializing Terraform..."
terraform init -input=false

echo "Creating plan..."
terraform plan -out=tfplan-auto -input=false

# Verify plan file was created
if [ ! -f tfplan-auto ]; then
  echo "ERROR: Terraform plan file not created"
  exit 1
fi

echo "Applying plan with -auto-approve (non-interactive). This will make changes in your AWS account."
terraform apply -input=false -auto-approve tfplan-auto

echo "Terraform apply complete."

# 6) Output helpful info
echo ""
echo "==> Post-deploy: retrieving api_gateway_endpoint (if exposed by Terraform outputs)"
if terraform output -json 2>/dev/null | jq -e '.api_gateway_endpoint' > /dev/null 2>&1; then
  API_ENDPOINT="$(terraform output -raw api_gateway_endpoint 2>/dev/null)"
  if [ -n "$API_ENDPOINT" ]; then
    echo "API endpoint: $API_ENDPOINT"
    echo "Quick test (example):"
    echo "  curl -H \"Authorization: Bearer <token>\" $API_ENDPOINT/analytics/usage"
  fi
else
  echo "Note: api_gateway_endpoint output not found in Terraform state"
fi

echo ""
echo "==> Deployment Summary"
echo "Artifacts uploaded to: s3://$ARTIFACT_BUCKET/phase4/"
echo "Terraform state: $ENV_DIR"
echo ""
echo "Next steps:"
echo "  1. Verify Lambda functions in AWS Console"
echo "  2. Test API endpoints"
echo "  3. Monitor CloudWatch logs"
echo "  4. Review CloudWatch dashboard for metrics"
echo ""
echo "Deployment complete!"
