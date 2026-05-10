# ── multi-region module data sources ────────────────────────────────────────────
# Variables belong in variables.tf only. This file contains data sources.

data "aws_caller_identity" "current" {}

data "aws_region" "primary" {}

data "aws_region" "secondary" {
  provider = aws.secondary
}

data "aws_vpc" "primary" {
  count = var.primary_vpc_id != "" ? 1 : 0
  id    = var.primary_vpc_id
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}
