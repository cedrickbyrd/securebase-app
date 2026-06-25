output "organization_id" {
  description = "The ID of the AWS Organization"
  value       = module.organization.organization_id
}

output "organization_arn" {
  description = "The ARN of the AWS Organization"
  value       = module.organization.organization_arn
}

output "security_ou_id" {
  value = module.organization.security_ou_id
}

output "shared_ou_id" {
  value = module.organization.shared_ou_id
}

output "workloads_ou_id" {
  value = module.organization.workloads_ou_id
}

output "netlify_observer_access_key" {
  description = "Access Key for Netlify Functions to read AWS Telemetry"
  value       = aws_iam_access_key.netlify_observer_keys.id
}

output "netlify_observer_secret_key" {
  description = "Secret Key for Netlify Functions (SENSITIVE)"
  value       = aws_iam_access_key.netlify_observer_keys.secret
  sensitive   = true
}

output "central_log_bucket" {
  value = module.central_logging.central_log_bucket_name
}

output "api_gateway_endpoint" {
  value = try(module.api_gateway.api_gateway_endpoint, "Not deployed")
}

output "api_endpoints" {
  description = "Map of all API Gateway endpoint URLs"
  value       = try(module.api_gateway.api_endpoints, {})
}

output "admin_metrics_api_url" {
  value       = try("${module.api_gateway.api_gateway_endpoint}/admin", "Not deployed")
  description = "Live CloudWatch metrics endpoint for Phase 5.1 Admin Dashboard"
}

output "client_account_ids" {
  value = { for k, v in aws_organizations_account.clients : k => v.id }
}

output "customer_account_ids" {
  description = "Auto-assigned AWS account IDs for each customer (use after terraform apply)"
  value = {
    for client_key, account in aws_organizations_account.clients :
    client_key => account.id
  }
}

output "client_details" {
  description = "Full customer account details including auto-assigned IDs"
  value = { for k, v in aws_organizations_account.clients : k => {
    aws_account_id  = v.id
    aws_account_arn = v.arn
    email           = v.email
    ou_id           = v.parent_id
  }}
}

output "customer_ou_ids" {
  value = {
    healthcare = aws_organizations_organizational_unit.customer_healthcare[0].id
    fintech    = aws_organizations_organizational_unit.customer_fintech[0].id
    govfed     = aws_organizations_organizational_unit.customer_govfed[0].id
    standard   = aws_organizations_organizational_unit.customer_standard[0].id
    sales      = aws_organizations_organizational_unit.customer_sales[0].id
  }
}

output "lambda_role_arn" {
  description = "Lambda execution role ARN from the lambda-functions module"
  value       = module.lambda_functions.lambda_role_arn
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint used by backend Lambdas"
  value       = module.phase2_database.rds_proxy_endpoint
}

output "database_secret_arn" {
  description = "Secrets Manager ARN for database credentials"
  value       = module.phase2_database.database_secret_arn
}

output "marketplace_resolve_lambda_arn" {
  description = "ARN of marketplace resolve lambda when marketplace module is enabled"
  value       = length(module.marketplace) > 0 ? module.marketplace[0].marketplace_resolve_customer_arn : null
}

output "marketplace_resolve_lambda_name" {
  description = "Function name of marketplace resolve lambda when marketplace module is enabled"
  value       = length(module.marketplace) > 0 ? module.marketplace[0].marketplace_resolve_customer_name : null
}

output "lambda_security_group_id" {
  description = "Security group ID used by backend Lambdas"
  value       = module.phase2_database.lambda_security_group_id
}

output "cost_per_tenant_table_name" {
  description = "DynamoDB table storing per-tenant daily costs (Phase 6 Track 5)"
  value       = module.phase5_admin_metrics.cost_per_tenant_table_name
}
