variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "securebase"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "alert_email" {
  description = "Email address for performance alerts (used to subscribe to SNS topic)"
  type        = string
  default     = "devops@securebase.com"
}

variable "enable_auto_scaling" {
  description = "Enable DynamoDB auto-scaling (currently always enabled; reserved for future use)"
  type        = bool
  default     = true
}

variable "enable_performance_monitoring" {
  description = "Enable detailed CloudWatch monitoring and alarm notifications"
  type        = bool
  default     = true
}

variable "performance_alerts_topic_arn" {
  description = "ARN of SNS topic for performance alerts (optional; if not provided, uses the topic created by this module)"
  type        = string
  default     = ""
}
