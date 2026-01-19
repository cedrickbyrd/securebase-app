#!/usr/bin/env bash
set -euo pipefail

# Verify Terraform remote backend configuration and environment files
# Usage: ./scripts/verify-remote-backend.sh [env]
# Default env: dev

ENV=${1:-dev}
ROOT_DIR=$(cd "$(dirname "$0")"/.. && pwd)
cd "$ROOT_DIR"

BACKEND_HCL="environments/${ENV}/backend.hcl"
MAIN_TF="main.tf"

if ! grep -q 'backend\s*"s3"' "$MAIN_TF"; then
  echo "❌ main.tf missing 'backend \"s3\" {}' block"
  exit 1
fi

if [ ! -f "$BACKEND_HCL" ]; then
  echo "❌ Missing backend config: $BACKEND_HCL"
  echo "Copy environments/backend.hcl.example and update values, then re-run."
  exit 1
fi

echo "✅ Remote backend verified for env: $ENV"
