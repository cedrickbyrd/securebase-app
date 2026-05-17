# Phase 6 Alerting — Evidence Vault CloudWatch Alarms
#
# Adds operational visibility alarms for the audit_log_packager Lambda:
#   1. packager-errors    — fires if any Lambda errors occur in a 1-hour window
#   2. packager-stale     — fires if no packages have been generated in 7 days
#
# Both alarms route to the existing Phase 5 SNS alert topic via var.sns_topic_arn.
#
# Usage:
#   module "phase6_alerting" {
#     source                 = "../../modules/phase6-alerting"
#     environment            = var.environment
#     sns_topic_arn          = module.alerting.sns_topic_arn
#     packager_function_name = "securebase-${var.environment}-audit-log-packager"
#     packager_log_group     = "/aws/lambda/securebase-${var.environment}-audit-log-packager"
#     tags                   = local.common_tags
#   }

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_region" "current" {}

locals {
  common_tags = merge(var.tags, {
    Phase = "6.2"
  })
}

# ── CloudWatch Log Metric Filter: count successful evidence package completions ──
# The audit_log_packager Lambda emits a structured JSON log with
# {"message": "audit_log_packager complete", ...} on each successful run.
# This filter extracts those events into the SecureBase/Evidence custom namespace.

resource "aws_cloudwatch_log_metric_filter" "packager_completions" {
  name           = "securebase-${var.environment}-packager-completions"
  log_group_name = var.packager_log_group
  pattern        = "{ $.message = \"audit_log_packager complete\" }"

  metric_transformation {
    name          = "PackagesGenerated"
    namespace     = "SecureBase/Evidence"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# ── Alarm 1: packager Lambda error rate > 0 in any 1-hour window ─────────────
# Any Lambda error means a customer's evidence package silently failed.
# Zero-tolerance threshold — one error in a 1-hour period triggers the alarm.

resource "aws_cloudwatch_metric_alarm" "packager_errors" {
  alarm_name          = "securebase-${var.environment}-audit-packager-errors"
  alarm_description   = "audit_log_packager Lambda errors in the last 1 hour — evidence packages may be missing or incomplete"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 3600
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.packager_function_name
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = merge(local.common_tags, { Severity = "high" })
}

# ── Alarm 2: no packages generated for any tenant in 7 days ──────────────────
# Uses the PackagesGenerated metric emitted by the log metric filter above.
# treat_missing_data = "breaching" means the alarm fires if the metric stops
# publishing entirely (e.g. the packager Lambda stops running).

resource "aws_cloudwatch_metric_alarm" "packager_stale" {
  alarm_name          = "securebase-${var.environment}-audit-packager-stale"
  alarm_description   = "No evidence packages generated in 7 days — packager Lambda may not be scheduled or is failing silently"
  comparison_operator = "LessThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "PackagesGenerated"
  namespace           = "SecureBase/Evidence"
  period              = 604800 # 7 days in seconds
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "breaching"

  alarm_actions = [var.sns_topic_arn]

  tags = merge(local.common_tags, { Severity = "high" })

  depends_on = [aws_cloudwatch_log_metric_filter.packager_completions]
}

# ── Compliance score recalculator completion metric (daily 02:00 UTC cron) ─────
resource "aws_cloudwatch_log_metric_filter" "score_recalculator_runs" {
  name           = "securebase-${var.environment}-score-recalculator-runs"
  log_group_name = var.score_recalculator_log_group
  pattern        = "{ $.message = \"compliance_score_recalculator complete\" }"

  metric_transformation {
    name          = "DailyRuns"
    namespace     = "SecureBase/Compliance"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# ── Compliance score-drop events (>10 points in 24h) ────────────────────────────
resource "aws_cloudwatch_log_metric_filter" "score_drop_events" {
  name           = "securebase-${var.environment}-score-drop-events"
  log_group_name = var.score_recalculator_log_group
  pattern        = "{ $.message = \"compliance_score_drop_gt_10\" }"

  metric_transformation {
    name          = "ScoreDropGt10"
    namespace     = "SecureBase/Compliance"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "score_drop_gt_10" {
  alarm_name          = "securebase-${var.environment}-compliance-score-drop-gt10"
  alarm_description   = "Compliance score dropped by more than 10 points in the last 24 hours"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ScoreDropGt10"
  namespace           = "SecureBase/Compliance"
  period              = 86400
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = merge(local.common_tags, { Severity = "high" })

  depends_on = [aws_cloudwatch_log_metric_filter.score_drop_events]
}

resource "aws_cloudwatch_metric_alarm" "score_recalculator_stale" {
  alarm_name          = "securebase-${var.environment}-compliance-score-cron-stale"
  alarm_description   = "No compliance score recalculation completion logs detected within 3 hours of the daily schedule window"
  comparison_operator = "LessThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "DailyRuns"
  namespace           = "SecureBase/Compliance"
  period              = 10800
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "breaching"

  alarm_actions = [var.sns_topic_arn]

  tags = merge(local.common_tags, { Severity = "high" })

  depends_on = [aws_cloudwatch_log_metric_filter.score_recalculator_runs]
}
