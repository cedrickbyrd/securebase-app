# 🚀 Demo Environment Setup - securebase.tximhotep.com

## Goal: Create demo.securebase.tximhotep.com

### Your Domain Structure:
- **Main portal:** securebase.tximhotep.com
- **Demo portal:** demo.securebase.tximhotep.com  
- **API:** 9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod

---

## Quick Deploy (Do This TODAY)

### Step 1: Set Up Demo Subdomain (5 minutes)
```bash
# Add DNS record in your DNS provider
# Type: CNAME
# Name: demo
# Value: securebase.tximhotep.com
# TTL: 300
```

**Or if using Route53:**
```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "demo.securebase.tximhotep.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "securebase.tximhotep.com"}]
      }
    }]
  }'
```

### Step 2: Create Demo Customer (5 minutes)
```bash
cat > create-demo-customer.sql << 'SQL'
-- Create demo customer
INSERT INTO customers (
  id, email, first_name, last_name, org_name, org_size, industry,
  tier, status, aws_region, mfa_enabled, guardrails_level,
  subscription_status, onboarding_status, email_verified, created_at
) VALUES (
  'demo-user-001',
  'demo@securebase.tximhotep.com',
  'Demo',
  'User',
  'Demo Company Inc',
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
) ON CONFLICT (id) DO NOTHING;

-- Create demo onboarding job
INSERT INTO onboarding_jobs (
  id, customer_id, overall_status, created_at, updated_at
) VALUES (
  'demo-job-001',
  'demo-user-001',
  'completed',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

SELECT '✅ Demo customer created!' as status;
SQL

# Apply to database
# You'll need to get the password from Secrets Manager
PGPASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id securebase/dev/rds/admin-password \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq -r '.password')

PGPASSWORD=$PGPASSWORD psql \
  -h securebase-phase2-dev.cluster-coti40osot2c.us-east-1.rds.amazonaws.com \
  -U adminuser \
  -d securebase \
  -f create-demo-customer.sql
```

### Step 3: Add Demo Banner to Portal (10 minutes)
```bash
# Create demo banner component
cat > phase3a-portal/src/components/DemoBanner.jsx << 'EOF'
export default function DemoBanner() {
  // Only show on demo subdomain
  if (!window.location.hostname.includes('demo.')) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-blue-800">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </span>
            <p className="ml-3 font-medium truncate">
              <span className="md:hidden">Demo Mode - Explore SecureBase</span>
              <span className="hidden md:inline">
                🎯 Demo Mode - This is a sample account with example data
              </span>
            </p>
          </div>
          <div className="mt-2 flex-shrink-0 w-full sm:mt-0 sm:w-auto">
            <div className="flex space-x-3">
              
                href="https://securebase.tximhotep.com/signup"
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 transition"
              >
                Start Free Trial
              </a>
              
                href="mailto:sales@securebase.tximhotep.com"
                className="flex items-center justify-center px-4 py-2 border border-white rounded-md shadow-sm text-sm font-medium text-white hover:bg-white hover:bg-opacity-10 transition"
              >
                Book Demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
