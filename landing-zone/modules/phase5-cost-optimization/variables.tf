variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "enable_dynamodb_autoscaling" {
  description = "Enable Application Auto Scaling for DynamoDB tables (set false if tables use PAY_PER_REQUEST)"
  type        = bool
  default     = false
}

variable "dynamodb_min_capacity" {
  description = "Minimum DynamoDB read/write capacity units"
  type        = number
  default     = 5
}

variable "dynamodb_max_capacity" {
  description = "Maximum DynamoDB read/write capacity units"
  type        = number
  default     = 100
}

variable "aurora_min_acu" {
  description = "Minimum Aurora Serverless v2 capacity units during business hours"
  type        = number
  default     = 0.5
}

variable "aurora_max_acu" {
  description = "Maximum Aurora Serverless v2 capacity units"
  type        = number
  default     = 4
}

variable "aurora_off_peak_min_acu" {
  description = "Minimum Aurora Serverless v2 capacity units during off-peak hours (nights/weekends)"
  type        = number
  default     = 0
}

variable "high_alert_sns_topic_arn" {
  description = "ARN of the high-severity SNS topic for Cost Anomaly Detection alerts"
  type        = string
  default     = ""
}

variable "cost_anomaly_threshold_usd" {
  description = "Dollar amount above which a cost anomaly alert is triggered"
  type        = number
  default     = 50
}

variable "reports_bucket_exists" {
  description = "Set to true if the securebase-reports-{environment} S3 bucket has been created"
  type        = bool
  default     = false
}
