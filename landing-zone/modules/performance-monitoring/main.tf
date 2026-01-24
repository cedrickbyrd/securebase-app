# Performance Monitoring Module
# CloudWatch Dashboards, X-Ray Tracing, and Performance Alarms

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# CloudWatch Dashboard for Performance Metrics
resource "aws_cloudwatch_dashboard" "performance" {
  dashboard_name = "${var.project_name}-${var.environment}-performance"

  dashboard_body = jsonencode({
    widgets = [
      # API Gateway Latency
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Latency", { stat = "Average", label = "p50" }],
            ["...", { stat = "p95", label = "p95" }],
            ["...", { stat = "p99", label = "p99" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Gateway Latency (Target: p95 < 100ms)"
          period  = 300
          yAxis = {
            left = {
              min = 0
              max = 500
            }
          }
          annotations = {
            horizontal = [
              {
                value = 100
                label = "p95 Target"
                fill  = "above"
              }
            ]
          }
        }
      },
      # Lambda Duration
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", { stat = "Average" }],
            ["...", { stat = "Maximum" }],
            ["...", { stat = "p95" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Execution Duration"
          period  = 300
        }
      },
      # Lambda Concurrent Executions
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "ConcurrentExecutions", { stat = "Maximum" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Concurrent Executions"
          period  = 300
        }
      },
      # Lambda Errors and Throttles
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Errors", { stat = "Sum", label = "Errors" }],
            [".", "Throttles", { stat = "Sum", label = "Throttles" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Errors & Throttles"
          period  = 300
          yAxis = {
            left = {
              min = 0
            }
          }
        }
      },
      # DynamoDB Read/Write Latency
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/DynamoDB", "SuccessfulRequestLatency", { stat = "Average", label = "Avg Latency" }],
            ["...", { stat = "p95", label = "p95 Latency" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Request Latency"
          period  = 300
        }
      },
      # DynamoDB Throttled Requests
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/DynamoDB", "UserErrors", { stat = "Sum" }],
            [".", "SystemErrors", { stat = "Sum" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Errors"
          period  = 300
        }
      },
      # ElastiCache Hit Rate
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ElastiCache", "CacheHitRate", { stat = "Average" }],
            [".", "CacheMisses", { stat = "Sum" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ElastiCache Performance (Target: Hit Rate > 70%)"
          period  = 300
          annotations = {
            horizontal = [
              {
                value = 70
                label = "Target Hit Rate"
                fill  = "below"
              }
            ]
          }
        }
      },
      # CloudFront Cache Statistics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/CloudFront", "CacheHitRate", { stat = "Average" }],
            [".", "Requests", { stat = "Sum" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"  # CloudFront metrics only in us-east-1
          title   = "CloudFront Cache Performance"
          period  = 300
        }
      },
      # RDS (Aurora) Performance
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", { stat = "Average" }],
            [".", "CPUUtilization", { stat = "Average" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Aurora Performance"
          period  = 300
        }
      },
      # API Gateway Requests
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", { stat = "Sum", label = "Total Requests" }],
            [".", "4XXError", { stat = "Sum", label = "4xx Errors" }],
            [".", "5XXError", { stat = "Sum", label = "5xx Errors" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Gateway Requests & Errors"
          period  = 300
        }
      },
      # Custom Business Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["SecureBase/Performance", "QueryExecutionTime", { stat = "p95" }],
            [".", "CacheEnabled", { stat = "Sum" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Custom Performance Metrics"
          period  = 300
        }
      },
      # Page Load Time (from RUM or custom metrics)
      {
        type = "metric"
        properties = {
          metrics = [
            ["SecureBase/Performance", "PageLoadTime", { stat = "p95" }],
            [".", "TTFBTime", { stat = "p95" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Frontend Performance (Target: Load < 2s)"
          period  = 300
          annotations = {
            horizontal = [
              {
                value = 2000
                label = "2s Target"
                fill  = "above"
              }
            ]
          }
        }
      }
    ]
  })
}

# Comprehensive Uptime Dashboard
resource "aws_cloudwatch_dashboard" "uptime" {
  dashboard_name = "${var.project_name}-${var.environment}-uptime"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApiGateway", "4XXError", { stat = "Sum" }],
            [".", "5XXError", { stat = "Sum" }]
          ]
          view    = "singleValue"
          region  = var.aws_region
          title   = "API Error Count (24h)"
          period  = 86400
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            [{ expression = "(m1-m2)/m1*100", label = "Availability %", id = "e1" }],
            ["AWS/ApiGateway", "Count", { id = "m1", visible = false }],
            [".", "5XXError", { id = "m2", visible = false }]
          ]
          view    = "singleValue"
          region  = var.aws_region
          title   = "API Availability (Target: 99.95%)"
          period  = 86400
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Errors", { stat = "Sum" }],
            [".", "Throttles", { stat = "Sum" }]
          ]
          view    = "timeSeries"
          stacked = true
          region  = var.aws_region
          title   = "Lambda Reliability"
          period  = 300
        }
      }
    ]
  })
}

# Performance Alarms
resource "aws_cloudwatch_metric_alarm" "api_latency_p95" {
  alarm_name          = "${var.project_name}-${var.environment}-api-latency-p95-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  extended_statistic  = "p95"
  threshold           = var.api_latency_p95_threshold
  alarm_description   = "API p95 latency exceeded ${var.api_latency_p95_threshold}ms (Target: < 100ms)"
  alarm_actions       = var.alarm_actions
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = var.api_gateway_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-lambda-errors-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Lambda errors > 10 in 5 minutes"
  alarm_actions       = var.alarm_actions
  treat_missing_data  = "notBreaching"

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "${var.project_name}-${var.environment}-lambda-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Lambda throttles detected (check concurrency limits)"
  alarm_actions       = var.alarm_actions
  treat_missing_data  = "notBreaching"

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "API 5xx errors > 5 in 5 minutes"
  alarm_actions       = var.alarm_actions
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = var.api_gateway_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_read_throttles" {
  alarm_name          = "${var.project_name}-${var.environment}-dynamodb-read-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ReadThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "DynamoDB read throttles detected"
  alarm_actions       = var.alarm_actions
  treat_missing_data  = "notBreaching"

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_write_throttles" {
  alarm_name          = "${var.project_name}-${var.environment}-dynamodb-write-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "WriteThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "DynamoDB write throttles detected"
  alarm_actions       = var.alarm_actions
  treat_missing_data  = "notBreaching"

  tags = var.tags
}

# Log Group for Custom Metrics
resource "aws_cloudwatch_log_group" "performance_metrics" {
  name              = "/securebase/${var.environment}/performance-metrics"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# Log Metric Filter for Page Load Time
resource "aws_cloudwatch_log_metric_filter" "page_load_time" {
  name           = "${var.project_name}-${var.environment}-page-load-time"
  log_group_name = aws_cloudwatch_log_group.performance_metrics.name
  pattern        = "[timestamp, request_id, metric_name=PageLoadTime, value]"

  metric_transformation {
    name      = "PageLoadTime"
    namespace = "SecureBase/Performance"
    value     = "$value"
    unit      = "Milliseconds"
  }
}

# SNS Topic for Performance Alerts (if not provided)
resource "aws_sns_topic" "performance_alerts" {
  count = var.create_sns_topic ? 1 : 0
  name  = "${var.project_name}-${var.environment}-performance-alerts"

  tags = var.tags
}

resource "aws_sns_topic_subscription" "performance_alerts_email" {
  count     = var.create_sns_topic && var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.performance_alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Insights Queries
resource "aws_cloudwatch_query_definition" "slow_api_requests" {
  name = "${var.project_name}-${var.environment}/slow-api-requests"

  log_group_names = var.api_log_group_names

  query_string = <<-QUERY
    fields @timestamp, @message, @duration
    | filter @type = "REPORT"
    | filter @duration > 1000
    | sort @duration desc
    | limit 100
  QUERY
}

resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${var.project_name}-${var.environment}/error-analysis"

  log_group_names = var.api_log_group_names

  query_string = <<-QUERY
    fields @timestamp, @message
    | filter @message like /ERROR|Exception|Failed/
    | stats count() by bin(5m)
  QUERY
}

resource "aws_cloudwatch_query_definition" "p95_latency_by_endpoint" {
  name = "${var.project_name}-${var.environment}/p95-latency-by-endpoint"

  log_group_names = var.api_log_group_names

  query_string = <<-QUERY
    fields @timestamp, method, path, duration
    | filter @type = "REPORT"
    | stats pct(duration, 95) as p95_latency by path
    | sort p95_latency desc
  QUERY
}
