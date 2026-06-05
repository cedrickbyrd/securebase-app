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
      contains(["standard", "healthcare", "fintech", "gov-federal", "sales"], client_config.tier)
    ])
    error_message = "All client tiers must be one of: standard, healthcare, fintech, gov-federal, sales"
  }

  validation {
    condition = alltrue([
      for client_key, client_config in var.clients :
      contains(["soc2", "hipaa", "fedramp", "cis"], client_config.framework)
    ])
    error_message = "All client frameworks must be one of: soc2, hipaa, fedramp, cis"
  }
}

variable "reporting_layer_arn" {
  description = "ARN of Lambda layer containing ReportLab and openpyxl for Phase 4 Analytics"
  type        = string
  default     = null
}

variable "netlify_token" {
  description = "Netlify API token from AWS Secrets Manager or environment variable"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_public_key" {
  description = "The Stripe publishable key for frontend integration."
  type        = string
  sensitive   = true
}

variable "lambda_packages" {
  type = map(string)
}

variable "netlify_api_token" {
  type      = string
  sensitive = true
}

variable "default_vpc_id" {
  type        = string
  description = "The ID of the default VPC for existing resources"
  default     = null
}

variable "lambda_subnets" {
  type        = list(string)
  description = "Subnets used for Lambda execution"
  default     = null
}

variable "database_subnets" {
  type        = list(string)
  description = "Subnets used for database resources"
  default     = null
}

variable "max_aurora_capacity" {
  type        = number
  description = "Maximum Aurora Serverless v2 capacity units"
  default     = 4
}

variable "min_aurora_capacity" {
  type        = number
  description = "Minimum Aurora Serverless v2 capacity units"
  default     = 0.5
}

variable "rds_backup_retention" {
  type        = number
  description = "Number of days to retain RDS backups"
  default     = 35
}

variable "enable_phase2" {
  type        = bool
  description = "Enable Phase 2 database and Lambda infrastructure"
  default     = false
}

variable "enable_vpc" {
  type        = bool
  description = "Enable per-customer VPC creation"
  default     = false
}

variable "stripe_secret_key" {
  type      = string
  sensitive = true
}

# ── Phase 5.3 Variables ─────────────────────────────────────────────────────────────────
variable "aurora_cluster_id" {
  description = "Existing Aurora cluster ID for Phase 5.3 alerting and DR"
  type        = string
  default     = "securebase-dev-cluster"
}

variable "alert_email" {
  description = "Email address for SNS alert fallback subscription"
  type        = string
  default     = ""
}

variable "pagerduty_routing_key" {
  description = "PagerDuty Events API v2 integration routing key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oncall_email" {
  description = "On-call engineer email address for SNS subscriptions"
  type        = string
  default     = ""
}

variable "lambda_concurrency_threshold" {
  description = "Lambda concurrent execution alarm threshold"
  type        = number
  default     = 800
}

variable "api_usage_spike_threshold" {
  description = "Daily API request count for usage-spike alarm"
  type        = number
  default     = 100000
}

variable "aurora_off_peak_min_acu" {
  description = "Minimum Aurora Serverless v2 ACU during off-peak hours"
  type        = number
  default     = 0
}

variable "cost_anomaly_threshold_usd" {
  description = "Dollar amount above which a Cost Anomaly Detection alert fires"
  type        = number
  default     = 50
}

variable "demo_auth_jwt_secret" {
  description = "JWT signing secret for the demo-auth Lambda"
  type        = string
  sensitive   = true
  default     = ""
}

variable "demo_auth_email" {
  description = "Demo login email"
  type        = string
  default     = "demo@securebase.tximhotep.com"
}

variable "demo_auth_password" {
  description = "Demo login password"
  type        = string
  sensitive   = true
  default     = ""
}

# ── Phase 5.4 Multi-Region DR Variables ───────────────────────────────────────────
variable "route53_hosted_zone_id" {
  description = "Route 53 hosted zone ID (disabled — DNS in Netlify)"
  type        = string
  default     = ""
}

variable "primary_api_endpoint" {
  description = "Primary (us-east-1) API Gateway FQDN (no protocol)"
  type        = string
  default     = "9xyetu7zq3.execute-api.us-east-1.amazonaws.com"
}

variable "secondary_api_endpoint" {
  description = "Secondary (us-west-2) API Gateway FQDN"
  type        = string
  default     = ""
}

variable "secondary_api_gateway_id" {
  description = "Secondary region API Gateway ID"
  type        = string
  default     = ""
}

variable "primary_vpc_id" {
  description = "VPC ID in the primary region"
  type        = string
  default     = ""
}

variable "primary_vpc_cidr" {
  description = "CIDR block of the primary region VPC"
  type        = string
  default     = ""
}

variable "dynamodb_table_names" {
  description = "DynamoDB table names to replicate to us-west-2"
  type        = list(string)
  default     = []
}

variable "audit_log_bucket_name" {
  description = "Source S3 bucket name for audit log cross-region replication"
  type        = string
  default     = ""
}

# CloudFront multi-origin failover
variable "acm_certificate_arn" {
  description = "ACM certificate ARN for CloudFront (must be in us-east-1)"
  type        = string
  default     = ""
}

variable "primary_api_fqdn" {
  description = "FQDN of the primary API Gateway custom domain endpoint"
  type        = string
  default     = ""
}

variable "secondary_api_fqdn" {
  description = "FQDN of the secondary region API Gateway"
  type        = string
  default     = ""
}

variable "secondary_health_api_fqdn" {
  description = "FQDN of the secondary /health APIGWv2 endpoint. Serves api.securebase.tximhotep.com/health via CloudFront."
  type        = string
  default     = ""
}

variable "cloudfront_aliases" {
  description = "Custom domain aliases for the CloudFront distribution"
  type        = list(string)
  default     = []
}

variable "s3_cost_tiering_buckets" {
  description = "S3 bucket names to enable Intelligent-Tiering on"
  type        = set(string)
  default     = []
}

variable "sre_metrics_lambda_zip_path" {
  description = "Path to the sre_metrics Lambda deployment zip"
  type        = string
  default     = "../../../phase2-backend/deploy/sre_metrics.zip"
}

variable "marketplace_product_code" {
  description = "AWS Marketplace product code for marketplace integration"
  type        = string
  default     = ""
}

variable "marketplace_alerts_sns_topic_arn" {
  description = "SNS topic ARN for marketplace failure alerts"
  type        = string
  default     = ""
}

variable "marketplace_ceo_sns_topic_arn" {
  description = "SNS topic ARN for marketplace lifecycle alerts to leadership"
  type        = string
  default     = ""
}

variable "marketplace_db_host" {
  description = "RDS Proxy endpoint for marketplace lambdas"
  type        = string
  default     = ""
}

variable "marketplace_db_secret_arn" {
  description = "Secrets Manager ARN for marketplace lambdas database access"
  type        = string
  default     = ""
}

variable "marketplace_lambda_role_arn" {
  description = "IAM role ARN used by marketplace lambdas"
  type        = string
  default     = ""
}

variable "marketplace_lambda_security_group_id" {
  description = "Lambda security group ID for marketplace lambdas"
  type        = string
  default     = ""
}

# ============================================================================
# Phase 6 / DB Migrator — dev secret ARN
# Set via GitHub secret DEV_DB_CREDENTIALS_SECRET_ARN
# passed as TF_VAR_dev_db_credentials_secret_arn
# ============================================================================
variable "dev_db_credentials_secret_arn" {
  description = "Secrets Manager ARN for dev Aurora credentials — used by db_migrator Lambda IAM policy"
  type        = string
  default     = ""
}
