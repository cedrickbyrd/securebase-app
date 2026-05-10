# ── multi-region module data sources ─────────────────────────────────────────
# NOTE: data "aws_caller_identity" "current" is declared in locals.tf

# ── Additional variable declarations ─────────────────────────────────────────
# These supplement variables.tf without modifying it.

variable "primary_vpc_id" {
  description = "VPC ID in the primary region (optional; used for VPC data lookups)"
  type        = string
  default     = ""
}

variable "audit_log_bucket_name" {
  description = "Name of the primary region audit log S3 bucket (used for replication validation)"
  type        = string
  default     = ""
}

# ── Regional data sources ─────────────────────────────────────────────────────

data "aws_region" "primary" {}

data "aws_region" "secondary" {
  provider = aws.secondary
}

data "aws_vpc" "primary" {
  count = var.primary_vpc_id != "" ? 1 : 0
  id    = var.primary_vpc_id
}

# ── IAM policy documents ──────────────────────────────────────────────────────

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}
