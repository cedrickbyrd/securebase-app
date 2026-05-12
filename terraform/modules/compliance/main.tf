terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_s3_bucket" "evidence" {
  bucket              = var.evidence_bucket_name
  object_lock_enabled = true

  tags = merge(var.tags, {
    Purpose = "compliance-evidence"
  })
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
      days = 2555
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
  }

  tags = var.tags
}

resource "aws_sns_topic" "compliance_alerts" {
  name = "${var.project_name}-${var.environment}-compliance-alerts"
  tags = var.tags
}

resource "aws_sqs_queue" "on_demand_collection" {
  name                      = "${var.project_name}-${var.environment}-compliance-on-demand"
  message_retention_seconds = 1209600
  tags                      = var.tags
}

resource "aws_sns_topic_subscription" "on_demand_queue" {
  topic_arn = aws_sns_topic.compliance_alerts.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.on_demand_collection.arn
}
