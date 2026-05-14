# =============================================================================
# Phase 5.4 / Phase 6 Track 2 Sub-task 2.3 – S3 Cross-Region Replication
# Covers: evidence bucket, audit log bucket, report output bucket
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
    Phase       = "6-Track2"
  })
}

resource "aws_iam_role_policy" "s3_replication" {
  name = "securebase-${var.environment}-s3-replication-policy"
  role = aws_iam_role.s3_replication.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Source bucket list/config permissions
      {
        Effect = "Allow"
        Action = ["s3:GetReplicationConfiguration", "s3:ListBucket"]
        Resource = compact([
          var.audit_log_bucket_name != "" ? "arn:aws:s3:::${var.audit_log_bucket_name}" : "",
          var.evidence_bucket_name  != "" ? "arn:aws:s3:::${var.evidence_bucket_name}"  : "",
          var.report_bucket_name    != "" ? "arn:aws:s3:::${var.report_bucket_name}"     : "",
        ])
      },
      # Source object read permissions
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging",
        ]
        Resource = compact([
          var.audit_log_bucket_name != "" ? "arn:aws:s3:::${var.audit_log_bucket_name}/*" : "",
          var.evidence_bucket_name  != "" ? "arn:aws:s3:::${var.evidence_bucket_name}/*"  : "",
          var.report_bucket_name    != "" ? "arn:aws:s3:::${var.report_bucket_name}/*"    : "",
        ])
      },
      # Destination bucket write permissions
      {
        Effect = "Allow"
        Action = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags"]
        Resource = compact([
          "${aws_s3_bucket.audit_logs_secondary.arn}/*",
          var.evidence_bucket_name != "" ? "${aws_s3_bucket.evidence_secondary[0].arn}/*" : "",
          var.report_bucket_name   != "" ? "${aws_s3_bucket.reports_secondary.arn}/*"     : "",
        ])
      },
      # KMS key permission for secondary-region encryption
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
  tags = merge(var.tags, { Name = "securebase-reports-${var.environment}-dr", Role = "dr-replica", Region = var.secondary_region, Phase = "6-Track2" })
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

# ── Evidence bucket — secondary replica (Phase 6 / Track 2, Sub-task 2.3) ────

resource "aws_s3_bucket" "evidence_secondary" {
  count    = var.evidence_bucket_name != "" ? 1 : 0
  provider = aws.secondary

  bucket        = "securebase-evidence-${var.environment}-dr"
  force_destroy = var.environment != "prod"

  lifecycle { prevent_destroy = true }

  tags = merge(var.tags, {
    Name   = "securebase-evidence-${var.environment}-dr"
    Role   = "dr-replica"
    Region = var.secondary_region
    Phase  = "6-Track2"
  })
}

resource "aws_s3_bucket_versioning" "evidence_secondary" {
  count    = var.evidence_bucket_name != "" ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.evidence_secondary[0].id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence_secondary" {
  count    = var.evidence_bucket_name != "" ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.evidence_secondary[0].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.secondary.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "evidence_secondary" {
  count                   = var.evidence_bucket_name != "" ? 1 : 0
  provider                = aws.secondary
  bucket                  = aws_s3_bucket.evidence_secondary[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Enable versioning on the evidence source bucket ───────────────────────────

resource "aws_s3_bucket_versioning" "evidence_primary" {
  count  = var.evidence_bucket_name != "" ? 1 : 0
  bucket = var.evidence_bucket_name
  versioning_configuration { status = "Enabled" }
}

# ── CRR rule: evidence bucket (Phase 6 / Track 2, Sub-task 2.3) ──────────────

resource "aws_s3_bucket_replication_configuration" "evidence" {
  count  = var.evidence_bucket_name != "" ? 1 : 0
  role   = aws_iam_role.s3_replication.arn
  bucket = var.evidence_bucket_name

  rule {
    id     = "replicate-all-evidence"
    status = "Enabled"

    filter {}

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }

    destination {
      bucket        = aws_s3_bucket.evidence_secondary[0].arn
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

  depends_on = [aws_s3_bucket_versioning.evidence_secondary, aws_s3_bucket_versioning.evidence_primary]
}

# ── Enable versioning on the reports source bucket ────────────────────────────

resource "aws_s3_bucket_versioning" "reports_primary" {
  count  = var.report_bucket_name != "" ? 1 : 0
  bucket = var.report_bucket_name
  versioning_configuration { status = "Enabled" }
}

# ── CRR rule: report output bucket (Phase 6 / Track 2, Sub-task 2.3) ─────────

resource "aws_s3_bucket_replication_configuration" "reports" {
  count  = var.report_bucket_name != "" ? 1 : 0
  role   = aws_iam_role.s3_replication.arn
  bucket = var.report_bucket_name

  rule {
    id     = "replicate-all-reports"
    status = "Enabled"

    filter {}

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }

    destination {
      bucket        = aws_s3_bucket.reports_secondary.arn
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

  depends_on = [aws_s3_bucket_versioning.reports_secondary, aws_s3_bucket_versioning.reports_primary]
}

# ── CloudWatch alarms: S3 CRR failed-replication objects ─────────────────────
# One alarm per source bucket — OperationsFailedReplication fires when objects
# fail to replicate to the secondary region.

resource "aws_cloudwatch_metric_alarm" "s3_crr_failed_audit_logs" {
  count = var.audit_log_bucket_name != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-s3-crr-failed-replication-audit-logs"
  alarm_description   = "S3 CRR replication failures on audit log bucket — objects failed to replicate to ${var.secondary_region}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "OperationsFailedReplication"
  namespace           = "AWS/S3"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    SourceBucket = var.audit_log_bucket_name
    RuleId       = "replicate-all-audit-logs"
  }

  alarm_actions = compact([var.alert_sns_arn])
  ok_actions    = compact([var.alert_sns_arn])

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "s3_crr_failed_evidence" {
  count = var.evidence_bucket_name != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-s3-crr-failed-replication-evidence"
  alarm_description   = "S3 CRR replication failures on evidence bucket — objects failed to replicate to ${var.secondary_region}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "OperationsFailedReplication"
  namespace           = "AWS/S3"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    SourceBucket = var.evidence_bucket_name
    RuleId       = "replicate-all-evidence"
  }

  alarm_actions = compact([var.alert_sns_arn])
  ok_actions    = compact([var.alert_sns_arn])

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "s3_crr_failed_reports" {
  count = var.report_bucket_name != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-s3-crr-failed-replication-reports"
  alarm_description   = "S3 CRR replication failures on report output bucket — objects failed to replicate to ${var.secondary_region}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "OperationsFailedReplication"
  namespace           = "AWS/S3"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    SourceBucket = var.report_bucket_name
    RuleId       = "replicate-all-reports"
  }

  alarm_actions = compact([var.alert_sns_arn])
  ok_actions    = compact([var.alert_sns_arn])

  tags = var.tags
}
