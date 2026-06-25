variable "org_name" {
  description = "The name of the AWS Organization"
  type        = string
  default     = "securebase-staging"
}

variable "target_region" {
  description = "The primary region for the management account"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (e.g., prod, security, dev)"
  type        = string
  default     = "staging"
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
  default = {
    Project   = "SecureBase"
    ManagedBy = "Terraform"
  }
}

variable "clients" {
  description = "Map of customer/client configurations for multi-tenant PaaS deployments"
  type = map(object({
    tier         = string
    account_id   = string
    prefix       = string
    framework    = string
    vpce_id      = optional(string)
    audit_bucket = optional(string)
    tags         = optional(map(string))
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

variable "vpc_id" {
  description = "VPC ID for db_migrator Lambda"
  type        = string
  default     = ""
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for db_migrator Lambda"
  type        = list(string)
  default     = []
}

# ============================================================================
# Phase 6 / DB Migrator — staging secret ARN
# Set via GitHub secret STAGING_DB_CREDENTIALS_SECRET_ARN
# passed as TF_VAR_staging_db_credentials_secret_arn
# ============================================================================
variable "staging_db_credentials_secret_arn" {
  description = "Secrets Manager ARN for staging Aurora credentials — used by db_migrator Lambda IAM policy"
  type        = string
  default     = ""
}

# ============================================================================
# Root module pass-through variables required by module "securebase"
# ============================================================================
variable "stripe_public_key" {
  description = "The Stripe publishable key for frontend integration."
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_secret_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "netlify_api_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "lambda_packages" {
  type = map(string)
  default = {
    auth_v2                          = "s3://securebase-terraform-state-staging/lambda/auth_v2.zip"
    health_check                     = "s3://securebase-terraform-state-staging/lambda/health_check.zip"
    webhook_manager                  = "s3://securebase-terraform-state-staging/lambda/webhook_manager.zip"
    billing_worker                   = "s3://securebase-terraform-state-staging/lambda/billing_worker.zip"
    support_tickets                  = "s3://securebase-terraform-state-staging/lambda/support_tickets.zip"
    cost_forecasting                 = "s3://securebase-terraform-state-staging/lambda/cost_forecasting.zip"
    submit_lead                      = "s3://securebase-terraform-state-staging/lambda/submit_lead.zip"
    demo_auth                        = "s3://securebase-terraform-state-staging/lambda/demo_auth.zip"
    session_management               = "s3://securebase-terraform-state-staging/lambda/session_management.zip"
    stripe_handler                   = "s3://securebase-terraform-state-staging/lambda/stripe_handler.zip"
    marketplace_resolve_customer     = "s3://securebase-terraform-state-staging/lambda/marketplace_resolve_customer.zip"
    marketplace_subscription_handler = "s3://securebase-terraform-state-staging/lambda/marketplace-entitlement.zip"
    marketplace_metering_worker      = "s3://securebase-terraform-state-staging/lambda/marketplace-metering.zip"
  }
}

variable "demo_auth_jwt_secret" {
  description = "JWT signing secret for the demo-auth Lambda"
  type        = string
  sensitive   = true
  default     = ""
}

variable "demo_auth_password" {
  description = "Demo login password"
  type        = string
  sensitive   = true
  default     = ""
}
