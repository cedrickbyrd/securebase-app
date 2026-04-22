# SecureBase Platform Architecture

> **Audience:** Engineering, Security, and Compliance teams  
> **Last Updated:** April 2026  
> **Status:** Phase 5.3 in progress; Phase 6 planned

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Platform Phases](#3-platform-phases)
4. [High-Level Architecture Diagram](#4-high-level-architecture-diagram)
5. [Phase 1 — AWS Landing Zone](#5-phase-1--aws-landing-zone)
6. [Phase 2 — Serverless Backend](#6-phase-2--serverless-backend)
7. [Phase 3a — Customer Portal](#7-phase-3a--customer-portal)
8. [Phase 3b — Advanced Features](#8-phase-3b--advanced-features)
9. [Phase 4 — Enterprise Features](#9-phase-4--enterprise-features)
10. [Phase 5 — Observability & Multi-Region DR](#10-phase-5--observability--multi-region-dr)
11. [Multi-Tenancy Model](#11-multi-tenancy-model)
12. [Identity & Access Architecture](#12-identity--access-architecture)
13. [Data Architecture](#13-data-architecture)
14. [Network Architecture](#14-network-architecture)
15. [Security Control Layers](#15-security-control-layers)
16. [Compliance Posture](#16-compliance-posture)
17. [Observability Stack](#17-observability-stack)
18. [End-to-End Request Flow](#18-end-to-end-request-flow)
19. [Infrastructure as Code Conventions](#19-infrastructure-as-code-conventions)
20. [Technology Stack Reference](#20-technology-stack-reference)
21. [Threat Model Summary](#21-threat-model-summary)
22. [Decision Log (ADRs)](#22-decision-log-adrs)
23. [Out of Scope](#23-out-of-scope)

---

## 1. Overview

SecureBase is a **security-first, multi-tenant AWS PaaS platform** designed for regulated industries. It provides a complete suite for:

- **Compliance Automation** — continuous evidence collection and drift detection for SOC 2, HIPAA, FedRAMP, and PCI-DSS
- **AI Agent Authentication** — Non-Human Identity (NHI) and machine-to-machine credential lifecycle management
- **Sovereign Infrastructure Orchestration** — customer-dedicated AWS account provisioning with policy-as-code guardrails
- **Operational Observability** — real-time dashboards, alerting, and multi-region disaster recovery

Every component is built with the assumption that all data is sensitive, all access requires justification, and every action must be auditable.

---

## 2. Design Principles

| Principle | Implementation |
|---|---|
| **Least Privilege** | Narrowly scoped IAM roles; no long-lived credentials; AWS IAM Identity Center (SSO) enforced |
| **Secure by Default** | Encryption, logging, and MFA enabled at provisioning time — not as post-hoc additions |
| **Account-Level Isolation** | Each customer tenant runs in a dedicated AWS account to limit blast radius |
| **Centralized Visibility** | All CloudTrail, Config, and VPC Flow Logs aggregated into an immutable Log Archive account |
| **Infrastructure as Code** | 100% of infrastructure provisioned via Terraform; no manual click-ops in production |
| **Defense in Depth** | Preventive (SCPs, IAM), Detective (GuardDuty, Security Hub), and Corrective controls at every layer |
| **API-First** | All portal UIs consume versioned REST APIs; no direct database access from the frontend |

---

## 3. Platform Phases

```
Phase 1  ──▶  AWS Landing Zone (Terraform IaC)                ✅ Complete
Phase 2  ──▶  Serverless Database & API Backend               ✅ Complete
Phase 3a ──▶  Customer Portal (React SPA)                     ✅ Complete
Phase 3b ──▶  Support Tickets, Webhooks & Cost Forecasting    ✅ Complete
Phase 4  ──▶  Enterprise: RBAC, Analytics, Notifications      ✅ Complete
Phase 5.1──▶  Executive / Admin Dashboard                     ✅ Complete
Phase 5.2──▶  Tenant Dashboard & Compliance Drift             ✅ Complete
Phase 5.3──▶  Multi-Region DR, Alerting & Cost Optimization   🔨 In Progress
Phase 6  ──▶  Compliance Automation & Operations Scale        📅 Planned
```

---

## 4. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          End Users / Tenants                            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS
                    ┌───────────▼────────────┐
                    │   Netlify CDN / Edge   │  (Marketing site + Portal SPA)
                    │  + Netlify Redirects   │  (proxies /api/* → API GW)
                    └───────────┬────────────┘
                                │
              ┌─────────────────▼──────────────────┐
              │         AWS API Gateway             │
              │   (REST, regional, custom domain)   │
              └────┬───────────┬───────────┬────────┘
                   │           │           │
          ┌────────▼──┐  ┌─────▼─────┐  ┌─▼──────────┐
          │  Auth     │  │  Billing  │  │  Tenant    │
          │  Lambda   │  │  Lambda   │  │  Metrics   │
          │  (auth_v2)│  │  (billing │  │  Lambda    │
          └────┬──────┘  │   _worker)│  └────┬───────┘
               │         └─────┬─────┘       │
               │               │             │
        ┌──────▼───────────────▼─────────────▼──────────┐
        │              Aurora PostgreSQL (RLS)           │
        │          + DynamoDB (metrics/audit trail)      │
        └────────────────────────────────────────────────┘
               │                                 │
        ┌──────▼──────────┐         ┌────────────▼───────┐
        │  AWS Secrets    │         │   CloudWatch /     │
        │  Manager        │         │   Security Hub /   │
        │  (DB creds,     │         │   GuardDuty        │
        │   API keys)     │         └────────────────────┘
        └─────────────────┘
               │
   ┌───────────▼────────────────────────────────────────┐
   │             AWS Organizations (Phase 1)            │
   │  ┌─────────┐  ┌──────────────┐  ┌───────────────┐ │
   │  │ Mgmt    │  │  Security OU │  │  Workloads OU │ │
   │  │ Account │  │  (Log + Audit│  │  (per-tenant  │ │
   │  │         │  │   accounts)  │  │   accounts)   │ │
   │  └─────────┘  └──────────────┘  └───────────────┘ │
   └────────────────────────────────────────────────────┘
```

---

## 5. Phase 1 — AWS Landing Zone

**Directory:** `landing-zone/`  
**Entry point:** `landing-zone/environments/{env}/main.tf`

### 5.1 Purpose

Establishes a compliant AWS Organizations hierarchy with security guardrails applied at account creation time. Eliminates the need for AWS Control Tower by providing full Terraform transparency.

### 5.2 Account Structure

```
Management (Root)
├── Security OU
│   ├── Log Archive Account   — immutable CloudTrail/Config logs, S3 Object Lock (7-year)
│   └── Security/Audit Account — Security Hub aggregator, GuardDuty, AWS Config, read-only access
├── Shared Services OU
│   ├── Networking Account    — Transit Gateway hub, VPC IPAM, centralized egress
│   └── Tools/DevOps Account  — CI/CD pipelines, artifact storage
└── Workloads OU
    ├── Production Account    — customer-facing workloads
    ├── Staging Account       — pre-production validation
    └── Development Account   — sandbox (auto-shutdown policies active)
```

Customer tenants receive **dedicated AWS accounts** under the Workloads OU, further separated by compliance tier:

- `Customers-Healthcare` OU — HIPAA controls
- `Customers-Fintech` OU — SOC 2 + PCI-aligned
- `Customers-Government` OU — FedRAMP Moderate
- `Customers-Standard` OU — CIS AWS Foundations Benchmark

### 5.3 Key Terraform Modules

| Module | Purpose |
|---|---|
| `modules/org/` | Creates OUs, SCPs, account factory; loops over `var.customers` |
| `modules/identity/` | IAM Identity Center permission sets; SSO group assignments |
| `modules/security/` | GuardDuty, Security Hub, AWS Config, Macie |
| `modules/logging/` | Organization CloudTrail, S3 Object Lock log archive |
| `modules/vpc/` | Standardized 3-tier VPC (public/private/isolated) |
| `modules/phase2-database/` | Aurora Serverless v2, DynamoDB tables, Lambda IAM roles |
| `modules/api-gateway/` | REST API + Lambda integrations + API key auth |
| `modules/phase5-admin-metrics/` | CloudWatch aggregation Lambda, admin DynamoDB tables |
| `modules/phase5-tenant-metrics/` | Per-tenant metrics/violations/audit-trail DynamoDB tables (KMS) |
| `modules/multi-region/` | Aurora Global DB, DynamoDB Global Tables, Route 53 failover *(Phase 5.3)* |

### 5.4 Service Control Policies (SCPs)

SCPs apply a deny-by-default posture for high-risk actions:

- Deny disabling CloudTrail or AWS Config
- Deny root user actions (CIS 1.7)
- Restrict resource creation to approved AWS Regions
- Deny leaving the AWS Organization
- Enforce MFA for sensitive operations

### 5.5 Deployment

```bash
# Always run from the environment directory
cd landing-zone/environments/dev
terraform init && terraform plan && terraform apply
```

---

## 6. Phase 2 — Serverless Backend

**Directory:** `phase2-backend/`

### 6.1 Database

**Aurora PostgreSQL 15.4 (Serverless v2)** with Row-Level Security (RLS) enforced at the session level.

| Table Group | Tables |
|---|---|
| Core | `customers`, `api_keys`, `sessions` |
| Billing | `invoices`, `usage_metrics`, `subscription_plans` |
| Compliance | `compliance_controls`, `compliance_events`, `audit_logs` |
| Support | `support_tickets`, `ticket_comments` |
| Notifications | `notification_preferences`, `notification_history` |
| RBAC | `roles`, `permissions`, `role_assignments`, `team_members` |

**RLS pattern** — every table with customer data uses:

```sql
CREATE POLICY customer_isolation ON <table>
  USING (customer_id = current_setting('app.current_customer_id')::UUID);
```

Lambda functions call `set_rls_context(customer_id)` before any query via `db_utils.py`.

### 6.2 Lambda Functions

All functions live in `phase2-backend/functions/` and share utilities via a Lambda Layer (`phase2-backend/lambda_layer/python/db_utils.py`).

| Function | Trigger | Responsibility |
|---|---|---|
| `auth_v2.py` | API GW | API key validation, JWT issuance, session management |
| `billing_worker.py` | EventBridge (monthly) | Invoice generation, Stripe subscription sync |
| `metrics.py` | API GW | Usage aggregation for billing |
| `report_engine.py` | API GW | PDF/Excel compliance reports (ReportLab layer) |
| `analytics_aggregator.py` | API GW | Cross-tenant analytics for admin dashboard |
| `tenant_metrics.py` | API GW | Per-tenant compliance, usage, cost (6 endpoints, JWT auth) |
| `metrics_aggregation.py` | API GW | CloudWatch + Cost Explorer aggregation for admin dashboard |
| `notification_worker.py` | EventBridge / SQS | Email/webhook notification delivery |
| `webhook_manager.py` | API GW | Customer webhook CRUD + delivery retry |
| `cost_forecasting.py` | API GW | 12-month cost projection using Cost Explorer |
| `rbac_engine.py` | API GW | RBAC permission evaluation |
| `audit_logging.py` | API GW | Structured audit event ingestion |
| `create_checkout_session.py` | API GW | Stripe Checkout session creation |
| `stripe_webhook.py` | API GW | Stripe event processing (subscription lifecycle) |
| `support_tickets.py` | API GW | Support ticket CRUD |
| `submit_lead.py` | API GW | Lead capture → database |
| `user_management.py` | API GW | Team member invite/remove |
| `session_management.py` | API GW | FedRAMP-compliant session lifecycle (15-min idle, 8-hr absolute) |
| `failover_orchestrator.py` | EventBridge *(planned)* | Automated us-east-1 → us-west-2 failover |
| `health_check_aggregator.py` | Route 53 *(planned)* | Custom health check aggregation |

### 6.3 API Gateway

- Regional REST API with custom domain (`api.securebase.tximhotep.com`)
- Lambda proxy integration for all endpoints
- API key authentication via `X-API-Key` header
- Stage: `prod`
- Redeployment triggered by resource/method changes in `apigateway_deployment.tf`

---

## 7. Phase 3a — Customer Portal

**Directory:** `phase3a-portal/`  
**Stack:** React 18, Vite 5, Tailwind CSS, Chart.js  
**Hosted:** Netlify (CDN + edge functions)

### 7.1 Application Structure

```
phase3a-portal/src/
├── components/         # Feature UI components
│   ├── admin/          # AdminDashboard, SystemHealth
│   ├── tenant/         # TenantDashboard, ComplianceDrift
│   ├── Dashboard.jsx   # Main tenant metrics dashboard
│   ├── Compliance.jsx  # Security Hub findings, Config violations
│   ├── Invoices.jsx    # Invoice list + PDF download
│   ├── ApiKeys.jsx     # API key CRUD (create / revoke / rotate)
│   ├── SREDashboard.jsx# SRE operations view
│   ├── Analytics.jsx   # Usage analytics
│   └── ...
├── services/
│   ├── apiService.js   # All Phase 2 API calls (JWT auth, sessionStorage)
│   ├── adminService.js # Admin API client (mock via VITE_USE_MOCK_API)
│   ├── sreService.js   # SRE metrics client
│   └── ...
├── config/
│   └── live-config.js  # Pricing tier definitions (billingType per tier)
└── utils/
    └── analytics.js    # GA4 with IP anonymization + PII path sanitization
```

### 7.2 Authentication

Tenants authenticate using **email + API key** against the `/auth/login` Lambda endpoint. The resulting JWT `sessionToken` is stored in `sessionStorage` (never `localStorage`) and included as a Bearer token on all subsequent requests. The Supabase client is **not** used in the portal auth flow.

Demo access is provided via a dedicated `/api/demo-auth` Netlify function (`demo-auth.js`) that issues short-lived JWTs for five built-in demo accounts.

### 7.3 Netlify Redirects

The Netlify CDN proxies all `/api/*` calls to the appropriate backend with zero origin exposure:

| Route | Destination |
|---|---|
| `POST /api/login` | AWS API GW → `auth_v2` Lambda |
| `POST /api/checkout` | AWS API GW → `create_checkout_session` Lambda |
| `POST /api/signup` | `https://api.securebase.tximhotep.com/signup` |
| `GET /api/onboarding/*` | `https://api.securebase.tximhotep.com/onboarding/:splat` |
| `* /admin/*` | Netlify function `get-admin-metrics` *(migration target: API GW)* |
| `POST /api/demo-auth` | Netlify function `demo-auth` |

---

## 8. Phase 3b — Advanced Features

**Directory:** `phase2-backend/functions/`

| Feature | Lambda | Notes |
|---|---|---|
| Support Tickets | `support_tickets.py` | Full CRUD; comments; status transitions |
| Webhooks | `webhook_manager.py` | Customer-configurable endpoints; delivery retry queue |
| Cost Forecasting | `cost_forecasting.py` | 12-month projections via AWS Cost Explorer |
| Performance | `phase3b-performance/` (Terraform) | ElastiCache Redis, Lambda concurrency tuning |

---

## 9. Phase 4 — Enterprise Features

### 9.1 Role-Based Access Control (RBAC)

`rbac_engine.py` evaluates permission requests against the `roles`/`permissions`/`role_assignments` schema. Permissions are scoped to resources (e.g., `invoices:read`, `api_keys:rotate`). Permission sets are managed via the Team Management portal UI.

### 9.2 Analytics

`analytics_aggregator.py` exposes cross-tenant usage and revenue metrics to the Admin Dashboard. Per-tenant analytics are surfaced by `analyticsService.js` in the portal.

### 9.3 Notifications

`notification_worker.py` delivers email (SES) and webhook notifications based on customer preferences. Notification history is stored in DynamoDB. The portal exposes `NotificationCenter.jsx` and `NotificationSettings.jsx`.

### 9.4 White-Label

Tenant branding (logo, primary color, domain) is stored per customer record and applied at portal render time via `PersonalizedBanner.jsx`.

### 9.5 Report Engine

`report_engine.py` generates PDF compliance reports using ReportLab (via a dedicated Lambda Layer at `phase2-backend/layers/reporting/`). HTML-to-PDF export is also supported via the portal using `jsPDF` + `html2canvas`.

---

## 10. Phase 5 — Observability & Multi-Region DR

### 10.1 Admin Dashboard (Phase 5.1)

`AdminDashboard.jsx` aggregates 7 metric sections (active customers, revenue, API usage, compliance posture, infrastructure health, security events, cost trends) using exponential back-off auto-refresh. Data sourced from `adminService.js` → `/admin/*` API Gateway routes.

### 10.2 Tenant Dashboard & Compliance Drift (Phase 5.2)

`TenantDashboard.jsx` surfaces per-tenant: compliance score, usage, current month cost, and active alerts. `ComplianceDrift.jsx` renders a 90-day drift timeline with MTTR analytics, sourced from `securebase-compliance-violations` DynamoDB table.

### 10.3 Multi-Region DR (Phase 5.3 — In Progress)

**Objective:** RTO < 15 minutes, RPO < 1 minute, 99.95% uptime SLA.

| Component | Primary (us-east-1) | Secondary (us-west-2) |
|---|---|---|
| Database | Aurora PostgreSQL (writer) | Aurora Global Database (reader, promoted on failover) |
| Key-value store | DynamoDB (primary tables) | DynamoDB Global Tables (replicated) |
| Object storage | S3 (primary) | S3 CRR (cross-region replication) |
| DNS | Route 53 (active) | Route 53 health-check failover record |
| CDN | CloudFront (primary origin) | CloudFront (secondary origin) |

Failover orchestration will be automated via `failover_orchestrator.py` (Lambda, EventBridge trigger).

### 10.4 Alerting & Incident Response (Phase 5.3)

- CloudWatch alarms → SNS topics → PagerDuty / email
- Runbook automation for common failure scenarios
- SRE Dashboard (`SREDashboard.jsx`) shows memory (purple `#9333EA`), CPU, error rate, and latency in real time

---

## 11. Multi-Tenancy Model

Every tenant is isolated at **three boundaries**:

| Boundary | Mechanism |
|---|---|
| AWS Account | Dedicated account per customer; SCPs enforce guardrails |
| Network | Customer-specific VPC; no cross-tenant Transit Gateway routes |
| Database | PostgreSQL RLS (`app.current_customer_id` session variable) |

### Compliance Tiers

| Tier | OU | Frameworks |
|---|---|---|
| `healthcare` | `Customers-Healthcare` | HIPAA, HITECH |
| `fintech` | `Customers-Fintech` | SOC 2 Type II, PCI-DSS-aligned |
| `government` | `Customers-Government` | FedRAMP Moderate |
| `standard` | `Customers-Standard` | CIS AWS Foundations |

Customer definitions are stored in `landing-zone/environments/{env}/client.auto.tfvars` and never hardcoded in module logic.

---

## 12. Identity & Access Architecture

### 12.1 Human Identity

```
Engineer/Admin → IdP (SAML/OIDC) → AWS IAM Identity Center → Time-bound Account Role
```

- No IAM users in workload accounts
- Group-based permission sets (Platform Engineer, Read-Only Auditor, Emergency Admin)
- MFA enforced at the IdP level
- Break-glass emergency admin role: manual MFA, 1-hour session, offline credential storage, mandatory CloudTrail log

### 12.2 Non-Human / API Identity

Tenant applications authenticate to the SecureBase API via **API keys**:

1. Customer generates an API key in the portal (`ApiKeys.jsx`)
2. `auth_v2.py` validates the key, retrieves `customer_id`, sets RLS context
3. Downstream Lambdas operate within the customer's data scope
4. API key rotation is supported via `api_key_rotation.py`

---

## 13. Data Architecture

### 13.1 Operational Database (Aurora PostgreSQL)

- Version: PostgreSQL 15.4 (Aurora Serverless v2)
- Extensions: `uuid-ossp`, `pgcrypto`, `pg_stat_statements`
- Encryption: KMS CMK at rest, TLS 1.3 in transit
- RLS policies on all multi-tenant tables
- Connection pooling via Lambda Layer (`db_utils.py`)

### 13.2 Metrics & Audit Store (DynamoDB)

| Table | Purpose | Encryption |
|---|---|---|
| `securebase-metrics-history` | Time-series usage and performance metrics | KMS CMK |
| `securebase-compliance-violations` | Drift events with timestamp and severity | KMS CMK |
| `securebase-audit-trail` | Immutable record of all user/system actions | KMS CMK |

### 13.3 Object Storage (S3)

- Compliance evidence: S3 Object Lock (Compliance Mode, 7-year retention)
- Terraform state: encrypted S3 + DynamoDB state lock
- Lambda deployment artifacts: encrypted S3
- All buckets: versioning enabled, public access blocked, AES-256 SSE

---

## 14. Network Architecture

### 14.1 VPC Design

Each workload account uses a standardized 3-tier VPC:

```
┌───────────────────────────────────────┐
│  Public Subnet (ALB, NAT GW)          │
├───────────────────────────────────────┤
│  Private Subnet (Lambda, Aurora)      │
├───────────────────────────────────────┤
│  Isolated Subnet (DB replicas, cache) │
└───────────────────────────────────────┘
```

### 14.2 Connectivity

- **Hub-and-spoke:** AWS Transit Gateway routes traffic between workload VPCs and Shared Services (centralized egress/inspection)
- **No direct internet ingress** to production workloads; all inbound traffic flows through API Gateway + CloudFront
- **VPC Endpoints** for S3, DynamoDB, Secrets Manager, and KMS — eliminates internet traversal for AWS service calls
- **VPC Flow Logs** forwarded to Log Archive account

---

## 15. Security Control Layers

### Preventive Controls

- SCPs (deny root actions, deny CloudTrail disable, restrict regions, deny leave-org)
- IAM policies with least-privilege scoping
- S3 account-level public access block
- API Gateway throttling and WAF rules
- Content Security Policy headers (configured in `netlify.toml`)

### Detective Controls

- Organization-wide CloudTrail (management + data events)
- AWS Config rules (continuous compliance evaluation)
- Amazon GuardDuty (threat intelligence, anomaly detection)
- Security Hub (aggregated findings, FSBP standards)
- IAM Access Analyzer (external resource exposure)
- Structured audit logs written to `securebase-audit-trail` DynamoDB table for every authenticated action

### Data Protection

- AES-256 encryption at rest for all S3, Aurora, DynamoDB, and EBS volumes
- TLS 1.3 enforced in transit
- Secrets Manager for database credentials, API keys, and Stripe keys (no hardcoded secrets anywhere)
- PHI/PII never logged to CloudWatch Logs or GA4 events

---

## 16. Compliance Posture

| Framework | Coverage |
|---|---|
| **SOC 2 Type II** | CC 6.1 (Access Controls via IAM Identity Center + RLS), CC 7.2 (Centralized Audit Logs), CC 9.2 (Vendor Management), CC 6.6 (API Key Management) |
| **FedRAMP Moderate** | MFA (IA-2), Session timeout (AC-12), FIPS encryption (SC-28), Audit logging (AU-2), Incident response (IR-4) |
| **HIPAA** | PHI never logged, de-identification in dev, break-glass access with audit trail, breach notification alerting |
| **CIS AWS Foundations** | Benchmark v1.4 implemented for standard-tier customers |
| **NIST SP 800-53** | AC-2 (Account Management), AC-6 (Least Privilege), AU-2 (Audit Events), CM-2 (Baseline Configuration), IA-5 (Authenticator Management) |

Detailed control mappings are in `landing-zone/compliance.md`.

---

## 17. Observability Stack

| Layer | Tool | Data |
|---|---|---|
| Infrastructure metrics | CloudWatch | Lambda duration/errors, Aurora CPU/connections, API GW latency |
| Distributed tracing | AWS X-Ray | End-to-end request traces across API GW → Lambda → Aurora |
| Log aggregation | CloudWatch Logs → Log Archive S3 | Structured JSON logs from all Lambdas |
| Security findings | Security Hub | GuardDuty, Config, IAM Analyzer findings |
| Application metrics | DynamoDB (`securebase-metrics-history`) | Per-tenant usage, compliance score, cost |
| Frontend analytics | GA4 (anonymized IP, no PII) | Page views, feature usage, funnel analysis |
| Alerting | CloudWatch Alarms → SNS → PagerDuty | Threshold breaches on latency, error rate, cost |
| SRE dashboard | `SREDashboard.jsx` | Real-time p95 latency, memory (purple), CPU, error rate |

---

## 18. End-to-End Request Flow

```
1. Tenant browser  ──HTTPS──▶  Netlify CDN
2. Netlify CDN     ──proxy──▶  AWS API Gateway  (via netlify.toml redirect)
3. API Gateway     ──invoke─▶  auth_v2 Lambda
4. auth_v2         ──query──▶  Aurora (validate API key, fetch customer_id)
5. auth_v2         ──SET────▶  app.current_customer_id = '<uuid>'  (RLS context)
6. auth_v2         ──query──▶  Aurora (fetch customer data, RLS active)
7. auth_v2         ──return─▶  JSON response  ──▶  Netlify  ──▶  Browser
8. Every Lambda    ──write──▶  securebase-audit-trail DynamoDB  (audit log)
9. CloudTrail      ──ship───▶  Log Archive S3  (immutable, 7-year retention)
```

---

## 19. Infrastructure as Code Conventions

### Directory Structure

```
landing-zone/
├── environments/
│   ├── dev/          ← Deploy from here: terraform apply
│   ├── staging/
│   └── production/
├── modules/          ← Reusable, environment-agnostic modules
│   ├── org/
│   ├── phase2-database/
│   ├── api-gateway/
│   └── ...
├── main.tf           ← Root module (called by environment dirs via symlink)
├── variables.tf
└── outputs.tf
```

### Conventions

- All modules are **environment-agnostic** — customer/environment config lives in `client.auto.tfvars` and `terraform.tfvars` only
- Every resource must include compliance tags: `Environment`, `ComplianceFramework`, `DataClassification`, `ManagedBy`
- Encryption variables (`encryption_at_rest`, `encryption_in_transit`) must be exposed and default to `true` / `"TLSv1_3_2021"`
- Terraform state in encrypted S3 with DynamoDB locking; access restricted to CI/CD role
- New API routes must be added to `apigateway_deployment.tf` triggers to force redeployment

---

## 20. Technology Stack Reference

| Layer | Technology | Version |
|---|---|---|
| Marketing site | React + Vite | React 19, Vite 6 |
| Customer portal | React + Vite | React 18, Vite 5 |
| Styling | Tailwind CSS | 4.x |
| Charts | react-chartjs-2 + Chart.js | — |
| PDF export | jsPDF + html2canvas | — |
| Analytics | react-ga4 (GA4, anonymized) | — |
| Backend runtime | Python 3.11 (Lambda) | — |
| Database | Aurora PostgreSQL (Serverless v2) | 15.4 |
| Key-value | DynamoDB | — |
| IaC | Terraform + AWS provider | ~> 5.0 |
| Node.js runtime | Node LTS | 20.x |
| CI/CD | GitHub Actions | — |
| Hosting | Netlify (frontend) + AWS (backend) | — |

---

## 21. Threat Model Summary

The architecture mitigates the following top threats:

| Threat | Mitigation |
|---|---|
| Compromised developer credentials | No long-lived IAM user keys; IAM Identity Center + MFA enforced |
| Accidental public resource exposure | S3 public access blocks; Security Hub continuous monitoring |
| Privilege escalation within accounts | SCPs + narrowly scoped IAM roles; IAM Access Analyzer |
| Cross-tenant data access | PostgreSQL RLS + per-customer AWS accounts |
| Audit log tampering | S3 Object Lock (Compliance Mode); SCP denying CloudTrail disable |
| Insider misuse | Break-glass audit trail; least-privilege permission sets; time-bound sessions |
| Secrets exposure | Secrets Manager; no hardcoded credentials; `npm audit` in CI |
| Supply chain attacks | GitHub Actions pinned to major versions; dependency scanning |
| DDoS / API abuse | API Gateway throttling; WAF rules; Netlify rate limiting |

Detailed threat analysis: `landing-zone/threat-model.md`

---

## 22. Decision Log (ADRs)

| Decision | Choice | Rationale |
|---|---|---|
| IaC platform | Terraform (not AWS Control Tower) | Full HCL transparency; auditors can inspect every resource; supports third-party providers (Datadog, Cloudflare) in the same state |
| Multi-account strategy | AWS Organizations + dedicated customer accounts | Blast-radius containment; simplifies compliance scoping; enforces billing boundaries |
| Database multi-tenancy | PostgreSQL RLS over separate schemas or separate databases | Operational simplicity; strong isolation with single cluster; avoids connection pool explosion |
| Frontend hosting | Netlify (not S3/CloudFront self-managed) | Zero-config CDN, atomic deploys, instant rollbacks; Netlify redirect layer proxies API calls at zero cost |
| Backend functions | New Netlify Functions **not created**; all backend logic in AWS Lambda | AWS Lambda free tier is 8× larger; existing API Gateway already deployed; avoids Netlify per-invocation billing |
| Auth storage | `sessionStorage` (not `localStorage`) | Tokens cleared on tab close; reduces XSS exposure window |
| Observability | CloudWatch + X-Ray + Security Hub | Native AWS integration; no additional cost for existing Lambda and API GW workloads |

---

## 23. Out of Scope

The following are explicitly not covered by this platform architecture:

- Application-level security for tenant workloads (tenants own their app security)
- Data classification enforcement beyond tagging
- FedRAMP High or IL5/IL6 controls
- GDPR-specific data residency enforcement (addressable via region selection)
- Automated incident response playbooks (Phase 6 roadmap)

---

*For deployment instructions see [`GETTING_STARTED.md`](../GETTING_STARTED.md). For API contracts see [`docs/PHASE4_API_REFERENCE.md`](PHASE4_API_REFERENCE.md). For compliance control mappings see [`landing-zone/compliance.md`](../landing-zone/compliance.md).*
