#!/bin/bash
# Package Lambda Functions for Deployment
# Creates deployment-ready zip files in ../deploy/

set -e

cd "$(dirname "$0")"
mkdir -p ../deploy

package() {
  local name="$1"
  echo "📦 Packaging ${name} Lambda..."
  rm -f "../deploy/${name}.zip"
  zip -j "../deploy/${name}.zip" "${name}.py"
  SIZE=$(du -h "../deploy/${name}.zip" | cut -f1)
  echo "✅ ${name}.zip (${SIZE})"
}

package report_engine
package demo_auth
package session_management

echo ""
echo "🚀 All Lambda functions packaged in ../deploy/"
echo ""
echo "Next steps:"
echo "1. Build Lambda layer: cd ../layers/reporting && ./build-layer.sh"
echo "2. Publish layer to AWS"
echo "3. Deploy with Terraform: cd landing-zone/environments/dev && terraform apply"
