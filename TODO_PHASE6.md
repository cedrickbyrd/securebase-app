# TODO: Phase 6 — Compliance Automation & Operations Scale

**Status:** 🔨 In Progress  
**See:** [PHASE6_SCOPE.md](PHASE6_SCOPE.md) for full scope and success criteria.

---

## 🟢 Active — Customer-Facing (Priority: June 13 trial deadline)

> Components 6.1 and 6.2 are the only tracks with direct customer-facing value before Matthew Matturro / TriNetX converts.
> All other tracks are deferred. See deferral notices below.

---

## Component 6.1 — Immutable Audit Logging at Scale

**Status:** 🔨 In Progress | **Customer impact:** Direct — Matthew sees evidence packages on Day 1

### Terraform Infrastructure
- [x] `landing-zone/modules/phase6-audit-logging/` directory created
- [x] `landing-zone/modules/phase6-audit-logging/main.tf` — S3 Object Lock (COMPLIANCE mode, 2555 days), Macie job, KMS key, bucket policy, Lambda IAM role
- [x] `landing-zone/modules/phase6-audit-logging/variables.tf`
- [x] `landing-zone/modules/phase6-audit-logging/outputs.tf`
- [x] Wire phase6-audit-logging module into `landing-zone/environments/dev/main.tf`
- [ ] Wire phase6-audit-logging module into `landing-zone/environments/prod/main.tf` (when exists)
- [ ] `terraform validate` passes on phase6-audit-logging module

### Lambda Functions
- [x] `phase6-backend/functions/audit_log_packager.py`
- [x] `phase6-backend/functions/audit_evidence_api.py`
- [ ] Add `audit_log_packager` to `phase2-backend/functions/requirements.txt`
- [ ] Package Lambda zips via `package-lambda.sh` update
- [ ] Wire `audit_evidence_api` to API Gateway in `landing-zone/modules/api-gateway/main.tf`

### Portal UI
- [x] `phase3a-portal/src/components/EvidencePackages.jsx` — full evidence center, real API
- [x] `phase3a-portal/src/components/ExportEvidence.jsx` — upgraded from mock to real API
- [x] `phase3a-portal/src/services/evidenceApiService.js` — service layer
- [x] `/evidence` route added to `App.jsx`
- [x] 🔒 Audit Evidence card added to Dashboard metrics grid

### Database Migrations
- [x] `phase6-backend/database/migrations/001_audit_evidence_tables.sql`
- [ ] Test migration against local PostgreSQL
- [ ] Run migration in dev Aurora cluster

### AWS Macie
- [x] `aws_macie2_account` resource in Terraform
- [x] `aws_macie2_classification_job` targeting evidence S3 bucket
- [x] `aws_macie2_findings_filter` for HIGH/CRITICAL PII findings
- [x] SNS notification for Macie findings → admin alert

### Tests
- [x] `tests/phase6/__init__.py`
- [x] `tests/phase6/test_audit_log_packager.py`
- [ ] Run: `pytest tests/phase6/test_audit_log_packager.py -v`

---

## Component 6.2 — Compliance Automation (50+ AWS Config Rules)

**Status:** 🔨 In Progress | **Customer impact:** Direct — Matthew sees 90-day HIPAA trend on Day 7

### Terraform Infrastructure
- [x] `landing-zone/modules/phase6-compliance/main.tf` — 25+ Config rules, HIPAA + NIST conformance packs
- [x] `landing-zone/modules/phase6-compliance/variables.tf`
- [x] `landing-zone/modules/phase6-compliance/outputs.tf`
- [x] Wire phase6-compliance module into `landing-zone/environments/dev/main.tf`

### Compliance Mapping Files
- [x] `phase6-backend/compliance/soc2_mapping.json` — 15+ SOC 2 CC controls
- [x] `phase6-backend/compliance/hipaa_mapping.json` — 10+ HIPAA technical safeguards
- [x] `phase6-backend/compliance/fedramp_mapping.json` — 12+ FedRAMP Rev 5 control families

### Lambda Functions
- [x] `phase6-backend/functions/compliance_score_recalculator.py` — full implementation
- [x] `phase6-backend/functions/compliance_history_api.py` — full implementation

### Portal UI
- [x] `phase3a-portal/src/components/ComplianceTrend.jsx` — 90-day chart, compact + full modes
- [x] `/compliance/trend` route added to `App.jsx`
- [x] 📈 Compliance Trend card added to Dashboard metrics grid
- [x] Compact trend wired into Dashboard right column

### Database Migrations
- [x] `phase6-backend/database/migrations/002_compliance_score_history.sql`
- [ ] Run migration in dev Aurora cluster

### Tests
- [x] `tests/phase6/test_compliance_score_recalculator.py`
- [x] `tests/phase6/test_compliance_history_api.py`
- [ ] Run: `pytest tests/phase6/test_compliance_score_recalculator.py -v`

---

## Track 3 — Alerting & Incident Response ✅ Complete

### Terraform Infrastructure
- [x] `terraform/modules/alerting/sns_topics.tf` — SNS topics for alarm routing
- [x] `terraform/modules/alerting/cloudwatch_alarms.tf` — CloudWatch alarm definitions
- [x] `terraform/modules/alerting/pagerduty_integration.tf` — PagerDuty/Opsgenie wiring
- [x] `terraform/modules/alerting/variables.tf`
- [x] `terraform/modules/alerting/outputs.tf`

### Lambda Functions
- [x] `src/lambdas/alerting/runbook_executor.py` — maintenance mode, runbook matching, step execution
- [x] `src/lambdas/alerting/alarm_aggregator.py` — SNS event parsing, DynamoDB persistence, MTTA/MTTR
- [x] `src/lambdas/alerting/chaos_drill.py` — maintenance mode toggle, Lambda throttle/restore

### Frontend
- [x] `phase3a-portal/src/components/admin/AlertingDashboard.jsx`

### Tests
- [x] `tests/phase6/test_alerting_track3.py` — full coverage for all three Lambda functions

---

## Track 4 — Provisioning & Drift Detection ✅ Complete

### Lambda Functions
- [x] `src/lambdas/provisioning/drift_detector.py` — Terraform plan drift parsing and severity classification
- [x] `src/lambdas/provisioning/tenant_provisioner.py` — API key generation and tenant setup

### Tests
- [x] `tests/phase6/test_track6_provisioning.py` — parse_plan_summary, classify_drift, generate_api_key

---

## 🔴 DEFERRED — Component 6.3 — Scalability to 10,000+ Concurrent Users

> **Deferred:** May 15, 2026  
> **Trigger to activate:** Matthew Matturro / TriNetX conversion confirmed (signed agreement or first invoice paid)  
> **Reason:** Zero customer-facing impact at current scale (1–2 tenants). Platform handles ~500 concurrent users comfortably today. 6.3 becomes critical at growth beyond that threshold.  
> **What’s ready:** `lambda-scaling/main.tf` complete, `load_test_10k_users.py` complete. Infrastructure wiring into `dev/main.tf` is the only remaining work.

### Remaining work (do not start until trigger condition met)
- [ ] Wire `lambda-scaling` module into `landing-zone/environments/dev/main.tf`
- [ ] Terraform: API Gateway stage-level cache (TTL=300s, `X-Customer-ID` cache key)
- [ ] Terraform: DynamoDB on-demand billing migration + GSIs for compliance-scores, metrics-history, audit-trail
- [ ] Update `landing-zone/modules/phase2-database/main.tf`: `min_capacity=2`, `max_capacity=128`
- [ ] Terraform: SQS queues for evidence packaging + score recalculation + DLQs
- [ ] Run baseline load test, document current p95
- [ ] Run post-change load test, verify p95 < 200ms
- [ ] `docs/CAPACITY_PLANNING.md`

---

## 🔴 DEFERRED — Component 6.4 — Build Debt Cleanup

> **Deferred:** May 15, 2026  
> **Trigger to activate:** Matthew Matturro / TriNetX conversion confirmed  
> **Reason:** Purely internal hygiene. Zero customer-facing impact. No blockers to current delivery. Lowest priority in Phase 6.

### Remaining work (do not start until trigger condition met)
- [ ] Remove `--legacy-peer-deps` from all CI workflows and shell scripts
- [ ] Migrate mock data from `mockApiService.js` to `tests/fixtures/mock_api_responses.json`
- [ ] Move root-level `*.md` files to `docs/phases/` (preserve git history)
- [ ] Update all cross-references and `PROJECT_INDEX.md` / `ROADMAP.md` links
- [ ] Convert `package-lambda.sh` and `test-frontend.sh` to GitHub Actions reusable workflows
- [ ] Update `README.md` to reflect Phase 6 status

---

## 🔴 DEFERRED — Component 6.5 — Developer Experience

> **Deferred:** May 15, 2026  
> **Trigger to activate:** Matthew Matturro / TriNetX conversion confirmed AND second engineer onboarded  
> **Reason:** Entirely internal tooling. Matthew cannot see Storybook, docker-compose, or Playwright tests. No value delivered to any customer before trigger condition.

### Remaining work (do not start until trigger condition met)
- [ ] `docker-compose.yml` — full local stack (PostgreSQL, LocalStack, SAM local, Vite, phase6-api)
- [ ] `.env.docker` and `docs/LOCAL_DEV_GUIDE.md`
- [ ] Storybook setup + 5 component stories
- [ ] `docs/api/openapi.yaml` — OpenAPI 3.0.3 spec for all endpoints
- [ ] Playwright E2E suite (`tests/e2e/`) + `.github/workflows/e2e-tests.yml`

---

## Cross-Cutting / Infrastructure

### CI/CD
- [ ] `.github/workflows/phase6-compliance-tests.yml` — lint + unit tests + terraform validate
- [ ] `.github/workflows/e2e-tests.yml` *(deferred with 6.5)*
- [ ] Verify CI workflows pass before marking Phase 6 complete

### Security Review
- [ ] No hardcoded credentials in any Phase 6 files
- [ ] All S3 bucket policies enforce TLS (`aws:SecureTransport`)
- [ ] Lambda IAM roles follow least-privilege (no wildcards)
- [ ] RLS policies on all new PostgreSQL tables
- [ ] Macie findings do not log PII to CloudWatch
- [ ] Evidence package presigned URLs expire in ≤ 1 hour

### Documentation
- [ ] Update `ROADMAP.md` Phase 6 status
- [ ] Update `PROJECT_INDEX.md` with Phase 6 section
- [ ] `docs/CAPACITY_PLANNING.md` *(deferred with 6.3)*
- [ ] `docs/LOCAL_DEV_GUIDE.md` *(deferred with 6.5)*
- [ ] `docs/api/openapi.yaml` *(deferred with 6.5)*

---

## Deferral Summary

| Component | Status | Trigger to Activate |
|---|---|---|
| 6.1 Immutable Audit Logging | 🔨 Active | — |
| 6.2 Compliance Automation | 🔨 Active | — |
| 6.3 Scalability | 🔴 Deferred | Matthew Matturro converts |
| 6.4 Build Debt | 🔴 Deferred | Matthew Matturro converts |
| 6.5 Developer Experience | 🔴 Deferred | Matthew converts + 2nd engineer onboarded |
| 6.6 GTM Operations | 🔴 Deferred | Matthew converts + ARR confirmed |

---

**Last Updated:** May 21, 2026  
**Owner:** Cedrick Byrd (cedrickbyrd)  
**Decision authority:** CEO — Cedrick Byrd
