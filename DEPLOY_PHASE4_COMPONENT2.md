# Phase 4 Component 2: Team Collaboration & RBAC - Deployment Guide

**Component:** Team Collaboration & Role-Based Access Control (RBAC)  
**Status:** Ready for Deployment  
**Created:** February 2, 2026

---

## 🎯 Quick Start

### Prerequisites
- AWS CLI configured with credentials
- Terraform 1.5+ installed
- Python 3.11+ (for local testing)
- PostgreSQL client (for database initialization)
- Appropriate IAM permissions (Lambda, DynamoDB, Secrets Manager, IAM)

### One-Command Deployment

```bash
cd /home/runner/work/securebase-app/securebase-app
./deploy-phase4-component2.sh
```

**This automated script will:**
1. ✅ Package 3 Lambda functions (user_management, session_management, rbac_engine)
2. ✅ Create JWT secret in AWS Secrets Manager (if not exists)
3. ✅ Update Terraform configuration with RBAC module
4. ✅ Deploy infrastructure via Terraform
5. ✅ Validate deployment

**Estimated time:** 5-10 minutes

---

## 🔄 Redeployment (Code Updates Only)

If you only need to update Lambda function code without infrastructure changes:

```bash
cd /home/runner/work/securebase-app/securebase-app
./redeploy-phase4-component2.sh
```

This will:
1. Re-package all 3 Lambda functions
2. Update Lambda code in AWS
3. Verify updates

**Estimated time:** 1-2 minutes

---

## 📋 What Gets Deployed

### DynamoDB Tables (3)

1. **user-sessions** - User session tracking
   - Hash key: customer_id
   - Range key: session_id
   - GSI: UserIdIndex
   - TTL enabled

2. **user-invites** - User invitation tracking
   - Hash key: customer_id
   - Range key: invite_id
   - GSI: EmailIndex
   - TTL enabled

3. **activity-feed** - Audit log / activity tracking
   - Hash key: customer_id
   - Range key: timestamp
   - GSI: UserIdIndex, ActionIndex
   - TTL enabled

### Lambda Functions (3)

1. **user-management** - User CRUD operations
   - Handler: user_management.lambda_handler
   - Runtime: Python 3.11
   - Memory: 512MB
   - Timeout: 30s

2. **session-management** - Authentication & session handling
   - Handler: session_management.lambda_handler
   - Runtime: Python 3.11
   - Memory: 256MB
   - Timeout: 30s

3. **permission-management** - RBAC enforcement
   - Handler: permission_management.lambda_handler (rbac_engine.py)
   - Runtime: Python 3.11
   - Memory: 256MB
   - Timeout: 30s

### IAM Roles & Policies

- 3 Lambda execution roles (one per function)
- DynamoDB read/write permissions
- Secrets Manager read permissions
- SES send email permissions (user-management)
- CloudWatch Logs permissions

### Secrets Manager

- **securebase/{env}/jwt-secret** - JWT signing secret (auto-generated)

### CloudWatch Log Groups

- /aws/lambda/securebase-{env}-user-management
- /aws/lambda/securebase-{env}-session-management
- /aws/lambda/securebase-{env}-permission-management

---

## 🔧 Manual Deployment Steps

If you prefer manual control or need to troubleshoot:

### Step 1: Package Lambda Functions

```bash
cd phase2-backend/functions
mkdir -p ../deploy

# Package user_management
zip -j ../deploy/user_management.zip user_management.py

# Package session_management
zip -j ../deploy/session_management.zip session_management.py

# Package rbac_engine as permission_management
zip -j ../deploy/permission_management.zip rbac_engine.py
```

### Step 2: Create JWT Secret (if not exists)

```bash
# Generate secret
JWT_SECRET=$(openssl rand -base64 32)

# Create in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "securebase/dev/jwt-secret" \
  --description "JWT signing secret for SecureBase dev" \
  --secret-string "$JWT_SECRET" \
  --region us-east-1
```

### Step 3: Update Terraform Configuration

Add to `landing-zone/environments/dev/main.tf`:

```hcl
# Phase 4 Component 2: Team Collaboration & RBAC Module
module "rbac" {
  source = "../../modules/rbac"
  
  environment          = var.environment
  database_endpoint    = module.securebase.aurora_endpoint
  database_name        = "securebase"
  database_secret_arn  = module.securebase.db_secret_arn
  jwt_secret_arn       = var.jwt_secret_arn
  tags                 = var.tags
}
```

Add to `landing-zone/environments/dev/variables.tf`:

```hcl
variable "jwt_secret_arn" {
  description = "ARN of JWT secret in AWS Secrets Manager"
  type        = string
  default     = ""
}
```

Add to `landing-zone/environments/dev/terraform.tfvars`:

```hcl
jwt_secret_arn = "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:securebase/dev/jwt-secret-XXXXX"
```

### Step 4: Deploy Infrastructure with Terraform

```bash
cd landing-zone/environments/dev

# Initialize Terraform
terraform init -upgrade

# Plan deployment
terraform plan -out=component2.tfplan

# Review the plan output carefully

# Apply if everything looks good
terraform apply component2.tfplan
```

### Step 5: Initialize Database Schema

```bash
cd phase2-backend/database

# Connect to Aurora database
# Get endpoint from: terraform output -raw aurora_endpoint
# Get password from Secrets Manager

psql -h <aurora-endpoint> -U securebase_app -d securebase -f rbac_schema.sql
```

---

## ✅ Verify Deployment

### Check DynamoDB Tables

```bash
aws dynamodb list-tables --region us-east-1 | grep securebase-dev
```

Expected output:
```
securebase-dev-user-sessions
securebase-dev-user-invites
securebase-dev-activity-feed
```

### Check Lambda Functions

```bash
aws lambda list-functions --region us-east-1 | grep securebase-dev
```

Expected output:
```
securebase-dev-user-management
securebase-dev-session-management
securebase-dev-permission-management
```

### Test Lambda Functions

```bash
# Test user-management
aws lambda invoke \
  --function-name securebase-dev-user-management \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  --region us-east-1 \
  output.json

cat output.json
```

### Check CloudWatch Logs

```bash
# View recent logs
aws logs tail /aws/lambda/securebase-dev-user-management --follow

# Or use AWS Console
# Navigate to CloudWatch > Log groups
```

---

## 🗄️ Database Schema

The RBAC schema includes the following tables:

1. **users** - User accounts and profiles
2. **user_sessions** - Session tokens (DynamoDB)
3. **user_permissions** - Permission assignments
4. **user_invites** - Pending user invitations (DynamoDB)
5. **activity_feed** - Audit log (DynamoDB)
6. **team_roles** - Role definitions

Schema file: `phase2-backend/database/rbac_schema.sql`

---

## 🔐 Security Considerations

### Secrets Management
- JWT secret auto-generated and stored in Secrets Manager
- Database credentials managed via Secrets Manager
- No secrets in code or environment variables

### IAM Permissions
- Lambda functions use least-privilege IAM roles
- Each function has only required permissions
- Resource-level permissions enforced

### Data Protection
- DynamoDB encryption at rest enabled
- Point-in-time recovery enabled
- TTL configured for session cleanup
- Row-Level Security (RLS) in PostgreSQL

---

## 🧪 Testing

### Run Unit Tests

```bash
cd phase2-backend/functions

# Run all RBAC tests
python -m pytest test_user_management.py test_session_management.py test_rbac_integration.py -v

# With coverage
python -m pytest --cov=. --cov-report=html
```

### Integration Tests

See: `.github/workflows/phase4-component2.yml`

The CI/CD pipeline runs:
- Backend unit tests
- Frontend component tests
- Security scans (CodeQL, Bandit)
- Documentation validation

---

## 📊 Monitoring & Observability

### CloudWatch Metrics

Key metrics to monitor:
- Lambda invocation count
- Lambda duration
- Lambda errors
- DynamoDB consumed read/write capacity
- DynamoDB throttled requests

### CloudWatch Alarms

Recommended alarms:
- Lambda error rate > 1%
- Lambda duration > 25s (near timeout)
- DynamoDB throttling

### Logging

All Lambda functions log to CloudWatch Logs:
- Log level: INFO (configurable via LOG_LEVEL env var)
- Retention: 30 days
- Structured logging with context

---

## 🔄 Rollback Plan

If issues are found after deployment:

### Quick Rollback (Lambda Code Only)

```bash
# Deploy previous Lambda version
aws lambda update-function-code \
  --function-name securebase-dev-user-management \
  --zip-file fileb://backup/user_management_v1.zip
```

### Full Rollback (Infrastructure)

```bash
cd landing-zone/environments/dev

# Remove RBAC module from main.tf
# Then run:
terraform plan -destroy -target=module.rbac
terraform apply -destroy -target=module.rbac
```

---

## 📚 Related Documentation

- **PHASE4_COMPONENT2_COMPLETE.md** - Implementation completion report
- **PHASE4_COMPONENT2_PLAN.md** - Original project plan
- **docs/RBAC_DESIGN.md** - Architecture and design
- **docs/TEAM_MANAGEMENT_API.md** - API reference
- **docs/RBAC_PERMISSION_MATRIX.md** - Permission matrix
- **RBAC_TROUBLESHOOTING.md** - Common issues and solutions

---

## 🆘 Troubleshooting

### Common Issues

**Issue:** Terraform fails with "module not found"
- **Solution:** Run `terraform init -upgrade` to download modules

**Issue:** Lambda function fails with "Unable to import module"
- **Solution:** Check Lambda layer is attached, verify function handler name

**Issue:** JWT secret not found
- **Solution:** Verify secret ARN in terraform.tfvars, check secret exists in Secrets Manager

**Issue:** Database connection fails
- **Solution:** Check database endpoint, verify security groups, confirm RDS Proxy configured

**Issue:** Permission denied on DynamoDB
- **Solution:** Verify IAM role has correct permissions, check table names match environment

### Getting Help

- Check CloudWatch Logs for detailed error messages
- Review GitHub Issues for known problems
- Contact: support@securebase.aws

---

## 📞 Support

- **Documentation:** docs.securebase.aws/rbac
- **API Reference:** docs.securebase.aws/api/team-management
- **Support:** support@securebase.aws
- **Security Issues:** security@securebase.aws

---

**Deployment Guide Version:** 1.0  
**Last Updated:** February 2, 2026  
**Status:** ✅ Ready for Use
