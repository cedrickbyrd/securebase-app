# Outputs for Phase 5 Admin Metrics Module

output "lambda_function_name" {
  description = "Name of the admin metrics Lambda function"
  value       = aws_lambda_function.admin_metrics.function_name
}

output "lambda_function_arn" {
  description = "ARN of the admin metrics Lambda function"
  value       = aws_lambda_function.admin_metrics.arn
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
