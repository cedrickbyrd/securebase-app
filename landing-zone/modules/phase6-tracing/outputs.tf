output "xray_group_arns" {
  description = "Phase 6 Track 4 X-Ray groups by tenant segment"
  value       = { for name, group in aws_xray_group.tenant_segments : name => group.arn }
}

output "lambda_duration_alarm_arns" {
  description = "Anomaly alarm ARNs for Lambda p99 duration"
  value       = { for name, alarm in aws_cloudwatch_metric_alarm.lambda_duration_p99_anomaly : name => alarm.arn }
}

output "lambda_error_rate_alarm_arns" {
  description = "Anomaly alarm ARNs for Lambda error rates"
  value       = { for name, alarm in aws_cloudwatch_metric_alarm.lambda_error_rate_anomaly : name => alarm.arn }
}

output "api_gateway_anomaly_alarm_arns" {
  description = "Anomaly alarm ARNs for API Gateway 4xx/5xx rates"
  value = {
    api_4xx = aws_cloudwatch_metric_alarm.api_gateway_4xx_rate_anomaly.arn
    api_5xx = aws_cloudwatch_metric_alarm.api_gateway_5xx_rate_anomaly.arn
  }
}
