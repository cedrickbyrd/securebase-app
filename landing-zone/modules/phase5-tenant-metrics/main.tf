# ============================================
# Phase 5.2 Tenant Metrics DynamoDB Tables
# ============================================
# 
# This module creates DynamoDB tables for Phase 5.2 Tenant Dashboard:
# - securebase-metrics-history: Time-series metrics with 90-day TTL
# - securebase-compliance-violations: Drift detection events with StatusIndex GSI
# - securebase-audit-trail: Configuration change audit with ResourceTypeIndex GSI

# ============================================
# Metrics History Table
# ============================================

resource "aws_dynamodb_table" "metrics_history" {
  name           = "securebase-${var.environment}-metrics-history"
  billing_mode   = "PAY_PER_REQUEST"  # Auto-scaling for variable workloads
  hash_key       = "tenant_id"
  range_key      = "timestamp"

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"  # ISO 8601 format: 2026-03-28T16:41:00Z
  }

  # TTL for automatic data expiration (90 days)
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  tags = merge(var.tags, {
    Name        = "SecureBase-Metrics-History"
    Environment = var.environment
    Phase       = "5.2"
    Purpose     = "Tenant metrics time-series data"
  })
}

# ============================================
# Compliance Violations Table (Drift Detection)
# ============================================

resource "aws_dynamodb_table" "compliance_violations" {
  name           = "securebase-${var.environment}-compliance-violations"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "tenant_id"
  range_key      = "detection_timestamp"

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "detection_timestamp"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"  # open, in_progress, resolved, acknowledged
  }

  # GSI for querying by status
  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "tenant_id"
    range_key       = "status"
    projection_type = "ALL"
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  tags = merge(var.tags, {
    Name        = "SecureBase-Compliance-Violations"
    Environment = var.environment
    Phase       = "5.2"
    Purpose     = "Compliance drift detection events"
  })
}

# ============================================
# Audit Trail Table
# ============================================

resource "aws_dynamodb_table" "audit_trail" {
  name           = "securebase-${var.environment}-audit-trail"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "tenant_id"
  range_key      = "timestamp"

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "resource_type"
    type = "S"  # Policy, Role, User, API_Key, Configuration
  }

  # GSI for querying by resource type
  global_secondary_index {
    name            = "ResourceTypeIndex"
    hash_key        = "tenant_id"
    range_key       = "resource_type"
    projection_type = "ALL"
  }

  # TTL for data retention compliance (365 days)
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  tags = merge(var.tags, {
    Name        = "SecureBase-Audit-Trail"
    Environment = var.environment
    Phase       = "5.2"
    Purpose     = "Configuration change audit log"
  })
}

# ============================================
# CloudWatch Alarms for Table Monitoring
# ============================================

resource "aws_cloudwatch_metric_alarm" "metrics_history_throttles" {
  alarm_name          = "securebase-${var.environment}-metrics-history-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert when metrics history table is throttled"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.metrics_history.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "compliance_violations_throttles" {
  alarm_name          = "securebase-${var.environment}-compliance-violations-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert when compliance violations table is throttled"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.compliance_violations.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "audit_trail_throttles" {
  alarm_name          = "securebase-${var.environment}-audit-trail-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert when audit trail table is throttled"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.audit_trail.name
  }

  tags = var.tags
}
