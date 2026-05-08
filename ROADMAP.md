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
| [Phase 1](#phase-1--aws-landing-zone) | AWS Landing Zone (Terraform IaC) | ✅ Complete | 100% |
| [Phase 2](#phase-2--serverless-backend) | Serverless Database & API Backend | ✅ Complete | 100% |
| [Phase 3a](#phase-3a--customer-portal) | Customer Portal (React) | ✅ Complete | 100% |
| [Phase 3b](#phase-3b--advanced-features) | Support Tickets, Webhooks & Cost Forecasting | ✅ Complete | 100% |
| [Phase 4](#phase-4--enterprise-features) | Enterprise Features (RBAC, Analytics, Notifications) | ✅ Complete | 100% |
| [Phase 5](#phase-5--observability--multi-region-dr) | Observability, Monitoring & Multi-Region DR | 🔄 In Progress | ~60% |
| [Phase 6](#phase-6--compliance--operations-scale) | Compliance Automation & Operations Scale | 🔨 In Progress | 15% |

---

## Phase 1 — AWS Landing Zone

**Status:** ✅ Complete  
**Location:** `landing-zone/`

### What Was Built
- AWS Organizations with multi-account structure and Organizational Units (OUs)
- IAM Identity Center (SSO) with zero long-lived credentials
- Centralized CloudTrail audit logging with S3 Object Lock (Compliance Mode, 7-year retention)
- Security Hub, GuardDuty, and AWS Config enabled across all accounts
- Service Control Policies (SCPs) for deny-by-default guardrails (CIS, HIPAA, FedRAMP, SOC 2)
- KMS encryption by default for EBS, S3, and RDS
- Break-glass emergency IAM role with MFA enforcement
- Full Terraform IaC — deployable from `landing-zone/environments/dev`

### Customer Tiers Supported
| Tier | Framework | Key Controls |
|------|-----------|--------------|
| Healthcare | HIPAA | 2,555-day retention, PHI tagging, VPC endpoints enforced |
| Fintech | SOC 2 | Immutable logs, MFA required, region restrictions |
| Government | FedRAMP | GovCloud-ready, FIPS encryption |
| Standard | CIS | Baseline hardening, GuardDuty, Config rules |

### Key Files
- `landing-zone/environments/dev/main.tf` — Environment entry point
- `landing-zone/modules/org/main.tf` — Organizations, OUs, SCPs
- `landing-zone/modules/iam/` — Identity Center
- `landing-zone/modules/logging/` — CloudTrail, S3
- `landing-zone/modules/security/` — GuardDuty, Config, Security Hub

---

## Phase 2 — Serverless Backend

**Status:** ✅ Complete — Production Deployed (January 2026)  
**Location:** `phase2-backend/`

### What Was Built
- **Aurora Serverless v2** (PostgreSQL 15.4) with Row-Level Security (RLS) enforcing per-tenant data isolation
- **15+ database tables**: customers, invoices, api_keys, usage_metrics, audit_logs, support_tickets, webhooks, and more
- **Lambda functions** (Python 3.11) for all API operations
- **API Gateway** REST API with API key authentication
- **DynamoDB** tables for caching, metrics, and session state
- **RDS Proxy** for connection pooling
- **Secrets Manager** for credential rotation

### Lambda Functions
| Function | Purpose |
|----------|---------|
| `auth_v2.py` | API key validation and session management |
| `billing_worker.py` | Monthly invoice generation (EventBridge cron) |
| `metrics.py` | Usage aggregation |
| `support_tickets.py` | Support ticket CRUD |
| `webhook_manager.py` | Webhook dispatch and retry logic |
| `cost_forecasting.py` | ML-based cost projections |
| `user_management.py` | User CRUD and role assignments |
| `audit_logging.py` | Immutable audit trail writes |
| `rbac_engine.py` | Role-based access control enforcement |
| `analytics_aggregator.py` | Hourly metrics aggregation from CloudWatch / Cost Explorer |
| `analytics_query.py` | Real-time analytics API with caching |
| `analytics_reporter.py` | Multi-format report export (CSV, JSON, PDF, Excel) |
| `notification_worker.py` | SQS-based multi-channel notification dispatch |
| `notification_api.py` | Notification preferences and history API |
| `metrics_aggregation.py` | Admin dashboard metrics from CloudWatch / Security Hub |

### Key Files
- `phase2-backend/database/schema.sql` — Full schema with RLS policies
- `phase2-backend/lambda_layer/python/db_utils.py` — 50+ shared DB utilities
- `phase2-backend/functions/requirements.txt` — Python dependencies

---

## Phase 3a — Customer Portal

**Status:** ✅ Complete  
**Location:** `phase3a-portal/`

### What Was Built
A React 18 + Vite customer-facing dashboard with Tailwind CSS styling, consuming all Phase 2 API endpoints.

### Components
| Component | Purpose |
|-----------|---------|
| `Login.jsx` | Email + API key authentication |
| `Dashboard.jsx` | Metrics summary, cost trends, compliance score |
| `Invoices.jsx` | Invoice list, PDF download, payment status |
| `ApiKeys.jsx` | API key creation, revocation, rotation |
| `Compliance.jsx` | Security Hub findings, Config rule violations |
| `SupportTickets.jsx` | Ticket submission and tracking |
| `Forecasting.jsx` | Cost forecasting with trend visualizations |
| `Webhooks.jsx` | Webhook endpoint management |
| `Signup.jsx` / `SignupForm.jsx` | New customer self-service signup |
| `OnboardingProgress.jsx` | Post-signup onboarding workflow |

### Key Files
- `phase3a-portal/src/services/apiService.js` — API client (reads `VITE_API_BASE_URL`)
- `phase3a-portal/vite.config.js` — Build config
- `netlify.toml` — Netlify proxy rules (`/api/*` → `https://api.securebase.com/v1/:splat`)

---

## Phase 3b — Advanced Features

**Status:** ✅ Complete (Q4 2025)  
**Location:** `phase3a-portal/src/components/`, `phase2-backend/functions/`

### What Was Built
- Support ticket system with SLA tracking
- Webhook management with HMAC signature verification and retry logic
- Cost forecasting engine with ML-based projections and trend charts
- Real-time in-app notification infrastructure

---

## Phase 4 — Enterprise Features

**Status:** ✅ Complete (March 2026)  
**Location:** `phase3a-portal/src/components/`, `phase2-backend/functions/`

### Components Delivered

#### 1. Advanced Analytics
- Historical metrics aggregation via CloudWatch, Cost Explorer, and Security Hub
- Interactive charts (react-chartjs-2) with time-range selectors
- Multi-format report export: CSV, JSON, PDF, Excel
- EventBridge scheduled aggregation with DynamoDB caching

#### 2. Team Collaboration & RBAC
- Role definitions: `admin`, `manager`, `editor`, `viewer`
- `TeamManagement.jsx` for user invite, role assignment, deactivation
- `rbac_engine.py` Lambda with JWT-based role enforcement
- Per-resource permission policies with audit trail

#### 3. Notification Center
- Multi-channel delivery: In-app, Email (SES), SMS (SNS), Webhook
- `NotificationCenter.jsx` with real-time polling
- `NotificationSettings.jsx` preference matrix
- SQS + DLQ worker with 3-retry policy

#### 4. White-Label / Branding
- Tenant-configurable logo, color scheme, and domain
- `SSOConfiguration.jsx` for SAML/OIDC SSO setup per tenant

#### 5. Enterprise Security
- MFA enforcement policies per role
- IP whitelist management (`IPWhitelistManagement.jsx`)
- Advanced audit log viewer (`AuditLog.jsx`)
- Security event feed (`SecurityEvents.jsx`)

#### 6. Admin Dashboard (Phase 5.1 — delivered early)
- `AdminDashboard.jsx` — platform-wide health, MRR, customer KPIs
- `SystemHealth.jsx` — real-time Lambda, API Gateway, DB metrics
- `adminService.js` — API client aggregating CloudWatch + Cost Explorer

---

## Phase 5 — Observability & Multi-Region DR

**Status:** 🔄 In Progress (~60%)  
**Target Duration:** 6 weeks from start  
**Budget:** $75,000–$135,000  
**SLA Target:** 99.95% uptime, <15 min RTO, <1 min RPO

### Goals
1. Production-grade observability across all infrastructure layers
2. Multi-region active/passive deployment (us-east-1 primary, us-west-2 failover)
3. Automated alerting and incident response integration
4. Distributed tracing across all Lambda → Aurora call paths
5. Cost optimization with auto-scaling policies

### Components

#### 5.1 Executive/Admin Dashboard ✅ Complete
- `AdminDashboard.jsx` (542 lines) — 7 sections, exponential back-off auto-refresh
- `SystemHealth.jsx` (256 lines) — real-time Lambda, API Gateway, DB metrics
- `metrics_aggregation.py` (539 lines) — CloudWatch + Cost Explorer Lambda
- 7 API endpoints at `/admin/*` — wired to live CloudWatch + DynamoDB
- **See:** [PHASE5.1_FINAL_DELIVERY_REPORT.md](PHASE5.1_FINAL_DELIVERY_REPORT.md)

#### 5.2 Tenant/Customer Dashboard & Compliance Drift ✅ Complete
- `TenantDashboard.jsx` — compliance, usage, cost, alert panels
- `ComplianceDrift.jsx` — 90-day drift timeline with MTTR analytics
- `SREDashboard.jsx` — Lambda cold starts, DB IOPS, DLQ depth
- `tenant_metrics.py` — 6 API endpoints with JWT auth
- DynamoDB tables: `securebase-metrics-history`, `securebase-compliance-violations`, `securebase-audit-trail`
- **See:** [PHASE5.2_IMPLEMENTATION_COMPLETE.md](PHASE5.2_IMPLEMENTATION_COMPLETE.md)

#### 5.3 Multi-Region DR, Alerting & Cost Optimization 🔨 In Progress
- **Component 4** — CloudWatch log groups per service + AWS X-Ray distributed tracing
- **Component 5** — 40+ CloudWatch alarms, SNS, PagerDuty/Opsgenie integration
- **Component 6** — Aurora Global Database, DynamoDB Global Tables, Route 53 failover
  - Terraform modules in `landing-zone/modules/multi-region/`
  - Secondary region environment: `landing-zone/environments/prod-us-west-2/`
  - Lambda: `failover_orchestrator.py`, `health_check_aggregator.py`, `failback_orchestrator.py`
- **Component 7** — Auto-scaling policies, Aurora ACU tuning, cost anomaly detection
- **See:** [PHASE5.3_SCOPE.md](PHASE5.3_SCOPE.md)

### Acceptance Criteria
- [ ] 99.95% uptime SLA capability
- [ ] Automated failover success rate >95%
- [ ] Alert response time <5 minutes
- [ ] Dashboard load time <2 seconds (p95)
- [ ] Zero data loss during regional failover
- [ ] X-Ray traces capture >99% of requests
- [ ] Alert noise <5% false positive rate

---

## Phase 6 — Compliance Automation & Operations Scale

**Status:** 🔨 In Progress  
**Started:** May 2026  
**Theme:** Make compliance a product feature, not an afterthought.  
**Scope:** See [PHASE6_SCOPE.md](PHASE6_SCOPE.md) | **Tasks:** See [TODO_PHASE6.md](TODO_PHASE6.md)

### In Progress

#### 6.1 Immutable Audit Logging at Scale (scaffolded)
- `landing-zone/modules/phase6-audit-logging/` — S3 Object Lock (COMPLIANCE mode, 7-year), Macie, KMS
- `phase6-backend/functions/audit_log_packager.py` — evidence packaging Lambda
- `phase6-backend/functions/audit_evidence_api.py` — REST API for evidence management
- `phase6-backend/database/migrations/001_audit_evidence_tables.sql`

#### 6.2 Compliance Automation (50+ AWS Config Rules) (scaffolded)
- `landing-zone/modules/phase6-compliance/` — 25+ Config rules, HIPAA/NIST conformance packs
- `phase6-backend/compliance/soc2_mapping.json` — 16 SOC 2 CC controls
- `phase6-backend/compliance/hipaa_mapping.json` — 12 HIPAA safeguards
- `phase6-backend/compliance/fedramp_mapping.json` — 15 FedRAMP Rev 5 controls
- `phase6-backend/functions/compliance_score_recalculator.py` — daily cron Lambda
- `phase6-backend/database/migrations/002_compliance_score_history.sql`

#### 6.3 Scalability to 10,000+ Concurrent Users (planned)
- Lambda provisioned concurrency (auth_v2, metrics, analytics_query)
- API Gateway stage-level caching with per-customer cache keys
- DynamoDB on-demand billing + GSI optimization
- Aurora ACU tuning (min=2, max=128)

#### 6.4 Build Debt Cleanup (planned)
- Remove `--legacy-peer-deps` from all npm installs
- Migrate mock data to `tests/fixtures/`
- Consolidate root-level markdown into `docs/`

#### 6.5 Developer Experience (planned)
- `docker-compose.yml` — one-command local dev
- Storybook for portal components
- OpenAPI spec (`docs/api/openapi.yaml`)
- Playwright E2E test suite

---

## Current Priorities (May 2026)

1. **Complete Phase 5.3** — Multi-region DR (Aurora Global DB, Route 53 failover), alerting (CloudWatch + PagerDuty), distributed tracing (X-Ray), cost optimization
2. **Phase 5.3 Component 6 is highest priority** — delivers the 99.95% uptime SLA commitment
3. **Begin Phase 6 planning** — Compliance automation scoping, Config rules mapping
4. **Documentation hygiene** — Consolidate root-level markdown files into `docs/`

---

## Architecture Snapshot

```
Customer Browser
      │
      ▼
Netlify CDN (phase3a-portal dist/)
      │  /api/* proxied to →
      ▼
API Gateway (us-east-1)
      │
      ▼
Lambda Functions (Python 3.11)
      │  set_customer_context(customer_id) → RLS
      ▼
Aurora Serverless v2 (PostgreSQL 15.4)
      │
      ▼
AWS Organizations (Landing Zone)
 ├── Healthcare OU (HIPAA)
 ├── Fintech OU (SOC 2)
 ├── Government OU (FedRAMP)
 └── Standard OU (CIS)
```

**Multi-Tenancy Enforcement:**
- Every API call validates the API key → resolves `customer_id`
- All Lambda functions call `set_customer_context(customer_id)` before queries
- PostgreSQL RLS policies ensure queries return only that tenant's rows

---

## Key Documentation Index

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview and quick start |
| `GETTING_STARTED.md` | Step-by-step setup guide |
| `API_REFERENCE.md` | Complete API endpoint reference |
| `Securebase-ProductDefinition.md` | Product scope and boundaries |
| `PHASE5_SCOPE.md` | Phase 5 detailed scope and success criteria |
| `DISASTER_RECOVERY_PLAN.md` | DR strategy, RTO/RPO, failover procedures |
| `DR_RUNBOOK.md` | Step-by-step operational runbook |
| `COST_OPTIMIZATION_PLAYBOOK.md` | Cost optimization strategies |
| `SECURITY.md` | Security policies and responsible disclosure |
| `docs/PAAS_ARCHITECTURE.md` | Full PaaS architecture specification |

---

## Tech Stack Reference

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, react-chartjs-2 |
| Backend | Python 3.11, AWS Lambda, API Gateway |
| Database | Aurora Serverless v2 (PostgreSQL 15.4), DynamoDB |
| IaC | Terraform ≥ 1.5.0, AWS Provider ~> 5.0 |
| Auth | AWS IAM Identity Center (SSO), API Keys, JWT |
| Observability | CloudWatch, X-Ray (Phase 5), PagerDuty (Phase 5) |
| Deployment | Netlify (frontend), AWS (backend + infra) |
| CI/CD | GitHub Actions |
