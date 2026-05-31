# IaC Pipeline Runbook

## PR Plan Pipeline (`terraform-plan.yml`)
1. Open/update PR against `main`.
2. Confirm plan comments are posted for `dev`, `staging`, and `prod`.
3. Download artifact for full output when comment is truncated.

## Apply Pipeline (`terraform-apply.yml`)
1. Merge approved PR into `main`.
2. Verify auto-apply completes in all three workspaces.
3. Check Slack `#infra-deployments` notification.

## Phase 6 DB Migrations (`phase6-db-migrations.yml`)
1. Trigger manually for `staging` and `prod` from Actions.
2. Run order: `dev` → `staging` → `prod`.
3. For `prod`, set `confirmed=MIGRATE` and wait for GitHub Environment `production` approval.
4. Verify logs include:
   - `[apply] 001_audit_evidence_tables`
   - `[apply] 002_compliance_score_history`
5. Confirm required tables exist after prod run: `schema_migrations`, `evidence_packages`, `macie_findings`, `compliance_score_daily`, `control_violation_log`.

## SecureBase Production Apply (`terraform-securebase-apply.yml`)
1. Trigger manually from Actions.
2. Set `confirmed=DEPLOY` (not `type`).
3. Wait for GitHub Environment `production` approval and staging smoke test pass before `Terraform Apply`.

## Promotion Pipeline (`promote.yml`)
1. Trigger manually with `source_env` and `target_env`.
2. Promotion from `staging` to `prod` uses GitHub Environment `production` for human approval.
3. Confirm smoke test output after apply.

## Failed Apply Handling
1. Stop further promotions.
2. Inspect failing workspace logs and Terraform error.
3. Fix in PR and rerun plan/apply.

## Drift Alert Handling
1. Review drift issue and severity classification:
   - `P1`: any destroy > 0
   - `P2`: change > 5
   - `P3`: add-only or minor changes
2. Confirm whether drift is expected or unauthorized.
3. Create remediation PR and run plan/apply.

## Rollback
Use `promote.yml` and provide `rollback_to_version_id` to restore a prior S3 state object version in one dispatch.
