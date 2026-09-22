# Customer Compliance Configurations

Each subdirectory here represents a SecureBase customer and contains their
compliance automation config.

## Structure

```
customers/
├── README.md                          ← this file
└── <customer_id>/
    └── customer.json                  ← customer config (frameworks, vault, branding)
```

## Onboarding a new customer

1. Create a new directory: `customers/<customer_id>/`
2. Copy `customers/management_account/customer.json` as a starting point
3. Update:
   - `customer_id` (must match the directory name)
   - `display_name`, `legal_entity`
   - `compliance.frameworks` (any subset of: soc2, sox, hipaa, fedramp)
   - `vault.s3_bucket` + `vault.s3_prefix` (namespace in S3)
   - `contacts.*`
4. Copy `.github/workflows/compliance-report-management-account.yml`,
   rename it for the new customer, and update the `CUSTOMER_ID` env var
5. Commit — the scheduled workflow will pick up the new customer on next cron tick

## Running a report on-demand

From the repo root:

```bash
python scripts/generate_customer_report.py --customer <customer_id>

# Skip the S3 vault step (useful for local dev without AWS creds)
python scripts/generate_customer_report.py --customer <customer_id> --skip-vault
```

Or trigger the workflow manually via GitHub Actions → `Compliance Report — <customer>` → Run workflow.

## How data flows

```
┌──────────────────────┐     ┌───────────────────────────┐     ┌──────────────────┐
│ customer.json        │────▶│ generate_customer_report  │────▶│ reports/<id>/    │
│ (frameworks, vault)  │     │ (wraps collector)         │     │ evidence_<RUNID>/│
└──────────────────────┘     └───────────────────────────┘     └─────────┬────────┘
                                                                         │
                                                                         ▼
                                                                ┌──────────────────┐
                                                                │ SecureBaseVault  │
                                                                │ s3://.../<id>/   │
                                                                │ + KMS signature  │
                                                                └──────────────────┘
```

## AWS prerequisites (for vault upload)

- S3 bucket named per `vault.s3_bucket` with Object Lock enabled
- KMS key with alias matching `vault.kms_key_alias`
- IAM role with `s3:PutObject` + `kms:Sign` permissions
- GitHub OIDC trust policy on the IAM role, referencing this repo
- Repo secret `AWS_COMPLIANCE_ROLE_ARN` set to the role ARN

Until those are configured, the workflow will still produce reports and
upload them as GitHub Actions artifacts — the S3 vault step simply no-ops.
