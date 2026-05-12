# ── terraform/modules/aurora-global/outputs.tf ────────────────────────────────
# Phase 6 / Track 2 — Sub-task 2.1: Aurora Global Database
# ──────────────────────────────────────────────────────────────────────────────

output "global_cluster_id" {
  description = "Identifier of the Aurora Global Database cluster"
  value       = aws_rds_global_cluster.this.id
}

output "global_cluster_arn" {
  description = "ARN of the Aurora Global Database cluster"
  value       = aws_rds_global_cluster.this.arn
}

output "secondary_cluster_id" {
  description = "Identifier of the secondary (us-west-2) Aurora cluster (empty when secondary not deployed)"
  value       = length(aws_rds_cluster.secondary) > 0 ? aws_rds_cluster.secondary[0].id : ""
}

output "secondary_cluster_arn" {
  description = "ARN of the secondary Aurora cluster"
  value       = length(aws_rds_cluster.secondary) > 0 ? aws_rds_cluster.secondary[0].arn : ""
}

output "secondary_cluster_endpoint" {
  description = "Writer endpoint of the secondary Aurora cluster (available after promotion)"
  value       = length(aws_rds_cluster.secondary) > 0 ? aws_rds_cluster.secondary[0].endpoint : ""
}

output "secondary_cluster_reader_endpoint" {
  description = "Reader endpoint of the secondary Aurora cluster"
  value       = length(aws_rds_cluster.secondary) > 0 ? aws_rds_cluster.secondary[0].reader_endpoint : ""
}

output "secondary_kms_key_arn" {
  description = "ARN of the KMS key used for secondary-region Aurora encryption"
  value       = aws_kms_key.secondary_aurora.arn
}

output "secondary_kms_key_alias" {
  description = "Alias of the secondary-region KMS key"
  value       = aws_kms_alias.secondary_aurora.name
}

output "replication_lag_alarm_arn" {
  description = "ARN of the CloudWatch alarm monitoring Aurora Global replication lag"
  value       = aws_cloudwatch_metric_alarm.replication_lag.arn
}

output "replication_lag_alarm_name" {
  description = "Name of the CloudWatch alarm monitoring Aurora Global replication lag"
  value       = aws_cloudwatch_metric_alarm.replication_lag.alarm_name
}
