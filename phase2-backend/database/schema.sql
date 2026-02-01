-- ============================================
-- SecureBase Phase 2: PostgreSQL Schema
-- ============================================
-- Multi-tenant database with Row-Level Security
-- All data isolated per customer via RLS policies
-- Immutable audit trails for compliance
--
-- Tables:
--   - customers: Customer metadata, tiers, billing
--   - tier_features: Feature matrix per tier
--   - usage_metrics: Monthly usage aggregation
--   - invoices: Generated invoices per customer
--   - audit_events: Immutable compliance log
--   - api_keys: Authentication tokens
--   - support_tickets: Customer support tracking
--   - notifications: Email/SMS delivery tracking

-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================
-- CUSTOM TYPES
-- ============================================

CREATE TYPE customer_tier AS ENUM ('standard', 'fintech', 'healthcare', 'gov-federal');
CREATE TYPE customer_status AS ENUM ('active', 'suspended', 'deleted', 'trial');
CREATE TYPE compliance_framework AS ENUM ('soc2', 'hipaa', 'fedramp', 'cis');
CREATE TYPE payment_method_type AS ENUM ('stripe', 'aws_marketplace', 'invoice');
CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'paid', 'overdue', 'cancelled');
CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'webhook');
CREATE TYPE notification_type AS ENUM ('invoice_issued', 'compliance_alert', 'system_update', 'support_response');

-- ============================================
-- CUSTOMERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name TEXT NOT NULL UNIQUE,
  tier customer_tier NOT NULL,
  framework compliance_framework NOT NULL,
  status customer_status DEFAULT 'active',
  
  -- AWS Organization details
  aws_org_id TEXT UNIQUE,
  aws_management_account_id TEXT,
  
  -- Contact info
  email TEXT NOT NULL UNIQUE,
  billing_email TEXT NOT NULL,
  billing_contact_phone TEXT,
  
  -- Compliance settings
  mfa_enforced BOOLEAN DEFAULT true,
  audit_retention_days INTEGER DEFAULT 2555,  -- 7 years
  encryption_required BOOLEAN DEFAULT true,
  vpc_isolation_enabled BOOLEAN DEFAULT true,
  
  -- Payment
  payment_method payment_method_type DEFAULT 'aws_marketplace',
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'inactive',
  trial_end_date TIMESTAMP,
  
  -- Metadata
  tags JSONB DEFAULT '{}',
  custom_config JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT valid_billing_email CHECK (billing_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_customers_tier ON customers(tier);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX idx_customers_aws_org_id ON customers(aws_org_id);

-- ============================================
-- TIER FEATURES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS tier_features (
  id SERIAL PRIMARY KEY,
  tier customer_tier UNIQUE NOT NULL,
  
  -- Capacity limits
  max_accounts INTEGER,
  max_regions INTEGER,
  sso_users_limit INTEGER,
  max_vpcs INTEGER,
  max_support_tickets_per_month INTEGER,
  
  -- Features
  apikey_allowed BOOLEAN DEFAULT true,
  custom_scps BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  compliance_reports BOOLEAN DEFAULT false,
  cost_analytics BOOLEAN DEFAULT false,
  multi_region BOOLEAN DEFAULT false,
  transit_gateway BOOLEAN DEFAULT false,
  break_glass_role BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tier_features (tier, max_accounts, max_regions, sso_users_limit, max_vpcs, max_support_tickets_per_month, 
  apikey_allowed, custom_scps, priority_support, compliance_reports, cost_analytics, multi_region, transit_gateway) 
VALUES 
  ('standard', 5, 2, 10, 5, 5, true, false, false, false, false, false, false),
  ('fintech', 20, 5, 50, 20, 50, true, true, true, true, true, false, true),
  ('healthcare', 20, 5, 50, 20, unlimited, true, true, true, true, true, false, true),
  ('gov-federal', 50, 10, 200, 50, unlimited, true, true, true, true, true, true, true)
ON CONFLICT (tier) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- USAGE METRICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  
  -- Account metrics
  account_count INTEGER DEFAULT 0,
  ou_count INTEGER DEFAULT 0,
  scp_count INTEGER DEFAULT 0,
  
  -- Compute metrics (from CloudWatch)
  cloudtrail_events_logged BIGINT DEFAULT 0,
  config_rule_evaluations BIGINT DEFAULT 0,
  guardduty_findings INTEGER DEFAULT 0,
  security_hub_findings INTEGER DEFAULT 0,
  
  -- Storage metrics
  log_storage_gb DECIMAL(10,2) DEFAULT 0.0,
  archive_storage_gb DECIMAL(10,2) DEFAULT 0.0,
  
  -- Network metrics
  nat_gateway_bytes_processed BIGINT DEFAULT 0,
  vpn_connections_count INTEGER DEFAULT 0,
  data_transfer_gb DECIMAL(10,2) DEFAULT 0.0,
  
  -- Custom workload metrics
  custom_ec2_instances INTEGER DEFAULT 0,
  custom_rds_instances INTEGER DEFAULT 0,
  custom_s3_buckets INTEGER DEFAULT 0,
  custom_lambda_invocations BIGINT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(customer_id, month)
);

CREATE INDEX idx_usage_customer_month ON usage_metrics(customer_id, month DESC);
CREATE INDEX idx_usage_created_at ON usage_metrics(created_at DESC);

-- ============================================
-- INVOICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  invoice_number TEXT UNIQUE NOT NULL,
  month DATE NOT NULL,
  
  -- Billing breakdown
  tier_base_cost DECIMAL(10,2) NOT NULL,
  usage_charges JSONB NOT NULL,
  usage_total DECIMAL(10,2) DEFAULT 0.0,
  
  -- Discounts
  volume_discount DECIMAL(3,2) DEFAULT 0.0,
  promotional_credit DECIMAL(10,2) DEFAULT 0.0,
  
  -- Totals
  subtotal DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,4) DEFAULT 0.0,
  tax_amount DECIMAL(10,2) DEFAULT 0.0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Status & payment
  status invoice_status DEFAULT 'draft',
  issued_at TIMESTAMP,
  due_at TIMESTAMP,
  paid_at TIMESTAMP,
  
  payment_method payment_method_type,
  payment_id TEXT,
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_customer_month ON invoices(customer_id, month DESC);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issued_at ON invoices(issued_at DESC);
CREATE INDEX idx_invoices_due_at ON invoices(due_at DESC);

-- ============================================
-- AUDIT EVENTS TABLE (IMMUTABLE)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  
  resource_type VARCHAR(50),
  resource_id TEXT,
  
  actor_email TEXT NOT NULL,
  actor_ip_address INET,
  actor_user_agent TEXT,
  
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  
  -- Context
  request_id TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Archival
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP
);

CREATE INDEX idx_audit_customer_date ON audit_events(customer_id, created_at DESC);
CREATE INDEX idx_audit_event_type ON audit_events(event_type, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_events(actor_email, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_events(resource_type, resource_id);

-- Prevent updates (audit log immutability)
CREATE OR REPLACE FUNCTION prevent_audit_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutable_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_update();

-- ============================================
-- API KEYS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL UNIQUE,  -- First 8 chars shown in UI
  
  -- Permissions
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:invoices', 'read:metrics'],
  
  -- Lifecycle
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  rotated_at TIMESTAMP,
  
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_api_keys_customer ON api_keys(customer_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- ============================================
-- SUPPORT TICKETS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  
  priority ticket_priority DEFAULT 'normal',
  status ticket_status DEFAULT 'open',
  
  created_by_email TEXT NOT NULL,
  assigned_to_email TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX idx_support_customer ON support_tickets(customer_id);
CREATE INDEX idx_support_status ON support_tickets(status);
CREATE INDEX idx_support_priority ON support_tickets(priority);
CREATE INDEX idx_support_created_at ON support_tickets(created_at DESC);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type notification_type,
  
  channel notification_channel DEFAULT 'email',
  delivery_address TEXT NOT NULL,
  
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP,
  failed_reason TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_customer ON notifications(customer_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- EVIDENCE RECORDS TABLE (Compliance Evidence)
-- ============================================

CREATE TYPE evidence_status AS ENUM ('pass', 'fail', 'missing', 'pending', 'expired');
CREATE TYPE evidence_type AS ENUM ('policy', 'system', 'log', 'attestation', 'screenshot', 'report', 'configuration');
CREATE TYPE collection_method AS ENUM ('automated', 'manual', 'semi_automated');
CREATE TYPE evidence_category AS ENUM ('CC', 'AC', 'AU', 'PI', 'CM', 'IA', 'SC', 'SI', 'RA', 'CA', 'CP');

CREATE TABLE IF NOT EXISTS evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Control identification
  control_id VARCHAR(50) NOT NULL,
  control_name TEXT NOT NULL,
  framework compliance_framework NOT NULL,
  category evidence_category NOT NULL,
  
  -- Evidence details
  evidence_type evidence_type NOT NULL,
  source_system VARCHAR(100) NOT NULL,  -- Okta, AWS, GitHub, Stripe, etc.
  owner TEXT NOT NULL,  -- Email of responsible party
  collection_method collection_method NOT NULL,
  
  -- Status and validity
  status evidence_status DEFAULT 'pending',
  last_collected TIMESTAMP,
  valid_until TIMESTAMP,
  next_collection TIMESTAMP,
  
  -- Artifact reference
  artifact_ref TEXT,  -- S3 URI, file path, or URL to evidence
  artifact_hash TEXT,  -- SHA-256 hash for integrity
  artifact_size_bytes BIGINT,
  
  -- Metadata
  description TEXT,
  remediation_notes TEXT,
  tags JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Audit trail
  collected_by TEXT,  -- Email of collector (for manual evidence)
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_customer_control UNIQUE(customer_id, control_id, framework)
);

CREATE INDEX idx_evidence_customer_framework ON evidence_records(customer_id, framework);
CREATE INDEX idx_evidence_status ON evidence_records(status);
CREATE INDEX idx_evidence_control_id ON evidence_records(control_id);
CREATE INDEX idx_evidence_valid_until ON evidence_records(valid_until);
CREATE INDEX idx_evidence_last_collected ON evidence_records(last_collected DESC);
CREATE INDEX idx_evidence_source_system ON evidence_records(source_system);

-- ============================================
-- ROW-LEVEL SECURITY (RLS) SETUP
-- ============================================

-- Enable RLS on all sensitive tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_records ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: Customer Isolation
-- ============================================

-- Customers table: Each customer only sees themselves
CREATE POLICY customer_isolation_customers 
  ON customers 
  FOR ALL 
  USING (id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

CREATE POLICY customer_isolation_customers_insert 
  ON customers 
  FOR INSERT 
  WITH CHECK (current_setting('app.role') = 'admin');

-- Usage metrics: Only own metrics
CREATE POLICY customer_isolation_usage 
  ON usage_metrics 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

-- Invoices: Only own invoices
CREATE POLICY customer_isolation_invoices 
  ON invoices 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

-- Audit events: Only own audit trail
CREATE POLICY customer_isolation_audit 
  ON audit_events 
  FOR SELECT 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

-- Audit events: System can insert audit logs
CREATE POLICY audit_insert_allowed 
  ON audit_events 
  FOR INSERT 
  WITH CHECK (true);

-- API keys: Only own keys
CREATE POLICY customer_isolation_api_keys 
  ON api_keys 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

-- Support tickets: Only own tickets
CREATE POLICY customer_isolation_support 
  ON support_tickets 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

-- Notifications: Only own notifications
CREATE POLICY customer_isolation_notifications 
  ON notifications 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

-- Evidence records: Only own evidence
CREATE POLICY customer_isolation_evidence 
  ON evidence_records 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

-- Evidence records: System can insert evidence
CREATE POLICY evidence_insert_allowed 
  ON evidence_records 
  FOR INSERT 
  WITH CHECK (current_setting('app.role') IN ('admin', 'system'));

-- ============================================
-- ADMIN ROLE (Bypass RLS)
-- ============================================

CREATE ROLE customer_admin;

-- Grant admin role RLS bypass (optional - use with caution)
-- Note: This would be used for internal monitoring dashboards

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Set customer context for RLS
CREATE OR REPLACE FUNCTION set_customer_context(customer_id UUID, role TEXT DEFAULT 'customer')
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_customer_id', customer_id::TEXT, false);
  PERFORM set_config('app.role', role, false);
END;
$$ LANGUAGE plpgsql;

-- Archive old audit events (for 7-year retention)
CREATE OR REPLACE FUNCTION archive_old_audit_events()
RETURNS TABLE(archived_count INT) AS $$
DECLARE
  row_count INT;
BEGIN
  UPDATE audit_events
  SET is_archived = true, archived_at = CURRENT_TIMESTAMP
  WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
    AND is_archived = false;
  
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN QUERY SELECT row_count;
END;
$$ LANGUAGE plpgsql;

-- Calculate monthly charges based on usage
CREATE OR REPLACE FUNCTION calculate_monthly_charges(
  p_customer_id UUID,
  p_month DATE
)
RETURNS TABLE(
  tier_base_cost DECIMAL,
  usage_charges JSONB,
  usage_total DECIMAL,
  volume_discount DECIMAL,
  subtotal DECIMAL,
  tax_amount DECIMAL,
  total_amount DECIMAL
) AS $$
DECLARE
  v_tier customer_tier;
  v_usage usage_metrics%ROWTYPE;
  v_charges JSONB;
  v_log_cost DECIMAL;
  v_nat_cost DECIMAL;
  v_cloudtrail_cost DECIMAL;
  v_config_cost DECIMAL;
  v_guardduty_cost DECIMAL;
  v_total_usage DECIMAL;
  v_discount DECIMAL;
  v_tax DECIMAL;
BEGIN
  -- Get customer tier
  SELECT tier INTO v_tier FROM customers WHERE id = p_customer_id;
  
  -- Get usage metrics
  SELECT * INTO v_usage FROM usage_metrics 
    WHERE customer_id = p_customer_id AND month = p_month;
  
  IF v_usage IS NULL THEN
    v_usage.log_storage_gb := 0;
    v_usage.nat_gateway_bytes_processed := 0;
    v_usage.cloudtrail_events_logged := 0;
    v_usage.config_rule_evaluations := 0;
    v_usage.guardduty_findings := 0;
  END IF;
  
  -- Calculate charges by tier
  CASE v_tier
    WHEN 'standard' THEN
      v_log_cost := COALESCE(v_usage.log_storage_gb, 0) * 0.03;
      v_nat_cost := COALESCE(v_usage.nat_gateway_bytes_processed, 0) * (0.045 / (1024::DECIMAL^3));
      v_cloudtrail_cost := COALESCE(v_usage.cloudtrail_events_logged, 0) * 0.0000002;
      v_config_cost := COALESCE(v_usage.config_rule_evaluations, 0) * 0.001;
      v_guardduty_cost := COALESCE(v_usage.guardduty_findings, 0) * 0.05;
    WHEN 'fintech' THEN
      v_log_cost := COALESCE(v_usage.log_storage_gb, 0) * 0.025;
      v_nat_cost := COALESCE(v_usage.nat_gateway_bytes_processed, 0) * (0.040 / (1024::DECIMAL^3));
      v_cloudtrail_cost := COALESCE(v_usage.cloudtrail_events_logged, 0) * 0.00000015;
      v_config_cost := COALESCE(v_usage.config_rule_evaluations, 0) * 0.0008;
      v_guardduty_cost := COALESCE(v_usage.guardduty_findings, 0) * 0.04;
    WHEN 'healthcare' THEN
      v_log_cost := COALESCE(v_usage.log_storage_gb, 0) * 0.025;
      v_nat_cost := COALESCE(v_usage.nat_gateway_bytes_processed, 0) * (0.040 / (1024::DECIMAL^3));
      v_cloudtrail_cost := COALESCE(v_usage.cloudtrail_events_logged, 0) * 0.00000015;
      v_config_cost := COALESCE(v_usage.config_rule_evaluations, 0) * 0.0008;
      v_guardduty_cost := COALESCE(v_usage.guardduty_findings, 0) * 0.04;
    WHEN 'gov-federal' THEN
      v_log_cost := COALESCE(v_usage.log_storage_gb, 0) * 0.020;
      v_nat_cost := COALESCE(v_usage.nat_gateway_bytes_processed, 0) * (0.035 / (1024::DECIMAL^3));
      v_cloudtrail_cost := COALESCE(v_usage.cloudtrail_events_logged, 0) * 0.0000001;
      v_config_cost := COALESCE(v_usage.config_rule_evaluations, 0) * 0.0006;
      v_guardduty_cost := COALESCE(v_usage.guardduty_findings, 0) * 0.03;
  END CASE;
  
  v_total_usage := COALESCE(v_log_cost, 0) + COALESCE(v_nat_cost, 0) + 
                    COALESCE(v_cloudtrail_cost, 0) + COALESCE(v_config_cost, 0) + 
                    COALESCE(v_guardduty_cost, 0);
  
  v_charges := jsonb_build_object(
    'log_storage', v_log_cost,
    'nat_processing', v_nat_cost,
    'cloudtrail', v_cloudtrail_cost,
    'config_evaluations', v_config_cost,
    'guardduty_findings', v_guardduty_cost
  );
  
  -- Apply volume discount (5% for >$5k monthly)
  IF (2000 + v_total_usage) > 5000 THEN
    v_discount := 0.05;
  ELSE
    v_discount := 0.0;
  END IF;
  
  v_tax := ((2000 + v_total_usage) * (1 - v_discount)) * 0.08;
  
  RETURN QUERY SELECT 
    2000::DECIMAL,  -- tier_base_cost (standard tier)
    v_charges,
    v_total_usage,
    v_discount,
    (2000 + v_total_usage)::DECIMAL,
    v_tax,
    ((2000 + v_total_usage) * (1 - v_discount) + v_tax)::DECIMAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS (Optional, for reporting)
-- ============================================

-- Customer billing summary
CREATE OR REPLACE VIEW customer_billing_summary AS
SELECT 
  c.id,
  c.name,
  c.tier,
  COUNT(DISTINCT i.id) as total_invoices,
  SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as total_paid,
  SUM(CASE WHEN i.status IN ('issued', 'overdue') THEN i.total_amount ELSE 0 END) as total_outstanding,
  MAX(i.issued_at) as last_invoice_date
FROM customers c
LEFT JOIN invoices i ON c.id = i.customer_id
GROUP BY c.id, c.name, c.tier;

-- Compliance event summary
CREATE OR REPLACE VIEW compliance_event_summary AS
SELECT 
  customer_id,
  event_type,
  COUNT(*) as event_count,
  MAX(created_at) as last_event,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
  COUNT(CASE WHEN status = 'failure' THEN 1 END) as failed
FROM audit_events
WHERE created_at > CURRENT_DATE - INTERVAL '90 days'
GROUP BY customer_id, event_type;

-- ============================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMP
-- ============================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_update_timestamp
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER usage_metrics_update_timestamp
  BEFORE UPDATE ON usage_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER invoices_update_timestamp
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER support_tickets_update_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert tier features if not exists
INSERT INTO tier_features (tier, max_accounts, max_regions, sso_users_limit, max_vpcs, max_support_tickets_per_month, 
  apikey_allowed, custom_scps, priority_support, compliance_reports, cost_analytics, multi_region, transit_gateway) 
VALUES 
  ('standard', 5, 2, 10, 5, 5, true, false, false, false, false, false, false),
  ('fintech', 20, 5, 50, 20, 50, true, true, true, true, true, false, true),
  ('healthcare', 20, 5, 50, 20, null, true, true, true, true, true, false, true),
  ('gov-federal', 50, 10, 200, 50, null, true, true, true, true, true, true, true)
ON CONFLICT (tier) DO NOTHING;

-- ============================================
-- PERMISSIONS & GRANT
-- ============================================

-- Standard application user (Lambda execution)
CREATE ROLE securebase_app WITH LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
GRANT USAGE ON SCHEMA public TO securebase_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO securebase_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO securebase_app;

-- Read-only analytics user
CREATE ROLE securebase_analytics WITH LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
GRANT USAGE ON SCHEMA public TO securebase_analytics;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO securebase_analytics;

-- Admin user (for migrations)
CREATE ROLE securebase_admin WITH LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION' CREATEDB CREATEROLE;
GRANT ALL ON ALL TABLES IN SCHEMA public TO securebase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO securebase_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO securebase_admin;
