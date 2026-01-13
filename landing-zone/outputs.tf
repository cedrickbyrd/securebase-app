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
