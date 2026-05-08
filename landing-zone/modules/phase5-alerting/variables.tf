variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "lambda_function_names" {
  description = "Lambda functions to create error/throttle alarms for"
  type        = list(string)
}

variable "api_gateway_id" {
  description = "REST API Gateway ID for 5xx/latency alarms"
  type        = string
  default     = ""
}

variable "api_gateway_stage" {
  description = "API Gateway stage name"
  type        = string
  default     = "prod"
}

variable "cloudfront_distribution_id" {
  description = "CloudFront distribution ID used for cache hit-rate alarm; leave empty to disable"
  type        = string
  default     = ""
}

variable "aurora_cluster_id" {
  description = "Aurora cluster identifier for DB alarms"
  type        = string
  default     = ""
}

variable "dynamodb_table_names" {
  description = "DynamoDB table names to create throttle/error alarms for"
  type        = list(string)
  default     = []
}

variable "dynamodb_throttle_threshold" {
  description = "DynamoDB throttled request count to trigger alarm"
  type        = number
  default     = 10
}

variable "elasticache_cluster_id" {
  description = "ElastiCache cluster ID for cache alarms"
  type        = string
  default     = ""
}

variable "cache_eviction_threshold" {
  description = "ElastiCache eviction count threshold"
  type        = number
  default     = 1000
}

variable "cache_max_connections" {
  description = "ElastiCache max connections threshold"
  type        = number
  default     = 500
}

variable "aurora_max_connections" {
  description = "Aurora max connections threshold for alarm"
  type        = number
  default     = 200
}

variable "sns_kms_key_arn" {
  description = "KMS key ARN for SNS topic encryption (from phase5-logging output)"
  type        = string
  default     = ""
}

variable "alert_webhook_ssm_param" {
  description = "SSM parameter path storing the PagerDuty/Opsgenie webhook URL"
  type        = string
  default     = "/securebase/alerts/webhook_url"
}

variable "alert_webhook_kms_key_arn" {
  description = "KMS key ARN used to encrypt the alert webhook SSM parameter"
  type        = string
  default     = ""
}

variable "create_webhook_ssm_param" {
  description = "Whether to create the SSM parameter placeholder for the webhook URL"
  type        = bool
  default     = false
}

variable "initial_webhook_url" {
  description = "Initial webhook URL value for SSM param (leave blank to use placeholder)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "maintenance_window_enabled" {
  description = "Enable maintenance-window alert suppression schedule"
  type        = bool
  default     = false
}

variable "maintenance_window_schedule" {
  description = "Cron expression for maintenance window start (EventBridge schedule)"
  type        = string
  default     = "cron(0 2 ? * SUN *)"
}

variable "maintenance_window_end_schedule" {
  description = "Cron expression for maintenance window end (EventBridge schedule)"
  type        = string
  default     = "cron(0 4 ? * SUN *)"
}

variable "alert_email" {
  description = "Email address for SNS alert subscription (fallback/dev)"
  type        = string
  default     = ""
}

# ── Legacy / backward-compat vars (HEAD branch) ───────────────────────────────

variable "pagerduty_routing_key" {
  description = "PagerDuty Events API v2 routing key (passed to alert_router Lambda env)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oncall_email" {
  description = "On-call engineer email for an additional SNS subscription"
  type        = string
  default     = ""
}

variable "lambda_concurrency_threshold" {
  description = "Account-wide concurrent Lambda executions alarm threshold"
  type        = number
  default     = 800
}

variable "api_usage_spike_threshold" {
  description = "Daily API request count for spike-detection alarm"
  type        = number
  default     = 100000
}

# ── Alarm thresholds ──────────────────────────────────────────────────────────

variable "lambda_error_threshold" {
  description = "Lambda error count per 5-min evaluation period to trigger alarm"
  type        = number
  default     = 5
}

variable "api_5xx_threshold_pct" {
  description = "API Gateway 5xx error rate percentage to trigger alarm"
  type        = number
  default     = 1
}

variable "api_latency_p99_ms" {
  description = "API Gateway P99 integration-latency threshold in milliseconds"
  type        = number
  default     = 3000
}

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default     = {}
}
