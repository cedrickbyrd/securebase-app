-- ============================================================
-- Migration: 005_texas_fintech_compliance.sql
-- SecureBase – Texas Money Transmitter / Fintech Compliance
-- ============================================================
-- Adds tables required for Texas DOB examiner evidence collection:
--   tx_transaction_records   – 7 TAC §33.35 transaction recordkeeping
--   tx_ctr_filings           – 31 CFR §103.22 Currency Transaction Reports
--   tx_sar_filings           – 31 CFR §103.18 Suspicious Activity Reports
--   tx_cip_records           – Customer Identification Program records
--   tx_digital_asset_wallets – HB 1666 digital asset segregation
--   tx_aml_alerts            – AML system alert log
--   tx_examiner_exports      – Audit trail of examiner data packages
--   tx_compliance_controls   – Control status per customer
--   tx_evidence_signatures   – KMS-signed evidence manifests
-- All tables carry RLS policies keyed on customer_id.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum types (idempotent) ────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tx_transaction_type AS ENUM (
    'wire_transfer', 'ach', 'check', 'cash', 'crypto',
    'money_order', 'prepaid_card', 'remittance', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tx_filing_status AS ENUM (
    'pending', 'filed', 'amended', 'rejected', 'exempt'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tx_alert_status AS ENUM (
    'open', 'under_review', 'escalated', 'closed_sar', 'closed_no_action'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tx_control_status AS ENUM (
    'compliant', 'non_compliant', 'partial', 'not_applicable', 'pending_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ══════════════════════════════════════════════════════════
-- TABLE: tx_transaction_records
-- Control: TX-MT-R1 — Transaction Recordkeeping
-- Regulation: 7 TAC §33.35; Fin. Code §151.307
-- Retention: 5 years minimum
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tx_transaction_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  external_txn_id       TEXT NOT NULL,                  -- source system transaction ID
  transaction_date      TIMESTAMP WITH TIME ZONE NOT NULL,
  transaction_type      tx_transaction_type NOT NULL,
  amount                NUMERIC(18, 2) NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'USD',
  sender_name           TEXT,
  sender_account        TEXT,
  sender_address        TEXT,
  sender_id_type        TEXT,                           -- e.g. 'driver_license', 'passport'
  sender_id_number      TEXT,
  recipient_name        TEXT,
  recipient_account     TEXT,
  recipient_address     TEXT,
  recipient_country     CHAR(2),                        -- ISO 3166-1 alpha-2
  originating_ip        INET,
  channel               TEXT,                           -- 'mobile', 'web', 'branch', 'api'
  status                TEXT NOT NULL DEFAULT 'completed',
  notes                 TEXT,
  -- Evidence metadata
  evidence_collected_at TIMESTAMP WITH TIME ZONE,
  evidence_hash         TEXT,                           -- SHA-256 of record JSON
  collected_by_lambda   TEXT,
  -- Timestamps
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_txn_customer_date
  ON tx_transaction_records(customer_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_txn_amount
  ON tx_transaction_records(customer_id, amount)
  WHERE amount >= 3000;  -- CTR threshold pre-filter
CREATE INDEX IF NOT EXISTS idx_tx_txn_external_id
  ON tx_transaction_records(customer_id, external_txn_id);

COMMENT ON TABLE tx_transaction_records IS
  'TX-MT-R1: Transaction records per 7 TAC §33.35. Retention ≥5 years.';

-- ══════════════════════════════════════════════════════════
-- TABLE: tx_ctr_filings
-- Control: TX-MT-R2a — Currency Transaction Reports
-- Regulation: 31 CFR §1022.310 (≥$10,000 cash transactions)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tx_ctr_filings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  filing_reference      TEXT NOT NULL,                  -- FinCEN BSA ID
  transaction_date      TIMESTAMP WITH TIME ZONE NOT NULL,
  amount                NUMERIC(18, 2) NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'USD',
  subject_name          TEXT NOT NULL,
  subject_tin           TEXT,                           -- encrypted at app layer
  subject_dob           DATE,
  subject_address       TEXT,
  subject_id_type       TEXT,
  subject_id_number     TEXT,
  filing_status         tx_filing_status NOT NULL DEFAULT 'pending',
  filing_date           TIMESTAMP WITH TIME ZONE,
  fincen_tracking_id    TEXT,
  narrative             TEXT,
  related_transaction_ids UUID[],                       -- references tx_transaction_records.id
  -- Evidence metadata
  evidence_collected_at TIMESTAMP WITH TIME ZONE,
  evidence_hash         TEXT,
  s3_evidence_key       TEXT,                           -- S3 path to signed evidence package
  collected_by_lambda   TEXT,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_ctr_customer_date
  ON tx_ctr_filings(customer_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_ctr_filing_status
  ON tx_ctr_filings(customer_id, filing_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_ctr_reference
  ON tx_ctr_filings(customer_id, filing_reference);

COMMENT ON TABLE tx_ctr_filings IS
  'TX-MT-R2a: CTR filings per 31 CFR §1022.310.';

-- ══════════════════════════════════════════════════════════
-- TABLE: tx_sar_filings
-- Control: TX-MT-R2b — Suspicious Activity Reports
-- Regulation: 31 CFR §1022.320
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tx_sar_filings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  filing_reference      TEXT NOT NULL,
  activity_date_start   TIMESTAMP WITH TIME ZONE NOT NULL,
  activity_date_end     TIMESTAMP WITH TIME ZONE NOT NULL,
  amount                NUMERIC(18, 2),
  currency              CHAR(3) NOT NULL DEFAULT 'USD',
  subject_name          TEXT,
  subject_tin           TEXT,
  subject_address       TEXT,
  activity_type         TEXT NOT NULL,                  -- 'structuring','fraud','terrorist_financing',etc.
  narrative             TEXT NOT NULL,
  filing_status         tx_filing_status NOT NULL DEFAULT 'pending',
  filing_date           TIMESTAMP WITH TIME ZONE,
  fincen_tracking_id    TEXT,
  aml_alert_ids         UUID[],                         -- references tx_aml_alerts.id
  related_transaction_ids UUID[],
  -- Evidence metadata
  evidence_collected_at TIMESTAMP WITH TIME ZONE,
  evidence_hash         TEXT,
  s3_evidence_key       TEXT,
  collected_by_lambda   TEXT,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_sar_customer_date
  ON tx_sar_filings(customer_id, activity_date_start DESC);
CREATE INDEX IF NOT EXISTS idx_tx_sar_filing_status
  ON tx_sar_filings(customer_id, filing_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_sar_reference
  ON tx_sar_filings(customer_id, filing_reference);

COMMENT ON TABLE tx_sar_filings IS
  'TX-MT-R2b: SAR filings per 31 CFR §1022.320.';

-- ══════════════════════════════════════════════════════════
-- TABLE: tx_cip_records
-- Control: TX-MT-R3 — Customer Identification Program
-- Regulation: 31 CFR §1022.210; 7 TAC §33.3
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tx_cip_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  end_customer_ref      TEXT NOT NULL,                  -- opaque ref to the MT's customer
  identity_verified_at  TIMESTAMP WITH TIME ZONE,
  verification_method   TEXT NOT NULL,                  -- 'documentary','non_documentary','both'
  id_type               TEXT,                           -- 'driver_license','passport','tin',etc.
  id_issuing_country    CHAR(2),
  id_expiry_date        DATE,
  risk_rating           TEXT NOT NULL DEFAULT 'standard', -- 'low','standard','high','pep'
  enhanced_due_diligence BOOLEAN NOT NULL DEFAULT FALSE,
  edd_completed_at      TIMESTAMP WITH TIME ZONE,
  ongoing_monitoring    BOOLEAN NOT NULL DEFAULT TRUE,
  last_reviewed_at      TIMESTAMP WITH TIME ZONE,
  -- Evidence metadata
  evidence_collected_at TIMESTAMP WITH TIME ZONE,
  evidence_hash         TEXT,
  s3_evidence_key       TEXT,
  collected_by_lambda   TEXT,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_cip_customer
  ON tx_cip_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_tx_cip_end_customer
  ON tx_cip_records(customer_id, end_customer_ref);
CREATE INDEX IF NOT EXISTS idx_tx_cip_risk
  ON tx_cip_records(customer_id, risk_rating);

COMMENT ON TABLE tx_cip_records IS
  'TX-MT-R3: CIP records per 31 CFR §1022.210.';

-- ══════════════════════════════════════════════════════════
-- TABLE: tx_digital_asset_wallets
-- Control: TX-MT-R4 / TX-DASP-R1 — Digital Asset Segregation
-- Regulation: TX HB 1666; TX Fin. Code Ch. 152 (DASP)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tx_digital_asset_wallets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  wallet_address        TEXT NOT NULL,
  asset_type            TEXT NOT NULL,                  -- 'BTC','ETH','USDC',etc.
  wallet_type           TEXT NOT NULL,                  -- 'custodial','non_custodial','omnibus','segregated'
  is_customer_funds     BOOLEAN NOT NULL DEFAULT TRUE,  -- TRUE=customer funds, FALSE=operational
  is_segregated         BOOLEAN NOT NULL DEFAULT FALSE, -- HB 1666 requirement
  balance_snapshot      NUMERIC(30, 10),
  snapshot_at           TIMESTAMP WITH TIME ZONE,
  custodian_name        TEXT,
  cold_storage          BOOLEAN NOT NULL DEFAULT FALSE,
  multi_sig_required    BOOLEAN NOT NULL DEFAULT FALSE,
  multi_sig_threshold   SMALLINT,
  -- Evidence metadata
  evidence_collected_at TIMESTAMP WITH TIME ZONE,
  evidence_hash         TEXT,
  s3_evidence_key       TEXT,
  collected_by_lambda   TEXT,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_wallet_customer
  ON tx_digital_asset_wallets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tx_wallet_segregation
  ON tx_digital_asset_wallets(customer_id, is_segregated, is_customer_funds);

COMMENT ON TABLE tx_digital_asset_wallets IS
  'TX-MT-R4/TX-DASP-R1: Digital asset segregation per TX HB 1666.';

-- ══════════════════════════════════════════════════════════
-- TABLE: tx_aml_alerts
-- Control: TX-MT-R2 (supporting) — AML Alert Log
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tx_aml_alerts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  external_alert_id     TEXT NOT NULL,                  -- AML system (Unit21, Sardine, etc.) ID
  alert_type            TEXT NOT NULL,                  -- 'structuring','velocity','sanctions',etc.
  alert_date            TIMESTAMP WITH TIME ZONE NOT NULL,
  risk_score            NUMERIC(5, 2),
  status                tx_alert_status NOT NULL DEFAULT 'open',
  disposition           TEXT,
  dispositioned_by      TEXT,
  dispositioned_at      TIMESTAMP WITH TIME ZONE,
  sar_filed             BOOLEAN NOT NULL DEFAULT FALSE,
  sar_id                UUID REFERENCES tx_sar_filings(id),
  related_transaction_ids UUID[],
  raw_alert_payload     JSONB,
  -- Evidence metadata
  evidence_collected_at TIMESTAMP WITH TIME ZONE,
  evidence_hash         TEXT,
  s3_evidence_key       TEXT,
  collected_by_lambda   TEXT,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_aml_customer_date
  ON tx_aml_alerts(customer_id, alert_date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_aml_status
  ON tx_aml_alerts(customer_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_aml_external_id
  ON tx_aml_alerts(customer_id, external_alert_id);

COMMENT ON TABLE tx_aml_alerts IS
  'AML alerts imported from customer AML system for SAR disposition evidence.';

-- ══════════════════════════════════════════════════════════
-- TABLE: tx_examiner_exports
-- Audit trail of data packages sent to Texas DOB examiners
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tx_examiner_exports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  export_reference      TEXT NOT NULL UNIQUE,
  examiner_name         TEXT,
  examiner_email        TEXT,
  exam_type             TEXT NOT NULL DEFAULT 'routine', -- 'routine','targeted','follow_up'
  period_start          DATE NOT NULL,
  period_end            DATE NOT NULL,
  controls_included     TEXT[] NOT NULL,                -- e.g. ['TX-MT-R1','TX-MT-R2a']
  record_count          INTEGER NOT NULL DEFAULT 0,
  s3_package_key        TEXT NOT NULL,
  package_hash          TEXT NOT NULL,
  kms_signature         TEXT,
  generated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMP WITH TIME ZONE,
  accessed_at           TIMESTAMP WITH TIME ZONE,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_export_customer
  ON tx_examiner_exports(customer_id, generated_at DESC);

COMMENT ON TABLE tx_examiner_exports IS
  'Audit log of evidence packages delivered to Texas DOB examiners.';

-- ══════════════════════════════════════════════════════════
-- TABLE: tx_compliance_controls
-- Per-customer control status dashboard
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tx_compliance_controls (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  control_id            TEXT NOT NULL,                  -- 'TX-MT-R1','TX-MT-R2a', etc.
  control_name          TEXT NOT NULL,
  regulation_ref        TEXT NOT NULL,
  status                tx_control_status NOT NULL DEFAULT 'pending_review',
  last_assessed_at      TIMESTAMP WITH TIME ZONE,
  next_assessment_at    TIMESTAMP WITH TIME ZONE,
  evidence_count        INTEGER NOT NULL DEFAULT 0,
  findings              JSONB,
  remediation_notes     TEXT,
  assessed_by_lambda    TEXT,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, control_id)
);

CREATE INDEX IF NOT EXISTS idx_tx_controls_customer
  ON tx_compliance_controls(customer_id);
CREATE INDEX IF NOT EXISTS idx_tx_controls_status
  ON tx_compliance_controls(customer_id, status);

COMMENT ON TABLE tx_compliance_controls IS
  'Per-customer Texas compliance control status, updated by evidence collector Lambda.';

-- ══════════════════════════════════════════════════════════
-- TABLE: tx_evidence_signatures
-- KMS-signed manifests for examiner non-repudiation
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tx_evidence_signatures (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  evidence_type         TEXT NOT NULL,                  -- table name or 'examiner_package'
  evidence_id           UUID NOT NULL,                  -- FK to relevant table
  content_hash          TEXT NOT NULL,                  -- SHA-256 of evidence JSON
  kms_key_id            TEXT NOT NULL,
  kms_signature_b64     TEXT NOT NULL,
  signed_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  lambda_request_id     TEXT,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_sig_customer
  ON tx_evidence_signatures(customer_id, evidence_type);
CREATE INDEX IF NOT EXISTS idx_tx_sig_evidence_id
  ON tx_evidence_signatures(evidence_id);

COMMENT ON TABLE tx_evidence_signatures IS
  'KMS-signed SHA-256 hashes for tamper-evident examiner evidence.';

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- All tables isolated by customer_id using same RLS pattern
-- as the core schema (app.current_customer_id session var).
-- ══════════════════════════════════════════════════════════

ALTER TABLE tx_transaction_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_ctr_filings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_sar_filings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_cip_records           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_digital_asset_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_aml_alerts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_examiner_exports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_compliance_controls   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_evidence_signatures   ENABLE ROW LEVEL SECURITY;

-- Generic isolation macro (one policy per table)
CREATE POLICY tx_transaction_records_isolation ON tx_transaction_records
  USING (customer_id = current_setting('app.current_customer_id', TRUE)::UUID);

CREATE POLICY tx_ctr_filings_isolation ON tx_ctr_filings
  USING (customer_id = current_setting('app.current_customer_id', TRUE)::UUID);

CREATE POLICY tx_sar_filings_isolation ON tx_sar_filings
  USING (customer_id = current_setting('app.current_customer_id', TRUE)::UUID);

CREATE POLICY tx_cip_records_isolation ON tx_cip_records
  USING (customer_id = current_setting('app.current_customer_id', TRUE)::UUID);

CREATE POLICY tx_digital_asset_wallets_isolation ON tx_digital_asset_wallets
  USING (customer_id = current_setting('app.current_customer_id', TRUE)::UUID);

CREATE POLICY tx_aml_alerts_isolation ON tx_aml_alerts
  USING (customer_id = current_setting('app.current_customer_id', TRUE)::UUID);

CREATE POLICY tx_examiner_exports_isolation ON tx_examiner_exports
  USING (customer_id = current_setting('app.current_customer_id', TRUE)::UUID);

CREATE POLICY tx_compliance_controls_isolation ON tx_compliance_controls
  USING (customer_id = current_setting('app.current_customer_id', TRUE)::UUID);

CREATE POLICY tx_evidence_signatures_isolation ON tx_evidence_signatures
  USING (customer_id = current_setting('app.current_customer_id', TRUE)::UUID);

-- ══════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════

-- check_ctr_filing_compliance: returns transactions ≥$10,000 cash without a CTR
CREATE OR REPLACE FUNCTION check_ctr_filing_compliance(p_customer_id UUID)
RETURNS TABLE (
  transaction_id      UUID,
  transaction_date    TIMESTAMP WITH TIME ZONE,
  amount              NUMERIC(18,2),
  sender_name         TEXT,
  ctr_status          TEXT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      t.id,
      t.transaction_date,
      t.amount,
      t.sender_name,
      COALESCE(c.filing_status::TEXT, 'MISSING') AS ctr_status
    FROM tx_transaction_records t
    LEFT JOIN tx_ctr_filings c
      ON c.customer_id = t.customer_id
      AND t.id = ANY(c.related_transaction_ids)
    WHERE t.customer_id = p_customer_id
      AND t.transaction_type IN ('cash', 'money_order')
      AND t.amount >= 10000
      AND t.status = 'completed'
    ORDER BY t.transaction_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_ctr_filing_compliance IS
  'Returns cash transactions ≥$10,000 showing CTR filing status. Used by examiner portal.';

-- detect_structuring: flags series of sub-$10K transactions summing ≥$10K within 24h
CREATE OR REPLACE FUNCTION detect_structuring(
  p_customer_id UUID,
  p_lookback_hours INTEGER DEFAULT 24,
  p_threshold NUMERIC DEFAULT 10000
)
RETURNS TABLE (
  sender_name   TEXT,
  sender_account TEXT,
  txn_count     BIGINT,
  total_amount  NUMERIC,
  first_txn     TIMESTAMP WITH TIME ZONE,
  last_txn      TIMESTAMP WITH TIME ZONE,
  structuring_indicator BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      t.sender_name,
      t.sender_account,
      COUNT(*) AS txn_count,
      SUM(t.amount) AS total_amount,
      MIN(t.transaction_date) AS first_txn,
      MAX(t.transaction_date) AS last_txn,
      (COUNT(*) >= 2 AND SUM(t.amount) >= p_threshold AND MAX(t.amount) < 10000) AS structuring_indicator
    FROM tx_transaction_records t
    WHERE t.customer_id = p_customer_id
      AND t.transaction_date >= NOW() - (p_lookback_hours || ' hours')::INTERVAL
      AND t.transaction_type IN ('cash', 'money_order', 'crypto')
      AND t.amount < 10000
      AND t.status = 'completed'
    GROUP BY t.sender_name, t.sender_account
    HAVING SUM(t.amount) >= p_threshold
    ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION detect_structuring IS
  'Detects potential structuring patterns per 31 CFR §1022.320(a)(2)(i).';

-- get_tx_compliance_summary: dashboard summary for a customer
CREATE OR REPLACE FUNCTION get_tx_compliance_summary(p_customer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'customer_id', p_customer_id,
    'generated_at', NOW(),
    'controls', (
      SELECT jsonb_agg(jsonb_build_object(
        'control_id', control_id,
        'control_name', control_name,
        'status', status,
        'last_assessed_at', last_assessed_at,
        'evidence_count', evidence_count
      ))
      FROM tx_compliance_controls
      WHERE customer_id = p_customer_id
    ),
    'transaction_count_30d', (
      SELECT COUNT(*) FROM tx_transaction_records
      WHERE customer_id = p_customer_id
        AND transaction_date >= NOW() - INTERVAL '30 days'
    ),
    'ctr_pending', (
      SELECT COUNT(*) FROM tx_ctr_filings
      WHERE customer_id = p_customer_id AND filing_status = 'pending'
    ),
    'sar_pending', (
      SELECT COUNT(*) FROM tx_sar_filings
      WHERE customer_id = p_customer_id AND filing_status = 'pending'
    ),
    'aml_open_alerts', (
      SELECT COUNT(*) FROM tx_aml_alerts
      WHERE customer_id = p_customer_id AND status = 'open'
    ),
    'digital_assets_segregated', (
      SELECT BOOL_AND(is_segregated)
      FROM tx_digital_asset_wallets
      WHERE customer_id = p_customer_id AND is_customer_funds = TRUE
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_tx_compliance_summary IS
  'Returns a JSON summary of Texas compliance status for a customer — used by portal dashboard.';

-- ══════════════════════════════════════════════════════════
-- SEED: default control catalogue (inserted for new customers
-- by the Lambda on first run via upsert)
-- ══════════════════════════════════════════════════════════

-- This view lets the Lambda enumerate the canonical control list
-- without hard-coding it.
CREATE OR REPLACE VIEW tx_control_catalogue AS
SELECT * FROM (VALUES
  ('TX-MT-R1',   'Transaction Recordkeeping',             '7 TAC §33.35; Fin. Code §151.307'),
  ('TX-MT-R2a',  'Currency Transaction Report (CTR)',      '31 CFR §1022.310'),
  ('TX-MT-R2b',  'Suspicious Activity Report (SAR)',       '31 CFR §1022.320'),
  ('TX-MT-R3',   'Customer Identification Program (CIP)',  '31 CFR §1022.210; 7 TAC §33.3'),
  ('TX-MT-R4',   'Digital Asset Segregation',              'TX HB 1666; Fin. Code §152'),
  ('TX-DASP-R1', 'Digital Asset Service Provider License', 'TX Fin. Code §152.101')
) AS t(control_id, control_name, regulation_ref);

COMMENT ON VIEW tx_control_catalogue IS
  'Canonical list of Texas Money Transmitter compliance controls implemented by SecureBase.';
