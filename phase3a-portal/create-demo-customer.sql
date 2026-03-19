-- Create demo customer for demo.securebase.tximhotep.com
INSERT INTO customers (
  id,
  email,
  first_name,
  last_name,
  org_name,
  org_size,
  industry,
  tier,
  status,
  aws_region,
  mfa_enabled,
  guardrails_level,
  subscription_status,
  onboarding_status,
  email_verified,
  created_at
) VALUES (
  'demo-user-001',
  'demo@securebase.tximhotep.com',
  'Demo',
  'User',
  'Acme Corporation',
  '11-50',
  'technology',
  'fintech',
  'active',
  'us-east-1',
  TRUE,
  'standard',
  'trialing',
  'completed',
  TRUE,
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  org_name = EXCLUDED.org_name,
  status = EXCLUDED.status,
  subscription_status = EXCLUDED.subscription_status;

-- Create demo onboarding job
INSERT INTO onboarding_jobs (
  id,
  customer_id,
  overall_status,
  created_at,
  updated_at
) VALUES (
  'demo-job-001',
  'demo-user-001',
  'completed',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  overall_status = EXCLUDED.overall_status,
  updated_at = NOW();

-- Verify it worked
SELECT 
  id,
  email,
  org_name,
  tier,
  status,
  subscription_status,
  onboarding_status
FROM customers 
WHERE id = 'demo-user-001';
