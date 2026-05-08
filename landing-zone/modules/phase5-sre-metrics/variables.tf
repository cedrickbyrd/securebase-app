# Variables for Phase 5.3 SRE Metrics Module

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "lambda_zip_path" {
  description = "Absolute or module-relative path to the sre_metrics Lambda deployment zip"
  type        = string
  default     = "../../../phase2-backend/deploy/sre_metrics.zip"
}

variable "cors_origin" {
  description = "CORS allowed origin for the SRE dashboard"
  type        = string
  default     = "https://securebase.tximhotep.com"
}

variable "alert_email" {
  description = "Email address for SRE alert SNS topic subscriptions (optional)"
  type        = string
  default     = null
}

variable "encryption_at_rest" {
  description = "Enable server-side encryption for DynamoDB table"
  type        = bool
  default     = true
}
