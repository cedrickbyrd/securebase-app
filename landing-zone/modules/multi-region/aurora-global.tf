<<<<<<< HEAD
# =============================================================================
# Phase 5.3 – Component 6: Multi-Region Disaster Recovery
# Aurora Global Database
# =============================================================================
# Converts the primary Aurora Serverless v2 cluster into an Aurora Global
# Database with a read replica in us-west-2 (secondary region).
# RTO < 15 min | RPO < 1 min

# =============================================================================
# Aurora Global Database
# =============================================================================

resource "aws_rds_global_cluster" "securebase" {
  global_cluster_identifier = "securebase-${var.environment}-global"
  engine                    = "aurora-postgresql"
  engine_version            = "15.4"
  database_name             = "securebase"
  deletion_protection       = var.environment == "prod" ? true : false
  storage_encrypted         = true

  # NOTE: If a standalone cluster already exists, it must be added to the global
  # cluster via the aws_rds_cluster.source_cluster_identifier argument, not
  # created fresh here. In practice, the primary cluster is imported/modified
  # via the securebase root module. This resource defines the global cluster
  # envelope; primary/secondary clusters reference it.
}

# =============================================================================
# Secondary Aurora Cluster (us-west-2)
# =============================================================================

=======
locals {
  dr_tags = merge(var.tags, {
    Phase              = "5.3"
    Component          = "multi-region-dr"
    RTO                = "15min"
    RPO                = "1min"
    ComplianceFramework = "SOC2,FedRAMP,HIPAA"
    ManagedBy          = "terraform"
  })
}

data "aws_caller_identity" "current" {}

# ── Aurora Global Database ────────────────────────────────────────────────────
# APPLY ORDER: This must be applied BEFORE dynamodb-global.tf and route53-failover.tf
# NOTE: Creating the global cluster promotes the existing primary cluster.
# Schedule a 5-minute maintenance window — brief writer interruption possible.

resource "aws_rds_global_cluster" "securebase" {
  global_cluster_identifier = "securebase-${var.environment}-global"
  source_db_cluster_identifier = "arn:aws:rds:${var.primary_region}:${data.aws_caller_identity.current.account_id}:cluster:${var.aurora_cluster_id}"
  force_destroy             = false
  deletion_protection       = var.environment == "prod"

  lifecycle {
    ignore_changes = [source_db_cluster_identifier]
  }
}

# Secondary Aurora cluster in us-west-2
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
resource "aws_rds_cluster" "secondary" {
  provider = aws.secondary

  cluster_identifier        = "securebase-${var.environment}-secondary"
<<<<<<< HEAD
  engine                    = "aurora-postgresql"
  engine_version            = "15.4"
  global_cluster_identifier = aws_rds_global_cluster.securebase.id
  db_subnet_group_name      = aws_db_subnet_group.secondary.name
  vpc_security_group_ids    = [aws_security_group.secondary_aurora.id]
  skip_final_snapshot       = var.environment != "prod"
  deletion_protection       = var.environment == "prod" ? true : false
  storage_encrypted         = true
  kms_key_id                = aws_kms_key.secondary.arn

  # Secondary is read-only — managed replication is handled by Aurora Global DB
  source_region = var.primary_region

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-aurora-secondary"
    Environment = var.environment
    Phase       = "5.3"
    Role        = "secondary"
    Region      = var.secondary_region
  })

  depends_on = [aws_rds_global_cluster.securebase]
=======
  global_cluster_identifier = aws_rds_global_cluster.securebase.id
  engine                    = "aurora-mysql"
  engine_version            = var.aurora_engine_version
  engine_mode               = "provisioned"

  # Secondary clusters must be in a different region — no writer instance here
  skip_final_snapshot  = var.environment != "prod"
  deletion_protection  = var.environment == "prod"
  storage_encrypted    = true

  serverlessv2_scaling_configuration {
    min_capacity = var.environment == "prod" ? 2 : 0.5
    max_capacity = var.environment == "prod" ? 32 : 4
  }

  tags = local.dr_tags

  lifecycle {
    ignore_changes = [replication_source_identifier, global_cluster_identifier]
  }
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
}

resource "aws_rds_cluster_instance" "secondary" {
  provider = aws.secondary

<<<<<<< HEAD
  identifier         = "securebase-${var.environment}-secondary-instance-1"
  cluster_identifier = aws_rds_cluster.secondary.id
  instance_class     = var.aurora_instance_class
  engine             = "aurora-postgresql"
  engine_version     = "15.4"

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-aurora-secondary-1"
    Environment = var.environment
    Phase       = "5.3"
    Role        = "secondary"
  })
}

# =============================================================================
# KMS key in secondary region (required for encrypted cross-region replica)
# =============================================================================

resource "aws_kms_key" "secondary" {
  provider = aws.secondary

  description             = "SecureBase ${var.environment} Aurora secondary region key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-aurora-secondary-kms"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_kms_alias" "secondary" {
  provider = aws.secondary

  name          = "alias/securebase-${var.environment}-aurora-secondary"
  target_key_id = aws_kms_key.secondary.key_id
=======
  identifier         = "securebase-${var.environment}-secondary-1"
  cluster_identifier = aws_rds_cluster.secondary.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.secondary.engine
  engine_version     = aws_rds_cluster.secondary.engine_version

  auto_minor_version_upgrade = true
  publicly_accessible        = false

  tags = local.dr_tags
}

# ── CloudWatch alarm: secondary replication lag ───────────────────────────────
resource "aws_cloudwatch_metric_alarm" "aurora_replication_lag" {
  alarm_name          = "securebase-${var.environment}-aurora-replication-lag"
  alarm_description   = "Aurora global cluster replication lag > 1s — RPO at risk"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "AuroraGlobalDBReplicationLag"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1000  # milliseconds
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.secondary.cluster_identifier
  }

  alarm_actions = var.alert_sns_arn != "" ? [var.alert_sns_arn] : []

  tags = local.dr_tags
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
}
