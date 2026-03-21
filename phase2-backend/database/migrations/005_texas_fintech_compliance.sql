-- ============================================
-- Migration: Texas Fintech Compliance Tables
-- ============================================
-- Adds tables for Texas Department of Banking compliance
-- and FinCEN reporting requirements (CTR/SAR)
--
-- Requirements:
-- - 7 Tex. Admin. Code §33.35 (Transaction recordkeeping)
-- - 31 CFR §1010.410(e) (Money transmitter records)
-- - 31 CFR §1022.210 (Customer Identification Program)
-- - HB 1666 (Digital Asset Service Provider requirements)

-- ============================================
-- CUSTOM TYPES FOR FINTECH
-- ============================================

CREATE TYPE transaction_type AS ENUM ('send', 'receive', 'exchange', 'deposit', 'withdrawal');
CREATE TYPE filing_type AS ENUM ('CTR', 'SAR', 'FBAR', 'Form8300');
CREATE TYPE filing_status AS ENUM ('draft', 'submitted', 'accepted', 'rejected', 'amended');
CREATE TYPE risk_rating AS ENUM ('low', 'medium', 'high', 'prohibited');
CREATE TYPE delegate_status AS ENUM ('active', 'suspended', 'terminated', 'pending_approval');

-- ============================================
-- FINTECH TRANSACTIONS TABLE
-- ============================================
-- Stores detailed transaction records per 31 CFR §1010.410(e)

CREATE TABLE IF NOT EXISTS fintech_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Transaction details (31 CFR §1010.410(e) required fields)
  transaction_timestamp TIMESTAMP NOT NULL,
  transaction_type transaction_type NOT NULL,
  amount_usd NUMERIC(15, 2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  fee_charged NUMERIC(15, 2) DEFAULT 0,
  method_of_payment VARCHAR(50),  -- cash, check, wire, ACH, card, crypto
  location_code VARCHAR(10),  -- Branch/location identifier
  
  -- Customer information
  sender_customer_id UUID REFERENCES customers(id),
  sender_name TEXT,
  sender_address_line1 TEXT,
  sender_city VARCHAR(100),
  sender_state VARCHAR(2),
  sender_zip VARCHAR(10),
  sender_ssn_encrypted TEXT,  -- Encrypted SSN/TIN
  sender_id_type VARCHAR(50),  -- Driver's License, Passport, etc.
  sender_id_number VARCHAR(100),
  sender_id_issuer VARCHAR(100),  -- State or country
  
  -- Recipient information (for transmissions)
  recipient_customer_id UUID REFERENCES customers(id),
  recipient_name TEXT,
  recipient_address_line1 TEXT,
  recipient_bank_name VARCHAR(200),
  recipient_account_number_encrypted TEXT,
  
  -- Processing details
  processed_by_employee_id VARCHAR(50),
  processed_by_employee_name VARCHAR(100),
  receipt_number VARCHAR(50),
  
  -- Texas nexus flag (transaction involves Texas customer/location)
  texas_nexus BOOLEAN DEFAULT false,
  
  -- Compliance flags
  ctr_eligible BOOLEAN GENERATED ALWAYS AS (amount_usd > 10000) STORED,
  suspicious_activity_flagged BOOLEAN DEFAULT false,
  structuring_risk_score INTEGER DEFAULT 0,  -- 0-100 automated risk score
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fintech_tx_customer ON fintech_transactions(customer_id);
CREATE INDEX idx_fintech_tx_timestamp ON fintech_transactions(transaction_timestamp DESC);
CREATE INDEX idx_fintech_tx_amount ON fintech_transactions(amount_usd DESC);
CREATE INDEX idx_fintech_tx_type ON fintech_transactions(transaction_type);
CREATE INDEX idx_fintech_tx_ctr_eligible ON fintech_transactions(ctr_eligible) WHERE ctr_eligible = true;
CREATE INDEX idx_fintech_tx_suspicious ON fintech_transactions(suspicious_activity_flagged) WHERE suspicious_activity_flagged = true;
CREATE INDEX idx_fintech_tx_texas_nexus ON fintech_transactions(texas_nexus) WHERE texas_nexus = true;

-- ============================================
-- FINTECH CUSTOMER DETAILS TABLE
-- ============================================
-- Extended KYC/CIP data per 31 CFR §1022.210

CREATE TABLE IF NOT EXISTS fintech_customer_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Note: UNIQUE constraint creates one-to-one relationship with customers table
  -- Each SecureBase customer has one fintech_customer_details record containing
  -- aggregated KYC/CIP information for their fintech service
  UNIQUE(customer_id),
  
  -- Customer Identification Program (CIP) fields
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  ssn_encrypted TEXT,  -- Encrypted SSN
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  country VARCHAR(2) DEFAULT 'US',
  
  -- Government ID verification
  id_type VARCHAR(50),  -- Driver's License, Passport, State ID
  id_number VARCHAR(100),
  id_issuer VARCHAR(100),  -- State or country
  id_expiration_date DATE,
  id_verification_date DATE,
  id_verification_method VARCHAR(50),  -- manual, electronic, documentary
  
  -- Risk assessment
  risk_rating risk_rating DEFAULT 'medium',
  risk_factors JSONB DEFAULT '[]',  -- Array of risk indicators
  
  -- Due diligence
  cdd_completed BOOLEAN DEFAULT false,  -- Customer Due Diligence
  cdd_completion_date DATE,
  edd_required BOOLEAN DEFAULT false,  -- Enhanced Due Diligence
  edd_completion_date DATE,
  
  -- Screening
  pep_screening_date DATE,  -- Politically Exposed Person
  pep_status BOOLEAN DEFAULT false,
  sanctions_screening_date DATE,
  sanctions_match BOOLEAN DEFAULT false,
  
  -- Account status
  account_status VARCHAR(20) DEFAULT 'active',
  account_created_date DATE DEFAULT CURRENT_DATE,
  account_closed_date DATE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fintech_customer_details_customer ON fintech_customer_details(customer_id);
CREATE INDEX idx_fintech_customer_details_risk ON fintech_customer_details(risk_rating);
CREATE INDEX idx_fintech_customer_details_edd ON fintech_customer_details(edd_required) WHERE edd_required = true;

-- ============================================
-- CTR FILINGS TABLE
-- ============================================
-- Currency Transaction Reports (FinCEN Form 112)

CREATE TABLE IF NOT EXISTS ctr_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES fintech_transactions(transaction_id),
  
  -- Filing details
  ctr_filed BOOLEAN DEFAULT false,
  ctr_file_date DATE,
  bsae_number VARCHAR(50),  -- Bank Secrecy Act E-Filing number
  filing_status filing_status DEFAULT 'draft',
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_amount NUMERIC(15, 2) NOT NULL,
  customer_name TEXT NOT NULL,
  
  -- Compliance
  filing_deadline DATE NOT NULL,  -- 15 calendar days after transaction
  days_to_file INTEGER,
  filed_on_time BOOLEAN,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ctr_customer ON ctr_filings(customer_id);
CREATE INDEX idx_ctr_transaction ON ctr_filings(transaction_id);
CREATE INDEX idx_ctr_filed ON ctr_filings(ctr_filed);
CREATE INDEX idx_ctr_deadline ON ctr_filings(filing_deadline);

-- ============================================
-- SAR FILINGS TABLE
-- ============================================
-- Suspicious Activity Reports (FinCEN Form 111)

CREATE TABLE IF NOT EXISTS sar_filings (
  sar_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Filing details
  detection_date DATE NOT NULL,
  filing_date DATE,
  bsae_number VARCHAR(50),
  filing_status filing_status DEFAULT 'draft',
  
  -- Activity details
  activity_type VARCHAR(100) NOT NULL,  -- structuring, money laundering, fraud, etc.
  narrative TEXT NOT NULL,  -- Detailed description of suspicious activity
  total_amount NUMERIC(15, 2),
  
  -- Compliance
  filing_deadline DATE NOT NULL,  -- 30 calendar days after detection
  days_to_file INTEGER,
  filed_on_time BOOLEAN,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sar_customer ON sar_filings(customer_id);
CREATE INDEX idx_sar_detection_date ON sar_filings(detection_date);
CREATE INDEX idx_sar_filing_date ON sar_filings(filing_date);
CREATE INDEX idx_sar_deadline ON sar_filings(filing_deadline);

-- ============================================
-- SAR TRANSACTIONS TABLE (many-to-many)
-- ============================================

CREATE TABLE IF NOT EXISTS sar_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sar_id UUID NOT NULL REFERENCES sar_filings(sar_id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES fintech_transactions(transaction_id) ON DELETE CASCADE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(sar_id, transaction_id)
);

CREATE INDEX idx_sar_tx_sar ON sar_transactions(sar_id);
CREATE INDEX idx_sar_tx_transaction ON sar_transactions(transaction_id);

-- ============================================
-- AUTHORIZED DELEGATES TABLE
-- ============================================
-- Per 7 TAC §33.35(b)(3)

CREATE TABLE IF NOT EXISTS authorized_delegates (
  delegate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Delegate details
  delegate_name TEXT NOT NULL,
  delegate_legal_name TEXT,
  delegate_ein VARCHAR(20),
  
  -- Agreement
  agreement_date DATE,
  agreement_expiration DATE,
  agreement_document_ref TEXT,  -- S3 URI to signed agreement
  
  -- Locations
  locations_count INTEGER DEFAULT 0,
  locations JSONB DEFAULT '[]',  -- Array of location addresses
  
  -- Oversight
  last_audit_date DATE,
  next_audit_date DATE,
  compliance_status VARCHAR(50) DEFAULT 'compliant',
  
  -- Status
  status delegate_status DEFAULT 'pending_approval',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delegates_customer ON authorized_delegates(customer_id);
CREATE INDEX idx_delegates_status ON authorized_delegates(status);
CREATE INDEX idx_delegates_audit_date ON authorized_delegates(next_audit_date);

-- ============================================
-- DELEGATE TRANSACTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS delegate_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegate_id UUID NOT NULL REFERENCES authorized_delegates(delegate_id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES fintech_transactions(transaction_id) ON DELETE CASCADE,
  
  transaction_date DATE NOT NULL,
  amount_usd NUMERIC(15, 2) NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delegate_tx_delegate ON delegate_transactions(delegate_id);
CREATE INDEX idx_delegate_tx_date ON delegate_transactions(transaction_date);

-- ============================================
-- DIGITAL ASSET ACCOUNTS TABLE
-- ============================================
-- For Digital Asset Service Providers (HB 1666)

CREATE TABLE IF NOT EXISTS digital_asset_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Account details
  account_id VARCHAR(100) NOT NULL UNIQUE,
  account_type VARCHAR(50),  -- hot_wallet, cold_wallet, custodial
  account_name TEXT,
  
  -- Balances
  balance_usd NUMERIC(15, 2) DEFAULT 0,
  balance_crypto JSONB DEFAULT '{}',  -- {"BTC": "0.5", "ETH": "10.0"}
  
  -- State tracking
  state VARCHAR(2),  -- Customer's state
  
  -- Segregation compliance
  contains_customer_funds BOOLEAN DEFAULT true,
  contains_company_funds BOOLEAN DEFAULT false,
  
  -- Status
  account_status VARCHAR(20) DEFAULT 'active',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_digital_asset_customer ON digital_asset_accounts(customer_id);
CREATE INDEX idx_digital_asset_state ON digital_asset_accounts(state);
CREATE INDEX idx_digital_asset_type ON digital_asset_accounts(account_type);

-- ============================================
-- COMPANY ACCOUNTS TABLE
-- ============================================
-- For tracking company operational funds separate from customer funds

CREATE TABLE IF NOT EXISTS company_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Account details
  account_id VARCHAR(100) NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_purpose VARCHAR(50) NOT NULL,  -- operational, reserve, fee_collection
  
  -- Balance
  balance_usd NUMERIC(15, 2) DEFAULT 0,
  
  -- Status
  account_status VARCHAR(20) DEFAULT 'active',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_company_accounts_customer ON company_accounts(customer_id);
CREATE INDEX idx_company_accounts_purpose ON company_accounts(account_purpose);

-- ============================================
-- ROW-LEVEL SECURITY FOR FINTECH TABLES
-- ============================================

ALTER TABLE fintech_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fintech_customer_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE ctr_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sar_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sar_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_delegates ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegate_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_asset_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Customer isolation
CREATE POLICY customer_isolation_fintech_tx 
  ON fintech_transactions 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

CREATE POLICY customer_isolation_fintech_customer_details 
  ON fintech_customer_details 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

CREATE POLICY customer_isolation_ctr 
  ON ctr_filings 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

CREATE POLICY customer_isolation_sar 
  ON sar_filings 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

-- Index for RLS policy performance
CREATE INDEX idx_sar_filings_sar_customer ON sar_filings(sar_id, customer_id);

CREATE POLICY customer_isolation_sar_tx 
  ON sar_transactions 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM sar_filings 
      WHERE sar_id = sar_transactions.sar_id 
        AND customer_id = current_setting('app.current_customer_id')::uuid
    ) OR current_setting('app.role') = 'admin'
  );

CREATE POLICY customer_isolation_delegates 
  ON authorized_delegates 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

-- Index for RLS policy performance
CREATE INDEX idx_delegates_delegate_customer ON authorized_delegates(delegate_id, customer_id);

CREATE POLICY customer_isolation_delegate_tx 
  ON delegate_transactions 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM authorized_delegates 
      WHERE delegate_id = delegate_transactions.delegate_id 
        AND customer_id = current_setting('app.current_customer_id')::uuid
    ) OR current_setting('app.role') = 'admin'
  );

CREATE POLICY customer_isolation_digital_asset 
  ON digital_asset_accounts 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

CREATE POLICY customer_isolation_company_accounts 
  ON company_accounts 
  FOR ALL 
  USING (customer_id = current_setting('app.current_customer_id')::uuid OR current_setting('app.role') = 'admin');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check CTR filing compliance
CREATE OR REPLACE FUNCTION check_ctr_filing_compliance(p_customer_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  transaction_id UUID,
  transaction_date DATE,
  amount_usd NUMERIC,
  ctr_filed BOOLEAN,
  days_to_file INTEGER,
  compliant BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ft.transaction_id,
    ft.transaction_timestamp::DATE as transaction_date,
    ft.amount_usd,
    COALESCE(cf.ctr_filed, false) as ctr_filed,
    cf.days_to_file,
    CASE 
      WHEN cf.ctr_filed AND cf.days_to_file IS NOT NULL AND cf.days_to_file <= 15 THEN true
      ELSE false
    END as compliant
  FROM fintech_transactions ft
  LEFT JOIN ctr_filings cf ON ft.transaction_id = cf.transaction_id
  WHERE ft.customer_id = p_customer_id
    AND ft.transaction_timestamp::DATE >= p_start_date
    AND ft.transaction_timestamp::DATE <= p_end_date
    AND ft.amount_usd > 10000
  ORDER BY ft.transaction_timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to detect potential structuring
CREATE OR REPLACE FUNCTION detect_structuring(p_customer_id UUID, p_lookback_days INTEGER DEFAULT 30)
RETURNS TABLE (
  sender_customer_id UUID,
  sender_name TEXT,
  transaction_count BIGINT,
  total_amount NUMERIC,
  avg_amount NUMERIC,
  risk_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ft.sender_customer_id,
    ft.sender_name,
    COUNT(*) as transaction_count,
    SUM(ft.amount_usd) as total_amount,
    AVG(ft.amount_usd) as avg_amount,
    CASE 
      WHEN COUNT(*) >= 5 AND AVG(ft.amount_usd) BETWEEN 8000 AND 9999 THEN 90
      WHEN COUNT(*) >= 3 AND AVG(ft.amount_usd) BETWEEN 8000 AND 9999 THEN 70
      WHEN COUNT(*) >= 5 AND AVG(ft.amount_usd) BETWEEN 7000 AND 9999 THEN 50
      ELSE 20
    END as risk_score
  FROM fintech_transactions ft
  WHERE ft.customer_id = p_customer_id
    AND ft.transaction_timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 day' * p_lookback_days
    AND ft.amount_usd BETWEEN 7000 AND 9999
  GROUP BY ft.sender_customer_id, ft.sender_name
  HAVING COUNT(*) >= 3
  ORDER BY risk_score DESC, transaction_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE fintech_transactions IS 'Transaction records per 31 CFR §1010.410(e) and 7 Tex. Admin. Code §33.35';
COMMENT ON TABLE ctr_filings IS 'Currency Transaction Reports (FinCEN Form 112) for transactions >$10,000';
COMMENT ON TABLE sar_filings IS 'Suspicious Activity Reports (FinCEN Form 111) for suspicious patterns';
COMMENT ON TABLE fintech_customer_details IS 'Customer Identification Program (CIP) data per 31 CFR §1022.210';
COMMENT ON TABLE authorized_delegates IS 'Authorized delegate oversight per 7 TAC §33.35(b)(3)';
COMMENT ON TABLE digital_asset_accounts IS 'Digital Asset Service Provider accounts per HB 1666';
