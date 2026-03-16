# ../../modules/securebase/outputs.tf

output "organization_id" {
  value = aws_organizations_organization.main.id
}

output "organization_arn" {
  value = aws_organizations_organization.main.arn
}

output "security_ou_id" {
  value = aws_organizations_organizational_unit.security.id
}

output "shared_ou_id" {
  value = aws_organizations_organizational_unit.shared.id
}

output "workloads_ou_id" {
  value = aws_organizations_organizational_unit.workloads.id
}

output "client_account_ids" {
  value = [for acc in aws_organizations_account.clients : acc.id]
}

output "client_details" {
  value = {
    for acc in aws_organizations_account.clients : acc.name => acc.id
  }
}

output "customer_ou_ids" {
  value = aws_organizations_organizational_unit.customers[*].id
}
