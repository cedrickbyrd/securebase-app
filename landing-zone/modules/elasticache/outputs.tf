# ElastiCache Module Outputs

output "replication_group_id" {
  description = "ID of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.redis.id
}

output "primary_endpoint_address" {
  description = "Primary endpoint address (for writes)"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "reader_endpoint_address" {
  description = "Reader endpoint address (for reads with replicas)"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "configuration_endpoint_address" {
  description = "Configuration endpoint for cluster mode"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = 6379
}

output "security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "auth_token_secret_arn" {
  description = "ARN of Secrets Manager secret containing Redis auth token"
  value       = var.auth_token_enabled && var.store_auth_token ? aws_secretsmanager_secret.redis_auth_token[0].arn : null
}

output "log_groups" {
  description = "CloudWatch log groups for Redis logs"
  value = {
    slow_log   = aws_cloudwatch_log_group.redis_slow_log.name
    engine_log = aws_cloudwatch_log_group.redis_engine_log.name
  }
}

output "connection_string" {
  description = "Redis connection string for Lambda environment variables"
  value       = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
  sensitive   = true
}
