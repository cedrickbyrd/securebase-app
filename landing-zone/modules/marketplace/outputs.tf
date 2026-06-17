output "marketplace_sns_topic_arn" {
  description = "SNS topic ARN for AWS Marketplace subscription notifications"
  value       = aws_sns_topic.marketplace_subscriptions.arn
}

output "marketplace_resolve_customer_arn" {
  description = "ARN of marketplace_resolve_customer lambda"
  value       = aws_lambda_function.marketplace_resolve_customer.arn
}

output "marketplace_resolve_customer_name" {
  description = "Name of marketplace_resolve_customer lambda"
  value       = aws_lambda_function.marketplace_resolve_customer.function_name
}

output "marketplace_subscription_handler_arn" {
  description = "ARN of marketplace_subscription_handler lambda"
  value       = aws_lambda_function.marketplace_subscription_handler.arn
}

output "marketplace_subscription_handler_name" {
  description = "Name of marketplace_subscription_handler lambda"
  value       = aws_lambda_function.marketplace_subscription_handler.function_name
}

output "marketplace_metering_worker_arn" {
  description = "ARN of marketplace_metering_worker lambda"
  value       = aws_lambda_function.marketplace_metering_worker.arn
}

output "marketplace_metering_worker_name" {
  description = "Name of marketplace_metering_worker lambda"
  value       = aws_lambda_function.marketplace_metering_worker.function_name
}

output "subscription_handler_dlq_arn" {
  description = "ARN of the subscription handler dead-letter queue"
  value       = aws_sqs_queue.subscription_handler_dlq.arn
}

output "subscription_handler_dlq_url" {
  description = "URL of the subscription handler dead-letter queue (use for manual replay via aws sqs receive-message)"
  value       = aws_sqs_queue.subscription_handler_dlq.url
}

output "metering_worker_dlq_arn" {
  description = "ARN of the metering worker dead-letter queue"
  value       = aws_sqs_queue.metering_worker_dlq.arn
}

output "metering_worker_dlq_url" {
  description = "URL of the metering worker dead-letter queue (use for manual replay via aws sqs receive-message)"
  value       = aws_sqs_queue.metering_worker_dlq.url
}
