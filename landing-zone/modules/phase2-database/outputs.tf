output "rds_cluster_endpoint" {
  description = "Aurora cluster endpoint (writer)"
  value       = aws_rds_cluster.phase2_postgres.endpoint
}

output "rds_cluster_reader_endpoint" {
  description = "Aurora cluster reader endpoint"
  value       = aws_rds_cluster.phase2_postgres.reader_endpoint
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint for Lambda connections"
  value       = aws_db_proxy.phase2.endpoint
}

output "rds_database_name" {
  description = "PostgreSQL database name"
  value       = "securebase"
}

output "rds_port" {
  description = "PostgreSQL port"
  value       = 5432
}

output "dynamodb_metrics_table" {
  description = "DynamoDB metrics table name"
  value       = aws_dynamodb_table.metrics.name
}

output "dynamodb_events_table" {
  description = "DynamoDB events table name"
  value       = aws_dynamodb_table.events.name
}

output "dynamodb_cache_table" {
  description = "DynamoDB cache table name"
  value       = aws_dynamodb_table.cache.name
}

output "rds_admin_secret_arn" {
  description = "ARN of RDS admin password secret"
  value       = aws_secretsmanager_secret.rds_admin_password.arn
}

output "database_secret_arn" {
  description = "ARN of database application user secret (for Lambda functions)"
  value       = aws_secretsmanager_secret.rds_admin_password.arn
}

output "kms_key_id" {
  description = "KMS key ID for RDS/data encryption"
  value       = aws_kms_key.rds.key_id
}

output "lambda_security_group_id" {
  description = "Security group ID for Lambda functions"
  value       = aws_security_group.lambda.id
}

output "customers_table_name" {
  description = "DynamoDB customers table name"
  value       = "securebase-${var.environment}-customers"
}

output "jwt_secret_arn" {
  description = "ARN of JWT secret in Secrets Manager"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "rds_security_group_id" {
  description = "Security group ID for RDS cluster"
  value       = aws_security_group.rds.id
}

# ============================================
# Phase 3b Outputs
# ============================================

output "support_tickets_table_name" {
  description = "DynamoDB support tickets table name"
  value       = aws_dynamodb_table.support_tickets.name
}

output "ticket_comments_table_name" {
  description = "DynamoDB ticket comments table name"
  value       = aws_dynamodb_table.ticket_comments.name
}

output "notifications_table_name" {
  description = "DynamoDB notifications table name"
  value       = aws_dynamodb_table.notifications.name
}

output "cost_forecasts_table_name" {
  description = "DynamoDB cost forecasts table name"
  value       = aws_dynamodb_table.cost_forecasts.name
}
