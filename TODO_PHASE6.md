# TODO: Phase 6 — Compliance Automation & Operations Scale

**Status:** 🔨 In Progress  
**See:** [PHASE6_SCOPE.md](PHASE6_SCOPE.md) for full scope and success criteria.

---

## Component 6.1 — Immutable Audit Logging at Scale

### Terraform Infrastructure
- [x] Create `landing-zone/modules/phase6-audit-logging/` directory
- [x] `landing-zone/modules/phase6-audit-logging/main.tf` — S3 Object Lock (COMPLIANCE mode, 2555 days), Macie job, KMS key, bucket policy, Lambda IAM role
- [x] `landing-zone/modules/phase6-audit-logging/variables.tf` — `environment`, `project_name`, `tags`, `evidence_bucket_name`, `kms_key_arn`
- [x] `landing-zone/modules/phase6-audit-logging/outputs.tf` — `evidence_bucket_arn`, `evidence_bucket_name`, `kms_key_id`, `lambda_role_arn`
- [x] Wire phase6-audit-logging module into `landing-zone/environments/dev/main.tf`
- [ ] Wire phase6-audit-logging module into `landing-zone/environments/prod/main.tf` (when exists)
- [ ] `terraform validate` passes on phase6-audit-logging module

### Lambda Functions
- [x] `phase6-backend/functions/audit_log_packager.py` — collect logs, zip, SHA-256 manifest, upload with Object Lock, write DB record
- [x] `phase6-backend/functions/audit_evidence_api.py` — `GET /admin/evidence`, `GET /admin/evidence/{id}`, `POST /admin/evidence/generate`
- [ ] Add `audit_log_packager` to `phase2-backend/functions/requirements.txt` (boto3 already included)
- [ ] Package Lambda zips via `package-lambda.sh` update
- [ ] Wire `audit_evidence_api` to API Gateway in `landing-zone/modules/api-gateway/main.tf`

### Database Migrations
- [x] `phase6-backend/database/migrations/001_audit_evidence_tables.sql` — `evidence_packages` table, `macie_findings` table, RLS policies, indexes
- [ ] Test migration against local PostgreSQL
- [ ] Run migration in dev Aurora cluster

### AWS Macie
- [x] Terraform: `aws_macie2_account` resource (enable Macie) with `count` guard if already enabled
- [x] Terraform: `aws_macie2_classification_job` targeting the evidence S3 bucket
- [ ] Terraform: `aws_macie2_findings_filter` for HIGH/CRITICAL severity PII findings
- [x] SNS notification for Macie findings → admin alert

### Tests
- [x] `tests/phase6/__init__.py` — empty init file
- [x] `tests/phase6/test_audit_log_packager.py`
  - [ ] Test: handler invoked successfully with valid event
  - [ ] Test: S3 `put_object` called with correct Retention settings
  - [ ] Test: SHA-256 manifest file included in zip
  - [ ] Test: DB record written to `evidence_packages`
  - [ ] Test: error handling for missing `tenant_id` in event
  - [ ] Test: error handling for empty S3 log prefix
- [x] `tests/phase6/test_track1_compliance_lambdas.py` — evidence_collector, audit_log_validator coverage
- [ ] Run: `pytest tests/phase6/test_audit_log_packager.py -v`

---

## Component 6.2 — Compliance Automation (50+ AWS Config Rules)

### Terraform Infrastructure
- [x] `landing-zone/modules/phase6-compliance/main.tf`
  - [x] `aws_config_configuration_recorder` with `count` guard (skip if already enabled by phase1 security module)
  - [x] `aws_config_delivery_channel` to existing S3 bucket
  - [x] 25+ `aws_config_rule` resources for SOC 2 controls (26 rules deployed):
    - [x] `s3-bucket-ssl-requests-only`
    - [x] `encrypted-volumes`
    - [x] `iam-password-policy`
    - [x] `mfa-enabled-for-iam-console-access`
    - [x] `root-account-mfa-enabled`
    - [x] `cloudtrail-enabled`
    - [x] `cloudtrail-log-file-validation-enabled`
    - [x] `vpc-flow-logs-enabled`
    - [x] `guardduty-enabled-centralized`
    - [x] `s3-bucket-logging-enabled`
    - [x] `s3-bucket-versioning-enabled`
    - [x] `s3-bucket-public-read-prohibited`
    - [x] `s3-bucket-public-write-prohibited`
    - [x] `iam-no-inline-policy-check`
    - [x] `iam-root-access-key-check`
    - [x] `access-keys-rotated` (90-day rotation)
    - [x] `rds-instance-public-access-check`
    - [x] `rds-storage-encrypted`
    - [x] `rds-multi-az-support`
    - [x] `lambda-function-public-access-prohibited`
    - [x] `api-gw-ssl-enabled`
    - [x] `cloudwatch-alarm-action-check`
    - [x] `kms-cmk-not-scheduled-for-deletion`
    - [x] `secretsmanager-rotation-enabled-check`
    - [x] `ec2-imdsv2-check`
    - [x] `dynamodb-in-backup-plan`
  - [x] `aws_config_conformance_pack` for HIPAA (AWS managed)
  - [x] `aws_config_conformance_pack` for NIST 800-53
  - [ ] Replace conformance pack TODO placeholder URLs with real AWS-managed template URIs
- [x] `landing-zone/modules/phase6-compliance/variables.tf`
- [x] `landing-zone/modules/phase6-compliance/outputs.tf`
- [x] Wire phase6-compliance module into `landing-zone/environments/dev/main.tf`

### Compliance Mapping Files
- [x] `phase6-backend/compliance/soc2_mapping.json` — ≥ 15 SOC 2 CC controls → Config rule names
- [x] `phase6-backend/compliance/hipaa_mapping.json` — ≥ 10 HIPAA technical safeguards → GuardDuty finding types + Config rules
- [x] `phase6-backend/compliance/fedramp_mapping.json` — ≥ 12 FedRAMP Rev 5 control families → Security Hub standards
- [ ] Validate JSON syntax for all three mapping files

### Lambda Functions
- [x] `phase6-backend/functions/compliance_score_recalculator.py`
  - [ ] EventBridge schedule (daily at 02:00 UTC) — wire in Terraform
  - [ ] Query AWS Config for all compliance rules
  - [ ] Query Security Hub findings (active, FAILED)
  - [ ] Query GuardDuty findings (HIGH/CRITICAL severity)
  - [ ] Load SOC 2 / HIPAA / FedRAMP mapping files from S3 or Lambda package
  - [ ] Calculate weighted compliance score per framework (0–100)
  - [ ] Write daily snapshot to DynamoDB `securebase-compliance-scores`
  - [ ] Structured JSON logging
- [x] `phase6-backend/functions/compliance_history_api.py` — `GET /tenant/compliance/history` with 90-day trend _(full implementation in progress)_
- [ ] Wire `compliance_history_api` to API Gateway in `landing-zone/modules/api-gateway/main.tf`

### Database Migrations
- [x] `phase6-backend/database/migrations/002_compliance_score_history.sql` — `compliance_score_daily`, `control_violation_log` tables, composite indexes for trend queries
- [ ] Run migration in dev Aurora cluster

### Tests
- [x] `tests/phase6/test_compliance_score_recalculator.py`
  - [ ] Test: mapping files load correctly (valid JSON, required keys present)
  - [ ] Test: weighted score calculation logic (100% passing → 100, 0% → 0, mixed → expected value)
  - [ ] Test: DynamoDB write called with correct item structure
  - [ ] Test: error handling when Config API returns throttle error
  - [ ] Test: error handling when Security Hub is not enabled
- [x] `tests/phase6/test_compliance_history_api.py`
- [ ] Run: `pytest tests/phase6/test_compliance_score_recalculator.py -v`

---

## Track 3 — Alerting & Incident Response ✅ Complete

_Delivered alongside Phase 6 sprint. All deliverables present._

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

_Delivered alongside Phase 6 sprint. All deliverables present._

### Lambda Functions
- [x] `src/lambdas/provisioning/drift_detector.py` — Terraform plan drift parsing and severity classification
- [x] `src/lambdas/provisioning/tenant_provisioner.py` — API key generation and tenant setup

### Tests
- [x] `tests/phase6/test_track6_provisioning.py` — parse_plan_summary, classify_drift, generate_api_key

---

## Component 6.3 — Scalability to 10,000+ Concurrent Users

### Lambda Provisioned Concurrency
- [ ] Terraform: `aws_lambda_provisioned_concurrency_config` for `securebase-{env}-auth-v2` (10 provisioned)
- [ ] Terraform: `aws_lambda_provisioned_concurrency_config` for `securebase-{env}-metrics` (10 provisioned)
- [ ] Terraform: `aws_lambda_provisioned_concurrency_config` for `securebase-{env}-analytics-query` (10 provisioned)
- [ ] Terraform: `aws_lambda_reserved_concurrency` for each (100 reserved)

### API Gateway Caching
- [ ] Terraform: Enable API Gateway stage-level cache in `landing-zone/modules/api-gateway/main.tf`
- [ ] Cache TTL = 300 seconds for GET endpoints
- [ ] Cache key includes `X-Customer-ID` header for tenant isolation
- [ ] Disable cache for POST/PUT/DELETE (mutable operations)

### DynamoDB Optimization
- [ ] Terraform: Migrate DynamoDB tables to on-demand billing mode (`PROVISIONED` → `PAY_PER_REQUEST`)
- [ ] Add GSI: `securebase-compliance-scores` on `(customer_id, date)` for trend queries
- [ ] Add GSI: `securebase-metrics-history` on `(customer_id, timestamp)` for range queries
- [ ] Add GSI: `securebase-audit-trail` on `(customer_id, created_at)` for pagination

### Aurora Serverless v2 Tuning
- [ ] Update `landing-zone/modules/phase2-database/main.tf`: `min_capacity = 2`, `max_capacity = 128`
- [ ] Add RDS Performance Insights (7-day retention for dev, 31-day for prod)
- [ ] Configure RDS Proxy `max_connections_percent = 90`

### SQS Async Operations
- [ ] Terraform: SQS queue for evidence package generation requests (async)
- [ ] Terraform: SQS queue for compliance score recalculation triggers
- [ ] Terraform: DLQ for both queues (max_receive_count = 3)

### Load Testing
- [x] `tests/phase6/load_test_10k_users.py` (Locust)
  - [ ] Scenario: 10,000 virtual users ramp over 5 minutes
  - [ ] Tasks: GET /tenant/dashboard, GET /tenant/compliance/score, GET /invoices, POST /api-keys
  - [ ] Assert p95 < 200ms, error rate < 0.1%
- [ ] Run baseline load test before changes (document current p95)
- [ ] Run load test after provisioned concurrency + caching (verify targets met)

### Documentation
- [ ] `docs/CAPACITY_PLANNING.md` — capacity model at 1k/5k/10k tenants, cost projections

---

## Component 6.4 — Build Debt Cleanup

### npm / Node.js
- [ ] Audit all `.github/workflows/*.yml` for `--legacy-peer-deps` and remove
- [ ] Audit all `*.sh` scripts in root for `--legacy-peer-deps` and remove
- [ ] Update `phase3a-portal/package.json` to resolve peer dependency conflicts natively
- [ ] Update root `package.json` to resolve peer dependency conflicts natively
- [ ] Run `npm install` in both root and `phase3a-portal/` and commit updated lock files
- [ ] Verify CI workflows pass without `--legacy-peer-deps`

### Mock Data Migration
- [ ] Create `tests/fixtures/` directory
- [ ] Create `tests/fixtures/mock_api_responses.json` with all mock response shapes from `mockApiService.js`
- [ ] Update `phase3a-portal/src/services/mockApiService.js` to import from `tests/fixtures/mock_api_responses.json`
- [ ] Verify portal still renders correctly in demo mode (`VITE_USE_MOCK_API=true`)

### Documentation Consolidation
- [ ] Create `docs/phases/` subdirectory for phase-specific docs
- [ ] Move phase-specific `*.md` files from root to `docs/phases/` (preserve git history with `git mv`)
- [ ] Update all cross-references in moved files
- [ ] Update `PROJECT_INDEX.md` links
- [ ] Update `ROADMAP.md` links
- [ ] Verify no broken links remain in root `README.md`

### Shell Script Retirement
- [ ] Audit all `*.sh` scripts in root — identify candidates for GitHub Actions reusable workflows
- [ ] Convert `package-lambda.sh` to `.github/workflows/package-lambdas.yml` (reusable)
- [ ] Convert `test-frontend.sh` equivalent to `.github/workflows/test-portal.yml`
- [ ] Retire superseded shell scripts (or keep with `# DEPRECATED` header)

### README Update
- [ ] Update `README.md` architecture section to include Phase 6 components
- [ ] Update Phase status table (Phase 5.3 in progress, Phase 6 in progress)
- [ ] Add Phase 6 quick-start section
- [ ] Verify all links in README.md are valid

---

## Component 6.5 — Developer Experience

### Local Development Environment
- [ ] `docker-compose.yml` at root
  - [ ] Service: `postgres` (PostgreSQL 15 — local Aurora substitute)
  - [ ] Service: `localstack` (S3, DynamoDB, SQS, Secrets Manager, KMS)
  - [ ] Service: `lambda-api` (AWS SAM local start-api for phase2-backend functions)
  - [ ] Service: `portal` (Vite dev server for phase3a-portal)
  - [ ] Service: `phase6-api` (SAM local for phase6-backend functions)
  - [ ] Health checks for all services
  - [ ] Volume mounts for local code hot-reload
- [ ] `.env.docker` — local environment variables for docker-compose
- [ ] `docs/LOCAL_DEV_GUIDE.md` — instructions for running full stack locally
- [ ] Test: `docker compose up` reaches healthy state in < 2 minutes
- [ ] `.github/workflows/local-dev-setup.yml` — validates docker-compose config in CI

### Storybook
- [ ] Install Storybook in `phase3a-portal/`: `npx storybook@latest init`
- [ ] Configure Storybook with Tailwind CSS support
- [ ] Story: `Dashboard.stories.jsx` — loaded state, loading state, error state
- [ ] Story: `Compliance.stories.jsx` — passing score, failing controls, no data
- [ ] Story: `ApiKeys.stories.jsx` — list view, create modal, revoke confirmation
- [ ] Story: `TenantDashboard.stories.jsx` — all metric panels
- [ ] Story: `ComplianceDrift.stories.jsx` — 90-day timeline with MTTR data
- [ ] Add `npm run storybook` script to `phase3a-portal/package.json`
- [ ] Add `npm run build-storybook` script to `phase3a-portal/package.json`
- [ ] Verify Storybook builds without errors

### OpenAPI Specification
- [ ] `docs/api/openapi.yaml` — OpenAPI 3.0.3 spec
  - [ ] Auth endpoints: `POST /auth/login`, `POST /auth/validate`
  - [ ] Billing endpoints: `GET /invoices`, `GET /invoices/{id}`, `POST /billing/usage`
  - [ ] Compliance endpoints: `GET /tenant/compliance/score`, `GET /tenant/compliance/history`
  - [ ] Metrics endpoints: `GET /tenant/dashboard`, `GET /tenant/metrics`
  - [ ] Evidence endpoints: `GET /admin/evidence`, `GET /admin/evidence/{id}`, `POST /admin/evidence/generate`
  - [ ] API Keys endpoints: `GET /api-keys`, `POST /api-keys`, `DELETE /api-keys/{id}`
  - [ ] Security scheme: API key (`X-API-Key` header)
  - [ ] Response schemas with examples
- [ ] Validate: `npx @apidevtools/swagger-cli validate docs/api/openapi.yaml`

### E2E Tests (Playwright)
- [ ] `tests/e2e/` directory
- [ ] `tests/e2e/playwright.config.ts` — base URL, screenshots on failure, video on retry
- [ ] `tests/e2e/signup.spec.ts` — complete signup flow
- [ ] `tests/e2e/login.spec.ts` — login, session persistence, logout
- [ ] `tests/e2e/dashboard.spec.ts` — dashboard loads, metrics display, refresh
- [ ] `tests/e2e/compliance.spec.ts` — compliance score view, drill-down, drift chart
- [ ] `tests/e2e/api-keys.spec.ts` — create key, copy to clipboard, revoke key
- [ ] Add `npm run test:e2e` to `phase3a-portal/package.json`
- [ ] `.github/workflows/e2e-tests.yml`
  - [ ] Trigger: PR to `main` affecting `phase3a-portal/**`
  - [ ] Job: install Playwright, build portal, run E2E tests
  - [ ] Upload screenshots/videos as artifacts on failure

---

## Cross-Cutting / Infrastructure

### CI/CD
- [ ] `.github/workflows/phase6-compliance-tests.yml`
  - [ ] `lint` job: `flake8` + `black --check` on `phase6-backend/functions/*.py`
  - [ ] `unit-tests` job: `pytest tests/phase6/` with coverage ≥ 80%
  - [ ] `terraform-validate` job: `terraform validate` on `landing-zone/modules/phase6-*`
- [ ] `.github/workflows/e2e-tests.yml`
  - [ ] `e2e` job: Playwright install + portal build + test run
  - [ ] Artifact upload on failure
- [ ] Verify both workflows pass in CI before marking Phase 6 complete

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
- [ ] Create `docs/CAPACITY_PLANNING.md`
- [ ] Create `docs/LOCAL_DEV_GUIDE.md`
- [ ] Create `docs/api/openapi.yaml`

---

**Last Updated:** May 21, 2026  
**Owner:** Cedrick Byrd (cedrickbyrd)
