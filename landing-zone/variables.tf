variable "org_name" {
  type = string
}

variable "target_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type = string
}

variable "tags" {
  type = map(string)
  default = {
    Project   = "SecureBase"
    ManagedBy = "Terraform"
  }
}

variable "accounts" {
  type        = map(object({
    email = string
    ou_id = string
  }))
  description = "Map of AWS accounts for the organization"
  default     = {}
}

variable "allowed_regions" {
  type        = list(string)
  description = "List of regions permitted for deployment"
  default     = ["us-east-1"]
}

# --- Multi-Tenant & Phase 2/3 Core ---
variable "clients" {
  description = "Map of customer tenant definitions for multi-tenant account provisioning"
  type = map(object({
    tier          = string
    prefix        = string
    framework     = string
    email         = optional(string)
    contact_email = optional(string)
    account_id    = optional(string)  # AWS auto-assigns if not provided
    tags          = optional(map(string), {})
    guardrails    = optional(object({
      restrict_regions = optional(list(string), ["us-east-1"])
      enforce_vpce     = optional(bool, false)
      mfa_required     = optional(bool, true)
      retention_days   = optional(number, 365)
    }), {})
  }))
  default = {}
}

variable "default_vpc_id" {
  type    = string
  default = null
}

variable "database_subnets" {
  type    = list(string)
  default = null
}

variable "lambda_subnets" {
  type    = list(string)
  default = null
}

variable "max_aurora_capacity" {
  type    = number
  default = 4
}

variable "min_aurora_capacity" {
  type    = number
  default = 0.5
}

variable "rds_backup_retention" {
  type    = number
  default = 35
}

# --- Netlify & Stripe (Critical) ---
variable "netlify_api_token" {
  type      = string
  sensitive = true
}

variable "stripe_public_key" {
  type      = string
  sensitive = true
}

variable "stripe_secret_key" {
  type      = string
  sensitive = true
}

variable "lambda_packages" {
  type = map(string)
}

# --- Phase 5 Observability (New) ---
variable "enable_observability" {
  type    = bool
  default = true
}

variable "sso_instance_arn" {
  description = "The ARN of the IAM Identity Center instance"
  type        = string
  default     = "arn:aws:sso:::instance/ssoins-7223295e77f4f12d"
}

# --- Demo Auth ---
variable "demo_auth_jwt_secret" {
  description = "JWT signing secret for the demo-auth Lambda. Pass via TF_VAR_demo_auth_jwt_secret or Secrets Manager reference."
  type        = string
  sensitive   = true
}

variable "demo_auth_email" {
  description = "Demo login email accepted by the demo-auth Lambda"
  type        = string
  default     = "demo@securebase.tximhotep.com"
}

variable "demo_auth_password" {
  description = "Demo login password accepted by the demo-auth Lambda"
  type        = string
  sensitive   = true
}

# --- Phase 5.3 SRE API Wiring ---
variable "sre_metrics_lambda_invoke_arn" {
  description = "Invoke ARN of the SRE metrics Lambda used to enable /sre/* API routes"
  type        = string
  default     = null
}

variable "sre_metrics_lambda_name" {
  description = "Name of the SRE metrics Lambda used for API Gateway invoke permissions"
  type        = string
  default     = null
}

# --- Phase 6 Track 5 Lambda Scaling ---
variable "tenant_metrics_function_version" {
  description = "Published version for securebase-<env>-tenant-metrics used by provisioned concurrency alias"
  type        = string
  default     = "1"
}

variable "evidence_collector_function_version" {
  description = "Published version for securebase-<env>-evidence-collector used by provisioned concurrency alias"
  type        = string
  default     = "1"
}

variable "lambda_scaling_alarm_actions" {
  description = "SNS alarm action ARNs for lambda-scaling cold start and concurrency alarms"
  type        = list(string)
  default     = []
}
