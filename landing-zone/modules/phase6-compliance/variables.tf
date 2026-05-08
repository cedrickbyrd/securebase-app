# Variables for Phase 6.2 Compliance Automation Module

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

variable "config_delivery_bucket_name" {
  description = "Name of the S3 bucket for AWS Config delivery channel (snapshots and history files)"
  type        = string
  default     = ""
}

variable "config_recorder_already_enabled" {
  description = "Set to true if an AWS Config recorder is already enabled in this account (e.g., by phase1 security module). Prevents duplicate recorder resource errors."
  type        = bool
  default     = false
}

variable "enable_hipaa_conformance_pack" {
  description = "Whether to deploy the HIPAA conformance pack"
  type        = bool
  default     = true
}

variable "enable_nist_conformance_pack" {
  description = "Whether to deploy the NIST 800-53 conformance pack"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    ManagedBy           = "terraform"
    ComplianceFramework = "SOC2,HIPAA,FedRAMP,CIS"
  }
}
