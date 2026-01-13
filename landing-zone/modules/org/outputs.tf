output "workloads_ou_id" { value = aws_organizations_organizational_unit.workloads.id }
output "shared_ou_id"    { value = aws_organizations_organizational_unit.shared.id }
output "security_ou_id"  { value = aws_organizations_organizational_unit.security.id }
output "guardrails_policy_id" {
  value = aws_organizations_policy.security_guardrails.id
}
output "block_iam_policy_id" {
  value = aws_organizations_policy.block_iam_users.id
}
output "account_alias" {
  description = "IAM account alias for the management account"
  value       = aws_iam_account_alias.management.account_alias
}

output "console_login_url" {
  description = "Console login URL using the account alias"
  value       = "https://${aws_iam_account_alias.management.account_alias}.signin.aws.amazon.com/console"
}

# Your existing outputs remain below...
output "organization_id" {
  description = "The ID of the AWS Organization"
  value       = aws_organizations_organization.main.id
}

# ... rest of existing outputs ...
