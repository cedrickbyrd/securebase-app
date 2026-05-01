variable "environment" {
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
  type        = string
  default     = ""
}

variable "lambda_concurrency_threshold" {
  description = "Maximum concurrent Lambda executions before alerting (should be ~80% of account limit)"
  type        = number
  default     = 800
}

variable "api_usage_spike_threshold" {
  description = "Daily API request count threshold for spike detection"
  type        = number
  default     = 100000
}
