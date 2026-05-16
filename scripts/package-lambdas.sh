#!/bin/bash
# Packages Terraform-managed Lambda zip artifacts from source.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${LAMBDA_OUTPUT_DIR:-$ROOT/lambda}"

mkdir -p "$OUTPUT_DIR"

package_lambda() {
    local zip_name=$1
    local source_file=$2

    if [ ! -f "$source_file" ]; then
        echo "Missing Lambda source: $source_file" >&2
        exit 1
    fi

    echo "📦 Packaging ${zip_name}.zip from $(basename "$source_file")"
    rm -f "$OUTPUT_DIR/${zip_name}.zip"
    zip -jq "$OUTPUT_DIR/${zip_name}.zip" "$source_file"
    echo "  ✅ $OUTPUT_DIR/${zip_name}.zip ($(du -h "$OUTPUT_DIR/${zip_name}.zip" | cut -f1))"
}

echo "🚀 Packaging Terraform-managed Lambda artifacts"
echo "Output directory: $OUTPUT_DIR"

package_lambda "pilot_availability" "$ROOT/phase2-backend/functions/pilot_availability.py"
package_lambda "validate_session" "$ROOT/phase2-backend/functions/validate_session.py"
package_lambda "stripe_webhook" "$ROOT/lambda/stripe_webhook_handler.py"
