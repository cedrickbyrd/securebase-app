# Compliance Automation Playbook

## Scope
This playbook defines the operational workflow for **Phase 6 Track 1 — Compliance Automation** across SOC 2, HIPAA, and FedRAMP.

## Current Track 1 Architecture (Repository Source of Truth)

### Core Lambda Functions
1. **Immutable Evidence Packaging (Phase 6.1)**
   - `phase6-backend/functions/audit_log_packager.py`
   - Collects tenant audit logs from S3, generates a package-level SHA-256 manifest, uploads immutable evidence archives with Object Lock retention.

2. **Evidence Management API (Phase 6.1)**
   - `phase6-backend/functions/audit_evidence_api.py`
   - Tenant-scoped endpoints for listing, fetching, and generating evidence packages.

3. **Daily Compliance Scoring (Phase 6.2)**
   - `phase6-backend/functions/compliance_score_recalculator.py`
   - Scheduled recalculation pipeline using AWS Config / Security Hub / GuardDuty mappings and weighted control scoring.

4. **Compliance Trend API (Phase 6.2)**
   - `phase6-backend/functions/compliance_history_api.py`
   - Returns 90-day (configurable) compliance trends from DynamoDB snapshots.

### Framework Mapping Files
- `phase6-backend/compliance/soc2_mapping.json`
- `phase6-backend/compliance/hipaa_mapping.json`
- `phase6-backend/compliance/fedramp_mapping.json`

### Infrastructure Modules
- `landing-zone/modules/phase6-audit-logging/` (Track 1 / 6.1)
  - Evidence S3 bucket with Object Lock COMPLIANCE mode
  - KMS encryption and IAM role for evidence packaging
  - Macie integration and findings topic outputs
- `landing-zone/modules/phase6-compliance/` (Track 1 / 6.2)
  - AWS Config managed rules (26 currently declared)
  - HIPAA + NIST conformance packs
  - Config recorder guard for existing Phase 1 environments

## Data Stores
- **PostgreSQL (Aurora)**
  - `phase6-backend/database/migrations/001_audit_evidence_tables.sql`
    - `evidence_packages`, `macie_findings` (RLS enabled)
  - `phase6-backend/database/migrations/002_compliance_score_history.sql`
    - `compliance_score_daily`, `control_violation_log` (RLS enabled)
- **DynamoDB**
  - `securebase-compliance-scores` (trend snapshots consumed by compliance history API)

## API Endpoints
- `GET /tenant/compliance/history`
- `GET /admin/evidence`
- `GET /admin/evidence/{package_id}`
- `POST /admin/evidence/generate`

## Validation and Tests
- `tests/phase6/test_audit_log_packager.py`
- `tests/phase6/test_compliance_score_recalculator.py`
- `tests/phase6/test_compliance_history_api.py`
- `tests/phase6/test_track1_compliance_lambdas.py`

## Operational Checklist
- [ ] Wire Phase 6 Track 1 module outputs into active environment stacks (`landing-zone/environments/*`)
- [ ] Confirm EventBridge schedules are enabled for score recalculation and evidence packaging
- [ ] Verify API Gateway routes/integrations for `/tenant/compliance/history` and `/admin/evidence*`
- [ ] Validate object-lock retention and KMS settings in deployed evidence buckets
- [ ] Run Track 1 Phase 6 tests and validate no regressions in existing compliance dashboards
