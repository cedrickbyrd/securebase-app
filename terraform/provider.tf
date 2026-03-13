# AWS Provider Configuration Template
# This file configures the AWS provider for Terraform
#
# Authentication is handled via GitHub Actions secrets:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - AWS_REGION

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "SecureBase"
      ManagedBy   = "Terraform"
      Workspace   = "securebase"
      Environment = var.environment
    }
  }
}

# Variables for provider configuration
variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "auth_lambda_arn" {
  description = "ARN of the authentication Lambda function"
  type        = string
}

variable "auth_lambda_name" {
  description = "Name of the authentication Lambda function"
  type        = string
}

variable "rest_api_id" {
  description = "ID of the existing API Gateway REST API (from landing-zone workspace output)"
  type        = string
  default     = "9xyetu7zq3"
}

variable "auth_parent_resource_id" {
  description = "Resource ID of the existing /auth API Gateway resource"
  type        = string
  default     = "7q9sggej19"
}
