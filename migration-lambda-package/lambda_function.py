import json
import os
import boto3
import pg8000.native

def handler(event, context):
    sm = boto3.client("secretsmanager")
    secret_arn = os.environ["DB_SECRET_ARN"]
    secret = json.loads(sm.get_secret_value(SecretId=secret_arn)["SecretString"])
    
    # Handle different secret formats
    host = secret.get("host") or secret.get("hostname") or os.environ.get("DB_HOST")
    port = int(secret.get("port", 5432))
    database = secret.get("dbname") or secret.get("database") or "securebase"
    username = secret.get("username") or secret.get("user")
    password = secret.get("password")
    
    print(f"Connecting to: {host}:{port}/{database}")
    
    migration_sql = """
CREATE OR REPLACE FUNCTION create_customer_with_onboarding(
  p_email TEXT, p_first_name TEXT, p_last_name TEXT, p_org_name TEXT,
  p_org_size TEXT, p_industry TEXT, p_aws_region TEXT,
  p_mfa_enabled BOOLEAN, p_guardrails_level TEXT
)
RETURNS TABLE(customer_id UUID, job_id UUID) AS $func$
DECLARE
  v_customer_id UUID; 
  v_job_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM customers WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists: %', p_email USING ERRCODE = 'unique_violation';
  END IF;
  INSERT INTO customers (email, first_name, last_name, org_name, org_size, industry, aws_region, mfa_enabled, guardrails_level, onboarding_status, email_verified)
  VALUES (p_email, p_first_name, p_last_name, p_org_name, p_org_size, p_industry, p_aws_region, p_mfa_enabled, p_guardrails_level, 'pending', FALSE)
  RETURNING id INTO v_customer_id;
  INSERT INTO onboarding_jobs (customer_id, overall_status) VALUES (v_customer_id, 'pending') RETURNING id INTO v_job_id;
  RETURN QUERY SELECT v_customer_id, v_job_id;
END;
$func$ LANGUAGE plpgsql;

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

CREATE TABLE IF NOT EXISTS onboarding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  overall_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_org_name ON customers(org_name);
CREATE INDEX IF NOT EXISTS idx_customers_onboarding_status ON customers(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_onboarding_jobs_customer ON onboarding_jobs(customer_id);
"""
    
    conn = pg8000.native.Connection(
        host=host, port=port, database=database,
        user=username, password=password, ssl_context=True
    )
    try:
        conn.run(migration_sql)
        return {"statusCode": 200, "body": json.dumps({"message": "Migration applied successfully!"})}
    except Exception as e:
        print(f"Error: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
    finally:
        conn.close()
