output "anomaly_monitor_arn" {
  value = aws_ce_anomaly_monitor.securebase.arn
}

output "anomaly_subscription_arn" {
  value = aws_ce_anomaly_subscription.securebase.arn
}
