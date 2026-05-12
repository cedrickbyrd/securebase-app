#!/bin/bash
# Packages metrics_aggregation.py for Lambda deployment
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${SCRIPT_DIR}/../../../phase2-backend/functions/metrics_aggregation.py"
SRC_COST="${SCRIPT_DIR}/../../../phase2-backend/functions/cost_per_tenant.py"
OUT_DIR="${SCRIPT_DIR}/lambda"
OUT_FILE="${OUT_DIR}/metrics_aggregation.zip"
OUT_FILE_COST="${OUT_DIR}/cost_per_tenant.zip"

# Check if source file exists
if [ ! -f "$SRC" ]; then
    echo "❌ Error: Source file not found at $SRC"
    exit 1
fi
if [ ! -f "$SRC_COST" ]; then
    echo "❌ Error: Source file not found at $SRC_COST"
    exit 1
fi

# Create lambda directory if it doesn't exist
mkdir -p "$OUT_DIR"

# Copy source file to lambda directory
cp "$SRC" "$OUT_DIR/"
cp "$SRC_COST" "$OUT_DIR/"

# Package into zip file
cd "$OUT_DIR"
zip -q metrics_aggregation.zip metrics_aggregation.py
zip -q cost_per_tenant.zip cost_per_tenant.py

# Clean up the copied Python file
rm -f metrics_aggregation.py
rm -f cost_per_tenant.py

echo "✅ Lambda packaged: $OUT_FILE"
echo "   Size: $(du -h metrics_aggregation.zip | cut -f1)"
echo "✅ Lambda packaged: $OUT_FILE_COST"
echo "   Size: $(du -h cost_per_tenant.zip | cut -f1)"
