-- ============================================
-- SecureBase Phase 2: Demo Seed Data
-- ============================================
-- Deterministic seed data for demonstrations
-- Generates authoritative-looking evidence of platform usage
--
-- Usage:
--   psql -h <host> -U <user> -d securebase -f seed_demo_data.sql
--
-- Features:
--   ✓ 4 realistic customers across all tiers
--   ✓ 6 months of historical usage metrics
--   ✓ Sample invoices with proper calculations
--   ✓ Support tickets and notifications
--   ✓ Audit trail demonstrating compliance
--   ✓ Deterministic UUIDs (same output every run)
--
-- Note: Uses uuid_generate_v5() for deterministic UUID generation
-- ============================================

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define namespace UUID for deterministic generation
-- Using DNS namespace + 'securebase.io' for repeatability
DO $$ 
DECLARE
  securebase_namespace UUID := uuid_generate_v5(uuid_ns_dns(), 'securebase.io');
BEGIN
  -- Store in temporary table for reuse
  CREATE TEMP TABLE IF NOT EXISTS namespace (uuid UUID);
  TRUNCATE namespace;
  INSERT INTO namespace VALUES (securebase_namespace);
END $$;

-- ============================================
-- CUSTOMERS (4 realistic demo accounts)
-- ============================================

INSERT INTO customers (
  id, name, tier, framework, status,
  email, billing_email, billing_contact_phone,
  mfa_enforced, audit_retention_days, encryption_required, vpc_isolation_enabled,
  payment_method, subscription_status, trial_end_date,
  aws_org_id, aws_management_account_id,
  tags, custom_config,
  created_at, updated_at
) VALUES 
  -- 1. ACME Healthcare Systems (Healthcare tier, HIPAA)
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    'ACME Healthcare Systems',
    'healthcare',
    'hipaa',
    'active',
    'admin@acmehealthcare.example.com',
    'billing@acmehealthcare.example.com',
    '+1-555-0101',
    true,
    2555,  -- 7 years retention for HIPAA
    true,
    true,
    'stripe',
    'active',
    NULL,  -- Not on trial
    'o-acme-healthcare-001',
    '123456789012',
    '{"industry": "healthcare", "size": "enterprise", "patient_records": "500000"}',
    '{"hipaa_baa_signed": true, "phi_workloads": true, "encryption_algorithm": "AES-256"}',
    CURRENT_TIMESTAMP - INTERVAL '187 days',  -- ~6 months ago
    CURRENT_TIMESTAMP
  ),
  
  -- 2. TechFlow Financial (Fintech tier, SOC2)
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'TechFlow Financial',
    'fintech',
    'soc2',
    'active',
    'admin@techflowfin.example.com',
    'accounting@techflowfin.example.com',
    '+1-555-0202',
    true,
    2555,
    true,
    true,
    'aws_marketplace',
    'active',
    NULL,
    'o-techflow-financial-002',
    '234567890123',
    '{"industry": "fintech", "size": "mid-market", "aum": "5000000000"}',
    '{"soc2_type2_certified": true, "pci_dss_required": true, "audit_frequency": "quarterly"}',
    CURRENT_TIMESTAMP - INTERVAL '143 days',  -- ~4.7 months ago
    CURRENT_TIMESTAMP
  ),
  
  -- 3. Federal Energy Commission (Government tier, FedRAMP)
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'Federal Energy Commission',
    'gov-federal',
    'fedramp',
    'active',
    'cloudadmin@energy.gov.example.com',
    'procurement@energy.gov.example.com',
    '+1-555-0303',
    true,
    3650,  -- 10 years retention for government
    true,
    true,
    'invoice',
    'active',
    NULL,
    'o-federal-energy-003',
    '345678901234',
    '{"agency": "DOE", "clearance_level": "secret", "region_restriction": "us-gov"}',
    '{"fedramp_moderate": true, "cjis_compliant": true, "itar_controlled": false}',
    CURRENT_TIMESTAMP - INTERVAL '212 days',  -- ~7 months ago
    CURRENT_TIMESTAMP
  ),
  
  -- 4. StartupCo (Standard tier, CIS)
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-startupco'),
    'StartupCo',
    'standard',
    'cis',
    'trial',
    'founder@startupco.example.com',
    'founder@startupco.example.com',
    '+1-555-0404',
    true,
    365,  -- 1 year retention
    true,
    false,  -- No VPC isolation on standard tier
    'stripe',
    'trialing',
    CURRENT_TIMESTAMP + INTERVAL '23 days',  -- Trial ends in 23 days
    'o-startupco-004',
    '456789012345',
    '{"industry": "saas", "size": "startup", "funding_stage": "seed"}',
    '{"pilot_program": true, "referral_code": "PILOT2025"}',
    CURRENT_TIMESTAMP - INTERVAL '7 days',  -- Just started 7 days ago
    CURRENT_TIMESTAMP
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- API KEYS (for demo login)
-- ============================================

INSERT INTO api_keys (
  id, customer_id, key_name, key_hash, key_prefix,
  permissions, is_active, expires_at,
  created_by, created_at, last_used_at
) VALUES
  -- ACME Healthcare production key
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'apikey-acme-prod'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    'Production Dashboard Key',
    crypt('acme_prod_key_1234567890abcdef', gen_salt('bf', 8)),  -- bcrypt hash
    'sk_prod_acme',
    '["read:metrics", "read:invoices", "read:compliance", "write:support"]',
    true,
    NULL,  -- No expiration
    'admin@acmehealthcare.example.com',
    CURRENT_TIMESTAMP - INTERVAL '180 days',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
  ),
  
  -- TechFlow Financial API key
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'apikey-techflow-prod'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'Primary API Key',
    crypt('techflow_api_key_abcdef1234567890', gen_salt('bf', 8)),
    'sk_prod_tech',
    '["read:*", "write:*"]',  -- Full access
    true,
    NULL,
    'admin@techflowfin.example.com',
    CURRENT_TIMESTAMP - INTERVAL '140 days',
    CURRENT_TIMESTAMP - INTERVAL '5 hours'
  ),
  
  -- Federal Energy restricted key
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'apikey-federal-readonly'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'Read-Only Monitoring Key',
    crypt('federal_readonly_key_1234abcd', gen_salt('bf', 8)),
    'sk_gov_fed',
    '["read:metrics", "read:compliance", "read:audit"]',
    true,
    CURRENT_TIMESTAMP + INTERVAL '90 days',  -- Expires in 90 days (gov requirement)
    'cloudadmin@energy.gov.example.com',
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    CURRENT_TIMESTAMP - INTERVAL '1 hour'
  ),
  
  -- StartupCo trial key
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'apikey-startup-trial'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-startupco'),
    'Trial Access Key',
    crypt('startup_trial_key_xyz789', gen_salt('bf', 8)),
    'sk_test_start',
    '["read:metrics", "read:invoices"]',
    true,
    CURRENT_TIMESTAMP + INTERVAL '23 days',  -- Expires with trial
    'founder@startupco.example.com',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '30 minutes'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- USAGE METRICS (6 months of historical data)
-- ============================================

-- Generate monthly usage for each customer
DO $$
DECLARE
  customer_record RECORD;
  month_date DATE;
  months_back INTEGER;
BEGIN
  -- For each customer
  FOR customer_record IN 
    SELECT id, tier, created_at FROM customers 
    WHERE name IN ('ACME Healthcare Systems', 'TechFlow Financial', 'Federal Energy Commission', 'StartupCo')
  LOOP
    -- Generate 6 months of usage data (or since customer creation)
    FOR months_back IN 0..5 LOOP
      month_date := DATE_TRUNC('month', CURRENT_DATE - (months_back || ' months')::INTERVAL);
      
      -- Skip months before customer was created
      CONTINUE WHEN month_date < DATE_TRUNC('month', customer_record.created_at);
      
      -- Calculate realistic metrics based on tier
      INSERT INTO usage_metrics (
        id, customer_id, month,
        account_count, ou_count, scp_count,
        cloudtrail_events_logged, config_rule_evaluations,
        guardduty_findings, security_hub_findings,
        log_storage_gb, archive_storage_gb,
        nat_gateway_bytes_processed, vpn_connections_count, data_transfer_gb,
        custom_ec2_instances, custom_rds_instances, custom_s3_buckets, custom_lambda_invocations,
        created_at, updated_at
      ) VALUES (
        uuid_generate_v5((SELECT uuid FROM namespace), customer_record.id::text || month_date::text),
        customer_record.id,
        month_date,
        -- Scale metrics by tier
        CASE customer_record.tier
          WHEN 'standard' THEN 2 + (months_back % 3)
          WHEN 'fintech' THEN 8 + (months_back % 5)
          WHEN 'healthcare' THEN 12 + (months_back % 6)
          WHEN 'gov-federal' THEN 25 + (months_back % 10)
        END,
        CASE customer_record.tier
          WHEN 'standard' THEN 3
          WHEN 'fintech' THEN 5
          WHEN 'healthcare' THEN 5
          WHEN 'gov-federal' THEN 12
        END,
        CASE customer_record.tier
          WHEN 'standard' THEN 5
          WHEN 'fintech' THEN 12
          WHEN 'healthcare' THEN 15
          WHEN 'gov-federal' THEN 30
        END,
        -- CloudTrail events (higher for healthcare/gov due to compliance)
        CASE customer_record.tier
          WHEN 'standard' THEN 250000 + (months_back * 10000)
          WHEN 'fintech' THEN 1500000 + (months_back * 50000)
          WHEN 'healthcare' THEN 3200000 + (months_back * 100000)
          WHEN 'gov-federal' THEN 8500000 + (months_back * 200000)
        END,
        -- Config rule evaluations
        CASE customer_record.tier
          WHEN 'standard' THEN 15000 + (months_back * 500)
          WHEN 'fintech' THEN 85000 + (months_back * 2000)
          WHEN 'healthcare' THEN 120000 + (months_back * 3000)
          WHEN 'gov-federal' THEN 350000 + (months_back * 8000)
        END,
        -- GuardDuty findings (fewer = better security)
        CASE customer_record.tier
          WHEN 'standard' THEN 3 + (months_back % 2)
          WHEN 'fintech' THEN 1 + (months_back % 2)
          WHEN 'healthcare' THEN 0 + (months_back % 2)
          WHEN 'gov-federal' THEN 0
        END,
        -- Security Hub findings
        CASE customer_record.tier
          WHEN 'standard' THEN 12 + (months_back % 5)
          WHEN 'fintech' THEN 5 + (months_back % 3)
          WHEN 'healthcare' THEN 2 + (months_back % 2)
          WHEN 'gov-federal' THEN 1 + (months_back % 2)
        END,
        -- Log storage (GB) - grows over time
        CASE customer_record.tier
          WHEN 'standard' THEN 45.5 + (months_back * 8.2)
          WHEN 'fintech' THEN 320.7 + (months_back * 45.3)
          WHEN 'healthcare' THEN 890.2 + (months_back * 120.5)
          WHEN 'gov-federal' THEN 2340.8 + (months_back * 310.2)
        END,
        -- Archive storage (GB)
        CASE customer_record.tier
          WHEN 'standard' THEN 12.3 + (months_back * 2.1)
          WHEN 'fintech' THEN 180.5 + (months_back * 25.7)
          WHEN 'healthcare' THEN 1200.3 + (months_back * 150.2)
          WHEN 'gov-federal' THEN 5600.7 + (months_back * 580.5)
        END,
        -- NAT Gateway bytes processed
        CASE customer_record.tier
          WHEN 'standard' THEN 15000000000::BIGINT + (months_back * 1000000000::BIGINT)
          WHEN 'fintech' THEN 85000000000::BIGINT + (months_back * 5000000000::BIGINT)
          WHEN 'healthcare' THEN 120000000000::BIGINT + (months_back * 8000000000::BIGINT)
          WHEN 'gov-federal' THEN 450000000000::BIGINT + (months_back * 30000000000::BIGINT)
        END,
        -- VPN connections
        CASE customer_record.tier
          WHEN 'standard' THEN 0
          WHEN 'fintech' THEN 2
          WHEN 'healthcare' THEN 4
          WHEN 'gov-federal' THEN 8
        END,
        -- Data transfer (GB)
        CASE customer_record.tier
          WHEN 'standard' THEN 234.5 + (months_back * 18.3)
          WHEN 'fintech' THEN 1250.8 + (months_back * 95.2)
          WHEN 'healthcare' THEN 3400.2 + (months_back * 280.5)
          WHEN 'gov-federal' THEN 12500.7 + (months_back * 950.3)
        END,
        -- Custom workload resources
        CASE customer_record.tier
          WHEN 'standard' THEN 3 + (months_back % 2)
          WHEN 'fintech' THEN 12 + (months_back % 4)
          WHEN 'healthcare' THEN 18 + (months_back % 5)
          WHEN 'gov-federal' THEN 45 + (months_back % 8)
        END,
        CASE customer_record.tier
          WHEN 'standard' THEN 1
          WHEN 'fintech' THEN 3 + (months_back % 2)
          WHEN 'healthcare' THEN 5 + (months_back % 2)
          WHEN 'gov-federal' THEN 12 + (months_back % 3)
        END,
        CASE customer_record.tier
          WHEN 'standard' THEN 8 + (months_back % 3)
          WHEN 'fintech' THEN 45 + (months_back % 10)
          WHEN 'healthcare' THEN 78 + (months_back % 15)
          WHEN 'gov-federal' THEN 230 + (months_back % 25)
        END,
        CASE customer_record.tier
          WHEN 'standard' THEN 125000 + (months_back * 10000)
          WHEN 'fintech' THEN 850000 + (months_back * 50000)
          WHEN 'healthcare' THEN 2300000 + (months_back * 150000)
          WHEN 'gov-federal' THEN 8500000 + (months_back * 500000)
        END,
        month_date + INTERVAL '5 days',  -- Created 5 days into the month
        CURRENT_TIMESTAMP
      ) ON CONFLICT (customer_id, month) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- INVOICES (monthly billing records)
-- ============================================

-- Pricing table (base costs per tier)
CREATE TEMP TABLE tier_pricing AS
SELECT 'standard'::customer_tier AS tier, 2000.00 AS base_cost
UNION ALL SELECT 'fintech'::customer_tier, 8000.00
UNION ALL SELECT 'healthcare'::customer_tier, 15000.00
UNION ALL SELECT 'gov-federal'::customer_tier, 25000.00;

-- Generate invoices from usage metrics
DO $$
DECLARE
  usage_record RECORD;
  customer_record RECORD;
  base_cost DECIMAL(10,2);
  usage_charges JSONB;
  usage_total DECIMAL(10,2);
  invoice_num TEXT;
  invoice_month INTEGER := 1;
BEGIN
  FOR usage_record IN 
    SELECT um.*, c.tier, c.name, c.payment_method
    FROM usage_metrics um
    JOIN customers c ON um.customer_id = c.id
    WHERE c.name IN ('ACME Healthcare Systems', 'TechFlow Financial', 'Federal Energy Commission')
    ORDER BY um.customer_id, um.month
  LOOP
    -- Get base cost for tier
    SELECT tp.base_cost INTO base_cost FROM tier_pricing tp WHERE tp.tier = usage_record.tier;
    
    -- Calculate usage charges
    usage_total := 
      (usage_record.log_storage_gb * 0.023) +  -- $0.023/GB CloudTrail logs
      (usage_record.archive_storage_gb * 0.004) +  -- $0.004/GB Glacier
      (usage_record.data_transfer_gb * 0.09) +  -- $0.09/GB data transfer
      (usage_record.custom_ec2_instances * 75.50) +  -- ~$75.50/instance/month
      (usage_record.custom_rds_instances * 180.25) +  -- ~$180.25/instance/month
      (usage_record.nat_gateway_bytes_processed / 1000000000.0 * 0.045);  -- $0.045/GB NAT
    
    usage_charges := jsonb_build_object(
      'cloudtrail_storage', ROUND((usage_record.log_storage_gb * 0.023)::numeric, 2),
      'archive_storage', ROUND((usage_record.archive_storage_gb * 0.004)::numeric, 2),
      'data_transfer', ROUND((usage_record.data_transfer_gb * 0.09)::numeric, 2),
      'ec2_instances', ROUND((usage_record.custom_ec2_instances * 75.50)::numeric, 2),
      'rds_instances', ROUND((usage_record.custom_rds_instances * 180.25)::numeric, 2),
      'nat_gateway', ROUND((usage_record.nat_gateway_bytes_processed / 1000000000.0 * 0.045)::numeric, 2),
      'guardduty', 15.00,
      'config', 35.00,
      'security_hub', 25.00
    );
    
    -- Add fixed monitoring costs
    usage_total := usage_total + 75.00;  -- GuardDuty + Config + Security Hub
    
    -- Generate invoice number
    invoice_num := 'INV-' || TO_CHAR(usage_record.month, 'YYYYMM') || '-' || 
                   LPAD(invoice_month::text, 4, '0');
    invoice_month := invoice_month + 1;
    
    -- Insert invoice
    INSERT INTO invoices (
      id, customer_id, invoice_number, month,
      tier_base_cost, usage_charges, usage_total,
      volume_discount, promotional_credit,
      subtotal, tax_rate, tax_amount, total_amount,
      status, issued_at, due_at, paid_at,
      payment_method,
      created_at, updated_at
    ) VALUES (
      uuid_generate_v5((SELECT uuid FROM namespace), 'invoice-' || usage_record.customer_id::text || usage_record.month::text),
      usage_record.customer_id,
      invoice_num,
      usage_record.month,
      base_cost,
      usage_charges,
      ROUND(usage_total::numeric, 2),
      0.00,  -- No volume discount for demo
      0.00,  -- No promotional credit
      ROUND((base_cost + usage_total)::numeric, 2),
      0.0825,  -- 8.25% tax rate
      ROUND(((base_cost + usage_total) * 0.0825)::numeric, 2),
      ROUND(((base_cost + usage_total) * 1.0825)::numeric, 2),
      CASE 
        WHEN usage_record.month < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') THEN 'paid'::invoice_status
        WHEN usage_record.month = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') THEN 'issued'::invoice_status
        ELSE 'draft'::invoice_status
      END,
      CASE 
        WHEN usage_record.month < DATE_TRUNC('month', CURRENT_DATE) 
        THEN usage_record.month + INTERVAL '5 days'
        ELSE NULL
      END,
      CASE 
        WHEN usage_record.month < DATE_TRUNC('month', CURRENT_DATE) 
        THEN usage_record.month + INTERVAL '30 days'
        ELSE NULL
      END,
      CASE 
        WHEN usage_record.month < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
        THEN usage_record.month + INTERVAL '28 days'
        ELSE NULL
      END,
      usage_record.payment_method::payment_method_type,
      usage_record.created_at,
      CURRENT_TIMESTAMP
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- SUPPORT TICKETS (realistic customer issues)
-- ============================================

INSERT INTO support_tickets (
  id, customer_id, ticket_number, subject, description,
  priority, status, category,
  created_by, assigned_to,
  created_at, updated_at, resolved_at
) VALUES
  -- ACME Healthcare tickets
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'ticket-acme-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    'TICKET-2024-001',
    'GuardDuty findings in Production account',
    'We are seeing several HIGH severity GuardDuty findings in our production PHI processing account. Need assistance reviewing these alerts and determining if they are false positives or require remediation.',
    'high',
    'resolved',
    'security',
    'security@acmehealthcare.example.com',
    'support-tier2@securebase.io',
    CURRENT_TIMESTAMP - INTERVAL '45 days',
    CURRENT_TIMESTAMP - INTERVAL '43 days',
    CURRENT_TIMESTAMP - INTERVAL '43 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'ticket-acme-002'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    'TICKET-2024-002',
    'Request to extend CloudTrail retention',
    'Per our compliance team, we need to extend CloudTrail log retention to 10 years for certain PHI-related accounts. Can this be configured at the OU level?',
    'normal',
    'resolved',
    'compliance',
    'compliance@acmehealthcare.example.com',
    'support-tier3@securebase.io',
    CURRENT_TIMESTAMP - INTERVAL '32 days',
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    CURRENT_TIMESTAMP - INTERVAL '30 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'ticket-acme-003'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    'TICKET-2025-003',
    'Add new OU for Research & Development',
    'We are launching a new R&D division that will need isolated AWS accounts. Request creation of "ACME-R&D" organizational unit with standard HIPAA controls.',
    'normal',
    'in_progress',
    'account_management',
    'admin@acmehealthcare.example.com',
    'support-tier2@securebase.io',
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    NULL
  ),
  
  -- TechFlow Financial tickets
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'ticket-techflow-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'TICKET-2024-004',
    'SOC 2 audit - need compliance reports',
    'Our external auditor is requesting AWS compliance reports for Q4 2024. Specifically need: Config compliance summary, GuardDuty findings report, and IAM Access Analyzer results.',
    'critical',
    'resolved',
    'compliance',
    'audit@techflowfin.example.com',
    'support-compliance@securebase.io',
    CURRENT_TIMESTAMP - INTERVAL '28 days',
    CURRENT_TIMESTAMP - INTERVAL '26 days',
    CURRENT_TIMESTAMP - INTERVAL '26 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'ticket-techflow-002'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'TICKET-2025-005',
    'Increase VPC limit for new microservices',
    'Planning to deploy 15 new microservices across 3 regions. Current VPC limit may be insufficient. Need capacity planning review.',
    'normal',
    'open',
    'capacity',
    'devops@techflowfin.example.com',
    'support-tier2@securebase.io',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    NULL
  ),
  
  -- Federal Energy tickets
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'ticket-federal-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'TICKET-2024-006',
    'FedRAMP continuous monitoring configuration',
    'Need to configure automated FedRAMP continuous monitoring scans. Require weekly Security Hub reports and monthly compliance summaries.',
    'high',
    'resolved',
    'compliance',
    'cloudadmin@energy.gov.example.com',
    'support-fedramp@securebase.io',
    CURRENT_TIMESTAMP - INTERVAL '68 days',
    CURRENT_TIMESTAMP - INTERVAL '65 days',
    CURRENT_TIMESTAMP - INTERVAL '65 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'ticket-federal-002'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'TICKET-2024-007',
    'Encryption key rotation policy',
    'Per agency requirements, all KMS keys must rotate every 90 days. Request implementation of automated rotation policy across all accounts.',
    'high',
    'resolved',
    'security',
    'security@energy.gov.example.com',
    'support-tier3@securebase.io',
    CURRENT_TIMESTAMP - INTERVAL '52 days',
    CURRENT_TIMESTAMP - INTERVAL '48 days',
    CURRENT_TIMESTAMP - INTERVAL '48 days'
  ),
  
  -- StartupCo tickets (trial customer)
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'ticket-startup-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-startupco'),
    'TICKET-2025-008',
    'Trial to Paid conversion - questions',
    'Our trial is ending soon. Have questions about pricing for Standard tier and what is included. Also interested in SOC 2 compliance timeline.',
    'normal',
    'open',
    'billing',
    'founder@startupco.example.com',
    'support-sales@securebase.io',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- AUDIT EVENTS (compliance trail)
-- ============================================

INSERT INTO audit_events (
  id, customer_id, event_type, action,
  resource_type, resource_id,
  actor_email, actor_ip_address, actor_user_agent,
  status, error_message,
  request_id, metadata,
  created_at
) VALUES
  -- ACME Healthcare audit trail
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'audit-acme-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    'account_management',
    'create_account',
    'aws_account',
    '123456789999',
    'admin@acmehealthcare.example.com',
    '203.0.113.45',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'success',
    NULL,
    'req-acme-001',
    '{"account_name": "ACME-PHI-Production", "ou": "Healthcare-Production", "email": "aws-phi-prod@acmehealthcare.example.com"}',
    CURRENT_TIMESTAMP - INTERVAL '120 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'audit-acme-002'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    'security',
    'enable_guardduty',
    'guardduty_detector',
    'detector-001',
    'security@acmehealthcare.example.com',
    '203.0.113.45',
    'AWS-CLI/2.11.0',
    'success',
    NULL,
    'req-acme-002',
    '{"region": "us-east-1", "finding_publishing_frequency": "FIFTEEN_MINUTES"}',
    CURRENT_TIMESTAMP - INTERVAL '115 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'audit-acme-003'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    'compliance',
    'run_compliance_scan',
    'config_rule',
    'all',
    'system',
    '10.0.0.1',
    'SecureBase-Automation/1.0',
    'success',
    NULL,
    'req-acme-003',
    '{"scan_type": "hipaa", "rules_evaluated": 142, "compliant": 140, "non_compliant": 2}',
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  ),
  
  -- TechFlow Financial audit trail
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'audit-techflow-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'iam',
    'create_role',
    'iam_role',
    'TechFlow-DataAnalytics-Role',
    'devops@techflowfin.example.com',
    '198.51.100.23',
    'AWS-Console/1.0',
    'success',
    NULL,
    'req-techflow-001',
    '{"role_name": "TechFlow-DataAnalytics-Role", "assume_role_policy": "service:lambda.amazonaws.com", "permissions": ["s3:GetObject", "athena:*"]}',
    CURRENT_TIMESTAMP - INTERVAL '60 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'audit-techflow-002'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'data',
    'export_compliance_report',
    'report',
    'SOC2-Q4-2024',
    'audit@techflowfin.example.com',
    '198.51.100.23',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'success',
    NULL,
    'req-techflow-002',
    '{"report_type": "soc2_compliance", "period": "Q4-2024", "format": "pdf", "controls_assessed": 89}',
    CURRENT_TIMESTAMP - INTERVAL '28 days'
  ),
  
  -- Federal Energy audit trail
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'audit-federal-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'security',
    'rotate_kms_key',
    'kms_key',
    'key-federal-master-001',
    'system',
    '10.0.0.1',
    'SecureBase-Automation/1.0',
    'success',
    NULL,
    'req-federal-001',
    '{"key_id": "key-federal-master-001", "rotation_policy": "90_days", "algorithm": "SYMMETRIC_DEFAULT"}',
    CURRENT_TIMESTAMP - INTERVAL '48 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'audit-federal-002'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'compliance',
    'fedramp_assessment',
    'compliance_framework',
    'fedramp-moderate',
    'cloudadmin@energy.gov.example.com',
    '192.0.2.89',
    'AWS-CLI/2.11.0',
    'success',
    NULL,
    'req-federal-002',
    '{"assessment_type": "fedramp_moderate", "controls_total": 325, "controls_met": 324, "findings": 1}',
    CURRENT_TIMESTAMP - INTERVAL '15 days'
  ),
  
  -- StartupCo audit trail (recent activity)
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'audit-startup-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-startupco'),
    'account_management',
    'create_account',
    'aws_account',
    '456789012999',
    'founder@startupco.example.com',
    '203.0.113.78',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'success',
    NULL,
    'req-startup-001',
    '{"account_name": "StartupCo-Production", "ou": "Standard-Tier", "email": "aws-prod@startupco.example.com"}',
    CURRENT_TIMESTAMP - INTERVAL '6 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'audit-startup-002'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-startupco'),
    'api',
    'generate_api_key',
    'api_key',
    uuid_generate_v5((SELECT uuid FROM namespace), 'apikey-startup-trial')::text,
    'founder@startupco.example.com',
    '203.0.113.78',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'success',
    NULL,
    'req-startup-002',
    '{"key_name": "Trial Access Key", "permissions": ["read:metrics", "read:invoices"], "expires_at": "2025-02-23"}',
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- NOTIFICATIONS (system activity)
-- ============================================

INSERT INTO notifications (
  id, customer_id, notification_type, channel,
  subject, message,
  recipient_email, recipient_phone,
  sent_at, delivered_at, read_at,
  metadata,
  created_at
) VALUES
  -- ACME Healthcare notifications
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'notif-acme-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    'invoice_issued',
    'email',
    'Your December 2024 Invoice is Ready',
    'Your SecureBase invoice for December 2024 is now available. Total: $16,847.23. Payment is due by January 30, 2025.',
    'billing@acmehealthcare.example.com',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '35 days',
    CURRENT_TIMESTAMP - INTERVAL '35 days',
    CURRENT_TIMESTAMP - INTERVAL '34 days',
    '{"invoice_id": "INV-202412-0001", "amount": 16847.23, "due_date": "2025-01-30"}',
    CURRENT_TIMESTAMP - INTERVAL '35 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'notif-acme-002'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    'compliance_alert',
    'email',
    'Compliance Alert: 2 Non-Compliant Resources Detected',
    'Your latest HIPAA compliance scan detected 2 resources that require attention. Please review the compliance dashboard for details.',
    'compliance@acmehealthcare.example.com',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    '{"scan_id": "scan-20250124", "non_compliant_count": 2, "severity": "medium"}',
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  ),
  
  -- TechFlow Financial notifications
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'notif-techflow-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'system_update',
    'email',
    'SecureBase Platform Update - Enhanced Monitoring',
    'We have deployed enhanced monitoring capabilities for your SOC 2 compliance. New dashboards are now available in your portal.',
    'admin@techflowfin.example.com',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '14 days',
    CURRENT_TIMESTAMP - INTERVAL '14 days',
    CURRENT_TIMESTAMP - INTERVAL '13 days',
    '{"update_type": "feature_release", "features": ["enhanced_monitoring", "soc2_dashboards"]}',
    CURRENT_TIMESTAMP - INTERVAL '14 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'notif-techflow-002'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'support_response',
    'email',
    'Support Ticket #TICKET-2025-005 Updated',
    'Your support ticket regarding VPC capacity has been updated. Our team has reviewed your requirements and prepared recommendations.',
    'devops@techflowfin.example.com',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    NULL,  -- Not yet read
    '{"ticket_id": "TICKET-2025-005", "status": "in_progress"}',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
  ),
  
  -- Federal Energy notifications
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'notif-federal-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'compliance_alert',
    'email',
    'FedRAMP Continuous Monitoring Report Available',
    'Your monthly FedRAMP continuous monitoring report for January 2025 is now available. All controls passed assessment.',
    'cloudadmin@energy.gov.example.com',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    '{"report_period": "2025-01", "controls_assessed": 325, "controls_passed": 324, "findings": 1}',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
  ),
  
  -- StartupCo notifications
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'notif-startup-001'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-startupco'),
    'system_update',
    'email',
    'Welcome to SecureBase!',
    'Thank you for starting your trial! Your infrastructure is ready. Access your dashboard at portal.securebase.io with your API key.',
    'founder@startupco.example.com',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    '{"trial_days_remaining": 30, "tier": "standard"}',
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'notif-startup-002'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-startupco'),
    'system_update',
    'email',
    'Your Trial Ends in 23 Days',
    'Your SecureBase trial will end on February 23, 2025. To continue service, please upgrade to a paid plan. Contact sales for questions.',
    'founder@startupco.example.com',
    '+1-555-0404',
    CURRENT_TIMESTAMP - INTERVAL '12 hours',
    CURRENT_TIMESTAMP - INTERVAL '12 hours',
    NULL,  -- Not yet read
    '{"trial_days_remaining": 23, "upgrade_url": "https://portal.securebase.io/upgrade"}',
    CURRENT_TIMESTAMP - INTERVAL '12 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EVIDENCE RECORDS (Compliance Evidence Tracking)
-- ============================================

-- SOC2 Evidence for TechFlow Financial
INSERT INTO evidence_records (
  id, customer_id, control_id, control_name, framework, category,
  evidence_type, source_system, owner, collection_method,
  status, last_collected, valid_until, next_collection,
  artifact_ref, artifact_hash, artifact_size_bytes,
  description, collected_by, reviewed_by, reviewed_at,
  metadata, created_at, updated_at
) VALUES
  -- Common Criteria (CC) Controls
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-techflow-cc1.1'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'CC1.1',
    'Control Environment - Board of Directors',
    'soc2',
    'CC',
    'policy',
    'Google Drive',
    'compliance@techflowfin.example.com',
    'manual',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '15 days',
    CURRENT_TIMESTAMP + INTERVAL '350 days',
    CURRENT_TIMESTAMP + INTERVAL '80 days',
    's3://securebase-evidence/techflow/soc2/CC1.1-board-charter-2024.pdf',
    'a3f5c8b2d9e1f4a7c6b8d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    245678,
    'Board of Directors charter and governance documentation demonstrating oversight of control environment',
    'compliance@techflowfin.example.com',
    'audit@techflowfin.example.com',
    CURRENT_TIMESTAMP - INTERVAL '12 days',
    '{"review_period": "annual", "document_version": "2024.1", "next_review": "2025-12-31", "policy_docs": [{"name": "Board Charter", "version": "v2.1", "approved_date": "2024-01-15", "approved_by": "Board of Directors"}, {"name": "Governance Policy", "version": "v1.3", "approved_date": "2024-01-15"}], "board_members": 7, "independent_directors": 4, "audit_committee_established": true, "last_board_meeting": "2025-01-15", "meeting_frequency": "quarterly", "documented_oversight": true}',
    CURRENT_TIMESTAMP - INTERVAL '15 days',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-techflow-cc2.1'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'CC2.1',
    'Communication and Information - Internal Communication',
    'soc2',
    'CC',
    'system',
    'Slack',
    'it@techflowfin.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP + INTERVAL '89 days',
    CURRENT_TIMESTAMP + INTERVAL '29 days',
    's3://securebase-evidence/techflow/soc2/CC2.1-slack-audit-log-2025-01.json',
    'b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5',
    1534890,
    'Slack audit logs demonstrating internal communication channels and security policies enforcement',
    'system',
    'it@techflowfin.example.com',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    '{"export_date": "2025-01-30", "total_messages": 45678, "users": 52, "channels": 23}',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-techflow-cc3.1'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'CC3.1',
    'Risk Assessment - Fraud Risk Consideration',
    'soc2',
    'CC',
    'report',
    'Internal Audit',
    'audit@techflowfin.example.com',
    'manual',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '45 days',
    CURRENT_TIMESTAMP + INTERVAL '320 days',
    CURRENT_TIMESTAMP + INTERVAL '135 days',
    's3://securebase-evidence/techflow/soc2/CC3.1-fraud-risk-assessment-Q4-2024.pdf',
    'c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    892345,
    'Quarterly fraud risk assessment conducted by internal audit team',
    'audit@techflowfin.example.com',
    'cfo@techflowfin.example.com',
    CURRENT_TIMESTAMP - INTERVAL '42 days',
    '{"assessment_period": "Q4-2024", "identified_risks": 3, "mitigated_risks": 3, "residual_risk": "low"}',
    CURRENT_TIMESTAMP - INTERVAL '45 days',
    CURRENT_TIMESTAMP
  ),
  
  -- Access Controls (AC)
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-techflow-ac1.1'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'AC1.1',
    'Logical Access - User Access Provisioning',
    'soc2',
    'AC',
    'system',
    'Okta',
    'it@techflowfin.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    CURRENT_TIMESTAMP + INTERVAL '7 days',
    's3://securebase-evidence/techflow/soc2/AC1.1-okta-user-audit-2025-01-31.csv',
    'd6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7',
    234567,
    'Okta user provisioning audit showing all user accounts, roles, and last access times',
    'system',
    'it@techflowfin.example.com',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    '{"okta_users": 52, "active_users": 48, "inactive_users": 4, "mfa_enabled": 52, "passwordless": 35, "last_access_review": "2025-01-30", "sso_enabled": true, "session_timeout_minutes": 30, "password_policy": {"min_length": 14, "complexity": "high", "rotation_days": 90}, "access_policies": [{"name": "MFA Required", "enforced": true}, {"name": "IP Whitelist", "enforced": true}], "integrations": ["AWS", "GitHub", "Stripe", "Salesforce"], "groups": 12, "roles": 8}',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-techflow-ac2.1'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'AC2.1',
    'Logical Access - Privileged Access Management',
    'soc2',
    'AC',
    'log',
    'AWS CloudTrail',
    'security@techflowfin.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    CURRENT_TIMESTAMP + INTERVAL '90 days',
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    's3://securebase-evidence/techflow/soc2/AC2.1-cloudtrail-admin-access-2025-01.json.gz',
    'e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8',
    5678901,
    'AWS CloudTrail logs showing all privileged admin access to production environments',
    'system',
    'security@techflowfin.example.com',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    '{"total_events": 1523, "unique_users": 8, "failed_attempts": 0, "regions": ["us-east-1", "us-west-2"], "aws_accounts_connected": true, "privileged_actions": {"AssumeRole": 456, "CreateUser": 0, "DeleteUser": 0, "ModifySecurityGroup": 23, "CreateAccessKey": 2}, "admin_users": ["admin@techflowfin.example.com", "devops@techflowfin.example.com"], "mfa_verified": true, "cloudtrail_enabled": true, "log_retention_days": 2555, "s3_bucket_encrypted": true}',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    CURRENT_TIMESTAMP
  ),
  
  -- Audit and Accountability (AU)
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-techflow-au1.1'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-techflow-financial'),
    'AU1.1',
    'Monitoring - Security Event Logging',
    'soc2',
    'AU',
    'configuration',
    'AWS Config',
    'devops@techflowfin.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '6 hours',
    CURRENT_TIMESTAMP + INTERVAL '180 days',
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    's3://securebase-evidence/techflow/soc2/AU1.1-aws-config-rules-2025-01-31.json',
    'f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9',
    345678,
    'AWS Config rules showing enabled logging across all accounts and services',
    'system',
    'devops@techflowfin.example.com',
    CURRENT_TIMESTAMP - INTERVAL '5 hours',
    '{"total_rules": 89, "compliant_rules": 87, "non_compliant_rules": 2, "accounts": 8, "aws_accounts_connected": true, "cloudtrail_enabled": true, "config_recorders_active": 8, "config_delivery_channels": 8, "s3_bucket_logging": true, "cloudwatch_logs_enabled": true, "sns_notifications": true, "remediation_actions": {"automated": 45, "manual": 2}, "evaluation_frequency": "CONTINUOUS", "last_evaluation": "2025-01-31T10:00:00Z"}',
    CURRENT_TIMESTAMP - INTERVAL '6 hours',
    CURRENT_TIMESTAMP
  ),

-- HIPAA Evidence for ACME Healthcare
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-acme-164.308a1i'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    '164.308(a)(1)(i)',
    'Security Management Process',
    'hipaa',
    'AU',
    'policy',
    'Google Drive',
    'compliance@acmehealthcare.example.com',
    'manual',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    CURRENT_TIMESTAMP + INTERVAL '335 days',
    CURRENT_TIMESTAMP + INTERVAL '150 days',
    's3://securebase-evidence/acme/hipaa/164.308a1i-security-mgmt-policy-2024.pdf',
    'a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    567890,
    'HIPAA Security Management Process policy documenting risk analysis, risk management, and sanction policy',
    'compliance@acmehealthcare.example.com',
    'ciso@acmehealthcare.example.com',
    CURRENT_TIMESTAMP - INTERVAL '28 days',
    '{"policy_version": "3.2", "effective_date": "2024-01-01", "next_review": "2025-06-30", "approved_by": "CISO"}',
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-acme-164.308a3i'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    '164.308(a)(3)(i)',
    'Workforce Security - Authorization/Supervision',
    'hipaa',
    'AC',
    'system',
    'Okta',
    'hr@acmehealthcare.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP + INTERVAL '29 days',
    CURRENT_TIMESTAMP + INTERVAL '6 days',
    's3://securebase-evidence/acme/hipaa/164.308a3i-workforce-access-2025-01-30.csv',
    'b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    456789,
    'Workforce access control matrix showing role-based access to PHI systems',
    'system',
    'hr@acmehealthcare.example.com',
    CURRENT_TIMESTAMP - INTERVAL '12 hours',
    '{"total_employees": 245, "phi_access": 89, "admin_access": 12, "terminated_count": 3, "okta_users": 245, "active_users": 242, "last_access_review": "2025-01-30", "role_based_access": true, "phi_roles": ["Physician", "Nurse", "Lab Technician", "Billing Specialist"], "access_policies": [{"name": "PHI Access Policy", "version": "v2.3", "enforced": true}, {"name": "Minimum Necessary Rule", "version": "v1.8", "enforced": true}], "background_checks_completed": 245, "hipaa_training_completed": 242, "training_completion_rate": 98.8, "aws_accounts_connected": true}',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-acme-164.312a1'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    '164.312(a)(1)',
    'Access Control - Unique User Identification',
    'hipaa',
    'IA',
    'system',
    'AWS IAM',
    'it@acmehealthcare.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP + INTERVAL '90 days',
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    's3://securebase-evidence/acme/hipaa/164.312a1-iam-users-2025-01-31.json',
    'c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
    234567,
    'AWS IAM user audit showing unique identifiers for all users accessing PHI systems',
    'system',
    'it@acmehealthcare.example.com',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    '{"total_users": 89, "mfa_enabled": 89, "shared_accounts": 0, "service_accounts": 15, "aws_accounts_connected": true, "unique_identifiers": true, "iam_users": 89, "sso_enabled": true, "password_policy": {"min_length": 16, "complexity": "maximum", "rotation_days": 60, "prevent_reuse": 24}, "access_keys_rotated": true, "last_key_rotation": "2025-01-15", "inactive_credentials_removed": true, "phi_account_ids": ["123456789012", "234567890123", "345678901234"]}',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-acme-164.312b'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    '164.312(b)',
    'Audit Controls',
    'hipaa',
    'AU',
    'log',
    'AWS CloudTrail',
    'security@acmehealthcare.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '5 hours',
    CURRENT_TIMESTAMP + INTERVAL '2555 days',  -- 7 years retention
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    's3://securebase-evidence/acme/hipaa/164.312b-audit-logs-2025-01.tar.gz',
    'd2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3',
    12345678,
    'Comprehensive audit logs from CloudTrail showing all access to PHI systems (7-year retention)',
    'system',
    'security@acmehealthcare.example.com',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    '{"total_events": 3245678, "phi_access_events": 245678, "log_retention_days": 2555, "encrypted": true}',
    CURRENT_TIMESTAMP - INTERVAL '5 hours',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-acme-164.312e1'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-acme-healthcare'),
    '164.312(e)(1)',
    'Transmission Security - Encryption',
    'hipaa',
    'SC',
    'configuration',
    'AWS Certificate Manager',
    'devops@acmehealthcare.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '12 hours',
    CURRENT_TIMESTAMP + INTERVAL '365 days',
    CURRENT_TIMESTAMP + INTERVAL '60 days',
    's3://securebase-evidence/acme/hipaa/164.312e1-tls-certificates-2025-01-31.json',
    'e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4',
    123456,
    'TLS certificate configuration showing encryption in transit for all PHI transmissions',
    'system',
    'devops@acmehealthcare.example.com',
    CURRENT_TIMESTAMP - INTERVAL '11 hours',
    '{"total_certificates": 23, "expired": 0, "expiring_soon": 2, "tls_version": "1.2+", "cipher_strength": "AES-256"}',
    CURRENT_TIMESTAMP - INTERVAL '12 hours',
    CURRENT_TIMESTAMP
  ),

-- FedRAMP Evidence for Federal Energy Commission
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-federal-ac-2'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'AC-2',
    'Account Management',
    'fedramp',
    'AC',
    'system',
    'AWS IAM Identity Center',
    'cloudadmin@energy.gov.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP + INTERVAL '90 days',
    CURRENT_TIMESTAMP + INTERVAL '14 days',
    's3://securebase-evidence/federal/fedramp/AC-2-account-management-2025-01-30.json',
    'f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
    678901,
    'AWS IAM Identity Center user inventory and account lifecycle management',
    'system',
    'cloudadmin@energy.gov.example.com',
    CURRENT_TIMESTAMP - INTERVAL '18 hours',
    '{"total_users": 127, "active_users": 125, "disabled_users": 2, "privileged_users": 15, "review_frequency": "weekly", "aws_accounts_connected": true, "sso_enabled": true, "piv_required": true, "last_access_review": "2025-01-29", "account_lifecycle": {"provisioning": "automated", "deprovisioning": "automated", "approval_required": true}, "access_certifications": {"last_completed": "2025-01-15", "frequency": "quarterly", "completion_rate": 100}, "security_groups": 23, "permission_sets": 45, "policy_enforcement": "strict"}',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-federal-au-2'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'AU-2',
    'Audit Events',
    'fedramp',
    'AU',
    'configuration',
    'AWS CloudWatch',
    'security@energy.gov.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '8 hours',
    CURRENT_TIMESTAMP + INTERVAL '365 days',
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    's3://securebase-evidence/federal/fedramp/AU-2-audit-events-config-2025-01-31.json',
    'a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6',
    345678,
    'CloudWatch configuration showing comprehensive audit event logging across all systems',
    'system',
    'security@energy.gov.example.com',
    CURRENT_TIMESTAMP - INTERVAL '6 hours',
    '{"log_groups": 45, "metric_filters": 78, "alarms": 23, "retention_days": 3650, "encryption": "AES-256"}',
    CURRENT_TIMESTAMP - INTERVAL '8 hours',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-federal-cm-2'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'CM-2',
    'Baseline Configuration',
    'fedramp',
    'CM',
    'configuration',
    'AWS Config',
    'devops@energy.gov.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    CURRENT_TIMESTAMP + INTERVAL '180 days',
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    's3://securebase-evidence/federal/fedramp/CM-2-baseline-config-2025-01-31.json',
    'b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7',
    890123,
    'AWS Config baseline showing approved configurations for all infrastructure components',
    'system',
    'devops@energy.gov.example.com',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    '{"config_items": 2345, "compliant": 2340, "non_compliant": 5, "accounts": 25, "regions": 3}',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-federal-ia-2'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'IA-2',
    'Identification and Authentication',
    'fedramp',
    'IA',
    'attestation',
    'PIV/CAC System',
    'security@energy.gov.example.com',
    'manual',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP + INTERVAL '83 days',
    CURRENT_TIMESTAMP + INTERVAL '23 days',
    's3://securebase-evidence/federal/fedramp/IA-2-piv-attestation-2025-01-24.pdf',
    'c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
    234567,
    'PIV/CAC smart card authentication attestation for all federal personnel',
    'security@energy.gov.example.com',
    'isso@energy.gov.example.com',
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    '{"piv_users": 127, "cac_users": 127, "two_factor_required": true, "biometric_enabled": false}',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-federal-sc-7'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-federal-energy'),
    'SC-7',
    'Boundary Protection',
    'fedramp',
    'SC',
    'screenshot',
    'AWS Network Firewall',
    'network@energy.gov.example.com',
    'manual',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '14 days',
    CURRENT_TIMESTAMP + INTERVAL '76 days',
    CURRENT_TIMESTAMP + INTERVAL '16 days',
    's3://securebase-evidence/federal/fedramp/SC-7-network-firewall-rules-2025-01-17.png',
    'd8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9',
    1234567,
    'Network firewall rules screenshot showing boundary protection configurations',
    'network@energy.gov.example.com',
    'security@energy.gov.example.com',
    CURRENT_TIMESTAMP - INTERVAL '12 days',
    '{"firewall_rules": 156, "vpcs": 50, "deny_by_default": true, "logging_enabled": true}',
    CURRENT_TIMESTAMP - INTERVAL '14 days',
    CURRENT_TIMESTAMP
  ),

-- CIS Evidence for StartupCo (Trial)
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-startup-cis1.1'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-startupco'),
    'CIS-1.1',
    'Maintain Inventory of Authorized Devices',
    'cis',
    'CM',
    'system',
    'AWS Systems Manager',
    'founder@startupco.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '6 hours',
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    CURRENT_TIMESTAMP + INTERVAL '7 days',
    's3://securebase-evidence/startupco/cis/CIS-1.1-device-inventory-2025-01-31.json',
    'e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
    45678,
    'AWS Systems Manager inventory of all EC2 instances and managed devices',
    'system',
    'founder@startupco.example.com',
    CURRENT_TIMESTAMP - INTERVAL '5 hours',
    '{"total_instances": 3, "managed_instances": 3, "patched": 3, "compliant": 3}',
    CURRENT_TIMESTAMP - INTERVAL '6 hours',
    CURRENT_TIMESTAMP
  ),
  (
    uuid_generate_v5((SELECT uuid FROM namespace), 'evidence-startup-cis2.1'),
    uuid_generate_v5((SELECT uuid FROM namespace), 'customer-startupco'),
    'CIS-2.1',
    'Maintain Inventory of Authorized Software',
    'cis',
    'CM',
    'log',
    'AWS Systems Manager',
    'founder@startupco.example.com',
    'automated',
    'pass',
    CURRENT_TIMESTAMP - INTERVAL '6 hours',
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    CURRENT_TIMESTAMP + INTERVAL '7 days',
    's3://securebase-evidence/startupco/cis/CIS-2.1-software-inventory-2025-01-31.json',
    'f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    56789,
    'Software inventory showing all installed packages and applications',
    'system',
    'founder@startupco.example.com',
    CURRENT_TIMESTAMP - INTERVAL '5 hours',
    '{"total_packages": 156, "outdated_packages": 2, "security_updates": 0}',
    CURRENT_TIMESTAMP - INTERVAL '6 hours',
    CURRENT_TIMESTAMP
  )
ON CONFLICT (customer_id, control_id, framework) DO NOTHING;

-- ============================================
-- SUMMARY STATISTICS
-- ============================================

DO $$
DECLARE
  customer_count INTEGER;
  total_invoices INTEGER;
  total_revenue DECIMAL(12,2);
  ticket_count INTEGER;
  audit_count INTEGER;
  evidence_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO customer_count FROM customers 
    WHERE name IN ('ACME Healthcare Systems', 'TechFlow Financial', 'Federal Energy Commission', 'StartupCo');
  
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0) INTO total_invoices, total_revenue 
    FROM invoices 
    WHERE status IN ('paid', 'issued');
  
  SELECT COUNT(*) INTO ticket_count FROM support_tickets;
  SELECT COUNT(*) INTO audit_count FROM audit_events;
  SELECT COUNT(*) INTO evidence_count FROM evidence_records;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'SECUREBASE DEMO DATA - SEEDING COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary Statistics:';
  RAISE NOTICE '  ✓ Customers Created:      %', customer_count;
  RAISE NOTICE '  ✓ Invoices Generated:     %', total_invoices;
  RAISE NOTICE '  ✓ Total Revenue:          $%', total_revenue;
  RAISE NOTICE '  ✓ Support Tickets:        %', ticket_count;
  RAISE NOTICE '  ✓ Audit Events:           %', audit_count;
  RAISE NOTICE '  ✓ Evidence Records:       %', evidence_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Demo Credentials (API Keys):';
  RAISE NOTICE '  • ACME Healthcare:        sk_prod_acme_*** (admin@acmehealthcare.example.com)';
  RAISE NOTICE '  • TechFlow Financial:     sk_prod_tech_*** (admin@techflowfin.example.com)';
  RAISE NOTICE '  • Federal Energy:         sk_gov_fed_*** (cloudadmin@energy.gov.example.com)';
  RAISE NOTICE '  • StartupCo (Trial):      sk_test_start_*** (founder@startupco.example.com)';
  RAISE NOTICE '';
  RAISE NOTICE 'Tiers Represented:';
  RAISE NOTICE '  ✓ Healthcare (HIPAA)      - ACME Healthcare Systems';
  RAISE NOTICE '  ✓ Fintech (SOC2)          - TechFlow Financial';
  RAISE NOTICE '  ✓ Government (FedRAMP)    - Federal Energy Commission';
  RAISE NOTICE '  ✓ Standard (CIS)          - StartupCo (Trial)';
  RAISE NOTICE '';
  RAISE NOTICE 'Compliance Evidence:';
  RAISE NOTICE '  ✓ SOC2 Controls           - 7 evidence records';
  RAISE NOTICE '  ✓ HIPAA Controls          - 5 evidence records';
  RAISE NOTICE '  ✓ FedRAMP Controls        - 5 evidence records';
  RAISE NOTICE '  ✓ CIS Controls            - 2 evidence records';
  RAISE NOTICE '';
  RAISE NOTICE 'Data Characteristics:';
  RAISE NOTICE '  ✓ Deterministic UUIDs (uuid_generate_v5)';
  RAISE NOTICE '  ✓ 6 months historical data';
  RAISE NOTICE '  ✓ Realistic usage patterns';
  RAISE NOTICE '  ✓ Compliance-focused scenarios';
  RAISE NOTICE '  ✓ Authoritative evidence artifacts';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
