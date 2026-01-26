# Notification System Deployment Guide

**Version:** 1.0  
**Last Updated:** 2026-01-26  
**Component:** Phase 4 Component 3 - Notifications & Alerting System

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Deployment](#infrastructure-deployment)
3. [Lambda Deployment](#lambda-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Verification](#verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Access

- AWS Console access with administrator privileges
- Terraform installed (v1.5+)
- AWS CLI configured
- Git repository access
- SES production access (request via AWS Support if needed)

### Environment Variables

Ensure the following are configured:

```bash
export AWS_REGION=us-east-1
export ENVIRONMENT=dev  # or staging, prod
export SES_FROM_EMAIL=notifications@securebase.io
```

### Pre-Deployment Checklist

- [ ] Phase 2 backend deployed
- [ ] Phase 3a portal deployed
- [ ] SES production access granted
- [ ] SNS SMS quota increased (if using SMS)
- [ ] KMS key created for encryption
- [ ] CloudWatch dashboards created

---

## Infrastructure Deployment

### Step 1: Package Lambda Functions

```bash
cd /home/runner/work/securebase-app/securebase-app/phase2-backend/functions

# Package notification_worker.py
zip -r notification_worker.zip notification_worker.py
echo "notification_worker.zip size: $(ls -lh notification_worker.zip | awk '{print $5}')"

# Package notification_api.py
zip -r notification_api.zip notification_api.py
echo "notification_api.zip size: $(ls -lh notification_api.zip | awk '{print $5}')"

# Copy to deployment directory
mkdir -p ../deploy
cp notification_worker.zip ../deploy/
cp notification_api.zip ../deploy/
```

**Expected Output:**
```
notification_worker.zip size: 6.2K
notification_api.zip size: 5.8K
```

### Step 2: Deploy Terraform Infrastructure

```bash
cd /home/runner/work/securebase-app/securebase-app/landing-zone/environments/dev

# Initialize Terraform (if not already done)
terraform init

# Validate configuration
terraform validate

# Plan deployment (review changes)
terraform plan -target=module.notifications -out=notifications.tfplan

# Review the plan output carefully
# Look for:
# - SNS topic creation
# - SQS queue + DLQ creation
# - 3 DynamoDB tables (notifications, subscriptions, templates)
# - 2 Lambda functions (worker, API)
# - IAM roles and policies
# - CloudWatch log groups and alarms

# Apply the plan
terraform apply notifications.tfplan
```

**Expected Resources:**
- 1 SNS topic (existing from Phase 3b)
- 2 SQS queues (main + DLQ)
- 3 DynamoDB tables
- 2 Lambda functions
- 2 IAM roles
- 2 CloudWatch log groups
- 3 CloudWatch alarms
- Various IAM policies

### Step 3: Upload Lambda Code

The placeholder.zip files were deployed via Terraform. Now update with actual code:

```bash
cd /home/runner/work/securebase-app/securebase-app/phase2-backend/deploy

# Update notification_worker Lambda
aws lambda update-function-code \
  --function-name securebase-dev-notification-worker \
  --zip-file fileb://notification_worker.zip \
  --region us-east-1

# Wait for update to complete
aws lambda wait function-updated \
  --function-name securebase-dev-notification-worker \
  --region us-east-1

# Update notification_api Lambda
aws lambda update-function-code \
  --function-name securebase-dev-notification-api \
  --zip-file fileb://notification_api.zip \
  --region us-east-1

# Wait for update to complete
aws lambda wait function-updated \
  --function-name securebase-dev-notification-api \
  --region us-east-1
```

### Step 4: Verify Lambda Deployment

```bash
# Check worker function
aws lambda get-function \
  --function-name securebase-dev-notification-worker \
  --region us-east-1 \
  --query 'Configuration.[FunctionName,Runtime,MemorySize,Timeout,LastModified]' \
  --output table

# Check API function
aws lambda get-function \
  --function-name securebase-dev-notification-api \
  --region us-east-1 \
  --query 'Configuration.[FunctionName,Runtime,MemorySize,Timeout,LastModified]' \
  --output table
```

**Expected Output:**
```
-------------------------------------------------
|                  GetFunction                  |
+-----------------------------------------------+
|  securebase-dev-notification-worker           |
|  python3.11                                   |
|  512                                          |
|  30                                           |
|  2026-01-26T18:00:00.000+0000                |
+-----------------------------------------------+
```

### Step 5: Initialize DynamoDB Data

Create default notification templates and test subscriptions:

```bash
# Create default templates
aws dynamodb put-item \
  --table-name securebase-dev-templates \
  --item '{
    "customer_id": {"S": "default"},
    "event_type": {"S": "security_alert"},
    "subject": {"S": "[{{priority}}] Security Alert: {{title}}"},
    "body_html": {"S": "<h2>{{title}}</h2><p>{{body}}</p>"},
    "body_text": {"S": "{{title}}\n\n{{body}}"}
  }' \
  --region us-east-1

# Repeat for other event types (billing, compliance, system, informational)

# Create test subscription
aws dynamodb put-item \
  --table-name securebase-dev-subscriptions \
  --item '{
    "customer_id": {"S": "test-customer-id"},
    "user_id": {"S": "test-user-id"},
    "email": {"S": "test@example.com"},
    "phone_number": {"S": "+14155551234"},
    "subscriptions": {"M": {
      "security_alert": {"M": {
        "email": {"BOOL": true},
        "sms": {"BOOL": true},
        "in_app": {"BOOL": true}
      }}
    }}
  }' \
  --region us-east-1
```

---

## Lambda Deployment

### Build with Dependencies

If Lambda functions require external dependencies (e.g., boto3, requests):

```bash
cd /home/runner/work/securebase-app/securebase-app/phase2-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt -t functions/package/

# Package with dependencies
cd functions/package
zip -r ../notification_worker_with_deps.zip .
cd ..
zip -g notification_worker_with_deps.zip notification_worker.py

# Deploy
aws lambda update-function-code \
  --function-name securebase-dev-notification-worker \
  --zip-file fileb://notification_worker_with_deps.zip
```

### Lambda Layer (Alternative)

For shared dependencies:

```bash
# Create layer directory structure
mkdir -p layer/python
pip install boto3 requests -t layer/python/

# Package layer
cd layer
zip -r notification_deps.zip python/

# Publish layer
aws lambda publish-layer-version \
  --layer-name notification-dependencies \
  --zip-file fileb://notification_deps.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1

# Attach layer to functions
aws lambda update-function-configuration \
  --function-name securebase-dev-notification-worker \
  --layers arn:aws:lambda:us-east-1:123456789012:layer:notification-dependencies:1
```

---

## Frontend Deployment

### Build Portal

```bash
cd /home/runner/work/securebase-app/securebase-app/phase3a-portal

# Install dependencies (if not already done)
npm install

# Set API base URL
export VITE_API_BASE_URL=https://api.securebase.aws

# Build production bundle
npm run build

# Verify build
ls -lh dist/
```

### Deploy to S3 + CloudFront

```bash
# Sync to S3 bucket
aws s3 sync dist/ s3://securebase-portal-dev/ \
  --delete \
  --region us-east-1

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### Verify Deployment

```bash
# Check S3 upload
aws s3 ls s3://securebase-portal-dev/ --recursive | grep -E "(index.html|NotificationCenter)"

# Check CloudFront distribution
aws cloudfront get-distribution \
  --id E1234567890ABC \
  --query 'Distribution.Status'
```

---

## Verification

### 1. Test SNS → SQS Flow

```bash
# Publish test message to SNS
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:123456789012:securebase-dev-notifications \
  --message '{
    "id": "test-123",
    "customer_id": "test-customer-id",
    "user_id": "test-user-id",
    "type": "test",
    "priority": "low",
    "title": "Test Notification",
    "body": "This is a test",
    "channels": ["in_app"],
    "created_at": "2026-01-26T18:00:00Z"
  }' \
  --region us-east-1

# Verify message in SQS (should be 0 after Lambda processes it)
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/securebase-dev-notifications-queue \
  --attribute-names ApproximateNumberOfMessages \
  --region us-east-1
```

**Expected:** ApproximateNumberOfMessages = 0 (processed by Lambda)

### 2. Test Worker Lambda

```bash
# Check Lambda logs
aws logs tail /aws/lambda/securebase-dev-notification-worker \
  --follow \
  --region us-east-1
```

**Expected Output:**
```
Successfully processed notification: test-123
Notification stored in DynamoDB: test-123
```

### 3. Test API Lambda

```bash
# Invoke API endpoint
curl -X GET "https://api.securebase.aws/notifications?user_id=test-user-id&limit=10" \
  -H "Authorization: Bearer test-token"
```

**Expected Response:**
```json
{
  "notifications": [
    {
      "id": "test-123",
      "title": "Test Notification",
      "body": "This is a test",
      ...
    }
  ],
  "unreadCount": 1
}
```

### 4. Test Frontend

```bash
# Open browser to portal
open https://portal.securebase.aws

# Or use curl
curl -I https://portal.securebase.aws
```

**Expected:** HTTP 200 OK

### 5. Check CloudWatch Alarms

```bash
# List alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix securebase-dev-notification \
  --region us-east-1 \
  --query 'MetricAlarms[*].[AlarmName,StateValue]' \
  --output table
```

**Expected:** All alarms in OK state

---

## Rollback Procedures

### Rollback Triggers

- Delivery success rate <90%
- Lambda error rate >5%
- DLQ depth >100 messages
- Customer complaints

### Rollback Steps

#### 1. Revert Lambda Functions

```bash
# List function versions
aws lambda list-versions-by-function \
  --function-name securebase-dev-notification-worker \
  --region us-east-1

# Revert to previous version (e.g., version 3)
aws lambda update-function-configuration \
  --function-name securebase-dev-notification-worker \
  --environment "Variables={LAMBDA_VERSION=3}"

# Or publish new version with old code
aws lambda update-function-code \
  --function-name securebase-dev-notification-worker \
  --s3-bucket securebase-lambda-code \
  --s3-key notification_worker_v3.zip
```

#### 2. Pause SNS → SQS Subscription

```bash
# Disable SQS subscription
aws sns unsubscribe \
  --subscription-arn arn:aws:sns:us-east-1:123456789012:securebase-dev-notifications:abc123 \
  --region us-east-1

# Or set filter policy to drop all messages
aws sns set-subscription-attributes \
  --subscription-arn arn:aws:sns:us-east-1:123456789012:securebase-dev-notifications:abc123 \
  --attribute-name FilterPolicy \
  --attribute-value '{"type": ["DISABLED"]}'
```

#### 3. Revert Frontend

```bash
# Restore previous S3 version
aws s3 sync s3://securebase-portal-backups/v1.2.3/ s3://securebase-portal-dev/ \
  --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

#### 4. Monitor DLQ

```bash
# Check DLQ for failed messages
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/securebase-dev-notifications-dlq \
  --max-number-of-messages 10 \
  --region us-east-1

# Manually process critical messages
# (Extract message body and re-publish to SNS)
```

---

## Troubleshooting

### Issue: Lambda Function Not Triggered

**Symptoms:**
- Messages stuck in SQS
- Lambda invocation count = 0

**Diagnosis:**
```bash
# Check SQS event source mapping
aws lambda list-event-source-mappings \
  --function-name securebase-dev-notification-worker

# Check Lambda permissions
aws lambda get-policy \
  --function-name securebase-dev-notification-worker
```

**Resolution:**
```bash
# Re-create event source mapping
aws lambda create-event-source-mapping \
  --function-name securebase-dev-notification-worker \
  --event-source-arn arn:aws:sqs:us-east-1:123456789012:securebase-dev-notifications-queue \
  --batch-size 10
```

### Issue: SES Emails Not Sending

**Symptoms:**
- Email delivery fails
- SES errors in Lambda logs

**Diagnosis:**
```bash
# Check SES sending limits
aws ses get-send-quota --region us-east-1

# Check SES domain verification
aws ses get-identity-verification-attributes \
  --identities securebase.io \
  --region us-east-1
```

**Resolution:**
1. Verify domain in SES
2. Move out of SES sandbox (request via AWS Support)
3. Configure DKIM and SPF records

### Issue: DynamoDB Throttling

**Symptoms:**
- High Lambda errors
- DynamoDB ProvisionedThroughputExceededException

**Diagnosis:**
```bash
# Check table metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value=securebase-dev-notifications \
  --start-time 2026-01-26T17:00:00Z \
  --end-time 2026-01-26T18:00:00Z \
  --period 300 \
  --statistics Sum
```

**Resolution:**
```bash
# Switch to on-demand billing (already configured)
# Or increase provisioned capacity (if using provisioned mode)
aws dynamodb update-table \
  --table-name securebase-dev-notifications \
  --billing-mode PAY_PER_REQUEST
```

---

## Post-Deployment Monitoring

### CloudWatch Dashboards

Create custom dashboard:

```bash
aws cloudwatch put-dashboard \
  --dashboard-name SecureBase-Notifications \
  --dashboard-body file://cloudwatch-dashboard.json
```

**Key Metrics to Monitor:**
- Lambda invocations (worker, API)
- Lambda errors
- Lambda duration (p50, p95, p99)
- SQS queue depth
- DLQ depth
- DynamoDB read/write capacity
- SES send rate
- SNS publish rate

### Alarms Setup

All alarms are already configured via Terraform:
- DLQ depth > 10 messages
- Lambda errors > 5 in 5 minutes
- SQS message age > 1 hour

---

## Support & Documentation

- **Architecture**: [NOTIFICATION_ARCHITECTURE.md](./NOTIFICATION_ARCHITECTURE.md)
- **API Reference**: [NOTIFICATION_API.md](./NOTIFICATION_API.md)
- **User Guide**: [NOTIFICATION_USER_GUIDE.md](./NOTIFICATION_USER_GUIDE.md)
- **Runbook**: [NOTIFICATION_RUNBOOK.md](./NOTIFICATION_RUNBOOK.md)

---

**Last Updated:** 2026-01-26  
**Version:** 1.0  
**Component:** Phase 4 Component 3 - Notifications & Alerting System
