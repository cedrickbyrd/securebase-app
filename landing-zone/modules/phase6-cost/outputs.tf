output "cost_per_tenant_lambda_name" {
  description = "Name of the Phase 6 Track 5 cost-per-tenant Lambda function"
  value       = aws_lambda_function.cost_per_tenant.function_name
}

output "cost_per_tenant_lambda_arn" {
  description = "ARN of the Phase 6 Track 5 cost-per-tenant Lambda function"
  value       = aws_lambda_function.cost_per_tenant.arn
}

output "cost_per_tenant_lambda_version" {
  description = "Published version of the cost-per-tenant Lambda (used for provisioned concurrency)"
  value       = aws_lambda_function.cost_per_tenant.version
}

output "cost_per_tenant_table_name" {
  description = "DynamoDB table name for per-tenant daily cost history"
  value       = local.cost_table_name
}

output "cost_reports_bucket_name" {
  description = "S3 bucket name for monthly cost report exports"
  value       = aws_s3_bucket.cost_reports.id
}

output "cost_reports_bucket_arn" {
  description = "ARN of the monthly cost report S3 bucket"
  value       = aws_s3_bucket.cost_reports.arn
}

output "monthly_cost_alarm_arn" {
  description = "ARN of the CloudWatch alarm for per-tenant monthly cost threshold"
  value       = aws_cloudwatch_metric_alarm.max_tenant_monthly_cost.arn
}
