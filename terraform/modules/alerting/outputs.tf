output "p1_sns_topic_arn" {
  description = "ARN of the P1 (critical / page immediately) SNS topic"
  value       = aws_sns_topic.p1_critical.arn
}

output "p2_sns_topic_arn" {
  description = "ARN of the P2 (high severity / page in 5 min) SNS topic"
  value       = aws_sns_topic.p2_high.arn
}

output "p3_sns_topic_arn" {
  description = "ARN of the P3 (medium / ticket only) SNS topic"
  value       = aws_sns_topic.p3_medium.arn
}

output "runbook_executor_lambda_arn" {
  description = "ARN of the runbook executor Lambda function"
  value       = aws_lambda_function.runbook_executor.arn
}

output "alarm_aggregator_lambda_arn" {
  description = "ARN of the alarm aggregator Lambda function"
  value       = aws_lambda_function.alarm_aggregator.arn
}

output "chaos_drill_lambda_arn" {
  description = "ARN of the chaos drill Lambda function"
  value       = aws_lambda_function.chaos_drill.arn
}

output "alarm_history_table_name" {
  description = "DynamoDB table name for alarm history"
  value       = aws_dynamodb_table.alarm_history.name
}

output "alarm_history_table_arn" {
  description = "DynamoDB table ARN for alarm history"
  value       = aws_dynamodb_table.alarm_history.arn
}

output "alerting_policy_arn" {
  description = "IAM policy ARN for the alerting Lambda functions"
  value       = aws_iam_policy.alerting_lambdas.arn
}
