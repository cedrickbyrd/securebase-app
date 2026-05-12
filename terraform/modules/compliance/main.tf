terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_kms_key" "compliance" {
  description             = "${var.project_name}-${var.environment} compliance encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = var.tags
}

resource "aws_s3_bucket" "evidence" {
  bucket              = var.evidence_bucket_name
  object_lock_enabled = true

  tags = merge(var.tags, {
    Purpose = "compliance-evidence"
  })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.compliance.arn
      sse_algorithm     = "aws:kms"
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

resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.evidence_retention_days
    }
  }
}

resource "aws_dynamodb_table" "controls_state_history" {
  name         = "${var.project_name}-${var.environment}-controls-state-history"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "snapshot_id"

  attribute {
    name = "snapshot_id"
    type = "S"
  }

  server_side_encryption {
    enabled = true
    kms_key_arn = aws_kms_key.compliance.arn
  }

  tags = var.tags
}

resource "aws_sns_topic" "compliance_alerts" {
  name = "${var.project_name}-${var.environment}-compliance-alerts"
  tags = var.tags
}

resource "aws_sqs_queue" "on_demand_collection" {
  name                      = "${var.project_name}-${var.environment}-compliance-on-demand"
  message_retention_seconds = var.queue_retention_seconds
  tags                      = var.tags
}

resource "aws_sns_topic_subscription" "on_demand_queue" {
  topic_arn = aws_sns_topic.compliance_alerts.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.on_demand_collection.arn
}

data "aws_iam_policy_document" "on_demand_queue" {
  statement {
    sid     = "AllowSNSPublish"
    effect  = "Allow"
    actions = ["sqs:SendMessage"]

    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }

    resources = [aws_sqs_queue.on_demand_collection.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.compliance_alerts.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "on_demand_queue" {
  queue_url = aws_sqs_queue.on_demand_collection.id
  policy    = data.aws_iam_policy_document.on_demand_queue.json
}
