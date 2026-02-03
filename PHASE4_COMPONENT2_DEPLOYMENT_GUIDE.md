# Phase 4 Component 2 Deployment Guide
## Team Collaboration & RBAC - Complete Deployment Instructions

**Status:** ✅ Ready for Deployment  
**Last Updated:** February 3, 2026  
**Component:** Team Collaboration & Role-Based Access Control  

---

## 🎯 Overview

This guide provides step-by-step instructions for deploying Phase 4 Component 2 (Team Collaboration & RBAC) to AWS. The component enables multi-user team collaboration with comprehensive role-based access control.

### What Gets Deployed

#### Infrastructure (via Terraform)
- **3 DynamoDB Tables**: user-sessions, user-invites, activity-feed
- **3 Lambda Functions**: user-management, session-management, permission-management
- **3 IAM Roles**: One per Lambda function
- **3 CloudWatch Log Groups**: Function logging
- **JWT Secret**: Secrets Manager for token signing

#### Database Schema (via SQL)
- **6 PostgreSQL Tables**: users, user_sessions, user_permissions, user_invites, activity_feed, team_roles
- **Row-Level Security (RLS)**: Customer isolation policies
- **Database Functions**: Helper functions for permissions and cleanup
- **Triggers**: Immutable audit log enforcement

---

## ✅ Pre-Deployment Checklist

### Required Resources (Must Already Exist)
- [x] Phase 2 Backend Infrastructure Deployed
  - Aurora PostgreSQL cluster (operational)
  - RDS Proxy (configured)
  - Database credentials in Secrets Manager
- [x] AWS CLI configured with appropriate credentials
- [x] Terraform installed (v1.0+)
- [x] Lambda function packages created (in `phase2-backend/deploy/`)

### Verify Prerequisites

```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify Aurora cluster exists
aws rds describe-db-clusters \
  --db-cluster-identifier securebase-dev \
  --region us-east-1

# Verify RDS Proxy exists
aws rds describe-db-proxies \
  --db-proxy-name securebase-dev-proxy \
  --region us-east-1

# Check Lambda packages exist
ls -lh phase2-backend/deploy/user_management.zip
ls -lh phase2-backend/deploy/session_management.zip
ls -lh phase2-backend/deploy/permission_management.zip
```

---

## 📦 Deployment Steps

### Step 1: Package Lambda Functions

If not already done, package the Lambda functions:

```bash
cd phase2-backend/functions

# Create deploy directory
mkdir -p ../deploy

# Package functions
zip -j ../deploy/user_management.zip user_management.py
zip -j ../deploy/session_management.zip session_management.py
zip -j ../deploy/permission_management.zip rbac_engine.py

# Verify packages
ls -lh ../deploy/*.zip
```

**Expected Output:**
```
-rw-r--r-- 1 user user 6.3K Feb  3 19:08 user_management.zip
-rw-r--r-- 1 user user 5.3K Feb  3 19:08 session_management.zip
-rw-r--r-- 1 user user 2.9K Feb  3 19:08 permission_management.zip
```

---

### Step 2: Initialize Terraform

Navigate to the environment directory and initialize Terraform:

```bash
cd landing-zone/environments/dev

# Initialize Terraform (download providers)
terraform init -upgrade

# Validate configuration
terraform validate
```

**Expected Output:**
```
Success! The configuration is valid.
```

---

### Step 3: Review Terraform Plan

Review what will be created:

```bash
terraform plan -out=component2.tfplan

# Or for a more detailed review
terraform plan -out=component2.tfplan | tee terraform-plan.log
```

**Expected Resources to be Created:**
- `module.rbac.aws_dynamodb_table.user_sessions`
- `module.rbac.aws_dynamodb_table.user_invites`
- `module.rbac.aws_dynamodb_table.activity_feed`
- `module.rbac.aws_lambda_function.user_management`
- `module.rbac.aws_lambda_function.session_management`
- `module.rbac.aws_lambda_function.permission_management`
- `module.rbac.aws_iam_role.user_management_role`
- `module.rbac.aws_iam_role.session_management_role`
- `module.rbac.aws_iam_role.permission_management_role`
- `module.rbac.aws_cloudwatch_log_group.user_management_logs`
- `module.rbac.aws_cloudwatch_log_group.session_management_logs`
- `module.rbac.aws_cloudwatch_log_group.permission_management_logs`

---

### Step 4: Apply Terraform Configuration

Deploy the infrastructure:

```bash
# Apply the plan
terraform apply component2.tfplan

# Wait for completion (typically 2-5 minutes)
```

**Expected Output:**
```
Apply complete! Resources: 12 added, 0 changed, 0 destroyed.

Outputs:

rbac_dynamodb_tables = {
  "user_sessions" = "securebase-dev-user-sessions"
  "user_invites" = "securebase-dev-user-invites"
  "activity_feed" = "securebase-dev-activity-feed"
}

rbac_lambda_functions = {
  "user_management" = "securebase-dev-user-management"
  "session_management" = "securebase-dev-session-management"
  "permission_management" = "securebase-dev-permission-management"
}
```

---

### Step 5: Initialize Database Schema

Apply the RBAC database schema to Aurora PostgreSQL:

```bash
cd ../../phase2-backend/database

# Get RDS Proxy endpoint from Terraform output
PROXY_ENDPOINT=$(terraform -chdir=../../landing-zone/environments/dev output -raw rds_proxy_endpoint)

# Get database password from Secrets Manager
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id securebase/dev/rds-password \
  --query SecretString \
  --output text | jq -r .password)

# Apply schema
PGPASSWORD=$DB_PASSWORD psql \
  -h $PROXY_ENDPOINT \
  -U securebase_app \
  -d securebase \
  -f rbac_schema.sql

# Verify tables were created
PGPASSWORD=$DB_PASSWORD psql \
  -h $PROXY_ENDPOINT \
  -U securebase_app \
  -d securebase \
  -c "\dt"
```

**Expected Tables:**
- `users`
- `user_sessions`
- `user_permissions`
- `user_invites`
- `activity_feed`
- `team_roles`

---

### Step 6: Validate Deployment

Run the validation script to confirm everything is deployed correctly:

```bash
cd ../../..
./validate-phase4-component2.sh
```

**Expected Output:**
```
🔍 Validating Phase 4 Component 2 Deployment
=============================================

Environment: dev
Region: us-east-1

Checking DynamoDB Tables...
  ✓ DynamoDB Table: securebase-dev-user-sessions
  ✓ DynamoDB Table: securebase-dev-user-invites
  ✓ DynamoDB Table: securebase-dev-activity-feed

Checking Lambda Functions...
  ✓ Lambda Function: securebase-dev-user-management
  ✓ Lambda Function: securebase-dev-session-management
  ✓ Lambda Function: securebase-dev-permission-management

Checking Lambda Function States...
  ✓ user-management: Active (Successful)
  ✓ session-management: Active (Successful)
  ✓ permission-management: Active (Successful)

Checking IAM Roles...
  ✓ IAM Role: securebase-dev-user-management-role
  ✓ IAM Role: securebase-dev-session-management-role
  ✓ IAM Role: securebase-dev-permission-management-role

Checking CloudWatch Log Groups...
  ✓ Log Group: /aws/lambda/securebase-dev-user-management
  ✓ Log Group: /aws/lambda/securebase-dev-session-management
  ✓ Log Group: /aws/lambda/securebase-dev-permission-management

Checking Lambda Deployment Packages...
  ✓ user_management.zip (6.3K)
  ✓ session_management.zip (5.3K)
  ✓ permission_management.zip (2.9K)

=============================================
Validation Summary
=============================================

✓✓✓ All checks passed! ✓✓✓

Phase 4 Component 2 deployment is complete and healthy.
```

---

### Step 7: Test Lambda Functions

Test each Lambda function with sample events:

#### Test User Management Function

```bash
# Create test event
cat > /tmp/test-create-user.json << 'EOF'
{
  "httpMethod": "POST",
  "path": "/users",
  "headers": {
    "Authorization": "Bearer test-token",
    "Content-Type": "application/json"
  },
  "body": "{\"email\":\"test@example.com\",\"name\":\"Test User\",\"role\":\"analyst\"}"
}
EOF

# Invoke function
aws lambda invoke \
  --function-name securebase-dev-user-management \
  --payload file:///tmp/test-create-user.json \
  --region us-east-1 \
  /tmp/user-management-response.json

# View response
cat /tmp/user-management-response.json | jq
```

#### Test Session Management Function

```bash
# Create test event
cat > /tmp/test-login.json << 'EOF'
{
  "httpMethod": "POST",
  "path": "/auth/login",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"email\":\"test@example.com\",\"password\":\"TestPassword123!\"}"
}
EOF

# Invoke function
aws lambda invoke \
  --function-name securebase-dev-session-management \
  --payload file:///tmp/test-login.json \
  --region us-east-1 \
  /tmp/session-management-response.json

# View response
cat /tmp/session-management-response.json | jq
```

---

### Step 8: Monitor CloudWatch Logs

Monitor function execution in CloudWatch Logs:

```bash
# Tail user management logs
aws logs tail /aws/lambda/securebase-dev-user-management --follow

# Tail session management logs
aws logs tail /aws/lambda/securebase-dev-session-management --follow

# Tail permission management logs
aws logs tail /aws/lambda/securebase-dev-permission-management --follow
```

---

## 🔧 Post-Deployment Configuration

### Configure API Gateway Endpoints

Add RBAC endpoints to API Gateway:

```bash
# Get API Gateway ID
API_ID=$(aws apigatewayv2 get-apis \
  --query "Items[?Name=='securebase-dev-api'].ApiId" \
  --output text)

# Create user management routes
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key 'POST /users' \
  --target integrations/user-management-integration

aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key 'GET /users' \
  --target integrations/user-management-integration

# Create authentication routes
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key 'POST /auth/login' \
  --target integrations/session-management-integration

aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key 'POST /auth/logout' \
  --target integrations/session-management-integration
```

### Seed Initial Admin User

Create the first admin user:

```bash
PROXY_ENDPOINT=$(terraform -chdir=landing-zone/environments/dev output -raw rds_proxy_endpoint)
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id securebase/dev/rds-password \
  --query SecretString --output text | jq -r .password)

# Create admin user
PGPASSWORD=$DB_PASSWORD psql \
  -h $PROXY_ENDPOINT \
  -U securebase_app \
  -d securebase \
  -c "INSERT INTO users (customer_id, email, name, role, password_hash, status) 
      VALUES (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'admin@securebase.aws',
        'System Administrator',
        'admin',
        '\$2b\$12\$KIXVHGRHa8F8yOJMBpLsFeVqHqZj8Z8k9HGrKF8yOJMBpLsFeVqHq',
        'active'
      );"
```

---

## 🐛 Troubleshooting

### Issue: Lambda Functions Not Found

**Symptoms:**
- `terraform plan` shows Lambda resources will be created
- Validation script reports "Lambda not found"

**Solution:**
1. Ensure Terraform apply completed successfully
2. Check Lambda function names match expected pattern:
   ```bash
   aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `securebase-dev`)].FunctionName'
   ```

### Issue: Database Connection Errors

**Symptoms:**
- Lambda logs show "could not connect to server"
- Database queries fail

**Solution:**
1. Verify Lambda functions are in the same VPC as RDS
2. Check security group rules allow PostgreSQL traffic (port 5432)
3. Verify RDS Proxy endpoint is correct:
   ```bash
   terraform -chdir=landing-zone/environments/dev output rds_proxy_endpoint
   ```

### Issue: Permission Denied Errors

**Symptoms:**
- Lambda logs show "permission denied for table users"
- Database operations fail

**Solution:**
1. Verify database user has correct permissions:
   ```sql
   GRANT ALL ON ALL TABLES IN SCHEMA public TO securebase_app;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO securebase_app;
   ```

2. Re-apply RBAC schema:
   ```bash
   cd phase2-backend/database
   PGPASSWORD=$DB_PASSWORD psql -h $PROXY_ENDPOINT -U securebase_app -d securebase -f rbac_schema.sql
   ```

### Issue: JWT Secret Not Found

**Symptoms:**
- Session management fails with "JWT secret not found"

**Solution:**
1. Verify JWT secret exists in Secrets Manager:
   ```bash
   aws secretsmanager describe-secret --secret-id securebase/dev/jwt-secret
   ```

2. If missing, Terraform will create it automatically on next apply

---

## 📚 Additional Resources

### Documentation
- **[RBAC_PERMISSION_MATRIX.md](docs/RBAC_PERMISSION_MATRIX.md)** - Complete permission reference
- **[TEAM_MANAGEMENT_API.md](docs/TEAM_MANAGEMENT_API.md)** - API endpoint documentation
- **[RBAC_TROUBLESHOOTING.md](docs/RBAC_TROUBLESHOOTING.md)** - Detailed troubleshooting guide

### Related Components
- **Phase 2 Database**: `PHASE2_DEPLOYMENT_DETAILED.md`
- **Phase 3a Portal**: `PHASE3A_DEPLOYMENT_GUIDE.md`
- **Phase 4 Component 1 (Analytics)**: `docs/ANALYTICS_DEPLOYMENT_RUNBOOK.md`

### Quick Commands
```bash
# Redeploy Lambda code only
./redeploy-phase4-component2.sh

# Full deployment
./deploy-phase4-component2.sh

# Validate deployment
./validate-phase4-component2.sh

# View logs
aws logs tail /aws/lambda/securebase-dev-user-management --follow
```

---

## ✅ Success Criteria

After successful deployment, verify:

- [x] All 3 DynamoDB tables created and active
- [x] All 3 Lambda functions deployed and in "Active" state
- [x] All 3 IAM roles attached to functions
- [x] All 6 PostgreSQL tables created with RLS enabled
- [x] CloudWatch logs streaming from all functions
- [x] JWT secret stored in Secrets Manager
- [x] Validation script returns all green checks

---

**Deployment Complete!** 🎉

Phase 4 Component 2 (Team Collaboration & RBAC) is now deployed and operational.

**Next Steps:**
1. Deploy Phase 3a Customer Portal (if not already deployed)
2. Configure API Gateway routes for RBAC endpoints
3. Test user management workflows
4. Train support team on RBAC features
5. Begin customer onboarding with multi-user support

---

**Version:** 1.0  
**Last Updated:** February 3, 2026  
**Status:** ✅ Ready for Production Use
