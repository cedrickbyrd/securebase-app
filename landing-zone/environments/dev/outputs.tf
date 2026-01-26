output "organization_id" {
  description = "AWS Organization ID"
  value       = module.securebase.organization_id
}

output "organization_arn" {
  description = "AWS Organization ARN"
  value       = module.securebase.organization_arn
}

output "security_ou_id" {
  description = "Security OU ID"
  value       = module.securebase.security_ou_id
}

output "shared_ou_id" {
  description = "Shared Services OU ID"
  value       = module.securebase.shared_ou_id
}

output "workloads_ou_id" {
  description = "Workloads OU ID"
  value       = module.securebase.workloads_ou_id
}

output "client_account_ids" {
  description = "Map of client names to their AWS account IDs"
  value       = module.securebase.client_account_ids
}

output "client_details" {
  description = "Detailed information about deployed clients"
  value       = module.securebase.client_details
}

output "customer_ou_ids" {
  description = "Map of customer tier OUs to their IDs"
  value       = module.securebase.customer_ou_ids
}

output "central_log_bucket" {
  description = "Central logging S3 bucket name"
  value       = module.securebase.central_log_bucket
}

# Phase 4: Analytics Module Outputs
output "analytics_reports_table" {
  description = "DynamoDB reports table name"
  value       = try(module.analytics.reports_table_name, null)
}

output "analytics_schedules_table" {
  description = "DynamoDB schedules table name"
  value       = try(module.analytics.schedules_table_name, null)
}

output "analytics_cache_table" {
  description = "DynamoDB cache table name"
  value       = try(module.analytics.cache_table_name, null)
}

output "analytics_metrics_table" {
  description = "DynamoDB metrics table name"
  value       = try(module.analytics.metrics_table_name, null)
}

output "analytics_reports_bucket" {
  description = "S3 bucket for report exports"
  value       = try(module.analytics.reports_bucket_name, null)
}

output "analytics_lambda_function" {
  description = "Report engine Lambda function name"
  value       = try(module.analytics.report_engine_function_name, null)
}
