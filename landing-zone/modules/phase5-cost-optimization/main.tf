# =============================================================================
# Phase 5.3 – Component 7: Infrastructure Scaling & Cost Optimization
# =============================================================================
# Delivers:
# - DynamoDB auto-scaling policies (on-demand → provisioned capacity for predictable workloads)
# - Aurora Serverless v2 capacity scheduler (scale-down outside business hours)
# - CloudFront cache policy tuning
# - S3 lifecycle rules (Intelligent-Tiering after 30 days, Glacier after 90 days)
# - AWS Cost Anomaly Detection monitor and alert threshold
# - CloudWatch dashboard for cost visibility

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# =============================================================================
# DynamoDB Auto-Scaling — Application Auto Scaling
# =============================================================================
# Applies auto-scaling to the DynamoDB tables that have predictable traffic
# patterns (billing window, nightly compliance scans).

resource "aws_appautoscaling_target" "metrics_history_read" {
  count = var.enable_dynamodb_autoscaling ? 1 : 0

  max_capacity       = var.dynamodb_max_capacity
  min_capacity       = var.dynamodb_min_capacity
  resource_id        = "table/securebase-${var.environment}-metrics-history"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "metrics_history_read" {
  count = var.enable_dynamodb_autoscaling ? 1 : 0

  name               = "securebase-${var.environment}-metrics-history-read-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.metrics_history_read[0].resource_id
  scalable_dimension = aws_appautoscaling_target.metrics_history_read[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.metrics_history_read[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_target" "metrics_history_write" {
  count = var.enable_dynamodb_autoscaling ? 1 : 0

  max_capacity       = var.dynamodb_max_capacity
  min_capacity       = var.dynamodb_min_capacity
  resource_id        = "table/securebase-${var.environment}-metrics-history"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "metrics_history_write" {
  count = var.enable_dynamodb_autoscaling ? 1 : 0

  name               = "securebase-${var.environment}-metrics-history-write-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.metrics_history_write[0].resource_id
  scalable_dimension = aws_appautoscaling_target.metrics_history_write[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.metrics_history_write[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# =============================================================================
# Aurora Serverless v2 Capacity Scheduler
# =============================================================================
# Reduces minimum ACU from the default (0.5) to 0 during off-peak hours
# (weeknights 10pm–6am UTC, weekends) to minimize idle costs.

resource "aws_scheduler_schedule" "aurora_scale_down" {
  name       = "securebase-${var.environment}-aurora-scale-down"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  # Weekdays 22:00 UTC
  schedule_expression          = "cron(0 22 ? * MON-FRI *)"
  schedule_expression_timezone = "UTC"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:modifyDBCluster"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      DbClusterIdentifier = "securebase-${var.environment}"
      ServerlessV2ScalingConfiguration = {
        MinCapacity = var.aurora_off_peak_min_acu
        MaxCapacity = var.aurora_max_acu
      }
    })

    retry_policy {
      maximum_retry_attempts = 3
    }
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-aurora-scale-down"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_scheduler_schedule" "aurora_scale_up" {
  name       = "securebase-${var.environment}-aurora-scale-up"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  # Weekdays 06:00 UTC
  schedule_expression          = "cron(0 6 ? * MON-FRI *)"
  schedule_expression_timezone = "UTC"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:modifyDBCluster"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      DbClusterIdentifier = "securebase-${var.environment}"
      ServerlessV2ScalingConfiguration = {
        MinCapacity = var.aurora_min_acu
        MaxCapacity = var.aurora_max_acu
      }
    })

    retry_policy {
      maximum_retry_attempts = 3
    }
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-aurora-scale-up"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_iam_role" "scheduler" {
  name = "securebase-${var.environment}-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-scheduler"
  })
}

resource "aws_iam_role_policy" "scheduler_rds" {
  name = "securebase-${var.environment}-scheduler-rds"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["rds:ModifyDBCluster"]
      Resource = "arn:aws:rds:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:cluster:securebase-${var.environment}"
    }]
  })
}

# =============================================================================
# S3 Lifecycle Policies
# =============================================================================

resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  bucket = "securebase-audit-logs-${var.environment}"

  rule {
    id     = "intelligent-tiering-transition"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "INTELLIGENT_TIERING"
    }

    # Keep objects in Intelligent-Tiering for 90 days before Glacier
    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }

    # Archive deeply after 365 days (compliance minimum)
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    # Objects expire after 7 years (HIPAA retention maximum)
    expiration {
      days = 2555
    }
  }

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  count  = var.reports_bucket_exists ? 1 : 0
  bucket = "securebase-reports-${var.environment}"

  rule {
    id     = "reports-lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "INTELLIGENT_TIERING"
    }

    transition {
      days          = 180
      storage_class = "GLACIER_IR"
    }

    expiration {
      days = 365
    }
  }

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }
  }
}

# S3 Intelligent-Tiering configuration for automatic monitoring
resource "aws_s3_bucket_intelligent_tiering_configuration" "audit_logs" {
  bucket = "securebase-audit-logs-${var.environment}"
  name   = "securebase-${var.environment}-auto-tiering"
  status = "Enabled"

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
}

# =============================================================================
# AWS Cost Anomaly Detection
# =============================================================================

resource "aws_ce_anomaly_monitor" "securebase" {
  name              = "securebase-${var.environment}-anomaly-monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-anomaly-monitor"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_ce_anomaly_subscription" "securebase" {
  name      = "securebase-${var.environment}-anomaly-subscription"
  frequency = "DAILY"

  monitor_arn_list = [aws_ce_anomaly_monitor.securebase.arn]

  subscriber {
    type    = "SNS"
    address = var.high_alert_sns_topic_arn
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      values        = [tostring(var.cost_anomaly_threshold_usd)]
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-anomaly-subscription"
    Environment = var.environment
    Phase       = "5.3"
  })
}

# =============================================================================
# CloudFront Cache Policy (improved hit rate)
# =============================================================================

resource "aws_cloudfront_cache_policy" "api_optimized" {
  name        = "securebase-${var.environment}-api-cache-policy"
  comment     = "SecureBase API cache policy — forwards auth headers, caches safe methods"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 300

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization", "X-API-Key"]
      }
    }

    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings {
        items = ["timeRange", "limit", "page", "customerId"]
      }
    }
  }
}

# =============================================================================
# Cost Dashboard
# =============================================================================

resource "aws_cloudwatch_dashboard" "cost_optimization" {
  dashboard_name = "securebase-${var.environment}-cost-optimization"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Estimated Daily AWS Charges"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [[
            "AWS/Billing", "EstimatedCharges",
            { "stat": "Maximum", "period": 86400 }
          ]]
          period = 86400
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Aurora ServerlessV2 ACU Usage"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/RDS", "ServerlessDatabaseCapacity",
              "DBClusterIdentifier", "securebase-${var.environment}",
              { "stat": "Average", "period": 300 }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "CloudFront Cache Hit Rate"
          view   = "timeSeries"
          region = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "CacheHitRate",
              { "stat": "Average", "period": 3600 }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Billed Duration (cost proxy)"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Duration",
              { "stat": "Sum", "period": 3600 }]
          ]
        }
      }
    ]
  })
}
