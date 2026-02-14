#!/bin/bash
# Phase 2 Deployment - Quick Start
# Automates terraform deployment for Phase 2 backend infrastructure

set -e

echo "🚀 SecureBase Phase 2 Deployment"
echo "================================="
echo ""

# Navigate to terraform directory
cd ~/projects/securebase-terraform/securebase-app/landing-zone/environments/dev

# Backup existing config
if [ -f terraform.tfvars ]; then
  echo "📦 Backing up existing terraform.tfvars..."
  cp terraform.tfvars terraform.tfvars.backup.$(date +%s)
fi

# Copy Phase 2 config
echo "📝 Copying Phase 2 configuration..."
cp terraform.tfvars.phase2 terraform.tfvars

# Initialize Terraform
echo "🔧 Initializing Terraform..."
terraform init

# Validate configuration
echo "✅ Validating configuration..."
terraform validate

# Create plan
echo "📊 Creating deployment plan..."
terraform plan -out=phase2.tfplan

echo ""
echo "================================="
echo "✅ Plan created successfully!"
echo ""
echo "Review the plan above. To deploy, run:"
echo "  cd ~/projects/securebase-terraform/securebase-app/landing-zone/environments/dev"
echo "  terraform apply phase2.tfplan"
echo ""
echo "Expected deployment time: 15-20 minutes"
echo "Monthly cost estimate: $50-120"
echo ""
