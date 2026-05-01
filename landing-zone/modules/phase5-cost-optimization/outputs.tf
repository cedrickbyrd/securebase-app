output "cost_anomaly_monitor_arn" {
  description = "ARN of the AWS Cost Anomaly Detection monitor"
  value       = aws_ce_anomaly_monitor.securebase.arn
}

output "cost_anomaly_subscription_arn" {
  description = "ARN of the Cost Anomaly Detection subscription"
  value       = aws_ce_anomaly_subscription.securebase.arn
}

output "cloudfront_cache_policy_id" {
  description = "ID of the optimized CloudFront cache policy"
  value       = aws_cloudfront_cache_policy.api_optimized.id
}

output "aurora_scheduler_role_arn" {
  description = "ARN of the EventBridge Scheduler IAM role"
  value       = aws_iam_role.scheduler.arn
}

output "cost_dashboard_name" {
  description = "Name of the cost optimization CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.cost_optimization.dashboard_name
}
