# Compliance Automation Playbook

## Scope
This playbook defines the Phase 6 Track 1 workflow for SOC 2, HIPAA, and FedRAMP evidence collection, controls monitoring, reporting, and audit integrity checks.

## Pipeline
1. **Evidence Collection** (`src/lambdas/compliance/evidence_collector.py`)
   - Scheduled by EventBridge (daily/weekly) and triggerable on-demand.
   - Stores evidence records with schema: `control_id`, `timestamp`, `source`, `status`, `raw_payload`.
2. **Controls Monitoring** (`src/lambdas/compliance/controls_monitor.py`)
   - Compares live control states to baselines and flags drift.
   - Persists drift snapshots and pushes SNS alerts.
3. **Customer Reports** (`src/lambdas/compliance/report_generator.py`)
   - Generates PDF/CSV artifacts and returns 24-hour pre-signed URLs.
4. **Audit Integrity Validation** (`src/lambdas/compliance/audit_log_validator.py`)
   - Verifies SHA-256 integrity for audit payloads.

## API Endpoints
- `POST /compliance/reports/generate`
- `GET /audit/logs?tenant_id=&start=&end=&event_type=`

## Infrastructure
Terraform module: `terraform/modules/compliance/`
- Immutable evidence bucket (versioning + Object Lock COMPLIANCE mode)
- Controls state history table
- SNS alert topic + SQS on-demand queue

## Operational Checklist
- [ ] EventBridge schedules enabled for evidence and controls jobs
- [ ] On-demand collection queue connected
- [ ] Alert routing configured for incident response
- [ ] Report bucket lifecycle and permissions reviewed
- [ ] Audit integrity checks monitored with alarms
