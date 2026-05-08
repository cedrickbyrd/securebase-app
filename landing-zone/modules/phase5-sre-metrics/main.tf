# Phase 5.3 SRE Metrics Module
# Infrastructure for the SRE/Operations Dashboard Backend
#
# Creates:
# - DynamoDB table: sre_ops_metrics (deployment history, operational events)
# - SNS topic: sre_alerts (PagerDuty/on-call integration)
# - CloudWatch alarms: error rate + latency thresholds
# - IAM role: sre_metrics_lambda (least-privilege CloudWatch/CE/SSM/DynamoDB)
# - Lambda function: sre_metrics (Python 3.11, 512 MB, 30s timeout)
# - CloudWatch log group (90-day retention)

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

# ============================================================================
# DynamoDB Table — sre_ops_metrics
# ============================================================================

resource "aws_dynamodb_table" "sre_ops_metrics" {
  name         = "securebase-${var.environment}-sre-ops-metrics"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "metric_type"
  range_key    = "timestamp"

  attribute {
    name = "metric_type"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  # TTL for automatic data expiration
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  # KMS encryption — uses AWS-managed key (null = default SSE with AWS managed key)
  server_side_encryption {
    enabled     = var.encryption_at_rest
    kms_key_arn = null
  }

  # Point-in-time recovery for production resilience
  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  tags = merge(var.tags, {
    Name                = "securebase-${var.environment}-sre-ops-metrics"
    Environment         = var.environment
    Phase               = "5.3"
    ComplianceFramework = "SOC2,FedRAMP,HIPAA"
    DataClassification  = "operational"
  })
}

# ============================================================================
# SNS Topic — sre_alerts (PagerDuty / on-call integration)
# ============================================================================

resource "aws_sns_topic" "sre_alerts" {
  name = "securebase-${var.environment}-sre-alerts"

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-sre-alerts"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_sns_topic_subscription" "sre_alerts_email" {
  count     = var.alert_email != null ? 1 : 0
  topic_arn = aws_sns_topic.sre_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ============================================================================
# CloudWatch Alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "sre_error_rate" {
  alarm_name          = "securebase-${var.environment}-sre-lambda-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 5  # >5% error rate

  metric_query {
    id          = "error_rate"
    expression  = "100 * errors / IF(invocations > 0, invocations, 1)"
    label       = "Lambda Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id = "invocations"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Invocations"
      period      = 300
      stat        = "Sum"
    }
  }

  alarm_description   = "SRE Alert: Lambda error rate exceeded 5% threshold"
  alarm_actions       = [aws_sns_topic.sre_alerts.arn]
  ok_actions          = [aws_sns_topic.sre_alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = merge(var.tags, {
    Environment = var.environment
    Phase       = "5.3"
    AlertType   = "ErrorRate"
  })
}

resource "aws_cloudwatch_metric_alarm" "sre_latency" {
  alarm_name          = "securebase-${var.environment}-sre-api-latency-p95"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 2000  # 2000ms p95 latency
  alarm_description   = "SRE Alert: API Gateway p95 latency exceeded 2000ms"
  alarm_actions       = [aws_sns_topic.sre_alerts.arn]
  ok_actions          = [aws_sns_topic.sre_alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = merge(var.tags, {
    Environment = var.environment
    Phase       = "5.3"
    AlertType   = "Latency"
  })
}

# ============================================================================
# IAM Role — sre_metrics_lambda (least privilege)
# ============================================================================

resource "aws_iam_role" "sre_metrics_lambda" {
  name = "securebase-${var.environment}-sre-metrics-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-sre-metrics-lambda"
    Environment = var.environment
    Phase       = "5.3"
  })
}

# Basic Lambda execution (CloudWatch Logs write)
resource "aws_iam_role_policy_attachment" "sre_lambda_basic_execution" {
  role       = aws_iam_role.sre_metrics_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Inline least-privilege policy
resource "aws_iam_role_policy" "sre_metrics_lambda_policy" {
  name = "securebase-${var.environment}-sre-metrics-policy"
  role = aws_iam_role.sre_metrics_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch read metrics
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
        ]
        Resource = "*"
      },
      # CloudWatch Logs Insights (for /sre/errors)
      {
        Effect = "Allow"
        Action = [
          "logs:StartQuery",
          "logs:GetQueryResults",
          "logs:StopQuery",
          "logs:DescribeLogGroups",
        ]
        Resource = "*"
      },
      # SSM Parameter Store (deployment history / config)
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParametersByPath",
        ]
        Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/securebase/${var.environment}/*"
      },
      # Cost Explorer (us-east-1 global)
      {
        Effect   = "Allow"
        Action   = ["ce:GetCostAndUsage"]
        Resource = "*"
      },
      # DynamoDB — sre_ops_metrics table only
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
        ]
        Resource = aws_dynamodb_table.sre_ops_metrics.arn
      },
      # ElastiCache describe (for /sre/cache)
      {
        Effect   = "Allow"
        Action   = ["elasticache:Describe*"]
        Resource = "*"
      },
      # RDS describe (for /sre/database)
      {
        Effect   = "Allow"
        Action   = ["rds:Describe*"]
        Resource = "*"
      },
      # Lambda list/describe (for /sre/lambda per-function metrics)
      {
        Effect = "Allow"
        Action = [
          "lambda:ListFunctions",
          "lambda:GetFunctionConfiguration",
        ]
        Resource = "*"
      },
      # SQS read DLQ depth (for /sre/lambda DLQ depth)
      {
        Effect = "Allow"
        Action = [
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
        ]
        Resource = "arn:aws:sqs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
    ]
  })
}

# ============================================================================
# Lambda Function — sre_metrics
# ============================================================================

resource "aws_cloudwatch_log_group" "sre_metrics" {
  name              = "/aws/lambda/securebase-${var.environment}-sre-metrics"
  retention_in_days = 90

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-sre-metrics-logs"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_lambda_function" "sre_metrics" {
  filename      = var.lambda_zip_path
  function_name = "securebase-${var.environment}-sre-metrics"
  handler       = "sre_metrics.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 512
  role          = aws_iam_role.sre_metrics_lambda.arn

  source_code_hash = fileexists(var.lambda_zip_path) ? filebase64sha256(var.lambda_zip_path) : null

  environment {
    variables = {
      ENVIRONMENT        = var.environment
      SRE_METRICS_TABLE  = aws_dynamodb_table.sre_ops_metrics.name
      SRE_ALERTS_TOPIC_ARN = aws_sns_topic.sre_alerts.arn
      CORS_ORIGIN        = var.cors_origin
      LOG_LEVEL          = "INFO"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.sre_metrics,
    aws_iam_role_policy_attachment.sre_lambda_basic_execution,
  ]

  tags = merge(var.tags, {
    Name                = "securebase-${var.environment}-sre-metrics"
    Environment         = var.environment
    Phase               = "5.3"
    ComplianceFramework = "SOC2,FedRAMP,HIPAA"
    DataClassification  = "operational"
  })
}
