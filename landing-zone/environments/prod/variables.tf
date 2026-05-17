variable "target_region" {
  description = "Primary AWS region for production"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment identifier"
  type        = string
  default     = "prod"
}

variable "alert_topic_name" {
  description = "Existing SNS alert topic name used for production alarms"
  type        = string
  default     = "securebase-prod-alerts"
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

# Track 5 — used by module "phase6_cost"
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
    Environment = "prod"
    Phase       = "6"
    tenant_id   = "multi-tenant"
  }
}

