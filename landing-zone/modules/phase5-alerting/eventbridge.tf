# ── CloudWatch anomaly detector (Lambda errors, account-wide) ─────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_errors_anomaly" {
  alarm_name          = "securebase-${var.environment}-lambda-errors-anomaly"
  alarm_description   = "Account-wide Lambda Errors metric exceeded anomaly detection band"
  comparison_operator = "GreaterThanUpperThreshold"
  evaluation_periods  = 2
  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"

  metric_query {
    id = "m1"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id          = "ad1"
    expression  = "ANOMALY_DETECTION_BAND(m1, 2)"
    label       = "LambdaErrorsAnomalyBand"
    return_data = true
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# ── EventBridge rules ──────────────────────────────────────────────────────────

resource "aws_cloudwatch_event_rule" "high_error_rate" {
  name        = "securebase-${var.environment}-high-error-rate"
  description = "Fires when Lambda error rate anomaly is detected"
  event_pattern = jsonencode({
    source      = ["aws.cloudwatch"]
    detail-type = ["CloudWatch Alarm State Change"]
    detail = {
      state = { value = ["ALARM"] }
      alarmName = [{ prefix = "securebase-${var.environment}" }]
    }
  })
  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "dr_failover_detected" {
  name        = "securebase-${var.environment}-dr-failover-detected"
  description = "Detects Aurora Global DB failover and route53 health check failures"
  event_pattern = jsonencode({
    source      = ["aws.rds", "aws.route53"]
    detail-type = ["RDS DB Cluster Event", "Route 53 Health Check Status Change"]
    detail = {
      EventCategories = ["failover", "failure"]
    }
  })
  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "high_error_rate_sns" {
  rule      = aws_cloudwatch_event_rule.high_error_rate.name
  target_id = "high-error-rate-sns"
  arn       = aws_sns_topic.alerts.arn
}

resource "aws_cloudwatch_event_target" "dr_failover_sns" {
  rule      = aws_cloudwatch_event_rule.dr_failover_detected.name
  target_id = "dr-failover-sns"
  arn       = aws_sns_topic.alerts.arn
}

# ── SNS policy to allow EventBridge publish ───────────────────────────────────

resource "aws_sns_topic_policy" "allow_eventbridge" {
  arn = aws_sns_topic.alerts.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowEventBridgePublish"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sns:Publish"
      Resource  = aws_sns_topic.alerts.arn
    }]
  })
}
