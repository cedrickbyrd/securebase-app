# CLAUDE.md - SecureBase Development Guide

**Repository:** `cedrickbyrd/securebase-app`
**Role Context:** Principal Cloud Architect | Compliance-First SaaS Platform
**Mission:** Build SOC 2, FedRAMP, and HIPAA-ready infrastructure and features
**Last Updated:** May 31, 2026

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
| Phase 7 | GCP Multi-Cloud Integration | 📐 Architecture drafted |

---

### Phase 6 — Active Sprint

> See [`PHASE6_SCOPE.md`](PHASE6_SCOPE.md) for full scope. See [`TODO_PHASE6.md`](TODO_PHASE6.md) for granular task status.

| Component | Description | Status |
|-----------|-------------|--------|
| 6.1 | Immutable Audit Logging + Evidence Vault | ✅ Complete (May 17, 2026) |
| 6.1.1 | Scheduled Evidence Runs (Repeatable Vault) | ✅ Complete (May 17, 2026) |
| 6.2 | Compliance Automation (50+ Config rules, SOC2/HIPAA/FedRAMP scoring) | ✅ Complete (May 17, 2026) |
| 6.3 | Scalability / performance validation (10k VUs, p95 < 200ms) | 🔴 Deferred — trigger: Matthew Matturro converts |
| 6.4 | Distributed Tracing & Advanced Observability | ✅ Complete (May 27, 2026) |
| 6.5 | Cost Optimization & Per-Tenant Cost Governance | ✅ Complete (May 27, 2026) |
| 6.6 | Build Debt & Developer Experience | 🔴 Deferred — trigger: Matthew converts + 2nd engineer onboarded |

#### ⚠️ CRITICAL: Production wiring — PR open, not yet merged

Phase 6.1 and 6.2 modules are wired in `dev` but **not yet in prod**. PR `feat/wire-phase6-prod-migrations` is open and must be merged + deployed before June 13.

**What the PR does:**
- Adds `phase6_audit_logging`, `phase6_compliance`, `phase6_lambdas`, `phase6_alerting` to `landing-zone/environments/prod/main.tf`
- Adds 5 new variables to `landing-zone/environments/prod/variables.tf`
- Adds `scripts/run-phase6-migrations.sh` — idempotent Aurora migration runner
- Adds `.github/workflows/phase6-db-migrations.yml` — CI migration workflow (auto dev, manual prod)
- Adds `.github/workflows/phase6-prod-plan.yml` — posts `terraform plan` as PR comment

**Deploy sequence after merge:**
1. Merge PR → CI auto-migrates dev Aurora (001 + 002)
2. Dispatch `phase6-db-migrations.yml` → staging, confirm OK
3. Dispatch `phase6-db-migrations.yml` → prod (`confirmed=MIGRATE`)
4. Dispatch `terraform-securebase-apply.yml` (`confirmed=DEPLOY`)

**GitHub Actions variables required before prod deploy:**

| Variable | Where | Value needed |
|---|---|---|
| `PROD_RDS_PROXY_ENDPOINT` | vars | Aurora RDS Proxy endpoint |
| `PROD_PRIVATE_SUBNET_IDS` | vars | JSON array of private subnet IDs |
| `PROD_LAMBDA_SG_IDS` | vars | JSON array of Lambda security group IDs |
| `CEO_ALERT_EMAIL` | vars | Macie findings email |
| `TF_STATE_BUCKET` | vars | Terraform state S3 bucket |
| `TF_LOCK_TABLE` | vars | DynamoDB lock table |
| `PROD_DB_CREDENTIALS_SECRET_ARN` | secrets | Secrets Manager ARN for Aurora creds |

#### ⚠️ CRITICAL: Aurora migrations not yet run in prod

`001_audit_evidence_tables.sql` and `002_compliance_score_history.sql` have been written but not yet applied to the production Aurora cluster. Without them, the Vault and compliance scoring produce no data. Run them via the migration workflow above.

#### Phase 6.1 — The Vault (Complete in dev)

S3 Object Lock (COMPLIANCE mode, 7yr), KMS-encrypted, SHA-256 manifests, auditor-grade PDF cover pages.

Key files:
- `phase6-backend/functions/audit_log_packager.py` — WORM evidence packager
- `phase6-backend/functions/audit_evidence_api.py` — `/admin/evidence` REST API
- `phase6-backend/database/migrations/001_audit_evidence_tables.sql` — `evidence_packages`, `macie_findings` tables

Portal components: evidence history table, async polling, presigned download, admin vault panel.

#### Phase 6.2 — Compliance Score Engine (Complete in dev)

50+ AWS Config rules, weighted daily scoring, tenant compliance history, admin cross-tenant visibility.

Key files:
- `phase6-backend/compliance/config_rules.tf` — Config rule inventory and framework mapping
- `phase6-backend/functions/compliance_score_recalculator.py` — daily weighted score snapshots
- `phase6-backend/functions/compliance_history_api.py` — tenant compliance trend API

#### Phase 6.4 — Distributed Tracing & Observability (Complete)

Key files: `landing-zone/modules/phase6-tracing/` · `PHASE6_TRACK4_COMPLETE.md`

Delivered: X-Ray tenant-segmented trace groups, Lambda Insights, CloudWatch Contributor Insights, anomaly detection alarms.

#### Phase 6.5 — Cost-per-Tenant Governance (Complete)

Key files: `landing-zone/modules/phase6-cost/` · `PHASE6_TRACK5_COMPLETE.md`

Delivered: Daily EventBridge cost aggregation, monthly S3 export, CloudWatch cost threshold alarms, `tenant_id` cost allocation tags.

---

## 🗓 Active Deadline: June 13, 2026 — Matthew Matturro / TriNetX

**Customer:** Matthew Matturro, TriNetX (healthcare data company)
**Status:** Trial in progress, conversion deadline June 13
**What he needs:**
- Day 1: Evidence packages visible in portal (`/evidence`) — requires Vault prod deploy
- Day 7: 90-day HIPAA compliance trend — requires compliance scoring prod deploy

**CEO SNS alert:** PR #778 wired first-activation and first-login events → SNS → email. You will receive an email when Matthew activates and first logs in.

**Do NOT** start work on 6.3 (scalability), 6.4 build debt, 6.5 DevEx, or 6.6 GTM Ops until Matthew's conversion is confirmed.

---

## 🛒 Sales Funnel Architecture

> **Source of truth for conversion:** `securebase.tximhotep.com` (marketing site, root `/`)

```
[TOFU]  demo.securebase.tximhotep.com   ←  prospect explores live product
           ↓  "Ready to deploy? See pricing →"
[MOFU]  securebase.tximhotep.com/pricing  ←  highest-traffic page (236 views/day)
           ↓  plan CTA
[BOFU]  securebase.tximhotep.com/checkout  ←  Stripe payment capture
```

### AWS Marketplace Channel

```
[Marketplace] portal.securebase.tximhotep.com/marketplace-redirect?x-amzn-marketplace-token=<token>
```

- Token resolved via `POST /api/marketplace/resolve` → `securebase-marketplace-resolver` Lambda
- Session always persisted to `localStorage` (external redirect — no "Remember me" UI)
- Implementation: `phase3a-portal/src/pages/MarketplaceRedirect.jsx` + `persistSessionToken()` from `apiService.js`
- SNS subscription wired in PR #844 (May 31, 2026) — Marketplace channel is production-ready

### Key Funnel Rules

- **Demo → Pricing is the primary acquisition path.** CTAs on `demo.securebase.tximhotep.com` must always point to `securebase.tximhotep.com/pricing`. Never add self-serve signup from demo pages.
- **Pricing → Checkout, NOT Pricing → Signup.** `src/components/Pricing.jsx` routes `handleSelectPlan()` directly to `/checkout`.
- **The pricing page is the revenue bottleneck.** All conversion work lives in `src/components/Pricing.jsx`.
- **Banking/FFIEC visitors → `/contact-sales`.** The `isBanking` guard is intentional — never remove it.
- **"Start Free Trial" header CTA routes to Healthcare checkout.** Current hardcode: `plan=healthcare`. Change to `plan=standard` or `plan=fintech` if targeting those verticals first.

### GA4 Properties

| Property | GA4 ID | Tracks |
|---|---|---|
| SecureBase - tximhotep.com | `533585511` | Marketing site — **source of truth** |
| SecureBase Demo Portal | `530646932` | `demo.securebase.tximhotep.com` |

### ⚠️ Marketing Site Deploy Gap

The marketing site (`securebase.tximhotep.com`, root `/`) has **no auto-deploy workflow**. Changes to `src/components/Pricing.jsx` and other root `src/` files merged to `main` do **not** go live automatically. Every change requires a manual deploy:

```bash
# From repo root (NOT phase3a-portal/)
npm ci --legacy-peer-deps
npm run build
npx netlify deploy --prod --dir=dist --site=<marketing-site-id>
```

Or trigger a deploy from the Netlify dashboard. The portal (`phase3a-portal/`) does have an auto-deploy via `deploy-phase3a-production.yml`. The marketing site does not.

**Fix:** Add `.github/workflows/deploy-marketing.yml` that triggers on `push` to `main` for paths `src/**`, `public/**`, `index.html`, `vite.config.js`.

### Known Conversion Issues

| Issue | Root Cause | Status |
|---|---|---|
| 0s avg engagement time across all pages | SPA routing not firing GA4 `page_view` on route change | Fix merged (SPA virtual page_view tracking) — needs marketing deploy |
| ~15.7% of `/login` sessions hit `/forgot-password` | JWT in `sessionStorage` cleared on tab close | "Remember me" → `localStorage` partially addressed in recent PRs |
| "Start Free Trial" CTA not live on pricing page | Code merged in PR #768 (May 22) but no auto-deploy | Manual deploy required |
| "See Live Demo →" card links not live | Same as above | Manual deploy required |

---

## 🛠 Build & Environment Constraints

### Package Management

```bash
# REQUIRED: Always use --legacy-peer-deps for chart dependencies
npm install react-chartjs-2 chart.js --save --legacy-peer-deps
npm install --legacy-peer-deps
```

### Monorepo Structure — Two Separate Apps

| | Root `/` | `phase3a-portal/` |
|---|---|---|
| **Purpose** | Marketing site + signup | Authenticated customer portal |
| **React** | 19 | 18 |
| **Vite** | 6 | 5 |
| **Auth** | AWS Lambda (`/api/signup`) | AWS Lambda JWT via API Gateway |
| **Deploy** | Manual — no auto-deploy workflow | `deploy-phase3a-production.yml` |
| **Node** | LTS v20 | ≥ 20.19.0 (bumped to v22 in PR #842) |

The `package-lock.json` out-of-sync with `package.json` is the **#1 cause of CI/CD failures**. Always run `npm install` and commit the lock file after adding packages. Never run `npm install` from repo root expecting it to affect `phase3a-portal/`.

### Lock File Policy

- Root and `phase3a-portal/` have separate `package.json` and `package-lock.json`
- `@supabase/supabase-js` is root-only — never add to `phase3a-portal/` (PR #508)
- All CI deploys use `npm ci` — lock file drift breaks builds immediately

### Auth Architecture

| Context | Auth Method |
|---|---|
| Marketing site `/signup` | AWS Lambda (`/api/signup`) |
| Portal (`phase3a-portal`) | AWS Lambda JWT via API Gateway — `securebase-production-auth-v2` |
| Demo mode | `demoApiService.js` + `VITE_DEMO_MODE=true` |

**Supabase is fully removed** from the portal (PR #508). Never add `@supabase/supabase-js` to `phase3a-portal/`.

### Environment Variables

```env
VITE_API_BASE_URL=https://api.securebase.tximhotep.com
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX  # placeholder — real IDs in Netlify env vars
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
- [ ] Customer PII never in repo files, issues, or commit messages — use Customer #1, #2, etc.
- [ ] RLS enforced; input validation on all user data
- [ ] `npm audit --production` clean
- [ ] New docs go in `docs/`, not repo root
- [ ] `sensitive_data.sql` in repo root — audit this file; confirm no real PII or credentials

---

## 📝 Code Style & Patterns

```typescript
// Functional components, Tailwind utilities, no inline styles
export const ComplianceCheck: React.FC<{ controlId: string; status: 'passing'|'failing'|'pending' }> = ({ controlId, status }) => (
  <div className="p-4 border rounded-lg">{/* content */}</div>
);
```

- Functional components only — no class components
- `.jsx` for portal components; prefer `.tsx` for new portal files
- Tailwind utility classes only — no `style={{}}` inline styles
- No `localStorage.setItem('sessionToken', ...)` directly — use `persistSessionToken()` from `apiService.js`
- SRE Dashboard memory metric accent `#9333EA` — never change

---

## 🚀 Git Workflow

> **Docs policy:** New files go in `docs/`. Never create `*.md` in the repo root (Claude.md and a few legacy files are grandfathered).

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

Key workflows:
| Workflow | Trigger | Does |
|---|---|---|
| `deploy-phase3a-production.yml` | Manual (`DEPLOY TO PRODUCTION`) | Deploys portal to `securebase-portal` Netlify site |
| `terraform-securebase-apply.yml` | Manual (`DEPLOY`) | Applies prod Terraform |
| `phase6-db-migrations.yml` | Auto (dev on push), manual (staging/prod) | Runs Aurora migrations |
| `phase6-prod-plan.yml` | PR to main touching prod/ | Posts terraform plan as PR comment |
| `auth-regression-tests.yml` | PR | Auth regression gate |

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

### SLA Commitments

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

### Prod environment module inventory (as of May 31, 2026)

| Module | Status |
|---|---|
| `phase6_audit_logging` | ⚠️ In open PR — not yet applied |
| `phase6_compliance` | ⚠️ In open PR — not yet applied |
| `phase6_lambdas` | ⚠️ In open PR — not yet applied |
| `phase6_alerting` | ⚠️ In open PR — not yet applied |
| `phase6_tracing` | ✅ Applied |
| `phase6_cost` | ✅ Applied |
| `marketplace` | ✅ Applied (conditional on vars) |

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
- [ ] Marketing site changes require a **manual Netlify deploy** — no auto-deploy workflow exists
- [ ] `phase3a-portal/` deploys separately from root `/` — never deploy portal from repo root
- [ ] Before touching `landing-zone/environments/prod/`: check open PR `feat/wire-phase6-prod-migrations` to avoid conflicts

---

## 📚 Resources

- Tailwind: https://tailwindcss.com/docs
- SOC 2: https://www.aicpa.org/soc4so | FedRAMP: https://www.fedramp.gov
- HIPAA: https://www.hhs.gov/hipaa/for-professionals/security/index.html

---

**Last Updated:** 2026-05-31 | **Maintained By:** Cedrick Byrd (cedrickbyrd)
