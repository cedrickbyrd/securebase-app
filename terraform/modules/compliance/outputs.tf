output "evidence_bucket_name" {
  value       = aws_s3_bucket.evidence.bucket
  description = "Immutable evidence bucket name"
}

output "controls_state_history_table_name" {
  value       = aws_dynamodb_table.controls_state_history.name
  description = "Controls state history table"
}

output "compliance_alerts_topic_arn" {
  value       = aws_sns_topic.compliance_alerts.arn
  description = "SNS topic ARN for compliance alerts"
}

output "on_demand_collection_queue_url" {
  value       = aws_sqs_queue.on_demand_collection.url
  description = "SQS queue URL for on-demand collection"
}
