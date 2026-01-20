# ============================================
# Aurora Serverless v2 PostgreSQL
# ============================================

resource "random_password" "rds_admin" {
  length  = 32
  special = true
}

resource "aws_rds_cluster" "phase2_postgres" {
  cluster_identifier      = "securebase-phase2-${var.environment}"
  engine                  = "aurora-postgresql"
  engine_version          = "15.3"
  database_name           = "securebase"
  master_username         = "adminuser"
  manage_master_user_password = true
  master_user_secret_kms_key_id = aws_kms_key.rds.id
  
  # Serverless v2 configuration
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.serverless.name
  engine_mode                     = "provisioned"
  
  # Scaling: min 0.5 ACUs, max configurable
  serverlessv2_scaling_configuration {
    max_capacity = var.max_aurora_capacity
    min_capacity = var.min_aurora_capacity
  }
  
  db_subnet_group_name            = aws_db_subnet_group.phase2.name
  vpc_security_group_ids          = [aws_security_group.rds.id]
  
  # Encryption
  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.rds.arn
  
  # Backup & recovery
  backup_retention_period         = var.rds_backup_retention
  preferred_backup_window         = "03:00-04:00"
  preferred_maintenance_window    = "sun:04:00-sun:05:00"
  enabled_cloudwatch_logs_exports = ["postgresql"]
  copy_tags_to_snapshot          = true
  
  # Compliance
  deletion_protection             = var.environment == "prod" ? true : false
  skip_final_snapshot             = var.environment == "dev" ? true : false
  final_snapshot_identifier       = var.environment == "prod" ? "securebase-phase2-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  
  tags = merge(var.tags, {
    Name = "SecureBase-Phase2-Database"
  })
}

# Cluster parameter group for RLS support
resource "aws_rds_cluster_parameter_group" "serverless" {
  name        = "securebase-phase2-${var.environment}"
  family      = "aurora-postgresql15"
  description = "SecureBase Phase 2 parameters with RLS support"
  
  parameter {
    name  = "rds.force_ssl"
    value = "1"
    apply_method = "pending-reboot"
  }
  
  parameter {
    name  = "shared_preload_libraries"
    value = "pgaudit,pg_stat_statements"
    apply_method = "pending-reboot"
  }
  
  tags = var.tags
}

# DB Subnet Group
resource "aws_db_subnet_group" "phase2" {
  name       = "securebase-phase2-${var.environment}"
  subnet_ids = var.database_subnets
  
  tags = merge(var.tags, {
    Name = "SecureBase-Phase2-DB-Subnet-Group"
  })
}

# ============================================
# RDS Proxy (Connection Pooling)
# ============================================

resource "aws_db_proxy" "phase2" {
  name                   = "securebase-phase2-proxy-${var.environment}"
  engine_family          = "POSTGRESQL"
  auth {
    auth_scheme = "SECRETS"
    secret_arn  = aws_secretsmanager_secret.rds_admin_password.arn
  }
  
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = var.lambda_subnets
  vpc_security_group_ids = [aws_security_group.rds_proxy.id]
  
  require_tls            = true
  
  tags = var.tags
}

# Proxy Target (Aurora Cluster)
resource "aws_db_proxy_default_target_group" "this" {
  db_proxy_name = aws_db_proxy.phase2.name

  connection_pool_config {
    max_connections_percent      = 100
    max_idle_connections_percent = 50
  }
}

resource "aws_db_proxy_target" "cluster" {
  db_proxy_name         = aws_db_proxy.phase2.name
  target_group_name     = aws_db_proxy_default_target_group.this.name
  db_cluster_identifier = aws_rds_cluster.phase2_postgres.cluster_identifier
}

# ============================================
# DynamoDB Tables
# ============================================

# Metrics table: Real-time aggregation
resource "aws_dynamodb_table" "metrics" {
  name           = "securebase-metrics-${var.environment}"
  billing_mode   = var.dynamodb_billing_mode
  hash_key       = "CustomerId#Date"
  range_key      = "MetricType#Hour"
  
  attribute {
    name = "CustomerId#Date"
    type = "S"
  }
  
  attribute {
    name = "MetricType#Hour"
    type = "S"
  }
  
  attribute {
    name = "CustomerId"
    type = "S"
  }
  
  attribute {
    name = "Date"
    type = "S"
  }
  
  # TTL: Expire metrics after 90 days
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }
  
  # Global secondary index for querying by customer + date
  global_secondary_index {
    name            = "CustomerIdIndex"
    hash_key        = "CustomerId"
    range_key       = "Date"
    projection_type = "ALL"
  }
  
  point_in_time_recovery {
    enabled = true
  }
  
  tags = var.tags
}

# Events table: Compliance audit trail
resource "aws_dynamodb_table" "events" {
  name           = "securebase-events-${var.environment}"
  billing_mode   = var.dynamodb_billing_mode
  hash_key       = "CustomerId#Month"
  range_key      = "Timestamp"
  
  attribute {
    name = "CustomerId#Month"
    type = "S"
  }
  
  attribute {
    name = "Timestamp"
    type = "S"
  }
  
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }
  
  point_in_time_recovery {
    enabled = true
  }
  
  tags = var.tags
}

# Cache table: Session storage (short-lived)
resource "aws_dynamodb_table" "cache" {
  name           = "securebase-cache-${var.environment}"
  billing_mode   = var.dynamodb_billing_mode
  hash_key       = "SessionId"
  
  attribute {
    name = "SessionId"
    type = "S"
  }
  
  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }
  
  tags = var.tags
}

# ============================================
# KMS Keys for Encryption
# ============================================

resource "aws_kms_key" "rds" {
  description             = "KMS key for SecureBase RDS encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true
  
  tags = var.tags
}

resource "aws_kms_alias" "rds" {
  name          = "alias/securebase-rds-${var.environment}"
  target_key_id = aws_kms_key.rds.key_id
}

# ============================================
# Secrets Manager
# ============================================

resource "aws_secretsmanager_secret" "rds_admin_password" {
  name                    = "securebase/${var.environment}/rds/admin-password"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.rds.id
  
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "rds_admin_password" {
  secret_id = aws_secretsmanager_secret.rds_admin_password.id
  secret_string = jsonencode({
    username = "adminuser"
    password = random_password.rds_admin.result
    engine   = "postgres"
    host     = aws_rds_cluster.phase2_postgres.endpoint
    port     = 5432
    dbname   = "securebase"
  })
}

# ============================================
# Security Groups
# ============================================

# RDS Aurora Security Group
resource "aws_security_group" "rds" {
  name_prefix = "securebase-rds-"
  vpc_id      = var.vpc_id
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(var.tags, {
    Name = "securebase-rds-sg"
  })
}

# RDS ingress rules (separate to avoid circular dependency)
resource "aws_security_group_rule" "rds_from_proxy" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds_proxy.id
  security_group_id        = aws_security_group.rds.id
  description              = "PostgreSQL from RDS Proxy"
}

resource "aws_security_group_rule" "rds_from_lambda" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  security_group_id        = aws_security_group.rds.id
  description              = "PostgreSQL from Lambda"
}

# RDS Proxy Security Group
resource "aws_security_group" "rds_proxy" {
  name_prefix = "securebase-rds-proxy-"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
    description     = "PostgreSQL from Lambda"
  }
  
  tags = merge(var.tags, {
    Name = "securebase-rds-proxy-sg"
  })
}

# RDS Proxy egress rule (separate to avoid circular dependency)
resource "aws_security_group_rule" "proxy_to_rds" {
  type                     = "egress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
  security_group_id        = aws_security_group.rds_proxy.id
  description              = "PostgreSQL to RDS Cluster"
}

# Lambda Execution Security Group
resource "aws_security_group" "lambda" {
  name_prefix = "securebase-lambda-"
  vpc_id      = var.vpc_id
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
  
  tags = merge(var.tags, {
    Name = "securebase-lambda-sg"
  })
}

# ============================================
# IAM Roles & Policies
# ============================================

# RDS Proxy IAM Role
resource "aws_iam_role" "rds_proxy" {
  name_prefix = "securebase-rds-proxy-"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "rds.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "rds_proxy_secrets" {
  name_prefix = "rds-proxy-secrets-"
  role        = aws_iam_role.rds_proxy.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ]
      Resource = aws_secretsmanager_secret.rds_admin_password.arn
    }]
  })
}

# ============================================
# CloudWatch Log Groups
# ============================================

resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name              = "/aws/rds/cluster/securebase-phase2-${var.environment}/postgresql"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.rds.arn
  
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "rds_upgrade" {
  name              = "/aws/rds/cluster/securebase-phase2-${var.environment}/upgrade"
  retention_in_days = 7
  
  tags = var.tags
}

# ============================================
# JWT Secret for Authentication
# ============================================

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "securebase/${var.environment}/jwt-secret"
  description = "JWT signing secret for SecureBase authentication"
  
  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-jwt-secret"
  })
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = jsonencode({
    secret_key = random_password.jwt_secret.result
  })
}
