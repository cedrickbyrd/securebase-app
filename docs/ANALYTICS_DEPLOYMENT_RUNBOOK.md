# Phase 4 Analytics - Deployment Runbook

**Version:** 1.0  
**Last Updated:** January 27, 2026  
**Component:** Advanced Analytics & Reporting  

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Steps](#deployment-steps)
4. [Validation & Testing](#validation--testing)
5. [Monitoring](#monitoring)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This runbook guides the deployment of Phase 4 Advanced Analytics component to AWS production environment. The deployment includes:

- **4 Lambda Functions**: analytics_aggregator, analytics_reporter, analytics_query, report_engine
- **4 DynamoDB Tables**: metrics, reports, schedules, cache
- **1 S3 Bucket**: Report exports storage
- **4 API Gateway Routes**: /analytics/usage, /analytics/compliance, /analytics/costs, /analytics/reports
- **1 CloudWatch Dashboard**: Analytics monitoring
- **7 CloudWatch Alarms**: Error rate, latency, throttling, etc.

**Estimated Deployment Time:** 15-20 minutes  
**Downtime Required:** None (blue/green deployment)

---

## Prerequisites

### Required Access

- [ ] AWS Admin or PowerUser role
- [ ] GitHub repository write access
- [ ] Access to AWS Secrets Manager for API keys

### Required Tools

```bash
# Verify all tools are installed
aws --version          # AWS CLI v2.x
terraform --version    # Terraform 1.6+
python3 --version      # Python 3.11
zip --version          # zip utility
```

### Environment Variables

```bash
export AWS_PROFILE=securebase-prod
export AWS_REGION=us-east-1
export ENVIRONMENT=production  # or staging/dev
```

### Pre-Deployment Checklist

- [ ] Review PHASE4_STATUS.md for component status
- [ ] Ensure Phase 2 backend is deployed and operational
- [ ] Verify API Gateway exists and is accessible
- [ ] Confirm DynamoDB capacity settings
- [ ] Review Terraform state in S3
- [ ] Backup current Lambda function versions
- [ ] Review CloudWatch alarm thresholds

---

## Deployment Steps

### Option 1: Automated Deployment (Recommended)

Use the automated deployment script:

```bash
cd /path/to/securebase-app

# Deploy to dev environment
./scripts/deploy_analytics.sh dev us-east-1

# Deploy to staging environment
./scripts/deploy_analytics.sh staging us-east-1

# Deploy to production environment
./scripts/deploy_analytics.sh production us-east-1
```

The script will:
1. ✅ Validate AWS credentials
2. 📦 Package all Lambda functions
3. 🔨 Build Lambda layer (ReportLab + openpyxl)
4. ☁️  Publish layer to AWS
5. 📝 Configure Terraform variables
6. 🏗️  Deploy infrastructure via Terraform
7. ✅ Validate deployment
8. 📊 Display summary

### Option 2: Manual Deployment

#### Step 1: Package Lambda Functions

```bash
cd phase2-backend/functions
mkdir -p ../deploy

# Package each function
zip ../deploy/analytics_aggregator.zip analytics_aggregator.py
zip ../deploy/analytics_reporter.zip analytics_reporter.py
zip ../deploy/analytics_query.zip analytics_query.py
zip ../deploy/report_engine.zip report_engine.py
```

#### Step 2: Build Lambda Layer

```bash
cd phase2-backend/layers/reporting

# Install dependencies
rm -rf python
mkdir -p python/lib/python3.11/site-packages
pip install -r requirements.txt -t python/lib/python3.11/site-packages

# Create layer zip
zip -r reporting-layer.zip python/

# Publish to AWS
aws lambda publish-layer-version \
  --layer-name securebase-prod-reporting \
  --description "ReportLab + openpyxl for analytics" \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1
```

**Save the Layer ARN** from the output!

#### Step 3: Configure Terraform

```bash
cd landing-zone/environments/production

# Edit terraform.tfvars
cat >> terraform.tfvars <<EOF

# Phase 4 Analytics
reporting_layer_arn = "arn:aws:lambda:us-east-1:123456789:layer:securebase-prod-reporting:1"
EOF
```

#### Step 4: Deploy Infrastructure

```bash
# Initialize Terraform
terraform init -upgrade

# Review changes
terraform plan -out=analytics.tfplan

# Apply changes
terraform apply analytics.tfplan
```

#### Step 5: Verify Deployment

```bash
# Check Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `analytics`)].FunctionName'

# Check DynamoDB tables
aws dynamodb list-tables --query 'TableNames[?contains(@, `securebase-prod`)]'

# Check API Gateway endpoints
aws apigatewayv2 get-routes --api-id <api-id> --query 'Items[?contains(RouteKey, `analytics`)].RouteKey'
```

---

## Validation & Testing

### Smoke Tests

```bash
# Set variables
API_URL="https://api.securebase.example.com"
API_KEY="your-api-key"

# Test usage analytics endpoint
curl -X GET "$API_URL/analytics/usage?period=7d" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json"

# Expected: 200 OK with JSON response

# Test compliance analytics endpoint
curl -X GET "$API_URL/analytics/compliance" \
  -H "X-API-Key: $API_KEY"

# Expected: 200 OK with compliance score

# Test cost analytics endpoint
curl -X GET "$API_URL/analytics/costs?breakdown=service" \
  -H "X-API-Key: $API_KEY"

# Expected: 200 OK with cost breakdown
```

### Integration Tests

```bash
cd tests/integration

# Run analytics integration tests
pytest test_analytics_integration.py -v

# Expected: All tests pass (30+ tests)
```

### E2E Tests

```bash
cd tests/e2e

# Set environment variables
export RUN_E2E_TESTS=1
export API_BASE_URL="https://api.securebase.example.com"
export TEST_API_KEY="test-api-key"
export TEST_CUSTOMER_ID="test-customer-id"

# Run E2E tests
pytest test_analytics_e2e.py -v

# Expected: All workflows pass
```

### Load Tests

```bash
# Run 100 concurrent requests test
pytest tests/e2e/test_analytics_e2e.py::TestPerformance::test_load_test_100_concurrent_requests -v

# Expected:
# - Success rate >= 95%
# - P95 latency < 500ms
```

### Performance Validation

```bash
# Check Lambda function durations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=securebase-prod-analytics-query \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average,Maximum \
  --query 'Datapoints[0].[Average,Maximum]' \
  --output table

# Expected: Average < 300ms, Maximum < 500ms
```

---

## Monitoring

### CloudWatch Dashboard

Access the analytics dashboard:

```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-production-analytics
```

**Key Metrics to Monitor:**

- Lambda Invocations (should be > 0 after 1 hour)
- Lambda Errors (should be 0)
- Lambda Duration (should be < 500ms p95)
- DynamoDB Consumed Capacity (should be stable)
- API Gateway Latency (should be < 500ms)
- S3 Object Count (should increase with reports)

### CloudWatch Alarms

**7 alarms configured:**

1. **analytics-lambda-errors** - Errors > 5/hour
2. **analytics-lambda-duration** - Duration > 1 second
3. **analytics-lambda-throttles** - Any throttling
4. **analytics-dynamodb-throttles** - DynamoDB errors > 5/5min
5. **analytics-api-5xx** - 5XX errors > 10/5min
6. **analytics-api-latency** - Latency > 500ms
7. **analytics-failed-reports** - Failed reports > 3/hour

**SNS Notifications:**

Subscribe to alerts:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789:securebase-production-analytics-alerts \
  --protocol email \
  --notification-endpoint ops@securebase.example.com
```

### Log Monitoring

```bash
# Tail analytics query logs
aws logs tail /aws/lambda/securebase-production-analytics-query --follow

# Search for errors in last hour
aws logs filter-log-events \
  --log-group-name /aws/lambda/securebase-production-analytics-query \
  --start-time $(($(date +%s) - 3600))000 \
  --filter-pattern "ERROR"
```

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

API_URL="https://api.securebase.example.com"

for endpoint in usage compliance costs; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $API_KEY" "$API_URL/analytics/$endpoint")
  
  if [ "$STATUS" = "200" ]; then
    echo "✓ /analytics/$endpoint: OK"
  else
    echo "✗ /analytics/$endpoint: HTTP $STATUS"
  fi
done
```

---

## Rollback Procedures

### Immediate Rollback (Lambda Functions Only)

```bash
# Rollback to previous Lambda versions
for FUNCTION in analytics-aggregator analytics-reporter analytics-query report-engine; do
  PREV_VERSION=$(aws lambda list-versions-by-function \
    --function-name securebase-production-$FUNCTION \
    --query 'Versions[-2].Version' \
    --output text)
  
  aws lambda update-alias \
    --function-name securebase-production-$FUNCTION \
    --name LIVE \
    --function-version $PREV_VERSION
  
  echo "Rolled back $FUNCTION to version $PREV_VERSION"
done
```

### Complete Rollback (Infrastructure)

```bash
cd landing-zone/environments/production

# Get previous Terraform state
terraform state pull > current-state.json

# Rollback to previous version (if using versioned backend)
# This requires Terraform state versioning enabled in S3

# Alternative: Destroy analytics resources
terraform destroy -target=module.analytics

# Then re-deploy previous version
git checkout <previous-commit>
terraform apply
```

### Rollback Triggers

Initiate rollback if:

- Error rate > 5% for 15 minutes
- Query latency > 2 seconds for 10 minutes  
- Data accuracy issues detected
- Customer-reported critical bugs
- More than 3 CloudWatch alarms in ALARM state

---

## Troubleshooting

### Common Issues

#### 1. Lambda Function Not Found

**Symptom:** `Function not found: securebase-prod-analytics-*`

**Solution:**
```bash
# Verify function was deployed
cd landing-zone/environments/production
terraform state list | grep lambda

# If missing, re-run deployment
terraform apply -target=module.analytics.aws_lambda_function.analytics_query
```

#### 2. DynamoDB Throttling

**Symptom:** CloudWatch alarm `analytics-dynamodb-throttles` in ALARM state

**Solution:**
```bash
# Check consumed capacity
aws dynamodb describe-table --table-name securebase-prod-metrics \
  --query 'Table.BillingModeSummary'

# If PAY_PER_REQUEST, throttling should not occur
# If PROVISIONED, increase capacity:
aws dynamodb update-table \
  --table-name securebase-prod-metrics \
  --provisioned-throughput ReadCapacityUnits=50,WriteCapacityUnits=50
```

#### 3. API Gateway 403 Forbidden

**Symptom:** API calls return 403

**Solution:**
```bash
# Verify API key is valid
aws apigateway get-api-keys --include-values

# Verify Lambda permissions for API Gateway
aws lambda get-policy --function-name securebase-prod-analytics-query

# Add permission if missing
aws lambda add-permission \
  --function-name securebase-prod-analytics-query \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:123456789:*"
```

#### 4. Reports Not Generating

**Symptom:** POST /analytics/reports returns 500

**Solution:**
```bash
# Check Lambda layer is attached
aws lambda get-function --function-name securebase-prod-analytics-reporter \
  --query 'Configuration.Layers'

# If missing, add layer
aws lambda update-function-configuration \
  --function-name securebase-prod-analytics-reporter \
  --layers arn:aws:lambda:us-east-1:123456789:layer:securebase-prod-reporting:1

# Check S3 bucket permissions
aws s3api get-bucket-policy --bucket securebase-prod-reports-123456789
```

#### 5. Metrics Not Aggregating

**Symptom:** Metrics table is empty, no data in dashboard

**Solution:**
```bash
# Check aggregator EventBridge rule
aws events list-rules --name-prefix securebase-prod-analytics-aggregator

# Manually invoke aggregator
aws lambda invoke \
  --function-name securebase-prod-analytics-aggregator \
  --payload '{"source":"aws.events"}' \
  output.json

# Check logs
aws logs tail /aws/lambda/securebase-prod-analytics-aggregator --follow
```

### Debug Mode

Enable debug logging:

```bash
# Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name securebase-prod-analytics-query \
  --environment Variables={LOG_LEVEL=DEBUG,...}

# Verify logs show DEBUG messages
aws logs tail /aws/lambda/securebase-prod-analytics-query --follow | grep DEBUG
```

### Support Contacts

- **Infrastructure Issues:** DevOps Team (devops@securebase.example.com)
- **Application Issues:** Backend Team (backend@securebase.example.com)
- **On-Call:** PagerDuty (analytics-oncall)
- **Slack:** #phase4-analytics-support

---

## Appendix

### A. API Endpoint Reference

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/analytics/usage` | GET | Usage metrics | JWT |
| `/analytics/compliance` | GET | Compliance score | JWT |
| `/analytics/costs` | GET | Cost breakdown | JWT |
| `/analytics/reports` | POST | Generate report | JWT |

### B. Lambda Function Reference

| Function | Runtime | Memory | Timeout | Trigger |
|----------|---------|--------|---------|---------|
| analytics-aggregator | Python 3.11 | 512MB | 60s | EventBridge (1h) |
| analytics-reporter | Python 3.11 | 512MB | 30s | API Gateway |
| analytics-query | Python 3.11 | 256MB | 10s | API Gateway |
| report-engine | Python 3.11 | 512MB | 30s | API Gateway |

### C. DynamoDB Table Reference

| Table | Keys | GSI | Billing | PITR |
|-------|------|-----|---------|------|
| metrics | customer_id, timestamp | ServiceIndex, RegionIndex | On-Demand | Yes |
| reports | customer_id, id | CreatedAtIndex | On-Demand | Yes |
| schedules | customer_id, schedule_id | NextRunIndex | On-Demand | Yes |
| cache | cache_key | - | On-Demand | No |

### D. CloudWatch Metrics Reference

```
AWS/Lambda
- Invocations (Count)
- Errors (Count)
- Duration (Milliseconds)
- Throttles (Count)

AWS/DynamoDB
- ConsumedReadCapacityUnits (Count)
- ConsumedWriteCapacityUnits (Count)
- UserErrors (Count)

AWS/ApiGateway
- Count (requests)
- 4XXError
- 5XXError
- Latency (Milliseconds)
```

---

**End of Deployment Runbook**  
For questions or issues, contact: DevOps Team (devops@securebase.example.com)
