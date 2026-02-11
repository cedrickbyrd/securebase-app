output "ses_domain_verification_status" {
  description = "SES domain verification status"
  value       = aws_ses_domain_identity.tximhotep.verification_status
}

output "ses_dkim_tokens" {
  description = "DKIM tokens for DNS"
  value       = aws_ses_domain_dkim.tximhotep.dkim_tokens
}

output "email_queue_url" {
  description = "SQS email queue URL"
  value       = aws_sqs_queue.email_queue.url
}

output "email_dlq_url" {
  description = "SQS dead letter queue URL"
  value       = aws_sqs_queue.email_dlq.url
}

output "lambda_function_name" {
  description = "Lambda email worker function name"
  value       = aws_lambda_function.email_processor.function_name
}

output "sns_topic_arn" {
  description = "SNS topic for email events"
  value       = aws_sns_topic.email_events.arn
}

output "ses_sandbox_note" {
  description = "Important note about SES sandbox mode"
  value       = "⚠️  SES starts in sandbox mode. Request production access: https://console.aws.amazon.com/ses/home#/account"
}
