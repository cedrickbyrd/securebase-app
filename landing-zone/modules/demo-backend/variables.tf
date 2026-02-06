variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "securebase"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "demo"
}

variable "jwt_secret" {
  description = "JWT secret for token signing (change in production)"
  type        = string
  default     = "demo-secret-change-in-production-2026"
  sensitive   = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB tables"
  type        = bool
  default     = false
}

variable "auto_populate_data" {
  description = "Automatically populate DynamoDB tables with demo data"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
