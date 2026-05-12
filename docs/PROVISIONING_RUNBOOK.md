# Provisioning Runbook (Fallback)

Use this only when automated tenant provisioning fails.

## Preconditions
1. Confirm failure in `securebase-provisioning` status record.
2. Confirm failing step and error details in CloudWatch logs.
3. Open incident ticket and capture `tenant_id`.

## Manual Recovery Steps
1. Run automated onboarding helper:
   ```bash
   /home/runner/work/securebase-app/securebase-app/scripts/onboard-customer.sh \
     --name "<Tenant Name>" \
     --tier "<standard|fintech|healthcare|gov-federal>" \
     --framework "<cis|soc2|hipaa|fedramp>" \
     --email "<admin-email>"
   ```
2. Verify Terraform applied for the tenant account.
3. Verify tenant record and API key hash in data stores.
4. Send welcome email from approved SES sender.
5. Update `securebase-provisioning` record to `completed` and attach incident reference.

## Idempotency Notes
- Re-running provisioning for an already completed tenant should return the existing result.
- Never rotate API keys silently; notify tenant if manual rotation is required.
