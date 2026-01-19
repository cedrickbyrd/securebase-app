#!/bin/bash
set -e

REPO_ROOT="/workspaces/securebase-app"

echo "🧹 Cleaning Terraform caches..."
rm -rf "$REPO_ROOT/landing-zone/.terraform"
rm -rf "$REPO_ROOT/landing-zone/.terraform.lock.hcl"
rm -rf "$REPO_ROOT/landing-zone/environments/dev/.terraform"
rm -rf "$REPO_ROOT/landing-zone/environments/dev/.terraform.lock.hcl"

echo "✅ Cache cleaned!"
echo ""

cd "$REPO_ROOT/landing-zone/environments/dev"
echo "📍 Working directory: $(pwd)"
echo ""

echo "🔄 Initializing Terraform..."
terraform init

echo ""
echo "✅ Init complete! Running validate..."
terraform validate

echo ""
echo "✨ Success! Configuration is valid."
echo ""
echo "Next steps:"
echo "  cd landing-zone/environments/dev"
echo "  terraform plan -out=tfplan"
echo "  terraform apply tfplan"
