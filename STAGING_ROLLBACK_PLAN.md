# Phase 4 Staging - Rollback Plan

**Date:** January 26, 2026  
**Environment:** Staging  
**Risk Level:** Low (isolated environment, can be fully destroyed)

---

## 🎯 Rollback Scenarios

### Scenario 1: Complete Failure - Full Rollback
**When:** Critical issues preventing any functionality  
**Impact:** All staging analytics resources removed  
**Duration:** 5-10 minutes

### Scenario 2: Partial Failure - Component Rollback
**When:** Specific component issues (e.g., Lambda errors)  
**Impact:** Single component removed/redeployed  
**Duration:** 2-5 minutes

### Scenario 3: Data Corruption - Data Rollback
**When:** DynamoDB or S3 data issues  
**Impact:** Data tables cleared/restored  
**Duration:** 1-2 minutes

---

## 🚨 Emergency Rollback (Full Destroy)

### Prerequisites
- Terraform state accessible
- AWS credentials active
- No production dependencies

### Execution Steps

#### Step 1: Empty S3 Bucket (REQUIRED)
```bash
cd /home/runner/work/securebase-app/securebase-app
cd landing-zone/environments/staging

# Get bucket name
BUCKET=$(terraform output -raw analytics_s3_bucket 2>/dev/null)

if [ ! -z "$BUCKET" ]; then
  echo "Emptying S3 bucket: $BUCKET"
  aws s3 rm s3://$BUCKET --recursive
  echo "S3 bucket emptied"
else
  echo "S3 bucket not found in Terraform state"
fi
```

**Why Required:** S3 buckets with objects cannot be deleted by Terraform

#### Step 2: Destroy All Resources
```bash
cd landing-zone/environments/staging

# Destroy with auto-approval (use cautiously)
terraform destroy -auto-approve

# OR destroy with confirmation
terraform destroy
```

**Expected Output:**
```
Destroy complete! Resources: 15 destroyed.
```

#### Step 3: Verify Cleanup
```bash
# Check no DynamoDB tables remain
aws dynamodb list-tables --query "TableNames[?contains(@, 'staging')]"
# Expected: []

# Check no Lambda functions remain
aws lambda list-functions --query "Functions[?contains(FunctionName, 'staging')]"
# Expected: []

# Check no S3 buckets remain
aws s3 ls | grep staging-reports
# Expected: (empty)

# Check Terraform state
terraform state list
# Expected: (empty)
```

#### Step 4: Clean Lambda Layer (Optional)
```bash
# List layer versions
aws lambda list-layer-versions \
  --layer-name securebase-staging-reporting \
  --query 'LayerVersions[*].Version'

# Delete specific version
aws lambda delete-layer-version \
  --layer-name securebase-staging-reporting \
  --version-number 1
```

**Note:** Layer versions are immutable and harmless to leave

---

## 🔧 Selective Rollback

### Rollback Lambda Function Only

```bash
cd landing-zone/environments/staging

# Remove Lambda from state
terraform state rm module.securebase.module.analytics.aws_lambda_function.report_engine

# Or manually delete
aws lambda delete-function \
  --function-name securebase-staging-report-engine
```

### Rollback DynamoDB Tables Only

```bash
# Remove all DynamoDB tables from state
terraform state rm module.securebase.module.analytics.aws_dynamodb_table.reports
terraform state rm module.securebase.module.analytics.aws_dynamodb_table.report_schedules
terraform state rm module.securebase.module.analytics.aws_dynamodb_table.report_cache
terraform state rm module.securebase.module.analytics.aws_dynamodb_table.metrics

# Or manually delete
for table in reports report-schedules report-cache metrics; do
  aws dynamodb delete-table \
    --table-name "securebase-staging-${table}"
done
```

### Rollback S3 Bucket Only

```bash
# Empty and delete bucket
BUCKET="securebase-staging-reports-$(aws sts get-caller-identity --query Account --output text)"
aws s3 rm s3://$BUCKET --recursive
aws s3 rb s3://$BUCKET
```

---

## 📊 Data Rollback

### Clear DynamoDB Tables (Keep Structure)

```bash
# Scan and delete all items from reports table
aws dynamodb scan \
  --table-name securebase-staging-reports \
  --attributes-to-get "customer_id" "id" \
  --query 'Items[*].[customer_id.S, id.S]' \
  --output text | \
while read customer_id id; do
  aws dynamodb delete-item \
    --table-name securebase-staging-reports \
    --key "{\"customer_id\":{\"S\":\"$customer_id\"},\"id\":{\"S\":\"$id\"}}"
done
```

### Clear S3 Bucket (Keep Bucket)

```bash
BUCKET=$(cd landing-zone/environments/staging && terraform output -raw analytics_s3_bucket)
aws s3 rm s3://$BUCKET --recursive
```

---

## 🔄 Redeploy After Rollback

### Option 1: Full Redeploy
```bash
cd /home/runner/work/securebase-app/securebase-app
./deploy-phase4-staging.sh
```

### Option 2: Terraform Re-Apply
```bash
cd landing-zone/environments/staging
terraform init -backend-config=backend.hcl
terraform plan -out=staging.tfplan
terraform apply staging.tfplan
```

### Option 3: Manual Component Redeploy

**DynamoDB Tables:**
```bash
terraform import module.securebase.module.analytics.aws_dynamodb_table.reports \
  securebase-staging-reports
```

**Lambda Function:**
```bash
terraform import module.securebase.module.analytics.aws_lambda_function.report_engine \
  securebase-staging-report-engine
```

---

## 🛡️ State Backup & Recovery

### Backup Current State
```bash
cd landing-zone/environments/staging

# Save current state locally
terraform state pull > staging-state-backup-$(date +%Y%m%d-%H%M%S).json

# Upload to S3 (optional)
terraform state pull | \
  aws s3 cp - s3://securebase-backups/terraform/staging/state-$(date +%Y%m%d-%H%M%S).json
```

### Restore State from Backup
```bash
cd landing-zone/environments/staging

# Download backup
aws s3 cp s3://securebase-backups/terraform/staging/state-20260126-120000.json \
  terraform.tfstate.backup

# Push restored state
terraform state push terraform.tfstate.backup
```

### Recover from Remote Backend
```bash
cd landing-zone/environments/staging

# Backend should have automatic versioning
aws s3 ls s3://securebase-terraform-state-staging/landing-zone/ --recursive

# Download specific version
aws s3 cp s3://securebase-terraform-state-staging/landing-zone/terraform.tfstate?versionId=VERSION_ID \
  terraform.tfstate.restore
```

---

## ⚠️ Rollback Validation

### Post-Rollback Checks

```bash
#!/bin/bash
echo "=== Rollback Validation ==="

# 1. No staging resources remain
echo -n "DynamoDB: "
TABLES=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'staging')]" --output text)
[ -z "$TABLES" ] && echo "✓ Clean" || echo "✗ Tables remain: $TABLES"

echo -n "Lambda: "
FUNCTIONS=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'staging')].FunctionName" --output text)
[ -z "$FUNCTIONS" ] && echo "✓ Clean" || echo "✗ Functions remain: $FUNCTIONS"

echo -n "S3: "
BUCKETS=$(aws s3 ls | grep staging-reports | wc -l)
[ "$BUCKETS" -eq 0 ] && echo "✓ Clean" || echo "✗ Buckets remain: $BUCKETS"

# 2. Terraform state clean
echo -n "Terraform State: "
cd landing-zone/environments/staging 2>/dev/null
RESOURCES=$(terraform state list 2>/dev/null | wc -l)
[ "$RESOURCES" -eq 0 ] && echo "✓ Empty" || echo "⚠ $RESOURCES resources in state"

echo "=========================="
```

---

## 📝 Rollback Checklist

### Pre-Rollback
- [ ] Confirm environment is staging (not production!)
- [ ] Backup Terraform state
- [ ] Document reason for rollback
- [ ] Notify team of rollback

### During Rollback
- [ ] Empty S3 buckets
- [ ] Run terraform destroy
- [ ] Verify all resources deleted
- [ ] Clean Lambda layers (optional)
- [ ] Document any errors

### Post-Rollback
- [ ] Validate no resources remain
- [ ] Check for orphaned resources
- [ ] Review CloudWatch logs (if issues)
- [ ] Update team on status
- [ ] Plan corrective actions
- [ ] Document lessons learned

---

## 🚫 What NOT to Do

1. **Don't destroy production by mistake**
   ```bash
   # Always verify environment first!
   cd landing-zone/environments/staging  # Not /production!
   terraform workspace show  # Verify workspace
   grep environment terraform.tfvars  # Should say "staging"
   ```

2. **Don't delete S3 bucket with objects**
   ```bash
   # This will fail - empty first
   aws s3 rb s3://securebase-staging-reports-123456789012
   
   # Correct approach
   aws s3 rm s3://securebase-staging-reports-123456789012 --recursive
   aws s3 rb s3://securebase-staging-reports-123456789012
   ```

3. **Don't force-unlock without reason**
   ```bash
   # Only if lock is genuinely stuck (5+ minutes)
   terraform force-unlock <LOCK_ID>
   ```

4. **Don't delete remote state**
   ```bash
   # Never delete the state bucket or files manually
   # Use terraform state commands instead
   ```

---

## 📞 Escalation Path

If rollback fails:

1. **Check AWS Console** - Verify resource states visually
2. **Review CloudTrail** - Check for API errors
3. **Manual Cleanup** - Delete resources via console if needed
4. **Contact AWS Support** - For stuck resources (rare)

---

## 💡 Prevention Tips

- Always test in staging before production
- Use `terraform plan` before `apply`
- Keep Terraform state backed up
- Tag all resources with `Environment=staging`
- Enable CloudTrail for audit trail
- Document all changes

---

**Created:** January 26, 2026  
**Environment:** Staging Only  
**Status:** Ready for Use
