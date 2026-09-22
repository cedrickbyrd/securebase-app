variable "project_id" {
  type        = string
  description = "The GCP Project ID for SecureBase"
  default     = "securebase-gcp-dev"
}

variable "region" {
  type        = string
  description = "Primary GCP Region for resources"
  default     = "us-central1"
}

variable "environment" {
  type        = string
  description = "Environment identifier (dev, staging, prod)"
  default     = "dev"
}

variable "retention_period_seconds" {
  type        = number
  description = "Retention period for compliance evidence (7 years = 220752000s)"
  default     = 220752000
}
