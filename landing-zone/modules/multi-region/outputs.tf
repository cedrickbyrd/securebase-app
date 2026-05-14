output "global_cluster_id" {
  description = "ID of the Aurora Global Database cluster"
  value       = aws_rds_global_cluster.securebase.id
}

output "secondary_aurora_endpoint" {
  description = "Endpoint of the secondary Aurora cluster (empty if secondary not deployed)"
  value       = length(aws_rds_cluster.secondary) > 0 ? aws_rds_cluster.secondary[0].endpoint : ""
}

output "secondary_aurora_reader_endpoint" {
  description = "Reader endpoint of the secondary Aurora cluster"
  value       = length(aws_rds_cluster.secondary) > 0 ? aws_rds_cluster.secondary[0].reader_endpoint : ""
}

output "health_check_aggregator_arn" {
  description = "ARN of the health-check aggregator Lambda"
  value       = aws_lambda_function.health_check_aggregator.arn
}

output "failover_orchestrator_arn" {
  description = "ARN of the failover orchestrator Lambda"
  value       = aws_lambda_function.failover_orchestrator.arn
}

output "failback_orchestrator_arn" {
  description = "ARN of the failback orchestrator Lambda"
  value       = aws_lambda_function.failback_orchestrator.arn
}

output "primary_health_check_id" {
  description = "Route 53 health check ID for the primary region (empty if Route 53 not configured)"
  value       = length(aws_route53_health_check.primary) > 0 ? aws_route53_health_check.primary[0].id : ""
}

output "secondary_health_check_id" {
  description = "Route 53 health check ID for the secondary region"
  value       = length(aws_route53_health_check.secondary) > 0 ? aws_route53_health_check.secondary[0].id : ""
}

output "secondary_aurora_cluster_endpoint" {
  description = "Writer endpoint of the secondary Aurora cluster (empty if secondary not deployed)"
  value       = try(aws_rds_cluster.secondary[0].endpoint, "")
}

output "dr_validation_script" {
  description = "Path to the DR validation script"
  value       = "landing-zone/modules/multi-region/dr-validation.sh"
}

output "secondary_health_endpoint" {
  description = "URL of the secondary region /health endpoint for Route53 health checks"
  value       = try("${aws_apigatewayv2_api.health_secondary.api_endpoint}/health", "")
}

output "dr_drill_lambda_arn" {
  description = "ARN of the DR drill Lambda (monthly EventBridge schedule, Phase 6 / Track 2)"
  value       = aws_lambda_function.dr_drill.arn
}

output "failover_validator_lambda_arn" {
  description = "ARN of the failover validator Lambda"
  value       = aws_lambda_function.failover_validator.arn
}

output "dr_drill_monthly_rule_arn" {
  description = "ARN of the EventBridge rule that triggers the monthly DR drill"
  value       = aws_cloudwatch_event_rule.dr_drill_monthly.arn
}

