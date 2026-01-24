# Test configuration for RBAC module
# This file validates the module configuration and outputs

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
  
  # Mock provider for testing - use real credentials for integration tests
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
  
  default_tags {
    tags = {
      Environment = "test"
      ManagedBy   = "terraform"
      Module      = "rbac-test"
    }
  }
}

# Test the RBAC module
module "rbac_test" {
  source = "../"

  environment         = "test"
  database_endpoint   = "test-proxy.region.rds.amazonaws.com"
  database_name       = "securebase_test"
  database_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-db-secret"
  jwt_secret_arn      = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-jwt-secret"
  
  tags = {
    Environment = "test"
    Purpose     = "module-validation"
  }
}

# Validate outputs are correctly defined
output "test_user_sessions_table_name" {
  description = "Test output for user sessions table"
  value       = module.rbac_test.user_sessions_table_name
}

output "test_user_management_arn" {
  description = "Test output for user management Lambda"
  value       = module.rbac_test.user_management_function_arn
}

output "test_activity_feed_table_name" {
  description = "Test output for activity feed table"
  value       = module.rbac_test.activity_feed_table_name
}
