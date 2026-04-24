# ── API Gateway alarms ────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  count = var.api_gateway_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-api-5xx-rate"
  alarm_description   = "API Gateway 5xx error rate above ${var.api_5xx_threshold_pct}%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = var.api_5xx_threshold_pct
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "errors / requests * 100"
    label       = "5xx Error Rate %"
    return_data = true
  }
  metric_query {
    id = "errors"
    metric {
      metric_name = "5XXError"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions  = { ApiName = var.api_gateway_id, Stage = var.api_gateway_stage }
    }
  }
  metric_query {
    id = "requests"
    metric {
      metric_name = "Count"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions  = { ApiName = var.api_gateway_id, Stage = var.api_gateway_stage }
    }
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "api_4xx" {
  count = var.api_gateway_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-api-4xx-rate"
  alarm_description   = "API Gateway 4xx rate above 5% — possible client auth issues"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 5
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "errors / requests * 100"
    label       = "4xx Error Rate %"
    return_data = true
  }
  metric_query {
    id = "errors"
    metric {
      metric_name = "4XXError"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions  = { ApiName = var.api_gateway_id, Stage = var.api_gateway_stage }
    }
  }
  metric_query {
    id = "requests"
    metric {
      metric_name = "Count"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions  = { ApiName = var.api_gateway_id, Stage = var.api_gateway_stage }
    }
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "api_latency_p99" {
  count = var.api_gateway_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-api-latency-p99"
  alarm_description   = "API Gateway P99 latency above ${var.api_latency_p99_ms}ms"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  extended_statistic  = "p99"
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  threshold           = var.api_latency_p99_ms
  treat_missing_data  = "notBreaching"

  dimensions = { ApiName = var.api_gateway_id, Stage = var.api_gateway_stage }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "api_latency_integration" {
  count = var.api_gateway_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-api-integration-latency"
  alarm_description   = "API Gateway integration latency P99 high — backend slowness"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  extended_statistic  = "p99"
  metric_name         = "IntegrationLatency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  threshold           = 2500
  treat_missing_data  = "notBreaching"

  dimensions = { ApiName = var.api_gateway_id, Stage = var.api_gateway_stage }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}
