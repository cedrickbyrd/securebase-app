# Phase 4 Analytics - Staging Deployment Guide

**Date:** January 26, 2026  
**Component:** Advanced Analytics & Reporting  
**Environment:** Staging  
**Status:** Ready for Deployment

---

## 🎯 Overview

This guide provides complete instructions for deploying Phase 4 Analytics Component 1 to the **staging environment** for integration testing and validation before production release.

### Deployment Objectives

- ✅ Deploy analytics infrastructure to isolated staging environment
- ✅ Validate all components work end-to-end
- ✅ Test integration with Phase 2 backend
- ✅ Verify cost optimization (<$50/month target)
- ✅ Prepare for production deployment (Feb 2, 2026)

### Architecture Components

```
┌─────────────────────────────────────────────────────────┐
│                  Staging Environment                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐     ┌─────────────────────────────┐ │
│  │   Frontend   │────▶│     API Gateway             │ │
│  │  (Portal)    │     │  /analytics endpoints       │ │
│  └──────────────┘     └─────────────────────────────┘ │
│                                │                        │
│                                ▼                        │
│                     ┌──────────────────────┐           │
│                     │  Lambda Function     │           │
│                     │  report-engine       │           │
│                     │  + Reporting Layer   │           │
│                     └──────────────────────┘           │
│                         │              │                │
│                         ▼              ▼                │
│              ┌─────────────┐    ┌──────────┐          │
│              │  DynamoDB   │    │   S3     │          │
│              │  4 Tables   │    │  Bucket  │          │
│              └─────────────┘    └──────────┘          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

1. **AWS Credentials**: Configured with appropriate permissions
2. **Terraform**: Version 1.0+ installed
3. **AWS CLI**: Version 2.0+ installed
4. **Permissions**: Lambda, DynamoDB, S3, IAM, CloudWatch access

### One-Command Deployment

```bash
cd /home/runner/work/securebase-app/securebase-app
./deploy-phase4-staging.sh
```

**Deployment Time:** ~5-10 minutes

---

## 📋 Detailed Deployment Steps

### Step 1: Environment Setup

The staging environment configuration is already created in:
- `landing-zone/environments/staging/main.tf`
- `landing-zone/environments/staging/variables.tf`
- `landing-zone/environments/staging/terraform.tfvars`
- `landing-zone/environments/staging/outputs.tf`

**Key Configuration:**
```hcl
environment    = "staging"
org_name       = "SecureBase-Staging"
target_region  = "us-east-1"

# Cost-optimized settings
max_aurora_capacity = 2      # 50% of production
min_aurora_capacity = 0.5    # Auto-scales down when idle
rds_backup_retention = 7     # 7 days vs 35 in production
```

### Step 2: Build Lambda Components

The Lambda layer and function are already built:
- **Layer**: `phase2-backend/layers/reporting/reporting-layer.zip` (~8.5MB)
- **Function**: `phase2-backend/deploy/report_engine.zip` (~6KB)

**Dependencies:**
- ReportLab 4.0.7 (PDF generation)
- openpyxl 3.1.2 (Excel generation)
- Pillow 10.1.0 (Image support)

### Step 3: Deploy to AWS

```bash
cd /home/runner/work/securebase-app/securebase-app
./deploy-phase4-staging.sh
```

**The script will:**
1. ✅ Verify Lambda layer (8.5MB reporting-layer.zip)
2. ✅ Publish layer to AWS Lambda
3. ✅ Verify Lambda function package (6KB report_engine.zip)
4. ✅ Update Terraform variables with layer ARN
5. ✅ Initialize Terraform
6. ✅ Run terraform validate
7. ✅ Run terraform plan
8. ✅ Prompt for confirmation
9. ✅ Apply infrastructure changes
10. ✅ Verify deployment

### Step 4: Verify Deployment

```bash
./test-phase4-staging.sh
```

**Test Coverage:**
- ✅ DynamoDB tables (4 tables)
- ✅ Lambda function status
- ✅ Lambda layer attachment
- ✅ S3 bucket and permissions
- ✅ CloudWatch logs
- ✅ Lambda invocation
- ✅ DynamoDB read/write
- ✅ IAM role permissions

---

## 🧪 Testing & Validation

### Infrastructure Tests

Run the automated test suite:
```bash
./test-phase4-staging.sh
```

**Expected Results:**
- All infrastructure components exist
- Lambda function is Active
- DynamoDB tables accessible
- S3 bucket has write permissions
- CloudWatch logging enabled

### Manual API Tests

1. **Get API Endpoint:**
   ```bash
   cd landing-zone/environments/staging
   terraform output api_gateway_endpoint
   ```

2. **Test Analytics Query:**
   ```bash
   API_URL=$(cd landing-zone/environments/staging && terraform output -raw api_gateway_endpoint)
   
   curl -X GET "$API_URL/analytics?dateRange=30d&dimension=service" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. **Test Report Export:**
   ```bash
   curl -X POST "$API_URL/analytics/export" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "format": "csv",
       "name": "test-report",
       "data": [{"service": "EC2", "cost": 100}]
     }' \
     -o report.csv
   ```

### Frontend Integration

1. **Update Frontend Configuration:**
   ```bash
   cd phase3a-portal
   
   # Get API endpoint
   API_ENDPOINT=$(cd ../landing-zone/environments/staging && terraform output -raw api_gateway_endpoint)
   
   # Create staging environment file
   echo "VITE_API_BASE_URL=$API_ENDPOINT" > .env.staging
   ```

2. **Run Frontend:**
   ```bash
   npm run dev
   ```

3. **Test Analytics Dashboard:**
   - Navigate to http://localhost:5173
   - Login with test credentials
   - Click "Analytics" tab
   - Verify dashboard loads
   - Test report export (CSV, PDF, Excel)

---

## 📊 Deployed Resources

### DynamoDB Tables

| Table Name | Purpose | Billing Mode | PITR |
|------------|---------|--------------|------|
| securebase-staging-reports | Report configurations | PAY_PER_REQUEST | Enabled |
| securebase-staging-report-schedules | Automated delivery | PAY_PER_REQUEST | Enabled |
| securebase-staging-report-cache | Query results cache | PAY_PER_REQUEST | Disabled |
| securebase-staging-metrics | Analytics data | PAY_PER_REQUEST | Enabled |

### Lambda Functions

| Function | Runtime | Memory | Timeout | Layer |
|----------|---------|--------|---------|-------|
| securebase-staging-report-engine | Python 3.11 | 512 MB | 30s | securebase-staging-reporting:1 |

### S3 Buckets

| Bucket | Purpose | Lifecycle | Encryption |
|--------|---------|-----------|------------|
| securebase-staging-reports-{account-id} | Report exports | 90 days | AES256 |

### API Gateway Routes

| Method | Path | Lambda | Auth |
|--------|------|--------|------|
| GET | /analytics | report-engine | JWT |
| POST | /analytics | report-engine | JWT |
| GET | /analytics/reports | report-engine | JWT |
| POST | /analytics/reports | report-engine | JWT |
| GET | /analytics/reports/{id} | report-engine | JWT |
| POST | /analytics/export | report-engine | JWT |

---

## 💰 Cost Analysis

### Estimated Monthly Cost (Staging)

```
DynamoDB (4 tables, PAY_PER_REQUEST):
  • Storage: 1 GB × $0.25/GB = $0.25
  • Writes: 10K/month × $1.25/million = $0.01
  • Reads: 50K/month × $0.25/million = $0.01
  Subtotal: $0.27/month

Lambda:
  • Requests: 5K/month (free tier: 1M)
  • Compute: 2.5 GB-seconds (free tier: 400K)
  Subtotal: $0.00/month

S3:
  • Storage: 2 GB × $0.023/GB = $0.05
  • Requests: 1K PUT × $0.005/1000 = $0.01
  Subtotal: $0.06/month

API Gateway:
  • Requests: 5K/month (free tier: 1M)
  Subtotal: $0.00/month

CloudWatch Logs:
  • 500 MB ingestion × $0.50/GB = $0.25
  • 30-day retention
  Subtotal: $0.25/month

TOTAL: ~$0.58/month (well under $50 target)
```

**Cost Optimization Features:**
- Aurora auto-scales to 0.5 ACU when idle
- DynamoDB PAY_PER_REQUEST (no provisioned capacity)
- S3 lifecycle policies (90-day expiration)
- CloudWatch 30-day log retention
- Lambda free tier coverage

---

## 🔍 Monitoring & Observability

### CloudWatch Dashboards

View Lambda metrics:
```bash
aws cloudwatch get-dashboard \
  --dashboard-name "securebase-staging-analytics" \
  --region us-east-1
```

### Log Analysis

Tail Lambda logs:
```bash
aws logs tail /aws/lambda/securebase-staging-report-engine --follow
```

Filter for errors:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/securebase-staging-report-engine \
  --filter-pattern "ERROR" \
  --region us-east-1
```

### Cost Tracking

Monitor costs by tag:
```bash
# View costs for staging environment
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter file://cost-filter.json
```

**cost-filter.json:**
```json
{
  "Tags": {
    "Key": "Environment",
    "Values": ["staging"]
  }
}
```

---

## 🔄 Rollback Plan

### Option 1: Destroy All Resources

```bash
cd landing-zone/environments/staging
terraform destroy
```

**This will remove:**
- All DynamoDB tables
- S3 bucket (must be empty first)
- Lambda function and layer
- IAM roles and policies
- CloudWatch log groups

### Option 2: Selective Rollback

Remove only analytics module:
```bash
cd landing-zone/environments/staging

# Comment out analytics module in main.tf
# Then apply
terraform apply
```

### Option 3: Revert to Previous State

```bash
cd landing-zone/environments/staging

# Revert to previous state file
terraform state pull > current-state.json
aws s3 cp s3://securebase-terraform-state-staging/landing-zone/terraform.tfstate.backup .
terraform state push terraform.tfstate.backup
```

---

## 📚 Troubleshooting

### Issue: Lambda Layer Not Attached

**Symptoms:** Lambda function missing layer, import errors for reportlab/openpyxl

**Solution:**
```bash
# Verify layer ARN in terraform.tfvars
cd landing-zone/environments/staging
grep reporting_layer_arn terraform.tfvars

# Re-publish layer if needed
cd ../../phase2-backend/layers/reporting
aws lambda publish-layer-version \
  --layer-name securebase-staging-reporting \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11
```

### Issue: DynamoDB Access Denied

**Symptoms:** Lambda function cannot read/write to DynamoDB

**Solution:**
```bash
# Check IAM role permissions
aws iam get-role-policy \
  --role-name securebase-staging-report-engine-role \
  --policy-name report-engine-permissions

# Verify table ARNs in policy match deployed tables
aws dynamodb list-tables | grep staging
```

### Issue: S3 Upload Fails

**Symptoms:** Report export fails with S3 permissions error

**Solution:**
```bash
# Verify bucket exists
aws s3 ls | grep staging-reports

# Check bucket policy
aws s3api get-bucket-policy \
  --bucket securebase-staging-reports-{account-id}

# Test manual upload
echo "test" > test.txt
aws s3 cp test.txt s3://securebase-staging-reports-{account-id}/test/
```

### Issue: Terraform State Lock

**Symptoms:** Terraform commands fail with state lock error

**Solution:**
```bash
# Force unlock (use with caution)
cd landing-zone/environments/staging
terraform force-unlock <LOCK_ID>

# Or wait for lock to expire (typically 5 minutes)
```

---

## 🎯 Success Criteria

- ✅ All infrastructure deployed successfully
- ✅ Lambda function Active and invokable
- ✅ DynamoDB tables accessible (read/write)
- ✅ S3 bucket created with proper permissions
- ✅ API Gateway endpoints returning 200 OK
- ✅ CloudWatch logging enabled
- ✅ Integration tests passing (>90%)
- ✅ Frontend connects to staging API
- ✅ Cost tracking enabled (<$50/month)
- ✅ Rollback plan documented and tested

---

## 📅 Timeline

- **Start Date:** January 26, 2026
- **Deployment Time:** ~10 minutes
- **Testing Time:** ~30 minutes
- **Total Duration:** ~1 hour
- **Target Completion:** January 27, 2026
- **Production Deployment:** February 2, 2026

---

## 📖 Related Documentation

- [PHASE4_DEPLOYMENT_READY.md](PHASE4_DEPLOYMENT_READY.md) - Component readiness
- [PHASE4_TESTING_GUIDE.md](PHASE4_TESTING_GUIDE.md) - Testing procedures
- [deploy-phase4-analytics.sh](deploy-phase4-analytics.sh) - Dev deployment script
- [test-phase4-staging.sh](test-phase4-staging.sh) - Staging test suite
- [DEPLOY_PHASE4_MANUAL.md](DEPLOY_PHASE4_MANUAL.md) - Manual deployment steps

---

## 🤝 Support

For issues or questions:
1. Check [PHASE4_TESTING_GUIDE.md](PHASE4_TESTING_GUIDE.md) troubleshooting section
2. Review CloudWatch logs: `/aws/lambda/securebase-staging-report-engine`
3. Verify AWS Console:
   - Lambda: https://console.aws.amazon.com/lambda
   - DynamoDB: https://console.aws.amazon.com/dynamodb
   - S3: https://console.aws.amazon.com/s3

---

**Last Updated:** January 26, 2026  
**Environment:** Staging  
**Status:** Ready for Deployment
