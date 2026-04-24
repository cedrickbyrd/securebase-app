variable "environment" {
<<<<<<< HEAD
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
=======
  description = "Deployment environment (dev, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "lambda_function_names" {
  description = "List of Lambda function names to create log groups for"
  type        = list(string)
}

variable "api_gateway_id" {
  description = "REST API Gateway ID for access log group"
  type        = string
  default     = ""
}

variable "kms_key_deletion_days" {
  description = "Days before KMS key is deleted after scheduling"
  type        = number
  default     = 7
}

variable "xray_sampling_rate" {
  description = "X-Ray trace sampling rate (0.0 to 1.0)"
  type        = number
  default     = 0.01
}

variable "tags" {
  description = "Resource tags"
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
  type        = map(string)
  default     = {}
}
