# ── terraform/modules/dynamodb-global/variables.tf ────────────────────────────
# Phase 6 / Track 2 — Sub-task 2.2: DynamoDB Global Tables
# ──────────────────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "primary_region" {
  description = "Primary AWS region where the source DynamoDB tables reside"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region to add Global Table replicas"
  type        = string
  default     = "us-west-2"
}

# ── Table names ────────────────────────────────────────────────────────────────

variable "table_names" {
  description = "List of DynamoDB table names to convert to Global Tables with a replica in the secondary region. Each table must have DynamoDB Streams enabled (NEW_AND_OLD_IMAGES) and use PAY_PER_REQUEST billing."
  type        = list(string)
  default = [
    "securebase-tenants",
    "securebase-controls-state",
    "securebase-tenant-metrics",
  ]
}

# ── KMS ────────────────────────────────────────────────────────────────────────

variable "primary_kms_key_arn" {
  description = "ARN of the customer-managed KMS key used to encrypt the source tables in the primary region. If provided a replica CMK is created in the secondary region. Set to empty string to use AWS-managed keys."
  type        = string
  default     = ""
}

variable "kms_deletion_window_days" {
  description = "Deletion window (days) for the replica KMS key created in the secondary region"
  type        = number
  default     = 7
}

# ── Alerting ───────────────────────────────────────────────────────────────────

variable "alert_sns_arn" {
  description = "SNS topic ARN to receive DynamoDB replication latency alerts (leave empty to disable)"
  type        = string
  default     = ""
}

# ── Tags ───────────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Additional tags to merge with module defaults"
  type        = map(string)
  default     = {}
}
