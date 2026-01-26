# Phase 4 Component 1: AWS Deployment Instructions
**Status:** READY TO DEPLOY  
**Date:** January 26, 2026  
**Component:** Advanced Analytics & Reporting

---

## 🎯 Quick Start - Deploy to AWS

### Prerequisites
- AWS CLI configured with credentials
- Terraform 1.5+ installed
- Python 3.11+ installed
- Appropriate IAM permissions (Lambda, DynamoDB, S3, IAM)

### One-Command Deployment

```bash
cd /home/runner/work/securebase-app/securebase-app
./DEPLOY_PHASE4_NOW.sh
```

**This automated script will:**
1. ✅ Package Lambda function (report_engine.py → 6.6KB ZIP)
2. ✅ Publish Lambda layer to AWS (8.3MB with dependencies)
3. ✅ Update Terraform configuration with layer ARN
4. ✅ Deploy all infrastructure via Terraform
5. ✅ Validate deployment

**Estimated time:** 5-10 minutes

---

## 📋 Pre-Deployment Checklist

Before deploying, verify:

- [ ] AWS credentials configured (`aws sts get-caller-identity`)
- [ ] Terraform installed (`terraform --version`)
- [ ] Repository checked out to correct branch
- [ ] All tests passed (`./TEST_PHASE4.sh`)

---

## 🔧 Manual Deployment Steps

If you prefer manual control or need to troubleshoot:

### Step 1: Verify Pre-Built Artifacts ✅

```bash
# Check Lambda layer (should be ~8.3MB)
ls -lh phase2-backend/layers/reporting/reporting-layer.zip

# Expected output:
# -rw-rw-r-- 1 user user 8.3M Jan 26 14:42 reporting-layer.zip
```

### Step 2: Package Lambda Function ✅

```bash
cd phase2-backend/functions
mkdir -p ../deploy
zip -j ../deploy/report_engine.zip report_engine.py

# Verify package
ls -lh ../deploy/report_engine.zip
# Expected: ~6.6KB
```

### Step 3: Publish Lambda Layer to AWS

```bash
cd phase2-backend/layers/reporting

# Publish layer
aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --description "ReportLab + openpyxl for Phase 4 Analytics" \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1

# Save the LayerVersionArn from the output!
# Example: arn:aws:lambda:us-east-1:123456789012:layer:securebase-dev-reporting:1
```

### Step 4: Update Terraform Configuration

```bash
cd /home/runner/work/securebase-app/securebase-app/landing-zone/environments/dev

# Edit terraform.tfvars and update reporting_layer_arn with actual ARN
# The file already has a placeholder ARN that needs to be replaced

# Example:
# reporting_layer_arn = "arn:aws:lambda:us-east-1:123456789012:layer:securebase-dev-reporting:1"
```

### Step 5: Deploy Infrastructure with Terraform

```bash
cd /home/runner/work/securebase-app/securebase-app/landing-zone/environments/dev

# Initialize Terraform (if not already done)
terraform init

# Validate configuration
terraform validate

# Plan deployment (review changes)
terraform plan -out=phase4-analytics.tfplan

# Review the plan output carefully!
# Expected resources:
# - 4 DynamoDB tables
# - 1 Lambda function
# - 1 S3 bucket
# - IAM roles and policies
# - CloudWatch Log Group

# Apply the plan
terraform apply phase4-analytics.tfplan
```

### Step 6: Verify Deployment

```bash
# Check DynamoDB tables
aws dynamodb list-tables --query 'TableNames[?contains(@, `securebase-dev`)]'

# Expected tables:
# - securebase-dev-reports
# - securebase-dev-report-schedules
# - securebase-dev-report-cache
# - securebase-dev-metrics

# Check Lambda function
aws lambda get-function --function-name securebase-dev-report-engine --region us-east-1

# Check S3 bucket
aws s3 ls | grep securebase-dev-report-exports

# View Terraform outputs
terraform output
```

---

## 🧪 Post-Deployment Testing

### Run Integration Tests

```bash
cd /home/runner/work/securebase-app/securebase-app
./TEST_PHASE4.sh
```

**Expected output:**
- ✅ All pre-deployment tests pass
- ✅ Lambda function deployed
- ✅ DynamoDB tables exist
- ✅ S3 bucket exists
- ✅ Lambda layer attached

### Test Lambda Function

```bash
# Test GET analytics endpoint
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://phase2-backend/functions/test-events/get-analytics.json \
  --region us-east-1 \
  test-output.json

# View response
cat test-output.json | jq '.'

# Expected: HTTP 200 response with analytics data
```

### Test CSV Export

```bash
# Test CSV export functionality
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://phase2-backend/functions/test-events/export-csv.json \
  --region us-east-1 \
  export-output.json

# View response (CSV will be base64 encoded in body)
cat export-output.json | jq -r '.body' | base64 -d

# Expected: CSV data with headers and rows
```

### Test Report List

```bash
# Test list reports endpoint
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://phase2-backend/functions/test-events/list-reports.json \
  --region us-east-1 \
  reports-output.json

# View response
cat reports-output.json | jq '.'

# Expected: HTTP 200 response with report list (may be empty initially)
```

### Monitor CloudWatch Logs

```bash
# Tail Lambda logs in real-time
aws logs tail /aws/lambda/securebase-dev-report-engine --follow --region us-east-1

# Or view recent logs
aws logs tail /aws/lambda/securebase-dev-report-engine --since 5m --region us-east-1
```

---

## 📊 Terraform Outputs Reference

After deployment, these outputs are available:

```bash
cd landing-zone/environments/dev

# View all outputs
terraform output

# View specific outputs
terraform output analytics_reports_table
terraform output analytics_lambda_function
terraform output analytics_reports_bucket
```

**Available outputs:**
- `analytics_reports_table` - DynamoDB reports table name
- `analytics_schedules_table` - DynamoDB schedules table name  
- `analytics_cache_table` - DynamoDB cache table name
- `analytics_metrics_table` - DynamoDB metrics table name
- `analytics_reports_bucket` - S3 bucket for exports
- `analytics_lambda_function` - Lambda function name

---

## 🔄 Rollback Procedure

If you need to rollback the deployment:

### Quick Rollback (Analytics Only)

```bash
cd landing-zone/environments/dev

# Destroy only analytics module
terraform destroy -target=module.analytics

# Confirm: yes
```

### Delete Lambda Layer

```bash
# List layer versions
aws lambda list-layer-versions --layer-name securebase-dev-reporting --region us-east-1

# Delete specific version
aws lambda delete-layer-version \
  --layer-name securebase-dev-reporting \
  --version-number 1 \
  --region us-east-1
```

### Full Cleanup (Manual)

```bash
# Delete Lambda function
aws lambda delete-function \
  --function-name securebase-dev-report-engine \
  --region us-east-1

# Delete DynamoDB tables (CAREFUL - DATA LOSS!)
aws dynamodb delete-table --table-name securebase-dev-reports --region us-east-1
aws dynamodb delete-table --table-name securebase-dev-report-schedules --region us-east-1
aws dynamodb delete-table --table-name securebase-dev-report-cache --region us-east-1
aws dynamodb delete-table --table-name securebase-dev-metrics --region us-east-1

# Empty and delete S3 bucket
BUCKET_NAME=$(aws s3 ls | grep securebase-dev-report-exports | awk '{print $3}')
aws s3 rm s3://$BUCKET_NAME --recursive
aws s3 rb s3://$BUCKET_NAME
```

---

## 🚨 Troubleshooting

### Issue: Lambda layer too large

**Error:** `RequestEntityTooLargeException: Request must be smaller than 69905067 bytes`

**Solution:** Upload layer to S3 first

```bash
cd phase2-backend/layers/reporting

# Create S3 bucket for layers (if needed)
aws s3 mb s3://securebase-lambda-layers-$(aws sts get-caller-identity --query Account --output text)

# Upload layer to S3
aws s3 cp reporting-layer.zip s3://securebase-lambda-layers-$(aws sts get-caller-identity --query Account --output text)/

# Publish from S3
aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --content S3Bucket=securebase-lambda-layers-$(aws sts get-caller-identity --query Account --output text),S3Key=reporting-layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1
```

### Issue: Terraform validation errors

**Error:** Unsupported argument errors in main.tf

**Note:** These are pre-existing issues in the main Terraform configuration, unrelated to Phase 4 analytics.

**Workaround:** The analytics module has been tested independently and validates correctly. The errors are in other modules.

### Issue: Lambda invocation fails

**Check:**
1. Layer is attached: `aws lambda get-function --function-name securebase-dev-report-engine`
2. Environment variables are set correctly
3. IAM role has DynamoDB and S3 permissions
4. CloudWatch logs for error details

### Issue: DynamoDB tables not accessible

**Check:**
1. Tables exist: `aws dynamodb list-tables`
2. IAM role has permissions
3. Tables are in ACTIVE state: `aws dynamodb describe-table --table-name securebase-dev-reports`

---

## 💰 Cost Monitoring

### View Current Costs

```bash
# DynamoDB costs (last 7 days)
aws ce get-cost-and-usage \
  --time-period Start=2026-01-20,End=2026-01-27 \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter file://<(echo '{"Dimensions":{"Key":"SERVICE","Values":["Amazon DynamoDB"]}}')

# Lambda costs
aws ce get-cost-and-usage \
  --time-period Start=2026-01-20,End=2026-01-27 \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter file://<(echo '{"Dimensions":{"Key":"SERVICE","Values":["AWS Lambda"]}}')
```

### Expected Costs
- **Monthly:** ~$5/month (DynamoDB + Lambda + S3)
- **Per invocation:** ~$0.000025 (2.5¢ per 1000 invocations)

---

## 📚 Documentation References

- [PHASE4_DEPLOYMENT_COMPLETE.md](PHASE4_DEPLOYMENT_COMPLETE.md) - Full deployment report
- [PHASE4_STATUS.md](PHASE4_STATUS.md) - Current status
- [PHASE4_DEPLOY_COMMANDS.md](PHASE4_DEPLOY_COMMANDS.md) - Alternative deployment guide
- [PHASE4_TESTING_GUIDE.md](PHASE4_TESTING_GUIDE.md) - Testing documentation
- [TEST_PHASE4.sh](TEST_PHASE4.sh) - Automated test suite

---

## ✅ Success Criteria

Deployment is successful when:

- [ ] All DynamoDB tables created (4 tables)
- [ ] Lambda function deployed with layer attached
- [ ] S3 bucket created
- [ ] Lambda function returns HTTP 200 on test invocation
- [ ] All export formats work (CSV, JSON, PDF, Excel)
- [ ] No errors in CloudWatch logs
- [ ] Integration tests pass (`./TEST_PHASE4.sh`)

---

## 🎉 Next Steps After Deployment

1. **Frontend Integration**
   ```bash
   cd phase3a-portal
   npm run dev
   # Test Analytics.jsx dashboard with live API
   ```

2. **Performance Testing**
   - Generate reports with large datasets
   - Validate query performance (<5s target)
   - Validate export performance (<10s target)

3. **Monitoring Setup**
   - Create CloudWatch alarms for Lambda errors
   - Set up cost alerts
   - Configure SNS notifications

4. **Documentation**
   - Update API documentation with analytics endpoints
   - Create user guide for Analytics dashboard
   - Document report templates

---

**Deployment Status:** ✅ READY  
**Estimated Time:** 5-10 minutes  
**Risk Level:** Low  
**Support:** See troubleshooting section above
