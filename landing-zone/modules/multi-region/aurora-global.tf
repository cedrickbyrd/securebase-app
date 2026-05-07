# ── Aurora Global Database ────────────────────────────────────────────────────
# Attaches the existing primary Aurora cluster to a new Aurora Global Cluster
# and provisions a reader in us-west-2.
# RTO < 15 min | RPO < 1 min
#
# APPLY ORDER: aurora-global.tf → route53-failover.tf
# NOTE: Promoting to a global cluster causes a ~30 s writer interruption.

resource "aws_rds_global_cluster" "securebase" {
  global_cluster_identifier    = "securebase-${var.environment}-global"
  source_db_cluster_identifier = "arn:aws:rds:${var.primary_region}:${data.aws_caller_identity.current.account_id}:cluster:${var.aurora_cluster_id}"
  force_destroy                = false
  deletion_protection          = var.environment == "prod"

  lifecycle {
    ignore_changes = [source_db_cluster_identifier]
  }
}

# ── KMS key for secondary-region Aurora encryption ───────────────────────────

resource "aws_kms_key" "secondary" {
  provider = aws.secondary

  description             = "SecureBase ${var.environment} secondary Aurora encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  tags                    = local.dr_tags
}

resource "aws_kms_alias" "secondary" {
  provider      = aws.secondary
  name          = "alias/securebase-${var.environment}-aurora-secondary"
  target_key_id = aws_kms_key.secondary.key_id
}

# ── Secondary Aurora cluster (us-west-2) ─────────────────────────────────────
# Guard: only created when secondary_subnet_ids and secondary_vpc_id are set.

locals {
  create_secondary_aurora = length(var.secondary_subnet_ids) > 0 && var.secondary_vpc_id != ""
}

resource "aws_db_subnet_group" "secondary" {
  count    = local.create_secondary_aurora ? 1 : 0
  provider = aws.secondary

  name       = "securebase-${var.environment}-secondary"
  subnet_ids = var.secondary_subnet_ids
  tags       = local.dr_tags
}

resource "aws_security_group" "secondary_aurora" {
  count    = local.create_secondary_aurora ? 1 : 0
  provider = aws.secondary

  name        = "securebase-${var.environment}-secondary-aurora"
  description = "SecureBase ${var.environment} secondary Aurora SG"
  vpc_id      = var.secondary_vpc_id

  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = [var.secondary_vpc_cidr]
    description = "Aurora/MySQL from secondary VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.dr_tags
}

resource "aws_rds_cluster" "secondary" {
  count    = local.create_secondary_aurora ? 1 : 0
  provider = aws.secondary

  cluster_identifier        = "securebase-${var.environment}-secondary"
  global_cluster_identifier = aws_rds_global_cluster.securebase.id
  engine                    = "aurora-mysql"
  engine_version            = var.aurora_engine_version
  engine_mode               = "provisioned"

  skip_final_snapshot  = var.environment != "prod"
  deletion_protection  = var.environment == "prod"
  storage_encrypted    = true
  kms_key_id           = aws_kms_key.secondary.arn

  db_subnet_group_name   = aws_db_subnet_group.secondary[0].name
  vpc_security_group_ids = [aws_security_group.secondary_aurora[0].id]

  apply_immediately = true
  tags              = local.dr_tags

  depends_on = [aws_rds_global_cluster.securebase]
}

resource "aws_rds_cluster_instance" "secondary" {
  count    = local.create_secondary_aurora ? 1 : 0
  provider = aws.secondary

  identifier         = "securebase-${var.environment}-secondary-1"
  cluster_identifier = aws_rds_cluster.secondary[0].id
  instance_class     = var.aurora_instance_class
  engine             = aws_rds_cluster.secondary[0].engine
  engine_version     = aws_rds_cluster.secondary[0].engine_version

  tags = local.dr_tags
}
