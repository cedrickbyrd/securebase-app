# CloudWatch Dashboard for Phase 3B Performance Monitoring

resource "aws_cloudwatch_dashboard" "phase3b_performance" {
  dashboard_name = "${var.project_name}-${var.environment}-phase3b-performance"

  dashboard_body = jsonencode({
    widgets = [
      # Lambda Performance Metrics
      {
        type = "metric"
        x    = 0
        y    = 0
        width = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", { stat = "Average", label = "Avg Duration" }],
            ["...", { stat = "p95", label = "P95 Duration" }],
            ["...", { stat = "p99", label = "P99 Duration" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Execution Duration"
          period  = 300
          yAxis = {
            left = {
              label = "Milliseconds"
              min   = 0
            }
          }
        }
      },
      
      # Lambda Error Rate
      {
        type = "metric"
        x    = 12
        y    = 0
        width = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Errors", { stat = "Sum", label = "Total Errors" }],
            [".", "Throttles", { stat = "Sum", label = "Throttles" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Errors & Throttles"
          period  = 300
          yAxis = {
            left = {
              label = "Count"
              min   = 0
            }
          }
        }
      },
      
      # DynamoDB Read Capacity
      {
        type = "metric"
        x    = 0
        y    = 6
        width = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", { stat = "Sum" }],
            [".", "ProvisionedReadCapacityUnits", { stat = "Average" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Read Capacity Utilization"
          period  = 300
        }
      },
      
      # DynamoDB Write Capacity
      {
        type = "metric"
        x    = 12
        y    = 6
        width = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", { stat = "Sum" }],
            [".", "ProvisionedWriteCapacityUnits", { stat = "Average" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Write Capacity Utilization"
          period  = 300
        }
      },
      
      # API Gateway Latency
      {
        type = "metric"
        x    = 0
        y    = 12
        width = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Latency", { stat = "Average", label = "Avg Latency" }],
            ["...", { stat = "p95", label = "P95 Latency" }],
            ["...", { stat = "p99", label = "P99 Latency" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Gateway Latency"
          period  = 300
          yAxis = {
            left = {
              label = "Milliseconds"
              min   = 0
            }
          }
        }
      },
      
      # API Gateway Request Count
      {
        type = "metric"
        x    = 12
        y    = 12
        width = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", { stat = "Sum", label = "Total Requests" }],
            [".", "4XXError", { stat = "Sum", label = "4XX Errors" }],
            [".", "5XXError", { stat = "Sum", label = "5XX Errors" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Gateway Requests & Errors"
          period  = 300
        }
      },
      
      # Cache Performance
      {
        type = "metric"
        x    = 0
        y    = 18
        width = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "CacheHitCount", { stat = "Sum", label = "Cache Hits" }],
            [".", "CacheMissCount", { stat = "Sum", label = "Cache Misses" }]
          ]
          view    = "timeSeries"
          stacked = true
          region  = var.aws_region
          title   = "API Gateway Cache Performance"
          period  = 300
        }
      },
      
      # Custom Business Metrics
      {
        type = "metric"
        x    = 12
        y    = 18
        width = 12
        height = 6
        properties = {
          metrics = [
            ["SecureBase/Phase3B", "TicketsCreated", { stat = "Sum", label = "Tickets Created" }],
            [".", "NotificationsSent", { stat = "Sum", label = "Notifications Sent" }],
            [".", "ForecastsGenerated", { stat = "Sum", label = "Forecasts Generated" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Business Metrics"
          period  = 300
        }
      }
    ]
  })

  depends_on = [
    aws_dynamodb_table.support_tickets
  ]
}

# CloudWatch Log Groups with retention
resource "aws_cloudwatch_log_group" "support_tickets_lambda" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-support-tickets"
  retention_in_days = var.environment == "prod" ? 90 : 30

  tags = {
    Environment = var.environment
    Component   = "support-tickets"
  }
}

resource "aws_cloudwatch_log_group" "cost_forecasting_lambda" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-cost-forecasting"
  retention_in_days = var.environment == "prod" ? 90 : 30

  tags = {
    Environment = var.environment
    Component   = "cost-forecasting"
  }
}

resource "aws_cloudwatch_log_group" "webhook_manager_lambda" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-webhook-manager"
  retention_in_days = var.environment == "prod" ? 90 : 30

  tags = {
    Environment = var.environment
    Component   = "webhooks"
  }
}

# CloudWatch Alarms for Lambda Performance
resource "aws_cloudwatch_metric_alarm" "support_tickets_high_duration" {
  alarm_name          = "${var.project_name}-${var.environment}-support-tickets-high-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = 1000  # 1 second
  alarm_description   = "Alert when support tickets Lambda duration exceeds 1s"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.enable_performance_monitoring ? (var.performance_alerts_topic_arn != "" ? [var.performance_alerts_topic_arn] : []) : []

  dimensions = {
    FunctionName = "${var.project_name}-${var.environment}-support-tickets"
  }

  tags = {
    Environment = var.environment
    Component   = "support-tickets"
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-phase3b-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Alert when Lambda errors exceed 10 in 5 minutes"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.enable_performance_monitoring ? (var.performance_alerts_topic_arn != "" ? [var.performance_alerts_topic_arn] : []) : []

  tags = {
    Environment = var.environment
    Phase       = "3b"
  }
}

# Output dashboard URL
output "performance_dashboard_url" {
  description = "URL to the Phase 3B performance dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.phase3b_performance.dashboard_name}"
}
