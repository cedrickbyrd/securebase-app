# Lambda Functions Module Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "lambda_packages" {
  description = "Map of Lambda function names to ZIP package paths"
  type        = map(string)
}

variable "jwt_secret_arn" {
  description = "ARN of JWT secret in Secrets Manager"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Name of DynamoDB table for auth"
  type        = string
}

variable "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint for database connections"
  type        = string
}

variable "database_name" {
  description = "Name of RDS database"
  type        = string
  default     = "securebase"
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for Lambda VPC configuration"
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Security group ID for Lambda functions"
  type        = string
}
