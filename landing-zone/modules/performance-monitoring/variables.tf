# Performance Monitoring Module Variables

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "securebase"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "api_gateway_name" {
  description = "Name of the API Gateway for monitoring"
  type        = string
}

variable "api_log_group_names" {
  description = "List of CloudWatch log group names for API logs"
  type        = list(string)
  default     = []
}

variable "api_latency_p95_threshold" {
  description = "Threshold for API p95 latency alarm in milliseconds"
  type        = number
  default     = 100
}

variable "alarm_actions" {
  description = "List of ARNs to notify when alarms trigger"
  type        = list(string)
  default     = []
}

variable "create_sns_topic" {
  description = "Create SNS topic for performance alerts"
  type        = bool
  default     = false
}

variable "alert_email" {
  description = "Email address for performance alerts (if create_sns_topic is true)"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
