# Phase 6.2 — Compliance Visibility CloudWatch Alarms
#
# Adds two operational alarms for the SecureBase ops team:
#   1. securebase-compliance-score-drop
#      Fires when the compliance_score_recalculator Lambda publishes a
#      ComplianceScoreDrop metric (score fell > 10 points in 24 hours).
#
#   2. securebase-compliance-cron-missed
#      Fires when the daily compliance score recalculator Lambda has zero
#      invocations in the 1-hour window following its 02:00 UTC schedule.
#
# Both alarms route to the existing Phase 5.5 SNS alert topic
# (var.sns_topic_arn = module.phase5_alerting.sns_topic_arn).
#
# Usage (from landing-zone/environments/<env>/main.tf):
#
#   module "phase6_compliance_alarms" {
#     source                          = "../../modules/phase6-compliance-alarms"
#     environment                     = var.environment
#     sns_topic_arn                   = module.phase5_alerting.sns_topic_arn
#     score_recalculator_function_name = "securebase-${var.environment}-phase6-compliance-score-recalculator"
#     tags                            = local.common_tags
#   }

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  common_tags = merge(var.tags, {
    Phase = "6.2"
  })
}

# ── Alarm 1: compliance score drop > 10 points in 24 hours ──────────────────
#
# The compliance_score_recalculator Lambda publishes a custom CloudWatch metric
# (ComplianceScoreDrop in the SecureBase/Compliance namespace) whenever any
# tenant's score drops more than 10 points compared to the previous day's
# snapshot.  This alarm fires on ≥ 1 occurrence in any 5-minute evaluation
# period and routes to the existing SNS alert topic.
#
# Alarm name matches the issue spec: "securebase-compliance-score-drop"

resource "aws_cloudwatch_metric_alarm" "compliance_score_drop" {
  alarm_name          = "securebase-compliance-score-drop"
  alarm_description   = "A tenant compliance score dropped more than 10 points in 24 hours"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ComplianceScoreDrop"
  namespace           = "SecureBase/Compliance"
  period              = 300 # 5-minute evaluation window
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = merge(local.common_tags, { Severity = "high", AlarmCategory = "compliance" })
}

# ── Alarm 2: daily cron missed — recalculator did not run by 03:00 UTC ───────
#
# The compliance_score_recalculator is scheduled at 02:00 UTC daily.
# This alarm monitors the AWS/Lambda Invocations metric for the function.
# If the invocation count is 0 in the 1-hour window starting at 02:00 UTC,
# the alarm fires, indicating the cron job did not run as expected.
#
# Alarm name matches the issue spec: "securebase-compliance-cron-missed"

resource "aws_cloudwatch_metric_alarm" "compliance_cron_missed" {
  alarm_name          = "securebase-compliance-cron-missed"
  alarm_description   = "Compliance score recalculator did not run within 1 hour of scheduled time"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Invocations"
  namespace           = "AWS/Lambda"
  period              = 3600 # 1-hour window
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "breaching" # No data = no invocation = alarm fires

  dimensions = {
    FunctionName = var.score_recalculator_function_name
  }

  alarm_actions = [var.sns_topic_arn]

  tags = merge(local.common_tags, { Severity = "high", AlarmCategory = "compliance" })
}
