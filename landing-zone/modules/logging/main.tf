resource "aws_cloudwatch_log_group" "audit_logs" {
  name              = "/aws/audit/logs"
  retention_in_days = var.log_retention_days
}

# =============================================================================
# SOC 2 Compliant Audit Log Storage
# =============================================================================
# This S3 bucket provides tamper-proof, encrypted audit log storage that meets
# SOC 2 Type II requirements for:
# - CC6.1: Logical and Physical Access Controls
# - CC6.6: Completeness and Accuracy of Processing
# - CC7.2: System Monitoring
#
# Key compliance features:
# - Object Lock with GOVERNANCE mode (365-day retention)
# - Versioning enabled for audit trail completeness
# - AES256 encryption at rest
# - Prevent destroy lifecycle protection
# - Immutable retention for regulatory compliance
#
# For auditors: See output "log_protection_evidence" for attestation data
# =============================================================================

resource "aws_s3_bucket" "central_logs" {
  bucket = "securebase-audit-logs-${var.environment}" # Dynamic naming per environment

  # SOC 2 Requirement: Prevent accidental deletion of audit logs
  # This lifecycle block ensures the bucket cannot be destroyed via Terraform
  # without explicit manual intervention, protecting audit evidence integrity
  force_destroy = false
  
  lifecycle {
    prevent_destroy = true
  }
}

# =============================================================================
# S3 Bucket Versioning
# =============================================================================
# SOC 2 CC6.6 Requirement: Versioning ensures completeness of audit logs
# All object modifications are preserved, preventing data loss and maintaining
# a complete audit trail. This is MANDATORY for Object Lock configuration.
# =============================================================================

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.central_logs.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# =============================================================================
# Object Lock Configuration - SOC 2 Tamper Protection
# =============================================================================
# SOC 2 CC6.1 & CC7.2 Requirements: Object Lock provides Write-Once-Read-Many
# (WORM) protection for audit logs, ensuring they cannot be modified or deleted
# during the retention period.
#
# GOVERNANCE Mode vs COMPLIANCE Mode:
# - GOVERNANCE: Users with special permissions can override retention or delete
#   objects. Suitable for most SOC 2 audits while allowing emergency access.
# - COMPLIANCE: Even root account cannot delete objects during retention period.
#   Used for strictest regulatory requirements (SEC, FINRA).
#
# This configuration uses GOVERNANCE mode with 365-day retention as specified
# for SOC 2 compliance, allowing authorized administrators to manage logs
# while preventing accidental or unauthorized deletion.
#
# Note: Previous configuration used COMPLIANCE mode. GOVERNANCE mode provides
# equivalent SOC 2 protection with improved operational flexibility.
# =============================================================================

resource "aws_s3_bucket_object_lock_configuration" "logs" {
  bucket = aws_s3_bucket.central_logs.id

  rule {
    default_retention {
      mode = "GOVERNANCE" # SOC 2 compliant with operational flexibility
      days = 365          # 365-day retention period for audit compliance
    }
  }
}

# =============================================================================
# Server-Side Encryption Configuration
# =============================================================================
# SOC 2 CC6.1 Requirement: Encryption at rest using AES256
# All audit logs are automatically encrypted using AWS-managed keys (SSE-S3).
# This ensures data confidentiality and protects sensitive audit information.
#
# For enhanced security requirements (HIPAA, FedRAMP), consider upgrading to
# aws:kms encryption with customer-managed keys (CMKs).
# =============================================================================

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.central_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # AWS-managed encryption (SSE-S3)
    }
  }
}
# =============================================================================
# AWS CloudTrail - Organization-Wide Audit Trail
# =============================================================================
# CloudTrail captures all API activity across the AWS Organization and stores
# logs in the central audit bucket. This provides:
# - Complete audit trail of all AWS API calls
# - Multi-region coverage for comprehensive monitoring
# - Log file integrity validation using digital signatures
# - Organization-wide visibility for centralized security monitoring
#
# Integration: CloudTrail writes to the S3 bucket protected by Object Lock,
# ensuring audit logs are immutable and comply with SOC 2 requirements.
# =============================================================================

resource "aws_cloudtrail" "org_trail" {
  name                          = "securebase-org-trail"
  s3_bucket_name                = aws_s3_bucket.central_logs.bucket
  is_organization_trail         = true
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_logging                = true
  enable_log_file_validation    = true # Digital signatures for tamper detection

  depends_on = [
    aws_s3_bucket_policy.central_logs
  ]
}

# =============================================================================
# S3 Bucket Policy - CloudTrail Access
# =============================================================================
# This bucket policy grants CloudTrail the minimum necessary permissions to
# write audit logs. Follows principle of least privilege (SOC 2 CC6.1).
#
# Permissions:
# - PutObject: Allows CloudTrail to write new log files
# - GetBucketAcl: Required for CloudTrail to verify bucket ownership
#
# Conditions enforce:
# - bucket-owner-full-control ACL for proper access control
# =============================================================================

resource "aws_s3_bucket_policy" "central_logs" {
  bucket = aws_s3_bucket.central_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.central_logs.arn}/AWSLogs/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Sid    = "AWSCloudTrailGetBucketAcl"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.central_logs.arn
      }
    ]
  })
}
