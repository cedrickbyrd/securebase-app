output "audit_evidence_api_arn" {
  description = "ARN of the audit_evidence_api Lambda"
  value       = aws_lambda_function.audit_evidence_api.arn
}

output "audit_evidence_api_invoke_arn" {
  description = "Invoke ARN of the audit_evidence_api Lambda (used in API Gateway integration)"
  value       = aws_lambda_function.audit_evidence_api.invoke_arn
}

output "audit_evidence_api_name" {
  description = "Name of the audit_evidence_api Lambda"
  value       = aws_lambda_function.audit_evidence_api.function_name
}

output "compliance_history_api_arn" {
  description = "ARN of the compliance_history_api Lambda"
  value       = aws_lambda_function.compliance_history_api.arn
}

output "compliance_history_api_invoke_arn" {
  description = "Invoke ARN of the compliance_history_api Lambda (used in API Gateway integration)"
  value       = aws_lambda_function.compliance_history_api.invoke_arn
}

output "compliance_history_api_name" {
  description = "Name of the compliance_history_api Lambda"
  value       = aws_lambda_function.compliance_history_api.function_name
}

output "lambda_role_arn" {
  description = "ARN of the shared IAM role for phase6 Lambdas"
  value       = aws_iam_role.phase6_lambda.arn
}

output "compliance_score_recalculator_arn" {
  description = "ARN of the compliance_score_recalculator Lambda"
  value       = aws_lambda_function.compliance_score_recalculator.arn
}

output "compliance_score_recalculator_name" {
  description = "Name of the compliance_score_recalculator Lambda"
  value       = aws_lambda_function.compliance_score_recalculator.function_name
}

output "compliance_score_recalculator_log_group" {
  description = "CloudWatch log group name for compliance_score_recalculator"
  value       = aws_cloudwatch_log_group.compliance_score_recalculator.name
}

output "compliance_scores_table_name" {
  description = "Name of the securebase-compliance-scores DynamoDB table"
  value       = aws_dynamodb_table.compliance_scores.name
}

output "control_violation_log_table_name" {
  description = "Name of the control_violation_log DynamoDB table"
  value       = aws_dynamodb_table.control_violation_log.name
}

output "score_recalculator_eventbridge_rule_arn" {
  description = "ARN of the EventBridge rule that triggers the daily score recalculator"
  value       = aws_cloudwatch_event_rule.score_recalculator_daily.arn
}

output "audit_log_packager_arn" {
  description = "ARN of the audit_log_packager Lambda"
  value       = aws_lambda_function.audit_log_packager.arn
}

output "audit_log_packager_name" {
  description = "Name of the audit_log_packager Lambda"
  value       = aws_lambda_function.audit_log_packager.function_name
}

output "audit_log_packager_log_group" {
  description = "CloudWatch log group for audit_log_packager"
  value       = aws_cloudwatch_log_group.audit_log_packager.name
}

output "evidence_packager_eventbridge_rule_arn" {
  description = "ARN of the EventBridge rule that triggers the weekly evidence packager"
  value       = aws_cloudwatch_event_rule.evidence_packager_weekly.arn
}
