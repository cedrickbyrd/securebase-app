output "packager_errors_alarm_arn" {
  description = "ARN of the audit_log_packager Lambda errors alarm"
  value       = aws_cloudwatch_metric_alarm.packager_errors.arn
}

output "packager_stale_alarm_arn" {
  description = "ARN of the audit_log_packager stale vault alarm (no packages in 7 days)"
  value       = aws_cloudwatch_metric_alarm.packager_stale.arn
}

output "packager_completions_metric_filter_name" {
  description = "Name of the CloudWatch log metric filter that tracks successful evidence package completions"
  value       = aws_cloudwatch_log_metric_filter.packager_completions.name
}
