#!/bin/bash
# SecureBase Backend Bootstrap Script
# Creates S3 bucket and DynamoDB table for Terraform remote state

set -e

# Configuration (matches backend.hcl)
BUCKET_NAME="securebase-terraform-state-dev"
DYNAMODB_TABLE="securebase-terraform-locks"
REGION="us-east-1"

echo "🚀 SecureBase Backend Bootstrap"
echo "================================"
echo ""
echo "This script will create:"
echo "  - S3 Bucket: $BUCKET_NAME"
echo "  - DynamoDB Table: $DYNAMODB_TABLE"
echo "  - Region: $REGION"
echo ""

# Check AWS credentials
echo "🔍 Checking AWS credentials..."
if ! aws sts get-caller-identity &>/dev/null; then
    echo "❌ AWS credentials not configured!"
    echo ""
    echo "Please run: aws configure"
    echo "Or set environment variables:"
    echo "  export AWS_ACCESS_KEY_ID=..."
    echo "  export AWS_SECRET_ACCESS_KEY=..."
    echo "  export AWS_DEFAULT_REGION=$REGION"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS Account: $ACCOUNT_ID"
echo ""

# Create S3 bucket
echo "📦 Creating S3 bucket..."
if aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
    echo "✅ Bucket already exists: $BUCKET_NAME"
else
    if [ "$REGION" == "us-east-1" ]; then
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$REGION"
    else
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$REGION" \
            --create-bucket-configuration LocationConstraint="$REGION"
    fi
    echo "✅ Created bucket: $BUCKET_NAME"
fi

# Enable versioning
echo "📝 Enabling bucket versioning..."
aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled
echo "✅ Versioning enabled"

# Enable encryption
echo "🔒 Enabling bucket encryption..."
aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            },
            "BucketKeyEnabled": true
        }]
    }'
echo "✅ Encryption enabled"

# Block public access
echo "🛡️  Blocking public access..."
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
        BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
echo "✅ Public access blocked"

# Create DynamoDB table
echo "🗄️  Creating DynamoDB lock table..."
if aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" --region "$REGION" &>/dev/null; then
    echo "✅ Table already exists: $DYNAMODB_TABLE"
else
    aws dynamodb create-table \
        --table-name "$DYNAMODB_TABLE" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
        --region "$REGION" \
        --tags Key=Project,Value=SecureBase Key=ManagedBy,Value=Terraform
    
    echo "⏳ Waiting for table to be active..."
    aws dynamodb wait table-exists --table-name "$DYNAMODB_TABLE" --region "$REGION"
    echo "✅ Table created: $DYNAMODB_TABLE"
fi

echo ""
echo "✅ Backend bootstrap complete!"
echo ""
echo "📋 Next steps:"
echo "  1. cd environments/dev"
echo "  2. terraform init -backend-config=backend.hcl"
echo "  3. terraform plan"
echo "  4. terraform apply"
echo ""
echo "💡 Backend configuration:"
echo "  Bucket: $BUCKET_NAME"
echo "  Table:  $DYNAMODB_TABLE"
echo "  Region: $REGION"
