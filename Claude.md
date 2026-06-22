# CLAUDE.md - SecureBase Development Guide

**Repository:** `cedrickbyrd/securebase-app`
**Role Context:** Principal Cloud Architect | Compliance-First SaaS Platform
**Mission:** Build SOC 2, FedRAMP, and HIPAA-ready infrastructure and features
**Last Updated:** June 16, 2026

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
| 6.3 | Scalability / performance validation (10k VUs, p95 < 200ms) | 🔴 Deferred — trigger: AWS Marketplace listing published + first paid conversion |
| 6.4 | Distributed Tracing & Advanced Observability | ✅ Complete (May 27, 2026) |
| 6.5 | Cost Optimization & Per-Tenant Cost Governance | ✅ Complete (May 27, 2026) |
| 6.6 | Build Debt & Developer Experience | 🔴 Deferred — trigger: first paid conversion + 2nd engineer onboarded |

#### Production wiring — PR #845 merged May 31, 2026

Phase 6.1 and 6.2 modules are in `main` but **Terraform apply has not yet been run against `landing-zone/environments/prod`**. Resources are defined but not deployed to AWS.

**Correct prod apply command (no CI workflow exists for landing-zone/environments/prod):**
```bash
cd landing-zone/environments/prod
terraform init -backend-config=backend.hcl
terraform plan -var-file=marketplace.tfvars
terraform apply -var-file=marketplace.tfvars
```

> ⚠️ `terraform-securebase-apply.yml` targets `./terraform` (root workspace — API Gateway / Phase 1-2 Lambdas). It does NOT deploy `landing-zone/environments/prod`. Do NOT use it for Phase 6 modules.

**Aurora migrations — not yet run in prod:**
1. Dispatch `phase6-db-migrations.yml` → prod (`confirmed=MIGRATE`) — runs 001 + 002
2. Migration 003 (`marketplace_fields.sql`) must also be run after marketplace module apply

**GitHub Actions variables — all populated as of June 16, 2026:**

| Variable | Value |
|---|---|
| `PROD_RDS_PROXY_ENDPOINT` | `securebase-phase2-proxy-dev.proxy-coti40osot2c.us-east-1.rds.amazonaws.com` |
| `PROD_PRIVATE_SUBNET_IDS` | `subnet-0783b18ae893a8df9,subnet-0f3dfdab04381608c` |
| `PROD_LAMBDA_SG_IDS` | `sg-024bf2ecdb05c58c6` |
| `CEO_ALERT_EMAIL` | `cedrickjbyrd@me.com` |
| `TF_STATE_BUCKET` | `securebase-terraform-state-prod` |
| `TF_LOCK_TABLE` | `securebase-terraform-locks` |
| `PROD_DB_CREDENTIALS_SECRET_ARN` | `arn:aws:secretsmanager:us-east-1:731184206915:secret:securebase/prod/rds/app-uw9J2e` |

#### ⚠️ Aurora migrations not yet run in prod

Migrations 001 (`audit_evidence_tables`), 002 (`compliance_score_history`), and 003 (`marketplace_fields`) have been written but not applied to the production Aurora cluster. Run via `phase6-db-migrations.yml` workflow dispatch after Terraform apply succeeds. Without 001+002 the Vault and compliance scoring produce no data. Without 003 the marketplace resolve Lambda will fail on first subscribe.

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

## 🗓 Conversion Strategy — AWS Marketplace (Updated June 16, 2026)

**Matthew Matturro / TriNetX:** June 13 deadline passed. Did not convert. Conversion deferred — target path is AWS EDP spend via Marketplace subscription.

**Primary conversion path:** All Wave 1 prospects (TriNetX, Texas Capital Bank, AccentCare, Veritex, Cook Children's, Mercury) are being routed through AWS Marketplace to leverage EDP commitments.

**Marketplace listing status:** `blblyu28f6s5mzwl089d4xoea` — **Limited / Under Review** in AMMP. AWS review must clear before SNS subscription/entitlement topics activate and live test subscribe is possible.

**Marketplace infrastructure status:**
- ✅ All 3 Lambdas deployed (resolve, subscription handler, metering worker)
- ✅ Subscription handler DLQ wired
- ✅ Metering worker DLQ wired (added June 16, 2026)
- ✅ SNS Lambda invoke permissions set for both AMMP topics
- ❌ AMMP endpoint registration blocked until listing publishes
- ❌ Aurora migration 003 (marketplace fields) not run in prod
- ❌ Stripe secret key rotation pending (phone verification required)

**Next action:** Contact AWS Marketplace seller support to request review ETA for product code `blblyu28f6s5mzwl089d4xoea`.

**Do NOT** start work on 6.3 (scalability) or 6.6 (DevEx) until first paid conversion confirmed.

**Wave 1 co-sell:** Texas Capital Bank, AccentCare, Veritex Community Bank — 3 opportunities pending AWS Partner Central approval.

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
| `terraform-securebase-apply.yml` | Manual (`DEPLOY`) | Applies `./terraform` root workspace only (Phase 1-2) — does NOT touch `landing-zone/environments/prod` |
| `phase6-db-migrations.yml` | Auto (dev on push), manual (staging/prod) | Runs Aurora migrations via `db_migrator` Lambda |
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
# Phase 6 modules — landing-zone/environments/prod (no CI workflow, run locally)
cd landing-zone/environments/prod
terraform init -backend-config=backend.hcl
terraform plan -var-file=marketplace.tfvars
terraform apply -var-file=marketplace.tfvars

# Phase 5.4 multi-region only
terraform apply -target=module.multi_region -var-file=multi-region.tfvars

# Phase 1-2 root workspace (API Gateway, core Lambdas)
# Use terraform-securebase-apply.yml workflow (confirmed=DEPLOY)
```

### Prod environment module inventory (as of June 16, 2026)

| Module | Status |
|---|---|
| `phase6_audit_logging` | ⚠️ In main (PR #845) — Terraform apply not yet run |
| `phase6_compliance` | ⚠️ In main (PR #845) — Terraform apply not yet run |
| `phase6_lambdas` | ⚠️ In main (PR #845) — Terraform apply not yet run |
| `phase6_alerting` | ⚠️ In main (PR #845) — Terraform apply not yet run |
| `phase6_tracing` | ✅ Applied |
| `phase6_cost` | ✅ Applied |
| `marketplace` | ✅ Applied (conditional on vars) — metering DLQ added June 16 |
| `db_migrator` | ✅ In main (PRs #848, #853) — VPC-resident migration runner |

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
- [ ] `terraform-securebase-apply.yml` targets `./terraform` root only — use local apply for `landing-zone/environments/prod`

---

## 📚 Resources

- Tailwind: https://tailwindcss.com/docs
- SOC 2: https://www.aicpa.org/soc4so | FedRAMP: https://www.fedramp.gov
- HIPAA: https://www.hhs.gov/hipaa/for-professionals/security/index.html

---

**Last Updated:** 2026-06-16 | **Maintained By:** Cedrick Byrd (cedrickbyrd)


## AWS Marketplace Integration — Session Notes (2026-06-22)

### PrivateLink / VPC Endpoints
AWS does NOT publish a PrivateLink interface endpoint for AWS Marketplace
Entitlement Service in us-east-1 — confirmed via `describe-vpc-endpoint-services`.
Only three Marketplace-related interface endpoints exist in this region:
`agreement-marketplace`, `discovery-marketplace`, `metering-marketplace`.
The `aws_vpc_endpoint.marketplace_entitlement` resource was removed from
`landing-zone/modules/marketplace/main.tf` for this reason — do not re-add it.
`GetEntitlements` calls from VPC-isolated Lambdas rely on the existing
short-timeout (5s) defense-in-depth fallback documented elsewhere in that file.

The metering endpoint (`com.amazonaws.us-east-1.metering-marketplace`,
ipv4-only, no dual-stack) predates this session's Terraform work — it was
created manually/out-of-band on 2026-06-15 and was not originally tracked in
state. It has since been imported (`terraform import -var-file=marketplace.tfvars`)
and is now correctly Terraform-managed, attached to a dedicated SG
(`marketplace_vpc_endpoints`, ingress restricted to the marketplace Lambda SG
`sg-0127b93c1653cf90f` on 443). Confirmed via `terraform plan` showing
"No changes" after apply.

### package-lambda.sh — db_utils.py packaging gap
`marketplace_resolve_customer`, `marketplace_subscription_handler`, and
`marketplace_metering_worker` all import `db_utils` at module level, but
`package-lambda.sh`'s `package()` function only ever copied the single named
handler file (`cp "${source_file}" "${build_dir}/${name}.py"`) — it never
copied `db_utils.py`. This went undetected for `resolve_customer` and
`metering_worker` because their currently-deployed zips were built by an
earlier, different (manual/undocumented) process that did include it.
`subscription_handler` had no such manual build and was broken from this gap.
A fix (`extra_files_for()` function + copy-loop in `package()`) was designed
and reviewed this session but its deployment status was NOT confirmed by
session end — see "Known open issue" below before assuming this is resolved.

CAUTION: `db_utils.py` exists in FOUR locations in this repo with THREE
different MD5 hashes (as of 2026-06-22):
- `phase2-backend/lambda_layer/python/db_utils.py` — canonical, intended as
  the copy source for the `extra_files_for()` fix above (no stale RDS Proxy
  `statement_timeout` option, matches `functions/package/`)
- `phase2-backend/functions/db_utils.py` — differs by one comment line only
- `phase2-backend/functions/package/db_utils.py` — matches the layer copy
- `vendor/marketplace-entitlement/db_utils.py` — STALE (6/9 snapshot), has
  the now-removed `statement_timeout` option AND its sibling handler file
  only handles SNS `SignatureVersion "1"`. DO NOT deploy from this vendor
  directory — reference only.

These should be consolidated to one canonical location at some point.

### Netlify — THREE separate sites from one repo
This repo backs three independent Netlify projects, each with its own
`netlify.toml`/build config:
- `securebase-app` (a4fc5c81-...) -> tximhotep.com — builds from repo root
- `securebase-portal` (d9e565ff-...) -> portal.securebase.tximhotep.com —
  builds from `phase3a-portal/` (React 18/Vite 5,
  `securebase-customer-portal`)
- `securebase-demo` (e2653a23-...) -> demo.securebase.tximhotep.com

CRITICAL: `netlify deploy --site <id>` controls WHERE a deploy goes but NOT
what gets built — the build command and source directory come from whichever
`netlify.toml` is found via the CURRENT WORKING DIRECTORY, not the `--site`
flag. Running `netlify deploy --prod --site <portal-id>` from repo root will
build and deploy the ROOT app to the portal's domain (this happened once
during this session and was caught/corrected before going live for long).
Always cd into the correct subdirectory first:

Root site:
  cd <repo-root> && netlify deploy --prod --site a4fc5c81-e95f-4b2c-8c48-5080c0046328

Portal site:
  cd phase3a-portal && netlify deploy --prod --site d9e565ff-5b33-4e21-b461-fbe24851f1bd

### Marketplace fulfillment URL — AUDIT_ERROR root cause (2026-06-22)
The fulfillment URL (https://portal.securebase.tximhotep.com/api/marketplace/resolve)
returned a literal Netlify 404 — not an application error — because the
securebase-portal site (see above) had no /api/marketplace/resolve
redirect rule in its LIVE deploy, despite the correct rule already existing
in source at phase3a-portal/public/_redirects (dated 6/17). The portal site
was simply stale; redeploying it from the correct directory resolved this.
The handler (marketplace_resolve_customer.py) already correctly returns
HTTP 200 with HTML for requests carrying Accept: text/html (audit-bot
compatibility per AWS requirements) — verified working as deployed, no code
change needed there.

### CI/CD — undocumented second ungated apply path (2026-06-22)
.github/workflows/terraform-apply.yml (distinct from the already-documented
terraform-securebase-apply.yml) had its own direct, ungated push-trigger
into landing-zone/environments/prod — on: push: branches: [main], no
terraform plan step, straight to terraform apply -auto-approve, no
environment protection, no required reviewer. Root cause traced to commit
f6600f7f (2026-03-24, "WIP: Removing workflow approvals") — a script
(remove_workflow_approvals.sh) that deliberately strips environment: blocks
and approval gates from workflow YAML, run during early pre-launch
iteration. That script's blast radius was only confirmed against this one
file this session — it may have stripped gates from other workflows in
March too; unverified.

terraform-apply.yml has been converted to workflow_dispatch with a
required confirmed=APPLY input, mirroring the phase6-db-migrations.yml
confirmed=MIGRATE pattern. Trigger via:
  gh workflow run terraform-apply.yml -f confirmed=APPLY

Its TF_VERSION was also misaligned (1.7.5 vs. the local pin of 1.5.7) and
has been corrected to match.

Also discovered: GitHubActionsRole lacks read permissions (SNS, SQS, EC2,
KMS, S3, XRay, CloudWatch) across most of what this workflow's Terraform root
actually touches — caused a CI run to fail with ~15 distinct AccessDenied
errors when first re-triggered. Deliberately left unfixed (not widened) this
session, since broadening this role's permissions cuts against the point of
re-gating the workflow. Needs scoped, resource-specific IAM grants as a
separate piece of work.

## Deployment Safety Rules

Terraform / landing-zone / IAM / DB migrations: Never push directly to
main. Branch + local terraform plan review before merge, always. main
can trigger an unattended terraform apply via more than one workflow (see
CI/CD note above) — a push touching landing-zone/ or terraform/ may be
equivalent to running apply against production yourself, unreviewed, right
now. Do not assume any single workflow file's scope without reading its
on: block directly — there is precedent for undocumented, ungated apply
paths existing in parallel with documented ones.

Docs / scripts / non-deployed config (including Netlify redirect configs,
this file): direct-to-main is fine, no branch required.

### Known open issue (as of 2026-06-22 session end)
marketplace_subscription_handler was still failing on
ModuleNotFoundError: No module named 'db_utils' as of this session's last
confirmed test — AFTER a cryptography-only fix had already been deployed
(that fix alone was insufficient; both gaps had to be fixed before this
Lambda would work). The extra_files_for() patch to package-lambda.sh was
written, but its actual presence in the file, a fresh package/deploy, and a
clean re-invoke were NOT all confirmed in the same pass by session end.
Before treating this as resolved, run:
  grep -n "extra_files_for" phase2-backend/functions/package-lambda.sh
  unzip -l phase2-backend/deploy/marketplace_subscription_handler.zip | grep db_utils

Both must show the function/file present BEFORE re-testing with a live
invoke. The subscription_handler DLQ has 9 backlogged real events (one real
or test customer, dqxUD4EkUGg, three full subscribe/unsubscribe cycles
spanning 6/17-6/22) that must be replayed manually, one at a time, in strict
chronological timestamp order (queue is standard, not FIFO) once this is
fixed — see prior session transcript for the exact sorted order and message
IDs.
