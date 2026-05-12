# ── terraform/modules/dynamodb-global/outputs.tf ──────────────────────────────
# Phase 6 / Track 2 — Sub-task 2.2: DynamoDB Global Tables
# ──────────────────────────────────────────────────────────────────────────────

output "replica_table_arns" {
  description = "Map of table name to ARN of the replica in the secondary region"
  value = {
    for k, v in aws_dynamodb_table_replica.this : k => v.arn
  }
}

output "replica_kms_key_arn" {
  description = "ARN of the replica CMK in the secondary region (empty when AWS-managed keys are used)"
  value       = length(aws_kms_replica_key.dynamodb_secondary) > 0 ? aws_kms_replica_key.dynamodb_secondary[0].arn : ""
}

output "replica_kms_key_id" {
  description = "Key ID of the replica CMK in the secondary region"
  value       = length(aws_kms_replica_key.dynamodb_secondary) > 0 ? aws_kms_replica_key.dynamodb_secondary[0].key_id : ""
}

output "replication_alarm_names" {
  description = "Names of the CloudWatch replication latency alarms (one per table)"
  value       = [for a in aws_cloudwatch_metric_alarm.replication_latency : a.alarm_name]
}

output "table_names" {
  description = "List of DynamoDB table names that have been replicated"
  value       = var.table_names
}
