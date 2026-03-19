-- Quick fix for existing customers table
-- Add missing columns for signup

ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS org_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS org_size TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS aws_region TEXT DEFAULT 'us-east-1';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS guardrails_level TEXT DEFAULT 'standard';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Make some required fields nullable for signup
ALTER TABLE customers ALTER COLUMN name DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN tier DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN framework DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN billing_email DROP NOT NULL;

-- Set defaults
ALTER TABLE customers ALTER COLUMN tier SET DEFAULT 'standard';
ALTER TABLE customers ALTER COLUMN framework SET DEFAULT 'soc2';

-- Create onboarding_jobs table if not exists
CREATE TABLE IF NOT EXISTS onboarding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  overall_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_org_name ON customers(org_name);
CREATE INDEX IF NOT EXISTS idx_customers_onboarding_status ON customers(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_onboarding_jobs_customer ON onboarding_jobs(customer_id);

-- Atomic signup function
CREATE OR REPLACE FUNCTION create_customer_with_onboarding(
  p_email TEXT, p_first_name TEXT, p_last_name TEXT, p_org_name TEXT,
  p_org_size TEXT, p_industry TEXT, p_aws_region TEXT,
  p_mfa_enabled BOOLEAN, p_guardrails_level TEXT
)
RETURNS TABLE(customer_id UUID, job_id UUID) AS $$
DECLARE
  v_customer_id UUID; 
  v_job_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM customers WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists: %', p_email USING ERRCODE = 'unique_violation';
  END IF;
  
  INSERT INTO customers (
    email, first_name, last_name, org_name, org_size, industry,
    aws_region, mfa_enabled, guardrails_level, onboarding_status, email_verified
  ) VALUES (
    p_email, p_first_name, p_last_name, p_org_name, p_org_size, p_industry,
    p_aws_region, p_mfa_enabled, p_guardrails_level, 'pending', FALSE
  )
  RETURNING id INTO v_customer_id;
  
  INSERT INTO onboarding_jobs (customer_id, overall_status)
  VALUES (v_customer_id, 'pending')
  RETURNING id INTO v_job_id;
  
  RETURN QUERY SELECT v_customer_id, v_job_id;
END;
$$ LANGUAGE plpgsql;
