resource "aws_cloudwatch_log_group" "audit_logs" {
  name              = "/aws/audit/logs"
  retention_in_days = var.log_retention_days
}
# The Central Log Bucket
resource "aws_s3_bucket" "central_logs" {
  bucket = "securebase-audit-logs-${var.environment}" # Dynamic naming

  # Force destroy should be false for production safety
  force_destroy = false 
}

# Versioning is MANDATORY for Object Lock
resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.central_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

# 2. Tamper Protection: Object Lock (WORM)
resource "aws_s3_bucket_object_lock_configuration" "logs" {
  bucket = aws_s3_bucket.central_logs.id

  rule {
    default_retention {
      mode = "COMPLIANCE" # Even Root cannot delete during retention
      days = var.log_retention_days
    }
  }
}

# Encryption at rest (Guardrail requirement)
resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.central_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
resource "aws_cloudtrail" "org_trail" {
  name                          = "securebase-org-trail"
  s3_bucket_name                = aws_s3_bucket.central_logs.bucket
  is_organization_trail         = true
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_logging                = true
  enable_log_file_validation    = true

  depends_on = [
    aws_s3_bucket_policy.central_logs
  ]
}
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

