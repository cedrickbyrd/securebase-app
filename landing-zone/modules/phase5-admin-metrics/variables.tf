# Variables for Phase 5 Admin Metrics Module

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "api_gateway_id" {
  description = "ID of the existing API Gateway REST API"
  type        = string
}

variable "api_gateway_root_resource_id" {
  description = "Root resource ID of the existing API Gateway"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "Execution ARN of the API Gateway (for Lambda permissions)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for API Gateway integration"
  type        = string
  default     = "us-east-1"
}

variable "cors_allowed_origin" {
  description = "CORS allowed origin for admin dashboard"
  type        = string
  default     = "https://demo.securebase.tximhotep.com"
}
