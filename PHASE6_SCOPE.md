# Phase 6 — Compliance Automation & Operations Scale

**Project:** SecureBase  
**Phase:** 6 — Compliance Automation & Operations Scale  
**Status:** 🔨 In Progress  
**Depends On:** Phase 5.1 ✅, Phase 5.2 ✅, Phase 5.3 🔨 (Multi-Region DR)  
**Theme:** _"Make compliance a product feature, not an afterthought."_  

---

## Overview

Phase 6 transforms SecureBase from a platform with compliance tooling into a **compliance-native product**. It automates evidence collection, enforces 50+ AWS Config rules mapped directly to SOC 2 / HIPAA / FedRAMP controls, and scales the platform to serve 10,000+ concurrent users. It also pays down build debt and dramatically improves the developer experience.

**Business Impact:**
- Enables SecureBase to pass SOC 2 Type II audits with automated evidence packages
- Allows HIPAA healthcare customers to demonstrate continuous compliance to auditors
- Supports FedRAMP Rev 5 authorization for government customers
- Reduces manual audit preparation from weeks to hours

---

## Components

### Component 6.1 — Immutable Audit Logging at Scale

**Priority:** CRITICAL | **First delivery**  
**Theme:** WORM evidence storage + automated audit packaging

**Deliverables:**

_Infrastructure (Terraform):_
```
landing-zone/modules/phase6-audit-logging/
├── main.tf          — S3 Object Lock (COMPLIANCE mode), Macie, KMS, IAM
├── variables.tf
└── outputs.tf
```

_Lambda Functions:_
- `phase6-backend/functions/audit_log_packager.py` — Collects tenant audit logs from S3, packages into zip with SHA-256 manifest, uploads with Object Lock
- `phase6-backend/functions/audit_evidence_api.py` — REST API for `/admin/evidence` (list, download, generate)

_Database:_
- `phase6-backend/database/migrations/001_audit_evidence_tables.sql` — `evidence_packages`, `macie_findings` tables with RLS

_Tests:_
- `tests/phase6/test_audit_log_packager.py`

**Key Design Decisions:**
- S3 Object Lock in **COMPLIANCE mode** (7-year / 2555 days) — not GOVERNANCE mode, to prevent even root user deletion
- Bucket policy explicitly denies `s3:DeleteObject` and `s3:PutObjectRetention` override
- SHA-256 manifest file included in every evidence package zip
- AWS Macie scheduled classification jobs scan for accidental PII in log buckets
- Evidence packages are immutable records in PostgreSQL with tenant isolation via RLS

**Success Criteria:**
- [ ] Evidence packages are created with COMPLIANCE mode Object Lock
- [ ] SHA-256 manifest verified on every package download
- [ ] Macie PII scan runs within 24 hours of log upload
- [ ] `/admin/evidence` API responds in < 500ms
- [ ] RLS policies prevent cross-tenant evidence access

---

### Component 6.2 — Compliance Automation (50+ AWS Config Rules)

**Priority:** CRITICAL | **Parallel with 6.1**  
**Theme:** Continuous compliance scoring with framework mappings

**Deliverables:**

_Infrastructure (Terraform):_
```
landing-zone/modules/phase6-compliance/
├── main.tf          — AWS Config rules (25+), conformance packs (HIPAA, NIST 800-53)
├── variables.tf
└── outputs.tf
```

_Lambda Functions:_
- `phase6-backend/functions/compliance_score_recalculator.py` — EventBridge daily cron (02:00 UTC), queries Config/Security Hub/GuardDuty, stores DynamoDB snapshot
- `phase6-backend/functions/compliance_history_api.py` — `/tenant/compliance/history` trend endpoint _(TODO: full implementation)_

_Compliance Mappings:_
- `phase6-backend/compliance/soc2_mapping.json` — 15+ SOC 2 CC controls → AWS Config rules
- `phase6-backend/compliance/hipaa_mapping.json` — 10+ HIPAA technical safeguards → GuardDuty + Config
- `phase6-backend/compliance/fedramp_mapping.json` — 12+ FedRAMP Rev 5 control families → Security Hub

_Database:_
- `phase6-backend/database/migrations/002_compliance_score_history.sql` — `compliance_score_daily`, `control_violation_log` tables with trend indexes

_Tests:_
- `tests/phase6/test_compliance_score_recalculator.py`

**Compliance Framework Coverage:**

| Framework | Standard | Mapping Source |
|-----------|----------|----------------|
| SOC 2 Type II | CC controls (CC6.x, CC7.x, CC8.x, CC9.x) | AWS Config managed rules |
| HIPAA | Technical Safeguards (§164.312) | GuardDuty finding types + Config rules |
| FedRAMP Rev 5 | Control families (AC, AU, CM, IA, SC, SI) | Security Hub NIST 800-53 standard |
| CIS Benchmark | v1.4 Level 1 & 2 | AWS Security Hub CIS standard |

**Scoring Model:**
- Each control is weighted (Critical = 3x, High = 2x, Medium = 1x, Low = 0.5x)
- Score = 100 × (weighted_passing / total_weighted) 
- Daily snapshots stored to DynamoDB `securebase-compliance-scores`
- Trend data retained for 365 days

**Success Criteria:**
- [ ] 50+ Config rules deployed across all accounts
- [ ] SOC 2, HIPAA, FedRAMP conformance packs deployed
- [ ] Daily score recalculation runs within 10 minutes of 02:00 UTC
- [ ] Compliance history API returns 90-day trend data
- [ ] Weighted scoring model validated against known violations

---

### Component 6.3 — Scalability to 10,000+ Concurrent Users

**Priority:** HIGH | **Week 3–4**  
**Theme:** Remove performance bottlenecks before customer growth hits them

**Deliverables:**

_Infrastructure Changes:_
- Terraform: Lambda provisioned concurrency for `auth_v2`, `metrics`, `analytics_query` (100 reserved, 10 provisioned each)
- Terraform: API Gateway stage-level caching enabled (TTL=300s, per-customer cache keys via `X-Customer-ID` header)
- Terraform: DynamoDB on-demand billing migration + additional GSIs for query optimization
- Aurora ACU tuning: update `min_capacity=2`, `max_capacity=128` in `landing-zone/modules/phase2-database/`
- SQS queues for async operations (notification dispatch, evidence packaging, score recalculation)

_Load Testing:_
- `tests/phase6/load_test_10k_users.py` — Locust-based load test simulating 10,000 concurrent users across key API paths

_Documentation:_
- `docs/CAPACITY_PLANNING.md` — 6-month capacity model, cost projections at 1k/5k/10k tenants _(TODO: full implementation)_

**Performance Targets:**

| Metric | Current | Target |
|--------|---------|--------|
| API p95 latency | ~800ms | < 200ms |
| Lambda cold start (auth) | ~1.5s | < 100ms (provisioned) |
| Concurrent users supported | ~500 | 10,000+ |
| API Gateway cache hit rate | 0% | > 60% |
| Aurora ACU auto-scale range | 0.5–8 | 2–128 |

**Success Criteria:**
- [ ] 10,000 concurrent users sustain < 200ms p95 API latency in Locust load test
- [ ] Provisioned concurrency eliminates cold starts on critical paths (< 5ms init)
- [ ] API Gateway cache hit rate > 60% for GET endpoints
- [ ] DynamoDB GSI queries complete in < 10ms (p99)
- [ ] Aurora Serverless v2 auto-scales without throttling under load

---

### Component 6.4 — Build Debt Cleanup

**Priority:** MEDIUM | **Parallel with other components**  
**Theme:** Technical hygiene that enables faster future development

**Deliverables:**

- Remove `--legacy-peer-deps` from all npm install commands in CI workflows and shell scripts (align peer versions)
- Migrate mock data from `phase3a-portal/src/services/mockApiService.js` to `tests/fixtures/mock_api_responses.json`
- Move root-level `*.md` documentation files to `docs/` (update all cross-references)
- Replace standalone shell scripts with GitHub Actions reusable workflows where applicable
- Update `README.md` to reflect current architecture and phase completion status

**Key Files Affected:**
- `.github/workflows/*.yml` — remove `--legacy-peer-deps`
- `phase3a-portal/src/services/mockApiService.js` → `tests/fixtures/mock_api_responses.json`
- `*.md` files (200+ in root) → organized into `docs/` subfolders

**Success Criteria:**
- [ ] `npm install` runs without `--legacy-peer-deps` in all CI workflows
- [ ] Mock data is consolidated in `tests/fixtures/`
- [ ] No markdown files remain in repository root (except README.md, ROADMAP.md, SECURITY.md)
- [ ] All cross-references updated
- [ ] `README.md` accurately reflects current architecture

---

### Component 6.5 — Developer Experience

**Priority:** MEDIUM | **Week 5–6**  
**Theme:** One-command local dev; full API documentation; E2E coverage

**Deliverables:**

_Local Development:_
- `docker-compose.yml` at root — one-command local dev: LocalStack (Aurora → PostgreSQL), Lambda via SAM local, portal via Vite
- `.github/workflows/local-dev-setup.yml` — validates docker-compose configuration in CI

_Component Library:_
- Storybook setup in `phase3a-portal/` — `npm run storybook` with stories for: `Dashboard.jsx`, `Compliance.jsx`, `ApiKeys.jsx`, `TenantDashboard.jsx`, `ComplianceDrift.jsx`

_API Documentation:_
- `docs/api/openapi.yaml` — OpenAPI 3.0 spec covering: auth, billing, compliance, metrics, evidence, admin endpoints

_End-to-End Tests:_
- `tests/e2e/` — Playwright test suite covering: signup flow, login, dashboard load, compliance score view, API key creation, evidence download
- `.github/workflows/e2e-tests.yml` — runs Playwright E2E on every PR targeting `phase3a-portal/**`

**Success Criteria:**
- [ ] `docker compose up` starts full local stack in < 2 minutes
- [ ] Storybook builds without errors; 5+ component stories
- [ ] OpenAPI spec validates with `swagger-cli validate`
- [ ] Playwright E2E suite passes on every PR to main
- [ ] All critical user journeys covered (signup → compliance score → evidence download)

---

## Timeline Estimate

| Week | Dates (from start) | Component | Team | Deliverables |
|------|---------------------|-----------|------|--------------|
| **1** | Week 1 | 6.1 Audit Logging + 6.2 Compliance | 1 BE, 1 DevOps | S3 Object Lock module, Macie, audit_log_packager.py, 50+ Config rules |
| **2** | Week 2 | 6.2 Compliance continued + 6.3 Scalability | 1 BE, 1 DevOps | compliance_score_recalculator.py, mapping JSONs, provisioned concurrency |
| **3** | Week 3 | 6.3 Scalability + 6.4 Build Debt | 1 BE, 1 FE | Aurora ACU tuning, DynamoDB GSIs, API GW caching, remove legacy-peer-deps |
| **4** | Week 4 | 6.4 Build Debt + 6.5 Dev Experience | 1 FE, 1 BE | Mock migration, Storybook, docker-compose.yml |
| **5** | Week 5 | 6.5 Dev Experience + Load Testing | 1 FE, 1 QA | OpenAPI spec, Playwright E2E, load_test_10k_users.py |
| **6** | Week 6 | Integration, documentation, hardening | Full team | Final audit, capacity planning doc, README update |

**Total Estimated Duration:** 6 weeks  
**Team Size:** 3–4 engineers (1 frontend, 1–2 backend, 1 DevOps/platform)

---

## Budget Estimate

### Development Costs
| Role | Hours | Rate | Cost |
|------|-------|------|------|
| Backend Engineer (×2) | 120 hrs each | $150/hr | $36,000 |
| Frontend Engineer | 80 hrs | $150/hr | $12,000 |
| DevOps / Platform Engineer | 100 hrs | $175/hr | $17,500 |
| **Total Development** | | | **$65,500** |

### Infrastructure Costs (Monthly Delta)
| Service | Current | Phase 6 Addition | New Monthly |
|---------|---------|-----------------|-------------|
| S3 Object Lock + Macie | $0 | +$50–$150 | $50–$150 |
| Lambda provisioned concurrency | $0 | +$100–$300 | $100–$300 |
| API Gateway caching | $0 | +$20–$50 | $20–$50 |
| Aurora ACU increase | ~$80 | +$50–$200 | $130–$280 |
| **Total Monthly Delta** | | | **$220–$780** |

**Total Phase 6 Investment:** $65,500 development + ~$5,000 first-year infrastructure = **~$70,500**

---

## Acceptance Criteria Checklist

### 6.1 Immutable Audit Logging
- [x] S3 bucket with Object Lock COMPLIANCE mode (2555 days) deployed via Terraform
- [x] AWS Macie classification job configured and scanning at least weekly
- [x] `audit_log_packager.py` Lambda creates valid zip packages with SHA-256 manifest
- [x] Evidence packages recorded in PostgreSQL `evidence_packages` table with tenant RLS
- [ ] `/admin/evidence` API endpoints respond with correct authorization (API Gateway wiring pending)
- [x] Bucket policy denies `s3:DeleteObject` unconditionally

### 6.2 Compliance Automation
- [x] 26 AWS Config managed rules deployed across all accounts (target: 25+)
- [x] SOC 2 CC controls mapping covers ≥ 15 controls in `soc2_mapping.json`
- [x] HIPAA technical safeguards mapping covers ≥ 10 safeguards in `hipaa_mapping.json`
- [x] FedRAMP Rev 5 control families mapping covers ≥ 12 controls in `fedramp_mapping.json`
- [x] `compliance_score_recalculator.py` runs daily and writes to DynamoDB
- [x] Compliance history API returns trend data for past 90 days
- [x] HIPAA conformance pack deployed via AWS Config
- [ ] NIST 800-53 conformance pack template URL populated (currently placeholder)

### 6.3 Scalability
- [ ] Load test: 10,000 virtual users, p95 < 200ms, 0% error rate sustained for 5 minutes
- [ ] Lambda provisioned concurrency verified with CloudWatch metrics (0 cold starts on warm paths)
- [ ] API Gateway cache hit rate > 60% under load test
- [ ] Aurora auto-scales to 64+ ACU under sustained load

### 6.4 Build Debt
- [ ] CI workflows run without `--legacy-peer-deps`
- [ ] Mock data fixtures centralized in `tests/fixtures/`
- [ ] README.md reflects Phase 6 scope and current status

### 6.5 Developer Experience
- [ ] `docker compose up` reaches healthy state for all services
- [ ] Storybook renders 5+ component stories without errors
- [ ] OpenAPI spec validates without warnings
- [ ] Playwright E2E suite passes (100% on main, 95%+ threshold for PRs)
- [ ] E2E workflow runs on every PR to main

---

## Related Documents

- [`ROADMAP.md`](ROADMAP.md) — Full product roadmap
- [`PHASE5.3_SCOPE.md`](PHASE5.3_SCOPE.md) — Phase 5.3 (predecessor)
- [`TODO_PHASE6.md`](TODO_PHASE6.md) — Detailed task checklist
- [`DISASTER_RECOVERY_PLAN.md`](DISASTER_RECOVERY_PLAN.md) — DR strategy
- [`COST_OPTIMIZATION_PLAYBOOK.md`](COST_OPTIMIZATION_PLAYBOOK.md) — Cost best practices
- [`docs/PAAS_ARCHITECTURE.md`](docs/PAAS_ARCHITECTURE.md) — Full architecture spec

---

**Created:** May 8, 2026  
**Updated:** May 21, 2026  
**Status:** 🔨 In Progress  
**Next Milestone:** Track 5 (6.3 Scalability) — provisioned concurrency + API GW caching + DynamoDB GSIs
