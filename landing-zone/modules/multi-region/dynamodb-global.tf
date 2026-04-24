<<<<<<< HEAD
# =============================================================================
# Phase 5.3 – Component 6: Multi-Region DR
# DynamoDB Global Tables
# =============================================================================
# Converts Phase 5.2 DynamoDB tables (metrics-history, compliance-violations,
# audit-trail) to Global Tables with us-west-2 replicas.

# =============================================================================
# DynamoDB Global Table — Metrics History
# =============================================================================

resource "aws_dynamodb_table" "metrics_history_global" {
  name             = "securebase-${var.environment}-metrics-history"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "tenant_id"
  range_key        = "timestamp"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"  # Required for Global Tables

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.primary_kms_key_arn
  }

  replica {
    region_name    = var.secondary_region
    kms_key_arn    = aws_kms_key.secondary.arn
    propagate_tags = true
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-metrics-history"
    Environment = var.environment
    Phase       = "5.3"
    Type        = "global-table"
  })
}

# =============================================================================
# DynamoDB Global Table — Compliance Violations
# =============================================================================

resource "aws_dynamodb_table" "compliance_violations_global" {
  name             = "securebase-${var.environment}-compliance-violations"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "tenant_id"
  range_key        = "detection_timestamp"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

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
    type = "S"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "tenant_id"
    range_key       = "status"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.primary_kms_key_arn
  }

  replica {
    region_name    = var.secondary_region
    kms_key_arn    = aws_kms_key.secondary.arn
    propagate_tags = true
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-compliance-violations"
    Environment = var.environment
    Phase       = "5.3"
    Type        = "global-table"
  })
}

# =============================================================================
# DynamoDB Global Table — Audit Trail
# =============================================================================

resource "aws_dynamodb_table" "audit_trail_global" {
  name             = "securebase-${var.environment}-audit-trail"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "tenant_id"
  range_key        = "timestamp"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

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
    type = "S"
  }

  global_secondary_index {
    name            = "ResourceTypeIndex"
    hash_key        = "tenant_id"
    range_key       = "resource_type"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.primary_kms_key_arn
  }

  replica {
    region_name    = var.secondary_region
    kms_key_arn    = aws_kms_key.secondary.arn
    propagate_tags = true
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-audit-trail"
    Environment = var.environment
    Phase       = "5.3"
    Type        = "global-table"
  })
=======
# ── DynamoDB Global Tables (us-west-2 replicas) ───────────────────────────────
# Prerequisite: PITR must be enabled on all source tables (done via CLI fix).
# APPLY ORDER: After aurora-global.tf succeeds.

resource "aws_dynamodb_table" "global_replica" {
  for_each = toset(var.dynamodb_table_names)

  # We only add the replica block — the table itself already exists.
  # Using a data source to reference existing tables and add replicas.
  name = each.value

  # These must match the existing table exactly — Terraform manages the replica only
  billing_mode = "PAY_PER_REQUEST"

  replica {
    region_name = var.secondary_region
  }

  lifecycle {
    # Prevent Terraform from destroying/recreating the table if other attributes drift
    ignore_changes = [
      hash_key, range_key, attribute, local_secondary_index,
      global_secondary_index, stream_enabled, stream_view_type,
      read_capacity, write_capacity, ttl, billing_mode,
    ]
    prevent_destroy = true
  }

  tags = local.dr_tags
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
}
