#!/usr/bin/env bash
# =============================================================================
# package-phase6-lambdas.sh
# Packages phase6-backend Lambda functions into deployment zips.
#
# Usage:
#   ./package-phase6-lambdas.sh
#   ./package-phase6-lambdas.sh --function audit_evidence_api
#
# Output: landing-zone/files/phase6/*.zip
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"; pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.."; pwd)"
SRC_DIR="$REPO_ROOT/phase6-backend/functions"
OUT_DIR="$REPO_ROOT/landing-zone/files/phase6"
TMP_DIR="$(mktemp -d)"

mkdir -p "$OUT_DIR"

# Functions to package
FUNCTIONS=(
  audit_evidence_api
  audit_log_packager
  compliance_score_recalculator
  compliance_history_api
)

# If --function arg provided, package only that one
if [[ "${1:-}" == "--function" && -n "${2:-}" ]]; then
  FUNCTIONS=("$2")
fi

echo "=== SecureBase Phase 6 Lambda Packager ==="
echo "Source:  $SRC_DIR"
echo "Output:  $OUT_DIR"
echo ""

for FUNC in "${FUNCTIONS[@]}"; do
  SRC_FILE="$SRC_DIR/${FUNC}.py"
  ZIP_FILE="$OUT_DIR/${FUNC}.zip"

  if [[ ! -f "$SRC_FILE" ]]; then
    echo "[SKIP]  $FUNC — source not found: $SRC_FILE"
    continue
  fi

  echo "[PACK]  $FUNC"
  WORK_DIR="$TMP_DIR/$FUNC"
  mkdir -p "$WORK_DIR"

  # Copy the handler
  cp "$SRC_FILE" "$WORK_DIR/${FUNC}.py"

  # Install dependencies if requirements file exists
  REQ_FILE="$REPO_ROOT/phase6-backend/functions/requirements.txt"
  if [[ -f "$REQ_FILE" ]]; then
    pip install -r "$REQ_FILE" \
      --target "$WORK_DIR" \
      --quiet \
      --no-cache-dir \
      --platform manylinux2014_x86_64 \
      --python-version 3.11 \
      --only-binary=:all: \
      2>/dev/null || pip install -r "$REQ_FILE" --target "$WORK_DIR" --quiet --no-cache-dir
  fi

  # Zip
  (cd "$WORK_DIR" && zip -r "$ZIP_FILE" . -x '*.pyc' -x '__pycache__/*' -x '*.dist-info/*') \
    > /dev/null 2>&1

  SIZE=$(du -sh "$ZIP_FILE" | cut -f1)
  echo "        -> $ZIP_FILE ($SIZE)"
done

rm -rf "$TMP_DIR"
echo ""
echo "Done. Deploy with: terraform apply -target=module.phase6_lambdas"
