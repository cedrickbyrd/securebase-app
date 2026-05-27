variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "lambda_packages" {
  description = "Map of lambda package zip paths"
  type        = map(string)

  validation {
    condition = alltrue([
      for k in [
        "marketplace_resolve_customer",
        "marketplace_subscription_handler",
        "marketplace_metering_worker"
      ] : can(regex("^s3://[^/]+/.+", lookup(var.lambda_packages, k, "")))
    ])
    error_message = "marketplace lambda_packages entries must be set to s3://bucket/key URIs for marketplace_resolve_customer, marketplace_subscription_handler, and marketplace_metering_worker."
  }
}

variable "lambda_role_arn" {
  description = "IAM role ARN used by marketplace lambdas"
  type        = string
}

variable "db_host" {
  description = "RDS Proxy host"
  type        = string
}

variable "db_secret_arn" {
  description = "Secrets Manager ARN for DB credentials"
  type        = string
}

variable "onboarding_function_name" {
  description = "Name of the onboarding Lambda function"
  type        = string
  default     = ""
}

variable "jwt_secret_name" {
  description = "Secrets Manager secret name for JWT signing"
  type        = string
  default     = "securebase-jwt-production"
}

variable "alerts_sns_topic_arn" {
  description = "SNS topic ARN for operational alerts"
  type        = string
  default     = ""
}

variable "ceo_sns_topic_arn" {
  description = "SNS topic ARN for CEO marketplace alerts"
  type        = string
  default     = ""
}

variable "marketplace_product_code" {
  description = "AWS Marketplace product code"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Lambda VPC config"
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Lambda security group ID"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
