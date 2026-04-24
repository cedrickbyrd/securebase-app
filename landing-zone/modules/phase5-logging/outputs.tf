<<<<<<< HEAD
output "log_group_names" {
  description = "Map of service name to CloudWatch log group name"
  value = {
    for svc, lg in aws_cloudwatch_log_group.service_logs :
    svc => lg.name
  }
}

output "log_group_arns" {
  description = "Map of service name to CloudWatch log group ARN"
  value = {
    for svc, lg in aws_cloudwatch_log_group.service_logs :
    svc => lg.arn
  }
}

output "api_gateway_access_log_group_arn" {
  description = "ARN of the API Gateway access log group"
  value       = aws_cloudwatch_log_group.api_gateway_access.arn
}

output "api_gateway_access_log_group_name" {
  description = "Name of the API Gateway access log group"
  value       = aws_cloudwatch_log_group.api_gateway_access.name
}

output "xray_sampling_rule_name" {
  description = "Name of the default X-Ray sampling rule"
  value       = aws_xray_sampling_rule.securebase.rule_name
}

output "xray_group_arns" {
  description = "ARNs of X-Ray groups"
  value = {
    api_gateway = aws_xray_group.api_gateway.arn
    auth        = aws_xray_group.auth.arn
    database    = aws_xray_group.database.arn
    errors      = aws_xray_group.errors.arn
  }
}

output "insights_query_count" {
  description = "Number of CloudWatch Logs Insights saved queries deployed"
  value       = 21
=======
output "kms_key_arn" {
  description = "KMS key ARN used for log encryption"
  value       = aws_kms_key.logs.arn
}

output "kms_key_id" {
  description = "KMS key ID"
  value       = aws_kms_key.logs.key_id
}

output "lambda_log_group_arns" {
  description = "Map of Lambda function name to log group ARN"
  value       = { for fn, lg in aws_cloudwatch_log_group.lambda : fn => lg.arn }
}

output "audit_log_group_name" {
  description = "Audit log group name for HIPAA trail"
  value       = aws_cloudwatch_log_group.audit.name
}

output "application_log_group_name" {
  description = "Application log group name"
  value       = aws_cloudwatch_log_group.application.name
}

output "xray_group_arn" {
  description = "X-Ray group ARN"
  value       = aws_xray_group.securebase.arn
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
}
