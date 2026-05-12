# ── terraform/modules/aurora-global/variables.tf ──────────────────────────────
# Phase 6 / Track 2 — Sub-task 2.1: Aurora Global Database
# ──────────────────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "primary_region" {
  description = "Primary AWS region (active writer)"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region (standby reader / failover target)"
  type        = string
  default     = "us-west-2"
}

# ── Aurora source cluster ──────────────────────────────────────────────────────

variable "aurora_cluster_id" {
  description = "Identifier of the existing Aurora Serverless v2 cluster in the primary region to promote to a Global Database"
  type        = string
}

variable "aurora_engine_version" {
  description = "Aurora PostgreSQL engine version (must match the source cluster)"
  type        = string
  default     = "15.15"
}

variable "aurora_instance_class" {
  description = "DB instance class for the secondary region reader instance"
  type        = string
  default     = "db.r6g.large"
}

# ── Secondary region networking ────────────────────────────────────────────────

variable "secondary_vpc_id" {
  description = "VPC ID in the secondary region for the Aurora reader cluster"
  type        = string
  default     = ""
}

variable "secondary_vpc_cidr" {
  description = "CIDR block of the secondary region VPC (used for Aurora SG ingress)"
  type        = string
  default     = "10.1.0.0/16"
}

variable "secondary_subnet_ids" {
  description = "Subnet IDs in the secondary region to place the Aurora reader cluster"
  type        = list(string)
  default     = []
}

# ── Alerting ───────────────────────────────────────────────────────────────────

variable "alert_sns_arn" {
  description = "SNS topic ARN to receive replication lag and failover alerts"
  type        = string
  default     = ""
}

variable "replication_lag_threshold_ms" {
  description = "CloudWatch alarm threshold for Aurora Global replication lag in milliseconds (default 1000 = 1 second)"
  type        = number
  default     = 1000
}

# ── Failover Lambda ────────────────────────────────────────────────────────────

variable "failover_lambda_arn" {
  description = "ARN of the failover orchestrator Lambda to invoke when the replication lag alarm fires (leave empty to disable auto-trigger)"
  type        = string
  default     = ""
}

# ── Tags ───────────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Additional tags to apply to all resources (merged with module defaults)"
  type        = map(string)
  default     = {}
}
