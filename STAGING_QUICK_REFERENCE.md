# Phase 4 Staging - Quick Reference

**Environment:** Staging  
**Purpose:** Analytics Integration Testing  
**Region:** us-east-1

---

## 🚀 One-Command Deployment

```bash
cd /home/runner/work/securebase-app/securebase-app
./deploy-phase4-staging.sh
```

---

## 🧪 One-Command Testing

```bash
./test-phase4-staging.sh
```

---

## 📊 Key Resources

### DynamoDB Tables
- `securebase-staging-reports`
- `securebase-staging-report-schedules`
- `securebase-staging-report-cache`
- `securebase-staging-metrics`

### Lambda Function
- `securebase-staging-report-engine` (512MB, 30s timeout)

### S3 Bucket
- `securebase-staging-reports-{account-id}`

### Lambda Layer
- `securebase-staging-reporting:1`

---

## 🔧 Common Commands

### Get API Endpoint
```bash
cd landing-zone/environments/staging
terraform output api_gateway_endpoint
```

### Invoke Lambda
```bash
aws lambda invoke \
  --function-name securebase-staging-report-engine \
  --payload '{"action":"health_check"}' \
  response.json && cat response.json
```

### Check DynamoDB Tables
```bash
aws dynamodb list-tables | grep staging
```

### Check S3 Bucket
```bash
aws s3 ls | grep staging-reports
```

### Tail Lambda Logs
```bash
aws logs tail /aws/lambda/securebase-staging-report-engine --follow
```

### View Terraform State
```bash
cd landing-zone/environments/staging
terraform show
```

### List Terraform Outputs
```bash
terraform output
```

---

## 🔄 Terraform Operations

### Initialize
```bash
cd landing-zone/environments/staging
terraform init -backend-config=backend.hcl
```

### Plan
```bash
terraform plan -out=staging.tfplan
```

### Apply
```bash
terraform apply staging.tfplan
```

### Destroy
```bash
terraform destroy
```

### Refresh State
```bash
terraform refresh
```

---

## 💰 Cost Tracking

### View Current Costs
```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter '{"Tags":{"Key":"Environment","Values":["staging"]}}'
```

**Expected:** ~$0.02/day (~$0.60/month)

---

## 🧹 Cleanup

### Quick Destroy
```bash
cd landing-zone/environments/staging

# Empty S3 bucket first
BUCKET=$(terraform output -raw analytics_s3_bucket 2>/dev/null)
if [ ! -z "$BUCKET" ]; then
  aws s3 rm s3://$BUCKET --recursive
fi

# Destroy all resources
terraform destroy -auto-approve
```

### Selective Cleanup (Analytics Only)
```bash
terraform state rm module.securebase.module.analytics
terraform apply
```

---

## 🐛 Troubleshooting

### Lambda Errors
```bash
# View recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/securebase-staging-report-engine \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

### DynamoDB Issues
```bash
# Check table status
aws dynamodb describe-table \
  --table-name securebase-staging-reports \
  --query 'Table.TableStatus'
```

### S3 Permission Issues
```bash
# Test upload
echo "test" > /tmp/test.txt
aws s3 cp /tmp/test.txt s3://securebase-staging-reports-${AWS_ACCOUNT_ID}/test/
```

### Terraform State Issues
```bash
# Remove corrupted state
terraform state rm <resource>

# Pull state from remote
terraform state pull > current-state.json

# Push state to remote
terraform state push terraform.tfstate
```

---

## 📚 Documentation

- [STAGING_DEPLOYMENT_GUIDE.md](STAGING_DEPLOYMENT_GUIDE.md) - Complete guide
- [STAGING_DEPLOYMENT_PLAN.md](STAGING_DEPLOYMENT_PLAN.md) - Execution plan
- [PHASE4_TESTING_GUIDE.md](PHASE4_TESTING_GUIDE.md) - Testing procedures
- [landing-zone/environments/staging/README.md](landing-zone/environments/staging/README.md) - Environment docs

---

## 🎯 Quick Health Check

```bash
#!/bin/bash
# Quick health check script

echo "=== Staging Health Check ==="

# Lambda
echo -n "Lambda: "
aws lambda get-function \
  --function-name securebase-staging-report-engine \
  --query 'Configuration.State' \
  --output text 2>/dev/null || echo "NOT FOUND"

# DynamoDB
echo -n "DynamoDB Tables: "
aws dynamodb list-tables \
  --query "length(TableNames[?contains(@, 'staging')])" \
  --output text

# S3
echo -n "S3 Bucket: "
aws s3 ls | grep -c staging-reports

# API Endpoint
echo -n "API Endpoint: "
cd landing-zone/environments/staging 2>/dev/null && \
  terraform output -raw api_gateway_endpoint 2>/dev/null || \
  echo "Not deployed"

echo "=========================="
```

---

**Last Updated:** January 26, 2026  
**Status:** Ready for Deployment
