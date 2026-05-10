# SecureBase — Product Roadmap

**Last Updated:** May 2026  
**Maintained by:** Cedrick J. Byrd / TxImhotep LLC  
**Deployment:** [securebase.tximhotep.com](https://securebase.tximhotep.com)

---

## Overview

SecureBase is a security-first, multi-tenant AWS PaaS that delivers compliant cloud infrastructure as a managed service. It combines Terraform IaC, serverless Lambda APIs, an Aurora PostgreSQL data layer, and a React customer portal.

This document is the single source of truth for what has been built, what is in progress, and what is planned next.

---

## 📊 Phase Summary

| Phase | Description | Status | Completion |
|-------|-------------|--------|------------|
| Phase 1 | AWS Landing Zone (Terraform IaC) | ✅ Complete | 100% |
| Phase 2 | Serverless Database & API Backend | ✅ Complete | 100% |
| Phase 3a | Customer Portal (React) | ✅ Complete | 100% |
| Phase 3b | Support Tickets, Webhooks & Cost Forecasting | ✅ Complete | 100% |
| Phase 4 | Enterprise Features (RBAC, Analytics, Notifications) | ✅ Complete | 100% |
| Phase 5.1 | Executive/Admin Dashboard | ✅ Complete | 100% |
| Phase 5.2 | Tenant/Customer Dashboard & Compliance Drift | ✅ Complete | 100% |
| Phase 5.3 | SRE Dashboard Backend, Logging & Cost Optimization | ✅ Complete | 100% |
| Phase 5.4 | Multi-Region DR Production Wiring | ✅ Complete — validation gates open | 90% |
| Phase 5.5 | Alerting & Incident Response | ✅ Complete (delivered within 5.3 sprint) | 100% |
| Phase 5.6 | Distributed Tracing (AWS X-Ray) | ✅ Complete (delivered within 5.3 sprint) | 100% |
| Phase 6 | Compliance Automation & Operations Scale | 🔨 In Progress | 15% |

---

## Phase 1 — AWS Landing Zone

**Status:** ✅ Complete  
**Location:** `landing-zone/`

- AWS Organizations with multi-account structure and Organizational Units
- IAM Identity Center (SSO) with zero long-lived credentials
- Centralized CloudTrail audit logging with S3 Object Lock (Compliance Mode, 7-year)
- Security Hub, GuardDuty, and AWS Config enabled across all accounts
- Service Control Policies (SCPs) for deny-by-default guardrails (CIS, HIPAA, FedRAMP, SOC 2)
- KMS encryption by default for EBS, S3, and RDS

---

## Phase 2 — Serverless Backend

**Status:** ✅ Complete — Production Deployed (January 2026)  
**Location:** `phase2-backend/`

- Aurora Serverless v2 (PostgreSQL 15.4) with Row-Level Security
- 15+ database tables with RLS policies
- Lambda functions (Python 3.11) for all API operations
- API Gateway REST API with API key authentication
- DynamoDB, RDS Proxy, Secrets Manager

---

## Phase 3a — Customer Portal

**Status:** ✅ Complete  
**Location:** `phase3a-portal/`

React 18 + Vite portal with full routing: Dashboard, Compliance, HIPAA, FFIEC CAT, Texas Examiner, SRE, Alerts, Admin, Pricing, Checkout, ContactSales, ComplianceJumpstart, HIPAAReadiness, Setup, DemoDashboard.

---

## Phase 3b — Advanced Features

**Status:** ✅ Complete (Q4 2025)

Support tickets, webhooks with HMAC verification, ML cost forecasting, real-time notifications.

---

## Phase 4 — Enterprise Features

**Status:** ✅ Complete (March 2026)

Advanced analytics, RBAC (admin/manager/editor/viewer), multi-channel notifications, white-label/SSO, IP whitelist, audit logs, security events.

---

## Phase 5.1 — Executive/Admin Dashboard

**Status:** ✅ Complete  
**See:** `PHASE5.1_FINAL_DELIVERY_REPORT.md`

- `AdminDashboard.jsx` — 7 sections, exponential back-off auto-refresh
- `SystemHealth.jsx` — real-time Lambda, API Gateway, DB metrics
- `metrics_aggregation.py` Lambda — CloudWatch + Cost Explorer
- 7 API endpoints at `/admin/*`

---

## Phase 5.2 — Tenant/Customer Dashboard

**Status:** ✅ Complete  
**See:** `PHASE5.2_IMPLEMENTATION_COMPLETE.md`

- `TenantDashboard.jsx` — compliance, usage, cost, alert panels
- `ComplianceDrift.jsx` — 90-day drift timeline with MTTR analytics
- `tenant_metrics.py` — 6 JWT-authenticated API endpoints
- DynamoDB: `securebase-metrics-history`, `securebase-compliance-violations`, `securebase-audit-trail`

---

## Phase 5.3 — SRE Dashboard Backend, Logging & Cost Optimization

**Status:** ✅ Complete (May 2026)  
**See:** `PHASE5.3_IMPLEMENTATION_COMPLETE.md`

> Note: Phases 5.5 (Alerting) and 5.6 (Distributed Tracing) were originally scoped as separate phases in Sprint #2 but were delivered within this sprint. See `PHASE5.5_5.6_COMPLETE.md`.

### Delivered

- **SRE Dashboard** (PR #645) — `SREDashboard.jsx` (58 KB): CloudWatch Logs Insights query library, DLQ depth monitoring, on-call runbook panel
- **`phase5-logging/` module** — CloudWatch log groups (dev: 7d, prod: 365d), X-Ray tracing, 20+ saved queries *(see Phase 5.6)*
- **`phase5-alerting/` module** — 40+ CloudWatch alarms, SNS, PagerDuty/Opsgenie integration, alert router Lambda *(see Phase 5.5)*
- **`phase5-cost/` module** — Auto-scaling policies, Aurora ACU tuning, cost anomaly detection, S3 Intelligent-Tiering
- **`phase5-sre-metrics/` module** — DynamoDB `sre_ops_metrics`, SNS topics, IAM

---

## Phase 5.4 — Multi-Region DR Production Wiring

**Status:** ✅ Complete — 4 validation gates open (run `validate-dr.yml`)  
**Apply Date:** 2026-05-10 — 49/49 Terraform resources applied  
**See:** `PHASE5.4_IMPLEMENTATION_COMPLETE.md`

### Infrastructure (all in `landing-zone/modules/multi-region/`)

| File | Purpose |
|------|---------|
| `aurora-global.tf` | Aurora Global DB — `securebase-phase2-dev` promoted; secondary in us-west-2 |
| `dynamodb-global.tf` | Global Table replicas for 4 prod tables (streams enabled 2026-05-10) |
| `s3-replication.tf` | CRR on `securebase-audit-logs-prod` → us-west-2 with KMS |
| `cloudfront-failover.tf` | Origin group (GET/HEAD/OPTIONS) + direct `/api/*`; alias `api.securebase.tximhotep.com` |
| `lambda-replication.tf` | Failover + failback + health-check Lambdas in us-west-2 |
| `health-endpoint.tf` | Node.js 20.x `/health` Lambda + API GWv2 in us-west-2 |
| `dr-validation.sh` | 7-check DR stack validation script |
| `.github/workflows/validate-dr.yml` | Daily scheduled validation (OIDC) |

### Validation Gates
- ✅ 49/49 resources applied | ✅ DynamoDB streams enabled | ✅ Daily DR workflow deployed
- ⏳ CloudFront distribution health | ⏳ Aurora Global DB secondary healthy | ⏳ DynamoDB replication lag < 1 min | ⏳ First DR drill (RTO < 15 min)

**Next action:** Trigger `.github/workflows/validate-dr.yml` manually.

### SLA Targets
- **RTO:** < 15 minutes | **RPO:** < 1 minute | **Uptime:** 99.95%

---

## Phase 5.5 — Alerting & Incident Response

**Status:** ✅ Complete (May 2026, delivered within Phase 5.3 sprint)  
**See:** `PHASE5.5_5.6_COMPLETE.md`

Originally a standalone phase in Sprint #2; delivered as `landing-zone/modules/phase5-alerting/`.

- 40+ CloudWatch alarm rules (error rates, latency, throttling, cold starts, DLQ depth, Aurora lag)
- Composite alarms + anomaly detection for low false-positive rate
- SNS → PagerDuty + Opsgenie integration via SSM Parameter Store
- Escalation tiers: Primary → Backup → Manager
- Maintenance window suppression via EventBridge
- Alert router Lambda (`alert_router.py`) with KMS-scoped decrypt
- Alert detection latency < 5 minutes | False-positive rate < 5%

---

## Phase 5.6 — Distributed Tracing (AWS X-Ray)

**Status:** ✅ Complete (May 2026, delivered within Phase 5.3 sprint)  
**See:** `PHASE5.5_5.6_COMPLETE.md`

Originally a standalone phase in Sprint #2; delivered as `landing-zone/modules/phase5-logging/`.

- X-Ray active tracing on 100% of Lambda functions
- Sampling rules: 1% default, 100% for error paths (cost-optimized)
- CloudWatch ServiceLens — service maps across API Gateway → Lambda → Aurora
- 20+ saved Logs Insights queries (cold starts, error clustering, latency breakdowns)
- VPC Flow Logs enabled
- Structured JSON logging enforced across all Lambda handlers
- SRE Dashboard query library panel (PR #645) surfaces queries to operators

---

## Phase 6 — Compliance Automation & Operations Scale

**Status:** 🔨 In Progress  
**Started:** May 2026  
**Theme:** Make compliance a product feature, not an afterthought.  
**Scope:** See [PHASE6_SCOPE.md](PHASE6_SCOPE.md) | **Tasks:** See [TODO_PHASE6.md](TODO_PHASE6.md)

### Components

#### 6.1 Immutable Audit Logging (scaffolded)
- S3 Object Lock (COMPLIANCE mode, 7-year), Macie, `audit_log_packager.py`, `/admin/evidence` API
- `phase6-backend/database/migrations/001_audit_evidence_tables.sql`

#### 6.2 Compliance Automation — 50+ AWS Config Rules (scaffolded)
- 25+ Config rules, HIPAA/NIST conformance packs
- `soc2_mapping.json`, `hipaa_mapping.json`, `fedramp_mapping.json`
- `compliance_score_recalculator.py` — daily cron Lambda

#### 6.3 Scalability to 10,000+ Concurrent Users (planned)
- Lambda provisioned concurrency, API GW caching, Aurora ACU 2–128, DynamoDB GSIs

#### 6.4 Build Debt Cleanup (planned)
- Remove `--legacy-peer-deps`, migrate mock data to `tests/fixtures/`, consolidate root markdown into `docs/`

#### 6.5 Developer Experience (planned)
- `docker-compose.yml`, Storybook, OpenAPI spec, Playwright E2E

---

## Current Priorities (May 2026)

1. **Close Phase 5.4 validation gates** — run `validate-dr.yml`, conduct first DR drill
2. **Begin Phase 6.1 + 6.2** — compliance automation and audit logging in parallel
3. **Documentation hygiene** — consolidate root-level markdown into `docs/`

---

## Architecture Snapshot

```
Customer Browser
      │
      ▼
Netlify CDN (phase3a-portal dist/)
      │  /api/* proxied to →
      ▼
CloudFront (api.securebase.tximhotep.com)        ← Phase 5.4
      │  origin group failover (Phase 5.4)
      ▼
API Gateway (us-east-1)     API Gateway (us-west-2, standby)
      │
      ▼
Lambda Functions (Python 3.11)    ← X-Ray tracing (Phase 5.6)
  + CloudWatch Alarms (Phase 5.5) ← PagerDuty/Opsgenie
      │  set_customer_context(customer_id) → RLS
      ▼
Aurora Global DB (PostgreSQL 15.15) ──replicate──▶ Aurora Reader (us-west-2)
DynamoDB Global Tables              ──replicate──▶ DynamoDB Replicas (us-west-2)
      │
      ▼
AWS Organizations (Landing Zone)
 ├── Healthcare OU (HIPAA)
 ├── Fintech OU (SOC 2)
 ├── Government OU (FedRAMP)
 └── Standard OU (CIS)
```

---

## Key Documentation Index

| Document | Purpose |
|----------|---------|
| `PHASE5.3_IMPLEMENTATION_COMPLETE.md` | Phase 5.3 delivery (SRE Dashboard, logging, cost) |
| `PHASE5.4_IMPLEMENTATION_COMPLETE.md` | Phase 5.4 delivery (Multi-Region DR, 49/49 applied) |
| `PHASE5.5_5.6_COMPLETE.md` | Phase 5.5 (Alerting) + 5.6 (X-Ray) delivery |
| `PHASE6_SCOPE.md` | Phase 6 detailed scope and success criteria |
| `DISASTER_RECOVERY_PLAN.md` | DR strategy, RTO/RPO, failover procedures |
| `DR_RUNBOOK.md` | Step-by-step operational runbook |
| `FAILBACK_PROCEDURE.md` | Return-to-primary procedure |
| `MULTI_REGION_TESTING_GUIDE.md` | Monthly DR drill procedures |
| `COST_OPTIMIZATION_PLAYBOOK.md` | Cost optimization strategies |
| `SECURITY.md` | Security policies and responsible disclosure |

---

## Tech Stack Reference

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, react-chartjs-2 |
| Backend | Python 3.11, AWS Lambda, API Gateway |
| Database | Aurora Serverless v2 (PostgreSQL 15.15), DynamoDB |
| IaC | Terraform ≥ 1.5.0, AWS Provider ~> 5.0 |
| Auth | AWS IAM Identity Center (SSO), API Keys, JWT |
| Observability | CloudWatch, X-Ray ✅ (Phase 5.6), PagerDuty ✅ (Phase 5.5) |
| DR | CloudFront multi-origin, Aurora Global DB, DynamoDB Global Tables ✅ (Phase 5.4) |
| Deployment | Netlify (frontend), AWS (backend + infra) |
| CI/CD | GitHub Actions |
