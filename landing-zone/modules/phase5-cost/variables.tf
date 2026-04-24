variable "environment" {
  type = string
}

variable "alert_sns_arn" {
  description = "SNS topic ARN for cost anomaly notifications (from phase5-alerting output)"
  type        = string
  default     = ""
}

variable "anomaly_threshold_percent" {
  description = "Minimum anomaly impact percentage before triggering alert"
  type        = number
  default     = 20
}

variable "s3_bucket_names" {
  description = "Set of S3 bucket names to enable Intelligent-Tiering on"
  type        = set(string)
  default     = []
}

variable "dynamodb_provisioned_tables" {
  description = "Map of DynamoDB table name → autoscaling capacity limits (only for PROVISIONED tables)"
  type = map(object({
    min_read  = number
    max_read  = number
    min_write = number
    max_write = number
  }))
  default = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
