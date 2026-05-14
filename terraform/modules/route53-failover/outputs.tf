# ── terraform/modules/route53-failover/outputs.tf ─────────────────────────────
# Phase 6 / Track 2 — Sub-task 2.4: Route53 Health-Check-Based Failover
# ──────────────────────────────────────────────────────────────────────────────

output "primary_health_check_id" {
  description = "Route53 health check ID for the primary region endpoint"
  value       = aws_route53_health_check.primary.id
}

output "secondary_health_check_id" {
  description = "Route53 health check ID for the secondary region endpoint"
  value       = aws_route53_health_check.secondary.id
}

output "primary_health_check_arn" {
  description = "ARN of the Route53 health check for the primary endpoint"
  value       = aws_route53_health_check.primary.arn
}

output "secondary_health_check_arn" {
  description = "ARN of the Route53 health check for the secondary endpoint"
  value       = aws_route53_health_check.secondary.arn
}

output "primary_dns_record_fqdn" {
  description = "FQDN of the primary failover DNS record"
  value       = aws_route53_record.api_primary.fqdn
}

output "secondary_dns_record_fqdn" {
  description = "FQDN of the secondary failover DNS record"
  value       = aws_route53_record.api_secondary.fqdn
}

output "primary_health_alarm_arn" {
  description = "ARN of the CloudWatch alarm monitoring the primary health check"
  value       = aws_cloudwatch_metric_alarm.primary_health_check_failed.arn
}

output "primary_health_alarm_name" {
  description = "Name of the CloudWatch alarm monitoring the primary health check"
  value       = aws_cloudwatch_metric_alarm.primary_health_check_failed.alarm_name
}

output "secondary_health_alarm_arn" {
  description = "ARN of the CloudWatch alarm monitoring the secondary health check"
  value       = aws_cloudwatch_metric_alarm.secondary_health_check_failed.arn
}

output "secondary_health_alarm_name" {
  description = "Name of the CloudWatch alarm monitoring the secondary health check"
  value       = aws_cloudwatch_metric_alarm.secondary_health_check_failed.alarm_name
}
