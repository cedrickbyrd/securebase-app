# 🚀 SecureBase PaaS Deployment Guide

## Quick Start

Deploy SecureBase multi-tenant PaaS in 5 steps:

### 1. Install Prerequisites
```bash
# Install Terraform >= 1.5.0
terraform version

# Configure AWS credentials
aws configure
aws sts get-caller-identity  # Verify credentials
```

### 2. Initialize Terraform
```bash
cd landing-zone/environments/dev
terraform init
```

### 3. Review Configuration Files

**terraform.tfvars** - Root variables:
```hcl
org_name    = "securebase-dev"
environment = "dev"
target_region = "us-east-1"
customer_tier = "standard"
```

**client.auto.tfvars** - Your customer deployments (4 examples provided):
- `blue-cross` - Healthcare tier (HIPAA)
- `goldman-fin` - Fintech tier (SOC2)
- `dept-of-energy` - Government tier (FedRAMP)
- `startup-dev` - Standard tier (CIS)

### 4. Plan & Review
```bash
# Validate configuration
terraform validate

# Generate execution plan
terraform plan -out=tfplan

# Review the plan carefully
cat tfplan
```

### 5. Deploy
```bash
# Apply the plan
terraform apply tfplan

# View outputs
terraform output
```

---

## Architecture Overview

```
┌─ AWS Organization (Management Account)
│
├─ Organizational Units (by tier):
│  ├─ Customers-Healthcare
│  ├─ Customers-Fintech
│  ├─ Customers-Government-Federal
│  └─ Customers-Standard
│
├─ Security Controls:
│  ├─ Service Control Policies (SCPs)
│  ├─ CloudTrail (centralized logging)
│  ├─ AWS Config (compliance monitoring)
│  ├─ GuardDuty (threat detection)
│  └─ Security Hub (centralized findings)
│
└─ Identity & Access:
   ├─ AWS IAM Identity Center (SSO)
   ├─ Permission Sets (Admin, Platform, Auditor)
   └─ Break-Glass Emergency Role
```

---

## What Gets Deployed

### Per-Customer Account
- ✓ Isolated AWS account
- ✓ Tier-specific guardrail policies (SCPs)
- ✓ CloudTrail enabled (logs to management account)
- ✓ AWS Config enabled (compliance monitoring)
- ✓ GuardDuty enabled (threat detection)
- ✓ Security Hub enabled (finding aggregation)
- ✓ S3 bucket encryption enforced
- ✓ Root user restricted
- ✓ IAM users blocked (SSO only)

### Management Account
- ✓ AWS Organizations baseline
- ✓ 4 organizational units (one per tier)
- ✓ Centralized logging (S3 with Object Lock)
- ✓ CloudTrail for entire organization
- ✓ AWS Config aggregation
- ✓ Security Hub consolidation
- ✓ GuardDuty consolidation

---

## Security by Customer Tier

| Feature | Healthcare | Fintech | Gov-Federal | Standard |
|---------|-----------|---------|-------------|----------|
| **Compliance Framework** | HIPAA | SOC2 | FedRAMP | CIS |
| **SCPs** | Restrict Root, Block IAM Users, Regional Lockdown | Restrict Root, Block IAM Users | Restrict Root, Block IAM Users, VPCE Lockdown | Restrict Root, Block IAM Users |
| **CloudTrail** | Centralized | Centralized | Centralized | Centralized |
| **Real-time Alerts** | ✓ | ✓ | ✓ | - |
| **VPC Endpoint Lockdown** | ✓ | - | ✓ | - |
| **Audit Retention** | 7 years | 3 years | 7 years | 1 year |
| **Support Tier** | Premium | Standard | Premium | Basic |

---

## Outputs After Deployment

Terraform will output:

```hcl
organization_id       = "o-xxxxxxxxxxxxx"
organization_arn      = "arn:aws:organizations::123456789012:organization/o-xxxxx"

customer_ou_ids = {
  fintech     = "ou-xxxx-xxxxxxxx"
  gov_federal = "ou-xxxx-xxxxxxxx"
  healthcare  = "ou-xxxx-xxxxxxxx"
  standard    = "ou-xxxx-xxxxxxxx"
}

client_account_ids = {
  "blue-cross"       = "123456789012"
  "dept-of-energy"   = "555566667777"
  "goldman-fin"      = "987654321098"
  "startup-dev"      = "111122223333"
}

central_log_bucket = "securebase-audit-logs-dev"
```

**Use these outputs to:**
- Configure customer IAM Identity Center access
- Set up cross-account audit log retention policies
- Build billing and compliance reports
- Monitor multi-tenant infrastructure health

---

## Common Issues & Fixes

### ❌ "customer_tier variable not declared"
**Fix**: Update `landing-zone/environments/dev/variables.tf` ✓ (Already done)

### ❌ "framework is required"
**Fix**: Ensure all clients in `client.auto.tfvars` include `framework` (hipaa|soc2|fedramp|cis) ✓ (Already done)

### ❌ "Objects have changed outside of Terraform"
**Fix**: This is expected. AWS Config may auto-enable features. Run:
```bash
terraform refresh
terraform apply
```

### ❌ "empty result" for organizational unit
**Fix**: Stale state. Remove it:
```bash
terraform state rm 'data.aws_organizations_organizational_unit.target[0]'
terraform plan
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more issues & solutions.

---

## Cost Estimation

**Base costs (monthly):**
- AWS Organizations: Free
- CloudTrail: ~$10
- AWS Config: ~$5
- GuardDuty: ~$15
- Security Hub: ~$100 (per month, includes up to 10,000 findings)
- S3 (logs): ~$20-50 depending on volume

**Per customer account:**
- CloudTrail delegation: Included
- Config recording: Included
- GuardDuty enablement: Included
- Security Hub findings: Included

---

## Next: Multi-Tenant PaaS Platform

### Phase 2: Backend API (4 weeks)
- REST API for tenant CRUD operations
- Terraform automation wrapper
- Deployment orchestration engine
- API authentication & rate limiting

### Phase 3: Multi-Tenant Database (3 weeks)
- PostgreSQL with row-level security
- Tenant data isolation
- Usage event tracking
- Audit logging

### Phase 4: Billing Engine (2 weeks)
- Usage metering (API calls, compliance scans, etc.)
- Invoice generation
- Tier-based pricing model
- Revenue reporting

### Phase 5: Dashboards (3 weeks)
- Admin dashboard (system health, customer overview)
- Tenant self-service portal (compliance, usage, costs)
- Real-time alerts & notifications

### Phase 6: Operations (2 weeks)
- CI/CD pipeline setup
- Production-grade monitoring
- Disaster recovery runbooks
- High-availability configuration

**Total**: 16 weeks to production MVP

See [docs/PAAS_ARCHITECTURE.md](../docs/PAAS_ARCHITECTURE.md) for detailed specifications.

---

## Support & Documentation

- **Architecture**: [docs/PAAS_ARCHITECTURE.md](../docs/PAAS_ARCHITECTURE.md)
- **Multi-Tenant Setup**: [landing-zone/MULTI_TENANT_GUIDE.md](landing-zone/MULTI_TENANT_GUIDE.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Deployment Status**: [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)

---

## Ready to Deploy?

```bash
cd landing-zone/environments/dev
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Then check outputs:
```bash
terraform output
```

🎉 Your SecureBase PaaS infrastructure is live!
