# =============================================================================
# Phase 5.4 – S3 Cross-Region Replication
# =============================================================================

resource "aws_iam_role" "s3_replication" {
  name = "securebase-${var.environment}-s3-replication"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
    }]
  })

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-s3-replication"
    Environment = var.environment
    Phase       = "5.4"
  })
}

resource "aws_iam_role_policy" "s3_replication" {
  name = "securebase-${var.environment}-s3-replication-policy"
  role = aws_iam_role.s3_replication.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetReplicationConfiguration", "s3:ListBucket"]
        Resource = ["arn:aws:s3:::${var.audit_log_bucket_name}"]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging",
        ]
        Resource = ["arn:aws:s3:::${var.audit_log_bucket_name}/*"]
      },
      {
        Effect = "Allow"
        Action = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags"]
        Resource = ["${aws_s3_bucket.audit_logs_secondary.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey"]
        Resource = [aws_kms_key.secondary.arn]
        Condition = {
          StringLike = { "kms:ViaService" = "s3.${var.secondary_region}.amazonaws.com" }
        }
      },
    ]
  })
}

# ── Secondary Region S3 Buckets ────────────────────────────────────────────────

resource "aws_s3_bucket" "audit_logs_secondary" {
  provider      = aws.secondary
  bucket        = "securebase-audit-logs-${var.environment}-dr"
  force_destroy = false
  lifecycle { prevent_destroy = true }
  tags = merge(var.tags, { Name = "securebase-audit-logs-${var.environment}-dr", Role = "dr-replica", Region = var.secondary_region, Phase = "5.4" })
}

resource "aws_s3_bucket_versioning" "audit_logs_secondary" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.audit_logs_secondary.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs_secondary" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.audit_logs_secondary.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.secondary.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs_secondary" {
  provider                = aws.secondary
  bucket                  = aws_s3_bucket.audit_logs_secondary.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "reports_secondary" {
  provider      = aws.secondary
  bucket        = "securebase-reports-${var.environment}-dr"
  force_destroy = var.environment != "prod"
  tags = merge(var.tags, { Name = "securebase-reports-${var.environment}-dr", Role = "dr-replica", Region = var.secondary_region, Phase = "5.4" })
}

resource "aws_s3_bucket_versioning" "reports_secondary" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.reports_secondary.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "reports_secondary" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.reports_secondary.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.secondary.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "reports_secondary" {
  provider                = aws.secondary
  bucket                  = aws_s3_bucket.reports_secondary.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Enable versioning on the SOURCE bucket (required for CRR) ───────────────────
# This manages versioning on the existing primary bucket.
resource "aws_s3_bucket_versioning" "audit_logs_primary" {
  bucket = var.audit_log_bucket_name
  versioning_configuration { status = "Enabled" }
}

# ── CRR rule on the primary audit logs bucket ───────────────────────────────────

resource "aws_s3_bucket_replication_configuration" "audit_logs" {
  role   = aws_iam_role.s3_replication.arn
  bucket = var.audit_log_bucket_name

  rule {
    id     = "replicate-all-audit-logs"
    status = "Enabled"

    filter {}

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }

    destination {
      bucket        = aws_s3_bucket.audit_logs_secondary.arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = aws_kms_key.secondary.arn
      }

      replication_time {
        status = "Enabled"
        time { minutes = 15 }
      }

      metrics {
        status = "Enabled"
        event_threshold { minutes = 15 }
      }
    }

    delete_marker_replication {
      status = "Enabled"
    }
  }

  depends_on = [aws_s3_bucket_versioning.audit_logs_secondary, aws_s3_bucket_versioning.audit_logs_primary]
}

# ── CloudWatch alarm: replication lag ───────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "s3_crr_lag" {
  alarm_name          = "securebase-${var.environment}-s3-crr-replication-lag"
  alarm_description   = "S3 audit logs cross-region replication lag exceeded 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ReplicationLatency"
  namespace           = "AWS/S3"
  period              = 300
  statistic           = "Maximum"
  threshold           = 300
  treat_missing_data  = "notBreaching"

  dimensions = {
    SourceBucket      = var.audit_log_bucket_name
    DestinationBucket = aws_s3_bucket.audit_logs_secondary.bucket
    RuleId            = "replicate-all-audit-logs"
  }

  tags = var.tags
}
