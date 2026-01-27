output "reports_table_name" {
  description = "DynamoDB reports table name"
  value       = aws_dynamodb_table.reports.name
}

output "reports_table_arn" {
  description = "DynamoDB reports table ARN"
  value       = aws_dynamodb_table.reports.arn
}

output "schedules_table_name" {
  description = "DynamoDB schedules table name"
  value       = aws_dynamodb_table.report_schedules.name
}

output "schedules_table_arn" {
  description = "DynamoDB schedules table ARN"
  value       = aws_dynamodb_table.report_schedules.arn
}

output "cache_table_name" {
  description = "DynamoDB cache table name"
  value       = aws_dynamodb_table.report_cache.name
}

output "cache_table_arn" {
  description = "DynamoDB cache table ARN"
  value       = aws_dynamodb_table.report_cache.arn
}

output "metrics_table_name" {
  description = "DynamoDB metrics table name"
  value       = aws_dynamodb_table.metrics.name
}

output "metrics_table_arn" {
  description = "DynamoDB metrics table ARN"
  value       = aws_dynamodb_table.metrics.arn
}

output "reports_bucket_name" {
  description = "S3 bucket name for report exports"
  value       = aws_s3_bucket.reports.bucket
}

output "reports_bucket_arn" {
  description = "S3 bucket ARN for report exports"
  value       = aws_s3_bucket.reports.arn
}

# New Lambda Functions
output "analytics_aggregator_name" {
  description = "Lambda function name for analytics aggregator"
  value       = aws_lambda_function.analytics_aggregator.function_name
}

output "analytics_aggregator_arn" {
  description = "Lambda function ARN for analytics aggregator"
  value       = aws_lambda_function.analytics_aggregator.arn
}

output "analytics_reporter_name" {
  description = "Lambda function name for analytics reporter"
  value       = aws_lambda_function.analytics_reporter.function_name
}

output "analytics_reporter_arn" {
  description = "Lambda function ARN for analytics reporter"
  value       = aws_lambda_function.analytics_reporter.arn
}

output "analytics_query_name" {
  description = "Lambda function name for analytics query"
  value       = aws_lambda_function.analytics_query.function_name
}

output "analytics_query_arn" {
  description = "Lambda function ARN for analytics query"
  value       = aws_lambda_function.analytics_query.arn
}

# Legacy Report Engine
output "report_engine_function_name" {
  description = "Lambda function name for report engine"
  value       = aws_lambda_function.report_engine.function_name
}

output "report_engine_function_arn" {
  description = "Lambda function ARN for report engine"
  value       = aws_lambda_function.report_engine.arn
}

output "report_engine_invoke_arn" {
  description = "Lambda function invoke ARN for API Gateway"
  value       = aws_lambda_function.report_engine.invoke_arn
}

# IAM Role
output "analytics_functions_role_arn" {
  description = "IAM role ARN for analytics functions"
  value       = aws_iam_role.analytics_functions.arn
}

# Monitoring
output "sns_topic_arn" {
  description = "SNS topic ARN for analytics alerts"
  value       = aws_sns_topic.analytics_alerts.arn
}

output "dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = aws_cloudwatch_dashboard.analytics.dashboard_name
}

