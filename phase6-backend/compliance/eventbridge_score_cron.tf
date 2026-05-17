# =============================================================================
# Phase 6.2 — EventBridge Daily Compliance Score Recalculator
#
# Defines the EventBridge scheduled rule that invokes the
# compliance_score_recalculator Lambda at 02:00 UTC every day.
#
# These resources are managed by the landing-zone/modules/phase6-lambda-functions
# Terraform module.  This file documents the intent and can serve as a
# standalone reference; the authoritative Terraform definitions live in:
#   landing-zone/modules/phase6-lambda-functions/main.tf
#
# Schedule:    cron(0 2 * * ? *)  — daily at 02:00 UTC
# Retry:       2 retries, 60 s window (maximum_event_age_in_seconds = 120)
# Targets:     securebase-{environment}-phase6-compliance-score-recalculator
# =============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ── Variables ─────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "lambda_arn" {
  description = "ARN of the compliance_score_recalculator Lambda function"
  type        = string
}

variable "lambda_function_name" {
  description = "Name of the compliance_score_recalculator Lambda function"
  type        = string
}

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}

# ── EventBridge Rule ─────────────────────────────────────────────────────────

resource "aws_cloudwatch_event_rule" "score_recalculator_daily" {
  name                = "securebase-${var.environment}-phase6-score-recalculator-daily"
  description         = "Phase 6.2: trigger compliance_score_recalculator Lambda daily at 02:00 UTC"
  schedule_expression = "cron(0 2 * * ? *)"

  tags = merge(var.tags, {
    Phase = "6.2"
    Name  = "securebase-${var.environment}-phase6-score-recalculator-daily"
  })
}

# ── EventBridge Target ───────────────────────────────────────────────────────

resource "aws_cloudwatch_event_target" "score_recalculator_daily" {
  rule      = aws_cloudwatch_event_rule.score_recalculator_daily.name
  target_id = "phase6-compliance-score-recalculator"
  arn       = var.lambda_arn

  # Retry policy: 2 retries with a 60-second retry window
  retry_policy {
    maximum_event_age_in_seconds = 120
    maximum_retry_attempts       = 2
  }
}

# ── Lambda Permission ────────────────────────────────────────────────────────

resource "aws_lambda_permission" "score_recalculator_eventbridge" {
  statement_id  = "AllowEventBridgePhase6ScoreRecalculator"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.score_recalculator_daily.arn
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "rule_arn" {
  description = "ARN of the daily score-recalculator EventBridge rule"
  value       = aws_cloudwatch_event_rule.score_recalculator_daily.arn
}

output "rule_name" {
  description = "Name of the daily score-recalculator EventBridge rule"
  value       = aws_cloudwatch_event_rule.score_recalculator_daily.name
}
