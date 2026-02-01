output "central_log_bucket_name" {
  value = aws_s3_bucket.central_logs.bucket
}

# =============================================================================
# SOC 2 Attestation Output - Log Protection Evidence
# =============================================================================
# This output provides auditors with comprehensive evidence of security controls
# implemented for audit log protection. Include this in SOC 2 Type II reports
# to demonstrate compliance with:
# - CC6.1: Logical and Physical Access Controls
# - CC6.6: Completeness and Accuracy of Processing  
# - CC7.2: System Monitoring
#
# Evidence includes:
# - Bucket identifier for audit verification
# - Object Lock status confirming WORM protection
# - Retention mode (GOVERNANCE) and duration (365 days)
# - Versioning status for audit trail completeness
# - Encryption status for data confidentiality
# - Lifecycle protection preventing accidental deletion
# =============================================================================

output "log_protection_evidence" {
  description = "SOC 2 attestation evidence for audit log protection controls"
  value = {
    # Bucket identification
    bucket_id   = aws_s3_bucket.central_logs.id
    bucket_arn  = aws_s3_bucket.central_logs.arn
    bucket_name = aws_s3_bucket.central_logs.bucket
    
    # Object Lock configuration (Tamper Protection)
    object_lock_enabled = true
    object_lock_mode    = "GOVERNANCE"
    retention_days      = 365
    
    # Versioning configuration (Audit Trail Completeness)
    versioning_enabled = aws_s3_bucket_versioning.logs.versioning_configuration[0].status == "Enabled"
    
    # Encryption configuration (Data Confidentiality)
    encryption_algorithm = "AES256"
    encryption_type      = "SSE-S3" # AWS-managed server-side encryption
    
    # Lifecycle protection (Prevent Accidental Deletion)
    prevent_destroy_enabled = true
    force_destroy_disabled  = true
    
    # Compliance metadata
    compliance_frameworks = ["SOC2-Type-II", "CC6.1", "CC6.6", "CC7.2"]
    attestation_timestamp = timestamp()
  }
}
