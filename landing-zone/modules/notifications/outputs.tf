# Notifications Module Outputs
#
# TODO: Add outputs for Phase 4 Component 3 (Notifications)
#
# Author: SecureBase Team
# Created: 2026-01-26
# Status: Scaffold - Implementation Pending

# ============================================================================
# SNS OUTPUTS
# ============================================================================

output "notifications_topic_arn" {
  description = "ARN of the notifications SNS topic"
  value       = aws_sns_topic.notifications.arn
}

# TODO: Add output for notification topic name
# output "notifications_topic_name" {
#   description = "Name of the notifications SNS topic"
#   value       = aws_sns_topic.notifications.name
# }

# ============================================================================
# SQS OUTPUTS
# ============================================================================

# TODO: Add output for SQS queue URL
# output "notifications_queue_url" {
#   description = "URL of the notifications SQS queue"
#   value       = aws_sqs_queue.notifications.url
# }

# TODO: Add output for SQS queue ARN
# output "notifications_queue_arn" {
#   description = "ARN of the notifications SQS queue"
#   value       = aws_sqs_queue.notifications.arn
# }

# TODO: Add output for DLQ URL
# output "notifications_dlq_url" {
#   description = "URL of the notifications DLQ"
#   value       = aws_sqs_queue.notifications_dlq.url
# }

# ============================================================================
# DYNAMODB OUTPUTS
# ============================================================================

# TODO: Add output for notifications table name
# output "notifications_table_name" {
#   description = "Name of the notifications DynamoDB table"
#   value       = aws_dynamodb_table.notifications.name
# }

# TODO: Add output for subscriptions table name
# output "subscriptions_table_name" {
#   description = "Name of the subscriptions DynamoDB table"
#   value       = aws_dynamodb_table.subscriptions.name
# }

# TODO: Add output for templates table name
# output "templates_table_name" {
#   description = "Name of the templates DynamoDB table"
#   value       = aws_dynamodb_table.templates.name
# }

# ============================================================================
# LAMBDA OUTPUTS
# ============================================================================

# TODO: Add output for notification_worker function ARN
# output "worker_function_arn" {
#   description = "ARN of the notification worker Lambda function"
#   value       = aws_lambda_function.notification_worker.arn
# }

# TODO: Add output for notification_api function ARN
# output "api_function_arn" {
#   description = "ARN of the notification API Lambda function"
#   value       = aws_lambda_function.notification_api.arn
# }

# ============================================================================
# PLACEHOLDER OUTPUTS (for existing Phase 3b resources)
# ============================================================================

output "support_events_topic_arn" {
  description = "ARN of the support events SNS topic (Phase 3b)"
  value       = aws_sns_topic.support_events.arn
}

output "webhook_events_topic_arn" {
  description = "ARN of the webhook events SNS topic (Phase 3b)"
  value       = aws_sns_topic.webhook_events.arn
}
