#!/bin/bash
# SecureBase AWS Credentials Configuration Script
# Helps set up AWS credentials for Terraform deployment

set -e

echo "🔐 SecureBase AWS Configuration"
echo "================================"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &>/dev/null; then
    echo "❌ AWS CLI not found!"
    echo ""
    echo "Install AWS CLI:"
    echo "  Ubuntu/Debian: sudo apt-get install awscli"
    echo "  macOS: brew install awscli"
    echo "  Or: https://aws.amazon.com/cli/"
    exit 1
fi

echo "✅ AWS CLI found: $(aws --version)"
echo ""

# Detect current credentials
echo "🔍 Checking existing credentials..."
if aws sts get-caller-identity &>/dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    echo "✅ AWS credentials already configured!"
    echo ""
    echo "  Account ID: $ACCOUNT_ID"
    echo "  Identity:   $USER_ARN"
    echo ""
    read -p "Do you want to reconfigure? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Using existing credentials."
        exit 0
    fi
fi

echo ""
echo "Choose authentication method:"
echo "  1. Interactive configuration (aws configure)"
echo "  2. Environment variables"
echo "  3. IAM role (for EC2/ECS/Cloud9)"
echo "  4. Exit"
echo ""
read -p "Select option (1-4): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo ""
        echo "🔧 Running interactive configuration..."
        echo ""
        aws configure
        ;;
    2)
        echo ""
        echo "🔧 Environment variable setup"
        echo ""
        read -p "AWS Access Key ID: " AWS_KEY
        read -sp "AWS Secret Access Key: " AWS_SECRET
        echo ""
        read -p "Default region [us-east-1]: " AWS_REGION
        AWS_REGION=${AWS_REGION:-us-east-1}
        
        echo ""
        echo "export AWS_ACCESS_KEY_ID=$AWS_KEY" > ~/.aws-env
        echo "export AWS_SECRET_ACCESS_KEY=$AWS_SECRET" >> ~/.aws-env
        echo "export AWS_DEFAULT_REGION=$AWS_REGION" >> ~/.aws-env
        
        chmod 600 ~/.aws-env
        
        echo ""
        echo "✅ Credentials saved to ~/.aws-env"
        echo ""
        echo "To activate in current shell:"
        echo "  source ~/.aws-env"
        echo ""
        echo "To activate permanently, add to ~/.bashrc or ~/.zshrc:"
        echo "  echo 'source ~/.aws-env' >> ~/.bashrc"
        ;;
    3)
        echo ""
        echo "✅ Using IAM role from instance metadata"
        echo ""
        echo "Verifying role access..."
        if aws sts get-caller-identity &>/dev/null; then
            ROLE_ARN=$(aws sts get-caller-identity --query Arn --output text)
            echo "✅ Role active: $ROLE_ARN"
        else
            echo "❌ No IAM role detected. Are you running on EC2/ECS/Cloud9?"
            exit 1
        fi
        ;;
    4)
        echo "Exiting."
        exit 0
        ;;
    *)
        echo "Invalid option."
        exit 1
        ;;
esac

echo ""
echo "🧪 Testing credentials..."
if aws sts get-caller-identity &>/dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    echo "✅ Authentication successful!"
    echo ""
    echo "  Account ID: $ACCOUNT_ID"
    echo "  Identity:   $USER_ARN"
    echo ""
    echo "📋 Next steps:"
    echo "  1. ./bootstrap-backend.sh     # Create S3 + DynamoDB backend"
    echo "  2. cd environments/dev"
    echo "  3. terraform init -backend-config=backend.hcl"
    echo "  4. terraform plan"
else
    echo "❌ Authentication failed!"
    echo ""
    echo "Please verify your credentials and try again."
    exit 1
fi
