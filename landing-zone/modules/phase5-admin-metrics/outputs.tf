# Outputs for Phase 5 Admin Metrics Module

output "lambda_function_name" {
  description = "Name of the admin metrics Lambda function"
  value       = aws_lambda_function.admin_metrics.function_name
}

output "lambda_function_arn" {
  description = "ARN of the admin metrics Lambda function"
  value       = aws_lambda_function.admin_metrics.arn
}

output "lambda_function_version" {
  description = "Published version of the admin metrics Lambda function"
  value       = aws_lambda_function.admin_metrics.version
}

output "cost_per_tenant_lambda_name" {
  description = "Name of the Phase 6 Track 5 cost-per-tenant aggregation Lambda"
  value       = aws_lambda_function.cost_per_tenant.function_name
}

output "cost_per_tenant_lambda_arn" {
  description = "ARN of the Phase 6 Track 5 cost-per-tenant aggregation Lambda"
  value       = aws_lambda_function.cost_per_tenant.arn
}

output "cost_per_tenant_table_name" {
  description = "DynamoDB table storing per-tenant daily costs"
  value       = aws_dynamodb_table.cost_per_tenant.name
}

output "admin_resource_id" {
  description = "ID of the /admin API Gateway resource"
  value       = aws_api_gateway_resource.admin.id
}

output "admin_metrics_endpoints" {
  description = "Map of admin metrics endpoints"
  value = {
    metrics         = "/admin/metrics"
    customers       = "/admin/customers"
    api_performance = "/admin/api-performance"
    infrastructure  = "/admin/infrastructure"
    security        = "/admin/security"
    costs           = "/admin/costs"
    deployments     = "/admin/deployments"
  }
}
