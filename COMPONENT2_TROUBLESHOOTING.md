# Phase 4 Component 2 - Deployment Troubleshooting

**Component:** Team Collaboration & RBAC  
**Last Updated:** February 3, 2026

---

## 🔍 Pre-Deployment Issues

### Issue: AWS Credentials Not Configured

**Symptoms:**
```
Unable to locate credentials. You can configure credentials by running "aws configure".
```

**Resolution:**
```bash
# Configure AWS credentials
aws configure

# Verify credentials work
aws sts get-caller-identity

# Expected output shows AccountId, UserId, and Arn
```

**Prevention:**
- Set up AWS credentials before deployment
- Use IAM role with appropriate permissions
- Verify credentials have not expired

---

### Issue: Terraform Not Installed

**Symptoms:**
```
bash: terraform: command not found
```

**Resolution:**
```bash
# Install Terraform (macOS)
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Install Terraform (Linux)
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Verify installation
terraform version
```

**Prevention:**
- Install Terraform before starting deployment
- Use version 1.0 or later

---

### Issue: Lambda Packages Not Found

**Symptoms:**
```
✗ user_management.zip (not found)
✗ session_management.zip (not found)
✗ permission_management.zip (not found)
```

**Resolution:**
```bash
# Package Lambda functions
cd phase2-backend/functions
mkdir -p ../deploy

zip -j ../deploy/user_management.zip user_management.py
zip -j ../deploy/session_management.zip session_management.py
zip -j ../deploy/permission_management.zip rbac_engine.py

# Verify packages created
ls -lh ../deploy/*.zip
```

**Prevention:**
- Run packaging step before Terraform deployment
- Use deployment scripts that include packaging

---

## 🚨 Terraform Deployment Issues

### Issue: RBAC Module Not Configured

**Symptoms:**
```
Error: Module not found
Module 'rbac' not found in landing-zone/modules/rbac
```

**Resolution:**
1. Verify RBAC module exists:
   ```bash
   ls -la landing-zone/modules/rbac/
   ```

2. Check if module is referenced in main.tf:
   ```bash
   cd landing-zone
   grep -n "module \"rbac\"" main.tf
   ```

3. If missing, the module should already be configured in the root main.tf at line ~460

**Prevention:**
- RBAC module is part of the repository
- Should not need manual configuration

---

### Issue: Database Secret ARN Missing

**Symptoms:**
```
Error: Missing required variable
Variable 'database_secret_arn' not found in module outputs
```

**Resolution:**
This has been fixed in the codebase. The `database_secret_arn` output has been added to `landing-zone/modules/phase2-database/outputs.tf`.

If you still see this error:
```bash
cd landing-zone/environments/dev
terraform init -upgrade
terraform plan
```

**Prevention:**
- Pull latest changes from repository
- Ensure phase2-database module outputs include database_secret_arn

---

### Issue: JWT Secret Not Found

**Symptoms:**
```
Error: Secret not found
Secret 'securebase/dev/jwt-secret' does not exist
```

**Resolution:**
JWT secret will be created automatically by Terraform if it doesn't exist. This is configured in the phase2-database module.

If manual creation is needed:
```bash
# Create JWT secret
JWT_SECRET=$(openssl rand -base64 32)
aws secretsmanager create-secret \
  --name securebase/dev/jwt-secret \
  --description "JWT signing secret for SecureBase dev" \
  --secret-string "$JWT_SECRET" \
  --tags Key=Environment,Value=dev Key=Component,Value=RBAC
```

**Prevention:**
- Let Terraform create the secret automatically
- Don't delete the secret manually

---

### Issue: Terraform State Lock

**Symptoms:**
```
Error: Error acquiring the state lock
Lock Info:
  ID:        abc123...
  Operation: OperationTypeApply
```

**Resolution:**
```bash
# Wait for other operations to complete, or force unlock (use with caution)
terraform force-unlock abc123...

# If using S3 backend, check DynamoDB lock table
aws dynamodb get-item \
  --table-name terraform-state-lock \
  --key '{"LockID": {"S": "path/to/state"}}'
```

**Prevention:**
- Don't run multiple terraform commands simultaneously
- Complete or cancel operations before starting new ones

---

## 💾 Database Schema Issues

### Issue: Database Connection Failed

**Symptoms:**
```
psql: error: connection to server at "..." failed: Connection refused
```

**Resolution:**
```bash
# 1. Verify RDS Proxy endpoint
PROXY_ENDPOINT=$(terraform -chdir=landing-zone/environments/dev output -raw rds_proxy_endpoint)
echo $PROXY_ENDPOINT

# 2. Check security groups allow port 5432
aws ec2 describe-security-groups --group-ids sg-xxx

# 3. Verify you're connecting from allowed IP/VPC
# Use bastion host or Lambda if RDS is in private subnet

# 4. Test connection without schema file
PGPASSWORD=$DB_PASSWORD psql -h $PROXY_ENDPOINT -U securebase_app -d securebase -c "SELECT version();"
```

**Prevention:**
- Ensure Lambda functions are in same VPC as RDS
- Configure security groups to allow PostgreSQL traffic
- Use RDS Proxy endpoint, not direct cluster endpoint

---

### Issue: Permission Denied on Database

**Symptoms:**
```
ERROR:  permission denied for table users
```

**Resolution:**
```bash
# Grant permissions to application user
PGPASSWORD=$DB_PASSWORD psql -h $PROXY_ENDPOINT -U postgres -d securebase <<EOF
GRANT ALL ON ALL TABLES IN SCHEMA public TO securebase_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO securebase_app;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO securebase_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO securebase_app;
EOF
```

**Prevention:**
- Use correct database user with appropriate permissions
- Apply schema with user that has GRANT privileges
- Include permission grants in schema file

---

### Issue: Tables Already Exist

**Symptoms:**
```
ERROR:  relation "users" already exists
```

**Resolution:**
Option 1 - Skip existing tables (safe):
```bash
# Apply schema but ignore errors for existing objects
PGPASSWORD=$DB_PASSWORD psql -h $PROXY_ENDPOINT -U securebase_app -d securebase -f rbac_schema.sql 2>&1 | grep -v "already exists"
```

Option 2 - Drop and recreate (CAUTION - data loss):
```bash
# Only do this in dev/test environments
PGPASSWORD=$DB_PASSWORD psql -h $PROXY_ENDPOINT -U securebase_app -d securebase <<EOF
DROP TABLE IF EXISTS activity_feed CASCADE;
DROP TABLE IF EXISTS user_invites CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS team_roles CASCADE;
EOF

# Then reapply schema
PGPASSWORD=$DB_PASSWORD psql -h $PROXY_ENDPOINT -U securebase_app -d securebase -f rbac_schema.sql
```

**Prevention:**
- Check if tables exist before applying schema
- Use idempotent schema files with CREATE IF NOT EXISTS

---

## ⚡ Lambda Function Issues

### Issue: Lambda Function Not Active

**Symptoms:**
```
⚠ user-management: Pending (InProgress)
```

**Resolution:**
```bash
# Wait for function to become active (can take 1-2 minutes)
watch -n 5 'aws lambda get-function \
  --function-name securebase-dev-user-management \
  --query Configuration.State'

# If stuck in Pending, check for errors
aws lambda get-function \
  --function-name securebase-dev-user-management \
  --query Configuration.StateReasonCode
```

**Prevention:**
- Wait for deployment to complete before validation
- Check CloudWatch logs for deployment errors

---

### Issue: Lambda Execution Errors

**Symptoms:**
```
Error: Handler 'lambda_handler' missing in module
```

**Resolution:**
```bash
# Check Lambda function code
aws lambda get-function \
  --function-name securebase-dev-user-management \
  --query Code.Location

# Download and inspect
wget -O /tmp/function.zip "<location-url>"
unzip -l /tmp/function.zip

# Verify handler function exists
unzip -p /tmp/function.zip user_management.py | grep "def lambda_handler"
```

**Prevention:**
- Ensure all Lambda functions have lambda_handler function
- Package correct files in ZIP
- Test locally before deployment

---

### Issue: Lambda Timeout

**Symptoms:**
```
Task timed out after 3.00 seconds
```

**Resolution:**
```bash
# Increase timeout (up to 900 seconds)
aws lambda update-function-configuration \
  --function-name securebase-dev-user-management \
  --timeout 30

# Or via Terraform (in rbac module main.tf)
# timeout = 30
```

**Prevention:**
- Set appropriate timeout values for complex operations
- Optimize database queries
- Use connection pooling (RDS Proxy)

---

## 🔐 Security & Permissions Issues

### Issue: IAM Role Not Attached

**Symptoms:**
```
AccessDeniedException: User is not authorized to perform
```

**Resolution:**
```bash
# Verify Lambda execution role
aws lambda get-function-configuration \
  --function-name securebase-dev-user-management \
  --query Role

# Check role policies
aws iam list-attached-role-policies \
  --role-name securebase-dev-user-management-role

# Attach missing policies via Terraform
terraform apply
```

**Prevention:**
- Let Terraform manage IAM roles
- Don't manually modify role policies
- Include all necessary permissions in Terraform module

---

### Issue: Secrets Manager Access Denied

**Symptoms:**
```
AccessDeniedException: User: arn:aws:sts::123:assumed-role/... is not authorized to perform: secretsmanager:GetSecretValue
```

**Resolution:**
```bash
# Add Secrets Manager permissions to Lambda role
aws iam put-role-policy \
  --role-name securebase-dev-user-management-role \
  --policy-name SecretsManagerAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": ["arn:aws:secretsmanager:*:*:secret:securebase/*"]
    }]
  }'
```

**Prevention:**
- Terraform module should include Secrets Manager permissions
- Verify IAM policies grant access to required secrets

---

## 📊 Validation Issues

### Issue: Validation Script Fails

**Symptoms:**
```
✗ DynamoDB Table: securebase-dev-user-sessions
```

**Resolution:**
```bash
# Check if table exists
aws dynamodb describe-table \
  --table-name securebase-dev-user-sessions \
  --region us-east-1

# If not found, deploy infrastructure
cd landing-zone/environments/dev
terraform apply

# Re-run validation
cd ../../..
./validate-phase4-component2.sh
```

**Prevention:**
- Complete Terraform deployment before validation
- Ensure all resources are created
- Check for Terraform errors during apply

---

## 📞 Getting Help

### Support Resources

1. **Documentation:**
   - [PHASE4_COMPONENT2_DEPLOYMENT_GUIDE.md](PHASE4_COMPONENT2_DEPLOYMENT_GUIDE.md)
   - [docs/RBAC_TROUBLESHOOTING.md](docs/RBAC_TROUBLESHOOTING.md)
   - [docs/TEAM_MANAGEMENT_API.md](docs/TEAM_MANAGEMENT_API.md)

2. **Logs:**
   ```bash
   # CloudWatch Logs
   aws logs tail /aws/lambda/securebase-dev-user-management --follow
   
   # Terraform logs
   TF_LOG=DEBUG terraform apply
   ```

3. **Support:**
   - Email: support@securebase.aws
   - Include: Error messages, CloudWatch logs, Terraform output

---

## ✅ Health Check Commands

```bash
# Quick health check
./validate-phase4-component2.sh

# Detailed DynamoDB check
aws dynamodb list-tables | grep securebase-dev

# Detailed Lambda check
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `securebase-dev`)].{Name:FunctionName,State:State,UpdateStatus:LastUpdateStatus}'

# Database connectivity
PGPASSWORD=$DB_PASSWORD psql -h $PROXY_ENDPOINT -U securebase_app -d securebase -c "SELECT count(*) FROM users;"

# API endpoint test (if configured)
curl -X GET https://api.securebase.aws/users \
  -H "Authorization: Bearer $TOKEN"
```

---

**Version:** 1.0  
**Last Updated:** February 3, 2026  
**Status:** Complete
