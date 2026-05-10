xX# CLAUDE.md - SecureBase Development Guide

**Repository:** `cedrickbyrd/securebase-app`  
**Role Context:** Principal Cloud Architect | Compliance-First SaaS Platform  
**Mission:** Build SOC 2, FedRAMP, and HIPAA-ready infrastructure and features

---

## 🎯 Project Overview

SecureBase is a security-first, multi-tenant AWS PaaS platform that has evolved from an AWS landing zone orchestrator into a comprehensive suite for **compliance automation**, **AI Agent Authentication**, **Non-Human Identity Management (NHI/IAM)**, and **Sovereign Infrastructure Orchestration**. Every code change must prioritize security, auditability, and regulatory compliance.

**Current Phase Status (May 2026):**
| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | AWS Landing Zone (Terraform IaC) | ✅ Complete |
| Phase 2 | Serverless Database & API Backend | ✅ Complete |
| Phase 3a | Customer Portal (React) | ✅ Complete |
| Phase 3b | Support Tickets, Webhooks & Cost Forecasting | ✅ Complete |
| Phase 4 | Enterprise Features (RBAC, Analytics, Notifications) | ✅ Complete |
| Phase 5.1 | Executive/Admin Dashboard | ✅ Complete |
| Phase 5.2 | Tenant/Customer Dashboard & Compliance Drift | ✅ Complete |
| Phase 5.3 | SRE Dashboard Backend, Logging & Cost Optimization | ✅ Complete |
| Phase 5.4 | Multi-Region DR Production Wiring (49/49 applied) | ✅ Complete — validation gates open |
| Phase 5.5 | Alerting & Incident Response | ✅ Complete (delivered within 5.3 sprint) |
| Phase 5.6 | Distributed Tracing (AWS X-Ray) | ✅ Complete (delivered within 5.3 sprint) |
| Phase 6 | Compliance Automation & Operations Scale | 🔨 In Progress |

> **Phase 5 is complete.** All six sub-phases (5.1–5.6) are delivered. The only open item is the Phase 5.4 production validation gates — run `.github/workflows/validate-dr.yml` to close them, then conduct the first DR drill.

### Phase 5 Delivery Map

Phases 5.5 and 5.6 were scoped as standalone phases in Sprint #2 (PR #475, April 9, 2026) but were delivered within the 5.3 sprint as `phase5-alerting/` and `phase5-logging/` Terraform modules respectively. See `PHASE5.5_5.6_COMPLETE.md` for the full delivery record.

| Phase | Terraform Module | Key Deliverable |
|-------|------------------|-----------------|
| 5.1 | `phase5-admin-metrics/` | AdminDashboard.jsx, 7 `/admin/*` endpoints |
| 5.2 | `phase5-tenant-metrics/` | TenantDashboard.jsx, ComplianceDrift.jsx |
| 5.3 | `phase5-sre-metrics/`, `phase5-cost/` | SREDashboard.jsx (58 KB), cost optimization |
| 5.4 | `multi-region/` | 49/49 AWS resources, CloudFront failover |
| 5.5 | `phase5-alerting/` | 40+ alarms, PagerDuty/Opsgenie, alert router |
| 5.6 | `phase5-logging/` | X-Ray tracing, 20+ Logs Insights queries |

### 🔨 Phase 6 — Active Sprint

> See [`PHASE6_SCOPE.md`](PHASE6_SCOPE.md) for the full scope definition.

- **6.1 Immutable Audit Logging** — S3 Object Lock (COMPLIANCE mode, 7-year), Macie, `audit_log_packager.py`
- **6.2 Compliance Automation** — 50+ AWS Config rules, SOC 2/HIPAA/FedRAMP conformance packs, daily compliance scoring
- **6.3 Scalability** — Lambda provisioned concurrency, API GW caching, Aurora ACU 2–128
- **6.4 Build Debt** — remove `--legacy-peer-deps`, migrate mock data, consolidate root markdown
- **6.5 Developer Experience** — `docker-compose.yml`, Storybook, OpenAPI spec, Playwright E2E

**Core Principles:**
- Security by default, not by addition
- Least privilege access at every layer
- Audit trails for all data operations
- Infrastructure as Code for reproducibility

---

## 🛠 Build & Environment Constraints

### Package Management
```bash
# REQUIRED: Always use --legacy-peer-deps for chart dependencies
npm install react-chartjs-2 chart.js --save --legacy-peer-deps
npm install --legacy-peer-deps
```

### Lock File Policy

The `package-lock.json` out-of-sync with `package.json` is the **#1 cause of CI/CD failures**. All deploy workflows use `npm ci`, which requires exact sync.

- Always run `npm install` (not `npm ci`) locally when adding packages
- Always commit updated `package-lock.json`
- This repo has **two separate npm packages**: root `/` (React 19, Vite 6) and `phase3a-portal/` (React 18, Vite 5)
- `@supabase/supabase-js` is root-only — do NOT add to `phase3a-portal/` (removed in PR #508)

### Technology Stack
- **Frontend:** React 18+ / `.jsx` in portal, `.tsx` in marketing site
- **Build Tool:** Vite | **Styling:** Tailwind CSS | **Charts:** react-chartjs-2 + chart.js
- **PDF:** jspdf + html2canvas | **Analytics:** GA4 with privacy controls
- **Backend/Auth:** Supabase (portal only) — marketing site uses Lambda JWT (PR #508)
- **Runtime:** Node.js LTS (v20.x)

### Auth Architecture

| Context | Auth Method | Notes |
|---|---|---|
| Marketing site `/signup` | AWS Lambda (`/api/signup`) | Supabase auth removed in PR #508 |
| Portal (`phase3a-portal`) | Supabase Auth | Still active |

### Environment Variables
```env
VITE_API_BASE_URL=https://api.securebase.tximhotep.com
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_DEMO_MODE=false
VITE_DEMO_USER_EMAIL=demo@securebase.tximhotep.com
VITE_USE_MOCK_API=false
```

---

## 🛡 Compliance & Security Standards

### Security Checklist for All Code Changes

- [ ] No hardcoded credentials, API keys, or secrets
- [ ] PII/PHI never logged to console or error messages
- [ ] GA4 tracking excludes all PII/PHI
- [ ] Supabase RLS enforced
- [ ] Input validation on all user-provided data
- [ ] Dependencies scanned (`npm audit`)

---

## 📝 Code Style & Patterns

### React Component Architecture

```typescript
interface ComplianceCheckProps {
  controlId: string;
  status: 'passing' | 'failing' | 'pending';
}

export const ComplianceCheck: React.FC<ComplianceCheckProps> = ({ controlId, status }) => {
  return <div className="p-4 border rounded-lg">{/* Tailwind */}</div>;
};
```

### GA4 — Privacy-First (HIPAA)

NEVER track: user emails, org names, audit findings, compliance scores, PHI.
Always anonymize IP, disable ad signals, sanitize URL paths.

---

## 🚀 Git Workflow

> **Documentation Policy:** New docs go in `docs/`. Do NOT create new `*.md` files in the repository root.

### Commit Messages (Conventional Commits)
```bash
git commit -m "feat: add automated SOC 2 evidence collection"
git commit -m "fix: resolve session timeout race condition"
git commit -m "infra: add CloudWatch alarms for API latency"
git commit -m "security: update dependency to patch CVE"
```

---

## ⚙️ GitHub Actions & CI/CD

```yaml
permissions:
  contents: read
  id-token: write  # OIDC for AWS — never use long-lived access keys
```

---

## 💰 Cost Optimization: Avoid Netlify Functions

**Policy:** Do NOT introduce new Netlify Functions. Use AWS Lambda + API Gateway or direct Supabase client calls.

```toml
# netlify.toml — add new routes here instead of new Netlify functions
[[redirects]]
  from   = "/api/new-endpoint"
  to     = "https://api.securebase.tximhotep.com/new-endpoint"
  status = 200
  force  = true
```

---

## 🔭 Phase 5 Observability Architecture (Complete)

### Terraform Modules
- `landing-zone/modules/phase5-admin-metrics/` — CloudWatch Lambda + 7 `/admin/*` endpoints
- `landing-zone/modules/phase5-tenant-metrics/` — Per-tenant DynamoDB with KMS
- `landing-zone/modules/phase5-logging/` — CloudWatch log groups, X-Ray tracing ✅ (5.6)
- `landing-zone/modules/phase5-alerting/` — 40+ alarms, SNS, PagerDuty ✅ (5.5)
- `landing-zone/modules/phase5-cost/` — Auto-scaling, Aurora ACU tuning, cost anomaly
- `landing-zone/modules/multi-region/` — Aurora Global DB, DynamoDB Global Tables, CloudFront failover ✅ (5.4, 49/49 applied)

### Lambda Functions (all deployed)
- `metrics_aggregation.py` — CloudWatch + Cost Explorer for admin dashboard
- `tenant_metrics.py` — Per-tenant metrics (6 endpoints, JWT auth)
- `failover_orchestrator.py` ✅ — Automated us-east-1 → us-west-2 failover
- `health_check_aggregator.py` ✅ — CloudFront health checks
- `failback_orchestrator.py` ✅ — Controlled failback after recovery
- `alert_router.py` ✅ — PagerDuty/Opsgenie dispatch with KMS-scoped decrypt

### Frontend Components
- `phase3a-portal/src/components/admin/AdminDashboard.jsx`
- `phase3a-portal/src/components/admin/SystemHealth.jsx`
- `phase3a-portal/src/components/tenant/TenantDashboard.jsx`
- `phase3a-portal/src/components/tenant/ComplianceDrift.jsx`
- `phase3a-portal/src/components/SREDashboard.jsx` ✅ (58 KB, query library + DLQ + runbooks)
- `phase3a-portal/src/components/AlertManagement.jsx`

### SLA Targets (all active)
- **RTO:** < 15 minutes | **RPO:** < 1 minute | **Uptime:** 99.95%
- **Alert detection:** < 5 minutes | **False positives:** < 5%
- **X-Ray coverage:** 100% of Lambda functions

---

## 🏗 Infrastructure as Code (Terraform)

```bash
# ❌ WRONG
cd landing-zone && terraform apply

# ✅ CORRECT
cd landing-zone/environments/dev && terraform apply
cd landing-zone/environments/prod && terraform apply

# Phase 5.4 multi-region target
cd landing-zone/environments/prod
terraform apply -target=module.multi_region -var-file=multi-region.tfvars
```

**Phase 5.4 CloudFront note:** Primary origin must be `d-ky35u7ca93.execute-api.us-east-1.amazonaws.com` (the API GW custom domain regional endpoint). The raw execute-api URL returns 403 when the `Host` header is `api.securebase.tximhotep.com`. Route 53 is disabled — DNS lives in Netlify; CloudFront origin group provides failover.

---

## 🔍 AI Assistant Audit Checklist

- [ ] No over-privileged IAM roles; GitHub Actions use OIDC not long-lived keys
- [ ] `npm install` uses `--legacy-peer-deps` for chart.js
- [ ] Cloud resources tagged: `Environment`, `ComplianceFramework`, `DataClassification`
- [ ] Encryption: AES-256 at rest, TLS 1.3 in transit
- [ ] No PII/PHI in logs or GA4 events
- [ ] No new Netlify Functions — use AWS Lambda + API Gateway
- [ ] New docs go in `docs/`, not repo root

---

## 📚 Additional Resources

- **Supabase Docs:** https://supabase.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **SOC 2 Controls:** https://www.aicpa.org/soc4so
- **FedRAMP Controls:** https://www.fedramp.gov
- **HIPAA Security Rule:** https://www.hhs.gov/hipaa/for-professionals/security/index.html

---

**Last Updated:** 2026-05-10  
**Maintained By:** Cedrick Byrd (cedrickbyrd)  
**Questions?** Open an issue in the repository.
