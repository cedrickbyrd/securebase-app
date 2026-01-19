variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for Lambda function"
  type        = string
}

variable "lambda_subnet_ids" {
  description = "Subnet IDs for Lambda function"
  type        = list(string)
}

variable "webhook_secret_key" {
  description = "Secret key for webhook HMAC signatures"
  type        = string
  sensitive   = true
}

variable "api_gateway_id" {
  description = "API Gateway REST API ID"
  type        = string
}

variable "api_gateway_root_resource_id" {
  description = "API Gateway root resource ID"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "API Gateway execution ARN"
  type        = string
}

variable "api_gateway_authorizer_id" {
  description = "API Gateway authorizer ID"
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
