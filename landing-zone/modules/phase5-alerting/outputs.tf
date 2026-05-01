output "sns_topic_arns" {
  description = "ARNs of all alerting SNS topics by severity"
  value = {
    critical = aws_sns_topic.critical.arn
    high     = aws_sns_topic.high.arn
    medium   = aws_sns_topic.medium.arn
    low      = aws_sns_topic.low.arn
  }
}

output "critical_topic_arn" {
  description = "ARN of the critical severity SNS topic"
  value       = aws_sns_topic.critical.arn
}

output "high_topic_arn" {
  description = "ARN of the high severity SNS topic"
  value       = aws_sns_topic.high.arn
}

output "alert_dispatcher_function_name" {
  description = "Name of the alert dispatcher Lambda function"
  value       = aws_lambda_function.alert_dispatcher.function_name
}

output "alert_dispatcher_function_arn" {
  description = "ARN of the alert dispatcher Lambda function"
  value       = aws_lambda_function.alert_dispatcher.arn
}

output "composite_alarm_arns" {
  description = "ARNs of composite alarms"
  value = {
    service_degraded     = aws_cloudwatch_composite_alarm.service_degraded.arn
    performance_degraded = aws_cloudwatch_composite_alarm.performance_degraded.arn
  }
}

output "alarm_count" {
  description = "Total number of individual CloudWatch metric alarms deployed"
  value       = 21
}

output "alerting_dashboard_name" {
  description = "Name of the alerting overview CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.alerting_overview.dashboard_name
}
