-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums (using DO blocks to handle if exists)
DO $$ BEGIN
  CREATE TYPE customer_tier AS ENUM ('standard', 'fintech', 'healthcare', 'gov-federal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customer_status AS ENUM ('active', 'suspended', 'deleted', 'trial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE compliance_framework AS ENUM ('soc2', 'hipaa', 'fedramp', 'cis');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM ('stripe', 'aws_marketplace', 'invoice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create customers table with all fields
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name TEXT,
  tier customer_tier DEFAULT 'standard',
  framework compliance_framework DEFAULT 'soc2',
  status customer_status DEFAULT 'active',
  
  -- Signup specific fields
  first_name TEXT,
  last_name TEXT,
  org_name TEXT,
  org_size TEXT,
  industry TEXT,
  aws_region TEXT DEFAULT 'us-east-1',
  mfa_enabled BOOLEAN DEFAULT TRUE,
  guardrails_level TEXT DEFAULT 'standard',
  onboarding_status TEXT DEFAULT 'pending',
  email_verified BOOLEAN DEFAULT FALSE,
  
  -- Contact info
  email TEXT NOT NULL UNIQUE,
  billing_email TEXT,
  billing_contact_phone TEXT,
  
  -- AWS details
  aws_org_id TEXT UNIQUE,
  aws_management_account_id TEXT,
  
  -- Payment
  payment_method payment_method_type DEFAULT 'stripe',
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
  
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Create onboarding_jobs table
CREATE TABLE IF NOT EXISTS onboarding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  overall_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_org_name ON customers(org_name);
CREATE INDEX IF NOT EXISTS idx_customers_onboarding_status ON customers(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_jobs_customer ON onboarding_jobs(customer_id);

-- Create the atomic signup function
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
  -- Check for duplicate email
  IF EXISTS (SELECT 1 FROM customers WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists: %', p_email 
      USING ERRCODE = 'unique_violation';
  END IF;
  
  -- Insert customer
  INSERT INTO customers (
    email, first_name, last_name, org_name, org_size, industry,
    aws_region, mfa_enabled, guardrails_level, onboarding_status, email_verified
  ) VALUES (
    p_email, p_first_name, p_last_name, p_org_name, p_org_size, p_industry,
    p_aws_region, p_mfa_enabled, p_guardrails_level, 'pending', FALSE
  )
  RETURNING id INTO v_customer_id;
  
  -- Create onboarding job
  INSERT INTO onboarding_jobs (customer_id, overall_status)
  VALUES (v_customer_id, 'pending')
  RETURNING id INTO v_job_id;
  
  -- Return both IDs
  RETURN QUERY SELECT v_customer_id, v_job_id;
END;
$$ LANGUAGE plpgsql;
