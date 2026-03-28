output "metrics_history_table_name" {
  description = "Name of the metrics history DynamoDB table"
  value       = aws_dynamodb_table.metrics_history.name
}

output "metrics_history_table_arn" {
  description = "ARN of the metrics history DynamoDB table"
  value       = aws_dynamodb_table.metrics_history.arn
}

output "compliance_violations_table_name" {
  description = "Name of the compliance violations DynamoDB table"
  value       = aws_dynamodb_table.compliance_violations.name
}

output "compliance_violations_table_arn" {
  description = "ARN of the compliance violations DynamoDB table"
  value       = aws_dynamodb_table.compliance_violations.arn
}

output "audit_trail_table_name" {
  description = "Name of the audit trail DynamoDB table"
  value       = aws_dynamodb_table.audit_trail.name
}

output "audit_trail_table_arn" {
  description = "ARN of the audit trail DynamoDB table"
  value       = aws_dynamodb_table.audit_trail.arn
}

output "table_names" {
  description = "Map of all table names for easy reference"
  value = {
    metrics_history        = aws_dynamodb_table.metrics_history.name
    compliance_violations  = aws_dynamodb_table.compliance_violations.name
    audit_trail           = aws_dynamodb_table.audit_trail.name
  }
}
