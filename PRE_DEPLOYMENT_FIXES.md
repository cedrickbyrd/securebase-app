# SecureBase PaaS - Pre-Deployment Fixes

> Issues identified during onboarding simulation that MUST be fixed before
> first production deployment.

---

## Fix #1: AWS Account Email Address Format ⚠️ CRITICAL

**File:** `landing-zone/main.tf` (Line 143)

**Current Code (BROKEN):**
```hcl
email = "${each.value.prefix}@${data.aws_caller_identity.current.account_id}.aws-internal"
# Generates: acme@731184206915.aws-internal ❌ INVALID
```

**Problem:**
AWS Organizations requires valid, routable email addresses. The `.aws-internal` domain doesn't exist and will cause account creation to fail.

**Solution: Use Customer Email from Config**

**Step 1: Update variable schema** in `landing-zone/variables.tf`

Add `contact_email` field to clients variable:
```hcl
variable "clients" {
  type = map(object({
    tier            = string
    account_id      = optional(string)  # Optional; AWS will assign
    prefix          = string
    framework       = optional(string, "cis")
    contact_email   = string            # ← ADD THIS
    tags            = optional(map(string), {})
  }))
  
  validation {
    condition = alltrue([
      for c in values(this) : 
      can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", c.contact_email))
    ])
    error_message = "All clients must have valid contact_email addresses"
  }
}
```

**Step 2: Update terraform code** in `landing-zone/main.tf`

Replace line 143:
```hcl
# BEFORE:
email = "${each.value.prefix}@${data.aws_caller_identity.current.account_id}.aws-internal"

# AFTER:
email = each.value.contact_email
```

**Step 3: Update client configuration** in `landing-zone/environments/dev/client.auto.tfvars`

Update ACME Finance example:
```hcl
clients = {
  "acme-finance" = {
    tier            = "fintech"
    account_id      = "222233334444"    # ← Currently placeholder
    prefix          = "acme"
    framework       = "soc2"
    contact_email   = "john@acmefinance.com"  # ← ADD THIS
    tags = {
      Customer     = "ACME Finance Inc"
      Tier         = "Fintech"
      Framework    = "SOC2"
      ContactEmail = "john@acmefinance.com"
      OnboardedOn  = "2026-01-19"
    }
  }
}
```

**Benefits:**
✅ Uses real customer email for AWS notifications  
✅ Eliminates invalid domain error  
✅ Customers get account notifications directly  
✅ Audit trail shows customer email  

**Risk Assessment:**
- Low risk - email will be provided by customer during signup
- Required for account creation to work
- Non-breaking: existing code has same field available

---

## Fix #2: AWS Account ID Allocation ⚠️ CRITICAL

**File:** `landing-zone/main.tf` (Line 142) and `landing-zone/variables.tf`

**Current Problem:**
```hcl
account_id = "222233334444"  # ← Where does customer get this?
```

Customers don't know/can't choose AWS account IDs. AWS auto-generates them.

**Solution: Let AWS Assign IDs**

**Step 1: Make account_id optional** in `landing-zone/variables.tf`

Already done in variable schema above:
```hcl
account_id = optional(string)  # ← AWS will assign if not provided
```

**Step 2: Remove account_id requirement** in `landing-zone/main.tf`

Don't require pre-allocated account IDs:
```hcl
# Customer config should NOT include account_id
clients = {
  "acme-finance" = {
    tier            = "fintech"
    # account_id omitted - AWS will assign
    prefix          = "acme"
    framework       = "soc2"
    contact_email   = "john@acmefinance.com"
    tags = { ... }
  }
}
```

**Step 3: Capture auto-assigned ID** in `landing-zone/outputs.tf`

Add output to retrieve generated account IDs:
```hcl
output "customer_account_ids" {
  description = "Auto-assigned AWS account IDs for each customer"
  value = {
    for client_key, account in aws_organizations_account.clients :
    client_key => account.id
  }
}

output "customer_details" {
  description = "Full customer account details including auto-assigned IDs"
  value = {
    for client_key, account in aws_organizations_account.clients :
    client_key => {
      aws_account_id = account.id
      aws_account_arn = account.arn
      created_date   = account.create_date
      email          = account.email
      ou_id          = account.parent_id
    }
  }
}
```

**Update ACME Finance Config:**
```hcl
clients = {
  "acme-finance" = {
    tier            = "fintech"
    # account_id field removed - AWS will assign
    prefix          = "acme"
    framework       = "soc2"
    contact_email   = "john@acmefinance.com"
    tags = {
      Customer     = "ACME Finance Inc"
      Tier         = "Fintech"
      Framework    = "SOC2"
      ContactEmail = "john@acmefinance.com"
      OnboardedOn  = "2026-01-19"
    }
  }
}
```

**After Deployment:**
```bash
# Run to see assigned account IDs
terraform output customer_account_ids

# Output:
# {
#   "acme-finance" = "987654321098"
# }
```

**Benefits:**
✅ No customer confusion about account IDs  
✅ Auto-generated IDs are guaranteed unique  
✅ Aligns with AWS best practices  
✅ Simplifies signup flow  

**Risk Assessment:**
- Low risk - standard AWS practice
- Output available immediately after `terraform apply`
- Non-breaking change

---

## Fix #3: Remote State Backend for Production ⚠️ BLOCKING

**File:** `landing-zone/main.tf` (Lines 1-18)

**Current Problem:**
```hcl
# terraform.tfstate is local file on your laptop
# Multiple teams = conflicts
# Laptop dies = data loss
# NOT suitable for production use
```

**Solution: Enable S3 + DynamoDB Remote Backend**

**Step 1: Uncomment backend configuration** in `landing-zone/main.tf`

```hcl
terraform {
  required_version = ">= 1.5.0"
  
  backend "s3" {
    bucket         = "securebase-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "securebase-terraform-locks"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

**Step 2: Create S3 bucket and DynamoDB table** (one-time setup)

```bash
# 1. Create S3 bucket
aws s3api create-bucket \
  --bucket securebase-terraform-state \
  --region us-east-1

# 2. Enable versioning (for recovery)
aws s3api put-bucket-versioning \
  --bucket securebase-terraform-state \
  --versioning-configuration Status=Enabled

# 3. Block public access
aws s3api put-public-access-block \
  --bucket securebase-terraform-state \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 4. Enable default encryption
aws s3api put-bucket-encryption \
  --bucket securebase-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# 5. Create DynamoDB lock table
aws dynamodb create-table \
  --table-name securebase-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

**Step 3: Migrate local state to S3**

```bash
cd landing-zone/environments/dev

# Initialize with new backend (will prompt to copy local state)
terraform init

# When prompted:
# Do you want to copy existing state to the new backend?
# Answer: yes

# Verify state moved
terraform state list  # Should show resources from S3 now
```

**Cost Impact:**
- S3: ~$0.01/month (state files are ~50KB)
- DynamoDB: ~$0.25/month (on-demand pricing)
- **Total: ~$0.26/month**

**Benefits:**
✅ Team collaboration (shared state)  
✅ Automatic locking (prevents conflicts)  
✅ Versioning (recovery if mistake)  
✅ Encryption at rest  
✅ Production ready  

**Risk Assessment:**
- Low risk - standard Terraform practice
- Non-breaking - team just migrates once
- State versioning prevents data loss

---

## Fix #4: Add Database Schema Design Document 📋 CRITICAL

**File:** Create `landing-zone/docs/DATABASE_DESIGN.md`

**Reason:**
Phase 2 roadmap assumes PostgreSQL with Row-Level Security (RLS), but no schema exists. This must be designed BEFORE backend development starts.

**Required Content:**
```
# Multi-Tenant Database Schema Design

## Overview
PostgreSQL with Row-Level Security (RLS) for strict customer data isolation.

## Core Tables

### customers
- tenant_id (PK, UUID)
- name (VARCHAR)
- tier (ENUM: standard, fintech, healthcare, gov-federal)
- aws_account_id (VARCHAR)
- framework (VARCHAR: cis, soc2, hipaa, fedramp)
- contact_email (VARCHAR)
- status (ENUM: active, suspended, archived)
- created_at, updated_at (TIMESTAMP)
- metadata (JSONB)

### audit_events (Compliance)
- id (PK, UUID)
- tenant_id (FK, UUID) - Immutable
- event_type (VARCHAR: resource_created, policy_attached, user_added)
- resource_type (VARCHAR)
- resource_id (VARCHAR)
- changes (JSONB - what changed)
- user_id (VARCHAR)
- user_email (VARCHAR)
- source_ip (INET)
- created_at (TIMESTAMP) - Immutable
- INDEX: (tenant_id, created_at DESC)

### usage_events (Billing)
- id (PK, UUID)
- tenant_id (FK, UUID)
- service_name (VARCHAR: Organizations, SecurityHub, GuardDuty)
- quantity (NUMERIC)
- unit (VARCHAR: accounts, findings, checks)
- recorded_at (TIMESTAMP)
- billing_month (DATE)
- INDEX: (tenant_id, billing_month, service_name)

### invoices
- id (PK, UUID)
- tenant_id (FK, UUID)
- invoice_number (VARCHAR UNIQUE)
- billing_date (DATE)
- due_date (DATE)
- total_amount (DECIMAL)
- status (ENUM: draft, sent, paid, overdue)
- created_at, updated_at (TIMESTAMP)

### invoice_line_items
- id (PK, UUID)
- invoice_id (FK, UUID)
- tenant_id (FK, UUID)
- service_name (VARCHAR)
- quantity (NUMERIC)
- unit_price (DECIMAL)
- line_total (DECIMAL)
- billing_period (DATERANGE)

## Row-Level Security (RLS)

### audit_events - Most Restrictive
- Customers can only view their own tenant_id
- Audit log is append-only (no UPDATE/DELETE)
- Admins can view all tenant audit events

### usage_events
- Customers can only see their own tenant_id
- Filter by billing_month for monthly reporting

### invoices
- Customers can see their own invoices
- Finance team can see all invoices

## Indexes (Performance)

- audit_events: (tenant_id, created_at DESC)
- usage_events: (tenant_id, billing_month DESC)
- invoices: (tenant_id, billing_date DESC)
- invoice_line_items: (invoice_id, service_name)

## Backup & Recovery

- Automated daily snapshots
- Geo-redundant replica (cross-region)
- RTO: 4 hours
- RPO: 1 hour
- 30-day retention

## Compliance Considerations

- All timestamps in UTC
- Audit log immutable (prevent tampering)
- Encryption at rest (AWS RDS encryption)
- Encryption in transit (SSL/TLS 1.3)
- No PII in audit log
```

**Next Steps:**
- [ ] Create DATABASE_DESIGN.md with full schema
- [ ] Include ERD diagram
- [ ] Get compliance team review
- [ ] Finalize before Phase 2 starts

---

## Fix #5: Implement Cost Alerts ⚠️ IMPORTANT

**File:** Create `landing-zone/modules/billing/main.tf`

**Reason:**
No budget monitoring. Undetected cost spike could hit $10k/month and go unnoticed for 30 days.

**Solution:**
```hcl
# landing-zone/modules/billing/main.tf

resource "aws_budgets_budget" "securebase_infrastructure" {
  name              = "SecureBase-Infrastructure"
  budget_type       = "COST"
  limit_unit        = "USD"
  limit_amount      = "300"  # Alert if >$300
  time_period_start = "2026-01-01"
  time_period_end   = "2099-12-31"
  time_unit         = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = ["finance@securebase.com"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "FORECASTED"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = ["finance@securebase.com"]
  }
}

resource "aws_budgets_budget" "per_customer" {
  for_each = var.clients

  name              = "Customer-${each.key}"
  budget_type       = "COST"
  limit_unit        = "USD"
  # Budget based on tier pricing + 50% buffer
  limit_amount      = each.value.tier == "healthcare" ? "22500" : 
                      each.value.tier == "fintech" ? "12000" : 
                      each.value.tier == "gov-federal" ? "37500" : "3000"
  time_period_start = "2026-01-01"
  time_period_end   = "2099-12-31"
  time_unit         = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "FORECASTED"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [each.value.contact_email]
  }
}
```

**Cost Savings:**
- Early detection of configuration errors
- Prevents surprise bills
- Customers proactively alerted
- Automatic forecasting (ML-based)

---

## Implementation Order

**Priority 1 (MUST FIX BEFORE DEPLOY):**
1. [ ] Fix #1 - Email address format
2. [ ] Fix #2 - Account ID allocation
3. [ ] Fix #3 - Remote state backend

**Priority 2 (SHOULD FIX BEFORE LAUNCH):**
4. [ ] Fix #4 - Database schema design document
5. [ ] Fix #5 - Cost alerts

---

## Testing Checklist

After applying fixes:

```bash
cd landing-zone/environments/dev

# Step 1: Validate syntax
terraform validate
# Expected: ✅ Success

# Step 2: Generate plan
terraform plan -out=tfplan
# Expected: Should show resources to create, no errors

# Step 3: Review plan output
terraform show tfplan
# Expected: Should show:
#   - OU creation (Customers-Fintech)
#   - Account creation (name: acme, email: john@acmefinance.com)
#   - Policy attachments

# Step 4: Check output
terraform output customer_account_ids
# Expected: { "acme-finance" = "123456789012" } (auto-assigned)

# Step 5: Verify state backend
cat .terraform/backends/s3.tfbackend
# Expected: Points to securebase-terraform-state S3 bucket
```

---

## Rollback Plan

If issues occur during deployment:

```bash
# See what's deployed
terraform state list

# Remove problematic resource
terraform state rm aws_organizations_account.clients["acme-finance"]

# Update config to fix issue
vi client.auto.tfvars

# Re-apply
terraform apply
```

---

**Priority:** 🔴 CRITICAL - Must fix all 3 Priority 1 items before production deploy
**Estimated Time:** 2 hours total
**Owner:** DevOps Lead
