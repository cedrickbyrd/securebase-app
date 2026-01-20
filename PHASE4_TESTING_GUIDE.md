# Phase 4 Component 1: Testing Guide
**Last Updated:** January 19, 2026  
**Component:** Advanced Analytics & Reporting  
**Status:** Ready for Testing

---

## 🧪 Quick Test

Run the automated test suite:

```bash
chmod +x TEST_PHASE4.sh && ./TEST_PHASE4.sh
```

This will test:
- ✅ Local file structure and syntax
- ✅ AWS deployment status
- ✅ Lambda function invocation
- ✅ DynamoDB tables
- ✅ S3 bucket
- ✅ Lambda layer

**Test duration:** ~30 seconds

---

## 📋 Test Categories

### 1. Pre-Deployment Tests (Local)

Run **before** deploying to AWS:

#### Check Files Exist
```bash
# Lambda function
test -f phase2-backend/functions/report_engine.py && echo "✓ Lambda function exists"

# Test events
test -d phase2-backend/functions/test-events && echo "✓ Test events exist"

# Terraform modules
test -d landing-zone/modules/analytics && echo "✓ Analytics module exists"

# Deployment scripts
test -f DEPLOY_PHASE4_NOW.sh && echo "✓ Deployment script exists"
```

#### Validate Python Syntax
```bash
cd phase2-backend/functions
python3 -m py_compile report_engine.py
echo "✓ Lambda function syntax valid"
```

#### Validate Test Events
```bash
cd phase2-backend/functions/test-events
python3 -m json.tool get-analytics.json > /dev/null && echo "✓ GET analytics event valid"
python3 -m json.tool export-csv.json > /dev/null && echo "✓ Export CSV event valid"
python3 -m json.tool list-reports.json > /dev/null && echo "✓ List reports event valid"
```

#### Validate Terraform
```bash
cd landing-zone
terraform init
terraform validate
echo "✓ Terraform configuration valid"
```

---

### 2. Deployment Tests

Run **during** deployment:

#### Build Lambda Package
```bash
cd phase2-backend/functions
bash package-lambda.sh

# Verify package created
test -f ../deploy/report_engine.zip && echo "✓ Lambda package created"
du -h ../deploy/report_engine.zip
```

#### Build Lambda Layer
```bash
cd phase2-backend/layers/reporting
bash build-layer.sh

# Verify layer created
test -f reporting-layer.zip && echo "✓ Lambda layer created"
du -h reporting-layer.zip
```

#### Terraform Plan
```bash
cd landing-zone
terraform plan -out=phase4.tfplan

# Review plan output for:
# - 4 DynamoDB tables to be created
# - 1 S3 bucket to be created
# - 1 Lambda function to be created
# - 1 IAM role to be created
# - 4 API Gateway routes to be created
```

---

### 3. Post-Deployment Tests (AWS)

Run **after** deploying to AWS:

#### Verify AWS Resources

**Check Lambda Function:**
```bash
aws lambda get-function \
  --function-name securebase-dev-report-engine \
  --region us-east-1

# Expected: Function details with Status: Active
```

**Check Lambda Layer:**
```bash
aws lambda list-layer-versions \
  --layer-name securebase-dev-reporting \
  --region us-east-1

# Expected: At least 1 layer version
```

**Check DynamoDB Tables:**
```bash
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `securebase-dev`)]' \
  --region us-east-1

# Expected: 4 tables
# - securebase-dev-reports
# - securebase-dev-report-schedules
# - securebase-dev-report-cache
# - securebase-dev-metrics
```

**Check S3 Bucket:**
```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3 ls s3://securebase-dev-report-exports-$ACCOUNT_ID

# Expected: Bucket exists (may be empty)
```

**Check API Gateway:**
```bash
cd landing-zone
terraform output api_endpoints

# Expected: Map of 4+ endpoints including /analytics
```

---

#### Test Lambda Invocation

**Test 1: GET Analytics (Empty Response)**
```bash
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://phase2-backend/functions/test-events/get-analytics.json \
  --region us-east-1 \
  output.json

cat output.json | jq .

# Expected:
# {
#   "statusCode": 200,
#   "body": "{\"data\": [], \"summary\": {...}}"
# }
```

**Test 2: Export CSV**
```bash
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://phase2-backend/functions/test-events/export-csv.json \
  --region us-east-1 \
  export-output.json

# Decode base64 CSV
cat export-output.json | jq -r '.body' | base64 -d > test-export.csv
cat test-export.csv

# Expected: CSV with headers and sample data
```

**Test 3: List Reports**
```bash
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://phase2-backend/functions/test-events/list-reports.json \
  --region us-east-1 \
  reports-output.json

cat reports-output.json | jq .

# Expected:
# {
#   "statusCode": 200,
#   "body": "{\"reports\": [], \"count\": 0}"
# }
```

---

#### Test API Gateway Endpoints

**Get JWT Token (if authentication enabled):**
```bash
# This assumes you have authentication set up
# Replace with your actual auth endpoint
TOKEN="your-jwt-token-here"
```

**Test Analytics Endpoint:**
```bash
cd landing-zone
API_ENDPOINT=$(terraform output -raw api_gateway_endpoint)

curl -X GET "${API_ENDPOINT}/analytics?customer_id=test-customer&start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Expected: 200 OK with analytics data
```

**Test Export Endpoint:**
```bash
curl -X POST "${API_ENDPOINT}/analytics" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "export",
    "format": "csv",
    "customer_id": "test-customer",
    "start_date": "2026-01-01",
    "end_date": "2026-01-31"
  }'

# Expected: 200 OK with base64-encoded CSV
```

---

### 4. Integration Tests

#### Test DynamoDB Write/Read
```bash
# Write a test report
aws dynamodb put-item \
  --table-name securebase-dev-reports \
  --region us-east-1 \
  --item '{
    "customer_id": {"S": "test-customer"},
    "id": {"S": "report-001"},
    "name": {"S": "Test Report"},
    "created_at": {"S": "2026-01-19T12:00:00Z"}
  }'

# Read it back
aws dynamodb get-item \
  --table-name securebase-dev-reports \
  --region us-east-1 \
  --key '{"customer_id": {"S": "test-customer"}, "id": {"S": "report-001"}}'

# Expected: Item returned with all fields
```

#### Test S3 Upload/Download
```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="securebase-dev-report-exports-$ACCOUNT_ID"

# Upload test file
echo "Test export content" > test-report.csv
aws s3 cp test-report.csv s3://$BUCKET/test/test-report.csv

# Download it back
aws s3 cp s3://$BUCKET/test/test-report.csv downloaded-report.csv

# Verify
diff test-report.csv downloaded-report.csv
echo "✓ S3 upload/download successful"

# Cleanup
aws s3 rm s3://$BUCKET/test/test-report.csv
rm test-report.csv downloaded-report.csv
```

---

### 5. Performance Tests

#### Lambda Cold Start
```bash
# Invoke Lambda after 5+ minutes of inactivity
time aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://phase2-backend/functions/test-events/get-analytics.json \
  --region us-east-1 \
  cold-start-output.json

# Expected: <2s total time (including cold start)
```

#### Lambda Warm Invocation
```bash
# Invoke immediately after previous call
time aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://phase2-backend/functions/test-events/get-analytics.json \
  --region us-east-1 \
  warm-output.json

# Expected: <500ms total time
```

#### Large Dataset Export
```bash
# Test with 1000 rows (modify test event)
cat > large-export-test.json << 'EOF'
{
  "httpMethod": "POST",
  "path": "/analytics",
  "body": "{\"action\":\"export\",\"format\":\"csv\",\"customer_id\":\"test-customer\",\"start_date\":\"2025-01-01\",\"end_date\":\"2026-01-31\"}"
}
EOF

time aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://large-export-test.json \
  --region us-east-1 \
  large-export-output.json

# Expected: <10s for CSV, <20s for PDF
```

---

### 6. Error Handling Tests

#### Invalid Input
```bash
# Test with missing customer_id
cat > error-test.json << 'EOF'
{
  "httpMethod": "GET",
  "path": "/analytics",
  "queryStringParameters": {
    "start_date": "2026-01-01"
  }
}
EOF

aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://error-test.json \
  --region us-east-1 \
  error-output.json

cat error-output.json | jq .

# Expected: 400 Bad Request with error message
```

#### Invalid Date Format
```bash
# Test with invalid date
cat > date-error-test.json << 'EOF'
{
  "httpMethod": "GET",
  "path": "/analytics",
  "queryStringParameters": {
    "customer_id": "test-customer",
    "start_date": "invalid-date"
  }
}
EOF

aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload file://date-error-test.json \
  --region us-east-1 \
  date-error-output.json

# Expected: 400 Bad Request
```

---

### 7. Monitoring & Logging Tests

#### View CloudWatch Logs
```bash
# Tail logs in real-time
aws logs tail /aws/lambda/securebase-dev-report-engine --follow

# View recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/securebase-dev-report-engine \
  --filter-pattern "ERROR" \
  --max-items 10

# View recent invocations
aws logs filter-log-events \
  --log-group-name /aws/lambda/securebase-dev-report-engine \
  --filter-pattern "START RequestId" \
  --max-items 10
```

#### Check Lambda Metrics
```bash
# Get invocation count (last hour)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=securebase-dev-report-engine \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# Get error count
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=securebase-dev-report-engine \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

---

## 🎯 Test Success Criteria

### Pre-Deployment
- [ ] All Python files have valid syntax
- [ ] All test events are valid JSON
- [ ] Terraform configuration validates
- [ ] Deployment scripts are executable

### Post-Deployment
- [ ] Lambda function deployed and active
- [ ] Lambda layer version exists
- [ ] All 4 DynamoDB tables created
- [ ] S3 bucket created with correct permissions
- [ ] API Gateway endpoints return 200/400 appropriately

### Integration
- [ ] Lambda invocation succeeds (GET analytics)
- [ ] CSV export generates valid file
- [ ] PDF export generates valid file
- [ ] DynamoDB read/write operations work
- [ ] S3 upload/download operations work

### Performance
- [ ] Lambda cold start <2s
- [ ] Lambda warm invocation <500ms
- [ ] CSV export (1000 rows) <10s
- [ ] PDF export (1000 rows) <20s

### Error Handling
- [ ] Missing parameters return 400 Bad Request
- [ ] Invalid dates return 400 Bad Request
- [ ] Errors logged to CloudWatch
- [ ] Error messages are descriptive

---

## 🐛 Troubleshooting

### Lambda Fails to Invoke

**Check IAM permissions:**
```bash
aws iam get-role-policy \
  --role-name securebase-dev-report-engine-role \
  --policy-name securebase-dev-report-engine-policy
```

**Check environment variables:**
```bash
aws lambda get-function-configuration \
  --function-name securebase-dev-report-engine \
  --query 'Environment.Variables'
```

### DynamoDB Access Denied

**Verify IAM policy allows DynamoDB access:**
```bash
# Should include dynamodb:GetItem, PutItem, Query, Scan
aws iam get-role-policy \
  --role-name securebase-dev-report-engine-role \
  --policy-name securebase-dev-report-engine-policy \
  | jq '.PolicyDocument.Statement[] | select(.Effect == "Allow" and .Action | contains(["dynamodb:"]))'
```

### S3 Upload Fails

**Check bucket policy:**
```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3api get-bucket-policy \
  --bucket securebase-dev-report-exports-$ACCOUNT_ID
```

**Verify Lambda role has S3 permissions:**
```bash
aws iam list-attached-role-policies \
  --role-name securebase-dev-report-engine-role
```

---

## 📊 Test Report Template

After running tests, document results:

```markdown
## Test Results: Phase 4 Component 1

**Date:** [Date]
**Tester:** [Name]
**Environment:** [dev/staging/prod]

### Pre-Deployment Tests
- [x] File structure verified
- [x] Python syntax validated
- [x] Terraform configuration valid

### Deployment Tests
- [x] Lambda package created (15KB)
- [x] Lambda layer created (28MB)
- [x] Terraform plan successful
- [x] Terraform apply successful

### Post-Deployment Tests
- [x] Lambda function active
- [x] Lambda layer version 1 published
- [x] DynamoDB tables created (4/4)
- [x] S3 bucket created
- [x] API Gateway endpoints configured (4/4)

### Integration Tests
- [x] Lambda GET analytics: 200 OK
- [x] Lambda export CSV: 200 OK (valid CSV)
- [x] Lambda export PDF: 200 OK (valid PDF)
- [x] DynamoDB read/write: SUCCESS
- [x] S3 upload/download: SUCCESS

### Performance Tests
- [x] Cold start: 1.8s ✓
- [x] Warm invocation: 320ms ✓
- [x] CSV export (1000 rows): 8.2s ✓
- [x] PDF export (100 rows): 12.5s ✓

### Error Handling Tests
- [x] Missing parameters: 400 Bad Request ✓
- [x] Invalid dates: 400 Bad Request ✓
- [x] Errors logged: ✓

### Issues Found
- None

### Overall Status
✅ All tests passed - Component 1 ready for production
```

---

**Test Status:** Ready to Run  
**Next Step:** Run `./TEST_PHASE4.sh` to execute full test suite
