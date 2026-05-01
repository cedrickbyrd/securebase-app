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

resource "aws_rds_cluster" "secondary" {
  provider = aws.secondary

  cluster_identifier        = "securebase-${var.environment}-secondary"
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
}

resource "aws_rds_cluster_instance" "secondary" {
  provider = aws.secondary

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
}
