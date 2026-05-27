# CLAUDE.md - SecureBase Development Guide

**Repository:** `cedrickbyrd/securebase-app`
**Role Context:** Principal Cloud Architect | Compliance-First SaaS Platform
**Mission:** Build SOC 2, FedRAMP, and HIPAA-ready infrastructure and features
**Last Updated:** May 27, 2026

---

## 🎯 Project Overview

SecureBase is a security-first, multi-tenant AWS PaaS platform delivering **compliance automation**, **AI Agent Authentication**, **Non-Human Identity Management (NHI/IAM)**, and **Sovereign Infrastructure-as-Code** for regulated industries (fintech, healthcare, federal).

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
| 6.2 | Compliance Automation (50+ Config rules, SOC2/HIPAA/FedRAMP scoring) | ✅ Complete (May 17, 2026) |
| 6.3 | Scalability / performance validation (10k VUs, cache hit rate, cold-start reduction) | 🔨 In Progress |
| 6.4 | Distributed Tracing & Advanced Observability | ✅ Complete (documented May 27, 2026) |
| 6.5 | Cost Optimization & Per-Tenant Cost Governance | ✅ Complete (documented May 27, 2026) |
| 6.6 | Build Debt & Developer Experience | 🔴 Deferred pending commercial / staffing triggers |

#### Phase 6.1 — The Vault (Complete)

The Vault is the immutable evidence store. S3 Object Lock (COMPLIANCE mode, 7yr), KMS-encrypted, SHA-256 manifests, auditor-grade PDF cover pages. First customer baseline written May 17, 2026.

Key files:
- `phase6-backend/functions/audit_log_packager.py` — WORM evidence packager
- `phase6-backend/functions/audit_evidence_api.py` — `/admin/evidence` REST API
- `phase6-backend/database/migrations/001_audit_evidence_tables.sql` — `evidence_packages`, `macie_findings` tables

Portal components: evidence history table, async polling, presigned download, admin vault panel.

#### Phase 6.2 — Compliance Score Engine (Complete)

Phase 6.2 delivered organization-wide compliance automation with 50+ AWS Config rules, weighted daily scoring, tenant compliance history, and admin cross-tenant visibility.

Key files:
- `phase6-backend/compliance/config_rules.tf` — AWS Config rule inventory and framework mapping
- `phase6-backend/functions/compliance_score_recalculator.py` — daily weighted score snapshots
- `phase6-backend/functions/compliance_history_api.py` — tenant compliance trend API
- `landing-zone/modules/phase6-lambda-functions/outputs.tf` — score recalculator/log outputs for downstream wiring

#### Phase 6.4 — Distributed Tracing & Advanced Observability (Complete)

Track 4 added tenant-aware tracing and anomaly detection for platform operations.

Key files:
- `landing-zone/modules/phase6-tracing/main.tf`
- `landing-zone/modules/phase6-tracing/variables.tf`
- `landing-zone/modules/phase6-tracing/outputs.tf`
- `landing-zone/modules/api-gateway/main.tf` — access logs include `tenantId` for attribution
- `PHASE6_TRACK4_COMPLETE.md`

Delivered capabilities:
- X-Ray tenant-segmented trace groups
- Lambda Insights IAM policy attachments
- CloudWatch Contributor Insights for top tenant error contributors
- Anomaly detection alarms for Lambda p99 duration / error rate and API Gateway 4xx/5xx

#### Phase 6.5 — Cost Optimization & Per-Tenant Cost Governance (Complete)

Track 5 added daily cost-per-tenant aggregation, monthly cost export, custom CloudWatch metrics, and alerting on tenant spend thresholds.

Key files:
- `landing-zone/modules/phase6-cost/main.tf`
- `package-phase6-lambdas.sh` — includes `cost_per_tenant`
- `PHASE6_TRACK5_COMPLETE.md`

Delivered capabilities:
- Daily EventBridge cost aggregation
- Monthly cost export to S3
- CloudWatch alarm for max tenant projected monthly cost
- Cost allocation tags for `tenant_id`, `Phase`, and `Environment`

#### Active Remaining Work

- **6.3 Scalability / validation** — complete 10k VU load testing, verify p95 < 200ms, confirm cache hit rate and warm-path cold-start targets
- **6.6 Internal follow-on work** — build debt cleanup and developer experience improvements remain deferred pending customer conversion / staffing trigger

**Security rule:** Customer PII (names, emails, tokens) must never appear in repo files, issues, or commit messages. Use Customer #1, #2, etc.

---

## 🛒 Sales Funnel Architecture

> **Source of truth for conversion:** `securebase.tximhotep.com` (marketing site, root `/`)

The SecureBase funnel has three stages across two separate web properties:

```
[TOFU]  demo.securebase.tximhotep.com   ←  prospect explores live product
           ↓  "Ready to deploy? See pricing →"
[MOFU]  securebase.tximhotep.com/pricing  ←  highest-traffic page (236 views/day)
           ↓  plan CTA
[BOFU]  securebase.tximhotep.com/checkout  ←  Stripe payment capture
```

### AWS Marketplace Channel

SecureBase is listed on AWS Marketplace. Buyers who subscribe are redirected to:

```
[Marketplace] portal.securebase.tximhotep.com/marketplace-redirect?x-amzn-marketplace-token=<token>
```

- The portal resolves the token via `POST /api/marketplace/resolve` → `securebase-marketplace-resolver` Lambda
- Session is always persisted to `localStorage` (buyers arrive from an external redirect — no "Remember me" UI)
- Implementation: `phase3a-portal/src/pages/MarketplaceRedirect.jsx` + `persistSessionToken()` from `apiService.js`

### Key Rules for Every Developer

- **Demo → Pricing is the primary acquisition path.** `demo.securebase.tximhotep.com` must always carry a prominent CTA back to `securebase.tximhotep.com/pricing`. Do NOT add self-serve signup flows from demo pages.
- **Pricing → Checkout, NOT Pricing → Signup.** `src/components/Pricing.jsx` routes `handleSelectPlan()` directly to `/checkout`. The `/signup` page exists for a separate direct-traffic path.
- **The pricing page is the revenue bottleneck.** All conversion optimisation work (CTAs, copy, layout) is concentrated in `src/components/Pricing.jsx`.
- **Banking/FFIEC visitors are routed to `/contact-sales`, not checkout.** This is intentional — do NOT remove the `isBanking` guard.

### GA4 Properties

| Property | GA4 ID | Tracks |
|---|---|---|
| SecureBase - tximhotep.com | `533585511` | Marketing site — **source of truth** |
| SecureBase Demo Portal | `530646932` | `demo.securebase.tximhotep.com` |

Both properties are live and receiving data. The `G-XXXXXXXXXX` placeholder in env templates below is intentional — real IDs are set in Netlify environment variables, never in the repo.

### Known Conversion Issues (May 22, 2026)

| Issue | Root Cause | Fix |
|---|---|---|
| 0s average engagement time across all pages | SPA client-side routing not firing GA4 `page_view` events on route change | PR in progress |
| ~15.7% of `/login` sessions hit `/forgot-password` | JWT stored in `sessionStorage` — cleared on tab close, forcing re-login | Add "Remember me" → `localStorage` path |
| Demo dashboard invisible from pricing page | No link from `Pricing.jsx` to `demo.securebase.tximhotep.com` | Add secondary CTA to pricing cards |
| No acquisition CTA in pricing page header | Header only shows "Sign In" — no path for new prospects | Add "Start Free Trial" to sticky header |

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
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX  # placeholder — real ID in Netlify env vars (property 533585511)
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
- [ ] Funnel rule: demo CTAs point to `securebase.tximhotep.com/pricing`, not internal signup
- [ ] Pricing page: `handleSelectPlan()` routes to `/checkout` — do NOT reroute to `/signup`

---

## 📚 Resources

- Tailwind: https://tailwindcss.com/docs
- SOC 2: https://www.aicpa.org/soc4so | FedRAMP: https://www.fedramp.gov
- HIPAA: https://www.hhs.gov/hipaa/for-professionals/security/index.html

---

**Last Updated:** 2026-05-27 | **Maintained By:** Cedrick Byrd (cedrickbyrd)
