# IaC Pipeline Runbook

## PR Plan Pipeline (`terraform-plan.yml`)
1. Open/update PR against `main`.
2. Confirm plan comments are posted for `dev`, `staging`, and `prod`.
3. Download artifact for full output when comment is truncated.

## Apply Pipeline (`terraform-apply.yml`)
1. Merge approved PR into `main`.
2. Verify auto-apply completes in all three workspaces.
3. Check Slack `#infra-deployments` notification.

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
