variable "log_retention_days" {
  description = "Number of days to retain logs in CloudWatch and S3"
  type        = number
  default     = 365
}
variable "environment" {
  description = "Environment name (e.g. dev, prod)"
  type        = string
}
