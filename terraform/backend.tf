# Terraform Backend Configuration Template
# This file configures remote state storage in S3 with DynamoDB locking
# 
# SETUP INSTRUCTIONS:
# 1. Replace placeholder values with your actual S3 bucket and DynamoDB table
# 2. Ensure the S3 bucket and DynamoDB table are created (see bootstrap-backend.sh)
# 3. Set AWS_REGION secret in GitHub repository settings
#
# Required GitHub Secrets:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY  
# - AWS_REGION (or use default us-east-1)

terraform {
  backend "s3" {
    # TODO: Replace with your bootstrap S3 bucket name
    bucket = "REPLACE_WITH_YOUR_BUCKET_NAME"
    
    # State file key - change per workspace/environment
    key = "securebase-workspace/terraform.tfstate"
    
    # TODO: Replace with your AWS region
    region = "us-east-1"
    
    # TODO: Replace with your DynamoDB table name for state locking
    dynamodb_table = "REPLACE_WITH_YOUR_DYNAMODB_TABLE"
    
    # Enable encryption at rest
    encrypt = true
    
    # Optional: Enable versioning for state file history
    # versioning = true
  }
}
