# Variables for Phase 6.1 Audit Logging Module

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be one of: dev, staging, production"
  }
}

variable "project_name" {
  description = "Project name prefix for all resource names"
  type        = string
  default     = "securebase"
}

variable "evidence_bucket_name" {
  description = "Name of the S3 bucket for compliance evidence (must be globally unique)"
  type        = string
}

variable "audit_source_bucket_name" {
  description = "Name of the S3 bucket containing raw audit log objects (read-only access)"
  type        = string
  default     = ""
}

variable "object_lock_retention_days" {
  description = "Number of days to retain evidence packages under Object Lock COMPLIANCE mode (default: 2555 = 7 years)"
  type        = number
  default     = 2555

  validation {
    condition     = var.object_lock_retention_days >= 365
    error_message = "Retention must be at least 365 days to meet minimum compliance requirements."
  }
}

variable "macie_already_enabled" {
  description = "Set to true if AWS Macie is already enabled in this account by another module (prevents duplicate resource error)"
  type        = bool
  default     = false
}

variable "enable_macie_scan" {
  description = "Whether to create a Macie classification job for the evidence bucket"
  type        = bool
  default     = true
}

variable "macie_alert_email" {
  description = "Email address to receive Macie PII findings alerts (leave empty to skip email subscription)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    ManagedBy           = "terraform"
    ComplianceFramework = "SOC2,HIPAA,FedRAMP"
    DataClassification  = "compliance-evidence"
  }
}
