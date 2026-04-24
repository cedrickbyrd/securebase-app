variable "environment" {
<<<<<<< HEAD
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "pagerduty_routing_key" {
  description = "PagerDuty Events API v2 integration routing key (stored in SSM Parameter Store)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oncall_email" {
  description = "On-call engineer email address for SNS email subscription (leave empty to skip)"
=======
  type = string
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "lambda_function_names" {
  description = "Lambda functions to alarm on"
  type        = list(string)
}

variable "api_gateway_id" {
  type    = string
  default = ""
}

variable "api_gateway_stage" {
  type    = string
  default = "prod"
}

variable "aurora_cluster_id" {
  type    = string
  default = ""
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
  description = "Email address for SNS alert subscription (fallback)"
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
  type        = string
  default     = ""
}

<<<<<<< HEAD
variable "lambda_concurrency_threshold" {
  description = "Maximum concurrent Lambda executions before alerting (should be ~80% of account limit)"
  type        = number
  default     = 800
}

variable "api_usage_spike_threshold" {
  description = "Daily API request count threshold for spike detection"
  type        = number
  default     = 100000
=======
variable "lambda_error_threshold" {
  description = "Lambda error count per 5 min to trigger alarm"
  type        = number
  default     = 5
}

variable "api_5xx_threshold_pct" {
  description = "API Gateway 5xx rate (%) to trigger alarm"
  type        = number
  default     = 1
}

variable "api_latency_p99_ms" {
  description = "API Gateway P99 latency threshold in ms"
  type        = number
  default     = 3000
}

variable "tags" {
  type    = map(string)
  default = {}
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
}
