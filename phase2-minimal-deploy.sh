#!/bin/bash
# Phase 2 Minimal Deployment Script
# Copy and paste this into your terminal, or run: bash phase2-minimal-deploy.sh

cd /workspaces/securebase-app/landing-zone/environments/dev

echo "📋 Phase 2 Deployment - Starting..."
echo ""

# Step 1: Copy config
echo "1️⃣  Copying Phase 2 configuration..."
cp terraform.tfvars.phase2 terraform.tfvars
echo "✅ Done"
echo ""

# Step 2: Init Terraform
echo "2️⃣  Initializing Terraform..."
terraform init
echo "✅ Done"
echo ""

# Step 3: Validate
echo "3️⃣  Validating configuration..."
terraform validate
echo "✅ Done"
echo ""

# Step 4: Plan
echo "4️⃣  Creating Terraform plan..."
terraform plan -out=tfplan.phase2
echo "✅ Done"
echo ""

# Step 5: Apply (with confirmation)
echo "⚠️  About to deploy Phase 2 infrastructure"
echo "   Estimated cost: \$50-120/month"
echo "   Duration: 15-20 minutes"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
  echo ""
  echo "5️⃣  Deploying infrastructure..."
  terraform apply tfplan.phase2
  echo ""
  echo "✅ Phase 2 Infrastructure Deployed!"
  echo ""
  echo "📦 Resources Created:"
  terraform output
  echo ""
  echo "🎉 Next: Run database initialization"
  echo "   cd /workspaces/securebase-app/phase2-backend/database"
  echo "   bash init_database.sh"
else
  echo "❌ Deployment cancelled"
fi
