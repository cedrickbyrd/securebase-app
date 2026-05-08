variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "target_region" {
  description = "Standby deployment region for this environment"
  type        = string
  default     = "us-west-2"
}

variable "source_region" {
  description = "Primary source region used for cross-region DR resources"
  type        = string
  default     = "us-east-1"
}

variable "aurora_cluster_id" {
  description = "Aurora cluster ID associated with DR orchestration"
  type        = string
  default     = "securebase-prod-cluster"
}

variable "aurora_engine_version" {
  description = "Aurora engine version used by the multi-region module"
  type        = string
  default     = "8.0.mysql_aurora.3.04.0"
}

variable "dynamodb_table_names" {
  description = "DynamoDB tables to include in global table replication"
  type        = list(string)
  default = [
    "securebase-users",
    "securebase-cache-prod",
    "securebase-prod-notifications",
    "securebase-prod-support-tickets",
    "securebase-prod-reports",
    "securebase-prod-metrics",
  ]
}

variable "route53_hosted_zone_id" {
  description = "Route 53 hosted zone ID for API failover records"
  type        = string
  default     = ""
}

variable "primary_api_endpoint" {
  description = "Primary API endpoint used by Route 53 health checks"
  type        = string
  default     = "api.securebase.tximhotep.com"
}

variable "secondary_api_endpoint" {
  description = "Secondary API endpoint for failover records"
  type        = string
  default     = ""
}

variable "api_gateway_id" {
  description = "API Gateway ID for alarm and logging resources"
  type        = string
  default     = ""
}

variable "alert_email" {
  description = "Fallback email destination for alerts"
  type        = string
  default     = ""
}

variable "sre_metrics_lambda_zip_path" {
  description = "Path to the sre_metrics Lambda deployment zip"
  type        = string
  default     = "../../../phase2-backend/deploy/sre_metrics.zip"
}

variable "sre_metrics_cors_origin" {
  description = "CORS allowed origin for SRE metrics endpoints"
  type        = string
  default     = "https://securebase.tximhotep.com"
}

variable "pagerduty_routing_key" {
  description = "PagerDuty integration routing key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oncall_email" {
  description = "On-call email address for alert subscription"
  type        = string
  default     = ""
}

variable "lambda_concurrency_threshold" {
  description = "Threshold for account Lambda concurrency alarm"
  type        = number
  default     = 800
}

variable "api_usage_spike_threshold" {
  description = "Threshold for API usage spike alarm"
  type        = number
  default     = 100000
}

variable "anomaly_threshold_percent" {
  description = "Minimum percentage for cost anomaly alerting"
  type        = number
  default     = 20
}

variable "s3_cost_tiering_buckets" {
  description = "S3 buckets to place on intelligent tiering policies"
  type        = set(string)
  default     = []
}

variable "tags" {
  description = "Common tags for all resources in this environment"
  type        = map(string)
  default = {
    Project             = "SecureBase"
    ManagedBy           = "Terraform"
    Environment         = "prod-us-west-2"
    ComplianceFramework = "SOC2,FedRAMP,HIPAA"
    DataClassification  = "sensitive"
  }
}
