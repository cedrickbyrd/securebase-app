# SecureBase: Quick Commands & Automation

## 🏃 QUICK START: Test Plan & Deploy

### **Test Terraform Plan (Safe - No Changes)**

```bash
# 1. Navigate to Terraform directory
cd landing-zone/environments/dev

# 2. Initialize (one-time)
terraform init

# 3. Validate configuration
terraform validate

# 4. Generate plan (shows what WILL change)
terraform plan -out=tfplan

# 5. Show plan details
terraform show tfplan

# 6. Count resources (optional)
terraform show tfplan -json | jq '.resource_changes | length'
```

**✅ Result:** Plan file created, no infrastructure changed

---

### **Apply Plan (Creates Resources)**

```bash
# Dry-run first (always!)
terraform plan -out=tfplan

# Review the output carefully, then:
terraform apply tfplan

# Monitor progress in CloudFormation console
```

**⚠️ First time may take 10-15 minutes**

---

### **Destroy Resources (Cleanup)**

```bash
# List what will be destroyed
terraform plan -destroy

# Destroy (requires approval)
terraform destroy
```

---

## 🤖 AUTOMATED CUSTOMER ONBOARDING

### **One-Command Customer Setup**

```bash
# Make script executable
chmod +x scripts/onboard-customer.sh

# Onboard a new customer (interactive plan-only mode)
./scripts/onboard-customer.sh \
  --name "ACME Finance Inc" \
  --tier fintech \
  --framework soc2 \
  --email billing@acme.com \
  --plan-only

# Full onboarding (creates infrastructure)
./scripts/onboard-customer.sh \
  --name "ACME Finance Inc" \
  --tier fintech \
  --framework soc2 \
  --email billing@acme.com
```

**Output includes:**
- ✅ AWS Organization created
- ✅ VPC with NAT gateway
- ✅ API key generated
- ✅ Database records created
- ✅ Welcome email template
- ✅ IAM setup script

---

## 📊 MONITORING THE PLAN

### **View Plan in Terraform Format**

```bash
# Human-readable diff
terraform show tfplan

# Show only resource additions (clean)
terraform show tfplan | grep "# " | head -20

# Count by type
terraform show tfplan -json | jq '.resource_changes[] | {type: .type, actions: .change.actions}'
```

### **View Plan in JSON (Programmatic)**

```bash
# Full JSON (for parsing)
terraform show tfplan -json > plan.json

# Count total resources
jq '.resource_changes | length' plan.json

# Find specific resource
jq '.resource_changes[] | select(.type=="aws_rds_cluster")' plan.json

# Extract outputs
jq '.resource_changes[] | {type, address: .address}' plan.json
```

---

## 🔄 BATCH ONBOARDING (Multiple Customers)

### **CSV-Based Batch Onboarding**

Create `customers.csv`:
```csv
Name,Tier,Framework,Email
ACME Finance,fintech,soc2,billing@acme.com
MediCorp Health,healthcare,hipaa,billing@medicorp.com
TechGov Federal,gov-federal,fedramp,billing@techgov.com
StartupCo,standard,cis,billing@startup.com
```

Run batch script:
```bash
# Make executable
chmod +x scripts/batch-onboard.sh

# Execute batch
./scripts/batch-onboard.sh customers.csv
```

---

## 📝 STEP-BY-STEP: Manual Onboarding (If Scripts Fail)

### **Step 1: Update Terraform Config**

Edit: `landing-zone/environments/dev/client.auto.tfvars`

Add customer:
```hcl
"acme-finance" = {
  tier      = "fintech"
  framework = "soc2"
  prefix    = "acme"
  vpc_cidr  = "10.1.0.0/16"
  tags = {
    Customer = "ACME Finance"
    Tier     = "fintech"
  }
}
```

### **Step 2: Plan**

```bash
cd landing-zone/environments/dev
terraform plan -out=tfplan
```

### **Step 3: Review & Apply**

```bash
# Review carefully
terraform show tfplan | less

# Apply
terraform apply tfplan
```

### **Step 4: Capture Outputs**

```bash
# Get organization ID
terraform output organization_id

# Get customer OUs
terraform output customer_ou_ids

# Get VPC IDs
terraform output -json | jq '.customer_vpcs'
```

### **Step 5: Create Database Records**

```bash
# Connect to Aurora
psql -h <RDS_PROXY_ENDPOINT> -U adminuser -d securebase

# Insert customer
INSERT INTO customers (name, tier, framework, aws_org_id, email, status)
VALUES ('ACME Finance', 'fintech', 'soc2', 'o-xxxxx', 'billing@acme.com', 'active');

# Generate API key (in app or manually)
```

---

## 🧪 TEST SCENARIOS

### **Scenario 1: Test Single Customer Onboarding**

```bash
./scripts/onboard-customer.sh \
  --name "Test Customer" \
  --tier standard \
  --framework cis \
  --email test@example.com \
  --plan-only
```

Expected: Plan shows ~50 resources

### **Scenario 2: Test Plan Without Apply**

```bash
cd landing-zone/environments/dev
terraform plan -out=tfplan
terraform show tfplan | grep "Plan:" # See resource counts
```

Expected: Shows resources but doesn't create anything

### **Scenario 3: Verify Multi-Customer Isolation**

```bash
# After onboarding 2 customers:
terraform show | grep "aws_organizations_account"

# Each customer should be in separate OU
terraform show | grep "aws_organizations_organizational_unit"
```

---

## 🚨 TROUBLESHOOTING

### **Issue: "Module not found"**

```bash
# Fix: Initialize terraform
cd landing-zone/environments/dev
terraform init -upgrade
```

### **Issue: "Invalid variable"**

```bash
# Fix: Validate configuration
terraform validate

# Fix specific file:
terraform fmt -check landing-zone/variables.tf
terraform fmt landing-zone/variables.tf  # Auto-fix
```

### **Issue: "RDS already exists"**

```bash
# Check state
terraform state list | grep rds

# Import existing resource (if needed)
terraform import aws_rds_cluster.phase2_postgres securebase-phase2-dev
```

### **Issue: "VPC CIDR conflict"**

```bash
# Check existing VPC CIDRs
aws ec2 describe-vpcs --query 'Vpcs[].CidrBlock'

# Update client.auto.tfvars with unique CIDR
vim landing-zone/environments/dev/client.auto.tfvars
```

---

## 📊 PRICING: What Gets Created & What It Costs

| Resource | Count | Monthly Cost | Notes |
|----------|-------|--------------|-------|
| AWS Organization | 1 | FREE | Shared, not per-customer |
| Organizational Unit | 1 | FREE | Per customer tier |
| AWS Account | 1 | FREE | Per customer |
| VPC | 1 | $0.05 | Per customer |
| NAT Gateway | 1 | $32 | Per customer per month |
| RDS Aurora | 1 | $180 | Shared (multi-tenant) |
| DynamoDB Tables | 3 | $40 | Shared (on-demand) |
| **Total Per Customer** | | **$32-65** | Tier + infrastructure |

---

## ✅ DEPLOYMENT CHECKLIST

Before going live with a customer:

```bash
# 1. Validate configuration
terraform validate ✅

# 2. Plan infrastructure
terraform plan -out=tfplan ✅

# 3. Review plan (critical!)
terraform show tfplan | grep -c "Plan:" ✅

# 4. Apply infrastructure
terraform apply tfplan ✅

# 5. Verify outputs
terraform output -json > customer-outputs.json ✅

# 6. Create database records
psql ... < customer-db-setup.sql ✅

# 7. Generate API key
./scripts/generate-api-key.sh <CUSTOMER_ID> ✅

# 8. Send welcome email
cat welcome-email.txt | mail -s "Welcome!" admin@customer.com ✅

# 9. Run smoke tests (optional)
./scripts/test-customer-access.sh <API_KEY> ✅

# 10. Monitor CloudWatch (24 hours)
aws cloudwatch get-metric-statistics ... ✅
```

---

## 🎯 AUTOMATION ROADMAP (Future)

**Phase 1 (This Week):** ✅ Manual + Bash scripts  
**Phase 2 (Week 2):** Python automation wrapper  
**Phase 3 (Week 3):** REST API for self-service onboarding  
**Phase 4 (Week 4):** Portal UI for customer self-onboarding  

---

## 📞 SUPPORT

| Issue | Resolution |
|-------|-----------|
| Terraform errors | Run `terraform validate` and check `terraform.tfvars` |
| API key issues | Check `/tmp/api-key-*.txt` files in `/tmp/` |
| Billing incorrect | Verify usage_metrics in Aurora database |
| VPC not created | Check VPC CIDR conflicts with `aws ec2 describe-vpcs` |
| Customer can't login | Verify `customers` table in Aurora (RLS context) |

