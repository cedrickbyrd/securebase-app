# Analytics DynamoDB Tables - Phase 4
# Tables for reports, schedules, and cached results

resource "aws_dynamodb_table" "reports" {
  name         = "securebase-${var.environment}-reports"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "customer_id"
  range_key    = "id"

  attribute {
    name = "customer_id"
    type = "S"
  }

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name            = "CreatedAtIndex"
    hash_key        = "customer_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-reports"
    Component = "Analytics"
    Phase     = "4"
  })
}

resource "aws_dynamodb_table" "report_schedules" {
  name         = "securebase-${var.environment}-report-schedules"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "customer_id"
  range_key    = "schedule_id"

  attribute {
    name = "customer_id"
    type = "S"
  }

  attribute {
    name = "schedule_id"
    type = "S"
  }

  attribute {
    name = "next_run"
    type = "S"
  }

  global_secondary_index {
    name            = "NextRunIndex"
    hash_key        = "schedule_id"
    range_key       = "next_run"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-report-schedules"
    Component = "Analytics"
    Phase     = "4"
  })
}

resource "aws_dynamodb_table" "report_cache" {
  name         = "securebase-${var.environment}-report-cache"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "cache_key"

  attribute {
    name = "cache_key"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-report-cache"
    Component = "Analytics"
    Phase     = "4"
  })
}

# Metrics table for analytics queries
resource "aws_dynamodb_table" "metrics" {
  name         = "securebase-${var.environment}-metrics"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "customer_id"
  range_key    = "timestamp"

  attribute {
    name = "customer_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "service"
    type = "S"
  }

  attribute {
    name = "region"
    type = "S"
  }

  global_secondary_index {
    name            = "ServiceIndex"
    hash_key        = "customer_id"
    range_key       = "service"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "RegionIndex"
    hash_key        = "customer_id"
    range_key       = "region"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-metrics"
    Component = "Analytics"
    Phase     = "4"
  })
}

# S3 bucket for report exports
resource "aws_s3_bucket" "reports" {
  bucket = "securebase-${var.environment}-reports-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-reports"
    Component = "Analytics"
    Phase     = "4"
  })
}

resource "aws_s3_bucket_versioning" "reports" {
  bucket = aws_s3_bucket.reports.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    id     = "expire-old-reports"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

data "aws_caller_identity" "current" {}
