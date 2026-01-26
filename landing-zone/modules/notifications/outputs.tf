# Notifications Module Outputs
#
# Outputs for Phase 4 Component 3 (Notifications)
#
# Author: SecureBase Team
# Created: 2026-01-26
# Status: Implementation Complete

# ============================================================================
# SNS OUTPUTS
# ============================================================================

output "notifications_topic_arn" {
  description = "ARN of the notifications SNS topic"
  value       = aws_sns_topic.notifications.arn
}

output "notifications_topic_name" {
  description = "Name of the notifications SNS topic"
  value       = aws_sns_topic.notifications.name
}

output "support_events_topic_arn" {
  description = "ARN of the support events SNS topic (Phase 3b)"
  value       = aws_sns_topic.support_events.arn
}

output "webhook_events_topic_arn" {
  description = "ARN of the webhook events SNS topic (Phase 3b)"
  value       = aws_sns_topic.webhook_events.arn
}

output "cost_alerts_topic_arn" {
  description = "ARN of the cost alerts SNS topic (Phase 3b)"
  value       = aws_sns_topic.cost_alerts.arn
}

# ============================================================================
# SQS OUTPUTS
# ============================================================================

output "notifications_queue_url" {
  description = "URL of the notifications SQS queue"
  value       = aws_sqs_queue.notifications.url
}

output "notifications_queue_arn" {
  description = "ARN of the notifications SQS queue"
  value       = aws_sqs_queue.notifications.arn
}

output "notifications_dlq_url" {
  description = "URL of the notifications DLQ"
  value       = aws_sqs_queue.notifications_dlq.url
}

output "notifications_dlq_arn" {
  description = "ARN of the notifications DLQ"
  value       = aws_sqs_queue.notifications_dlq.arn
}

# ============================================================================
# DYNAMODB OUTPUTS
# ============================================================================

output "notifications_table_name" {
  description = "Name of the notifications DynamoDB table"
  value       = aws_dynamodb_table.notifications.name
}

output "notifications_table_arn" {
  description = "ARN of the notifications DynamoDB table"
  value       = aws_dynamodb_table.notifications.arn
}

output "subscriptions_table_name" {
  description = "Name of the subscriptions DynamoDB table"
  value       = aws_dynamodb_table.subscriptions.name
}

output "subscriptions_table_arn" {
  description = "ARN of the subscriptions DynamoDB table"
  value       = aws_dynamodb_table.subscriptions.arn
}

output "templates_table_name" {
  description = "Name of the templates DynamoDB table"
  value       = aws_dynamodb_table.templates.name
}

output "templates_table_arn" {
  description = "ARN of the templates DynamoDB table"
  value       = aws_dynamodb_table.templates.arn
}

# ============================================================================
# LAMBDA OUTPUTS
# ============================================================================

output "worker_function_arn" {
  description = "ARN of the notification worker Lambda function"
  value       = aws_lambda_function.notification_worker.arn
}

output "worker_function_name" {
  description = "Name of the notification worker Lambda function"
  value       = aws_lambda_function.notification_worker.function_name
}

output "api_function_arn" {
  description = "ARN of the notification API Lambda function"
  value       = aws_lambda_function.notification_api.arn
}

output "api_function_name" {
  description = "Name of the notification API Lambda function"
  value       = aws_lambda_function.notification_api.function_name
}

# ============================================================================
# CLOUDWATCH OUTPUTS
# ============================================================================

output "worker_log_group_name" {
  description = "Name of the worker Lambda CloudWatch log group"
  value       = aws_cloudwatch_log_group.notification_worker.name
}

output "api_log_group_name" {
  description = "Name of the API Lambda CloudWatch log group"
  value       = aws_cloudwatch_log_group.notification_api.name
}
