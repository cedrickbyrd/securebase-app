#!/bin/bash
set -e
echo "SecureBase Deployment Script"
echo "Checking prerequisites..."
terraform version
aws --version
echo "Initializing Terraform..."
cd environments/dev
terraform init
terraform validate
terraform plan -out=tfplan
echo "Review the plan above"
read -p "Deploy? (yes/no): " CONFIRM
if [ "$CONFIRM" = "yes" ]; then
  terraform apply tfplan
  echo "Deployment Complete!"
fi
