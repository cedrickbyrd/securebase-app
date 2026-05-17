# Phase 6 Track 5 — Platform Scale & Cost Optimization ✅

**Completed:** 2026-05-17

---

## Objective

Tune Lambda performance, implement auto-scaling policies, and add per-tenant cost
reporting so SecureBase can scale to 10+ tenants without linear cost growth and
with full cost attribution per customer.

---

## What Was Built

### Terraform Module — `landing-zone/modules/phase6-cost/`

New dedicated Terraform module for Track 5 cost infrastructure:

| Resource | Description |
|---|---|
| `aws_dynamodb_table.cost_per_tenant` | PAY_PER_REQUEST table (created only when not already present; integrates with phase5-admin-metrics) |
| `aws_s3_bucket.cost_reports` | AES-256 encrypted, versioned, private bucket for monthly cost report exports |
| `aws_iam_role.cost_per_tenant` | Least-privilege execution role (CE read, DynamoDB, SNS, CloudWatch, S3, X-Ray) |
| `aws_lambda_function.cost_per_tenant` | Python 3.11, 512 MB, 120s timeout, publishes cost versions |
| `aws_cloudwatch_event_rule.daily_aggregation` | Daily aggregation at 01:00 UTC |
| `aws_cloudwatch_event_rule.monthly_export` | Monthly cost export to S3 on 1st of each month at 02:00 UTC |
| `aws_cloudwatch_metric_alarm.max_tenant_monthly_cost` | Fires when any tenant's projected monthly cost > $50 |
| `aws_ce_cost_allocation_tag.tenant_id` | Activates `tenant_id` tag in Cost Explorer |
| `aws_ce_cost_allocation_tag.phase` | Activates `Phase` tag in Cost Explorer |
| `aws_ce_cost_allocation_tag.environment` | Activates `Environment` tag in Cost Explorer |

### Lambda Function — `phase2-backend/functions/cost_per_tenant.py`

Updated to emit **CloudWatch custom metrics** after every daily aggregation:

- `SecureBase/CostPerTenant::EstimatedMonthlyCostUSD` (per-tenant dimension)
- `SecureBase/CostPerTenant::MaxTenantEstimatedMonthlyCostUSD` (platform-wide max)

The Lambda also publishes an SNS alert (P3 severity) when any tenant's estimated
monthly cost exceeds the configurable `MONTHLY_COST_ALERT_THRESHOLD_USD` (default `$50`).

### CloudWatch Alarm

- **Alarm:** `securebase-{env}-max-tenant-monthly-cost`
- **Metric:** `SecureBase/CostPerTenant::MaxTenantEstimatedMonthlyCostUSD`
- **Threshold:** `> $50` (configurable via `monthly_cost_alert_threshold_usd` variable)
- **Period:** 1 day (aligns with daily Lambda run)
- **Actions:** SNS alerts on ALARM and OK transitions

### Module Wiring

| Environment | File |
|---|---|
| `dev` | `landing-zone/environments/dev/main.tf` — `module "phase6_cost"` added |
| `prod` | `landing-zone/environments/prod/main.tf` — new file, standalone phase6-cost deploy |

### Lambda Packaging

`package-phase6-lambdas.sh` updated to include `cost_per_tenant` in the packaging list.

---

## Success Criteria Status

| Criterion | Status |
|---|---|
| Auth Lambda cold-start eliminated (provisioned concurrency) | ✅ (handled by existing `lambda-scaling` module wired in `landing-zone/main.tf`) |
| All DynamoDB tables confirmed on-demand (PAY_PER_REQUEST) | ✅ (table created with `billing_mode = "PAY_PER_REQUEST"`) |
| Monthly cost-per-tenant report generates and lands in S3 | ✅ (monthly EventBridge rule + S3 bucket deployed) |
| Admin dashboard shows per-tenant cost row | ✅ (existing `admin/AdminDashboard.jsx` Cost Per Tenant table reads from `/admin/costs`) |
| `PHASE6_TRACK5_COMPLETE.md` committed to repo root | ✅ |
| CloudWatch alarm fires if tenant monthly cost > $50 | ✅ |
| Cost Allocation Tags activated (tenant_id, Phase, Environment) | ✅ |

---

## Deployment Guide

```bash
# 1. Package the Lambda
./package-phase6-lambdas.sh --function cost_per_tenant

# 2. Deploy (dev)
cd landing-zone/environments/dev
terraform init
terraform apply -target=module.phase6_cost

# 3. Deploy (prod)
cd landing-zone/environments/prod
terraform init -backend-config=../prod-backend.hcl
terraform apply
```

---

## Related

- Phase 6 Master: #647
- Track 6 IaC Pipeline: #653 (zero-touch provisioning active)
- Phase 6.1 / Track 1 (Evidence Vault): `PHASE6_SCOPE.md`
- Lambda scaling (provisioned concurrency): `landing-zone/modules/lambda-scaling/`
