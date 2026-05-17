variable "target_region" {
  description = "AWS region for production resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "alert_sns_arn" {
  description = "SNS topic ARN for cost anomaly and threshold alerts"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Common tags for all production resources"
  type        = map(string)
  default = {
    Project     = "SecureBase"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}
