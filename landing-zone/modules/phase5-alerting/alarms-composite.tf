# ── Composite alarms: reduce noise, escalate only when multiple signals fire ──

resource "aws_cloudwatch_composite_alarm" "service_degraded" {
  alarm_name        = "securebase-${var.environment}-SERVICE-DEGRADED"
  alarm_description = "Multiple components failing — likely full service outage"

  alarm_rule = join(" OR ", [
    "ALARM(\"${aws_cloudwatch_metric_alarm.auth_errors_critical.alarm_name}\")",
    "ALARM(\"${aws_cloudwatch_metric_alarm.provisioner_errors.alarm_name}\")",
  ])

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = merge(local.common_tags, { Severity = "critical" })
}

resource "aws_cloudwatch_composite_alarm" "auth_incident" {
  alarm_name        = "securebase-${var.environment}-AUTH-INCIDENT"
  alarm_description = "Auth service failures — users cannot log in"

  alarm_rule = "ALARM(\"${aws_cloudwatch_metric_alarm.auth_errors_critical.alarm_name}\")"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = merge(local.common_tags, { Severity = "critical" })
}
