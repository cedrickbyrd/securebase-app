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

# --- Multi-Tenant/PaaS Configuration ---

variable "clients" {
  description = "Map of customer/client configurations for multi-tenant PaaS deployments"
  type = map(object({
    tier         = string              # Customer service tier
    email        = optional(string)    # Email for new AWS account creation
    prefix       = string              # Resource naming prefix
    framework    = string              # Compliance framework (soc2, hipaa, fedramp, cis)
    vpc_cidr     = optional(string)    # VPC CIDR block (e.g., 10.1.0.0/16)
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

variable "enable_vpc" {
  description = "Enable per-customer VPC provisioning"
  type        = bool
  default     = true
}

variable "vpc_config" {
  description = "VPC configuration for multi-tenant customers (when enable_vpc=true)"
  type = object({
    enable_nat_gateway    = bool          # Enable NAT gateways for egress
    enable_vpn_gateway    = bool          # Enable VPN gateway for hybrid connectivity
    enable_vpc_flow_logs  = bool          # Enable VPC Flow Logs for audit
    dns_hostnames         = bool          # Enable DNS hostnames
    dns_support           = bool          # Enable DNS support
  })
  default = {
    enable_nat_gateway   = true
    enable_vpn_gateway   = false
    enable_vpc_flow_logs = true
    dns_hostnames        = true
    dns_support          = true
  }
}
# --- Phase 2: Database & API Backend Configuration ---

variable "default_vpc_id" {
  description = "Default VPC ID for Phase 2 database resources (optional; auto-created if null)"
  type        = string
  default     = null
}

variable "database_subnets" {
  description = "Subnet IDs for Aurora database placement (must span multiple AZs)"
  type        = list(string)
  default     = null
}

variable "lambda_subnets" {
  description = "Subnet IDs for Lambda function execution"
  type        = list(string)
  default     = null
}

variable "max_aurora_capacity" {
  description = "Maximum Aurora Serverless v2 capacity in ACUs (0.5 to 128)"
  type        = number
  default     = 4
}

variable "min_aurora_capacity" {
  description = "Minimum Aurora Serverless v2 capacity in ACUs (0.5 to 128)"
  type        = number
  default     = 0.5
}

variable "rds_backup_retention" {
  description = "RDS backup retention period in days"
  type        = number
  default     = 35
}

variable "enable_phase2" {
  description = "Enable Phase 2 (Database & API Backend) deployment"
  type        = bool
  default     = true
}