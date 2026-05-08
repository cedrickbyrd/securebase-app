output "sns_topic_arn" {
  description = "ARN of the primary alerts SNS topic"
  value       = aws_sns_topic.alerts.arn
}

output "alert_sns_arn" {
  description = "Alias of sns_topic_arn — used by multi-region and cost modules"
  value       = aws_sns_topic.alerts.arn
}

output "alert_router_lambda_arn" {
  description = "ARN of the alert-router Lambda"
  value       = aws_lambda_function.alert_router.arn
}

output "aurora_alarm_arns" {
  description = "CloudWatch alarm ARNs for Aurora alarms created by this module"
  value = concat(
    aws_cloudwatch_metric_alarm.aurora_cpu_db[*].arn,
    aws_cloudwatch_metric_alarm.aurora_connections[*].arn,
    aws_cloudwatch_metric_alarm.aurora_replica_lag[*].arn,
    aws_cloudwatch_metric_alarm.aurora_deadlocks[*].arn,
    aws_cloudwatch_metric_alarm.aurora_freeable_memory[*].arn,
    aws_cloudwatch_metric_alarm.aurora_storage_pct[*].arn
  )
}

output "dynamodb_alarm_arns" {
  description = "CloudWatch alarm ARNs for DynamoDB alarms created by this module"
  value = concat(
    [for alarm in values(aws_cloudwatch_metric_alarm.dynamodb_system_errors) : alarm.arn],
    [for alarm in values(aws_cloudwatch_metric_alarm.dynamodb_user_errors) : alarm.arn],
    [for alarm in values(aws_cloudwatch_metric_alarm.dynamodb_throttled_requests) : alarm.arn],
    [for alarm in values(aws_cloudwatch_metric_alarm.dynamodb_latency_get) : alarm.arn],
    [for alarm in values(aws_cloudwatch_metric_alarm.dynamodb_latency_put) : alarm.arn]
  )
}

output "cache_alarm_arns" {
  description = "CloudWatch alarm ARNs for ElastiCache alarms created by this module"
  value = concat(
    aws_cloudwatch_metric_alarm.cache_cpu[*].arn,
    aws_cloudwatch_metric_alarm.cache_evictions[*].arn,
    aws_cloudwatch_metric_alarm.cache_connections[*].arn,
    aws_cloudwatch_metric_alarm.cache_memory_pct[*].arn,
    aws_cloudwatch_metric_alarm.cache_replication_lag[*].arn
  )
}
