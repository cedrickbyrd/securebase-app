#!/usr/bin/env bash
set -euo pipefail

ENV=${1:-}
if [[ -z "$ENV" ]]; then
  echo "Usage: scripts/safe-init.sh <env>" >&2
  exit 1
fi

ROOT_DIR=$(cd "$(dirname "$0")"/.. && pwd)
cd "$ROOT_DIR"

BACKEND_HCL="environments/${ENV}/backend.hcl"
if [[ ! -f "$BACKEND_HCL" ]]; then
  echo "❌ Missing backend config: $BACKEND_HCL" >&2
  echo "Copy environments/backend.hcl.example and update values." >&2
  exit 1
fi

if ! grep -q 'backend\s*"s3"' main.tf; then
  echo "❌ main.tf missing 'backend \"s3\" {}' block" >&2
  exit 1
fi

echo "✅ Using backend config: $BACKEND_HCL"
terraform init -backend-config="$BACKEND_HCL" -upgrade
