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
  description = "Email address for performance alerts"
  type        = string
  default     = "devops@securebase.com"
}

variable "enable_auto_scaling" {
  description = "Enable DynamoDB auto-scaling"
  type        = bool
  default     = true
}

variable "enable_performance_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}
