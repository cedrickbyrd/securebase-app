variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "alarm_actions" {
  description = "SNS topics for CloudWatch alarms"
  type        = list(string)
  default     = []
}

variable "non_critical_functions" {
  description = "Lambda functions treated as non-critical; alarms fire above 50 concurrency"
  type        = list(string)
  default     = []
}

variable "high_traffic_functions" {
  description = "High-traffic Lambda functions with provisioned concurrency tuning"
  type = map(object({
    function_name       = string
    function_version    = string
    alias               = string
    provisioned_min     = number
    provisioned_max     = number
    target_utilization  = number
  }))
  default = {}
}
