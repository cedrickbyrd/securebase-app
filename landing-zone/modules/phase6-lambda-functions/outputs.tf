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
