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
