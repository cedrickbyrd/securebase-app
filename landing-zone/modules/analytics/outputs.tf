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
