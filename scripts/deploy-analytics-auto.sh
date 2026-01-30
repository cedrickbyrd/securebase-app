#!/usr/bin/env bash
set -euo pipefail

# Auto-deploy Analytics (packages upload -> terraform apply -auto-approve)
# Usage:
#   ARTIFACT_BUCKET=my-bucket AWS_REGION=us-east-1 ./scripts/deploy-analytics-auto.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_DIR="$ROOT/landing-zone/environments/dev"
DEPLOY_DIR="$ROOT/phase2-backend/deploy"
LPACK_DIR="$ROOT/landing-zone/lambda-packages"
LAYER_DIR="$ROOT/lambda-layer"
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [ -z "$ARTIFACT_BUCKET" ]; then
  echo "ERROR: ARTIFACT_BUCKET must be set. Example: export ARTIFACT_BUCKET=my-bucket"
  exit 1
fi

echo "Root: $ROOT"
echo "Artifact bucket: $ARTIFACT_BUCKET"
echo "AWS region: $AWS_REGION"
echo ""

# 1) Package Lambdas (full packaging)
echo "==> Packaging Lambda functions (this may install dependencies)..."
if [ -x "$ROOT/scripts/package-lambdas.sh" ]; then
  (cd "$ROOT" && ./scripts/package-lambdas.sh)
else
  echo "Warning: scripts/package-lambdas.sh not found or not executable. Attempting quick-package.sh"
  (cd "$ROOT" && ./scripts/quick-package.sh)
fi

# 2) Build Lambda layer
echo "==> Building Python Lambda layer..."
mkdir -p "$LAYER_DIR/python"
# Install dependencies into layer directory
if [ -f "$ROOT/phase2-backend/requirements.txt" ]; then
  pip install -r "$ROOT/phase2-backend/requirements.txt" -t "$LAYER_DIR/python" --upgrade
else
  echo "No requirements.txt found at phase2-backend/requirements.txt; skipping pip install."
fi

mkdir -p "$LPACK_DIR"
cd "$LAYER_DIR"
zip -r -q "$LPACK_DIR/lambda-layer.zip" python || true
cd "$ROOT"
echo "Layer packaged: $LPACK_DIR/lambda-layer.zip"

# 3) Ensure all function zips are in landing-zone/lambda-packages for terraform local fileexists usage
echo "==> Copying function packages into $LPACK_DIR (so Terraform sees them)"
mkdir -p "$LPACK_DIR"
if compgen -G "$DEPLOY_DIR/*.zip" > /dev/null; then
  cp -v "$DEPLOY_DIR"/*.zip "$LPACK_DIR/" || true
else
  echo "Warning: no zip packages found in $DEPLOY_DIR. Ensure package step succeeded."
fi

ls -lh "$LPACK_DIR" || true

# 4) Upload artifacts to S3 for archival / remote reference
echo "==> Uploading artifacts to s3://$ARTIFACT_BUCKET/phase4/"
for f in "$LPACK_DIR"/*.zip; do
  [ -f "$f" ] || continue
  key="phase4/$(basename "$f")"
  echo " Uploading $(basename "$f") -> s3://$ARTIFACT_BUCKET/$key"
  aws --region "$AWS_REGION" s3 cp "$f" "s3://$ARTIFACT_BUCKET/$key" --acl private
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

echo "Applying plan with -auto-approve (non-interactive). This will make changes in your AWS account."
terraform apply -input=false -auto-approve tfplan-auto

echo "Terraform apply complete."

# 6) Output helpful info
echo ""
echo "==> Post-deploy: retrieving api_gateway_endpoint (if exposed by Terraform outputs)"
if terraform output -json | jq -r 'has("api_gateway_endpoint")' 2>/dev/null | grep -q true; then
  API_ENDPOINT="$(terraform output -raw api_gateway_endpoint 2>/dev/null || true)"
  echo "API endpoint: $API_ENDPOINT"
  echo "Quick test (example):"
  echo "  curl -H \"Authorization: Bearer <TOKEN>\" \"$API_ENDPOINT/v1/cost/forecast?months=12&confidence_level=medium\" | jq"
else
  echo "No api_gateway_endpoint terraform output found (or terraform outputs not present)."
fi

echo ""
echo "Done. Verify the deployed resources and run integration tests (TEST_PHASE4.sh)."
