# Outputs for Phase 6.1 Audit Logging Module

output "evidence_bucket_arn" {
  description = "ARN of the S3 evidence bucket (Object Lock enabled)"
  value       = aws_s3_bucket.evidence.arn
}

output "evidence_bucket_name" {
  description = "Name of the S3 evidence bucket"
  value       = aws_s3_bucket.evidence.id
}

output "evidence_bucket_domain_name" {
  description = "Regional domain name of the evidence bucket"
  value       = aws_s3_bucket.evidence.bucket_regional_domain_name
}

output "kms_key_id" {
  description = "ID of the KMS key used to encrypt evidence objects"
  value       = aws_kms_key.evidence.key_id
}

output "kms_key_arn" {
  description = "ARN of the KMS key used to encrypt evidence objects"
  value       = aws_kms_key.evidence.arn
}

output "kms_key_alias" {
  description = "Alias name of the KMS key"
  value       = aws_kms_alias.evidence.name
}

output "lambda_role_arn" {
  description = "ARN of the IAM role for the audit_log_packager Lambda function"
  value       = aws_iam_role.audit_packager_lambda.arn
}

output "lambda_role_name" {
  description = "Name of the IAM role for the audit_log_packager Lambda function"
  value       = aws_iam_role.audit_packager_lambda.name
}

output "macie_findings_topic_arn" {
  description = "ARN of the SNS topic for Macie PII findings alerts"
  value       = aws_sns_topic.macie_findings.arn
}

output "object_lock_retention_days" {
  description = "Number of days that evidence objects are retained under Object Lock COMPLIANCE mode"
  value       = var.object_lock_retention_days
}
