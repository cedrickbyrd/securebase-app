# ── terraform/modules/dynamodb-global/main.tf ─────────────────────────────────
# Phase 6 / Track 2 — Sub-task 2.2: DynamoDB Global Tables
#
# Converts existing DynamoDB tables to Global Tables by adding a replica in
# us-west-2. Optionally creates a replica CMK in the secondary region when the
# source tables use a customer-managed KMS key.
#
# Prerequisites for each source table:
#   1. DynamoDB Streams enabled with StreamViewType = NEW_AND_OLD_IMAGES
#   2. Billing mode PAY_PER_REQUEST  (or auto-scaling configured)
#   3. No existing replica in the target region
#
# Enable streams on an existing table:
#   aws dynamodb update-table \
#     --table-name <table-name> \
#     --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
#     --region us-east-1
# ──────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
      configuration_aliases = [aws.primary, aws.secondary]
    }
  }
}

# ── Data sources ───────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

# ── Local values ───────────────────────────────────────────────────────────────

locals {
  module_tags = merge(var.tags, {
    phase     = "6"
    track     = "2"
    sub_task  = "2.2"
    module    = "dynamodb-global"
    ManagedBy = "terraform"
  })

  # Only create a replica CMK when the caller provides a primary CMK ARN
  create_replica_kms = var.primary_kms_key_arn != ""
}

# ── Replica KMS key in secondary region ───────────────────────────────────────
#
# DynamoDB Global Tables require that all regions use the same KMS key type
# (either all AWS-managed or all CMK). When the source tables use a CMK,
# a replica key must exist in the secondary region before adding the replica.

resource "aws_kms_replica_key" "dynamodb_secondary" {
  count    = local.create_replica_kms ? 1 : 0
  provider = aws.secondary

  description             = "SecureBase ${var.environment} DynamoDB CMK replica — ${var.secondary_region} (Phase 6)"
  primary_key_arn         = var.primary_kms_key_arn
  deletion_window_in_days = var.kms_deletion_window_days
  enabled                 = true

  tags = local.module_tags
}

resource "aws_kms_alias" "dynamodb_secondary" {
  count    = local.create_replica_kms ? 1 : 0
  provider = aws.secondary

  name          = "alias/securebase-${var.environment}-dynamodb-secondary"
  target_key_id = aws_kms_replica_key.dynamodb_secondary[0].key_id
}

# ── DynamoDB Global Table replicas ────────────────────────────────────────────
#
# aws_dynamodb_table_replica adds a replica to an existing table that has
# already been created as a Global Table (or will be promoted automatically
# when the first replica is added by the provider).

resource "aws_dynamodb_table_replica" "this" {
  for_each = toset(var.table_names)
  provider = aws.secondary

  global_table_arn = "arn:aws:dynamodb:${var.primary_region}:${data.aws_caller_identity.current.account_id}:table/${each.key}"

  # Use the replica CMK when one was created; otherwise omit the key ARN so
  # DynamoDB uses the same key type as the source table (AWS-managed key).
  # NOTE: DynamoDB requires all replicas to use the same KMS key type as the
  # primary. Omitting kms_key_arn here is only correct when the source table
  # also uses an AWS-managed key. When primary_kms_key_arn is provided above,
  # the replica CMK is created and referenced, satisfying the CMK consistency
  # requirement across all regions.
  kms_key_arn = local.create_replica_kms ? aws_kms_replica_key.dynamodb_secondary[0].arn : null

  point_in_time_recovery = var.environment == "prod"

  tags = local.module_tags

  depends_on = [aws_kms_replica_key.dynamodb_secondary]
}

# ── CloudWatch alarms: replication age per table ──────────────────────────────
#
# ReplicationLatency (milliseconds) is the lag between write in primary and
# appearance in replica. Target: < 1 second steady-state.

resource "aws_cloudwatch_metric_alarm" "replication_latency" {
  for_each = toset(var.table_names)
  provider = aws.primary

  alarm_name          = "securebase-${var.environment}-ddb-replication-lag-${replace(each.key, "/[^a-zA-Z0-9-]/", "-")}"
  alarm_description   = "DynamoDB Global Table ${each.key} replication latency exceeded 5000 ms in ${var.secondary_region}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ReplicationLatency"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 5000 # 5 seconds — alert before SLA breach
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName   = each.key
    ReceivingRegion = var.secondary_region
  }

  alarm_actions = var.alert_sns_arn != "" ? [var.alert_sns_arn] : []
  ok_actions    = var.alert_sns_arn != "" ? [var.alert_sns_arn] : []

  tags = local.module_tags
}
