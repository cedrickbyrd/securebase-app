# Phase 6 — Compliance Automation & Operations Scale

**Project:** SecureBase  
**Phase:** 6  
**Status:** 🔨 In Progress — 85% Implemented (merged, not fully operationalized)  
**Depends On:** Phase 5 ✅ (Logging, Alerting, Multi-Region DR, Cost Optimization)  
**Audit Posture:** Pre-audit prep (no active audit window)  
**Frameworks:** HIPAA (primary), SOC 2 Type II (primary), FedRAMP Moderate (baseline, low priority)

---

## Objective

Automate the evidence collection, drift detection, and reporting workflows that a
compliance auditor would review. The goal is a state where a SOC 2 Type II or HIPAA
audit could begin at any time with zero scrambling — evidence is already collected,
signed, and vaulted; control test results are fresh; the export is one button click.

## Implementation Status Snapshot (May 2026)

| Track | Status | Notes |
|---|---|---|
| Track 1 — Compliance Automation | 🔨 Operationalizing | Phase 6.1/6.2 Lambdas, Terraform modules, mappings, and tests are in repo; environment wiring and schedule enablement are the remaining operational steps |
| Track 2 — Multi-Region DR | ✅ Operational | CloudFront-origin failover is active with conditional Route53; final operator gate closure tracked in `docs/runbooks/PHASE5_DR_DRILL.md` |
| Track 3 — Alerting & Incident Response | ✅ Merged | Terraform + lambdas + tests in repo |
| Track 4 — Distributed Tracing | ✅ Merged | Delivered under Phase 5 logging stack; observability controls active |
| Track 5 — Scale & Cost Controls | 🔨 Operationalizing | Scaling modules and cost aggregation present; load validation automation pending |
| Track 6 — IaC Pipeline Automation | 🔨 Operationalizing | Pipeline modules/workflows merged; end-to-end validation loop being finalized |

Overall implementation completion is currently **~85%**, aligned to the roadmap and pending final operationalization/validation steps.

## Route53 + Netlify Edge Configuration

When DNS is managed at Netlify, keep Route53 failover resources **disabled** and rely on CloudFront origin failover. To enable Route53 health checks explicitly, set all of the following in environment tfvars:

```hcl
route53_hosted_zone_id = "Z123EXAMPLE"
api_dns_name           = "api.securebase.tximhotep.com"
primary_api_endpoint   = "primary-api.example.com"
secondary_api_endpoint = "secondary-api.example.com"
```

For Netlify-edge DNS mode (current), keep these blank and use:

```hcl
route53_hosted_zone_id = ""
primary_api_endpoint   = ""
secondary_api_endpoint = ""
```

This ensures `landing-zone/modules/multi-region/route53-failover.tf` only creates health checks when DNS ownership is in Route53 and avoids split-brain routing with Netlify.

---

## Component 1 — Audit Logging Implementation

**Priority:** Critical (blocks Components 2 and 4)  
**Status:** Core implementation merged — integration hardening in progress

### What's there
- `phase6-backend/functions/audit_log_packager.py` — immutable audit package generation with SHA-256 manifest + S3 Object Lock uploads.
- `phase6-backend/functions/audit_evidence_api.py` — `/admin/evidence*` API for list/get/generate flows.
- `landing-zone/modules/phase6-audit-logging/` — KMS, Object Lock evidence bucket, IAM role, and Macie-related outputs.
- `phase6-backend/database/migrations/001_audit_evidence_tables.sql` — `evidence_packages` and `macie_findings` with RLS.
- `tests/phase6/test_audit_log_packager.py` and `tests/phase6/test_track1_compliance_lambdas.py` cover Track 1 audit paths.

### Deliverables

**Lambda (`audit_logging.py`):**
- Implement `log_activity()` — write to `activity_feed` (Aurora) for queryable recent events
- Implement `archive_old_logs()` — move rows older than 90 days to S3 (Parquet via
  `pandas` + `pyarrow` layer, or line-delimited JSON if layer budget is tight)
- S3 archive prefix: `audit-logs/year={}/month={}/customer={}/`
- 7-year S3 retention lifecycle rule (HIPAA-AU.2); Object Lock Governance mode
- Structured log schema (matches `docs/AUDIT_LOG_SCHEMA.md`):

```json
{
  "event_id": "uuid",
  "customer_id": "uuid",
  "user_id": "uuid | null",
  "session_id": "string | null",
  "action": "user.login | data.read | config.change | ...",
  "resource_type": "user | tenant | report | control | vendor",
  "resource_id": "uuid | null",
  "outcome": "success | failure | denied",
  "ip_address": "anonymized last octet for non-admin",
  "user_agent": "string",
  "metadata": {},
  "timestamp": "ISO-8601"
}
```

**Wire into existing Lambdas:**
- `auth_v2.py` — login, logout, MFA verify, failed auth
- `user_management.py` — create, update, deactivate user
- `rbac_engine.py` — permission grant, deny, role change
- `tenant_metrics.py` — PHI access events (HIPAA-AU.1)

**Terraform (`landing-zone/modules/phase6-compliance/audit.tf`):**
- EventBridge rule: `rate(1 day)` → `archive_old_logs` Lambda
- S3 lifecycle rule: 90-day transition to Glacier, 7-year expiry
- CloudWatch alarm: audit write failure rate > 0 (any failure is critical)

---

## Component 2 — Automated Evidence Collection

**Priority:** High  
**Status:** Compliance scoring and history APIs are implemented; framework-specific collector expansion remains planned.

### What's there
- `phase6-backend/functions/compliance_score_recalculator.py` — weighted framework scoring with daily scheduled model (`cron(0 2 * * ? *)`).
- `phase6-backend/functions/compliance_history_api.py` — tenant compliance trend API backed by DynamoDB snapshots.
- `phase6-backend/compliance/{soc2,hipaa,fedramp}_mapping.json` — framework mapping sources.
- `landing-zone/modules/phase6-compliance/` — 26 AWS Config rules + conformance packs.
- `phase6-backend/database/migrations/002_compliance_score_history.sql` — score history and violation log schema (RLS).
- `tests/phase6/test_compliance_score_recalculator.py` and `tests/phase6/test_compliance_history_api.py` cover Track 1 scoring/trend paths.

### Deliverables

**`soc2_compliance_collector.py` (new Lambda):**

Controls to collect (Trust Service Criteria, pre-audit prep scope):

| Control ID  | TSC  | Evidence Collected |
|-------------|------|--------------------|
| SOC2-CC6.1  | CC6  | IAM policies, MFA enforcement rate |
| SOC2-CC6.2  | CC6  | Access review records (90-day lookback) |
| SOC2-CC6.3  | CC6  | Offboarding audit trail (deactivated users) |
| SOC2-CC7.1  | CC7  | CloudTrail enabled, log integrity |
| SOC2-CC7.2  | CC7  | Vulnerability scan results (last 30 days) |
| SOC2-CC8.1  | CC8  | Change management records (git commits → Aurora) |
| SOC2-A1.1   | A1   | Uptime metrics (CloudWatch SLA dashboard) |
| SOC2-A1.2   | A1   | Backup test results (Aurora restore test logs) |
| SOC2-C1.1   | C1   | Data classification inventory |
| SOC2-C1.2   | C1   | Encryption-at-rest configuration (KMS key policy) |

Evidence pipeline (matches HIPAA pattern):
```
AWS APIs → Lambda → SHA-256 → KMS sign → S3 vault (SOC2/ prefix, Object Lock)
                             ↓
           Aurora (soc2_evidence, soc2_evidence_signatures tables)
```

Invocation modes (same as HIPAA collector):
- Scheduled: EventBridge `rate(7 days)` — all active tenants
- On-demand: `POST /compliance/soc2/collect` (single tenant, optional control filter)
- Export: `POST /compliance/soc2/audit-export` — signed ZIP package

**`fedramp_compliance_collector.py` (new Lambda, low priority):**

Moderate baseline — minimum viable control set only:

| Control ID | Family | Evidence Collected |
|------------|--------|--------------------|
| FED-AC-2   | AC     | Account management records |
| FED-AU-2   | AU     | Audit event types configured |
| FED-AU-9   | AU     | Audit log protection (Object Lock, KMS) |
| FED-SC-8   | SC     | TLS in-transit configuration |
| FED-SC-28  | SC     | Encryption at rest (KMS key inventory) |
| FED-IA-2   | IA     | MFA for privileged accounts |
| FED-SI-2   | SI     | Flaw remediation (CVE scan results) |

Schedule: `rate(30 days)` — monthly cadence matches FedRAMP continuous monitoring

**Terraform (`landing-zone/modules/phase6-compliance/evidence-collectors.tf`):**
- Lambda resources for both new collectors
- EventBridge schedules (SOC 2: weekly, FedRAMP: monthly, HIPAA: already daily)
- S3 evidence bucket policy enforcement (Object Lock Compliance mode for prod)
- IAM role with least-privilege: read-only to IAM, CloudTrail, KMS, CloudWatch

---

## Component 3 — Audit Export & Reporting

**Priority:** High  
**Status:** `ExportEvidence.jsx` is a stub (`setTimeout` simulating export, no real API call).
`report_engine.py` Lambda exists and handles PDF generation for analytics reports.

### Deliverables

**`compliance_export.py` (new Lambda):**
- `POST /compliance/export` — accepts `{ framework, customer_id, period_start, period_end }`
- Queries S3 evidence vault for the requested framework + time range
- Generates a signed ZIP containing:
  - `evidence/` — raw evidence files per control
  - `control_mapping.csv` — control ID, description, evidence file, collected_at, status
  - `attestation.json` — KMS-signed attestation of package integrity
  - `auditor_notes.txt` — placeholder with instructions for the auditor
- Returns a pre-signed S3 URL (15-minute expiry) for the portal to trigger download
- Async via SQS for large packages (> 50 evidence files): returns `job_id`, portal polls
  `GET /compliance/export/{job_id}`

**`ExportEvidence.jsx` (replace stub):**
- Call `POST /compliance/export` with framework selector (SOC 2 / HIPAA / FedRAMP)
- Date range picker (default: last 12 months)
- Show progress spinner while waiting; poll job status if async
- Trigger browser download when pre-signed URL is returned
- Display last export timestamp and package size

**`report_engine.py` addition:**
- Add `compliance_summary` report type — 2-page PDF:
  - Page 1: framework name, period, overall pass rate, control count by status
  - Page 2: failing controls table with remediation links

---

## Component 4 — Continuous Control Testing

**Priority:** High  
**Status:** `ComplianceDrift.jsx` (Phase 5.2) reads from `securebase-compliance-violations`
DynamoDB table, but nothing writes to it automatically — it's populated manually or by
demo data. The Phase 5.3 `control_test_runner` does not yet exist.

### Deliverables

**`control_test_runner.py` (new Lambda):**

Tests each control against live AWS configuration using AWS Config, IAM, CloudTrail, and KMS APIs.

Control tests to implement (initial set):

| Test ID          | What it checks | Pass condition |
|------------------|----------------|----------------|
| `mfa-enforced`   | IAM: MFA device attached to all IAM users | 100% coverage |
| `cloudtrail-on`  | CloudTrail: multi-region trail enabled, log validation on | enabled |
| `s3-no-public`   | S3: all buckets have PublicAccessBlock = true | 100% coverage |
| `kms-rotation`   | KMS: all CMKs have automatic rotation enabled | 100% coverage |
| `tls-min-12`     | API GW: minimum TLS = 1.2 | all APIs |
| `rds-encrypted`  | RDS: storage encryption enabled | true |
| `rds-backup`     | RDS: backup retention ≥ 7 days | ≥ 7 |
| `secrets-no-env` | Lambda: no env vars matching `(?i)(secret|key|token|password)` | 0 matches |
| `iam-no-star`    | IAM: no inline policies with `"Action": "*"` | 0 policies |
| `logs-enabled`   | CloudWatch: log group exists for every Lambda | 100% coverage |

On failure:
1. Write drift record to `securebase-compliance-violations` DynamoDB table
   (schema matches Phase 5.2 `ComplianceDrift.jsx` expectations)
2. Publish to Phase 5.3 SNS alert topic (`module.phase5_alerting.sns_topic_arn`)
3. If `severity == "critical"`: auto-create support ticket via `support_tickets.py`

On recovery (previously failing, now passing):
- Write resolution record to same table
- Publish recovery notification to SNS

**Terraform (`landing-zone/modules/phase6-compliance/control-testing.tf`):**
- Lambda + EventBridge `rate(6 hours)`
- IAM role: read-only to Config, IAM, S3, KMS, CloudTrail, API GW, Lambda, RDS
- CloudWatch alarm: test runner execution failure (zero results = Lambda crashed)

**`ComplianceDrift.jsx` (minor update):**
- Add "Last tested" timestamp pulled from DynamoDB
- Add "Run now" button calling `POST /compliance/controls/test` (on-demand)
- No other changes — the component already renders violations correctly

---

## Component 5 — Vendor Risk & BAA Tracking

**Priority:** Medium  
**Status:** Nothing exists. No vendor table, no UI, no API endpoints.
Empty table — customers add vendors manually.

### Deliverables

**DynamoDB table `securebase-vendor-risk`:**
```
PK: customer_id#{vendor_id}
SK: "VENDOR"
Attributes:
  vendor_id        string (uuid)
  customer_id      string
  name             string
  category         string  (cloud | saas | contractor | subprocessor)
  risk_rating      string  (low | medium | high | critical)
  data_access      list    (PHI | PII | financial | none)
  review_due_date  string  (ISO date)
  baa_required     bool
  baa_status       string  (not_required | pending | active | expired)
  baa_expiry       string  (ISO date | null)
  baa_s3_key       string  (null until uploaded)
  notes            string
  created_at       string
  updated_at       string
```

**`vendor_risk.py` (new Lambda — 6 endpoints):**
- `GET  /compliance/vendors` — list vendors for customer (paginated)
- `POST /compliance/vendors` — create vendor
- `PUT  /compliance/vendors/{id}` — update vendor
- `DELETE /compliance/vendors/{id}` — soft delete
- `GET  /compliance/vendors/{id}/baa` — generate pre-signed S3 upload URL for BAA doc
- `GET  /compliance/baa/expiring` — vendors with BAA expiring within 30 days

**`VendorRisk.jsx` (new portal component):**
- Vendor table with columns: Name, Category, Risk Rating, Data Access, BAA Status, Review Due
- Add/Edit vendor form (inline or modal)
- BAA upload button → uses pre-signed URL, stores S3 key in DynamoDB
- "Expiring soon" banner when any BAA expires within 30 days
- Color-coded risk rating badges (red = critical/high, yellow = medium, green = low)
- Empty state: friendly prompt to add first vendor (no seed data)

**Terraform (`landing-zone/modules/phase6-compliance/vendor-risk.tf`):**
- DynamoDB table with KMS encryption, PITR enabled
- Lambda + API GW routes
- EventBridge `rate(1 day)` → check BAA expiry → SNS alert if expiring < 30 days

---

## File Map

```
phase2-backend/functions/
├── audit_logging.py                  (implement existing scaffold)
├── soc2_compliance_collector.py      (new)
├── fedramp_compliance_collector.py   (new)
├── compliance_export.py              (new)
├── control_test_runner.py            (new)
└── vendor_risk.py                    (new)

landing-zone/modules/phase6-compliance/
├── variables.tf
├── audit.tf                          (audit archive schedule + alarm)
├── evidence-collectors.tf            (SOC 2 + FedRAMP Lambdas + schedules)
├── control-testing.tf                (test runner Lambda + schedule)
├── vendor-risk.tf                    (DynamoDB table + Lambda)
└── outputs.tf

phase3a-portal/src/components/
├── ExportEvidence.jsx                (replace stub with real API call)
├── VendorRisk.jsx                    (new)
└── ComplianceDrift.jsx               (minor: add "last tested" + "run now")
```

---

## API Endpoints Added

| Method | Path | Lambda | Auth |
|--------|------|--------|------|
| POST | `/compliance/soc2/collect` | soc2_compliance_collector | JWT (admin) |
| POST | `/compliance/soc2/audit-export` | soc2_compliance_collector | JWT (admin) |
| POST | `/compliance/fedramp/collect` | fedramp_compliance_collector | JWT (admin) |
| POST | `/compliance/export` | compliance_export | JWT |
| GET | `/compliance/export/{job_id}` | compliance_export | JWT |
| GET | `/compliance/controls/status` | control_test_runner | JWT |
| POST | `/compliance/controls/test` | control_test_runner | JWT (admin) |
| GET | `/compliance/vendors` | vendor_risk | JWT |
| POST | `/compliance/vendors` | vendor_risk | JWT |
| PUT | `/compliance/vendors/{id}` | vendor_risk | JWT |
| DELETE | `/compliance/vendors/{id}` | vendor_risk | JWT |
| GET | `/compliance/vendors/{id}/baa` | vendor_risk | JWT |
| GET | `/compliance/baa/expiring` | vendor_risk | JWT |

---

## Delivery Order

| Week | Component | Rationale |
|------|-----------|-----------|
| 1 | Component 1 — Audit Logging | Unblocks SOC 2 evidence (CC7.1 requires audit logs) |
| 2 | Component 2 — Evidence Collection | SOC 2 + HIPAA scheduling; FedRAMP after |
| 3 | Component 3 — Export & Reporting | Audit-ready output replaces the stub |
| 4 | Component 4 — Control Testing | Activates live drift detection in portal |
| 5 | Component 5 — Vendor Risk & BAA | SOC 2 CC9.2; HIPAA BAA requirement |

---

## Out of Scope for Phase 6

- **GRC platform integration** (Drata, Vanta, Tugboat Logic) — future Phase 7
- **Penetration test automation** — manual engagement, not automated
- **FedRAMP ATO package** — not scoped until an agency sponsor is identified
- **SOC 2 Type II period** — collection begins now; Type II requires 6-month observation
  period before the actual audit report can be issued

---

**Last Updated:** 2026-04-23  
**Author:** Cedrick Byrd
