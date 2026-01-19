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
