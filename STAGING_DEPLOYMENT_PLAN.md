# Phase 4 Analytics - Staging Deployment Execution Plan

**Date:** January 26, 2026  
**Environment:** Staging  
**Deployment Window:** 1-2 hours  
**Risk Level:** Low (isolated environment)

---

## Pre-Deployment Checklist

### Prerequisites Verification

- [ ] AWS CLI installed and configured
  ```bash
  aws --version  # Requires v2.0+
  aws sts get-caller-identity  # Verify credentials
  ```

- [ ] Terraform installed
  ```bash
  terraform --version  # Requires v1.0+
  ```

- [ ] Required AWS Permissions
  - Lambda (create functions, publish layers)
  - DynamoDB (create tables)
  - S3 (create buckets)
  - IAM (create roles, attach policies)
  - CloudWatch (create log groups)

- [ ] Environment Variables
  ```bash
  export AWS_REGION=us-east-1
  export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  ```

### Code Verification

- [ ] Lambda layer built
  ```bash
  ls -lh phase2-backend/layers/reporting/reporting-layer.zip
  # Expected: ~8.5 MB
  ```

- [ ] Lambda function packaged
  ```bash
  ls -lh phase2-backend/deploy/report_engine.zip
  # Expected: ~6 KB
  ```

- [ ] Staging configuration files exist
  ```bash
  ls -l landing-zone/environments/staging/*.tf
  ls -l landing-zone/environments/staging/terraform.tfvars
  ```

---

## Deployment Sequence

### Step 1: Pre-Deployment Validation (5 minutes)

```bash
# Navigate to repository root
cd /home/runner/work/securebase-app/securebase-app

# Verify files exist
./deploy-phase4-staging.sh --dry-run  # If supported

# Or manually check
ls -l deploy-phase4-staging.sh
ls -l test-phase4-staging.sh
ls -l landing-zone/environments/staging/
```

**Success Criteria:**
- ✅ All scripts executable
- ✅ Configuration files present
- ✅ Lambda packages exist

---

### Step 2: Lambda Layer Deployment (2-3 minutes)

```bash
# Manual deployment (if script fails)
cd phase2-backend/layers/reporting

aws lambda publish-layer-version \
  --layer-name securebase-staging-reporting \
  --description "ReportLab + openpyxl for Phase 4 Analytics Staging" \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1 \
  --query 'LayerVersionArn' \
  --output text
```

**Expected Output:**
```
arn:aws:lambda:us-east-1:123456789012:layer:securebase-staging-reporting:1
```

**Action:** Copy the Layer ARN for next step

**Rollback:** Layer versions cannot be deleted, but they can be ignored

---

### Step 3: Update Terraform Variables (1 minute)

```bash
cd landing-zone/environments/staging

# Add layer ARN to terraform.tfvars
cat >> terraform.tfvars <<EOF

# Phase 4: Analytics Lambda Layer
reporting_layer_arn = "arn:aws:lambda:us-east-1:ACCOUNT_ID:layer:securebase-staging-reporting:1"
EOF
```

**Verification:**
```bash
grep reporting_layer_arn terraform.tfvars
```

---

### Step 4: Terraform Initialization (2-3 minutes)

```bash
cd landing-zone/environments/staging

# Initialize Terraform
terraform init -backend-config=backend.hcl

# Verify initialization
ls -la .terraform/
```

**Expected Output:**
```
Terraform has been successfully initialized!
```

**Troubleshooting:**
- If backend not found: Create S3 bucket `securebase-terraform-state-staging`
- If lock table error: Create DynamoDB table `terraform-locks`

---

### Step 5: Terraform Validation (1 minute)

```bash
terraform validate
terraform fmt -check
```

**Expected Output:**
```
Success! The configuration is valid.
```

**If Validation Fails:**
- Check syntax errors in .tf files
- Verify variable types match
- Ensure all required variables provided

---

### Step 6: Terraform Plan (3-5 minutes)

```bash
terraform plan -out=staging-analytics.tfplan

# Review planned changes
terraform show staging-analytics.tfplan | less
```

**Expected Resources to Create:**
```
Plan: 15 to add, 0 to change, 0 to destroy.

Resources:
  + aws_dynamodb_table.reports
  + aws_dynamodb_table.report_schedules
  + aws_dynamodb_table.report_cache
  + aws_dynamodb_table.metrics
  + aws_s3_bucket.reports
  + aws_s3_bucket_lifecycle_configuration.reports
  + aws_lambda_function.report_engine
  + aws_iam_role.report_engine
  + aws_iam_role_policy.report_engine_permissions
  + aws_iam_role_policy_attachment.report_engine_basic
  + aws_cloudwatch_log_group.report_engine
  + ... (API Gateway routes, etc.)
```

**Red Flags:**
- ⚠️ Any resources being destroyed
- ⚠️ More than 20 resources being created (check for duplicates)
- ⚠️ Plan includes production resources

---

### Step 7: Terraform Apply (5-10 minutes)

```bash
# Apply the plan
terraform apply staging-analytics.tfplan

# Or run automated script
cd /home/runner/work/securebase-app/securebase-app
./deploy-phase4-staging.sh
```

**Monitoring:**
Watch for errors in:
- DynamoDB table creation
- Lambda function deployment
- S3 bucket creation
- IAM role creation

**Expected Duration:**
- DynamoDB tables: 30-60 seconds
- Lambda function: 10-20 seconds
- S3 bucket: 5-10 seconds
- IAM roles: 10-20 seconds

**Success Indicators:**
```
Apply complete! Resources: 15 added, 0 changed, 0 destroyed.

Outputs:
api_gateway_endpoint = "https://abc123.execute-api.us-east-1.amazonaws.com/staging"
analytics_report_engine_arn = "arn:aws:lambda:us-east-1:123456789012:function:securebase-staging-report-engine"
analytics_s3_bucket = "securebase-staging-reports-123456789012"
```

---

### Step 8: Post-Deployment Verification (10-15 minutes)

```bash
# Run automated tests
cd /home/runner/work/securebase-app/securebase-app
./test-phase4-staging.sh
```

**Manual Verification:**

1. **DynamoDB Tables:**
   ```bash
   aws dynamodb list-tables --query "TableNames[?contains(@, 'staging')]"
   ```
   Expected: 4 tables

2. **Lambda Function:**
   ```bash
   aws lambda get-function \
     --function-name securebase-staging-report-engine \
     --query 'Configuration.State'
   ```
   Expected: "Active"

3. **S3 Bucket:**
   ```bash
   aws s3 ls | grep staging-reports
   ```
   Expected: 1 bucket

4. **Lambda Invocation:**
   ```bash
   aws lambda invoke \
     --function-name securebase-staging-report-engine \
     --payload '{"action":"health_check"}' \
     response.json
   
   cat response.json
   ```
   Expected: 200 status code

5. **CloudWatch Logs:**
   ```bash
   aws logs tail /aws/lambda/securebase-staging-report-engine \
     --since 5m --follow
   ```
   Expected: No errors

---

### Step 9: Integration Testing (10-15 minutes)

#### Test 1: Basic Lambda Invocation
```bash
aws lambda invoke \
  --function-name securebase-staging-report-engine \
  --payload '{"action":"list_reports","customer_id":"test-staging"}' \
  /tmp/response.json

cat /tmp/response.json | jq
```

#### Test 2: DynamoDB Write
```bash
aws dynamodb put-item \
  --table-name securebase-staging-reports \
  --item '{
    "customer_id": {"S": "test-staging"},
    "id": {"S": "test-001"},
    "name": {"S": "Test Report"},
    "created_at": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
  }'
```

#### Test 3: S3 Upload
```bash
echo "Test report content" > /tmp/test-report.txt
aws s3 cp /tmp/test-report.txt \
  s3://securebase-staging-reports-${AWS_ACCOUNT_ID}/test/report.txt

# Verify
aws s3 ls s3://securebase-staging-reports-${AWS_ACCOUNT_ID}/test/
```

#### Test 4: Report Export (End-to-End)
```bash
# This would require a JWT token in real scenario
# For now, test Lambda directly with export payload

cat > /tmp/export-test.json <<'EOF'
{
  "action": "export_report",
  "format": "csv",
  "customer_id": "test-staging",
  "data": [
    {"service": "EC2", "cost": 100, "region": "us-east-1"},
    {"service": "S3", "cost": 50, "region": "us-east-1"}
  ]
}
EOF

aws lambda invoke \
  --function-name securebase-staging-report-engine \
  --payload file:///tmp/export-test.json \
  /tmp/export-response.json

cat /tmp/export-response.json
```

---

### Step 10: Cost Verification (5 minutes)

```bash
# Check current costs (may take 24 hours to appear)
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '1 day ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter file://cost-filter.json

# cost-filter.json
cat > cost-filter.json <<'EOF'
{
  "Tags": {
    "Key": "Environment",
    "Values": ["staging"]
  }
}
EOF
```

**Expected Daily Cost:** ~$0.02/day = ~$0.60/month

---

## Success Criteria

- ✅ All Terraform resources created without errors
- ✅ Lambda function status: Active
- ✅ Lambda layer attached (version 1)
- ✅ 4 DynamoDB tables created and accessible
- ✅ S3 bucket created with write permissions
- ✅ CloudWatch logs capturing Lambda output
- ✅ Lambda invocation returns 200 status
- ✅ DynamoDB read/write operations successful
- ✅ S3 upload/download operations successful
- ✅ Integration tests passing (>90%)
- ✅ No security vulnerabilities detected
- ✅ Cost projections under $50/month

---

## Rollback Procedures

### Immediate Rollback (If Critical Issues)

```bash
cd landing-zone/environments/staging
terraform destroy -auto-approve
```

**Cleanup Steps:**
1. Empty S3 bucket before destroy
   ```bash
   BUCKET=$(terraform output -raw analytics_s3_bucket)
   aws s3 rm s3://$BUCKET --recursive
   ```

2. Delete Lambda layer versions (optional)
   ```bash
   aws lambda delete-layer-version \
     --layer-name securebase-staging-reporting \
     --version-number 1
   ```

3. Verify cleanup
   ```bash
   aws dynamodb list-tables | grep staging
   aws lambda list-functions | grep staging
   aws s3 ls | grep staging
   ```

### Selective Rollback (Specific Component)

```bash
# Remove only analytics module
terraform state rm module.securebase.module.analytics
terraform apply
```

---

## Monitoring & Alerts

### CloudWatch Dashboard

Create custom dashboard:
```bash
aws cloudwatch put-dashboard \
  --dashboard-name securebase-staging-analytics \
  --dashboard-body file://dashboard.json
```

### Key Metrics to Monitor

1. **Lambda Invocations** - Should be > 0 after testing
2. **Lambda Errors** - Should be 0
3. **Lambda Duration** - Should be < 5000ms
4. **DynamoDB Consumed Capacity** - Should be minimal
5. **S3 Bucket Size** - Should grow with report exports

### Alarm Recommendations

- Lambda Error Rate > 5%
- Lambda Duration > 25 seconds (near timeout)
- Daily Cost > $2 (60x expected)

---

## Post-Deployment Tasks

- [ ] Update project documentation
- [ ] Notify team of staging endpoint
- [ ] Schedule weekly cost review
- [ ] Plan production deployment (Feb 2, 2026)
- [ ] Document any issues encountered
- [ ] Update frontend with staging API endpoint

---

## Contacts & Escalation

**Deployment Lead:** Infrastructure Team  
**AWS Account:** Staging (non-production)  
**Escalation Path:**
1. Check CloudWatch logs
2. Review Terraform state
3. Consult STAGING_DEPLOYMENT_GUIDE.md
4. Contact AWS Support (if infrastructure issue)

---

**Deployment Date:** January 26, 2026  
**Approval:** Pending AWS access  
**Status:** Configuration Ready - Awaiting AWS Deployment
