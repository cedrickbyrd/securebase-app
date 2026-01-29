# Phase 4 Analytics - Staging Deployment: Execution Guide

**Purpose:** Step-by-step deployment execution when AWS credentials are available  
**Audience:** DevOps engineers, deployment operators  
**Duration:** 15-20 minutes (including validation)

---

## Pre-Execution Checklist

Before starting the deployment, verify:

```bash
# 1. AWS credentials configured
aws sts get-caller-identity
# Expected: Account ID, User ARN

# 2. Terraform installed
terraform --version
# Expected: Terraform v1.5.0 or higher

# 3. In correct directory
pwd
# Expected: /home/runner/work/securebase-app/securebase-app

# 4. Deployment script exists
ls -lh deploy-phase4-staging.sh
# Expected: -rwxrwxr-x ... 7953 ... deploy-phase4-staging.sh

# 5. Test script exists
ls -lh test-phase4-staging.sh
# Expected: -rwxrwxr-x ... 9400 ... test-phase4-staging.sh
```

**All checks must pass before proceeding.**

---

## Deployment Execution

### Step 1: Start Deployment

```bash
cd /home/runner/work/securebase-app/securebase-app
./deploy-phase4-staging.sh
```

**Expected Output:**
```
🚀 Deploying Phase 4 Analytics to STAGING Environment
=======================================================

Environment: staging
Region: us-east-1
Workspace: /home/runner/work/securebase-app/securebase-app

Pre-flight Checks...
✓ AWS CLI installed
✓ Terraform installed
✓ AWS credentials configured
AWS Account: 123456789012
```

**If any checks fail:** Stop and resolve the issue before continuing.

---

### Step 2: Lambda Layer Verification

**Script Action:** Verifies or builds Lambda layer

**Expected Output:**
```
Step 1: Verifying Lambda Layer...
✓ Lambda layer ready (8.3M)
```

**Possible Issues:**
- **Layer missing:** Script will build it automatically
- **Build fails:** Check Python 3.11 is installed

---

### Step 3: Lambda Layer Publishing

**Script Action:** Uploads layer to AWS Lambda service

**Expected Output:**
```
Step 2: Publishing Lambda Layer to AWS Staging...
✓ Lambda layer published
  ARN: arn:aws:lambda:us-east-1:123456789012:layer:securebase-staging-reporting:1
```

**Duration:** 1-2 minutes (8.3MB upload)

**Possible Issues:**
- **Too large error:** Script will use S3 upload automatically
- **Permission denied:** Verify IAM permissions for Lambda layer creation

---

### Step 4: Lambda Function Packaging

**Script Action:** Packages report_engine.py into ZIP

**Expected Output:**
```
Step 3: Verifying Lambda Function Package...
✓ Lambda package ready (6.6K)
```

**Possible Issues:**
- **File not found:** Check phase2-backend/functions/report_engine.py exists

---

### Step 5: Terraform Configuration Update

**Script Action:** Updates terraform.tfvars with layer ARN

**Expected Output:**
```
Step 4: Updating Terraform Variables...
✓ Terraform variables updated
```

**What happens:** Layer ARN is written to `reporting_layer_arn` variable

---

### Step 6: Terraform Initialization

**Script Action:** Initializes Terraform backend and providers

**Expected Output:**
```
Step 5: Initializing Terraform...

Initializing the backend...
Initializing provider plugins...
Terraform has been successfully initialized!

✓ Terraform initialized
```

**Duration:** 30-60 seconds

**Possible Issues:**
- **Backend not found:** Script will show instructions to create S3 bucket
- **Provider download fails:** Check internet connectivity

---

### Step 7: Terraform Validation

**Script Action:** Validates Terraform configuration syntax

**Expected Output:**
```
Step 6: Validating Terraform Configuration...
Success! The configuration is valid.

✓ Terraform configuration valid
```

**Possible Issues:**
- **Syntax errors:** Review error messages, fix issues in Terraform files

---

### Step 8: Terraform Plan

**Script Action:** Generates execution plan showing resources to create

**Expected Output:**
```
Step 7: Running Terraform Plan...

Terraform used the selected providers to generate the following execution plan.
Resource actions are indicated with the following symbols:
  + create

Terraform will perform the following actions:

  # module.securebase.module.analytics.aws_dynamodb_table.reports will be created
  + resource "aws_dynamodb_table" "reports" {
      ...
  }

  # ... more resources ...

Plan: 15 to add, 0 to change, 0 to destroy.

Terraform plan created: staging-analytics.tfplan
```

**Duration:** 1-2 minutes

**Review:** Check that resources match expectations (4 tables, 1 function, etc.)

---

### Step 9: Deployment Confirmation

**Script Action:** Prompts for user confirmation

**Expected Output:**
```
Step 8: Ready to Deploy Infrastructure
This will create the following resources in AWS:
  • 4 DynamoDB Tables (reports, schedules, cache, metrics)
  • 1 S3 Bucket (report exports)
  • 1 Lambda Function (report-engine)
  • CloudWatch Log Group
  • IAM Roles and Policies

Apply Terraform changes? (yes/no):
```

**Action Required:** Type `yes` and press Enter

**Warning:** Typing anything other than `yes` will cancel deployment

---

### Step 10: Terraform Apply

**Script Action:** Creates AWS resources

**Expected Output:**
```
module.securebase.module.analytics.aws_dynamodb_table.reports: Creating...
module.securebase.module.analytics.aws_dynamodb_table.schedules: Creating...
module.securebase.module.analytics.aws_dynamodb_table.cache: Creating...
module.securebase.module.analytics.aws_dynamodb_table.metrics: Creating...
module.securebase.module.analytics.aws_s3_bucket.reports: Creating...
module.securebase.module.analytics.aws_iam_role.lambda: Creating...
...
module.securebase.module.analytics.aws_lambda_function.report_engine: Creating...
...

Apply complete! Resources: 15 added, 0 changed, 0 destroyed.

✓ Terraform applied successfully
```

**Duration:** 3-5 minutes

**Possible Issues:**
- **Table already exists:** See troubleshooting section below
- **Insufficient permissions:** Verify IAM permissions

---

### Step 11: Deployment Verification

**Script Action:** Retrieves deployment information and verifies resources

**Expected Output:**
```
Step 9: Retrieving Deployment Information...
✓ Deployment outputs retrieved

Step 10: Verifying Deployment...
Checking DynamoDB tables...
  Found 4 tables: securebase-staging-reports securebase-staging-report-schedules ...

Checking Lambda function...
  Status: Active

Checking S3 bucket...
  Bucket: securebase-staging-reports-123456789012

✓✓✓ Deployment Complete! ✓✓✓
```

---

### Step 12: Review Deployment Summary

**Script Output:**
```
================================================================
📊 Phase 4 Analytics - Staging Environment Deployed
================================================================

🌐 API Endpoints:
  Base URL: https://abcd1234.execute-api.us-east-1.amazonaws.com/staging
  GET  /analytics
  POST /analytics
  GET  /analytics/reports
  POST /analytics/reports

📦 DynamoDB Tables:
  - securebase-staging-reports
  - securebase-staging-report-schedules
  - securebase-staging-report-cache
  - securebase-staging-metrics

🪣 S3 Bucket:
  - securebase-staging-reports-123456789012

🔧 Lambda Function:
  - securebase-staging-report-engine
  ARN: arn:aws:lambda:us-east-1:123456789012:function:securebase-staging-report-engine

📚 Next Steps:
  1. Run integration tests: ./test-phase4-staging.sh
  2. Test API endpoints (see PHASE4_TESTING_GUIDE.md)
  3. Update frontend: phase3a-portal/.env.staging
  4. Review CloudWatch logs

💰 Cost Tracking:
  - Target: <$50/month for staging
  - Monitor: AWS Cost Explorer (tag: Environment=staging)

🔄 Rollback Plan:
  If issues found: cd landing-zone/environments/staging && terraform destroy
```

**Action Required:** Copy the API endpoint URL for testing

---

## Post-Deployment Validation

### Immediate Validation (Automated)

```bash
./test-phase4-staging.sh
```

**Expected Output:**
```
🧪 Testing Phase 4 Analytics - Staging Environment
===================================================

Environment: staging
Region: us-east-1

=== Infrastructure Tests ===

Test 1: DynamoDB Tables
  ✓ securebase-staging-reports exists
  ✓ securebase-staging-report-schedules exists
  ✓ securebase-staging-report-cache exists
  ✓ securebase-staging-metrics exists

Test 2: Lambda Function Deployment
  ✓ Lambda function is Active
  Memory: 512MB (expected: 512MB)
  Timeout: 30s (expected: 30s)

Test 3: Lambda Layer Attachment
  ✓ Lambda layer attached
  Layer: arn:aws:lambda:us-east-1:123456789012:layer:securebase-staging-reporting:1

Test 4: S3 Bucket for Reports
  ✓ S3 bucket exists: securebase-staging-reports-123456789012
  ✓ S3 write permissions OK

Test 5: CloudWatch Log Group
  ✓ CloudWatch log group exists

Test 6: Lambda Function Invocation
  ✓ Lambda invocation successful (Status: 200)

Test 7: DynamoDB Access (Read/Write)
  ✓ DynamoDB write successful
  ✓ DynamoDB read successful

Test 8: Lambda IAM Role Permissions
  ✓ IAM role exists

================================================================
📊 Test Summary
================================================================

Passed: 15 / 15
Failed: 0 / 15

✓✓✓ All tests passed! ✓✓✓

🎉 Phase 4 Analytics is successfully deployed to staging!
```

**If all tests pass:** Proceed to manual validation  
**If any tests fail:** See troubleshooting section below

---

### Manual Validation

#### 1. Test Lambda Health Check

```bash
aws lambda invoke \
  --function-name securebase-staging-report-engine \
  --payload '{"action": "health_check", "customer_id": "test-staging"}' \
  --region us-east-1 \
  response.json

cat response.json
```

**Expected:**
```json
{
  "statusCode": 200,
  "body": {
    "status": "healthy",
    "environment": "staging",
    "tables": {
      "reports": "available",
      "schedules": "available",
      "cache": "available",
      "metrics": "available"
    }
  }
}
```

---

#### 2. View CloudWatch Logs

```bash
aws logs tail /aws/lambda/securebase-staging-report-engine \
  --follow \
  --region us-east-1
```

**Expected:** No ERROR messages, function initialization logs visible

---

#### 3. Check DynamoDB Tables

```bash
aws dynamodb describe-table \
  --table-name securebase-staging-reports \
  --region us-east-1 \
  --query 'Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount}'
```

**Expected:**
```json
{
  "Name": "securebase-staging-reports",
  "Status": "ACTIVE",
  "ItemCount": 0
}
```

---

#### 4. Verify S3 Bucket Configuration

```bash
aws s3api get-bucket-versioning \
  --bucket securebase-staging-reports-123456789012

aws s3api get-bucket-encryption \
  --bucket securebase-staging-reports-123456789012
```

**Expected:** Versioning enabled, encryption configured

---

## Troubleshooting

### Issue: AWS Credentials Not Found

**Error:**
```
❌ AWS credentials not configured.
```

**Solution:**
```bash
# Configure credentials
aws configure

# Or export environment variables
export AWS_ACCESS_KEY_ID=YOUR_KEY
export AWS_SECRET_ACCESS_KEY=YOUR_SECRET
export AWS_DEFAULT_REGION=us-east-1
```

---

### Issue: DynamoDB Table Already Exists

**Error:**
```
Error: error creating DynamoDB Table: ResourceInUseException: Table already exists
```

**Solution Option 1 - Import:**
```bash
cd landing-zone/environments/staging
terraform import module.securebase.module.analytics.aws_dynamodb_table.reports \
  securebase-staging-reports
terraform apply
```

**Solution Option 2 - Delete:**
```bash
aws dynamodb delete-table --table-name securebase-staging-reports --region us-east-1
# Wait 30 seconds
terraform apply
```

---

### Issue: Lambda Layer Too Large

**Error:**
```
RequestEntityTooLargeException: Request must be smaller than 69905067 bytes
```

**Solution:**
The script automatically handles this by uploading to S3 first. If it fails:
```bash
# Create S3 bucket for layers
aws s3 mb s3://securebase-lambda-layers-$(aws sts get-caller-identity --query Account --output text)

# Script will automatically use S3 upload
```

---

### Issue: Terraform Backend Not Found

**Error:**
```
Error: Backend initialization required
```

**Solution:**
```bash
# Create S3 bucket for Terraform state
aws s3 mb s3://securebase-terraform-state-staging --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket securebase-terraform-state-staging \
  --versioning-configuration Status=Enabled

# Re-run deployment
./deploy-phase4-staging.sh
```

---

### Issue: Tests Failing After Deployment

**Symptoms:** Integration tests show failures

**Actions:**
1. Review CloudWatch logs for errors
2. Check IAM role permissions
3. Verify environment variables set correctly
4. Test Lambda manually with AWS CLI
5. Check DynamoDB table status

---

## Rollback Procedures

### Immediate Rollback (If Critical Issue Found)

```bash
cd landing-zone/environments/staging
terraform destroy -target=module.securebase.module.analytics -auto-approve
```

**Duration:** 3-5 minutes  
**Effect:** Removes all Phase 4 Analytics resources

---

### Full Environment Cleanup

```bash
cd landing-zone/environments/staging
terraform destroy -auto-approve
```

**Duration:** 5-10 minutes  
**Effect:** Removes entire staging environment

---

## Documentation Updates After Deployment

### 1. Update PHASE4_STATUS.md

```markdown
- **January 28, 2026:** Component 1 (Analytics) - Staging Deployment Complete ✅
  - Deployed to AWS staging at [timestamp]
  - All integration tests passed (15/15)
  - API endpoint: https://abcd1234.execute-api.us-east-1.amazonaws.com/staging
  - Lambda function ARN: arn:aws:lambda:us-east-1:123456789012:function:...
```

### 2. Create STAGING_TEST_RESULTS.md

Document actual test results, any issues encountered, and resolutions.

### 3. Update API Documentation

Add staging API endpoint to API_REFERENCE.md

---

## Next Steps After Successful Deployment

1. **Monitor for 24 hours** - Watch CloudWatch metrics and logs
2. **Run performance tests** - Load testing, response time validation
3. **Update frontend** - Configure phase3a-portal to use staging API
4. **Stakeholder demo** - Show working analytics in staging
5. **Plan production deployment** - Schedule based on staging results

---

## Success Confirmation

Deployment is successful when:

- ✅ Deployment script completed without errors
- ✅ All 15 integration tests passed
- ✅ Lambda health check returns 200
- ✅ CloudWatch logs show no errors
- ✅ Manual API tests successful
- ✅ All stakeholders notified

---

**Execution Guide Version:** 1.0  
**Last Updated:** January 28, 2026  
**Next Review:** After first deployment
