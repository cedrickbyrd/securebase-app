#!/bin/bash
# Quick Lambda Packaging Script
# Creates minimal deployment packages without dependencies

set -e

# Determine ROOT directory (same logic as deploy-analytics-auto.sh)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "📦 Packaging Lambda Functions..."
echo ""

cd "$ROOT/phase2-backend/functions"
mkdir -p ../deploy

# Package each function
echo "→ auth_v2.zip"
zip -q "$DEPLOY_DIR/auth_v2.zip" auth_v2.py
echo "  ✅ Created"

echo "→ webhook_manager.zip"
zip -q "$DEPLOY_DIR/webhook_manager.zip" webhook_manager.py
echo "  ✅ Created"

echo "→ billing_worker.zip"
zip -q "$DEPLOY_DIR/billing_worker.zip" billing-worker.py
echo "  ✅ Created"

echo "→ support_tickets.zip"
zip -q "$DEPLOY_DIR/support_tickets.zip" support_tickets.py
echo "  ✅ Created"

echo "→ cost_forecasting.zip"
zip -q "$DEPLOY_DIR/cost_forecasting.zip" cost_forecasting.py
echo "  ✅ Created"

echo ""
echo "✅ All packages created!"
ls -lh "$DEPLOY_DIR"/*.zip

echo ""
echo "Next: cd landing-zone && terraform init && terraform plan"
