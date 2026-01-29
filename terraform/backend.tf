# Terraform Backend Configuration
# This file configures remote state storage in S3 with DynamoDB locking
# 
# SETUP INSTRUCTIONS:
# 1. Ensure the S3 bucket and DynamoDB table are created (see bootstrap-backend.sh)
# 2. Set AWS_REGION secret in GitHub repository settings
#
# Required GitHub Secrets:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY  
# - AWS_REGION (or use default us-east-1)

terraform {
  backend "s3" {
    # S3 bucket for remote state storage (created by bootstrap-backend.sh)
    bucket = "securebase-terraform-state-dev"
    
    # State file key - change per workspace/environment
    key = "securebase-workspace/terraform.tfstate"
    
    # AWS region for backend resources
    region = "us-east-1"
    
    # DynamoDB table used for state locking (must already exist)
    dynamodb_table = "securebase-terraform-locks"
    
    # Enable encryption at rest
    encrypt = true
    
    # Optional: Enable versioning for state file history
    # versioning = true
  }
}
