variable "org_name" {
  description = "The name of the AWS Organization"
  type        = string
}

variable "target_region" {
  description = "The primary region for the management account"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (e.g., prod, security, dev)"
  type        = string
}

variable "accounts" {
  description = "Map of accounts to create. Note: ou_id is usually passed from module outputs."
  type = map(object({
    email = string
    ou_id = string
  }))
  default = {}
}

variable "allowed_regions" {
  description = "List of AWS regions allowed for resource deployment. Used in the RestrictRegions SCP."
  type        = list(string)
  default     = ["us-east-1", "us-west-2"]
}

variable "tags" {
  description = "Common tags for all SecureBase resources"
  type        = map(string)
  default     = {
    Project   = "SecureBase"
    ManagedBy = "Terraform"
  }
}

variable "clients" {
  description = "Map of customer/client configurations for multi-tenant PaaS deployments"
  type = map(object({
    tier         = string              # Customer service tier
    account_id   = string              # AWS account ID (if bringing your own account)
    prefix       = string              # Resource naming prefix
    framework    = string              # Compliance framework (soc2, hipaa, fedramp, cis)
    vpce_id      = optional(string)    # VPC endpoint ID (required for certain tiers)
    audit_bucket = optional(string)    # Custom audit log bucket name
    tags         = optional(map(string)) # Client-specific tags
  }))
  default = {}
  
  validation {
    condition = alltrue([
      for client_key, client_config in var.clients :
      contains(["standard", "healthcare", "fintech", "gov-federal"], client_config.tier)
    ])
    error_message = "All client tiers must be one of: standard, healthcare, fintech, gov-federal"
  }
  
  validation {
    condition = alltrue([
      for client_key, client_config in var.clients :
      contains(["soc2", "hipaa", "fedramp", "cis"], client_config.framework)
    ])
    error_message = "All client frameworks must be one of: soc2, hipaa, fedramp, cis"
  }
}

# Phase 4: Analytics Module Variables
variable "reporting_layer_arn" {
  description = "ARN of Lambda layer containing ReportLab and openpyxl for Phase 4 Analytics"
  type        = string
  default     = null
}

