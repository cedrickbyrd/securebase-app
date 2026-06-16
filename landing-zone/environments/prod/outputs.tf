# =============================================================================
# Marketplace module outputs
# module.marketplace has count=0|1 conditional — use try() so terraform output
# returns an empty string instead of an error when the module is disabled.
# =============================================================================

output "marketplace_sns_topic_arn" {
  description = "SNS topic ARN for AWS Marketplace subscription notifications"
  value       = try(module.marketplace[0].marketplace_sns_topic_arn, "")
}

output "marketplace_resolve_customer_arn" {
  description = "ARN of marketplace_resolve_customer Lambda"
  value       = try(module.marketplace[0].marketplace_resolve_customer_arn, "")
}

output "marketplace_resolve_customer_name" {
  description = "Name of marketplace_resolve_customer Lambda"
  value       = try(module.marketplace[0].marketplace_resolve_customer_name, "")
}

output "marketplace_subscription_handler_arn" {
  description = "ARN of marketplace_subscription_handler Lambda"
  value       = try(module.marketplace[0].marketplace_subscription_handler_arn, "")
}

output "marketplace_subscription_handler_name" {
  description = "Name of marketplace_subscription_handler Lambda"
  value       = try(module.marketplace[0].marketplace_subscription_handler_name, "")
}

output "marketplace_metering_worker_arn" {
  description = "ARN of marketplace_metering_worker Lambda"
  value       = try(module.marketplace[0].marketplace_metering_worker_arn, "")
}

output "marketplace_metering_worker_name" {
  description = "Name of marketplace_metering_worker Lambda"
  value       = try(module.marketplace[0].marketplace_metering_worker_name, "")
}

output "subscription_handler_dlq_arn" {
  description = "ARN of the subscription handler dead-letter queue — use for IAM sqs:SendMessage grant and manual replay"
  value       = try(module.marketplace[0].subscription_handler_dlq_arn, "")
}

output "subscription_handler_dlq_url" {
  description = "URL of the subscription handler dead-letter queue — use with aws sqs receive-message for manual replay"
  value       = try(module.marketplace[0].subscription_handler_dlq_url, "")
}
