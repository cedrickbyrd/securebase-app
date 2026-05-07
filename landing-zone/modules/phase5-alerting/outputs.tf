output "sns_topic_arn" {
  description = "ARN of the primary alerts SNS topic"
  value       = aws_sns_topic.alerts.arn
}

output "alert_sns_arn" {
  description = "Alias of sns_topic_arn — used by multi-region and cost modules"
  value       = aws_sns_topic.alerts.arn
}

output "alert_router_lambda_arn" {
  description = "ARN of the alert-router Lambda"
  value       = aws_lambda_function.alert_router.arn
}
