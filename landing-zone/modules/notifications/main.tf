# Phase 3b Notifications Infrastructure
# SNS topics for real-time notifications

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ============================================
# SNS Topics
# ============================================

# General notifications topic
resource "aws_sns_topic" "notifications" {
  name              = "securebase-${var.environment}-notifications"
  display_name      = "SecureBase Notifications"
  kms_master_key_id = var.kms_key_id

  tags = merge(var.tags, {
    Name = "SecureBase Notifications"
  })
}

# Support ticket events topic
resource "aws_sns_topic" "support_events" {
  name              = "securebase-${var.environment}-support-events"
  display_name      = "SecureBase Support Events"
  kms_master_key_id = var.kms_key_id

  tags = merge(var.tags, {
    Name = "SecureBase Support Events"
  })
}

# Webhook delivery events topic
resource "aws_sns_topic" "webhook_events" {
  name              = "securebase-${var.environment}-webhook-events"
  display_name      = "SecureBase Webhook Events"
  kms_master_key_id = var.kms_key_id

  tags = merge(var.tags, {
    Name = "SecureBase Webhook Events"
  })
}

# Cost alert events topic
resource "aws_sns_topic" "cost_alerts" {
  name              = "securebase-${var.environment}-cost-alerts"
  display_name      = "SecureBase Cost Alerts"
  kms_master_key_id = var.kms_key_id

  tags = merge(var.tags, {
    Name = "SecureBase Cost Alerts"
  })
}

# ============================================
# SNS Topic Policies
# ============================================

resource "aws_sns_topic_policy" "notifications" {
  arn = aws_sns_topic.notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.notifications.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

resource "aws_sns_topic_policy" "support_events" {
  arn = aws_sns_topic.support_events.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.support_events.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# Data Sources
# ============================================

data "aws_caller_identity" "current" {}

# ============================================
# Phase 4 Component 3: Notifications System
# ============================================

# SQS Queue for notification processing
resource "aws_sqs_queue" "notifications_dlq" {
  name                      = "securebase-${var.environment}-notifications-dlq"
  message_retention_seconds = 1209600  # 14 days
  
  tags = merge(var.tags, {
    Name = "SecureBase Notifications DLQ"
  })
}

resource "aws_sqs_queue" "notifications" {
  name                       = "securebase-${var.environment}-notifications-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 1209600  # 14 days
  receive_wait_time_seconds  = 10       # Long polling
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = merge(var.tags, {
    Name = "SecureBase Notifications Queue"
  })
}

# SNS to SQS subscription
resource "aws_sns_topic_subscription" "notifications_to_sqs" {
  topic_arn = aws_sns_topic.notifications.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.notifications.arn
}

# SQS Queue Policy to allow SNS to publish
resource "aws_sqs_queue_policy" "notifications" {
  queue_url = aws_sqs_queue.notifications.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "SQS:SendMessage"
        Resource = aws_sqs_queue.notifications.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.notifications.arn
          }
        }
      }
    ]
  })
}

# ============================================
# DynamoDB Tables
# ============================================

# Notifications table (in-app notifications)
resource "aws_dynamodb_table" "notifications" {
  name           = "securebase-${var.environment}-notifications"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  
  attribute {
    name = "user_id"
    type = "S"
  }
  
  attribute {
    name = "created_at"
    type = "N"
  }
  
  attribute {
    name = "customer_id"
    type = "S"
  }
  
  attribute {
    name = "type"
    type = "S"
  }
  
  # GSI for querying by user_id and created_at
  global_secondary_index {
    name            = "user_id-created_at-index"
    hash_key        = "user_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }
  
  # GSI for querying by customer_id and type
  global_secondary_index {
    name            = "customer_id-type-index"
    hash_key        = "customer_id"
    range_key       = "type"
    projection_type = "ALL"
  }
  
  # TTL for automatic cleanup
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  
  point_in_time_recovery {
    enabled = true
  }
  
  server_side_encryption {
    enabled = true
  }
  
  tags = merge(var.tags, {
    Name = "SecureBase Notifications"
  })
}

# Subscriptions table (user notification preferences)
resource "aws_dynamodb_table" "subscriptions" {
  name           = "securebase-${var.environment}-subscriptions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "customer_id"
  range_key      = "user_id"
  
  attribute {
    name = "customer_id"
    type = "S"
  }
  
  attribute {
    name = "user_id"
    type = "S"
  }
  
  point_in_time_recovery {
    enabled = true
  }
  
  server_side_encryption {
    enabled = true
  }
  
  tags = merge(var.tags, {
    Name = "SecureBase Subscriptions"
  })
}

# Templates table (notification templates)
resource "aws_dynamodb_table" "templates" {
  name           = "securebase-${var.environment}-templates"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "customer_id"
  range_key      = "event_type"
  
  attribute {
    name = "customer_id"
    type = "S"
  }
  
  attribute {
    name = "event_type"
    type = "S"
  }
  
  point_in_time_recovery {
    enabled = true
  }
  
  server_side_encryption {
    enabled = true
  }
  
  tags = merge(var.tags, {
    Name = "SecureBase Templates"
  })
}

# ============================================
# Lambda Functions
# ============================================

# IAM role for notification worker Lambda
resource "aws_iam_role" "notification_worker" {
  name = "securebase-${var.environment}-notification-worker"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  
  tags = var.tags
}

# IAM policy for notification worker Lambda
resource "aws_iam_role_policy" "notification_worker" {
  name = "notification-worker-policy"
  role = aws_iam_role.notification_worker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.notifications.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.notifications.arn,
          "${aws_dynamodb_table.notifications.arn}/index/*",
          aws_dynamodb_table.subscriptions.arn,
          "${aws_dynamodb_table.subscriptions.arn}/index/*",
          aws_dynamodb_table.templates.arn,
          "${aws_dynamodb_table.templates.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Log Group for notification worker
resource "aws_cloudwatch_log_group" "notification_worker" {
  name              = "/aws/lambda/securebase-${var.environment}-notification-worker"
  retention_in_days = 30
  
  tags = var.tags
}

# Lambda function for notification worker (placeholder - code uploaded separately)
resource "aws_lambda_function" "notification_worker" {
  function_name = "securebase-${var.environment}-notification-worker"
  role          = aws_iam_role.notification_worker.arn
  handler       = "notification_worker.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 512
  
  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")
  
  environment {
    variables = {
      NOTIFICATIONS_TABLE = aws_dynamodb_table.notifications.name
      SUBSCRIPTIONS_TABLE = aws_dynamodb_table.subscriptions.name
      TEMPLATES_TABLE     = aws_dynamodb_table.templates.name
      SNS_TOPIC_ARN       = aws_sns_topic.notifications.arn
      SES_FROM_EMAIL      = var.ses_from_email
      WEBHOOK_TIMEOUT     = "5"
      MAX_RETRIES         = "3"
    }
  }
  
  depends_on = [aws_cloudwatch_log_group.notification_worker]
  
  tags = var.tags
}

# SQS trigger for notification worker Lambda
resource "aws_lambda_event_source_mapping" "notifications" {
  event_source_arn = aws_sqs_queue.notifications.arn
  function_name    = aws_lambda_function.notification_worker.arn
  batch_size       = 10
  
  enabled = true
}

# ============================================
# Notification API Lambda
# ============================================

# IAM role for notification API Lambda
resource "aws_iam_role" "notification_api" {
  name = "securebase-${var.environment}-notification-api"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  
  tags = var.tags
}

# IAM policy for notification API Lambda
resource "aws_iam_role_policy" "notification_api" {
  name = "notification-api-policy"
  role = aws_iam_role.notification_api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.notifications.arn,
          "${aws_dynamodb_table.notifications.arn}/index/*",
          aws_dynamodb_table.subscriptions.arn,
          "${aws_dynamodb_table.subscriptions.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.notifications.arn
      }
    ]
  })
}

# CloudWatch Log Group for notification API
resource "aws_cloudwatch_log_group" "notification_api" {
  name              = "/aws/lambda/securebase-${var.environment}-notification-api"
  retention_in_days = 30
  
  tags = var.tags
}

# Lambda function for notification API
resource "aws_lambda_function" "notification_api" {
  function_name = "securebase-${var.environment}-notification-api"
  role          = aws_iam_role.notification_api.arn
  handler       = "notification_api.lambda_handler"
  runtime       = "python3.11"
  timeout       = 10
  memory_size   = 256
  
  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")
  
  environment {
    variables = {
      NOTIFICATIONS_TABLE = aws_dynamodb_table.notifications.name
      SUBSCRIPTIONS_TABLE = aws_dynamodb_table.subscriptions.name
      SNS_TOPIC_ARN       = aws_sns_topic.notifications.arn
      MAX_PAGE_SIZE       = "100"
    }
  }
  
  depends_on = [aws_cloudwatch_log_group.notification_api]
  
  tags = var.tags
}

# Lambda permission for API Gateway (if using API Gateway)
resource "aws_lambda_permission" "notification_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.notification_api.function_name
  principal     = "apigateway.amazonaws.com"
}

# ============================================
# CloudWatch Alarms
# ============================================

# Alarm for DLQ depth
resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "securebase-${var.environment}-notifications-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 10
  alarm_description   = "Alert when DLQ has more than 10 messages"
  
  dimensions = {
    QueueName = aws_sqs_queue.notifications_dlq.name
  }
  
  tags = var.tags
}

# Alarm for Lambda errors
resource "aws_cloudwatch_metric_alarm" "worker_errors" {
  alarm_name          = "securebase-${var.environment}-notification-worker-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Alert when Lambda errors exceed 5 in 5 minutes"
  
  dimensions = {
    FunctionName = aws_lambda_function.notification_worker.function_name
  }
  
  tags = var.tags
}

# Alarm for SQS age of oldest message
resource "aws_cloudwatch_metric_alarm" "old_messages" {
  alarm_name          = "securebase-${var.environment}-notifications-old-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 3600  # 1 hour
  alarm_description   = "Alert when oldest message is older than 1 hour"
  
  dimensions = {
    QueueName = aws_sqs_queue.notifications.name
  }
  
  tags = var.tags
}





