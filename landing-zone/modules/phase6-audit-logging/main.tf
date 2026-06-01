# Phase 6.1 — Audit Logging Module
# Creates immutable compliance evidence storage with S3 Object Lock (COMPLIANCE mode),
# AWS Macie PII scanning, KMS encryption, and a least-privilege Lambda execution role.
#
# Usage:
#   module "phase6_audit_logging" {
#     source              = "../../modules/phase6-audit-logging"
#     environment         = var.environment
#     project_name        = "securebase"
#     evidence_bucket_name = "securebase-evidence-${var.environment}"
#     tags                = local.common_tags
#   }

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ============================================================================
# KMS Key for Evidence Bucket Encryption
# ============================================================================

resource "aws_kms_key" "evidence" {
  description             = "KMS key for ${var.project_name}-${var.environment} compliance evidence bucket"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM Root Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow S3 Service"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:GenerateDataKey*",
          "kms:Decrypt"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow Lambda Execution Role"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.audit_packager_lambda.arn
        }
        Action = [
          "kms:GenerateDataKey*",
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-evidence-kms"
    Environment = var.environment
    Phase       = "6.1"
  })
}

resource "aws_kms_alias" "evidence" {
  name          = "alias/${var.project_name}-${var.environment}-evidence"
  target_key_id = aws_kms_key.evidence.key_id
}

# ============================================================================
# S3 Evidence Bucket — Object Lock (COMPLIANCE mode, 7-year retention)
# ============================================================================

resource "aws_s3_bucket" "evidence" {
  bucket = var.evidence_bucket_name

  # Object Lock must be enabled at bucket creation time.
  # IMPORTANT: object_lock_enabled cannot be changed after creation.
  object_lock_enabled = true

  tags = merge(var.tags, {
    Name               = var.evidence_bucket_name
    Environment        = var.environment
    Phase              = "6.1"
    DataClassification = "compliance-evidence"
    ComplianceFramework = "SOC2-HIPAA-FedRAMP"
  })
}

resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.evidence.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_object_lock_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.object_lock_retention_days
    }
  }
}

resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_logging" "evidence" {
  bucket        = aws_s3_bucket.evidence.id
  target_bucket = aws_s3_bucket.evidence.id
  target_prefix = "access-logs/"
}

resource "aws_s3_bucket_policy" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.evidence.arn,
          "${aws_s3_bucket.evidence.arn}/*"
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      },
      {
        Sid       = "DenyObjectDelete"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:DeleteObject"
        Resource  = "${aws_s3_bucket.evidence.arn}/*"
      },
      {
        Sid       = "DenyRetentionOverride"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObjectRetention"
        Resource  = "${aws_s3_bucket.evidence.arn}/*"
        Condition = {
          StringEquals = {
            "s3:object-lock-remaining-retention-days" = "0"
          }
        }
      },
      {
        Sid    = "AllowLambdaPackager"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.audit_packager_lambda.arn
        }
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.evidence.arn,
          "${aws_s3_bucket.evidence.arn}/*"
        ]
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.evidence]
}

# ============================================================================
# IAM Role for audit_log_packager Lambda (least-privilege)
# ============================================================================

resource "aws_iam_role" "audit_packager_lambda" {
  name = "${var.project_name}-${var.environment}-audit-packager-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-audit-packager-lambda"
    Environment = var.environment
    Phase       = "6.1"
  })
}

resource "aws_iam_role_policy_attachment" "packager_basic_execution" {
  role       = aws_iam_role.audit_packager_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "packager_s3" {
  name = "${var.project_name}-${var.environment}-audit-packager-s3"
  role = aws_iam_role.audit_packager_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadSourceLogs"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.audit_source_bucket_name}",
          "arn:aws:s3:::${var.audit_source_bucket_name}/*"
        ]
      },
      {
        Sid    = "WriteEvidencePackage"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.evidence.arn,
          "${aws_s3_bucket.evidence.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "packager_kms" {
  name = "${var.project_name}-${var.environment}-audit-packager-kms"
  role = aws_iam_role.audit_packager_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "UseEvidenceKMSKey"
      Effect = "Allow"
      Action = [
        "kms:GenerateDataKey*",
        "kms:Decrypt",
        "kms:DescribeKey"
      ]
      Resource = aws_kms_key.evidence.arn
    }]
  })
}

# ============================================================================
# AWS Macie — PII Classification on Evidence Bucket
# ============================================================================

resource "aws_macie2_account" "this" {
  count = var.macie_already_enabled ? 0 : 1

  finding_publishing_frequency = "FIFTEEN_MINUTES"
  status                       = "ENABLED"
}

resource "aws_macie2_classification_job" "evidence_scan" {
  count = var.enable_macie_scan ? 1 : 0

  job_type = "SCHEDULED"
  name     = "${var.project_name}-${var.environment}-evidence-pii-scan"

  schedule_frequency {
    weekly_schedule = "MONDAY"
  }

  s3_job_definition {
    bucket_definitions {
      account_id = data.aws_caller_identity.current.account_id
      buckets    = [aws_s3_bucket.evidence.id]
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-evidence-pii-scan"
    Environment = var.environment
    Phase       = "6.1"
  })

  depends_on = [aws_macie2_account.this]
}

# ============================================================================
# SNS Topic — Macie Findings Alert
# ============================================================================

resource "aws_sns_topic" "macie_findings" {
  name              = "${var.project_name}-${var.environment}-macie-findings"
  kms_master_key_id = aws_kms_key.evidence.id

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-macie-findings"
    Environment = var.environment
    Phase       = "6.1"
  })
}

resource "aws_sns_topic_subscription" "macie_findings_email" {
  count     = var.macie_alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.macie_findings.arn
  protocol  = "email"
  endpoint  = var.macie_alert_email
}
