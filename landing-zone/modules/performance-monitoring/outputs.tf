# Performance Monitoring Module Outputs

output "performance_dashboard_name" {
  description = "Name of the performance CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.performance.dashboard_name
}

output "performance_dashboard_arn" {
  description = "ARN of the performance CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.performance.dashboard_arn
}

output "uptime_dashboard_name" {
  description = "Name of the uptime CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.uptime.dashboard_name
}

output "uptime_dashboard_arn" {
  description = "ARN of the uptime CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.uptime.dashboard_arn
}

output "performance_metrics_log_group" {
  description = "CloudWatch log group for custom performance metrics"
  value       = aws_cloudwatch_log_group.performance_metrics.name
}

output "sns_topic_arn" {
  description = "ARN of SNS topic for performance alerts (if created)"
  value       = var.create_sns_topic ? aws_sns_topic.performance_alerts[0].arn : null
}

output "dashboard_urls" {
  description = "URLs to access CloudWatch dashboards"
  value = {
    performance = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.performance.dashboard_name}"
    uptime      = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.uptime.dashboard_name}"
  }
}

output "alarm_names" {
  description = "Names of created CloudWatch alarms"
  value = {
    api_latency_p95        = aws_cloudwatch_metric_alarm.api_latency_p95.alarm_name
    lambda_errors          = aws_cloudwatch_metric_alarm.lambda_errors.alarm_name
    lambda_throttles       = aws_cloudwatch_metric_alarm.lambda_throttles.alarm_name
    api_5xx_errors         = aws_cloudwatch_metric_alarm.api_5xx_errors.alarm_name
    dynamodb_read_throttles = aws_cloudwatch_metric_alarm.dynamodb_read_throttles.alarm_name
    dynamodb_write_throttles = aws_cloudwatch_metric_alarm.dynamodb_write_throttles.alarm_name
  }
}
