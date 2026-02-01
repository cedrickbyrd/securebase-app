# SecureBase Demo Seed Data

## Overview

This directory contains deterministic seed data for demonstrating SecureBase's multi-tenant AWS PaaS platform with **authoritative compliance evidence**.

## Files

- **`schema.sql`** - Complete database schema with Row-Level Security (RLS)
- **`seed_demo_data.sql`** - Deterministic demo data generator
- **`init_database.sh`** - Database initialization script

## What Gets Seeded

### 1. **Customers** (4 realistic organizations)
- **ACME Healthcare Systems** - Healthcare tier (HIPAA)
- **TechFlow Financial** - Fintech tier (SOC2)
- **Federal Energy Commission** - Government tier (FedRAMP)
- **StartupCo** - Standard tier (CIS) - Trial account

### 2. **API Keys** (for demo login)
All API keys use bcrypt hashing for security:
- `sk_prod_acme_***` - ACME Healthcare
- `sk_prod_tech_***` - TechFlow Financial
- `sk_gov_fed_***` - Federal Energy
- `sk_test_start_***` - StartupCo

### 3. **Usage Metrics** (6 months historical data)
- Monthly usage aggregated by tier
- Realistic CloudTrail events, Config evaluations
- GuardDuty/Security Hub findings
- Storage, compute, and network metrics

### 4. **Invoices** (monthly billing)
- Tier-based pricing ($2K-$25K/month)
- Usage charges calculated from metrics
- Payment status (paid/issued/draft)
- Tax calculations (8.25%)

### 5. **Support Tickets** (realistic customer issues)
- Security incidents
- Compliance questions
- Account management requests
- Different priorities and statuses

### 6. **Audit Events** (compliance trail)
- Account creation events
- Security configuration changes
- Compliance assessments
- Access management activities

### 7. **Notifications** (system activity)
- Invoice notifications
- Compliance alerts
- System updates
- Support responses

### 8. **Evidence Records** (compliance evidence tracking) ⭐ NEW
Authoritative evidence for SOC2, HIPAA, FedRAMP, and CIS controls with **raw facts**:

#### **SOC2 Evidence (TechFlow Financial)**
- **CC1.1** - Board Charter & Governance (policy docs with versions)
- **CC2.1** - Internal Communication (Slack audit logs)
- **CC3.1** - Fraud Risk Assessment
- **AC1.1** - User Access Provisioning (Okta users: 52, MFA enabled)
- **AC2.1** - Privileged Access Management (CloudTrail admin logs)
- **AU1.1** - Security Event Logging (AWS Config: 89 rules)

#### **HIPAA Evidence (ACME Healthcare)**
- **164.308(a)(1)(i)** - Security Management Process
- **164.308(a)(3)(i)** - Workforce Security (245 employees, 89 PHI access)
- **164.312(a)(1)** - Unique User Identification (IAM users: 89, 100% MFA)
- **164.312(b)** - Audit Controls (7-year retention)
- **164.312(e)(1)** - Transmission Encryption (TLS 1.2+, AES-256)

#### **FedRAMP Evidence (Federal Energy)**
- **AC-2** - Account Management (127 users, PIV required)
- **AU-2** - Audit Events (10-year retention)
- **CM-2** - Baseline Configuration (2,340 compliant resources)
- **IA-2** - PIV/CAC Authentication
- **SC-7** - Boundary Protection (156 firewall rules)

#### **CIS Evidence (StartupCo)**
- **CIS-1.1** - Device Inventory (3 instances, 100% managed)
- **CIS-2.1** - Software Inventory (156 packages tracked)

### Evidence Metadata Structure (Raw Facts)

Each evidence record includes comprehensive **raw facts** in the `metadata` JSONB field:

```json
{
  "okta_users": 52,
  "active_users": 48,
  "last_access_review": "2025-01-30",
  "aws_accounts_connected": true,
  "mfa_enabled": 52,
  "policy_docs": [
    {"name": "Access Control Policy", "version": "v1.2", "approved_date": "2024-01-15"}
  ],
  "password_policy": {
    "min_length": 14,
    "complexity": "high",
    "rotation_days": 90
  },
  "integrations": ["AWS", "GitHub", "Stripe", "Salesforce"]
}
```

## Key Features

### ✅ **Deterministic Generation**
- Uses `uuid_generate_v5()` for repeatable UUIDs
- Same output every time (no random data)
- Perfect for demos, testing, and CI/CD

### ✅ **Realistic Data Patterns**
- Tier-based usage scaling
- Historical trends (6 months)
- Compliance-focused scenarios
- Customer lifecycle stages

### ✅ **Authoritative Evidence**
- Control IDs from real frameworks
- Artifact references (S3 URIs)
- SHA-256 hashes for integrity
- Collection timestamps
- Review audit trails
- **Raw facts with quantifiable metrics**

### ✅ **Multi-Framework Support**
- **SOC2** - Trust Services Criteria
- **HIPAA** - Health Insurance Portability and Accountability Act
- **FedRAMP** - Federal Risk and Authorization Management Program
- **CIS** - Center for Internet Security Benchmarks

## Usage

### Option 1: Load during initialization

```bash
cd phase2-backend/database
LOAD_DEMO_DATA=true ./init_database.sh
```

### Option 2: Load separately

```bash
# After running init_database.sh
psql -h <rds-endpoint> -U postgres -d securebase -f seed_demo_data.sql
```

### Option 3: With environment-specific connection

```bash
export DB_HOST="your-aurora-cluster.us-east-1.rds.amazonaws.com"
export DB_NAME="securebase"
export DB_USER="postgres"
export PGPASSWORD="your-password"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f seed_demo_data.sql
```

## Demo Credentials

After seeding, use these API keys to test the portal:

| Customer | API Key Prefix | Email | Tier |
|----------|---------------|-------|------|
| ACME Healthcare | `sk_prod_acme_***` | admin@acmehealthcare.example.com | Healthcare |
| TechFlow Financial | `sk_prod_tech_***` | admin@techflowfin.example.com | Fintech |
| Federal Energy | `sk_gov_fed_***` | cloudadmin@energy.gov.example.com | Government |
| StartupCo | `sk_test_start_***` | founder@startupco.example.com | Standard (Trial) |

**Note:** Actual keys are bcrypt hashed in the database. Use the customer portal login flow.

## Data Volume

Expected row counts after seeding:

- **Customers:** 4
- **API Keys:** 4
- **Usage Metrics:** ~24 (6 months × 4 customers)
- **Invoices:** ~18 (varies by customer age)
- **Support Tickets:** 8
- **Audit Events:** 9
- **Notifications:** 7
- **Evidence Records:** 19 ⭐

**Total:** ~93 records

## Verification Queries

```sql
-- Check customers by tier
SELECT tier, COUNT(*) FROM customers GROUP BY tier;

-- View evidence by framework
SELECT framework, COUNT(*) as evidence_count 
FROM evidence_records 
GROUP BY framework;

-- Check evidence with raw facts
SELECT 
  control_id, 
  control_name,
  status,
  metadata->>'okta_users' as okta_users,
  metadata->>'last_access_review' as last_review
FROM evidence_records
WHERE framework = 'soc2';

-- Revenue summary
SELECT 
  status, 
  COUNT(*) as count, 
  SUM(total_amount) as revenue 
FROM invoices 
GROUP BY status;

-- Latest usage metrics
SELECT 
  c.name, 
  um.month, 
  um.cloudtrail_events_logged,
  um.guardduty_findings
FROM usage_metrics um
JOIN customers c ON um.customer_id = c.id
ORDER BY um.month DESC
LIMIT 10;

-- Evidence collection status
SELECT 
  framework,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (valid_until - CURRENT_TIMESTAMP))/86400)::int as avg_days_valid
FROM evidence_records
GROUP BY framework, status;
```

## Cleanup

To remove all demo data:

```sql
-- Delete in reverse order due to foreign keys
DELETE FROM evidence_records WHERE customer_id IN (
  SELECT id FROM customers WHERE name IN (
    'ACME Healthcare Systems', 
    'TechFlow Financial', 
    'Federal Energy Commission', 
    'StartupCo'
  )
);

DELETE FROM notifications WHERE customer_id IN (...);
DELETE FROM audit_events WHERE customer_id IN (...);
DELETE FROM support_tickets WHERE customer_id IN (...);
DELETE FROM invoices WHERE customer_id IN (...);
DELETE FROM usage_metrics WHERE customer_id IN (...);
DELETE FROM api_keys WHERE customer_id IN (...);
DELETE FROM customers WHERE name IN (...);
```

## Best Practices

### For Demos
1. Load seed data in staging environment
2. Use API keys to demonstrate portal login
3. Show compliance evidence dashboard
4. Walk through invoice generation
5. Highlight support ticket workflow

### For Testing
1. Use deterministic UUIDs for reproducible tests
2. Test RLS policies with `set_customer_context()`
3. Validate multi-tier scenarios
4. Check evidence collection workflows

### For Development
1. Reset database between feature branches
2. Use seed data for integration tests
3. Benchmark query performance with realistic data
4. Test compliance report generation

## Architecture Notes

### Row-Level Security (RLS)
All tables use RLS to enforce multi-tenancy:
```sql
-- Set customer context before queries
SELECT set_customer_context(
  'customer-uuid'::uuid, 
  'customer'  -- or 'admin' or 'system'
);

-- Now queries only see that customer's data
SELECT * FROM invoices;  -- Only returns invoices for context customer
```

### Evidence Validity
- **Automated evidence**: Short validity (7-90 days) - frequent collection
- **Manual evidence**: Long validity (90-365 days) - quarterly/annual reviews
- **Policy documents**: Annual validity - version controlled

### Artifact Storage
Evidence artifacts use S3 URI pattern:
```
s3://securebase-evidence/{customer}/{framework}/{control-id}-{artifact-name}.{ext}
```

## Troubleshooting

### "namespace table already exists"
This is normal - the script creates a temp table for UUID generation.

### "duplicate key value violates unique constraint"
Seed data uses `ON CONFLICT DO NOTHING` - safe to re-run.

### "customer_id does not exist"
Ensure customers are created first - the script handles order automatically.

### Evidence validation errors
Check that all ENUM types exist:
```sql
SELECT typname FROM pg_type WHERE typname LIKE 'evidence%';
```

## Contributing

When adding new seed data:
1. Use `uuid_generate_v5()` for deterministic UUIDs
2. Add realistic metadata with raw facts
3. Maintain tier-based scaling patterns
4. Include audit trail (created_by, reviewed_by)
5. Update summary statistics in script
6. Document new evidence controls

## License

Internal SecureBase project - all rights reserved.
