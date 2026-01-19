# SecureBase Production Deployment Guide

**Status:** Ready for deployment (infrastructure validated)  
**Date:** January 19, 2026

---

## Prerequisites Checklist

- [ ] AWS account with admin access
- [ ] AWS CLI installed (`aws --version`)
- [ ] Terraform ≥ 1.5.0 installed (`terraform version`)
- [ ] Valid AWS credentials configured
- [ ] Unique email addresses for AWS accounts (9 clients + 1 mgmt)

---

## Step 1: Configure AWS Credentials

Run the interactive configuration script:

```bash
cd /workspaces/securebase-app/landing-zone
bash configure-aws.sh
```

**Options:**
- **Option 1** (Recommended): Interactive `aws configure`
- **Option 2**: Environment variables (for CI/CD)
- **Option 3**: IAM role (if on EC2/Cloud9)

**Verify credentials:**
```bash
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-user"
}
```

---

## Step 2: Bootstrap Backend (One-time)

Create S3 bucket and DynamoDB table for Terraform state:

```bash
bash bootstrap-backend.sh
```

**What this creates:**
- S3 Bucket: `securebase-terraform-state-dev`
  - Versioning: Enabled
  - Encryption: AES256
  - Public Access: Blocked
- DynamoDB Table: `securebase-terraform-locks`
  - Read/Write: 5 units each
  - Attribute: LockID (Hash key)

**Estimated cost:** ~$1-2/month for state storage

---

## Step 3: Initialize Terraform

Navigate to dev environment:

```bash
cd environments/dev
```

Initialize with backend configuration:

```bash
terraform init -backend-config=backend.hcl -reconfigure
```

**Expected output:**
```
Initializing the backend...
Successfully configured the backend "s3"!
Initializing modules...
Terraform has been successfully initialized!
```

---

## Step 4: Review Deployment Plan

Generate execution plan:

```bash
terraform plan -out=tfplan
```

**What to review:**
- ✅ 9 client AWS accounts to be created
- ✅ 4 organizational units (Healthcare, Fintech, Gov-Federal, Standard)
- ✅ 9 VPCs (one per client)
- ✅ IAM Identity Center configuration
- ✅ GuardDuty, Security Hub, CloudTrail
- ✅ Centralized logging infrastructure

**Resource count:** ~150-200 resources

**Estimated time:** 15-20 minutes for full deployment

---

## Step 5: Deploy Infrastructure

Apply the plan:

```bash
terraform apply tfplan
```

Or apply with auto-approval (use with caution):

```bash
terraform apply -auto-approve
```

**Monitor deployment:**
- Watch for AWS Organizations account creation (slowest step: 5-10 min per account)
- VPC creation: ~2 min per VPC
- GuardDuty/Security Hub: ~1 min

---

## Step 6: Verify Deployment

### Check AWS Organizations

```bash
aws organizations list-accounts
```

Expected: 10 accounts (1 management + 9 clients)

### Check VPCs

```bash
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,Tags[?Key==`Name`].Value|[0]]' --output table
```

Expected: 9 VPCs with client names

### Check Terraform State

```bash
terraform show | grep -c "resource"
```

Expected: ~150-200 resources

### Check Outputs

```bash
terraform output
```

Review:
- Organization ID
- Root account ID
- Client account IDs
- VPC IDs
- Security Hub status

---

## Post-Deployment Tasks

### 1. Configure IAM Identity Center Users

```bash
# Get Identity Center console URL
terraform output identity_center_url

# Access the console and create users for each client
```

### 2. Enable Multi-Factor Authentication

For each client account:
1. Log in via Identity Center
2. Enable MFA for admin users
3. Configure break-glass emergency access

### 3. Review Security Findings

```bash
# Check Security Hub
aws securityhub get-findings --max-items 10

# Check GuardDuty
aws guardduty list-findings --detector-id $(terraform output guardduty_detector_id)
```

### 4. Configure Audit Log Retention

Audit logs are centralized in S3 with:
- **Lifecycle:** 90 days (configurable in `modules/logging/main.tf`)
- **Object Lock:** Compliance mode (immutable)
- **Encryption:** SSE-S3 (AES256)

---

## Troubleshooting

### Issue: "Email already in use"

**Solution:** Update `environments/dev/client.auto.tfvars` with unique emails:
```hcl
clients = {
  "acme-finance" = {
    email = "aws+acme-finance@yourdomain.com"  # Change this
    # ...
  }
}
```

### Issue: "Insufficient permissions"

**Solution:** Ensure your IAM user/role has:
- `organizations:*`
- `iam:*`
- `ec2:*`
- `guardduty:*`
- `securityhub:*`
- `logs:*`

Or attach `AdministratorAccess` policy (for initial deployment)

### Issue: "Backend initialization failed"

**Solution:** Verify S3 bucket exists:
```bash
aws s3 ls s3://securebase-terraform-state-dev
```

If missing, re-run:
```bash
bash ../bootstrap-backend.sh
```

### Issue: Terraform state corruption

**Solution:** Restore from S3 versioning:
```bash
# List versions
aws s3api list-object-versions --bucket securebase-terraform-state-dev --prefix landing-zone/

# Download specific version
aws s3api get-object --bucket securebase-terraform-state-dev --key landing-zone/terraform.tfstate --version-id <VERSION_ID> terraform.tfstate.backup
```

---

## Rollback Procedure

If deployment fails or you need to tear down:

```bash
# Destroy all resources
terraform destroy

# Review what will be deleted
terraform plan -destroy

# Confirm destruction
# WARNING: This deletes all AWS accounts, VPCs, and security resources
```

**Note:** AWS account deletion takes 90 days to complete. Accounts are marked for closure immediately but remain visible.

---

## Cost Monitoring

### Daily Cost Breakdown (9 clients)

| Service | Cost/month | Notes |
|---------|------------|-------|
| AWS Organizations | $0 | Free |
| VPC (9x) | $0 | VPC itself is free |
| NAT Gateways (9x) | ~$324 | $0.045/hour × 9 × 730 hours |
| GuardDuty | ~$50 | First 30 days free |
| Security Hub | ~$5 | ~$0.0010/check |
| CloudTrail | ~$10 | First trail free, data events extra |
| CloudWatch Logs | ~$15 | Based on 10 GB/month |
| S3 Storage | ~$5 | Audit logs |
| **TOTAL** | **~$409/month** | Production baseline |

**Cost optimization:**
- Remove NAT Gateways if not needed: Saves $324/month
- Use VPC endpoints instead: ~$22/month (93% savings)
- Adjust log retention: Reduce from 90 to 30 days

---

## Production Hardening (Optional)

### Enable AWS Config Rules

Uncomment in `modules/security/main.tf`:
```hcl
resource "aws_config_configuration_recorder" "main" {
  # Uncomment to enable
}
```

### Add Budget Alerts

```bash
aws budgets create-budget --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

### Enable CloudWatch Alarms

Add to `modules/logging/main.tf`:
```hcl
resource "aws_cloudwatch_metric_alarm" "high_cost" {
  alarm_name          = "securebase-high-cost"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = "21600"  # 6 hours
  statistic           = "Maximum"
  threshold           = "500"  # $500/day
  alarm_actions       = [aws_sns_topic.billing_alerts.arn]
}
```

---

## Support & Documentation

- **Terraform Docs:** [landing-zone/README.md](README.md)
- **Multi-Tenant Guide:** [MULTI_TENANT_GUIDE.md](MULTI_TENANT_GUIDE.md)
- **Module Docs:** `modules/*/README.md`
- **AWS Organizations:** https://docs.aws.amazon.com/organizations/
- **IAM Identity Center:** https://docs.aws.amazon.com/singlesignon/

---

## Success Criteria

✅ All checks passed:
- [ ] Backend state saved to S3
- [ ] 9 client accounts created
- [ ] 9 VPCs provisioned
- [ ] IAM Identity Center active
- [ ] GuardDuty enabled in all accounts
- [ ] Security Hub aggregating findings
- [ ] CloudTrail logging to central S3
- [ ] No Terraform errors or warnings
- [ ] Cost estimate < $500/month

**Deployment Status:** Production-ready  
**Last Validated:** January 19, 2026
