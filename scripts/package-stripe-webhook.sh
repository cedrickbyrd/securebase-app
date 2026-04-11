#!/bin/bash
# Package the Stripe webhook Lambda function for deployment.
#
# Produces: lambda/stripe_webhook.zip
#   Contains: stripe_webhook_handler.py  ga4_client.py
#
# Usage:
#   ./scripts/package-stripe-webhook.sh [--deploy]
#
# Options:
#   --deploy  After packaging, update the live Lambda function code via AWS CLI.
#             Requires AWS credentials and LAMBDA_FUNCTION_NAME env var
#             (default: securebase-stripe-webhook).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAMBDA_DIR="$REPO_ROOT/lambda"
OUTPUT_ZIP="$LAMBDA_DIR/stripe_webhook.zip"
DEPLOY=false

for arg in "$@"; do
  if [ "$arg" = "--deploy" ]; then
    DEPLOY=true
  fi
done

echo "📦 Packaging Stripe Webhook Lambda"
echo "==================================="

# Build in a temp directory so we don't pollute the source tree
BUILD_DIR="$(mktemp -d)" || { echo "❌ Failed to create temp directory"; exit 1; }
trap 'rm -rf "$BUILD_DIR"' EXIT

echo "  Source: $LAMBDA_DIR"
echo "  Output: $OUTPUT_ZIP"
echo ""

# Copy handler files
cp "$LAMBDA_DIR/stripe_webhook_handler.py" "$BUILD_DIR/"
cp "$LAMBDA_DIR/ga4_client.py"             "$BUILD_DIR/"

# Create zip (no top-level directory — Lambda expects files at the root)
cd "$BUILD_DIR"
zip -q "$OUTPUT_ZIP" stripe_webhook_handler.py ga4_client.py

echo "✅ Package created: $OUTPUT_ZIP ($(du -h "$OUTPUT_ZIP" | cut -f1))"
echo ""
echo "Files included:"
unzip -l "$OUTPUT_ZIP" | awk 'NR>3 && /\.py/ {print "  "$NF}'
echo ""

if [ "$DEPLOY" = "true" ]; then
  FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-securebase-stripe-webhook}"
  REGION="${AWS_REGION:-us-east-1}"

  echo "🚀 Deploying to Lambda: $FUNCTION_NAME (region: $REGION)"

  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$OUTPUT_ZIP" \
    --region "$REGION" \
    --query 'FunctionArn' \
    --output text

  echo ""
  echo "✅ Lambda updated successfully."
  echo ""
  echo "Monitor first checkout.session.completed receipt:"
  echo "  aws logs tail /aws/lambda/$FUNCTION_NAME --follow \\"
  echo "    --filter-pattern 'CHECKOUT_CONFIRMED'"
fi
