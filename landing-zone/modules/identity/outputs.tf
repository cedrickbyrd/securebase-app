output "aws_config_role_arn" {
  value = aws_iam_role.aws_config_role.arn
}

output "admin_permission_set_arn" {
  value = aws_ssoadmin_permission_set.admin.arn
}

output "platform_permission_set_arn" {
  value = aws_ssoadmin_permission_set.platform.arn
}

output "auditor_permission_set_arn" {
  value = aws_ssoadmin_permission_set.auditor.arn
}
