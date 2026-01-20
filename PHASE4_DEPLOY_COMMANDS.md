# Phase 4 Component 1: AWS Deployment Commands
**Last Updated:** January 19, 2026  
**Status:** Ready to Deploy

## Quick Deploy (One Command)

```bash
chmod +x DEPLOY_PHASE4_NOW.sh && ./DEPLOY_PHASE4_NOW.sh
```

This automated script will:
1. ✅ Package Lambda function
2. ✅ Build Lambda layer with dependencies
3. ✅ Publish layer to AWS
4. ✅ Configure Terraform with layer ARN
5. ✅ Deploy all infrastructure

**Estimated time:** 5-10 minutes

---

## Manual Deployment (Step-by-Step)

If you prefer manual control:

### Step 1: Package Lambda Function
```bash
cd phase2-backend/functions
mkdir -p ../deploy
zip -j ../deploy/report_engine.zip report_engine.py
```

### Step 2: Build Lambda Layer
```bash
cd ../layers/reporting
mkdir -p python/lib/python3.11/site-packages
pip install -r requirements.txt -t python/lib/python3.11/site-packages
zip -r reporting-layer.zip python/
```

### Step 3: Publish Layer to AWS
```bash
aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --description "ReportLab + openpyxl for Phase 4 Analytics" \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1
```

**Save the LayerVersionArn from the output!**

### Step 4: Configure Terraform
```bash
cd /workspaces/securebase-app/landing-zone

# Add to terraform.tfvars (or create if doesn't exist):
cat >> terraform.tfvars << EOF

# Phase 4: Analytics Lambda Layer
reporting_layer_arn = "arn:aws:lambda:us-east-1:ACCOUNT_ID:layer:securebase-dev-reporting:1"
EOF
```

### Step 5: Deploy with Terraform
```bash
terraform init -upgrade
terraform plan -out=phase4-analytics.tfplan
terraform apply phase4-analytics.tfplan
```

---

## Post-Deployment Verification

### 1. Check Terraform Outputs
```bash
cd landing-zone
terraform output api_endpoints
```

### 2. Test Lambda Function
```bash
# Test GET analytics
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://phase2-backend/functions/test-events/get-analytics.json \
  test-output.json

cat test-output.json
```

### 3. Test CSV Export
```bash
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://phase2-backend/functions/test-events/export-csv.json \
  export-output.json

cat export-output.json | jq -r '.body' | base64 -d
```

### 4. View CloudWatch Logs
```bash
aws logs tail /aws/lambda/securebase-dev-report-engine --follow
```

### 5. Test API Gateway Endpoints
```bash
# Get API endpoint
API_ENDPOINT=$(terraform output -raw api_gateway_endpoint)

# Test analytics endpoint (requires JWT token)
curl -X GET "${API_ENDPOINT}/analytics?customer_id=test-customer&start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Verify Deployed Resources

### DynamoDB Tables
```bash
aws dynamodb list-tables --query 'TableNames[?contains(@, `securebase-dev`)]'
```

Expected tables:
- `securebase-dev-reports`
- `securebase-dev-report-schedules`
- `securebase-dev-report-cache`
- `securebase-dev-metrics`

### S3 Buckets
```bash
aws s3 ls | grep securebase-dev-report-exports
```

### Lambda Functions
```bash
aws lambda list-functions --query 'Functions[?contains(FunctionName, `report-engine`)]'
```

### Lambda Layers
```bash
aws lambda list-layer-versions --layer-name securebase-dev-reporting
```

---

## Troubleshooting

### Lambda Layer Too Large Error
If the layer exceeds 50MB:
```bash
# Check layer size
du -h reporting-layer.zip

# If too large, use S3 upload instead:
aws s3 cp reporting-layer.zip s3://YOUR-BUCKET/lambda-layers/
aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --content S3Bucket=YOUR-BUCKET,S3Key=lambda-layers/reporting-layer.zip \
  --compatible-runtimes python3.11
```

### Terraform State Lock
If Terraform complains about state lock:
```bash
# Force unlock (use with caution!)
terraform force-unlock LOCK_ID
```

### DynamoDB Table Already Exists
If tables exist from previous deployment:
```bash
# Option 1: Import existing tables
terraform import module.analytics.aws_dynamodb_table.reports securebase-dev-reports

# Option 2: Destroy and recreate
terraform destroy -target=module.analytics
terraform apply
```

### Lambda Permission Errors
If Lambda can't access DynamoDB:
```bash
# Check IAM role
aws iam get-role --role-name securebase-dev-report-engine-role

# Check policies
aws iam list-attached-role-policies --role-name securebase-dev-report-engine-role
```

---

## Rollback Procedure

### Quick Rollback
```bash
cd landing-zone
terraform destroy -target=module.analytics
```

### Full Rollback
```bash
# Delete Lambda layer
aws lambda delete-layer-version \
  --layer-name securebase-dev-reporting \
  --version-number 1

# Delete Lambda function
aws lambda delete-function --function-name securebase-dev-report-engine

# Delete DynamoDB tables (careful!)
aws dynamodb delete-table --table-name securebase-dev-reports
aws dynamodb delete-table --table-name securebase-dev-report-schedules
aws dynamodb delete-table --table-name securebase-dev-report-cache
aws dynamodb delete-table --table-name securebase-dev-metrics

# Empty and delete S3 bucket
aws s3 rm s3://securebase-dev-report-exports --recursive
aws s3 rb s3://securebase-dev-report-exports
```

---

## Environment Variables Reference

Lambda function environment variables (auto-configured by Terraform):

```
REPORTS_TABLE=securebase-dev-reports
SCHEDULES_TABLE=securebase-dev-report-schedules
CACHE_TABLE=securebase-dev-report-cache
METRICS_TABLE=securebase-dev-metrics
S3_BUCKET=securebase-dev-report-exports-ACCOUNT_ID
ENVIRONMENT=dev
LOG_LEVEL=INFO
```

---

## Cost Estimate

**Monthly costs for Phase 4 Analytics (us-east-1):**

| Resource | Usage | Monthly Cost |
|----------|-------|--------------|
| DynamoDB (on-demand) | 1M reads, 100K writes | ~$1.50 |
| Lambda (report_engine) | 100K invocations, 512MB | ~$2.50 |
| Lambda Layer | Storage only | ~$0.01 |
| S3 (report exports) | 10GB storage, 1K requests | ~$0.25 |
| CloudWatch Logs | 1GB ingestion, 30-day retention | ~$0.50 |
| API Gateway | 100K requests | ~$0.35 |
| **Total** | | **~$5.11/month** |

**One-time deployment cost:** ~$0.50 (Lambda layer upload, Terraform state)

---

## Next Steps After Deployment

1. ✅ **Test Integration**: Run test events to verify Lambda + DynamoDB + S3
2. ✅ **Frontend Testing**: Open phase3a-portal, test Analytics dashboard
3. ✅ **Performance Testing**: Generate reports with large datasets
4. ✅ **Export Testing**: Test all 4 export formats (CSV, JSON, PDF, Excel)
5. ✅ **Monitoring Setup**: Create CloudWatch alarms for errors
6. ✅ **Documentation**: Update API docs with new endpoints
7. 📅 **Component 2 Planning**: Team Collaboration & RBAC (starts Feb 17)

---

**Deployment Status:** ⏸️ Ready to Deploy  
**Estimated Deployment Time:** 5-10 minutes  
**Required AWS Credentials:** ✅ Admin or PowerUser role
