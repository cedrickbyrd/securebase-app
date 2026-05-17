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
