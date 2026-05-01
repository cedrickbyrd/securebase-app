output "global_cluster_id" {
  description = "Aurora Global Database cluster ID"
  value       = module.multi_region.global_cluster_id
}

output "secondary_api_gateway_endpoint" {
  description = "Secondary region API Gateway invoke URL"
  value       = module.multi_region.secondary_api_gateway_endpoint
}

output "cloudfront_distribution_domain" {
  description = "CloudFront API distribution domain"
  value       = module.multi_region.cloudfront_distribution_domain
}

output "health_check_ids" {
  description = "Route 53 health check IDs"
  value = {
    primary   = module.multi_region.primary_health_check_id
    secondary = module.multi_region.secondary_health_check_id
  }
}

output "dynamodb_global_table_names" {
  description = "Global DynamoDB table names"
  value       = module.multi_region.dynamodb_global_table_names
}
