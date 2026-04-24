# ── Per-Lambda alarms: errors, throttles, duration ───────────────────────────
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-errors"
  alarm_description   = "Lambda ${each.value} error rate exceeded threshold"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = var.lambda_error_threshold
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-throttles"
  alarm_description   = "Lambda ${each.value} throttling"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-duration"
  alarm_description   = "Lambda ${each.value} P99 duration high (possible cold starts or DB slowness)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  extended_statistic  = "p99"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  threshold           = 10000
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# ── Critical function: auth failures spike ────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "auth_errors_critical" {
  alarm_name          = "securebase-${var.environment}-auth-errors-critical"
  alarm_description   = "Auth Lambda errors — potential security incident or outage"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 3
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = "securebase-auth-v2" }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = merge(local.common_tags, { Severity = "critical" })
}

# ── Onboarding provisioner: any failure is customer-impacting ─────────────────
resource "aws_cloudwatch_metric_alarm" "provisioner_errors" {
  alarm_name          = "securebase-${var.environment}-provisioner-errors"
  alarm_description   = "Account provisioner failed — customer onboarding blocked"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = "securebase-account-provisioner" }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = merge(local.common_tags, { Severity = "high" })
}
