# SecureBase PaaS - Onboarding Issues & Gap Analysis

> This document tracks issues discovered during customer onboarding simulations
> and gaps between the designed system and operational reality.

---

## Current Status: Pre-Launch (No Deployments Yet)

**Test Customer:** ACME Finance Inc (Fintech tier, SOC2)
**Status:** Configuration complete, simulation script ready, awaiting terraform apply
**Last Updated:** 2026-01-19

---

## Critical Path Issues (Blocking Launch)

### ❓ Issue #1: Email Format for AWS Accounts

**Severity:** Medium | **Status:** Under Investigation

**Problem:**
The terraform code generates customer account emails using:
```hcl
email = "${each.value.prefix}@${data.aws_caller_identity.current.account_id}.aws-internal"
```

This creates emails like: `acme@731184206915.aws-internal`

AWS Organizations requires valid, routable email addresses. `.aws-internal` domains don't exist.

**Impact:**
- Account creation may fail with "Invalid email format"
- Could block all customer provisioning

**Proposed Solutions:**

**Option A: Use Subdomain (RECOMMENDED)**
```hcl
email = "${each.value.prefix}.customer@securebase.aws"
```
- Requires purchasing `securebase.aws` domain
- Set up catch-all mail handler for notifications
- Cost: ~$12/year for domain

**Option B: Use Customer-Provided Email**
```hcl
email = each.value.contact_email  # Add to client config
```
- Requires adding `contact_email` to each client config
- Uses real customer email for AWS account
- Better for notifications
- Requires validation that email is monitored

**Option C: Use Shared Organization Email**
```hcl
email = "aws+${each.value.prefix}@securebase.com"
```
- Requires SecureBase.com email infrastructure
- All account notifications go to single email
- May miss customer-specific alerts

**Recommendation:** 
Implement **Option B** - require customer email. Store as `contact_email` in client config:
```hcl
clients = {
  "acme-finance" = {
    tier            = "fintech"
    account_id      = "222233334444"
    contact_email   = "john@acmefinance.com"  # ← ADD THIS
    ...
  }
}
```

**Next Steps:**
- [ ] Decide on email strategy with user
- [ ] Update terraform main.tf
- [ ] Update client.auto.tfvars template
- [ ] Test with real deployment

---

### ❓ Issue #2: AWS Account IDs - Who Allocates Them?

**Severity:** Medium | **Status:** Under Investigation

**Problem:**
Current terraform requires customers to pre-generate account IDs:
```hcl
"acme-finance" = {
  account_id = "222233334444"  # ← Where does this come from?
}
```

AWS Organizations doesn't let you choose account IDs - they're auto-generated.

**Options:**

**Option A: Leave Blank, Let AWS Assign (RECOMMENDED)**
- Customer config has no account_id
- Terraform creates account, gets ID from AWS
- Update config with real ID after creation
- Problem: Human manual step needed

```hcl
"acme-finance" = {
  account_id = null  # AWS assigns this
}
```

**Option B: Pre-Allocate from AWS**
- Have admin manually create accounts in AWS
- Record their IDs
- Customer provides the account_id in config
- Problem: Two-step process, error-prone

**Option C: Use Terraform `local_exec` Provisioner**
- Automatically query AWS to get generated account ID
- Store in state file
- Problem: Complex, potential race conditions

**Recommendation:**
Implement **Option A**. Terraform can:
1. Create account without specifying ID
2. Capture generated ID automatically
3. Store in tfstate
4. Customers never see this detail

**Code Change:**
```hcl
resource "aws_organizations_account" "clients" {
  for_each = var.clients
  name     = each.value.prefix
  email    = each.value.contact_email
  
  # account_id is auto-generated; no need to specify
  # AWS will assign a unique ID
}

output "customer_account_ids" {
  value = {
    for k, v in aws_organizations_account.clients : k => v.id
  }
  description = "Auto-generated AWS account IDs per customer"
}
```

**Next Steps:**
- [ ] Verify AWS Organizations auto-generates IDs
- [ ] Update terraform to not require pre-allocated IDs
- [ ] Document that account IDs are assigned after `terraform apply`
- [ ] Test with real deployment

---

### ⚠️ Issue #3: Multi-Tenant Database Schema Not Designed

**Severity:** High | **Status:** Blocking Phase 2

**Problem:**
v0.2 roadmap assumes PostgreSQL database with Row-Level Security (RLS), but:
- No schema design document exists
- Multi-tenancy isolation strategy unclear
- Audit logging requirements unknown
- Billing/usage tracking schema not defined

**Impact:**
- Phase 2 (database work) can't start without this
- Risk of late-stage schema redesign
- Compliance audit trails may be incomplete

**Proposed Solution:**
Create pre-Phase 2 design document covering:
1. **Multi-tenant schema** - How is data isolated per customer?
2. **Audit logging** - What compliance events must be logged?
3. **Usage tracking** - How is usage metered for billing?
4. **Performance** - How to query across 1000s of customers?
5. **Backup/recovery** - How to recover single customer's data?

**Database Design Doc Contents:**
```
## Tables

customers (tenant_id, name, tier, account_id, framework)
audit_log (id, tenant_id, event_type, resource_id, user_id, timestamp)
usage_events (id, tenant_id, service, quantity, timestamp)
invoice_line_items (id, tenant_id, invoice_date, service, quantity, cost)

## Row-Level Security (RLS)

Enable per table:
  - Customers can only see their own data
  - Admins can see all data
  - Audit log is append-only (no updates/deletes)

## Compliance Requirements

### SOC2 Type II
  - Track all data access (who, when, what)
  - Immutable audit log (no deletion)
  - Retention: 7 years

### HIPAA (Healthcare)
  - Separate schema for healthcare customers
  - Additional encryption at rest
  - Data residency requirements

### FedRAMP (Gov)
  - Encryption in transit (TLS 1.3)
  - Specific RDS instance type (dedicated)
  - Cloudtrail logging to gov-approved endpoint

## Backup & Disaster Recovery

- Daily snapshots (automated)
- Geo-redundant replica (cross-region)
- RTO: 4 hours
- RPO: 1 hour
```

**Next Steps:**
- [ ] Create DATABASE_DESIGN.md document
- [ ] Include schema diagrams (ERD)
- [ ] Review with compliance team
- [ ] Finalize before Phase 2 starts

---

## Operational Issues (Found During Simulation)

### 🔧 Issue #4: Terraform State Backend Not Configured for Production

**Severity:** High | **Status:** Discovered During Simulation

**Problem:**
Current terraform uses local state:
```hcl
# terraform.tfstate sits on developer's laptop
# NOT suitable for multi-user, production use
```

This breaks multi-team workflows:
- Team member A applies customer 1 → state file updated
- Team member B applies customer 2 → conflicts with A's state
- No audit trail of who made what change
- Team member's laptop dies → state is lost

**Impact:**
- Production deployment will fail immediately if 2 people deploy simultaneously
- No recovery mechanism
- Risk of data corruption

**Solution:**
Enable S3 + DynamoDB remote state backend:

**Code:**
In `landing-zone/main.tf`, uncomment:
```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration
  backend "s3" {
    bucket           = "securebase-terraform-state"
    key              = "production/terraform.tfstate"
    region           = "us-east-1"
    encrypt          = true
    dynamodb_table   = "securebase-terraform-locks"
  }
}
```

**Setup Steps:**
```bash
# 1. Create S3 bucket for state
aws s3api create-bucket \
  --bucket securebase-terraform-state \
  --region us-east-1

# 2. Enable versioning (for recovery)
aws s3api put-bucket-versioning \
  --bucket securebase-terraform-state \
  --versioning-configuration Status=Enabled

# 3. Enable encryption
aws s3api put-bucket-encryption \
  --bucket securebase-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# 4. Create DynamoDB table for locks
aws dynamodb create-table \
  --table-name securebase-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
```

**Cost Impact:**
- S3: ~$0.50/month (state files very small)
- DynamoDB: ~$1/month (minimal usage)

**Next Steps:**
- [ ] Create S3 + DynamoDB backend BEFORE first production deploy
- [ ] Update terraform backend config
- [ ] Initialize with new backend
- [ ] Verify team can see same state

---

### 🔧 Issue #5: No Cost Alerts or Budget Controls

**Severity:** Medium | **Status:** Identified During Planning

**Problem:**
Current setup has:
- ✅ Expected cost estimates ($180/month base + customer usage)
- ❌ No AWS Budget alerts
- ❌ No cost anomaly detection
- ❌ No per-customer cost tracking

**Impact:**
- If something misconfigures and costs spike to $10k/month, you won't know for 30 days
- Customers don't know their monthly costs until invoice
- Hard to hit revenue targets

**Solution:**
Implement AWS Budgets + Cost Explorer:

```hcl
# In modules/logging/main.tf or new modules/billing/main.tf

resource "aws_budgets_budget" "monthly_infrastructure" {
  name       = "SecureBase-Infrastructure-Monthly"
  budget_type = "COST"
  limit_unit  = "USD"
  limit_amount = "500"  # Alert if spending exceeds $500/month
  time_period_start = "2026-01-01"
  time_period_end   = "2099-12-31"
  time_unit   = "MONTHLY"

  notification {
    comparison_operator = "GREATER_THAN"
    notification_type   = "ACTUAL"
    threshold           = 80
    threshold_type      = "PERCENTAGE"
    
    subscriber_email_addresses = ["devops@securebase.com"]
  }
}

resource "aws_budgets_budget" "per_customer" {
  for_each = var.clients
  
  name       = "Customer-${each.value.prefix}-Monthly"
  budget_type = "COST"
  limit_unit  = "USD"
  limit_amount = each.value.tier == "healthcare" ? "20000" : each.value.tier == "fintech" ? "10000" : "3000"
  
  time_unit = "MONTHLY"
  
  notification {
    comparison_operator = "GREATER_THAN"
    notification_type   = "FORECASTED"
    threshold           = 100
    threshold_type      = "PERCENTAGE"
    
    subscriber_email_addresses = [each.value.contact_email]
  }
}
```

**Also Enable:**
- AWS Cost Anomaly Detection (ML-based alerts)
- Reserved Instances recommendations
- Savings Plan recommendations

**Next Steps:**
- [ ] Create billing/cost-controls module
- [ ] Deploy budgets before first customer
- [ ] Set up Slack webhook for cost alerts
- [ ] Create cost dashboard for CEO

---

### 🔧 Issue #6: Compliance Scanning Automation Undefined

**Severity:** Medium | **Status:** Design Needed

**Problem:**
Onboarding checklist includes "Run SOC2 baseline assessment" but:
- No tooling defined (AWS Config? Third-party?)
- No automation (manual review? Auto-fix?)
- No remediation workflow
- No report generation

**Impact:**
- Compliance scoring will be manual, slow
- Scalability broken (100 customers = 100 manual assessments)
- Inconsistent compliance reporting

**Solution:**
Define compliance automation framework:

**Option 1: AWS Config Rules (Native)**
- Use AWS Config to continuously evaluate compliance
- Custom rules for SecureBase policies
- Reports auto-generated
- Cost: ~$2/rule/account/month

**Option 2: Third-Party Tool (Prowler/ScoutSuite)**
- Prowler: Open source, AWS-native
- ScoutSuite: Multi-cloud
- More detailed security assessment
- Requires team to maintain

**Option 3: Hybrid (RECOMMENDED)**
- AWS Config for infrastructure compliance
- Prowler for security assessment
- Custom lambda for SecureBase-specific checks
- Auto-remediation for non-critical issues

**Recommendation:**
Start with **AWS Config** + basic rules:
```hcl
# Check: S3 encryption enabled
resource "aws_config_config_rule" "s3_encryption" {
  name = "s3-bucket-server-side-encryption-enabled"
  
  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED"
  }
  
  scope {
    compliance_resource_types = ["AWS::S3::Bucket"]
  }
}

# Check: CloudTrail enabled
resource "aws_config_config_rule" "cloudtrail_enabled" {
  name = "cloudtrail-enabled"
  
  source {
    owner             = "AWS"
    source_identifier = "CLOUD_TRAIL_ENABLED"
  }
}
```

**Next Steps:**
- [ ] Select compliance scanning tool
- [ ] Create AWS Config rule set for each tier
- [ ] Define auto-remediation policies
- [ ] Create compliance reporting template
- [ ] Test with ACME Finance deployment

---

## Scalability Issues (Long-term, Post-Launch)

### ⚠️ Issue #7: Organizational Unit Hierarchy Unclear at Scale

**Severity:** Low | **Status:** Design Needed for 50+ Customers

**Problem:**
Current design:
```
Organization Root
├── Customers-Fintech OU
├── Customers-Healthcare OU
├── Customers-Fintech OU
├── Customers-Standard OU
```

At 100 customers:
- Flat structure becomes unwieldy
- Hard to find specific customer
- OU policy management becomes complex
- Audit scope is too broad

**Better Structure (for 100+ customers):**
```
Organization Root
├── Customers
│   ├── Healthcare
│   │   ├── Premium (HIPAA-full)
│   │   └── Standard (HIPAA-lite)
│   ├── Fintech
│   │   ├── Premium (SOC2-Type2)
│   │   └── Standard (SOC2-Type1)
│   ├── Government
│   │   └── FedRAMP-Moderate
│   └── Other
│       ├── Standard-CIS
│       └── Legacy
└── Production (SecureBase internal)
```

**Next Steps:**
- [ ] Redesign OU hierarchy for 100 customers
- [ ] Plan migration path from flat to hierarchical
- [ ] Test with second/third customer

---

## Summary: Issues by Priority

| Priority | Issue | Status | Owner |
|----------|-------|--------|-------|
| 🔴 HIGH | Email format for AWS accounts | Investigation | Need decision |
| 🔴 HIGH | Account IDs allocation | Investigation | Need decision |
| 🔴 HIGH | Terraform state backend (not remote) | Identified | DevOps |
| 🟡 MEDIUM | Database schema not designed | Blocked | DB Team |
| 🟡 MEDIUM | Compliance automation undefined | Design | DevOps |
| 🟡 MEDIUM | Cost alerts not configured | Identified | Finance |
| 🟢 LOW | OU hierarchy at scale | Future | DevOps |

---

## Next Steps

1. **Before First Deployment:**
   - [ ] Resolve email format issue (Issue #1)
   - [ ] Resolve account ID allocation (Issue #2)
   - [ ] Set up remote state backend (Issue #4)
   - [ ] Implement cost alerts (Issue #5)

2. **After First Deployment:**
   - [ ] Verify no issues with ACME Finance
   - [ ] Document lessons learned
   - [ ] Refine onboarding process

3. **Before Phase 2 (API Development):**
   - [ ] Complete database schema design (Issue #3)
   - [ ] Implement compliance automation (Issue #6)
   - [ ] Plan OU hierarchy for scale (Issue #7)

---

**Document Owner:** DevOps Lead
**Last Updated:** 2026-01-19
**Review Cadence:** After each customer deployment
