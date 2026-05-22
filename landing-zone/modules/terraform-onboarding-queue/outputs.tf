# Terraform Onboarding Queue — Outputs

output "queue_url" {
  description = "URL of the tenant onboarding SQS queue"
  value       = aws_sqs_queue.onboarding.url
}

output "queue_arn" {
  description = "ARN of the tenant onboarding SQS queue"
  value       = aws_sqs_queue.onboarding.arn
}

output "queue_name" {
  description = "Name of the tenant onboarding SQS queue"
  value       = aws_sqs_queue.onboarding.name
}

output "dlq_url" {
  description = "URL of the dead-letter queue"
  value       = aws_sqs_queue.onboarding_dlq.url
}

output "dlq_arn" {
  description = "ARN of the dead-letter queue"
  value       = aws_sqs_queue.onboarding_dlq.arn
}
