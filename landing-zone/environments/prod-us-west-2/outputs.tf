output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "primary_region" {
  description = "Primary region in this DR environment"
  value       = var.target_region
}

output "secondary_region" {
  description = "Secondary region paired with this DR environment"
  value       = var.source_region
}

output "api_gateway_endpoint" {
  description = "Configured standby API endpoint"
  value       = var.secondary_api_endpoint
}

output "aurora_cluster_id" {
  description = "Aurora cluster ID used by DR orchestration"
  value       = var.aurora_cluster_id
}

output "phase5_alerting_sns_topic_arn" {
  description = "SNS topic ARN for alerting"
  value       = module.phase5_alerting.sns_topic_arn
}

output "multi_region_global_cluster_id" {
  description = "Aurora global cluster identifier"
  value       = module.multi_region.global_cluster_id
}

output "multi_region_health_check_ids" {
  description = "Route53 health check IDs"
  value = {
    primary   = module.multi_region.primary_health_check_id
    secondary = module.multi_region.secondary_health_check_id
  }
}

output "multi_region_failover_lambda_arn" {
  description = "Failover orchestrator Lambda ARN"
  value       = module.multi_region.failover_orchestrator_arn
}

output "multi_region_failback_lambda_arn" {
  description = "Failback orchestrator Lambda ARN"
  value       = module.multi_region.failback_orchestrator_arn
}
