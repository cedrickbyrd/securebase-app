# CLAUDE.md - SecureBase Development Guide

**Repository:** `cedrickbyrd/securebase-app`
**Role Context:** Principal Cloud Architect | Compliance-First SaaS Platform
**Mission:** Build SOC 2, FedRAMP, and HIPAA-ready infrastructure and features
**Last Updated:** May 17, 2026

---

## 🎯 Project Overview

SecureBase is a security-first, multi-tenant AWS PaaS platform delivering **compliance automation**, **AI Agent Authentication**, **Non-Human Identity Management (NHI/IAM)**, and **Sovereign Infrastructure Orchestration**. Every code change must prioritize security, auditability, and regulatory compliance.

**Current Phase Status:**
| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | AWS Landing Zone (Terraform IaC) | ✅ Complete |
| Phase 2 | Serverless Database & API Backend | ✅ Complete |
| Phase 3a | Customer Portal (React) | ✅ Complete |
| Phase 3b | Support Tickets, Webhooks & Cost Forecasting | ✅ Complete |
| Phase 4 | Enterprise Features (RBAC, Analytics, Notifications) | ✅ Complete |
| Phase 5 | Observability, Multi-Region DR & Incident Response | ✅ Complete |
| Phase 6 | Compliance Automation & Operations Scale | 🔨 In Progress |

### Phase 6 — Active Sprint

> See [`PHASE6_SCOPE.md`](PHASE6_SCOPE.md) for full scope.

| Component | Description | Status |
|-----------|-------------|--------|
| 6.1 | Immutable Audit Logging + Evidence Baseline | ✅ Complete (May 17, 2026) |
| 6.2 | Compliance Automation (50+ Config rules, SOC2/HIPAA/FedRAMP scoring) | 🔨 In Progress |
| 6.3 | Scalability — Lambda provisioned concurrency, API GW caching, Aurora ACU 2–128 | 🔨 In Progress |
| 6.4 | Build Debt — remove `--legacy-peer-deps`, migrate mocks to `tests/fixtures/` | 🔨 In Progress |
| 6.5 | Developer Experience — docker-compose, Storybook, OpenAPI, Playwright E2E | 🔨 In Progress |

#### Phase 6.1 — The Vault (Complete)

The Vault is the immutable evidence store. S3 Object Lock (COMPLIANCE mode, 7yr), KMS-encrypted, SHA-256 manifests, auditor-grade PDF cover pages. First customer baseline written May 17, 2026.

Key files:
- `phase6-backend/functions/audit_log_packager.py` — WORM evidence packager
- `phase6-backend/functions/audit_evidence_api.py` — `/admin/evidence` REST API
- `phase6-backend/database/migrations/001_audit_evidence_tables.sql` — `evidence_packages`, `macie_findings` tables

Portal components: evidence history table, async polling, presigned download, admin vault panel.

**Security rule:** Customer PII (names, emails, tokens) must never appear in repo files, issues, or commit messages. Use Customer #1, #2, etc.

---

## 🛠 Build & Environment Constraints

### Package Management
```bash
# REQUIRED: Always use --legacy-peer-deps for chart dependencies
npm install react-chartjs-2 chart.js --save --legacy-peer-deps
npm install --legacy-peer-deps
```

### Lock File Policy

The `package-lock.json` out-of-sync with `package.json` is the **#1 cause of CI/CD failures**. All deploy workflows use `npm ci`.

- Always run `npm install` locally when adding packages; commit the updated lock file
- Two separate packages: root `/` (React 19, Vite 6) and `phase3a-portal/` (React 18, Vite 5)
- `@supabase/supabase-js` is root-only — do NOT add to `phase3a-portal/` (PR #508)

### Technology Stack
- **Frontend:** React 18+ (portal `.jsx`, marketing site `.tsx`), Vite, Tailwind CSS
- **Charts:** react-chartjs-2 + chart.js | **PDF:** jspdf + html2canvas
- **Analytics:** GA4 (privacy-first, HIPAA-compliant, no PII/PHI)
- **Backend/Auth:** Lambda JWT (portal) | Supabase removed from portal in PR #508
- **Runtime:** Node.js LTS v20.x

### Auth Architecture

| Context | Auth Method |
|---|---|
| Marketing site `/signup` | AWS Lambda (`/api/signup`) |
| Portal (`phase3a-portal`) | AWS Lambda JWT via API Gateway |

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

**SOC 2:** RBAC, audit logging all auth/data/config events, AES-256 at rest, TLS 1.3 in transit
**FedRAMP:** MFA required for all admin, 15-min idle / 8-hr absolute session, continuous monitoring
**HIPAA:** Never log PHI, hash/mask PHI in dev, log every PHI access with user + timestamp

### Security Checklist for Every Commit
- [ ] No hardcoded credentials, API keys, or secrets
- [ ] PII/PHI never logged; GA4 events free of PII/PHI
- [ ] Customer PII never in repo files, issues, or commit messages (use Customer #1, #2, etc.)
- [ ] RLS enforced; input validation on all user data
- [ ] `npm audit --production` clean
- [ ] New docs go in `docs/`, not repo root

---

## 📝 Code Style & Patterns

```typescript
// Functional components with TypeScript, Tailwind utilities
export const ComplianceCheck: React.FC<{ controlId: string; status: 'passing'|'failing'|'pending' }> = ({ controlId, status }) => (
  <div className="p-4 border rounded-lg">{/* content */}</div>
);
```

---

## 🚀 Git Workflow

> **Docs policy:** New files go in `docs/`. Never create `*.md` in the repo root.

```bash
git commit -m "feat: add automated SOC 2 evidence collection"
git commit -m "fix: resolve session timeout race condition"
git commit -m "infra: add CloudWatch alarms for API latency"
git commit -m "security: update dependency to patch CVE"
git commit -m "docs: update roadmap — phase 6.1 complete"
```

---

## ⚙️ GitHub Actions & CI/CD

Always use OIDC for AWS — never long-lived access keys:
```yaml
permissions:
  contents: read
  id-token: write
```

---

## 💰 Cost Optimization: Avoid Netlify Functions

Policy: Do NOT introduce new Netlify Functions. Use AWS Lambda + API Gateway.

```toml
# netlify.toml — add new routes here instead of new Netlify functions
[[redirects]]
  from = "/api/new-endpoint"
  to   = "https://api.securebase.tximhotep.com/new-endpoint"
  status = 200
  force  = true
```

---

## 🔭 Phase 5 Infrastructure Reference (Complete)

### Terraform Modules
| Module | Phase | Key Resources |
|--------|-------|---------------|
| `phase5-admin-metrics/` | 5.1 | CloudWatch Lambda, DynamoDB, 7 `/admin/*` routes |
| `phase5-tenant-metrics/` | 5.2 | Per-tenant DynamoDB with KMS |
| `phase5-sre-metrics/` | 5.3 | DynamoDB `sre_ops_metrics`, SNS, IAM |
| `phase5-cost/` | 5.3 | Auto-scaling, Aurora ACU, cost anomaly, S3 Intelligent-Tiering |
| `phase5-alerting/` | 5.5 | 40+ alarms, SNS, PagerDuty/Opsgenie, EventBridge, alert router |
| `phase5-logging/` | 5.6 | X-Ray tracing, CloudWatch log groups, 20+ Insights queries, VPC Flow Logs |
| `multi-region/` | 5.4 | Aurora Global DB, DynamoDB Global Tables, S3 CRR, CloudFront failover (49/49 applied) |

### Phase 5 SLA Commitments
- **RTO:** < 15 min | **RPO:** < 1 min | **Uptime:** 99.95%
- **Alert detection:** < 5 min | **X-Ray coverage:** 100% of Lambda functions

### CloudFront Wiring Note (5.4)
Primary origin: `d-ky35u7ca93.execute-api.us-east-1.amazonaws.com` (API GW custom domain regional endpoint).
Do NOT use the raw execute-api URL — returns 403 when `Host: api.securebase.tximhotep.com`.
Route 53 disabled — DNS in Netlify; CloudFront origin group provides failover.

---

## 🏗 Terraform Deployment

```bash
# Always target a specific environment
cd landing-zone/environments/prod && terraform apply

# Phase 5.4 multi-region only
terraform apply -target=module.multi_region -var-file=multi-region.tfvars
```

---

## 🔍 AI Assistant Audit Checklist

- [ ] IAM: least privilege, OIDC not long-lived keys, explicit `permissions:` in workflows
- [ ] npm: `--legacy-peer-deps` for chart.js; committed lock file
- [ ] Tagging: `Environment`, `ComplianceFramework`, `DataClassification` on all cloud resources
- [ ] Encryption: AES-256 at rest, TLS 1.3 in transit
- [ ] No PII/PHI in logs or GA4 events
- [ ] No customer PII in repo files, issues, or commit messages — use Customer #1, #2, etc.
- [ ] No new Netlify Functions — use AWS Lambda + API Gateway
- [ ] New docs in `docs/`, not repo root

---

## 📚 Resources

- Tailwind: https://tailwindcss.com/docs
- SOC 2: https://www.aicpa.org/soc4so | FedRAMP: https://www.fedramp.gov
- HIPAA: https://www.hhs.gov/hipaa/for-professionals/security/index.html

---

**Last Updated:** 2026-05-17 | **Maintained By:** Cedrick Byrd (cedrickbyrd)
