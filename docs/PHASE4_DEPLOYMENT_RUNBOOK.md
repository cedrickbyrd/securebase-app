# Phase 4 Infrastructure Deployment Runbook

**Purpose:** Step-by-step deployment guide for Phase 4 infrastructure  
**Audience:** DevOps engineers, SREs  
**Duration:** 30-45 minutes  
**Risk Level:** Low (infrastructure only, no data migration)

---

## Pre-Deployment Checklist

- [ ] Phase 1 (Landing Zone) is deployed and operational
- [ ] Phase 2 (Database & API) is deployed and operational
- [ ] AWS credentials configured with admin access
- [ ] Terraform >= 1.5 installed
- [ ] Git repository up to date
- [ ] Deployment window scheduled (recommend off-peak hours)
- [ ] Rollback plan reviewed
- [ ] Team notified of deployment

---

## Step 1: Pre-Deployment Validation

### 1.1 Verify Prerequisites

```bash
# Check Terraform version
terraform version
# Expected: Terraform v1.5.x or higher

# Check AWS credentials
aws sts get-caller-identity
# Expected: Valid account ID returned

# Verify Phase 2 is deployed
cd landing-zone/environments/dev
terraform output | grep phase2
# Expected: database_endpoint, rds_proxy_endpoint outputs present
```

### 1.2 Run Infrastructure Tests

```bash
# From repository root
./test-phase4-infrastructure.sh

# Expected output:
# ================================
# Test Summary
# ================================
# Total Tests:  10
# Passed:       10
# Failed:       0
#
# All tests passed!
```

**Action if tests fail:** Fix issues before proceeding

---

## Step 2: Build Lambda Deployment Packages

### 2.1 Analytics Lambda

```bash
cd phase2-backend/functions
./package-lambda.sh

# Verify deployment package
ls -lh ../deploy/report_engine.zip
# Expected: File exists, size > 1 MB
```

### 2.2 RBAC Lambdas

```bash
# Still in phase2-backend/functions
# Verify all RBAC packages exist
ls -lh ../deploy/user_management.zip
ls -lh ../deploy/session_management.zip
ls -lh ../deploy/permission_management.zip

# Expected: All files exist with reasonable sizes
```

**Action if packages missing:** Run package script or check build logs

---

## Step 3: Terraform Plan Review

### 3.1 Initialize Terraform

```bash
cd landing-zone/environments/dev
terraform init -upgrade

# Expected output:
# Terraform has been successfully initialized!
```

### 3.2 Generate Plan

```bash
terraform plan -out=phase4.tfplan

# Review the plan output carefully
# Expected additions:
# - 3 DynamoDB tables (RBAC module)
# - 3 Lambda functions (RBAC module)
# - 3 IAM roles
# - 3 CloudWatch Log Groups
# - (Analytics module already deployed)
```

### 3.3 Save Plan Output

```bash
terraform show -no-color phase4.tfplan > phase4-plan.txt

# Review the file
less phase4-plan.txt
```

**Decision Point:** Approve plan or abort deployment

---

## Step 4: Execute Deployment

### 4.1 Apply Terraform Changes

```bash
# Execute the plan
terraform apply phase4.tfplan

# Monitor output for errors
# Expected duration: 5-10 minutes
```

### 4.2 Verify Resource Creation

```bash
# Check DynamoDB tables
aws dynamodb list-tables --query "TableNames[?contains(@, 'securebase-dev')]"

# Expected tables:
# - securebase-dev-user-sessions
# - securebase-dev-user-invites
# - securebase-dev-activity-feed

# Check Lambda functions
aws lambda list-functions --query "Functions[?contains(FunctionName, 'securebase-dev')].FunctionName"

# Expected functions:
# - securebase-dev-user-management
# - securebase-dev-session-management
# - securebase-dev-permission-management
```

---

## Step 5: Post-Deployment Validation

### 5.1 Test Lambda Functions

```bash
# Test user management Lambda
aws lambda invoke \
  --function-name securebase-dev-user-management \
  --payload '{"httpMethod":"GET","path":"/users","queryStringParameters":{"customer_id":"test"}}' \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json
# Expected: 200 status code response

# Test session management Lambda
aws lambda invoke \
  --function-name securebase-dev-session-management \
  --payload '{"httpMethod":"POST","path":"/sessions/validate","body":"{}"}' \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json
# Expected: Response (may be error due to missing auth, but function executes)
```

### 5.2 Check CloudWatch Logs

```bash
# View recent logs for user management
aws logs tail /aws/lambda/securebase-dev-user-management --since 5m

# Expected: Log entries showing Lambda initialization
```

### 5.3 Verify DynamoDB Tables

```bash
# Describe user sessions table
aws dynamodb describe-table --table-name securebase-dev-user-sessions \
  --query "Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount}"

# Expected:
# {
#   "Name": "securebase-dev-user-sessions",
#   "Status": "ACTIVE",
#   "ItemCount": 0
# }
```

### 5.4 Test API Gateway Integration

```bash
# Get API Gateway endpoint
terraform output | grep api_gateway_endpoint

# Test health check (if available)
curl https://[api-id].execute-api.us-east-1.amazonaws.com/dev/health
```

---

## Step 6: Update API Gateway (if needed)

### 6.1 Verify RBAC Routes Added

```bash
# Check API Gateway resources
aws apigateway get-resources \
  --rest-api-id [api-id] \
  --query "items[?contains(path, 'users') || contains(path, 'sessions')]"

# Expected: Resources for /users, /sessions endpoints
```

### 6.2 Deploy API Gateway Stage

```bash
# If API Gateway was updated, deploy changes
aws apigateway create-deployment \
  --rest-api-id [api-id] \
  --stage-name dev \
  --description "Phase 4 RBAC endpoints"
```

---

## Step 7: Configure Monitoring

### 7.1 Create CloudWatch Alarms

```bash
# Lambda error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "securebase-dev-user-mgmt-errors" \
  --alarm-description "User Management Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=securebase-dev-user-management

# DynamoDB throttle alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "securebase-dev-sessions-throttle" \
  --alarm-description "User Sessions table throttles" \
  --metric-name UserErrors \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TableName,Value=securebase-dev-user-sessions
```

### 7.2 Enable X-Ray Tracing (Optional)

```bash
# Enable X-Ray on Lambda functions
aws lambda update-function-configuration \
  --function-name securebase-dev-user-management \
  --tracing-config Mode=Active

aws lambda update-function-configuration \
  --function-name securebase-dev-session-management \
  --tracing-config Mode=Active

aws lambda update-function-configuration \
  --function-name securebase-dev-permission-management \
  --tracing-config Mode=Active
```

---

## Step 8: Update Documentation

### 8.1 Update Deployment Status

```bash
# Update DEPLOYMENT_STATUS.md
echo "- [x] Phase 4 Infrastructure deployed on $(date)" >> DEPLOYMENT_STATUS.md
```

### 8.2 Generate Terraform Docs

```bash
cd landing-zone/modules/rbac
terraform-docs markdown table . > README.md

cd ../analytics
terraform-docs markdown table . > README.md
```

---

## Step 9: Team Notification

### 9.1 Send Deployment Summary

**Template Email:**
```
Subject: Phase 4 Infrastructure Deployment Complete

Team,

Phase 4 infrastructure has been successfully deployed to the dev environment.

Deployed Components:
- ✅ RBAC Module: 3 Lambda functions, 3 DynamoDB tables
- ✅ Analytics Module: Verified operational
- ✅ API Gateway: Updated with RBAC endpoints
- ✅ Monitoring: CloudWatch alarms configured

Next Steps:
1. Frontend team can begin integrating RBAC endpoints
2. Backend team can test user management workflows
3. QA team can begin end-to-end testing

Documentation:
- Infrastructure docs: docs/PHASE4_INFRASTRUCTURE.md
- API reference: API_REFERENCE.md

Deployed by: [Your Name]
Timestamp: [Deployment Time]
```

---

## Rollback Procedure

### If issues are detected within 1 hour of deployment:

```bash
cd landing-zone/environments/dev

# Option 1: Destroy Phase 4 modules only
terraform destroy -target=module.rbac -auto-approve
terraform destroy -target=module.analytics -auto-approve

# Option 2: Revert to previous Terraform state
terraform apply -auto-approve -var-file=previous.tfvars

# Option 3: Full rollback from backup
terraform state pull > current-state-backup.tfstate
terraform state push previous-state.tfstate
terraform apply -auto-approve
```

### Rollback Verification

```bash
# Verify modules destroyed
terraform state list | grep -E "module\.(rbac|analytics)"
# Expected: No output or only analytics if it was previously deployed

# Verify DynamoDB tables removed
aws dynamodb list-tables | grep -E "(user-sessions|user-invites|activity-feed)"
# Expected: No output

# Verify Lambda functions removed
aws lambda list-functions | grep -E "(user-management|session-management|permission-management)"
# Expected: No output
```

---

## Troubleshooting

### Issue: Terraform apply fails with "Resource already exists"

**Cause:** Resources exist from previous deployment  
**Solution:**
```bash
# Import existing resources
terraform import module.rbac.aws_dynamodb_table.user_sessions securebase-dev-user-sessions

# Or destroy and recreate
aws dynamodb delete-table --table-name securebase-dev-user-sessions
terraform apply
```

### Issue: Lambda function fails to invoke

**Cause:** Missing deployment package or permissions  
**Solution:**
```bash
# Check package exists
ls -lh phase2-backend/deploy/user_management.zip

# Rebuild if missing
cd phase2-backend/functions
./package-lambda.sh

# Update function code
aws lambda update-function-code \
  --function-name securebase-dev-user-management \
  --zip-file fileb://../deploy/user_management.zip
```

### Issue: DynamoDB table not accessible

**Cause:** IAM permissions or VPC configuration  
**Solution:**
```bash
# Check IAM policy
aws iam get-role-policy \
  --role-name securebase-dev-user-management-role \
  --policy-name user-management-permissions

# Verify policy includes table ARN
# If missing, update Terraform and reapply
```

---

## Success Criteria

- [x] All Terraform resources created successfully
- [x] Lambda functions invoke without errors
- [x] DynamoDB tables in ACTIVE status
- [x] CloudWatch Logs receiving events
- [x] API Gateway routes configured
- [x] Monitoring alarms configured
- [x] Documentation updated
- [x] Team notified

---

## Post-Deployment Tasks (Next 24 Hours)

1. Monitor CloudWatch dashboards for anomalies
2. Review Lambda execution metrics
3. Check DynamoDB capacity metrics
4. Validate API Gateway request rates
5. Gather feedback from development team
6. Schedule Phase 4 frontend integration

---

## Sign-Off

**Deployed By:** ________________  
**Date/Time:** ________________  
**Verified By:** ________________  
**Approved By:** ________________  

**Notes:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

**Runbook Version:** 1.0  
**Last Updated:** January 24, 2026  
**Next Review:** February 24, 2026
