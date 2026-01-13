output "sso_instance_arn" {
  description = "IAM Identity Center instance ARN"
  value       = local.sso_instance_arn
}

output "admin_permission_set_arn" {
  description = "Admin permission set ARN"
  value       = aws_ssoadmin_permission_set.admin.arn
}

output "platform_permission_set_arn" {
  description = "Platform Engineer permission set ARN"
  value       = aws_ssoadmin_permission_set.platform.arn
}

#output "auditor_permission_set_arn" {
#  description = "Auditor permission set ARN"
#  value       = aws_ssoadmin_permission_set.auditor.arn
#}

output "break_glass_role_arn" {
  description = "Break-glass role ARN"
  value       = aws_iam_role.break_glass.arn
}
