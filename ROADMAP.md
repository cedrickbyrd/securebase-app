# SecureBase — Product Roadmap

**Last Updated:** March 2026  
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
| [Phase 5](#phase-5--observability--multi-region-dr) | Observability, Monitoring & Multi-Region DR | 🔄 In Progress | ~20% |
| [Phase 6](#phase-6--compliance--operations-scale) | Compliance Automation & Operations Scale | 📅 Planned | 0% |

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

**Status:** 🔄 In Progress (~20%)  
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

#### 5.1 Executive/Admin Dashboard ✅ Code Complete
- `AdminDashboard.jsx` (542 lines) — deployed as part of Phase 4
- `SystemHealth.jsx` (256 lines) — real-time health widget
- `metrics_aggregation.py` (539 lines) — CloudWatch + Cost Explorer Lambda
- **Remaining:** Wire to live CloudWatch API Gateway endpoint; deploy infrastructure

#### 5.2 Tenant/Customer Dashboard 📅 Not Started
- `TenantDashboard.jsx` — compliance drift, usage metrics, cost breakdown
- `ComplianceDrift.jsx` — visual drift detection timeline
- DynamoDB `metrics_history` table for time-series storage

#### 5.3 SRE Operations Dashboard 📅 Not Started
- `SREDashboard.jsx` — Lambda cold starts, DB IOPS, DLQ depth
- Pre-built CloudWatch Insights queries
- On-call runbook integration

#### 5.4 Multi-Region Infrastructure 📅 Not Started
- Aurora Global Database (us-east-1 → us-west-2, <1 min RPO)
- S3 Cross-Region Replication (CRR) for audit logs
- Route 53 health-check-based failover for `securebase.tximhotep.com`
- Terraform modules in `landing-zone/modules/multi-region/`

#### 5.5 Alerting & Incident Response 📅 Not Started
- PagerDuty integration via SNS → Lambda → PagerDuty API
- CloudWatch anomaly detection alarms
- Automated runbook execution for common failure modes

#### 5.6 Distributed Tracing 📅 Not Started
- AWS X-Ray enabled on all Lambda functions
- VPC Flow Logs for zero-leakage verification
- CloudWatch ServiceLens integration

### Acceptance Criteria
- [ ] 99.95% uptime SLA capability
- [ ] Automated failover success rate >95%
- [ ] Alert response time <5 minutes
- [ ] Dashboard load time <2 seconds
- [ ] Zero data loss during regional failover
- [ ] X-Ray traces visible for all API call paths

---

## Phase 6 — Compliance Automation & Operations Scale

**Status:** 📅 Planned (Starts after Phase 5)  
**Theme:** Make compliance a product feature, not an afterthought.

### Planned Work

#### 6.1 Immutable Audit Logging at Scale
- Full "Compliance Mode" S3 Object Lock (7-year retention, WORM)
- Automated evidence packaging for SOC 2 Type II and HIPAA audits
- AWS Macie scanning for accidental PII exposure in logs

#### 6.2 Compliance Automation (50+ AWS Config Rules)
- Automated mapping: SOC 2 CC controls → AWS Config rules
- HIPAA technical safeguards mapped to GuardDuty findings
- FedRAMP Rev 5 baseline mapped to Security Hub standards
- Daily compliance score recalculation with trend history

#### 6.3 Scalability to 10,000+ Concurrent Users
- Aurora Serverless v2 auto-scaling tuning
- Lambda provisioned concurrency for latency-sensitive paths
- API Gateway caching with per-customer cache keys
- DynamoDB on-demand billing with GSI optimization

#### 6.4 Build Debt Cleanup
- Remove `--legacy-peer-deps` from all npm installs (align peer versions)
- Migrate mock data services (`mockApiService.js`) to integration test fixtures
- Consolidate ~200 root-level markdown files into `docs/` structure
- Retire standalone shell scripts in favor of GitHub Actions workflows

#### 6.5 Developer Experience
- One-command local dev setup (`docker compose up`)
- Storybook component library for portal UI
- OpenAPI spec generated from Lambda function signatures
- End-to-end test suite covering all critical user journeys

---

## Current Priorities (March 2026)

1. **Complete Phase 5.2–5.6** — Tenant dashboard, SRE dashboard, multi-region DR, alerting
2. **Deploy Phase 5.1 infrastructure** — Wire AdminDashboard to live CloudWatch endpoints
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
