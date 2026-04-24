output "global_cluster_id" {
<<<<<<< HEAD
  description = "ID of the Aurora Global Database cluster"
  value       = aws_rds_global_cluster.securebase.id
}

output "secondary_aurora_endpoint" {
  description = "Endpoint of the secondary Aurora cluster (read-only)"
  value       = aws_rds_cluster.secondary.endpoint
}

output "secondary_aurora_reader_endpoint" {
  description = "Reader endpoint of the secondary Aurora cluster"
  value       = aws_rds_cluster.secondary.reader_endpoint
}

output "secondary_api_gateway_id" {
  description = "ID of the secondary region API Gateway"
  value       = aws_api_gateway_rest_api.secondary.id
}

output "secondary_api_gateway_endpoint" {
  description = "Invoke URL of the secondary API Gateway stage"
  value       = aws_api_gateway_stage.secondary.invoke_url
}

output "secondary_api_fqdn_from_stage" {
  description = "Derived FQDN for the secondary API stage"
  value       = "${aws_api_gateway_rest_api.secondary.id}.execute-api.${var.secondary_region}.amazonaws.com"
}

output "primary_health_check_id" {
  description = "Route 53 health check ID for the primary region"
  value       = aws_route53_health_check.primary.id
}

output "secondary_health_check_id" {
  description = "Route 53 health check ID for the secondary region"
  value       = aws_route53_health_check.secondary.id
}

output "audit_logs_secondary_bucket" {
  description = "Name of the secondary-region audit logs S3 bucket"
  value       = aws_s3_bucket.audit_logs_secondary.bucket
}

output "reports_secondary_bucket" {
  description = "Name of the secondary-region reports S3 bucket"
  value       = aws_s3_bucket.reports_secondary.bucket
}

output "cloudfront_distribution_domain" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.api.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.api.id
}

output "dynamodb_global_table_names" {
  description = "Names of the DynamoDB Global Tables"
  value = {
    metrics_history       = aws_dynamodb_table.metrics_history_global.name
    compliance_violations = aws_dynamodb_table.compliance_violations_global.name
    audit_trail           = aws_dynamodb_table.audit_trail_global.name
  }
=======
  value = aws_rds_global_cluster.securebase.id
}

output "secondary_aurora_endpoint" {
  value = aws_rds_cluster.secondary.endpoint
}

output "secondary_aurora_reader_endpoint" {
  value = aws_rds_cluster.secondary.reader_endpoint
}

output "health_check_aggregator_arn" {
  value = aws_lambda_function.health_check_aggregator.arn
}

output "failover_orchestrator_arn" {
  value = aws_lambda_function.failover_orchestrator.arn
}

output "failback_orchestrator_arn" {
  value = aws_lambda_function.failback_orchestrator.arn
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
}
