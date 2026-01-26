variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ID for SNS topic encryption"
  type        = string
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

variable "ses_from_email" {
  description = "Email address to send notifications from"
  type        = string
  default     = "notifications@securebase.io"
}
