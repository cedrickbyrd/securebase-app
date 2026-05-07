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

variable "aurora_cluster_id" {
  description = "Aurora cluster identifier for DB alarms"
  type        = string
  default     = ""
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
