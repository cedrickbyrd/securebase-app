# DEPRECATED: As of Phase 5.3, this module is deprecated.
# Use landing-zone/modules/phase5-logging for all new environments.
#
variable "log_retention_days" {
  description = "Number of days to retain logs in CloudWatch and S3"
  type        = number
  default     = 365
}
variable "environment" {
  description = "Environment name (e.g. dev, prod)"
  type        = string
}
