# API Gateway Module Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for API Gateway deployment"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# ============================================================================
# Lambda Function ARNs and Names
# ============================================================================

variable "auth_lambda_arn" {
  description = "ARN of the authentication Lambda function"
  type        = string
}

variable "auth_lambda_name" {
  description = "Name of the authentication Lambda function"
  type        = string
}

variable "webhook_lambda_arn" {
  description = "ARN of the webhook manager Lambda function"
  type        = string
}

variable "webhook_lambda_name" {
  description = "Name of the webhook manager Lambda function"
  type        = string
}

variable "billing_lambda_arn" {
  description = "ARN of the billing worker Lambda function"
  type        = string
}

variable "billing_lambda_name" {
  description = "Name of the billing worker Lambda function"
  type        = string
}

variable "support_lambda_arn" {
  description = "ARN of the support tickets Lambda function"
  type        = string
}

variable "support_lambda_name" {
  description = "Name of the support tickets Lambda function"
  type        = string
}

variable "forecasting_lambda_arn" {
  description = "ARN of the cost forecasting Lambda function"
  type        = string
}

variable "forecasting_lambda_name" {
  description = "Name of the cost forecasting Lambda function"
  type        = string
}

variable "analytics_lambda_arn" {
  description = "ARN of the analytics/reporting Lambda function"
  type        = string
  default     = null
}

variable "analytics_lambda_name" {
  description = "Name of the analytics/reporting Lambda function"
  type        = string
  default     = null
}

variable "analytics_lambda_invoke_arn" {
  description = "Invoke ARN of the analytics/reporting Lambda function"
  type        = string
  default     = null
}

# RBAC Lambda Functions (Phase 4 Component 2)

variable "user_management_lambda_arn" {
  description = "ARN of the user management Lambda function"
  type        = string
  default     = null
}

variable "user_management_lambda_name" {
  description = "Name of the user management Lambda function"
  type        = string
  default     = null
}

variable "user_management_lambda_invoke_arn" {
  description = "Invoke ARN of the user management Lambda function"
  type        = string
  default     = null
}

variable "session_management_lambda_arn" {
  description = "ARN of the session management Lambda function"
  type        = string
  default     = null
}

variable "session_management_lambda_name" {
  description = "Name of the session management Lambda function"
  type        = string
  default     = null
}

variable "session_management_lambda_invoke_arn" {
  description = "Invoke ARN of the session management Lambda function"
  type        = string
  default     = null
}

variable "permission_management_lambda_arn" {
  description = "ARN of the permission management Lambda function"
  type        = string
  default     = null
}

variable "permission_management_lambda_name" {
  description = "Name of the permission management Lambda function"
  type        = string
  default     = null
}

variable "permission_management_lambda_invoke_arn" {
  description = "Invoke ARN of the permission management Lambda function"
  type        = string
  default     = null
}

# ============================================================================
# Security and Performance Settings
# ============================================================================

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 30
}

variable "default_rate_limit" {
  description = "Default API rate limit (requests per second)"
  type        = number
  default     = 100
}

variable "default_burst_limit" {
  description = "Default API burst limit (concurrent requests)"
  type        = number
  default     = 200
}

variable "error_threshold_4xx" {
  description = "Threshold for 4XX error alarm"
  type        = number
  default     = 100
}

variable "error_threshold_5xx" {
  description = "Threshold for 5XX error alarm"
  type        = number
  default     = 10
}

variable "latency_threshold_ms" {
  description = "Latency threshold in milliseconds for alarm"
  type        = number
  default     = 5000
}

variable "allowed_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = ["https://portal.securebase.com"]
}
