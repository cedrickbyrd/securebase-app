output "organization_id" {
  description = "AWS Organization ID"
  value       = module.org.organization_id
}

output "security_ou_id" {
  description = "Security OU ID - use this in terraform.tfvars"
  value       = module.org.security_ou_id
}

output "shared_ou_id" {
  description = "Shared Services OU ID - use this in terraform.tfvars"
  value       = module.org.shared_ou_id
}

output "workloads_ou_id" {
  description = "Workloads OU ID - use this in terraform.tfvars"
  value       = module.org.workloads_ou_id
}

output "account_ids" {
  description = "Created account IDs"
  value       = module.org.account_ids
}

output "break_glass_role_arn" {
  description = "Break-glass emergency role ARN"
  value       = module.iam.break_glass_role_arn
}
output "organization_console_url" {
  description = "Console login URL for TxImhotep organization"
  value       = module.organization.console_login_url
}

output "organization_account_alias" {
  description = "IAM account alias for the management account"
  value       = module.organization.account_alias
}

# Your existing outputs remain below...
