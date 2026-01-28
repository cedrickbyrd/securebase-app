# CloudWatch Dashboards and Alarms for Analytics
# Phase 4 - Advanced Analytics Monitoring

# SNS Topic for Alerts
resource "aws_sns_topic" "analytics_alerts" {
  name = "securebase-${var.environment}-analytics-alerts"

  tags = merge(var.tags, {
    Name      = "analytics-alerts"
    Component = "Analytics"
  })
}

# CloudWatch Dashboard for Analytics
resource "aws_cloudwatch_dashboard" "analytics" {
  dashboard_name = "securebase-${var.environment}-analytics"

  dashboard_body = jsonencode({
    widgets = [
      # Lambda Metrics Row
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", { stat = "Sum", label = "Invocations" }],
            [".", "Errors", { stat = "Sum", label = "Errors" }],
            [".", "Throttles", { stat = "Sum", label = "Throttles" }],
            [".", "Duration", { stat = "Average", label = "Avg Duration" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.target_region
          title   = "Lambda Function Health"
          period  = 300
        }
        width  = 12
        height = 6
        x      = 0
        y      = 0
      },
      # DynamoDB Metrics Row
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", { stat = "Sum" }],
            [".", "ConsumedWriteCapacityUnits", { stat = "Sum" }],
            [".", "UserErrors", { stat = "Sum" }],
            [".", "SystemErrors", { stat = "Sum" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.target_region
          title   = "DynamoDB Usage"
          period  = 300
        }
        width  = 12
        height = 6
        x      = 12
        y      = 0
      },
      # API Gateway Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", { stat = "Sum", label = "Requests" }],
            [".", "4XXError", { stat = "Sum", label = "Client Errors" }],
            [".", "5XXError", { stat = "Sum", label = "Server Errors" }],
            [".", "Latency", { stat = "Average", label = "Latency" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.target_region
          title   = "API Gateway Analytics"
          period  = 300
        }
        width  = 12
        height = 6
        x      = 0
        y      = 6
      },
      # S3 Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/S3", "NumberOfObjects", { stat = "Average", label = "Objects" }],
            [".", "BucketSizeBytes", { stat = "Average", label = "Size (Bytes)" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.target_region
          title   = "S3 Report Storage"
          period  = 3600
        }
        width  = 12
        height = 6
        x      = 12
        y      = 6
      }
    ]
  })
}

# Alarm: Lambda Function Errors
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "securebase-${var.environment}-analytics-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 3600 # 1 hour
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Analytics Lambda function error rate exceeded 5/hour"
  alarm_actions       = [aws_sns_topic.analytics_alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.report_engine.function_name
  }

  tags = merge(var.tags, {
    Name      = "analytics-lambda-errors"
    Component = "Analytics"
    Severity  = "High"
  })
}

# Alarm: Lambda Function Duration (Latency)
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  alarm_name          = "securebase-${var.environment}-analytics-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300 # 5 minutes
  statistic           = "Average"
  threshold           = 1000 # 1 second in milliseconds
  alarm_description   = "Analytics query latency exceeded 1 second"
  alarm_actions       = [aws_sns_topic.analytics_alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.report_engine.function_name
  }

  tags = merge(var.tags, {
    Name      = "analytics-lambda-duration"
    Component = "Analytics"
    Severity  = "Medium"
  })
}

# Alarm: Lambda Throttles
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "securebase-${var.environment}-analytics-lambda-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Analytics Lambda function is being throttled"
  alarm_actions       = [aws_sns_topic.analytics_alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.report_engine.function_name
  }

  tags = merge(var.tags, {
    Name      = "analytics-lambda-throttles"
    Component = "Analytics"
    Severity  = "High"
  })
}

# Alarm: DynamoDB Throttling Events
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  alarm_name          = "securebase-${var.environment}-analytics-dynamodb-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "DynamoDB throttling events detected"
  alarm_actions       = [aws_sns_topic.analytics_alerts.arn]

  dimensions = {
    TableName = aws_dynamodb_table.metrics.name
  }

  tags = merge(var.tags, {
    Name      = "analytics-dynamodb-throttles"
    Component = "Analytics"
    Severity  = "Medium"
  })
}

# Alarm: API Gateway 5XX Errors
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  count               = var.api_gateway_id != null ? 1 : 0
  alarm_name          = "securebase-${var.environment}-analytics-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Analytics API 5XX error rate high"
  alarm_actions       = [aws_sns_topic.analytics_alerts.arn]

  dimensions = {
    ApiName = "securebase-${var.environment}-api"
  }

  tags = merge(var.tags, {
    Name      = "analytics-api-5xx"
    Component = "Analytics"
    Severity  = "High"
  })
}

# Alarm: API Gateway Latency
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  count               = var.api_gateway_id != null ? 1 : 0
  alarm_name          = "securebase-${var.environment}-analytics-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Average"
  threshold           = 500 # 500ms requirement
  alarm_description   = "Analytics API latency exceeded 500ms"
  alarm_actions       = [aws_sns_topic.analytics_alerts.arn]

  dimensions = {
    ApiName = "securebase-${var.environment}-api"
  }

  tags = merge(var.tags, {
    Name      = "analytics-api-latency"
    Component = "Analytics"
    Severity  = "Medium"
  })
}

# Log Metric Filter: Failed Report Generations
resource "aws_cloudwatch_log_metric_filter" "failed_reports" {
  name           = "analytics-failed-reports"
  log_group_name = aws_cloudwatch_log_group.report_engine.name
  pattern        = "[time, request_id, level = ERROR*, ...]"

  metric_transformation {
    name      = "FailedReportGenerations"
    namespace = "SecureBase/Analytics"
    value     = "1"
  }
}

# Alarm: Failed Report Generations
resource "aws_cloudwatch_metric_alarm" "failed_reports" {
  alarm_name          = "securebase-${var.environment}-analytics-failed-reports"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FailedReportGenerations"
  namespace           = "SecureBase/Analytics"
  period              = 3600
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "Multiple failed report generations detected"
  alarm_actions       = [aws_sns_topic.analytics_alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = merge(var.tags, {
    Name      = "analytics-failed-reports"
    Component = "Analytics"
    Severity  = "Medium"
  })
}

# CloudWatch Insights Query for Analytics Debugging
resource "aws_cloudwatch_query_definition" "analytics_errors" {
  name = "securebase-${var.environment}-analytics-errors"

  log_group_names = [
    aws_cloudwatch_log_group.report_engine.name
  ]

  query_string = <<-QUERY
    fields @timestamp, @message, @logStream
    | filter @message like /ERROR/
    | sort @timestamp desc
    | limit 100
  QUERY
}

resource "aws_cloudwatch_query_definition" "analytics_performance" {
  name = "securebase-${var.environment}-analytics-performance"

  log_group_names = [
    aws_cloudwatch_log_group.report_engine.name
  ]

  query_string = <<-QUERY
    fields @timestamp, @duration, @message
    | filter @type = "REPORT"
    | stats avg(@duration), max(@duration), min(@duration) by bin(5m)
  QUERY
}
