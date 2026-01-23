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

# ============================================
# Data Sources
# ============================================

data "aws_caller_identity" "current" {}

# ============================================
# Outputs
# ============================================

output "notifications_topic_arn" {
  description = "ARN of general notifications topic"
  value       = aws_sns_topic.notifications.arn
}

output "support_events_topic_arn" {
  description = "ARN of support events topic"
  value       = aws_sns_topic.support_events.arn
}

output "webhook_events_topic_arn" {
  description = "ARN of webhook events topic"
  value       = aws_sns_topic.webhook_events.arn
}

output "cost_alerts_topic_arn" {
  description = "ARN of cost alerts topic"
  value       = aws_sns_topic.cost_alerts.arn
}
