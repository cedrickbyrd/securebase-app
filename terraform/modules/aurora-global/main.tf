# ── terraform/modules/aurora-global/main.tf ───────────────────────────────────
# Phase 6 / Track 2 — Sub-task 2.1: Aurora Global Database
#
# Promotes the existing Aurora Serverless v2 cluster to an Aurora Global
# Database. Adds a provisioned reader cluster in us-west-2.
#
# Key resources:
#   - aws_rds_global_cluster       — ties primary + secondary clusters
#   - aws_rds_cluster (secondary)  — us-west-2 reader (count-guarded)
#   - aws_kms_key (secondary)      — replica CMK for secondary-region encryption
#   - aws_cloudwatch_metric_alarm  — replication lag > threshold ms
#   - aws_cloudwatch_event_rule    — routes lag alarm → failover Lambda
#
# ⚠️  PRE-APPLY:
#   Aurora Serverless v2 (db.serverless) cannot join a Global Cluster.
#   A provisioned instance must exist in the source cluster first:
#
#     aws rds create-db-instance \
#       --db-instance-identifier <cluster-id>-provisioned \
#       --db-cluster-identifier <cluster-id> \
#       --db-instance-class db.r6g.large \
#       --engine aurora-postgresql \
#       --region us-east-1
#
#   Wait ~5 min for status: available, then run terraform apply.
#   The promotion causes a ~30 s writer interruption.
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
    sub_task  = "2.1"
    module    = "aurora-global"
    ManagedBy = "terraform"
  })

  create_secondary = length(var.secondary_subnet_ids) > 0 && var.secondary_vpc_id != ""
}

# ── Aurora Global Cluster ──────────────────────────────────────────────────────

resource "aws_rds_global_cluster" "this" {
  provider = aws.primary

  global_cluster_identifier    = "securebase-${var.environment}-global"
  source_db_cluster_identifier = "arn:aws:rds:${var.primary_region}:${data.aws_caller_identity.current.account_id}:cluster:${var.aurora_cluster_id}"
  force_destroy                = false
  deletion_protection          = var.environment == "prod"

  lifecycle {
    # source_db_cluster_identifier is only used during initial creation
    ignore_changes = [source_db_cluster_identifier]
  }

  tags = local.module_tags
}

# ── KMS key for secondary-region Aurora encryption ────────────────────────────

resource "aws_kms_key" "secondary_aurora" {
  provider = aws.secondary

  description             = "SecureBase ${var.environment} secondary-region Aurora encryption (Phase 6)"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.module_tags
}

resource "aws_kms_alias" "secondary_aurora" {
  provider = aws.secondary

  name          = "alias/securebase-${var.environment}-aurora-secondary"
  target_key_id = aws_kms_key.secondary_aurora.key_id
}

# ── Secondary Aurora DB subnet group ──────────────────────────────────────────

resource "aws_db_subnet_group" "secondary" {
  count    = local.create_secondary ? 1 : 0
  provider = aws.secondary

  name       = "securebase-${var.environment}-secondary"
  subnet_ids = var.secondary_subnet_ids

  tags = local.module_tags
}

# ── Secondary Aurora security group ───────────────────────────────────────────

resource "aws_security_group" "secondary_aurora" {
  count    = local.create_secondary ? 1 : 0
  provider = aws.secondary

  name        = "securebase-${var.environment}-secondary-aurora"
  description = "SecureBase ${var.environment} secondary Aurora cluster — allow PostgreSQL from VPC"
  vpc_id      = var.secondary_vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.secondary_vpc_cidr]
    description = "PostgreSQL from secondary VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = local.module_tags
}

# ── Secondary Aurora cluster (us-west-2) ──────────────────────────────────────

resource "aws_rds_cluster" "secondary" {
  count    = local.create_secondary ? 1 : 0
  provider = aws.secondary

  cluster_identifier        = "securebase-${var.environment}-secondary"
  global_cluster_identifier = aws_rds_global_cluster.this.id
  engine                    = "aurora-postgresql"
  engine_version            = var.aurora_engine_version
  engine_mode               = "provisioned"

  skip_final_snapshot  = var.environment != "prod"
  deletion_protection  = var.environment == "prod"
  storage_encrypted    = true
  kms_key_id           = aws_kms_key.secondary_aurora.arn

  db_subnet_group_name   = aws_db_subnet_group.secondary[0].name
  vpc_security_group_ids = [aws_security_group.secondary_aurora[0].id]

  apply_immediately = true

  tags = local.module_tags

  depends_on = [aws_rds_global_cluster.this]
}

resource "aws_rds_cluster_instance" "secondary" {
  count    = local.create_secondary ? 1 : 0
  provider = aws.secondary

  identifier         = "securebase-${var.environment}-secondary-1"
  cluster_identifier = aws_rds_cluster.secondary[0].id
  instance_class     = var.aurora_instance_class
  engine             = "aurora-postgresql"
  engine_version     = aws_rds_cluster.secondary[0].engine_version

  tags = local.module_tags
}

# ── CloudWatch alarm: replication lag > threshold ─────────────────────────────
#
# AuroraGlobalDBReplicationLag measures replication delay from primary to
# each secondary in milliseconds. Target RPO: < 1 s → alarm at threshold ms.

resource "aws_cloudwatch_metric_alarm" "replication_lag" {
  provider = aws.primary

  alarm_name          = "securebase-${var.environment}-aurora-global-replication-lag"
  alarm_description   = "Aurora Global DB replication lag exceeded ${var.replication_lag_threshold_ms} ms — RPO target at risk"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "AuroraGlobalDBReplicationLag"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Maximum"
  threshold           = var.replication_lag_threshold_ms
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBClusterIdentifier = var.aurora_cluster_id
  }

  alarm_actions = compact([var.alert_sns_arn])
  ok_actions    = compact([var.alert_sns_arn])

  tags = local.module_tags
}

# ── EventBridge rule: route replication lag alarm → failover Lambda ───────────

resource "aws_cloudwatch_event_rule" "lag_alarm_trigger" {
  count    = var.failover_lambda_arn != "" ? 1 : 0
  provider = aws.primary

  name        = "securebase-${var.environment}-aurora-lag-alarm-trigger"
  description = "Invoke failover Lambda when Aurora Global replication lag alarm fires (Phase 6)"

  event_pattern = jsonencode({
    source      = ["aws.cloudwatch"]
    detail-type = ["CloudWatch Alarm State Change"]
    detail = {
      alarmName = [aws_cloudwatch_metric_alarm.replication_lag.alarm_name]
      state = {
        value = ["ALARM"]
      }
    }
  })

  tags = local.module_tags
}

resource "aws_cloudwatch_event_target" "lag_alarm_failover" {
  count    = var.failover_lambda_arn != "" ? 1 : 0
  provider = aws.primary

  rule      = aws_cloudwatch_event_rule.lag_alarm_trigger[0].name
  target_id = "aurora-lag-failover"
  arn       = var.failover_lambda_arn
}

resource "aws_lambda_permission" "lag_alarm_eventbridge" {
  count    = var.failover_lambda_arn != "" ? 1 : 0
  provider = aws.primary

  statement_id  = "AllowAuroraLagAlarmInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.failover_lambda_arn
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.lag_alarm_trigger[0].arn
}
