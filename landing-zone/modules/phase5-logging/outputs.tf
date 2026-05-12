output "kms_key_arn" {
  description = "ARN of the KMS key used to encrypt CloudWatch log groups"
  value       = aws_kms_key.logs.arn
}

output "kms_key_id" {
  description = "ID of the KMS key"
  value       = aws_kms_key.logs.key_id
}

output "lambda_log_group_arns" {
  description = "Map of Lambda function name → CloudWatch log group ARN"
  value       = { for fn, lg in aws_cloudwatch_log_group.lambda : fn => lg.arn }
}

output "audit_log_group_name" {
  description = "Name of the centralised audit log group (HIPAA/SOC 2 trail)"
  value       = aws_cloudwatch_log_group.audit.name
}

output "application_log_group_name" {
  description = "Name of the general application log group"
  value       = aws_cloudwatch_log_group.application.name
}

output "xray_group_arn" {
  description = "ARN of the admin X-Ray group"
  value       = aws_xray_group.admin.arn
}

output "xray_group_arns" {
  description = "ARNs of X-Ray groups by service"
  value = {
    admin         = aws_xray_group.admin.arn
    tenant_metrics = aws_xray_group.tenant_metrics.arn
    compliance    = aws_xray_group.compliance.arn
  }
}

output "xray_sampling_rule_name" {
  description = "Name of the baseline X-Ray sampling rule"
  value       = aws_xray_sampling_rule.baseline.rule_name
}
