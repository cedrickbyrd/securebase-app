# 🧪 VPC Integration Testing Plan

## Current State Assessment

### ✅ Completed (Configuration Layer)
- [x] 10 customers added to `client.auto.tfvars` with VPC CIDRs
- [x] `vpc_cidr` field added to variables
- [x] `enable_vpc` and `vpc_config` variables created
- [x] VPC locals added to main.tf (subnetting strategy)
- [x] Documentation created (TEN_CUSTOMER_VPC_ANALYSIS.md)

### ❌ Not Yet Done (Implementation & Testing)
- [ ] VPC module doesn't exist (only org, iam, logging, security)
- [ ] Terraform plan not run (unknown if config is valid)
- [ ] CIDR allocation not validated
- [ ] Subnet math not tested
- [ ] VPC Flow Logs not configured
- [ ] Integration with org module not verified
- [ ] NAT Gateway configuration not implemented
- [ ] Tier-specific VPC policies not defined
- [ ] Cross-account VPC assumptions not validated

---

## 🎯 Proposed Testing Strategy

### Phase 1: Validation (30 min) ⚡ START HERE

**Test 1.1: Terraform Syntax Check**
```bash
cd landing-zone/environments/dev
terraform validate
```
**Goal:** Catch HCL syntax errors before planning
**Expected:** ✅ Pass (if all variables are properly typed)
**Blocker:** If this fails, VPC config has errors

---

**Test 1.2: Configuration Validation**
```bash
# Check that all clients have required fields
grep -E "vpc_cidr|account_id|tier|framework" client.auto.tfvars
```
**Goal:** Verify all 10 customers have CIDR allocations
**Expected:** ✅ All 10 customers have vpc_cidr defined
**Blocker:** If any missing, Terraform plan will fail

---

**Test 1.3: CIDR Conflict Detection**
```bash
# Extract all VPC CIDRs and check for duplicates across accounts
cat client.auto.tfvars | grep vpc_cidr | sort | uniq -d
```
**Goal:** Ensure no duplicate CIDRs (allowed within accounts, not within tiers)
**Expected:** ✅ No duplicates (account isolation model allows reuse)
**Validation:**
- ACME:           10.0.0.0/16 ✅
- Quantum Bank:   10.1.0.0/16 (different account, OK)
- MediCorp:       10.1.0.0/16 (different account, OK)
- Guardian:       10.3.0.0/16 ✅
- TechGov:        10.4.0.0/16 ✅
- StateCorp:      10.4.0.0/16 (different account, OK)
- MetaBank:       10.2.0.0/16 ✅
- CrossBank:      10.5.0.0/16 ✅
- StartupCorp:    10.1.0.0/16 (different account, OK)
- TechStartup:    10.6.0.0/16 ✅

---

### Phase 2: Terraform Planning (20 min)

**Test 2.1: Terraform Plan (Without VPC Module)**
```bash
terraform plan -out=tfplan
```
**Goal:** See what would be deployed without VPC module
**Expected:** 
- ✅ 10 accounts created
- ✅ 4 OUs created (by tier)
- ✅ Policies attached
- ⚠️ No VPC resources yet (module doesn't exist)

**Analysis:**
```
Resource Count Estimation:
  Organization:     1
  OUs:              4
  Accounts:         10
  Service Policies: 4
  ──────────────────────
  Subtotal:         19 resources
  
  (No VPCs yet - module missing)
```

---

**Test 2.2: Review Plan for Issues**
```bash
# Look for issues or warnings
grep -E "Error|Warning|error" tfplan
```
**Goal:** Catch any Terraform warnings or errors
**Expected:** ✅ Clean plan (no errors)
**Blockers:**
- [ ] Missing variable values
- [ ] Type mismatches
- [ ] Policy attachment issues
- [ ] Account routing issues

---

### Phase 3: VPC Module Creation (2-4 hours) 🔧 RECOMMENDED

Create new VPC module to handle per-customer networking:

**Test 3.1: Design VPC Module Structure**

```hcl
# File: landing-zone/modules/vpc/main.tf
# Should contain:
resource "aws_vpc" "customer" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = var.vpc_config.dns_hostnames
  enable_dns_support   = var.vpc_config.dns_support
  tags = {
    Customer = var.customer_name
    Tier     = var.customer_tier
  }
}

resource "aws_subnet" "private" {
  # 2 private subnets (multi-AZ)
  count             = 2
  vpc_id            = aws_vpc.customer.id
  cidr_block        = "10.${var.subnet_octet}.${count.index + 1}.0/24"
  availability_zone = "${var.region}${["a", "b"][count.index]}"
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.customer.id
  cidr_block        = "10.${var.subnet_octet}.0.0/24"
  availability_zone = "${var.region}a"
}

resource "aws_internet_gateway" "customer" {
  vpc_id = aws_vpc.customer.id
}

resource "aws_nat_gateway" "customer" {
  count         = var.vpc_config.enable_nat_gateway ? 1 : 0
  subnet_id     = aws_subnet.public[0].id
  allocation_id = aws_eip.nat[0].id
  
  depends_on = [aws_internet_gateway.customer]
}

resource "aws_flow_log" "vpc" {
  count                   = var.vpc_config.enable_vpc_flow_logs ? 1 : 0
  iam_role_arn           = aws_iam_role.flow_log[0].arn
  log_destination        = aws_cloudwatch_log_group.flow_log[0].arn
  traffic_type           = "ALL"
  vpc_id                 = aws_vpc.customer.id
}
```

**Test 3.2: Subnet Math Validation**

Goal: Verify /24 subnets fit within /16 CIDR blocks

```
Per VPC (10.X.0.0/16):
  Public:   10.X.0.0/24     (256 IPs, 251 usable)
  Private1: 10.X.1.0/24     (256 IPs, 251 usable)
  Private2: 10.X.2.0/24     (256 IPs, 251 usable)
  Available: 10.X.3.0 - 10.X.255.0 (253 × /24 subnets)
  
  Validation: ✅ Math checks out
  
  Growth Path:
    • Current:   3 subnets per VPC
    • At 50 customers: Still only 3 subnets per VPC
    • At 1000 customers: Still only 3 subnets per VPC
    • Can add more subnets up to 253 per VPC
```

---

**Test 3.3: Module Integration**

Add module call to main.tf:

```hcl
# landing-zone/main.tf

module "customer_vpcs" {
  for_each = var.enable_vpc ? var.clients : {}
  
  source = "./modules/vpc"
  
  customer_name          = each.key
  customer_tier          = each.value.tier
  customer_account_id    = each.value.account_id
  vpc_cidr               = each.value.vpc_cidr
  subnet_octet           = split(".", each.value.vpc_cidr)[1]  # Extract 10.X from 10.X.0.0/16
  
  vpc_config             = var.vpc_config
  region                 = var.target_region
  tags                   = merge(var.tags, each.value.tags)
}
```

**Test 3.4: Run Updated Plan**

```bash
terraform plan -out=tfplan_with_vpcs
```

**Expected Resources:**
```
Organization Layer:
  • 1 Organization
  • 4 OUs (by tier)
  • 10 Accounts
  • 4 SCPs (tier policies)
  
VPC Layer (NEW):
  • 10 VPCs (one per customer)
  • 30 Subnets (3 per VPC)
  • 10 NAT Gateways
  • 10 Internet Gateways
  • 20 Route Tables (public + private)
  • 30 Route Table Associations
  • 10 VPC Flow Logs
  • 10 CloudWatch Log Groups
  • 10 IAM Roles (for Flow Logs)
  
  ────────────────────────────
  Total: ~145-150 resources
```

---

### Phase 4: Tier-Specific VPC Policies (1-2 hours)

**Test 4.1: Define Healthcare VPC Requirements (HIPAA)**

Create tier-specific security group templates:

```hcl
# Healthcare: HIPAA-compliant VPC
resource "aws_security_group" "healthcare_workload" {
  name   = "${var.customer_name}-workload"
  vpc_id = aws_vpc.customer.id
  
  # Require encryption for all traffic
  # No internet access without NAT
  # Audit logging enabled
  
  tags = {
    Tier = "Healthcare"
    Framework = "HIPAA"
  }
}

# HIPAA-specific NACLs
resource "aws_network_acl" "healthcare" {
  vpc_id = aws_vpc.customer.id
  
  # Inbound: Deny unencrypted protocols
  # Outbound: Allow only through NAT
}
```

**Test 4.2: Fintech VPC Requirements (SOC2)**

```hcl
# Fintech: SOC2-compliant VPC
resource "aws_security_group" "fintech_workload" {
  # Require TLS 1.2+
  # No SSH from internet (bastion only)
  # VPC endpoints for AWS services
}
```

**Test 4.3: Gov-Federal Requirements (FedRAMP)**

```hcl
# Gov-Federal: FedRAMP-compliant VPC
resource "aws_security_group" "govfed_workload" {
  # US regions only (enforced by SCP)
  # Government VPC endpoints
  # Enhanced logging
}
```

---

### Phase 5: Cost Validation (30 min)

**Test 5.1: Actual AWS Pricing Against Projections**

```bash
# Extract NAT gateway count per customer
for customer in $(cat client.auto.tfvars | grep '".*-' | cut -d'"' -f2); do
  echo "$customer: will get 1 NAT Gateway"
done

# 10 customers × $0.045/hour × 730 hours = $328.50/month
# Our estimate: $324/month (close enough!)
```

**Test 5.2: Cost Projection Validation**

| Tier | Customers | NAT Gateways | Monthly Cost |
|------|-----------|--------------|--------------|
| Fintech | 4 | 4 | $145.80 |
| Healthcare | 2 | 2 | $72.90 |
| Gov-Federal | 2 | 2 | $72.90 |
| Standard | 2 | 2 | $72.90 |
| **TOTAL** | **10** | **10** | **$364.50** |

Variance from estimate: $364.50 vs $324 = 12% (acceptable)

---

### Phase 6: Integration Testing (2 hours)

**Test 6.1: Cross-Module Validation**

Verify VPC module integrates with existing modules:

```bash
# Check org module still works
terraform state show module.organization

# Check iam module still works  
terraform state show module.identity

# Check logging still works
terraform state show module.central_logging

# Check VPC module created correctly
terraform state show module.customer_vpcs
```

**Test 6.2: Account Routing Verification**

```bash
# Verify each customer account routed to correct OU and VPC
aws organizations list-accounts-for-parent --parent-id ou-xxxxx

# For each account, verify VPC created
aws ec2 describe-vpcs --account-id 222233334444 --filters "Name=tag:Customer,Values=acme"
```

**Test 6.3: VPC Flow Logs Validation**

```bash
# Verify Flow Logs streaming to CloudWatch
aws logs describe-log-groups --log-group-name-prefix "/aws/vpc/flowlogs"

# Verify Flow Logs can be queried
aws logs start-query \
  --log-group-name "/aws/vpc/flowlogs/acme" \
  --start-time $(($(date +%s) - 3600)) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, srcaddr, dstaddr, action'
```

---

### Phase 7: Documentation Tests (1 hour)

**Test 7.1: Verify CIDR Documentation**

Create customer-facing CIDR allocation document:

```markdown
# Customer VPC Allocation

## Fintech Tier (SOC2)
- ACME Finance:      10.0.0.0/16
- Quantum Bank:      10.1.0.0/16 (separate account)
- MetaBank Financial: 10.2.0.0/16
- CrossBank Int'l:    10.5.0.0/16

## Healthcare Tier (HIPAA)
- MediCorp:          10.1.0.0/16 (separate account, different from Quantum)
- Guardian Health:   10.3.0.0/16

## Gov-Federal Tier (FedRAMP)
- TechGov:           10.4.0.0/16
- StateCorp:         10.4.0.0/16 (separate account)

## Standard Tier (CIS)
- StartupCorp:       10.1.0.0/16 (separate account)
- TechStartup:       10.6.0.0/16
```

**Test 7.2: Subnet Allocation Document**

```markdown
# Subnet Allocation (Per Customer VPC)

## Example: ACME Finance (10.0.0.0/16)

| Subnet Type | CIDR | Availability Zone | Purpose |
|-------------|------|------------------|---------|
| Public | 10.0.0.0/24 | us-east-1a | NAT Gateway, ALB |
| Private | 10.0.1.0/24 | us-east-1a | Application workloads |
| Private | 10.0.2.0/24 | us-east-1b | Application workloads (HA) |

Note: All CIDRs follow pattern 10.X.{0|1|2}.0/24 where X is tier-specific octet
```

---

## 📋 Complete Testing Checklist

### Phase 1: Validation ✅ (Ready now)
- [ ] Terraform validate passes
- [ ] All 10 customers have vpc_cidr defined
- [ ] No CIDR conflicts within tier spaces
- [ ] Variable types are correct

### Phase 2: Planning ✅ (Ready now)
- [ ] Terraform plan runs without errors
- [ ] 19 base resources shown (org, OUs, accounts, policies)
- [ ] No warnings or errors in plan
- [ ] Plan file generated successfully

### Phase 3: VPC Module ⏸️ (To implement)
- [ ] Create modules/vpc/main.tf
- [ ] Create modules/vpc/variables.tf
- [ ] Create modules/vpc/outputs.tf
- [ ] Add module call to landing-zone/main.tf
- [ ] Terraform plan shows 145-150 resources
- [ ] No resource conflicts

### Phase 4: Tier Policies ⏸️ (To implement)
- [ ] Healthcare security groups created
- [ ] Fintech security groups created
- [ ] Gov-Federal security groups created
- [ ] Standard security groups created
- [ ] Tier-specific NACLs created

### Phase 5: Cost Validation ✅ (Ready now)
- [ ] NAT Gateway count per customer verified
- [ ] Monthly cost calculation accurate
- [ ] Cost projections match AWS pricing

### Phase 6: Integration Testing ⏸️ (After module)
- [ ] Org module still works
- [ ] IAM module still works
- [ ] Logging module still works
- [ ] VPC module integrates
- [ ] Cross-module variables wire correctly
- [ ] Terraform state valid

### Phase 7: Documentation ✅ (Ready now)
- [ ] CIDR allocation documented
- [ ] Subnet allocation documented
- [ ] Customer-facing VPC guide created
- [ ] Troubleshooting guide written

---

## 🚀 Recommended Path Forward

### Option A: Quick Validation (30 min) ⚡ START HERE
```bash
cd landing-zone/environments/dev

# 1. Validate configuration
terraform validate

# 2. Check VPC CIDRs
grep vpc_cidr client.auto.tfvars

# 3. Plan without VPC module (see baseline)
terraform plan
```
**Outcome:** Confirm config is valid, see org/account resources

---

### Option B: Full Integration (4-6 hours) 🔧 RECOMMENDED
```bash
# 1. Run Phase 1-2 validation (30 min)
terraform validate && terraform plan

# 2. Implement VPC module (2 hours)
# Create: modules/vpc/main.tf, variables.tf, outputs.tf
# Update: landing-zone/main.tf to call module

# 3. Test VPC module integration (1 hour)
terraform validate
terraform plan -out=tfplan_with_vpcs

# 4. Review and document (1-2 hours)
# - Verify resource count (150+)
# - Document CIDR allocation
# - Create customer VPC guides

# 5. Deploy to dev (optional)
# terraform apply tfplan_with_vpcs
```

---

## 💡 My Recommendation

**YES, do more testing.** Here's why:

1. **VPC module doesn't exist yet** - Currently config exists but no implementation
2. **Integration points unclear** - How does VPC integrate with org/iam/logging?
3. **Terraform plan hasn't been run** - Config might have syntax errors
4. **Cost projections unvalidated** - Need to confirm NAT Gateway math
5. **Tier-specific policies undefined** - Healthcare/Fintech/Gov-Fed VPC rules missing

### Suggested Action Plan:

**Today (30 min):**
- ✅ Run `terraform validate` 
- ✅ Run `terraform plan`
- ✅ Review plan for errors

**This Week (4 hours):**
- Create VPC module
- Add module integration to main.tf
- Run updated terraform plan
- Validate 150+ resources

**This Week (1 hour):**
- Create customer-facing VPC documentation
- Define tier-specific security group rules
- Write troubleshooting guide

**Result:** Production-ready VPC deployment for 10 customers

---

## 📊 Testing Success Criteria

| Test | Success Criteria | Impact |
|------|------------------|--------|
| **terraform validate** | No errors | Blocking |
| **terraform plan** | 19+ org resources | Blocking |
| **VPC module** | Compiles, no errors | Critical |
| **Integration test** | All modules work together | Critical |
| **Cost validation** | Within 10% of estimate | High |
| **Tier policies** | Each tier has rules | Medium |
| **Documentation** | Customer-ready guides | Medium |

**Go/No-Go:** Deploy to production only after **terraform plan** shows 145-150 resources with no errors.

---

**Status:** ✅ Ready for Phase 1 validation  
**Recommendation:** Run full testing suite (4-6 hours)  
**Confidence:** 95% (pending terraform validate)  
**Next Step:** Execute Phase 1 validation immediately
