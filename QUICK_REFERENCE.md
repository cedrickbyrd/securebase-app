# 🚀 SecureBase PaaS Quick Reference

## Deploy in 3 Commands

```bash
cd landing-zone/environments/dev
terraform plan -out=tfplan
terraform apply tfplan
```

## View Results

```bash
terraform output client_account_ids
terraform output customer_ou_ids
terraform output central_log_bucket
```

---

## Customer Tiers at a Glance

| Tier | Price | Compliance | Features | OUs |
|------|-------|-----------|----------|-----|
| **Standard** | $2K/mo | CIS | Basic guardrails | Customers-Standard |
| **Fintech** | $8K/mo | SOC2 | Real-time alerts | Customers-Fintech |
| **Healthcare** | $15K/mo | HIPAA | VPCE lockdown + 7yr retention | Customers-Healthcare |
| **Gov-Federal** | $25K/mo | FedRAMP | Full compliance reporting | Customers-Gov-Federal |

---

## Key Files

| File | Purpose |
|------|---------|
| `terraform.tfvars` | Root variables (org_name, environment) |
| `client.auto.tfvars` | Customer configurations |
| `variables.tf` | All variable declarations |
| `main.tf` | Infrastructure orchestration |
| `outputs.tf` | Output mappings |

---

## Adding a New Customer

1. **Edit** `environments/dev/client.auto.tfvars`:
```hcl
clients = {
  "my-customer" = {
    tier         = "healthcare"  # or fintech, gov-federal, standard
    account_id   = "111122223333"
    prefix       = "customer-short-name"
    framework    = "hipaa"       # or soc2, fedramp, cis
    audit_bucket = "custom-bucket-name"  # optional
    tags = {
      Customer = "My Customer Inc"
    }
  }
}
```

2. **Plan**:
```bash
terraform plan
```

3. **Review** the plan to ensure:
   - ✓ New account creation
   - ✓ OU attachment (based on tier)
   - ✓ Guardrail policy attachments

4. **Apply**:
```bash
terraform apply
```

---

## Architecture Quick View

```
Organization (1)
├── Customers-Healthcare OU
│   └── Customer Accounts
├── Customers-Fintech OU
│   └── Customer Accounts
├── Customers-Gov-Federal OU
│   └── Customer Accounts
├── Customers-Standard OU
│   └── Customer Accounts
├── Security OU
│   └── Centralized Logging Account
├── Shared Services OU
├── Workloads OU
└── [+Management Account]
```

---

## Outputs You'll Get

```hcl
organization_id       = "o-xxxxx"
central_log_bucket    = "securebase-audit-logs-dev"

client_account_ids = {
  "blue-cross"    = "123456789012"
  "goldman-fin"   = "987654321098"
  "startup-dev"   = "111122223333"
  ...
}

customer_ou_ids = {
  healthcare  = "ou-xxxx-xxxx"
  fintech     = "ou-xxxx-xxxx"
  gov_federal = "ou-xxxx-xxxx"
  standard    = "ou-xxxx-xxxx"
}
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "variable not declared" | Run `terraform validate` |
| "framework is required" | Check all clients have `framework` attribute |
| "Objects changed outside Terraform" | Run `terraform refresh` |
| "empty result" reading OU | Run `terraform state rm 'data.aws_organizations_organizational_unit.target[0]'` |

See `TROUBLESHOOTING.md` for more.

---

## Documentation Map

```
📚 Start Here:
   ↓
   GETTING_STARTED.md (deployment guide)
   ↓
   ├─ IMPLEMENTATION_SUMMARY.md (what we built)
   ├─ MULTI_TENANT_GUIDE.md (operations)
   ├─ PAAS_ARCHITECTURE.md (backend API roadmap)
   └─ TROUBLESHOOTING.md (issues & fixes)
```

---

## Next Phase: Backend API

After infrastructure deployment ✅, build:

- **Week 1-2**: REST API (Node.js/Express) + Terraform wrapper
- **Week 3-4**: Deployment automation + testing
- **Week 5-6**: PostgreSQL multi-tenant schema
- **Week 7-8**: Billing engine + usage metering
- **Week 9-10**: Admin dashboard + self-service portal
- **Week 11-12**: Monitoring, logging, alerting
- **Week 13-16**: Operations, runbooks, HA setup

See `docs/PAAS_ARCHITECTURE.md` for detailed spec.

---

## Support

| Topic | Location |
|-------|----------|
| Deployment | `GETTING_STARTED.md` |
| Architecture | `docs/PAAS_ARCHITECTURE.md` |
| Operations | `landing-zone/MULTI_TENANT_GUIDE.md` |
| Issues | `TROUBLESHOOTING.md` |

---

## 🎯 TL;DR

```bash
# 1. Install Terraform 1.5+
# 2. Configure AWS credentials
# 3. Run these 3 commands:
cd landing-zone/environments/dev
terraform init
terraform apply
```

**Done!** Your multi-tenant AWS security platform is live. 🚀
