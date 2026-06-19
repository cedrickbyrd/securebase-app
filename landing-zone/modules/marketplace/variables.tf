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

variable "vpc_id" {
  description = "VPC ID housing the marketplace Lambdas — used to attach interface VPC endpoints for the AWS Marketplace Entitlement and Metering Service APIs. Without these endpoints, GetEntitlements/BatchMeterUsage calls from inside the VPC have no route to the public AWS Marketplace API and will time out."
  type        = string
}

variable "create_marketplace_vpc_endpoints" {
  description = "Whether to create the aws-marketplace-entitlement and aws-marketplace-metering interface VPC endpoints. Set false only if equivalent endpoints already exist elsewhere in the VPC (e.g. a shared networking module) — AWS rejects a second interface endpoint for the same service in one VPC."
  type        = bool
  default     = true
}

variable "aws_marketplace_sns_topic_arn" {
  description = "AWS Marketplace subscription notification SNS topic ARN (account 287250355862, format: arn:aws:sns:us-east-1:287250355862:aws-mp-subscription-notification-<product_code>). Delivers subscribe-success, unsubscribe-pending, unsubscribe-success events. Cannot be subscribed via Terraform — register the subscription_handler Lambda endpoint via AMMP UI after deploy."
  type        = string
  default     = ""
}

variable "aws_marketplace_entitlement_sns_topic_arn" {
  description = "AWS Marketplace entitlement notification SNS topic ARN (account 287250355862, format: arn:aws:sns:us-east-1:287250355862:aws-mp-entitlement-notification-<product_code>). Delivers entitlement-updated events (tier upgrades/downgrades). Set after confirming subscription notification topic is working."
  type        = string
  default     = ""
}

variable "dlq_kms_key_arn" {
  description = "Optional KMS key ARN for subscription_handler SQS DLQ encryption. Leave empty to use SSE-SQS (AWS-managed, free). Set to a customer-managed KMS key ARN to enforce CMEK encryption."
  type        = string
  default     = ""
}

variable "metering_worker_dlq_kms_key_arn" {
  description = "Optional KMS key ARN for metering_worker SQS DLQ encryption. Leave empty to use SSE-SQS (AWS-managed, free). Set to a customer-managed KMS key ARN to enforce CMEK encryption."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
