# Test configuration for Analytics module
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
      Module      = "analytics-test"
    }
  }
}

# Test the analytics module
module "analytics_test" {
  source = "../"

  environment = "test"
  
  tags = {
    Environment = "test"
    Purpose     = "module-validation"
  }
}

# Validate outputs are correctly defined
output "test_reports_table_name" {
  description = "Test output for reports table"
  value       = module.analytics_test.reports_table_name
}

output "test_report_engine_arn" {
  description = "Test output for report engine Lambda"
  value       = module.analytics_test.report_engine_function_arn
}

output "test_reports_bucket_name" {
  description = "Test output for S3 reports bucket"
  value       = module.analytics_test.reports_bucket_name
}
