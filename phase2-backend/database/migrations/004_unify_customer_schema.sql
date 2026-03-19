-- Migration: 004_unify_customer_schema.sql
-- Unifies customer schema for signup flow

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add missing columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS org_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS org_size TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS aws_region TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS guardrails_level TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS onboarding_status TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN;

-- Set defaults
UPDATE customers SET aws_region = 'us-east-1' WHERE aws_region IS NULL;
UPDATE customers SET mfa_enabled = TRUE WHERE mfa_enabled IS NULL;
UPDATE customers SET guardrails_level = 'standard' WHERE guardrails_level IS NULL;
UPDATE customers SET onboarding_status = 'pending' WHERE onboarding_status IS NULL;
UPDATE customers SET email_verified = FALSE WHERE email_verified IS NULL;

-- Create atomic signup function
CREATE OR REPLACE FUNCTION create_customer_with_onboarding(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_org_name TEXT,
  p_org_size TEXT,
  p_industry TEXT,
  p_aws_region TEXT,
  p_mfa_enabled BOOLEAN,
  p_guardrails_level TEXT
)
RETURNS TABLE(customer_id UUID, job_id UUID) AS $$
DECLARE
  v_customer_id UUID;
  v_job_id UUID;
BEGIN
  -- Check for duplicate
  IF EXISTS (SELECT 1 FROM customers WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists: %', p_email
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Insert customer
  INSERT INTO customers (
    email, first_name, last_name, org_name, org_size, 
    industry, aws_region, mfa_enabled, guardrails_level,
    onboarding_status, email_verified
  ) VALUES (
    p_email, p_first_name, p_last_name, p_org_name, p_org_size,
    p_industry, p_aws_region, p_mfa_enabled, p_guardrails_level,
    'pending', FALSE
  )
  RETURNING id INTO v_customer_id;

  -- Create onboarding job
  INSERT INTO onboarding_jobs (customer_id, overall_status)
  VALUES (v_customer_id, 'pending')
  RETURNING id INTO v_job_id;

  RETURN QUERY SELECT v_customer_id, v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_org_name ON customers(org_name);
CREATE INDEX IF NOT EXISTS idx_customers_onboarding_status ON customers(onboarding_status);
