# Phase 4 Analytics - Staging Deployment Quick Reference

**Status:** ✅ Ready to Execute  
**Last Updated:** January 28, 2026

---

## 🚀 Quick Deploy Command

```bash
cd /home/runner/work/securebase-app/securebase-app
./deploy-phase4-staging.sh
```

**Duration:** 10-15 minutes  
**Prerequisites:** AWS credentials configured, Terraform installed

---

## 📋 Pre-Deployment Checklist

Before running the deployment, verify:

```bash
# 1. Check AWS credentials
aws sts get-caller-identity

# 2. Verify Terraform installed
terraform --version

# 3. Check deployment script
ls -lh deploy-phase4-staging.sh

# 4. Verify staging configuration
cat landing-zone/environments/staging/terraform.tfvars
```

---

## 🔧 Deployment Steps Overview

The `deploy-phase4-staging.sh` script automates these steps:

1. **Pre-flight Checks** - Verify AWS CLI, Terraform, credentials
2. **Lambda Layer** - Build/verify reporting-layer.zip (8.3MB)
3. **Publish Layer** - Upload to AWS Lambda
4. **Package Function** - Create report_engine.zip (6.6KB)
5. **Update Config** - Add layer ARN to terraform.tfvars
6. **Terraform Init** - Initialize staging environment
7. **Terraform Validate** - Check configuration syntax
8. **Terraform Plan** - Review changes
9. **User Confirmation** - Prompt to continue
10. **Terraform Apply** - Deploy infrastructure
11. **Verify Deployment** - Check resources created

---

## ✅ Post-Deployment Validation

### Run Integration Tests

```bash
./test-phase4-staging.sh
```

**Expected:** 12-15 tests passing

### Manual Verification

```bash
# Check DynamoDB tables
aws dynamodb list-tables --region us-east-1 | grep staging

# Check Lambda function
aws lambda get-function \
  --function-name securebase-staging-report-engine \
  --region us-east-1

# Check S3 bucket
aws s3 ls | grep securebase-staging-reports

# View CloudWatch logs
aws logs tail /aws/lambda/securebase-staging-report-engine --follow
```

---

## 🧪 Test Lambda Function

```bash
# Health check test
aws lambda invoke \
  --function-name securebase-staging-report-engine \
  --payload '{"action": "health_check", "customer_id": "test-staging"}' \
  --region us-east-1 \
  response.json

cat response.json
```

**Expected Response:**
```json
{
  "statusCode": 200,
  "body": {
    "status": "healthy",
    "environment": "staging",
    "timestamp": "2026-01-28T..."
  }
}
```

---

## 📊 Resources Created

### DynamoDB Tables
- `securebase-staging-reports`
- `securebase-staging-report-schedules`
- `securebase-staging-report-cache`
- `securebase-staging-metrics`

### Lambda Resources
- Function: `securebase-staging-report-engine`
- Layer: `securebase-staging-reporting:1`
- Log Group: `/aws/lambda/securebase-staging-report-engine`

### Storage
- S3 Bucket: `securebase-staging-reports-{account-id}`

### IAM
- Role: `securebase-staging-report-engine-role`
- Policies: DynamoDB, S3, CloudWatch access

---

## 💰 Expected Costs

**Monthly:** ~$0.58
- DynamoDB: $0.27
- Lambda: $0.00 (free tier)
- S3: $0.06
- CloudWatch: $0.25

**One-Time:** ~$0.03
- Lambda layer storage
- Terraform state

---

## 🔄 Rollback Procedure

### Quick Rollback (Analytics Only)

```bash
cd landing-zone/environments/staging
terraform destroy -target=module.securebase.module.analytics
```

### Full Environment Cleanup

```bash
cd landing-zone/environments/staging
terraform destroy
```

---

## 🚨 Common Issues

### Issue: AWS Credentials Not Configured
**Error:** `Unable to locate credentials`

**Fix:**
```bash
aws configure
# OR
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
```

### Issue: Lambda Layer Too Large
**Error:** `RequestEntityTooLargeException`

**Fix:**
```bash
# Upload to S3 first
aws s3 mb s3://securebase-lambda-layers
aws s3 cp phase2-backend/layers/reporting/reporting-layer.zip \
  s3://securebase-lambda-layers/

# Update script to use S3 location
```

### Issue: Terraform Backend Not Found
**Error:** `Error loading backend`

**Fix:**
```bash
# Create S3 bucket for state
aws s3 mb s3://securebase-terraform-state-staging --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket securebase-terraform-state-staging \
  --versioning-configuration Status=Enabled
```

### Issue: DynamoDB Table Already Exists
**Error:** `ResourceInUseException: Table already exists`

**Fix:**
```bash
# Option 1: Import existing table
terraform import module.securebase.module.analytics.aws_dynamodb_table.reports \
  securebase-staging-reports

# Option 2: Delete and recreate
aws dynamodb delete-table --table-name securebase-staging-reports
terraform apply
```

---

## 📚 Related Documentation

- [PHASE4_STAGING_DEPLOYMENT_REPORT.md](PHASE4_STAGING_DEPLOYMENT_REPORT.md) - Full deployment report
- [PHASE4_STATUS.md](PHASE4_STATUS.md) - Current phase status
- [PHASE4_TESTING_GUIDE.md](PHASE4_TESTING_GUIDE.md) - Testing documentation
- [landing-zone/environments/staging/README.md](landing-zone/environments/staging/README.md) - Staging env details

---

## 🎯 Success Criteria

Deployment is successful when:

- ✅ All 4 DynamoDB tables created and ACTIVE
- ✅ Lambda function deployed with status "Active"
- ✅ Lambda layer attached (verify with `aws lambda get-function`)
- ✅ S3 bucket created with versioning enabled
- ✅ Integration tests pass (12+ tests)
- ✅ Lambda health check returns HTTP 200
- ✅ No errors in CloudWatch logs

---

## 📞 Support & Next Steps

### After Successful Deployment

1. **Update Status Document**
   ```bash
   # Edit PHASE4_STATUS.md
   # Mark staging deployment as complete
   ```

2. **Run Performance Tests**
   ```bash
   # Load test with multiple concurrent requests
   # Verify response times <5s
   ```

3. **Frontend Integration**
   ```bash
   cd phase3a-portal
   # Update .env.staging with API endpoint
   npm run test:e2e -- --env=staging
   ```

4. **Plan Production Deployment**
   - Review staging results
   - Document any issues
   - Update deployment timeline
   - Schedule production deployment

---

## 🔗 Quick Links

- **AWS Console:**
  - [Lambda Functions](https://console.aws.amazon.com/lambda)
  - [DynamoDB Tables](https://console.aws.amazon.com/dynamodb)
  - [S3 Buckets](https://console.aws.amazon.com/s3)
  - [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch)

- **Terraform:**
  ```bash
  cd landing-zone/environments/staging
  terraform output  # View all outputs
  ```

---

**Contact:** Phase 4 Team  
**Escalation:** See TROUBLESHOOTING.md
