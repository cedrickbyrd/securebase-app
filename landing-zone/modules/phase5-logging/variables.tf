variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for the log groups"
  type        = string
  default     = "us-east-1"
}

variable "lambda_function_names" {
  description = "List of Lambda function names to create dedicated log groups for"
  type        = list(string)
}

variable "api_gateway_id" {
  description = "REST API Gateway ID (used to name the access-log group)"
  type        = string
  default     = ""
}

variable "kms_key_deletion_days" {
  description = "Pending-deletion window for the logs KMS key (days)"
  type        = number
  default     = 7
}

variable "xray_sampling_rate" {
  description = "X-Ray fixed-rate sampling (0.0–1.0). Default 1 %."
  type        = number
  default     = 0.01
}

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default     = {}
}
