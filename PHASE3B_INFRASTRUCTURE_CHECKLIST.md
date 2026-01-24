# Phase 3b Infrastructure Deployment Checklist

**Status:** Ready for Deployment  
**Last Updated:** January 23, 2026  
**Environment:** Development

---

## 📋 Overview

This checklist guides you through deploying Phase 3b infrastructure components to AWS. Phase 3b adds advanced features to SecureBase:
- **Support Ticket System** - Real-time customer support
- **Webhook Management** - Event-driven integrations  
- **Cost Forecasting** - ML-based cost predictions
- **Notifications** - Real-time alerts via SNS

---

## 🎯 Prerequisites

### AWS Environment
- [ ] AWS CLI configured with appropriate credentials
- [ ] Terraform 1.5+ installed
- [ ] Access to development AWS account
- [ ] VPC and subnets from Phase 1 deployed
- [ ] Phase 2 database infrastructure deployed

### Required Information
- [ ] AWS Account ID
- [ ] Target region (default: us-east-1)
- [ ] Environment name (dev, staging, prod)
- [ ] VPC ID
- [ ] Private subnet IDs
- [ ] Lambda security group ID

---

## 📦 Step 1: Package Lambda Functions

Package the Phase 3b Lambda functions for deployment:

```bash
# Navigate to functions directory
cd /home/runner/work/securebase-app/securebase-app/phase2-backend/functions

# Run packaging script
./package-phase3b.sh

# Verify packages were created
ls -lh ../deploy/phase3b/
```

**Expected Output:**
```
support_tickets.zip    (~2.5 MB)
webhook_manager.zip    (~2.8 MB)
cost_forecasting.zip   (~3.2 MB)
```

---

## 🗄️ Step 2: Review DynamoDB Tables

The following DynamoDB tables will be created:

### support_tickets
- **Purpose:** Store customer support tickets
- **Keys:** customer_id (HASH), id (RANGE)
- **GSI:** status-index, priority-index
- **TTL:** 90 days

### ticket_comments
- **Purpose:** Store comments on support tickets
- **Keys:** ticket_id (HASH), id (RANGE)
- **TTL:** 90 days

### notifications
- **Purpose:** Store customer notifications
- **Keys:** customer_id (HASH), id (RANGE)
- **GSI:** created_at-index
- **TTL:** 30 days

### cost_forecasts
- **Purpose:** Cache cost forecast calculations
- **Keys:** customer_id (HASH), period_month (RANGE)
- **TTL:** 90 days

---

## 🔔 Step 3: Review SNS Topics

The following SNS topics will be created:

- `securebase-{env}-notifications` - General notifications
- `securebase-{env}-support-events` - Support ticket events
- `securebase-{env}-webhook-events` - Webhook delivery events
- `securebase-{env}-cost-alerts` - Cost budget alerts

---

## ⚙️ Step 4: Terraform Deployment

### 4.1 Navigate to Environment Directory

```bash
cd /home/runner/work/securebase-app/securebase-app/landing-zone/environments/dev
```

### 4.2 Initialize Terraform (if needed)

```bash
terraform init
```

### 4.3 Review Planned Changes

```bash
terraform plan -out=phase3b.tfplan
```

**Expected Resources:**
- 4 DynamoDB tables (Phase 3b tables)
- 4 SNS topics
- 3 Lambda functions (support_tickets, webhook_manager, cost_forecasting)
- 3 CloudWatch log groups
- IAM policies updated for SNS and SES
- API Gateway routes (if webhooks module enabled)

### 4.4 Apply Infrastructure Changes

```bash
terraform apply phase3b.tfplan
```

**Deployment Time:** ~5-10 minutes

### 4.5 Verify Deployment

```bash
# Check DynamoDB tables
aws dynamodb list-tables --region us-east-1 | grep securebase

# Check Lambda functions
aws lambda list-functions --region us-east-1 | grep securebase

# Check SNS topics
aws sns list-topics --region us-east-1 | grep securebase

# View Terraform outputs
terraform output
```

---

## 🔌 Step 5: API Gateway Configuration

### 5.1 Create API Gateway Routes

Phase 3b requires the following API routes:

**Support Tickets:**
```
POST   /v1/support/tickets         → support_tickets Lambda
GET    /v1/support/tickets         → support_tickets Lambda
GET    /v1/support/tickets/{id}    → support_tickets Lambda
PUT    /v1/support/tickets/{id}    → support_tickets Lambda
POST   /v1/support/tickets/{id}/comments → support_tickets Lambda
GET    /v1/support/tickets/{id}/comments → support_tickets Lambda
```

**Webhooks:**
```
GET    /v1/webhooks                → webhook_manager Lambda
POST   /v1/webhooks                → webhook_manager Lambda
PUT    /v1/webhooks/{id}           → webhook_manager Lambda
DELETE /v1/webhooks/{id}           → webhook_manager Lambda
POST   /v1/webhooks/test           → webhook_manager Lambda
GET    /v1/webhooks/deliveries     → webhook_manager Lambda
```

**Cost Forecasting:**
```
GET    /v1/cost/forecast           → cost_forecasting Lambda
GET    /v1/cost/forecast/export    → cost_forecasting Lambda
POST   /v1/cost/budget-alert       → cost_forecasting Lambda
GET    /v1/cost/budget-alerts      → cost_forecasting Lambda
```

**Notifications:**
```
GET    /v1/notifications           → notifications Lambda (to be created)
PUT    /v1/notifications/{id}/read → notifications Lambda
PUT    /v1/notifications/read-all  → notifications Lambda
DELETE /v1/notifications/{id}      → notifications Lambda
```

### 5.2 Enable CORS

```bash
# Enable CORS for all Phase 3b endpoints
aws apigateway update-rest-api \
  --rest-api-id YOUR_API_ID \
  --patch-operations op=replace,path=/cors,value=true
```

### 5.3 Deploy API Stage

```bash
aws apigateway create-deployment \
  --rest-api-id YOUR_API_ID \
  --stage-name dev \
  --description "Phase 3b deployment"
```

---

## 📧 Step 6: Configure Email Service (SES)

### 6.1 Verify Email Domain (Production Only)

For production, verify your sending domain:

```bash
aws ses verify-domain-identity \
  --domain yourdomain.com \
  --region us-east-1
```

### 6.2 Configure Email Templates

Support tickets send email notifications. Configure templates:

```bash
# Create support ticket notification template
aws ses create-template \
  --template file://email-templates/support-ticket-created.json
```

### 6.3 Test Email Sending

```bash
# Send test email
aws ses send-email \
  --from support@yourdomain.com \
  --destination ToAddresses=test@example.com \
  --message Subject={Data=Test},Body={Text={Data="Test email from SecureBase"}}
```

---

## 🧪 Step 7: Testing

### 7.1 Test Support Tickets Lambda

```bash
# Create test ticket
aws lambda invoke \
  --function-name securebase-dev-support-tickets \
  --payload '{"httpMethod":"POST","path":"/support/tickets","body":"{\"subject\":\"Test ticket\",\"description\":\"Testing Phase 3b deployment\",\"priority\":\"medium\",\"category\":\"technical\"}"}' \
  response.json

# View response
cat response.json
```

### 7.2 Test Webhook Manager Lambda

```bash
# List webhooks (should return empty initially)
aws lambda invoke \
  --function-name securebase-dev-webhook-manager \
  --payload '{"httpMethod":"GET","path":"/webhooks"}' \
  response.json

cat response.json
```

### 7.3 Test Cost Forecasting Lambda

```bash
# Generate forecast
aws lambda invoke \
  --function-name securebase-dev-cost-forecasting \
  --payload '{"httpMethod":"GET","path":"/cost/forecast","queryStringParameters":{"months":"12","confidence_level":"medium"}}' \
  response.json

cat response.json
```

### 7.4 Test SNS Notification

```bash
# Publish test notification
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:securebase-dev-notifications \
  --message '{"type":"ticket","title":"Test Notification","message":"Testing Phase 3b SNS"}'
```

---

## 🔍 Step 8: Validation

### 8.1 Verify All Resources Deployed

```bash
# Count DynamoDB tables (should be 7+ total)
aws dynamodb list-tables | grep -c "securebase-dev"

# Count Lambda functions (should be 5+)
aws lambda list-functions | grep -c "securebase-dev"

# Count SNS topics (should be 4+)
aws sns list-topics | grep -c "securebase-dev"
```

### 8.2 Check CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/securebase-dev-support-tickets --follow
aws logs tail /aws/lambda/securebase-dev-webhook-manager --follow
aws logs tail /aws/lambda/securebase-dev-cost-forecasting --follow
```

### 8.3 Test End-to-End Flow

1. **Create Support Ticket:**
   - Send POST request to `/v1/support/tickets`
   - Verify ticket created in DynamoDB
   - Verify notification published to SNS
   - Verify email sent (if SES configured)

2. **Register Webhook:**
   - Send POST request to `/v1/webhooks`
   - Verify webhook stored in DynamoDB
   - Test webhook delivery

3. **Generate Cost Forecast:**
   - Send GET request to `/v1/cost/forecast`
   - Verify forecast cached in DynamoDB
   - Verify response includes forecast array

---

## 📊 Step 9: Monitoring Setup

### 9.1 Create CloudWatch Alarms

```bash
# Lambda errors alarm
aws cloudwatch put-metric-alarm \
  --alarm-name phase3b-lambda-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold

# DynamoDB throttle alarm
aws cloudwatch put-metric-alarm \
  --alarm-name phase3b-dynamodb-throttle \
  --metric-name ConsumedWriteCapacityUnits \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

### 9.2 Configure Metrics Dashboard

Create a CloudWatch dashboard to monitor Phase 3b:

- Lambda invocations and errors
- DynamoDB read/write capacity
- SNS publish counts
- API Gateway requests

---

## 🔄 Step 10: Frontend Integration

### 10.1 Update Environment Variables

In `phase3a-portal/.env`:

```bash
VITE_API_BASE_URL=https://api.securebase.dev
VITE_WEBSOCKET_URL=wss://ws.securebase.dev
```

### 10.2 Build and Deploy Portal

```bash
cd /home/runner/work/securebase-app/securebase-app/phase3a-portal

# Install dependencies
npm install

# Build production bundle
npm run build

# Deploy to CloudFront/S3
aws s3 sync dist/ s3://securebase-portal-dev/ --delete
aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
```

### 10.3 Test Frontend Features

1. Open portal in browser
2. Navigate to **Support** tab → Create test ticket
3. Navigate to **Webhooks** tab → Register test webhook
4. Navigate to **Forecasting** tab → Generate forecast
5. Check **Notifications** bell icon → Verify notifications appear

---

## ✅ Deployment Checklist

### Infrastructure
- [ ] DynamoDB tables created (4 tables)
- [ ] Lambda functions deployed (3 functions)
- [ ] SNS topics created (4 topics)
- [ ] IAM permissions updated
- [ ] CloudWatch log groups created
- [ ] API Gateway routes configured

### Configuration
- [ ] Environment variables set
- [ ] SES email verified (if production)
- [ ] CORS enabled on API Gateway
- [ ] Monitoring alarms configured

### Testing
- [ ] Support tickets CRUD operations work
- [ ] Webhooks registration and delivery work
- [ ] Cost forecasting generates predictions
- [ ] Notifications publish to SNS
- [ ] Email notifications send (if SES configured)

### Frontend
- [ ] Portal deployed with Phase 3b components
- [ ] All routes accessible
- [ ] API integration working
- [ ] WebSocket connection established

---

## 🚨 Rollback Procedure

If deployment fails or issues arise:

### 1. Identify Issue
```bash
# Check Terraform state
terraform show

# Check Lambda errors
aws logs filter-events \
  --log-group-name /aws/lambda/securebase-dev-support-tickets \
  --filter-pattern "ERROR"
```

### 2. Rollback Terraform
```bash
# Destroy Phase 3b resources only
terraform destroy -target=module.phase2_database.aws_dynamodb_table.support_tickets
terraform destroy -target=module.phase2_database.aws_dynamodb_table.ticket_comments
terraform destroy -target=module.phase2_database.aws_dynamodb_table.notifications
terraform destroy -target=module.phase2_database.aws_dynamodb_table.cost_forecasts
```

### 3. Notify Stakeholders
- Document the issue
- Notify development team
- Schedule retry deployment

---

## 📞 Support

**Issues or Questions?**
- Review logs in CloudWatch
- Check Terraform output for errors
- Consult `PHASE3B_DEPLOYMENT_GUIDE.md` for detailed steps
- Contact DevOps team for infrastructure issues

---

## 🎉 Success Criteria

Phase 3b deployment is successful when:

✅ All DynamoDB tables created and accessible  
✅ All Lambda functions deployed and invocable  
✅ SNS topics created and can publish messages  
✅ API Gateway routes respond correctly  
✅ Frontend portal displays all Phase 3b features  
✅ End-to-end flows work (create ticket → notification → email)  
✅ Monitoring alarms configured and active  

---

**Deployment Checklist Version:** 1.0  
**Created:** January 23, 2026  
**Environment:** Development  
**Status:** Ready for Deployment
