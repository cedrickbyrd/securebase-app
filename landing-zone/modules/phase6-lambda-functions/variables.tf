variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}

variable "audit_evidence_api_zip" {
  description = "Path to the audit_evidence_api Lambda zip package"
  type        = string
}

variable "audit_log_packager_zip" {
  description = "Path to the audit_log_packager Lambda zip package"
  type        = string
  # Default allows terraform validate -backend=false to succeed in CI.
  # Always overridden explicitly in environments/prod/main.tf.
  default = ""
}

variable "audit_packager_role_arn" {
  description = "ARN of the IAM role for audit_log_packager (from phase6-audit-logging module output lambda_role_arn)"
  type        = string
  # Default allows terraform validate -backend=false to succeed in CI.
  # Always overridden explicitly in environments/prod/main.tf.
  default = ""
}

variable "audit_source_bucket_name" {
  description = "S3 bucket containing raw audit log objects (read by packager)"
  type        = string
  # Default allows terraform validate -backend=false to succeed in CI.
  # Always overridden explicitly in environments/prod/main.tf.
  default = ""
}

variable "compliance_history_api_zip" {
  description = "Path to the compliance_history_api Lambda zip package"
  type        = string
}

variable "evidence_bucket_name" {
  description = "Name of the S3 evidence bucket (from phase6-audit-logging module)"
  type        = string
}

variable "evidence_kms_key_arn" {
  description = "ARN of the KMS key used to encrypt evidence objects"
  type        = string
}

variable "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint for Aurora database access"
  type        = string
}

variable "database_name" {
  description = "Aurora database name"
  type        = string
  default     = "securebase"
}

variable "database_user" {
  description = "Aurora application database user"
  type        = string
  default     = "securebase"
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Lambda VPC config"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs for Lambda VPC config"
  type        = list(string)
}

variable "compliance_score_recalculator_zip" {
  description = "Path to the compliance_score_recalculator Lambda zip package"
  type        = string
}

variable "alert_sns_arn" {
  description = "ARN of the SNS topic to receive CloudWatch alarm notifications"
  type        = string
  default     = ""
}

variable "mappings_bucket" {
  description = "S3 bucket name containing compliance framework mapping JSON files (leave empty to use bundled mappings)"
  type        = string
  default     = ""
}

variable "tenant_registry_db_secret_arn" {
  description = <<-EOT
    Secrets Manager ARN holding the tenant-registry (customers) DB credentials.
    Read by the compliance_score_recalculator scheduled fan-out to enumerate
    active tenants. Leave empty to disable the tenant read (platform-only
    scoring). When set, the function is placed in the VPC to reach the database.
  EOT
  type        = string
  default     = ""
}

variable "securebase_external_id" {
  description = <<-EOT
    sts:AssumeRole ExternalId used by the compliance_score_recalculator when
    assuming a customer's cross-account read role. Required for cross-account
    tenant scoring; leave empty for platform-only deployments.
  EOT
  type        = string
  default     = ""
  sensitive   = true
}
