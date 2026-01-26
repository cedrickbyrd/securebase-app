#!/bin/bash
set -e

echo "Installing Terraform v1.5.7..."

# Download Terraform
cd /tmp
rm -f terraform_1.5.7_linux_amd64.zip terraform

echo "Downloading Terraform..."
wget -q https://releases.hashicorp.com/terraform/1.5.7/terraform_1.5.7_linux_amd64.zip

echo "Extracting Terraform..."
unzip -q terraform_1.5.7_linux_amd64.zip

echo "Installing Terraform to /usr/local/bin..."
if [ -w /usr/local/bin ]; then
  mv terraform /usr/local/bin/
else
  sudo mv terraform /usr/local/bin/
fi

# Verify installation
echo "Verifying installation..."
terraform --version

echo ""
echo "✅ Terraform installed successfully!"
echo "You can now run: cd /workspaces/securebase-app/landing-zone && bash FIX_TERRAFORM_CACHE.sh"
