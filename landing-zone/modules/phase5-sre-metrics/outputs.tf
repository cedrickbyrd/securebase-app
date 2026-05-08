# Outputs for Phase 5.3 SRE Metrics Module

output "sre_metrics_lambda_arn" {
  description = "ARN of the SRE metrics Lambda function"
  value       = aws_lambda_function.sre_metrics.arn
}

output "sre_metrics_lambda_invoke_arn" {
  description = "Invoke ARN of the SRE metrics Lambda (used in API Gateway integration URI)"
  value       = aws_lambda_function.sre_metrics.invoke_arn
}

output "sre_metrics_lambda_name" {
  description = "Name of the SRE metrics Lambda function"
  value       = aws_lambda_function.sre_metrics.function_name
}

output "sre_ops_metrics_table_name" {
  description = "Name of the sre_ops_metrics DynamoDB table"
  value       = aws_dynamodb_table.sre_ops_metrics.name
}

output "sre_alerts_topic_arn" {
  description = "ARN of the SRE alerts SNS topic"
  value       = aws_sns_topic.sre_alerts.arn
}
