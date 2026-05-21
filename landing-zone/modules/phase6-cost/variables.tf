variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
}

variable "cost_per_tenant_lambda_zip" {
  description = "Path to the cost_per_tenant Lambda deployment zip"
  type        = string
}

variable "cost_per_tenant_table_name" {
  description = "Name of the DynamoDB table holding per-tenant daily cost records (created by phase5-admin-metrics module)"
  type        = string
  default     = ""
}

variable "alert_sns_arn" {
  description = "SNS topic ARN for cost anomaly and threshold alerts (from phase5-alerting output)"
  type        = string
  default     = ""
}

variable "monthly_cost_alert_threshold_usd" {
  description = "Monthly AWS cost per tenant (USD) that triggers a CloudWatch alarm"
  type        = number
  default     = 50
}

variable "cost_report_retention_days" {
  description = "Number of days to retain monthly cost report objects in S3 before Intelligent-Tiering"
  type        = number
  default     = 365
}

variable "tags" {
  description = "Tags applied to all resources in this module"
  type        = map(string)
  default     = {}
}
