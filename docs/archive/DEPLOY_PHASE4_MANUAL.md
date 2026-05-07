# Phase 4 Analytics - Manual Deployment Guide

**Date:** January 19, 2026  
**Status:** Ready for Manual Deployment  
**Components:** Lambda Layer + Lambda Function + Terraform

---

## 🎯 Quick Start

Since automated scripts are having terminal issues, follow these manual steps:

### Step 1: Build Lambda Layer (On Your Local Machine or EC2)

```bash
# Create layer structure
cd /workspaces/securebase-app/phase2-backend/layers/reporting
mkdir -p python/lib/python3.11/site-packages

# Install dependencies
pip install reportlab==4.0.7 openpyxl==3.1.2 Pillow==10.1.0 \
  -t python/lib/python3.11/site-packages

# Create zip
zip -r reporting-layer.zip python/

# Verify size (should be ~25-30MB)
ls -lh reporting-layer.zip
```

**Expected Output:**
```
reporting-layer.zip    28M
```

### Step 2: Publish Lambda Layer to AWS

```bash
aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --description "ReportLab + openpyxl for Phase 4 Analytics" \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1
```

**Expected Output:**
```json
{
    "LayerArn": "arn:aws:lambda:us-east-1:123456789012:layer:securebase-dev-reporting",
    "LayerVersionArn": "arn:aws:lambda:us-east-1:123456789012:layer:securebase-dev-reporting:1",
    "Version": 1,
    "CompatibleRuntimes": ["python3.11"],
    "CreatedDate": "2026-01-19T..."
}
```

**Copy the `LayerVersionArn` - you'll need it in Step 4**

---

### Step 3: Package Lambda Function

```bash
cd /workspaces/securebase-app/phase2-backend/functions

# Create deployment directory
mkdir -p ../deploy

# Zip just the Python file (boto3 is included in Lambda runtime)
zip -j ../deploy/report_engine.zip report_engine.py

# Verify
ls -lh ../deploy/report_engine.zip
```

**Expected Output:**
```
report_engine.zip    15K
```

---

### Step 4: Update Terraform Variables

Edit `/workspaces/securebase-app/landing-zone/terraform.tfvars`:

```hcl
# Add this line with your Layer ARN from Step 2
reporting_layer_arn = "arn:aws:lambda:us-east-1:123456789012:layer:securebase-dev-reporting:1"
```

If `terraform.tfvars` doesn't exist, create it:

```bash
cd /workspaces/securebase-app/landing-zone

cat > terraform.tfvars <<EOF
# Environment Configuration
environment = "dev"
target_region = "us-east-1"

# Organization Settings
org_name = "SecureBase-Dev"

# Phase 4: Analytics Lambda Layer
reporting_layer_arn = "arn:aws:lambda:us-east-1:YOUR_ACCOUNT:layer:securebase-dev-reporting:1"

# Tags
tags = {
  Project     = "SecureBase"
  Environment = "dev"
  ManagedBy   = "Terraform"
  Phase       = "4"
}
EOF
```

---

### Step 5: Deploy with Terraform

```bash
cd /workspaces/securebase-app/landing-zone

# Initialize (if not already done)
terraform init

# Plan
terraform plan -out=phase4.tfplan

# Review the plan - should show:
# - 4 DynamoDB tables to be created
# - 1 S3 bucket to be created
# - 1 Lambda function to be created
# - 1 IAM role to be created
# - 4 API Gateway routes to be created

# Apply
terraform apply phase4.tfplan
```

**Expected Resources:**
```
Plan: 15 to add, 0 to change, 0 to destroy.

+ module.analytics.aws_dynamodb_table.reports
+ module.analytics.aws_dynamodb_table.report_schedules
+ module.analytics.aws_dynamodb_table.report_cache
+ module.analytics.aws_dynamodb_table.metrics
+ module.analytics.aws_s3_bucket.reports
+ module.analytics.aws_lambda_function.report_engine
+ module.analytics.aws_iam_role.report_engine
+ module.api_gateway.aws_api_gateway_resource.analytics
+ module.api_gateway.aws_api_gateway_method.analytics_get
+ module.api_gateway.aws_api_gateway_method.analytics_export
...
```

---

### Step 6: Verify Deployment

```bash
# Get API endpoint
terraform output api_gateway_endpoint

# Check Lambda function
aws lambda get-function \
  --function-name securebase-dev-report-engine \
  --region us-east-1

# Check DynamoDB tables
aws dynamodb list-tables --region us-east-1 | grep securebase-dev

# Check S3 bucket
aws s3 ls | grep securebase-dev-reports
```

---

## 🧪 Testing

### Test 1: Lambda Function Direct Invoke

```bash
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --region us-east-1 \
  --payload '{"httpMethod":"GET","path":"/analytics","queryStringParameters":{"dateRange":"30d"}}' \
  response.json

cat response.json
```

### Test 2: API Gateway Endpoint

```bash
# Get endpoint
API_URL=$(cd landing-zone && terraform output -raw api_gateway_endpoint)

# Test GET /analytics (requires JWT)
curl -X GET "$API_URL/analytics?dateRange=30d&dimension=service" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Test export (CSV)
curl -X POST "$API_URL/analytics" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "name": "test-report",
    "data": [
      {"service": "EC2", "cost": 1234.56, "region": "us-east-1"},
      {"service": "S3", "cost": 567.89, "region": "us-east-1"}
    ]
  }' \
  -o test-report.csv

# Verify CSV
cat test-report.csv
```

### Test 3: Frontend Integration

```bash
# Install dependencies (if not done)
cd /workspaces/securebase-app/phase3a-portal
npm install --legacy-peer-deps

# Start dev server
npm run dev

# Open browser: http://localhost:5173
# Login and navigate to Analytics tab
# Test: Create custom report, export CSV/PDF/Excel
```

---

## 📊 Post-Deployment Verification Checklist

- [ ] Lambda function created: `securebase-dev-report-engine`
- [ ] Lambda layer attached with version
- [ ] DynamoDB tables created (4 tables)
- [ ] S3 bucket created for report exports
- [ ] API Gateway routes configured (/analytics, /analytics/reports)
- [ ] IAM role has DynamoDB + S3 permissions
- [ ] CloudWatch Logs group created
- [ ] Lambda function invokes successfully
- [ ] API endpoints return 200 OK (with valid JWT)
- [ ] CSV export works
- [ ] PDF export works (or HTML fallback)
- [ ] Frontend connects to API

---

## 🐛 Troubleshooting

### Issue: Lambda Layer Too Large
**Symptom:** Layer exceeds 50MB limit  
**Solution:** 
```bash
# Exclude unnecessary files
cd python/lib/python3.11/site-packages
rm -rf *.dist-info __pycache__ tests
zip -r ../../reporting-layer-optimized.zip .
```

### Issue: Permission Denied Errors
**Symptom:** Lambda can't write to DynamoDB/S3  
**Solution:** Check IAM role in `landing-zone/modules/analytics/lambda.tf`
```bash
aws iam get-role-policy \
  --role-name securebase-dev-report-engine-role \
  --policy-name report-engine-permissions
```

### Issue: API Returns 403 Forbidden
**Symptom:** API calls fail with 403  
**Solution:** JWT token invalid or authorizer not configured
```bash
# Check authorizer
aws apigatewayv2 get-authorizers --api-id YOUR_API_ID

# Generate valid JWT token from auth Lambda
```

### Issue: PDF Export Fails
**Symptom:** "ReportLab not available" error  
**Solution:** Layer not attached or wrong version
```bash
# Check layer
aws lambda get-function-configuration \
  --function-name securebase-dev-report-engine \
  --query 'Layers[*].Arn'

# Update if needed
aws lambda update-function-configuration \
  --function-name securebase-dev-report-engine \
  --layers arn:aws:lambda:us-east-1:ACCOUNT:layer:securebase-dev-reporting:1
```

---

## 💰 Cost Tracking

After deployment, monitor costs:

```bash
# Check Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=securebase-dev-report-engine \
  --start-time 2026-01-19T00:00:00Z \
  --end-time 2026-01-20T00:00:00Z \
  --period 3600 \
  --statistics Sum

# Check DynamoDB consumed capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=securebase-dev-reports \
  --start-time 2026-01-19T00:00:00Z \
  --end-time 2026-01-20T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

---

## 📚 Reference

- Lambda Layer Size Limit: 50MB (unzipped: 250MB)
- Lambda Function Size Limit: 50MB (zipped), 250MB (unzipped)
- Lambda Timeout: 30 seconds (configurable)
- DynamoDB Billing: PAY_PER_REQUEST (on-demand)
- S3 Lifecycle: 90 days

---

**Next:** Once deployed and tested, proceed to Component 2 (Team Collaboration - RBAC)

**Status:** ✅ Ready for manual deployment  
**Estimated Time:** 15-20 minutes  
**Difficulty:** Medium (requires AWS CLI configured)
