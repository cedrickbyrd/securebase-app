output "organization_id" {
  description = "AWS Organization ID"
  value       = aws_organizations_organization.this.id
}

output "organization_arn" {
  description = "AWS Organization ARN"
  value       = aws_organizations_organization.this.arn
}

output "security_ou_id" {
  description = "Security OU ID"
  value       = module.organization.security_ou_id
}

output "shared_ou_id" {
  description = "Shared Services OU ID"
  value       = module.organization.shared_ou_id
}

output "workloads_ou_id" {
  description = "Workloads OU ID"
  value       = module.organization.workloads_ou_id
}

output "account_ids" {
  description = "Map of account names to IDs"
  value = {
    for name, account in aws_organizations_account.accounts :
    name => account.id
  }
}

# --- Multi-Tenant Outputs ---

output "customer_ou_ids" {
  description = "Map of customer tier OUs to their IDs"
  value = {
    healthcare   = try(aws_organizations_organizational_unit.customer_healthcare[0].id, null)
    fintech      = try(aws_organizations_organizational_unit.customer_fintech[0].id, null)
    gov_federal  = try(aws_organizations_organizational_unit.customer_govfed[0].id, null)
    standard     = try(aws_organizations_organizational_unit.customer_standard[0].id, null)
  }
}

output "client_account_ids" {
  description = "Map of client names to their AWS account IDs"
  value = {
    for name, account in aws_organizations_account.clients :
    name => account.id
  }
}

output "client_details" {
  description = "Detailed information about deployed clients"
  value = {
    for client_name, client_config in var.clients :
    client_name => {
      account_id = try(aws_organizations_account.clients[client_name].id, null)
      tier       = client_config.tier
      framework  = client_config.framework
      prefix     = client_config.prefix
      ou_id      = try(local.tier_to_ou_id[client_config.tier], null)
    }
  }
}

output "central_log_bucket" {
  description = "Central logging S3 bucket name"
  value       = module.central_logging.central_log_bucket_name
}

output "compliance_summary" {
  description = "Compliance and security posture summary"
  value = {
    framework = "Multi-tenant PaaS"
    controls  = {
      restrict_root          = true
      block_iam_users        = true
      enforce_mfa            = true
      centralized_logging    = true
      config_enabled         = true
      guardduty_enabled      = true
      securityhub_enabled    = true
    }
    deployed_at = timestamp()
  }
}

# --- Phase 4: Analytics Outputs ---

output "analytics_report_engine_arn" {
  description = "ARN of the report engine Lambda function"
  value       = try(module.analytics.report_engine_function_arn, null)
}

output "analytics_dynamodb_tables" {
  description = "Map of Analytics DynamoDB table names"
  value = try({
    reports   = module.analytics.reports_table_name
    schedules = module.analytics.schedules_table_name
    cache     = module.analytics.cache_table_name
    metrics   = module.analytics.metrics_table_name
  }, {})
}

output "analytics_s3_bucket" {
  description = "S3 bucket name for report exports"
  value       = try(module.analytics.reports_bucket_name, null)
}

# --- Phase 2: Database & API Outputs ---

output "rds_cluster_endpoint" {
  description = "Aurora PostgreSQL cluster endpoint (writer)"
  value       = try(module.phase2_database.rds_cluster_endpoint, null)
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint for Lambda connections"
  value       = try(module.phase2_database.rds_proxy_endpoint, null)
}

output "database_name" {
  description = "PostgreSQL database name"
  value       = try(module.phase2_database.rds_database_name, "securebase")
}

output "api_gateway_endpoint" {
  description = "API Gateway base URL"
  value       = try(module.api_gateway.api_gateway_endpoint, "Not deployed yet")
}

output "phase2_dynamodb_tables" {
  description = "Phase 2 DynamoDB table names"
  value = try({
    metrics = module.phase2_database.dynamodb_metrics_table
    events  = module.phase2_database.dynamodb_events_table
    cache   = module.phase2_database.dynamodb_cache_table
  }, {})
}
