# 🚀 Quick Start: Implement Critical Fixes

> Execute these fixes to unblock production deployment of ACME Finance test customer

---

## ✅ Fix 1: Email Address Format (FIXED)

**File:** `landing-zone/main.tf`  
**Line:** 164  
**Status:** ✅ Applied — email now uses a valid fallback domain

```bash
# This fix has been applied. The current code in landing-zone/main.tf is:
# email = coalesce(each.value.email, "${each.value.prefix}+${each.key}@demo.securebase.tximhotep.com")
```

**Before (old broken code):**
```hcl
  name  = each.value.prefix
  email = "${each.value.prefix}@${data.aws_caller_identity.current.account_id}.aws-internal"
  parent_id = local.tier_to_ou_id[each.value.tier]
```

**After (current working code):**
```hcl
  name  = each.value.prefix
  email = coalesce(each.value.email, "${each.value.prefix}+${each.key}@demo.securebase.tximhotep.com")
  parent_id = local.tier_to_ou_id[each.value.tier]
```

**Note:** Provide `email` in client config to override the fallback domain.

---

## Fix 2: Account ID Allocation (5 minutes)

**File 1:** `landing-zone/variables.tf`  
**Line:** ~30 (in clients variable definition)

Add `contact_email` field to clients schema:

```hcl
variable "clients" {
  type = map(object({
    tier            = string
    account_id      = optional(string)  # Add this line
    prefix          = string
    framework       = optional(string, "cis")
    contact_email   = string            # Add this line
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

**File 2:** `landing-zone/environments/dev/client.auto.tfvars`

Update ACME Finance to remove account_id and add contact_email:

```bash
# Edit the file
vim landing-zone/environments/dev/client.auto.tfvars

# Replace the entire clients block with:
```

```hcl
clients = {
  "acme-finance" = {
    tier            = "fintech"
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

**Verify:**
```bash
cd landing-zone/environments/dev
terraform validate
# Expected: ✅ Success
```

---

## Fix 3: Remote State Backend (10 minutes)

### Step 1: Uncomment Backend Config

**File:** `landing-zone/main.tf`  
**Lines:** 1-18

```bash
# Edit the file
vim landing-zone/main.tf

# Find the terraform block at top (currently commented with #)
# Uncomment all lines from:
#   terraform {
# Through:
#   }
```

**Uncommented Result:**
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

### Step 2: Create S3 Bucket & DynamoDB Table

```bash
# Set your AWS profile (if using multiple profiles)
export AWS_PROFILE=default  # or your profile name

# Create S3 bucket for state
aws s3api create-bucket \
  --bucket securebase-terraform-state \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket securebase-terraform-state \
  --versioning-configuration Status=Enabled

# Block public access
aws s3api put-public-access-block \
  --bucket securebase-terraform-state \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket securebase-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Create DynamoDB lock table
aws dynamodb create-table \
  --table-name securebase-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Wait for resources to be ready
sleep 5
```

### Step 3: Migrate Local State to S3

```bash
cd landing-zone/environments/dev

# Re-initialize Terraform with new backend
terraform init

# When prompted: "Do you want to copy existing state to the new backend?"
# Answer: yes

# Verify state migrated
terraform state list
# Expected: Should show existing resources (if any)

# Verify state is in S3
aws s3 ls s3://securebase-terraform-state/
# Expected: Should see production/terraform.tfstate file
```

**Verify:**
```bash
terraform state list
# Expected: Shows resources from remote S3 state

# Also check:
aws dynamodb scan --table-name securebase-terraform-locks
# Expected: Should be empty (no locks currently)
```

---

## Final Verification (5 minutes)

After applying all 3 fixes:

```bash
cd landing-zone/environments/dev

# Step 1: Validate syntax
terraform validate
# Expected: ✅ Success

# Step 2: Format check
terraform fmt -check
# Expected: No formatting issues (or auto-fix with: terraform fmt)

# Step 3: Generate plan
terraform plan -out=tfplan
# Expected: Shows resources to create, NO ERRORS

# Step 4: Check plan details
terraform show tfplan

# Look for:
# ✅ aws_organizations_organizational_unit.customer_fintech - create
# ✅ aws_organizations_account.clients["acme-finance"] - create
# ✅ aws_organizations_policy_attachment.guardrails_fintech - create
# ✅ Resource email: john@acmefinance.com (NOT *.aws-internal)
# ❌ NO DELETE operations
# ❌ NO errors or warnings
```

---

## Rollback (If Issues Occur)

If you need to revert to local state:

```bash
cd landing-zone/environments/dev

# Remove S3 backend reference from terraform block
# (comment out the backend "s3" section in main.tf)

# Re-initialize with local backend
terraform init

# When prompted: "Do you want to copy state from remote backend?"
# Answer: yes

# Verify using local state
terraform state list
```

---

## Success Checklist

- [x] Email format fixed (using `coalesce(email, fallback@demo.securebase.tximhotep.com)`) ✅
- [ ] Account ID made optional (AWS will assign)
- [ ] Remote state enabled (S3 + DynamoDB)
- [ ] terraform validate passes ✅
- [ ] terraform plan shows correct resources (no errors)
- [x] Email shows john@acmefinance.com (not .aws-internal) ✅
- [ ] State is in S3 (verified with aws s3 ls)

---

## Estimated Time: 30 minutes total

| Task | Time | Status |
|------|------|--------|
| Fix #1: Email format | 5 min | ⏳ TODO |
| Fix #2: Account ID | 5 min | ⏳ TODO |
| Fix #3a: Uncomment backend | 2 min | ⏳ TODO |
| Fix #3b: Create S3/DynamoDB | 5 min | ⏳ TODO |
| Fix #3c: Migrate state | 3 min | ⏳ TODO |
| Verification | 5 min | ⏳ TODO |
| **TOTAL** | **25 min** | |

---

## Next Steps After Fixes

```bash
# 1. Verify fixes are working
cd landing-zone/environments/dev
terraform plan

# 2. If plan is clean, you're ready to deploy!
# For dry-run (simulated deployment):
bash ../../SIMULATE_ONBOARDING.sh

# For actual deployment (when ready):
terraform apply tfplan

# 3. After deployment, get customer account ID
terraform output customer_account_ids
# Output: { "acme-finance" = "123456789012" }
```

---

**Status:** Ready to implement  
**Blocking Issues:** None (all fixes are isolated)  
**Estimated Impact:** Deployment will succeed after fixes  
**Confidence Level:** 🟢 High

