variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "target_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "reporting_layer_arn" {
  description = "ARN of Lambda layer containing ReportLab and openpyxl"
  type        = string
  default     = null
}

variable "customers_table_name" {
  description = "Name of DynamoDB customers table"
  type        = string
  default     = "securebase-dev-customers"
}

variable "sns_topic_arn" {
  description = "ARN of SNS topic for notifications"
  type        = string
  default     = null
}

variable "api_gateway_id" {
  description = "ID of API Gateway to integrate with"
  type        = string
  default     = null
}

variable "api_gateway_url" {
  description = "URL of API Gateway"
  type        = string
  default     = null
}

variable "api_gateway_execution_arn" {
  description = "Execution ARN of API Gateway for Lambda permissions"
  type        = string
  default     = null
}

variable "api_authorizer_id" {
  description = "ID of JWT authorizer for API Gateway"
  type        = string
  default     = null
}

