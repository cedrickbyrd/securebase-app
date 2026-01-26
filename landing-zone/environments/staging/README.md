# SecureBase Staging Environment

**Environment:** Staging  
**Purpose:** Phase 4 Analytics Integration Testing  
**Region:** us-east-1

---

## Overview

This staging environment provides an isolated testing environment for Phase 4 Analytics deployment before production release.

### Environment Characteristics

- **Cost-Optimized**: Lower capacity limits than production (<$50/month target)
- **Production-Like**: Same infrastructure components with reduced scale
- **Isolated**: Separate AWS resources with `staging` prefix
- **Temporary**: Can be destroyed and recreated as needed

---

## Quick Start

### Deploy Staging Environment

```bash
# From repository root
cd /home/runner/work/securebase-app/securebase-app
./deploy-phase4-staging.sh
```

### Test Deployment

```bash
./test-phase4-staging.sh
```

### Tear Down

```bash
cd landing-zone/environments/staging
terraform destroy
```

---

## Configuration

### Environment Variables

**File:** `terraform.tfvars`

```hcl
environment    = "staging"
org_name       = "SecureBase-Staging"
target_region  = "us-east-1"

# Cost-optimized Aurora settings
max_aurora_capacity = 2      # 50% of production
min_aurora_capacity = 0.5    # Auto-scales down
rds_backup_retention = 7     # 7 days vs 35 in prod

# Test client configuration
clients = {
  staging_test = {
    tier       = "standard"
    account_id = ""  # AWS auto-creates
    prefix     = "staging-test"
    framework  = "soc2"
  }
}
```

### Backend Configuration

**File:** `backend.hcl`

```hcl
bucket = "securebase-terraform-state-staging"
key    = "landing-zone/terraform.tfstate"
region = "us-east-1"
encrypt = true
```

---

## Deployed Resources

### Phase 4 Analytics

**DynamoDB Tables:**
- `securebase-staging-reports`
- `securebase-staging-report-schedules`
- `securebase-staging-report-cache`
- `securebase-staging-metrics`

**Lambda Function:**
- `securebase-staging-report-engine` (512MB, 30s timeout)

**S3 Bucket:**
- `securebase-staging-reports-{account-id}`

**Lambda Layer:**
- `securebase-staging-reporting:1` (ReportLab + openpyxl)

---

## Resource Naming Convention

All resources use the pattern: `securebase-staging-{resource-type}`

Examples:
- `securebase-staging-reports` (DynamoDB)
- `securebase-staging-report-engine` (Lambda)
- `securebase-staging-reports-123456789012` (S3)

---

## Terraform Commands

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

### Outputs

```bash
# List all outputs
terraform output

# Specific output
terraform output api_gateway_endpoint
terraform output analytics_report_engine_arn
```

---

## Testing

### Infrastructure Tests

```bash
# From repository root
./test-phase4-staging.sh
```

**Test Coverage:**
- ✅ DynamoDB table existence
- ✅ Lambda function status
- ✅ Lambda layer attachment
- ✅ S3 bucket permissions
- ✅ CloudWatch log groups
- ✅ Lambda invocation
- ✅ DynamoDB read/write
- ✅ IAM role permissions

### Manual API Tests

```bash
# Get API endpoint
API_URL=$(terraform output -raw api_gateway_endpoint)

# Test health check
curl -X GET "$API_URL/analytics?action=health_check"

# Test with JWT token
curl -X GET "$API_URL/analytics?dateRange=30d" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Cost Management

### Target Cost

**Monthly:** <$50 for entire staging environment

### Cost Breakdown

```
DynamoDB: ~$0.27/month
Lambda: ~$0.00/month (free tier)
S3: ~$0.06/month
CloudWatch: ~$0.25/month
TOTAL: ~$0.58/month
```

### Monitor Costs

```bash
# AWS Cost Explorer (requires CLI)
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter file://cost-filter.json

# cost-filter.json
{
  "Tags": {
    "Key": "Environment",
    "Values": ["staging"]
  }
}
```

---

## Monitoring

### CloudWatch Logs

```bash
# Tail Lambda logs
aws logs tail /aws/lambda/securebase-staging-report-engine --follow

# Filter errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/securebase-staging-report-engine \
  --filter-pattern "ERROR"
```

### Lambda Metrics

```bash
# Get function metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=securebase-staging-report-engine \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

## Troubleshooting

### Common Issues

**1. Terraform Init Fails**
```bash
# Remove cached providers
rm -rf .terraform
terraform init -backend-config=backend.hcl
```

**2. Lambda Invocation Errors**
```bash
# Check Lambda logs
aws logs tail /aws/lambda/securebase-staging-report-engine --follow

# Verify environment variables
aws lambda get-function-configuration \
  --function-name securebase-staging-report-engine \
  --query 'Environment.Variables'
```

**3. DynamoDB Access Denied**
```bash
# Check IAM role permissions
aws iam get-role-policy \
  --role-name securebase-staging-report-engine-role \
  --policy-name report-engine-permissions
```

---

## Cleanup

### Option 1: Destroy Everything

```bash
cd landing-zone/environments/staging
terraform destroy
```

### Option 2: Selective Cleanup

```bash
# Remove only Phase 4 resources
terraform state rm module.securebase.module.analytics
terraform apply
```

### Option 3: Empty and Remove S3 Bucket

```bash
BUCKET_NAME=$(terraform output -raw analytics_s3_bucket)
aws s3 rm s3://$BUCKET_NAME --recursive
aws s3 rb s3://$BUCKET_NAME
```

---

## Security Considerations

- ✅ All resources encrypted at rest (KMS/AES256)
- ✅ IAM roles follow least-privilege principle
- ✅ No public endpoints (API Gateway requires JWT)
- ✅ CloudWatch logging enabled
- ✅ DynamoDB Point-in-Time Recovery enabled
- ✅ S3 bucket versioning enabled

---

## Related Documentation

- [STAGING_DEPLOYMENT_GUIDE.md](../../STAGING_DEPLOYMENT_GUIDE.md)
- [PHASE4_TESTING_GUIDE.md](../../PHASE4_TESTING_GUIDE.md)
- [deploy-phase4-staging.sh](../../deploy-phase4-staging.sh)
- [test-phase4-staging.sh](../../test-phase4-staging.sh)

---

**Last Updated:** January 26, 2026  
**Status:** Ready for Deployment
