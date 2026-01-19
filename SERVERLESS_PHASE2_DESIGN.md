# SecureBase Phase 2: Serverless Multi-Tenant Database Architecture

**Document Version:** 1.0  
**Date:** January 2026  
**Status:** Design Ready for Implementation

---

## Executive Summary

Phase 2 transforms SecureBase from infrastructure-only to a fully managed multi-tenant SaaS platform with:

- **Billing Engine**: Real-time usage metering & invoicing
- **Customer Portal**: Self-service dashboards & compliance reporting
- **API Layer**: REST + GraphQL for programmatic access
- **Audit System**: Immutable compliance event logs
- **Notification System**: Customer alerts & security events

**Tech Stack:**
- PostgreSQL 15 on Aurora Serverless v2 (SQL + RLS)
- DynamoDB (metrics, cache, events)
- Lambda (API functions + workers)
- API Gateway (REST/GraphQL)
- EventBridge (event-driven workflows)
- S3 + Glacier (long-term audit storage)

**Cost Model:** $1,200-1,500/month (base) + $0.25-0.35 per customer/month  
**Deployment Timeline:** 4-6 weeks

---

## Part 1: Architecture Overview

### 1.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      Customer Applications                       │
│         (Tenant Portal, API Clients, Mobile)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  API Gateway    │
                    │  (REST + GraphQL)
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    ┌───▼────┐          ┌───▼────┐          ┌───▼────┐
    │ Lambda  │          │ Lambda │          │ Lambda │
    │ (Auth)  │          │(Billing)          │(Portal)
    └────┬────┘          └────┬────┘          └────┬────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    ┌───▼──────────┐  ┌──────▼───────┐  ┌─────────▼──┐
    │   Aurora     │  │   DynamoDB   │  │ EventBridge
    │  Serverless  │  │ (Metrics)    │  │ (Workflows)
    │  PostgreSQL  │  │              │  │
    └──────────────┘  └──────────────┘  └────────────┘
         │                    │                │
         │ RLS Policy         │ Time-series    │ SQS/SNS
         │ Per Customer       │ Aggregation    │ Async Jobs
         │                    │                │
    ┌────▼──────────────────────────────────────┴────┐
    │ S3 + Glacier (7-year Compliance Archive)      │
    └──────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
Customer Activity (AWS Org events from Phase 1)
  ↓
EventBridge → DynamoDB (metrics aggregation)
  ↓
Lambda Worker (daily billing calculation)
  ↓
Aurora PostgreSQL (customer invoices, usage)
  ↓
Customer Portal (dashboard view) / S3 Archive (compliance)
```

---

## Part 2: Database Schema

### 2.1 PostgreSQL Core Tables (with RLS)

```sql
-- ============================================
-- Multi-Tenant Organization
-- ============================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  tier VARCHAR(20) NOT NULL, -- standard, fintech, healthcare, gov-federal
  framework VARCHAR(20) NOT NULL, -- soc2, hipaa, fedramp, cis
  aws_org_id TEXT NOT NULL UNIQUE,
  aws_management_account_id TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, deleted
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Compliance flags
  mfa_enforced BOOLEAN DEFAULT true,
  audit_retention_days INTEGER DEFAULT 2555, -- 7 years
  encryption_required BOOLEAN DEFAULT true,
  vpc_isolation_enabled BOOLEAN DEFAULT true,
  
  -- Billing info
  billing_email TEXT NOT NULL,
  billing_contact_phone TEXT,
  payment_method VARCHAR(50), -- stripe, aws_mp, invoice
  
  -- Metadata
  tags JSONB DEFAULT '{}',
  custom_config JSONB DEFAULT '{}'
);

CREATE INDEX idx_customers_tier ON customers(tier);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- ============================================
-- Tier-Based Feature Flags
-- ============================================

CREATE TABLE tier_features (
  id SERIAL PRIMARY KEY,
  tier VARCHAR(20) UNIQUE NOT NULL,
  max_accounts INTEGER,
  max_regions INTEGER,
  sso_users_limit INTEGER,
  apikey_allowed BOOLEAN DEFAULT true,
  custom_scps BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  compliance_reports BOOLEAN DEFAULT false,
  cost_analytics BOOLEAN DEFAULT false,
  multi_region BOOLEAN DEFAULT false
);

INSERT INTO tier_features VALUES
  ('standard', 5, 2, 10, true, false, false, false, false, false),
  ('fintech', 20, 5, 50, true, true, true, true, true, false),
  ('healthcare', 20, 5, 50, true, true, true, true, true, false),
  ('gov-federal', 50, 10, 200, true, true, true, true, true, true);

-- ============================================
-- Usage & Billing
-- ============================================

CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- 2026-01-01 format
  
  -- Account metrics
  account_count INTEGER DEFAULT 0,
  ou_count INTEGER DEFAULT 0,
  scp_count INTEGER DEFAULT 0,
  
  -- Compute (tracked via CloudWatch metrics)
  cloudtrail_events_logged BIGINT DEFAULT 0,
  config_rule_evaluations BIGINT DEFAULT 0,
  guardduty_findings INTEGER DEFAULT 0,
  
  -- Storage (S3, CloudWatch Logs)
  log_storage_gb DECIMAL(10,2) DEFAULT 0.0,
  archive_storage_gb DECIMAL(10,2) DEFAULT 0.0,
  
  -- Network
  nat_gateway_bytes_processed BIGINT DEFAULT 0,
  vpn_connections_count INTEGER DEFAULT 0,
  
  -- Custom resources (workload-specific)
  custom_ec2_instances INTEGER DEFAULT 0,
  custom_rds_instances INTEGER DEFAULT 0,
  custom_s3_buckets INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(customer_id, month)
);

CREATE INDEX idx_usage_customer_month ON usage_metrics(customer_id, month DESC);

-- ============================================
-- Billing Invoices
-- ============================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL, -- INV-2026-01-0001
  month DATE NOT NULL,
  
  -- Base tier cost
  tier_base_cost DECIMAL(10,2) NOT NULL,
  
  -- Usage charges
  usage_charges JSONB NOT NULL, -- { "log_storage_gb": 0.15, "nat_bytes": 25.50, ... }
  usage_total DECIMAL(10,2) DEFAULT 0.0,
  
  -- Discounts
  volume_discount DECIMAL(3,2) DEFAULT 0.0, -- 0.05 = 5%
  promotional_credit DECIMAL(10,2) DEFAULT 0.0,
  
  -- Totals
  subtotal DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,4) DEFAULT 0.0,
  tax_amount DECIMAL(10,2) DEFAULT 0.0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, issued, paid, overdue, cancelled
  issued_at TIMESTAMP,
  due_at TIMESTAMP,
  paid_at TIMESTAMP,
  
  -- Payment tracking
  payment_method TEXT,
  payment_id TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_customer_month ON invoices(customer_id, month DESC);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issued_at ON invoices(issued_at DESC);

-- ============================================
-- Compliance Audit Log
-- ============================================

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL, -- user_login, policy_change, data_access, etc.
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id TEXT,
  
  actor_email TEXT NOT NULL,
  actor_ip_address INET,
  actor_user_agent TEXT,
  
  status VARCHAR(20) DEFAULT 'success', -- success, failure
  error_message TEXT,
  
  -- Context
  request_id TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Immutable: once inserted, never updated
  is_archived BOOLEAN DEFAULT false
);

CREATE INDEX idx_audit_customer_date ON audit_events(customer_id, created_at DESC);
CREATE INDEX idx_audit_event_type ON audit_events(event_type, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_events(actor_email, created_at DESC);

-- 7-year retention policy
CREATE OR REPLACE FUNCTION archive_old_audit_events() RETURNS void AS $$
BEGIN
  -- Copy to S3 (via Lambda trigger)
  UPDATE audit_events
  SET is_archived = true
  WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
    AND is_archived = false;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Permissions & Access
-- ============================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  
  -- Hashed key (never store plaintext)
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL UNIQUE, -- First 8 chars shown in UI
  
  -- Scopes: read:invoices, read:metrics, read:audit, write:config
  scopes TEXT[] NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_api_keys_customer ON api_keys(customer_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- ============================================
-- Support & Notifications
-- ============================================

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, critical
  status VARCHAR(20) DEFAULT 'open', -- open, in_progress, waiting, resolved, closed
  
  created_by_email TEXT NOT NULL,
  assigned_to_email TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(50), -- invoice_issued, compliance_alert, system_update
  
  channel TEXT DEFAULT 'email', -- email, sms, webhook
  delivery_address TEXT NOT NULL,
  
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all sensitive tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Each customer can ONLY see their own data
CREATE POLICY customer_isolation_customers 
  ON customers 
  FOR ALL 
  USING (id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_usage 
  ON usage_metrics 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_invoices 
  ON invoices 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_audit 
  ON audit_events 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_api_keys 
  ON api_keys 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_support 
  ON support_tickets 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_notifications 
  ON notifications 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid);

-- Admin bypass (for internal tools)
CREATE ROLE customer_admin;
ALTER POLICY customer_isolation_customers ON customers TO customer_admin USING (true);
ALTER POLICY customer_isolation_usage ON usage_metrics TO customer_admin USING (true);

```

### 2.2 DynamoDB Schemas (Metrics & Events)

```json
// Table: securebase-metrics (Real-time aggregation)
{
  "TableName": "securebase-metrics",
  "PrimaryKey": {
    "PartitionKey": "CustomerId#Date", // "acme-finance#2026-01-19"
    "SortKey": "MetricType#Hour"       // "cloudtrail#14" (2 PM)
  },
  "Attributes": {
    "CustomerId": "String",
    "Date": "String",
    "MetricType": "String",           // cloudtrail, guardduty, config, nat, etc.
    "Hour": "Number",
    "Value": "Number",
    "Timestamp": "Number",            // Unix timestamp
    "TTL": "Number"                   // Expire after 90 days
  },
  "GlobalSecondaryIndex": {
    "CustomerIdIndex": {
      "PartitionKey": "CustomerId",
      "SortKey": "Date"
    }
  }
}

// Table: securebase-events (Compliance audit trail)
{
  "TableName": "securebase-events",
  "PrimaryKey": {
    "PartitionKey": "CustomerId#Month", // "acme-finance#2026-01"
    "SortKey": "Timestamp"              // ISO timestamp (reverse order)
  },
  "Attributes": {
    "CustomerId": "String",
    "EventId": "String",                // UUID
    "EventType": "String",              // "policy_updated", "access_granted", etc.
    "ActorEmail": "String",
    "ResourceType": "String",
    "ResourceId": "String",
    "Timestamp": "Number",
    "Metadata": "Map",
    "TTL": "Number"                     // 7 years for certain event types
  }
}

// Table: securebase-cache (Session cache)
{
  "TableName": "securebase-cache",
  "PrimaryKey": {
    "PartitionKey": "SessionId"
  },
  "Attributes": {
    "SessionId": "String",
    "CustomerId": "String",
    "UserEmail": "String",
    "Permissions": "List",
    "ExpiresAt": "Number",
    "TTL": "Number"                     // Auto-expire after 8 hours
  }
}
```

---

## Part 3: Serverless Infrastructure (Terraform)

### 3.1 Aurora Serverless v2 Setup

**File:** `landing-zone/modules/phase2-database/main.tf`

```hcl
# ============================================
# Aurora Serverless v2 PostgreSQL
# ============================================

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
  
  # Scaling: min 0.5 ACUs, max 4 ACUs (adjustable per customer)
  # 1 ACU ≈ 2GB RAM + 2 vCPU
  serverlessv2_scaling_configuration {
    max_capacity = 4
    min_capacity = 0.5
  }
  
  db_subnet_group_name            = aws_db_subnet_group.phase2.name
  db_cluster_security_group_ids   = [aws_security_group.rds.id]
  
  # Encryption
  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.rds.arn
  
  # Backup & recovery
  backup_retention_period         = 35  # 5 weeks for PITR
  preferred_backup_window         = "03:00-04:00"
  preferred_maintenance_window    = "sun:04:00-sun:05:00"
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  # High availability
  enabled_http_endpoint           = false  # Use Lambda RDS proxy instead
  
  # Compliance
  deletion_protection             = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "securebase-phase2-${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  
  tags = merge(var.tags, {
    Name = "SecureBase-Phase2-Database"
  })
}

# ============================================
# RDS Proxy (Connection Pooling)
# ============================================

resource "aws_db_proxy" "phase2" {
  name                   = "securebase-phase2-proxy"
  engine_family          = "POSTGRESQL"
  auth {
    auth_scheme = "SECRETS"
    secret_arn  = aws_secretsmanager_secret.rds_admin_password.arn
  }
  
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = var.database_subnets
  
  # Connection pooling parameters
  max_connections        = 100
  max_idle_connections   = 25
  connection_borrow_timeout = 120
  session_pinning_filters = ["EXCLUDE_VARIABLE_SETS"]
  
  security_group_ids     = [aws_security_group.rds_proxy.id]
  
  tags = var.tags
}

resource "aws_db_proxy_target" "cluster" {
  db_proxy_name          = aws_db_proxy.phase2.name
  target_arn             = aws_rds_cluster.phase2_postgres.arn
  db_cluster_identifier  = aws_rds_cluster.phase2_postgres.cluster_identifier
}

# ============================================
# DynamoDB Tables
# ============================================

resource "aws_dynamodb_table" "metrics" {
  name           = "securebase-metrics-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"  # Serverless pricing
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
  
  point_in_time_recovery_specification {
    enabled = true
  }
  
  tags = var.tags
}

resource "aws_dynamodb_table" "events" {
  name           = "securebase-events-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
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
  
  point_in_time_recovery_specification {
    enabled = true
  }
  
  tags = var.tags
}

resource "aws_dynamodb_table" "cache" {
  name           = "securebase-cache-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
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
  name          = "alias/securebase-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# ============================================
# Secrets Manager
# ============================================

resource "aws_secretsmanager_secret" "rds_admin_password" {
  name                    = "securebase/rds/admin-password"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.rds.id
  
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "rds_admin_password" {
  secret_id       = aws_secretsmanager_secret.rds_admin_password.id
  secret_string   = jsonencode({
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

resource "aws_security_group" "rds" {
  name_prefix = "securebase-rds-"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.rds_proxy.id, aws_security_group.lambda.id]
    description     = "PostgreSQL from RDS Proxy and Lambda"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = var.tags
}

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
  
  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.rds.id]
    description     = "PostgreSQL to RDS Cluster"
  }
  
  tags = var.tags
}

resource "aws_security_group" "lambda" {
  name_prefix = "securebase-lambda-"
  vpc_id      = var.vpc_id
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = var.tags
}
```

---

## Part 4: Lambda Functions (Serverless Compute)

### 4.1 API Layer - Authentication

**File:** `phase2-backend/functions/auth.py`

```python
import json
import hmac
import hashlib
import boto3
import psycopg2
from datetime import datetime, timedelta
import os

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.validation import validate
from aws_lambda_powertools.utilities.validation.validators import JsonSchemaValidator

logger = Logger()
tracer = Tracer()

# Database connection (via RDS Proxy)
RDS_ENDPOINT = os.environ['RDS_ENDPOINT']
RDS_PORT = os.environ['RDS_PORT']
DB_NAME = os.environ['DB_NAME']

secrets_client = boto3.client('secretsmanager')
dynamodb = boto3.resource('dynamodb')
cache_table = dynamodb.Table('securebase-cache')


def get_db_connection():
    """Get PostgreSQL connection via RDS Proxy"""
    secret = secrets_client.get_secret_value(SecretId='securebase/rds/admin-password')
    secret_dict = json.loads(secret['SecretString'])
    
    conn = psycopg2.connect(
        host=RDS_ENDPOINT,
        port=int(RDS_PORT),
        database=DB_NAME,
        user=secret_dict['username'],
        password=secret_dict['password']
    )
    return conn


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def authenticate_api_key(event, context):
    """
    Validate API key and return customer context
    Used by all API endpoints
    """
    try:
        auth_header = event.get('headers', {}).get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return error_response('Unauthorized', 401)
        
        api_key = auth_header.replace('Bearer ', '')
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Query: Find API key and associated customer
        cur.execute("""
            SELECT ak.id, ak.customer_id, ak.scopes, c.name, c.tier
            FROM api_keys ak
            JOIN customers c ON ak.customer_id = c.id
            WHERE ak.key_hash = %s 
              AND ak.is_active = true
              AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
        """, (api_key_hash,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result:
            # Log failed authentication attempt
            logger.warning(f"Invalid API key attempt: {api_key[:8]}...")
            return error_response('Invalid API key', 401)
        
        api_key_id, customer_id, scopes, customer_name, customer_tier = result
        
        # Cache the session (8-hour TTL)
        session_id = f"session#{api_key_id}#{datetime.utcnow().timestamp()}"
        cache_table.put_item(
            Item={
                'SessionId': session_id,
                'CustomerId': customer_id,
                'CustomerName': customer_name,
                'CustomerTier': customer_tier,
                'Scopes': scopes,
                'ExpiresAt': int((datetime.utcnow() + timedelta(hours=8)).timestamp()),
                'TTL': int((datetime.utcnow() + timedelta(hours=8)).timestamp())
            }
        )
        
        # Update last_used_at
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE api_keys SET last_used_at = NOW() WHERE id = %s", (api_key_id,))
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'customer_id': customer_id,
                'customer_name': customer_name,
                'customer_tier': customer_tier,
                'scopes': scopes,
                'session_id': session_id
            })
        }
        
    except Exception as e:
        logger.exception(f"Auth error: {str(e)}")
        return error_response('Internal server error', 500)


@logger.inject_lambda_handler
@tracer.capture_lambda_handler
def authenticate_user_session(event, context):
    """
    Authenticate user session from customer portal
    Uses email + MFA validation
    """
    body = json.loads(event.get('body', '{}'))
    email = body.get('email')
    mfa_code = body.get('mfa_code')
    
    if not email or not mfa_code:
        return error_response('Missing email or MFA code', 400)
    
    try:
        # Validate MFA (integrate with AWS Cognito or Auth0)
        # This is a placeholder
        mfa_valid = validate_mfa_code(email, mfa_code)
        
        if not mfa_valid:
            return error_response('Invalid MFA code', 401)
        
        # Query customer from email
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, tier, status 
            FROM customers 
            WHERE billing_email = %s OR email = %s
        """, (email, email))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result:
            return error_response('Customer not found', 404)
        
        customer_id, customer_name, tier, status = result
        
        if status != 'active':
            return error_response('Account suspended or deleted', 403)
        
        # Create session JWT
        session_token = create_jwt_token(customer_id, email)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'session_token': session_token,
                'customer_id': customer_id,
                'customer_name': customer_name,
                'email': email
            })
        }
        
    except Exception as e:
        logger.exception(f"Session auth error: {str(e)}")
        return error_response('Internal server error', 500)


def error_response(message, status_code):
    return {
        'statusCode': status_code,
        'body': json.dumps({'error': message})
    }
```

### 4.2 Billing Engine Worker

**File:** `phase2-backend/functions/billing-worker.py`

```python
import json
import boto3
import psycopg2
from datetime import datetime, date
from decimal import Decimal
import os

logger = logging.getLogger()
logger.setLevel('INFO')

RDS_ENDPOINT = os.environ['RDS_ENDPOINT']
DB_NAME = os.environ['DB_NAME']

secrets_client = boto3.client('secretsmanager')
s3_client = boto3.client('s3')


def lambda_handler(event, context):
    """
    Monthly billing calculation worker
    Triggered by EventBridge on 1st of each month at 00:00 UTC
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get all active customers
        cur.execute("""
            SELECT id, name, tier, billing_email 
            FROM customers 
            WHERE status = 'active'
        """)
        
        customers = cur.fetchall()
        
        for customer_id, customer_name, tier, billing_email in customers:
            logger.info(f"Processing invoice for {customer_name}")
            
            # Calculate usage charges
            usage_metrics = get_usage_metrics(cur, customer_id)
            
            # Get tier base cost
            tier_cost = get_tier_cost(cur, tier)
            
            # Calculate usage charges based on actual consumption
            usage_charges = calculate_usage_charges(usage_metrics, tier)
            usage_total = sum(usage_charges.values())
            
            # Apply volume discounts
            volume_discount = apply_volume_discount(usage_total)
            
            # Calculate tax (assume 8% for now, make configurable)
            subtotal = tier_cost + usage_total - (tier_cost * volume_discount)
            tax_amount = Decimal(subtotal) * Decimal('0.08')
            total_amount = subtotal + tax_amount
            
            # Create invoice
            invoice_id = create_invoice(
                cur, customer_id, tier_cost, usage_charges, 
                volume_discount, tax_amount, total_amount
            )
            
            # Send invoice email
            send_invoice_email(
                billing_email, customer_name, invoice_id, 
                tier_cost, usage_total, total_amount
            )
            
            # Log audit event
            log_audit_event(cur, customer_id, 'invoice_generated', 
                          f'Monthly invoice {invoice_id} created')
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Processed {len(customers)} invoices',
                'customers_processed': len(customers)
            })
        }
        
    except Exception as e:
        logger.error(f"Billing error: {str(e)}")
        raise


def get_usage_metrics(cur, customer_id):
    """Retrieve monthly usage metrics from Aurora"""
    current_month = date.today().replace(day=1)
    
    cur.execute("""
        SELECT 
            account_count, ou_count, scp_count,
            cloudtrail_events_logged, config_rule_evaluations, guardduty_findings,
            log_storage_gb, archive_storage_gb,
            nat_gateway_bytes_processed, vpn_connections_count,
            custom_ec2_instances, custom_rds_instances, custom_s3_buckets
        FROM usage_metrics
        WHERE customer_id = %s AND month = %s
    """, (customer_id, current_month))
    
    result = cur.fetchone()
    if not result:
        return {}  # No usage this month
    
    return {
        'accounts': result[0],
        'ous': result[1],
        'scps': result[2],
        'cloudtrail_events': result[3],
        'config_evaluations': result[4],
        'guardduty_findings': result[5],
        'log_storage_gb': result[6],
        'archive_storage_gb': result[7],
        'nat_bytes': result[8],
        'vpn_connections': result[9],
        'ec2_instances': result[10],
        'rds_instances': result[11],
        's3_buckets': result[12]
    }


def calculate_usage_charges(usage_metrics, tier):
    """
    Calculate per-unit charges based on tier and usage
    Pricing varies by tier
    """
    
    # Pricing rules by tier
    pricing = {
        'standard': {
            'log_storage_gb': 0.03,      # $0.03/GB
            'nat_bytes': 0.045 / (1024**3),  # $0.045 per GB processed
            'cloudtrail_events': 0.0000002,  # $0.0000002 per event
            'config_evaluations': 0.001,  # $0.001 per evaluation
            'guardduty_findings': 0.05,  # $0.05 per finding
        },
        'fintech': {
            'log_storage_gb': 0.025,     # Slight discount
            'nat_bytes': 0.040 / (1024**3),
            'cloudtrail_events': 0.00000015,
            'config_evaluations': 0.0008,
            'guardduty_findings': 0.04,
        },
        'healthcare': {
            'log_storage_gb': 0.025,     # HIPAA compliance premium
            'nat_bytes': 0.040 / (1024**3),
            'cloudtrail_events': 0.00000015,
            'config_evaluations': 0.0008,
            'guardduty_findings': 0.04,
        },
        'gov-federal': {
            'log_storage_gb': 0.02,      # Volume discount
            'nat_bytes': 0.035 / (1024**3),
            'cloudtrail_events': 0.0000001,
            'config_evaluations': 0.0006,
            'guardduty_findings': 0.03,
        }
    }
    
    tier_pricing = pricing.get(tier, pricing['standard'])
    charges = {}
    
    charges['log_storage'] = usage_metrics.get('log_storage_gb', 0) * tier_pricing['log_storage_gb']
    charges['nat_processing'] = usage_metrics.get('nat_bytes', 0) * tier_pricing['nat_bytes']
    charges['cloudtrail'] = usage_metrics.get('cloudtrail_events', 0) * tier_pricing['cloudtrail_events']
    charges['config_evaluations'] = usage_metrics.get('config_evaluations', 0) * tier_pricing['config_evaluations']
    charges['guardduty_findings'] = usage_metrics.get('guardduty_findings', 0) * tier_pricing['guardduty_findings']
    
    return charges


def create_invoice(cur, customer_id, tier_cost, usage_charges, volume_discount, tax_amount, total_amount):
    """Create invoice record in Aurora"""
    invoice_number = f"INV-{date.today().year}-{date.today().month:02d}-{customer_id}"
    
    cur.execute("""
        INSERT INTO invoices (
            customer_id, invoice_number, month, tier_base_cost, usage_charges,
            usage_total, volume_discount, subtotal, tax_amount, total_amount,
            status, issued_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'issued', NOW())
        RETURNING id
    """, (
        customer_id, invoice_number, date.today().replace(day=1),
        tier_cost, json.dumps(usage_charges), sum(usage_charges.values()),
        volume_discount, tier_cost + sum(usage_charges.values()), tax_amount, total_amount
    ))
    
    invoice_id = cur.fetchone()[0]
    return invoice_id


def send_invoice_email(billing_email, customer_name, invoice_id, tier_cost, usage_total, total_amount):
    """Send invoice via SES"""
    ses_client = boto3.client('ses')
    
    email_body = f"""
Dear {customer_name},

Your SecureBase invoice is ready.

Invoice ID: {invoice_id}
Base Tier Cost: ${tier_cost:.2f}
Usage Charges: ${usage_total:.2f}
Total Due: ${total_amount:.2f}

Please review your invoice in the SecureBase customer portal.

Best regards,
SecureBase Billing Team
"""
    
    ses_client.send_email(
        Source='billing@securebase.io',
        Destination={'ToAddresses': [billing_email]},
        Message={
            'Subject': {'Data': f'SecureBase Invoice - {invoice_id}'},
            'Body': {'Text': {'Data': email_body}}
        }
    )
```

---

## Part 5: API Design

### 5.1 REST Endpoints

```
POST   /auth/authenticate          - Authenticate with API key
POST   /auth/session               - Authenticate user session (MFA)
GET    /customers/{id}             - Get customer details (RLS protected)
GET    /invoices                   - List invoices (paginated)
GET    /invoices/{id}              - Get invoice details
GET    /metrics                    - Get usage metrics
GET    /audit-events               - Get compliance audit log
POST   /support-tickets            - Create support ticket
GET    /notifications              - Get notification history
```

### 5.2 GraphQL Schema (Optional)

```graphql
type Customer {
  id: ID!
  name: String!
  tier: String!
  status: String!
  createdAt: DateTime!
}

type Invoice {
  id: ID!
  invoiceNumber: String!
  month: Date!
  tierBaseCost: Float!
  usageCharges: JSON!
  totalAmount: Float!
  status: String!
  issuedAt: DateTime!
}

type UsageMetrics {
  customerId: ID!
  month: Date!
  accountCount: Int!
  logStorageGb: Float!
  natBytesProcessed: Int!
}

type Query {
  customer(id: ID!): Customer
  invoices(month: Date): [Invoice!]!
  metrics(month: Date): UsageMetrics
  auditEvents(limit: Int): [AuditEvent!]!
}

type Mutation {
  createSupportTicket(subject: String!, description: String!): SupportTicket!
}
```

---

## Part 6: Cost Model & Projections

### 6.1 Monthly Costs (10 Customers)

| Component | Unit | Monthly | Notes |
|-----------|------|---------|-------|
| Aurora Serverless v2 | Compute | $180 | 1.5 ACU avg × 30 days × $0.06/ACU-hour |
| Aurora Storage | Storage | $50 | 100 GB × $0.50/GB/month |
| RDS Proxy | Connections | $25 | 100 proxy connections |
| DynamoDB | On-demand | $40 | ~2M read/write units/month |
| Lambda | Invocations | $30 | 10M requests/month |
| API Gateway | Requests | $20 | 5M requests/month |
| S3 (logs) | Storage | $25 | 1 TB compliance archive |
| CloudWatch | Logs/Metrics | $35 | Logs, custom metrics |
| Secrets Manager | Secret | $5 | 1 secret @ $0.40/secret |
| SES (email) | Emails | $15 | Invoices + notifications |
| **Base Total** | | **$425/month** | |
| **Per-Customer Add** | | **$25-35** | Per-customer VPC, metrics, storage |
| **10 Customers Total** | | **$675-750** | |

### 6.2 Revenue Model (10 Customers)

```
Standard tier:     1 customer × $2,000  = $2,000
Fintech tier:      4 customers × $8,000 = $32,000
Healthcare tier:   2 customers × $15,000 = $30,000
Gov-Federal tier:  3 customers × $25,000 = $75,000
─────────────────────────────────────────
Total Monthly:     10 customers           = $139,000

Cost of Goods Sold (Phase 1 + 2):  $1,200/month
Gross Margin:                       99.1%
```

---

## Part 7: Security & Compliance

### 7.1 Data Isolation (RLS in Action)

```sql
-- Connection example in Lambda
conn = get_db_connection()
cur = conn.cursor()

# Set the customer context (before ANY query)
cur.execute("SET app.current_customer_id = %s", (customer_id,))

# Now ALL queries are automatically filtered by RLS
cur.execute("SELECT * FROM invoices")  # Only this customer's invoices
cur.execute("SELECT * FROM audit_events")  # Only this customer's events
```

**RLS Benefit:** If a developer writes a query without WHERE clause, they still CANNOT see other customers' data.

### 7.2 Encryption Strategy

| Layer | Method | Key Management |
|-------|--------|-----------------|
| **Transport** | TLS 1.3 (API → Lambda → RDS) | AWS Certificate Manager |
| **At Rest** | AES-256 (RDS, S3, DynamoDB) | Customer-managed KMS key |
| **API Keys** | Bcrypt hash (never plaintext) | Hashed in Aurora |
| **Secrets** | AWS Secrets Manager | KMS encryption |

### 7.3 Audit Trail (Immutable)

```sql
-- Audit events are append-only
-- Once inserted, they're never updated
CREATE POLICY audit_immutable ON audit_events
  FOR UPDATE USING (false);  -- Prevent updates

-- Archive to S3 + Glacier after 90 days
-- RLS ensures each customer sees only their own audit events
```

---

## Part 8: Deployment & Migration

### 8.1 Phase 2 Rollout Timeline

**Week 1-2: Infrastructure Setup**
- Deploy Aurora Serverless v2 cluster
- Set up RDS Proxy + connection pooling
- Create DynamoDB tables
- Configure Lambda execution roles
- Set up API Gateway

**Week 2-3: Data Migration**
- Export customer list from Phase 1 (Organizations)
- Populate `customers` table
- Create API keys for initial integration testing
- Verify RLS policies

**Week 3-4: API Implementation**
- Deploy Lambda functions (auth, billing, portal)
- Test API with customer data
- Integrate with Stripe/AWS Marketplace for payment
- Set up email templates (SES)

**Week 4-5: Testing & Hardening**
- Security review (RLS bypass testing, SQL injection prevention)
- Load testing (scale to 100+ customers)
- Compliance audit trail verification
- Customer acceptance testing

**Week 5-6: Go-Live**
- Enable customer portal access
- Migrate first customers to Phase 2
- Monitor billing engine (first monthly cycle)
- Support handoff

---

## Part 9: Success Criteria

### 9.1 Functional
- [ ] All 10 customers can log in to portal
- [ ] Monthly invoices generated correctly
- [ ] Usage metrics accurately reported
- [ ] Audit events immutable & archived
- [ ] API key authentication working
- [ ] RLS prevents cross-tenant access

### 9.2 Performance
- [ ] API response time < 200ms (p99)
- [ ] Database query time < 100ms (p99)
- [ ] Scaling: Handle 100+ simultaneous users
- [ ] Monthly batch job completes in < 5 minutes

### 9.3 Security
- [ ] Zero cross-tenant data exposure (verified by pentest)
- [ ] All data encrypted in transit + at rest
- [ ] Audit logs immutable (7-year retention)
- [ ] API keys rotated monthly (automated)

### 9.4 Compliance
- [ ] SOC 2 Type II controls in place
- [ ] HIPAA BAA signed for healthcare tier
- [ ] FedRAMP audit trail verified
- [ ] PCI-DSS payment data segregation

---

## Appendix: Quick Reference

**Database Connection (Lambda):**
```python
import psycopg2
conn = psycopg2.connect(
    host='securebase-phase2-proxy.proxy-xxxxx.us-east-1.rds.amazonaws.com',
    port=5432,
    database='securebase',
    user='adminuser',
    password=get_secret('securebase/rds/admin-password')
)
```

**RLS Enforcement:**
```python
# Every Lambda request must set customer context
cur.execute("SET app.current_customer_id = %s", (request.customer_id,))
```

**Billing Calculation Frequency:**
- Real-time metrics: Every minute (DynamoDB aggregation)
- Monthly invoices: 1st of month at 00:00 UTC (Lambda scheduled)
- Compliance archive: Weekly (S3 → Glacier)

**Cost per Customer (incremental):**
- Storage: +$2/GB/month
- Compute: +$0.5/1000 API calls
- Metrics: +$0.10 per 100K metric points

