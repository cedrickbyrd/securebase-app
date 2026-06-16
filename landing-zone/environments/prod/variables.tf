variable "target_region" {
  description = "Primary AWS region for production"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment identifier"
  type        = string
  default     = "production"
}

variable "alert_topic_name" {
  description = "Existing SNS alert topic name used for production alarms"
  type        = string
  default     = "securebase-prod-analytics-alerts"
}

variable "alert_email" {
  description = "Email address for Macie and compliance alerts"
  type        = string
  default     = ""
}

variable "audit_log_bucket_name" {
  description = "S3 bucket containing raw audit logs (source for evidence packager)"
  type        = string
  default     = "securebase-audit-logs-prod"
}

variable "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint for Phase 6 Lambda VPC database access"
  type        = string
  default     = "securebase-phase2-proxy-dev.proxy-coti40osot2c.us-east-1.rds.amazonaws.com"
}

variable "lambda_private_subnet_ids" {
  description = "Private subnet IDs for Phase 6 Lambda VPC config"
  type        = list(string)
  default     = ["subnet-0783b18ae893a8df9", "subnet-0f3dfdab04381608c"]
}

variable "lambda_security_group_ids" {
  description = "Security group IDs for Phase 6 Lambda VPC config"
  type        = list(string)
  default     = ["sg-0127b93c1653cf90f"]
}

variable "api_gateway_name" {
  description = "Production API Gateway name dimension"
  type        = string
  default     = "securebase-prod-api"
}

variable "api_gateway_stage" {
  description = "Production API Gateway stage name"
  type        = string
  default     = "prod"
}

variable "api_gateway_log_group_name" {
  description = "API Gateway access log group for Contributor Insights"
  type        = string
  default     = "/aws/apigateway/securebase-prod"
}

variable "lambda_function_names" {
  description = "Production Lambda function names monitored by Track 4 anomaly detection"
  type        = list(string)
  default = [
    "securebase-production-auth-v2",
    "securebase-production-phase6-audit-evidence-api",
    "securebase-production-compliance-score-recalculator",
    "securebase-production-onboarding",
  ]
}

variable "lambda_execution_role_names" {
  description = "IAM execution roles to receive CloudWatch Lambda Insights permissions"
  type        = list(string)
  default = [
    "securebase_lambda_exec_role",
    "securebase-production-phase6-lambda",
  ]
}

variable "xray_tenant_filters" {
  description = "X-Ray group filters for tenant-segmented traces"
  type        = map(string)
  default = {
    tenant_api = "http.url CONTAINS \"/tenant/\""
    evidence   = "http.url CONTAINS \"/admin/evidence\""
    onboarding = "service(\"securebase-production-onboarding\") OR http.url CONTAINS \"/onboarding\""
  }
}

variable "alert_sns_arn" {
  description = "SNS topic ARN for cost anomaly and threshold alerts (Track 5)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Common tags for all production resources"
  type        = map(string)
  default = {
    Project     = "SecureBase"
    ManagedBy   = "Terraform"
    Environment = "production"
    Phase       = "6"
  }
}

variable "lambda_packages" {
  description = "Lambda package map used by optional marketplace module"
  type        = map(string)
  default     = {}
}

variable "marketplace_product_code" {
  description = "AWS Marketplace product code for marketplace integration"
  type        = string
  default     = ""
}

variable "marketplace_alerts_sns_topic_arn" {
  description = "SNS topic ARN for marketplace worker alarms"
  type        = string
  default     = ""
}

variable "marketplace_ceo_sns_topic_arn" {
  description = "SNS topic ARN for marketplace lifecycle alerts to leadership"
  type        = string
  default     = ""
}

variable "marketplace_db_host" {
  description = "RDS Proxy endpoint for marketplace lambdas"
  type        = string
  default     = ""
}

variable "marketplace_db_secret_arn" {
  description = "Secrets Manager ARN for marketplace lambdas"
  type        = string
  default     = ""
}

variable "marketplace_lambda_role_arn" {
  description = "IAM role ARN used by marketplace lambdas"
  type        = string
  default     = ""
}

variable "marketplace_private_subnet_ids" {
  description = "Private subnet IDs for marketplace lambdas"
  type        = list(string)
  default     = []
}

variable "marketplace_lambda_security_group_id" {
  description = "Security group ID for marketplace lambdas"
  type        = string
  default     = ""
}

variable "aws_marketplace_sns_topic_arn" {
  description = "AWS Marketplace SNS topic ARN for subscription lifecycle notifications"
  type        = string
  default     = ""
}

variable "marketplace_dlq_kms_key_arn" {
  description = "Optional KMS key ARN for marketplace subscription handler DLQ encryption. Leave empty to use SSE-SQS (AWS-managed). Set to a CMEK ARN to enforce customer-managed encryption."
  type        = string
  default     = ""
}

# ============================================================================
# Phase 6 / DB Migrator — prod secret ARN
# Set via GitHub secret PROD_DB_CREDENTIALS_SECRET_ARN passed as TF_VAR_prod_db_credentials_secret_arn
# ============================================================================
variable "prod_db_credentials_secret_arn" {
  description = "Secrets Manager ARN for prod Aurora credentials — used by db_migrator Lambda IAM policy"
  type        = string
  default     = ""
}
