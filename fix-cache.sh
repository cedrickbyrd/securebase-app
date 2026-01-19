#!/bin/bash

echo "🧹 Cleaning Terraform Cache..."

cd "$(dirname "$0")" || exit

# Remove all terraform caches
echo "Removing stale .terraform directories..."
rm -rf landing-zone/.terraform
rm -rf landing-zone/.terraform.lock.hcl
rm -rf landing-zone/terraform.tfstate*
rm -rf landing-zone/environments/dev/.terraform
rm -rf landing-zone/environments/dev/.terraform.lock.hcl
rm -rf landing-zone/environments/dev/terraform.tfstate*

echo "✅ Cache cleaned!"

echo ""
echo "📍 Navigating to correct directory..."
cd landing-zone/environments/dev || exit 1

echo "🔄 Reinitializing Terraform..."
terraform init

echo ""
echo "✅ Done! Running validate..."
terraform validate

echo ""
echo "✨ All set! You can now run:"
echo "   terraform plan"
echo "   terraform apply"
