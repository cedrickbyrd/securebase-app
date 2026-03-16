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
  type    = map(any)
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
