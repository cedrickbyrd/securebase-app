# Phase 2 Deployment - Step-by-Step Guide

**Status:** Ready for deployment  
**Date:** January 19, 2026  
**Target Environment:** dev  
**Expected Duration:** 4-6 hours (infrastructure + database init)

---

## ✅ Prerequisites Checklist

Before starting Phase 2 deployment:

- [ ] AWS credentials configured with management account access
- [ ] AWS CLI v2.x installed and tested
- [ ] Terraform 1.5+ installed and working
- [ ] Phase 1 (landing zone) confirmed deployed and stable
- [ ] `psql` PostgreSQL client available (for database initialization)
- [ ] `jq` JSON processor available (for secret extraction)
- [ ] Internet connectivity to AWS API endpoints

**Verify prerequisites:**
```bash
# Check AWS CLI
aws sts get-caller-identity

# Check Terraform
terraform -version

# Check PostgreSQL client
psql --version

# Check jq
jq --version
```

---

## 🚀 Phase 2 Deployment Steps

### STEP 1: Navigate to Terraform Directory

```bash
cd /workspaces/securebase-app/landing-zone/environments/dev

# List available files
ls -la
# Expected files: terraform.tfvars, terraform.tfvars.phase2, etc.
```

**Note:** If `terraform.tfvars` exists from Phase 1, back it up:
```bash
cp terraform.tfvars terraform.tfvars.phase1.backup
```

---

### STEP 2: Copy Phase 2 Variables

```bash
# Use the Phase 2 specific config (or merge with existing)
cp terraform.tfvars.phase2 terraform.tfvars

# Edit if needed (e.g., change Aurora capacity for your environment)
vim terraform.tfvars
```

**Key values to verify in terraform.tfvars:**
```hcl
enable_phase2          = true           # ✅ Must be true
max_aurora_capacity    = 4              # ✅ Adjust for your environment
min_aurora_capacity    = 0.5            # ✅ For auto-scaling
rds_backup_retention   = 35             # ✅ Retention period
environment            = "dev"          # ✅ Must match your env
```

---

### STEP 3: Initialize Terraform (First Time Only)

```bash
# From: /workspaces/securebase-app/landing-zone/environments/dev

terraform init

# Expected output:
# ✅ Terraform has been successfully configured!
# ✅ The backend will be stored in './terraform.tfstate'
```

**Note:** If you have a remote backend configured (S3), Terraform will connect to it. Otherwise, local state is created.

---

### STEP 4: Validate Phase 2 Configuration

```bash
# Validate Terraform syntax
terraform validate

# Expected output:
# ✅ Success! The configuration is valid.
```

---

### STEP 5: Create Terraform Plan

```bash
# Generate plan (this does NOT apply changes, only shows what will be created)
terraform plan -out=tfplan.phase2

# Expected: ~50-100 new resources to be created:
#   - Aurora cluster
#   - RDS Proxy
#   - DynamoDB tables (cache, sessions, metrics)
#   - KMS key
#   - Security groups
#   - IAM roles
#   - Subnets (if not provided)
#   - VPC (if not provided)
```

**Review the plan carefully:**
```bash
# Save plan to file for review
terraform plan -out=tfplan.phase2 > plan.log 2>&1

# Count resources
grep "will be created" plan.log
grep "will be destroyed" plan.log  # Should be empty for initial deploy

# Check for any errors
grep -i "error" plan.log
```

**Example output to expect:**
```
Plan: 85 to add, 0 to change, 0 to destroy.
```

---

### STEP 6: Apply Phase 2 Terraform

**⚠️ IMPORTANT:** This step WILL create AWS resources and incur charges.

```bash
# Apply the plan (creates infrastructure in AWS)
terraform apply tfplan.phase2

# Enter 'yes' when prompted

# ⏱️ WAIT: This typically takes 15-20 minutes for Aurora cluster creation
# You can monitor in another terminal:
aws rds describe-db-clusters --db-cluster-identifier "securebase-phase2-dev" --query 'DBClusters[0].Status'
# Status will be: "creating" → "available" (when ready)
```

**Monitor Progress:**
```bash
# In separate terminal, watch Aurora status
watch -n 10 'aws rds describe-db-clusters --db-cluster-identifier securebase-phase2-dev --query "DBClusters[0].Status"'

# Once "available", proceed to next step
```

---

### STEP 7: Extract Database Credentials

Once Terraform apply completes:

```bash
# Get database connection details
export DB_CLUSTER_ID="securebase-phase2-dev"
export AWS_REGION="us-east-1"

# Get Aurora endpoint
export DB_HOST=$(aws rds describe-db-clusters \
  --db-cluster-identifier $DB_CLUSTER_ID \
  --region $AWS_REGION \
  --query 'DBClusters[0].Endpoint' \
  --output text)

export DB_PORT=5432
export DB_NAME="securebase"

# Get password from Secrets Manager (created by Terraform)
export DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id rds-admin-password-${DB_CLUSTER_ID} \
  --region $AWS_REGION \
  --query 'SecretString' \
  --output text | jq -r '.password // .')

echo "Database connection details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: adminuser"
echo "  Password: ****"  # Don't echo the actual password!
```

**Verify connectivity:**
```bash
psql -h $DB_HOST -p $DB_PORT -U adminuser -d postgres -c "SELECT version();"

# Expected: PostgreSQL 15.x ... on x86_64-pc-linux-gnu
```

---

### STEP 8: Initialize Database Schema

```bash
# Navigate to database scripts
cd /workspaces/securebase-app/phase2-backend/database

# Review schema (15 tables + RLS policies)
cat schema.sql | head -50

# Run initialization script
bash init_database.sh
# Pass credentials via environment variables or script will prompt

# The script will:
# ✅ Create 15+ PostgreSQL tables
# ✅ Enable Row-Level Security (RLS)
# ✅ Create application roles (admin_role, app_role, auditor_role)
# ✅ Create audit trail tables
# ✅ Set up indexes and stored procedures
# ⏱️ Duration: ~2-5 minutes
```

**Verify schema creation:**
```bash
# List all tables
psql -h $DB_HOST -U adminuser -d $DB_NAME -c "\dt"

# Expected output (15+ tables):
# customers
# invoices
# metrics
# support_tickets
# cost_forecasts
# audit_log
# ... (and more)

# Check RLS policies
psql -h $DB_HOST -U adminuser -d $DB_NAME -c "\d customers"
# Should show: Policies: customer_isolation ... USING...
```

---

### STEP 9: Save Terraform Outputs

```bash
# From: /workspaces/securebase-app/landing-zone/environments/dev

# Get all output values
terraform output -json > phase2-outputs.json

# Display key outputs
echo "=== Phase 2 Terraform Outputs ==="
terraform output rds_cluster_endpoint
terraform output rds_proxy_endpoint
terraform output lambda_execution_role_arn
terraform output dynamodb_table_names
terraform output kms_key_id

# Save to file for documentation
terraform output > phase2-deployment.txt
```

**Expected outputs:**
```
rds_cluster_endpoint = "securebase-phase2-dev.c1234567890.us-east-1.rds.amazonaws.com"
rds_proxy_endpoint   = "securebase-phase2-dev-proxy.c1234567890.us-east-1.rds.amazonaws.com"
lambda_execution_role_arn = "arn:aws:iam::123456789012:role/securebase-lambda-exec"
dynamodb_table_names = ["securebase-cache", "securebase-sessions", "securebase-metrics"]
kms_key_id           = "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
```

---

### STEP 10: Deploy Lambda Functions

```bash
# Navigate to Lambda functions
cd /workspaces/securebase-app/phase2-backend

# Check functions
ls -la functions/
# Expected: auth_v2.py, billing_worker.py, support_tickets.py, cost_forecasting.py

# Create Lambda layer with dependencies
mkdir -p lambda_layer/python
pip install -r requirements.txt -t lambda_layer/python/

# Verify layer structure
ls -la lambda_layer/python/ | head -10

# Package layer
cd lambda_layer
zip -r ../layer.zip .
cd ..

# Publish layer (optional, or use Terraform)
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name securebase-db-utils \
  --zip-file fileb://layer.zip \
  --compatible-runtimes python3.11 python3.12 \
  --region us-east-1 \
  --query 'LayerVersionArn' \
  --output text)

echo "Lambda Layer ARN: $LAYER_ARN"
```

**Deploy individual functions:**
```bash
# Get Lambda execution role ARN
LAMBDA_ROLE=$(terraform output lambda_execution_role_arn)

# Get database credentials (from Step 7)
DB_HOST=$(terraform output rds_cluster_endpoint)

# Deploy auth_v2 function
cd functions
zip -r ../auth_v2.zip auth_v2.py

aws lambda create-function \
  --function-name securebase-auth \
  --runtime python3.11 \
  --role $LAMBDA_ROLE \
  --handler auth_v2.lambda_handler \
  --zip-file fileb://../auth_v2.zip \
  --timeout 30 \
  --memory-size 256 \
  --layers $LAYER_ARN \
  --environment "Variables={DB_HOST=$DB_HOST,DB_NAME=securebase,DB_USER=app_user,DB_PASSWORD=$DB_PASSWORD}" \
  --region us-east-1

# Repeat for other functions:
# - billing_worker.py → securebase-billing
# - support_tickets.py → securebase-support
# - cost_forecasting.py → securebase-forecasting
```

---

### STEP 11: Configure API Gateway

```bash
# List existing API Gateways (from Phase 1)
aws apigateway get-rest-apis --region us-east-1

# If no API exists, create one
api_id=$(aws apigateway create-rest-api \
  --name securebase-api \
  --description "SecureBase Phase 2 API" \
  --endpoint-configuration types=REGIONAL \
  --region us-east-1 \
  --query 'id' \
  --output text)

echo "API Gateway ID: $api_id"

# Get root resource ID
root_id=$(aws apigateway get-resources \
  --rest-api-id $api_id \
  --query 'items[0].id' \
  --output text)

# Create /cost resource
cost_resource=$(aws apigateway create-resource \
  --rest-api-id $api_id \
  --parent-id $root_id \
  --path-part cost \
  --query 'id' \
  --output text)

# Create /cost/forecast resource
forecast_resource=$(aws apigateway create-resource \
  --rest-api-id $api_id \
  --parent-id $cost_resource \
  --path-part forecast \
  --query 'id' \
  --output text)

echo "Forecast resource created: $forecast_resource"

# Continue with other endpoints (/support/tickets, /invoices, etc.)
```

---

### STEP 12: Test Phase 2 Deployment

```bash
# Test database connectivity from Lambda
aws lambda invoke \
  --function-name securebase-auth \
  --payload '{"test": true}' \
  --region us-east-1 \
  response.json

cat response.json

# Expected: {"statusCode": 200, "body": "..."}
```

**End-to-end test:**
```bash
# Test API endpoint (if API Gateway is configured)
curl -X GET https://[api-id].execute-api.us-east-1.amazonaws.com/dev/cost/forecast \
  -H "Authorization: Bearer $(aws iam get-access-key-last-used --query 'AccessKeyMetadata.AccessKeyId' --output text)" \
  -H "Content-Type: application/json"

# Check Lambda logs
aws logs tail /aws/lambda/securebase-auth --follow
```

---

### STEP 13: Document Deployment

```bash
# Create deployment record
cat > PHASE2_DEPLOYMENT_LOG.txt <<EOF
# Phase 2 Deployment Log

Date: $(date)
Environment: dev
Status: ✅ COMPLETE

## Resources Created
- Aurora Cluster: $(terraform output rds_cluster_endpoint)
- RDS Proxy: $(terraform output rds_proxy_endpoint)
- Lambda Functions: 4 deployed
- Database Tables: 15+ tables with RLS
- DynamoDB Tables: 3 (cache, sessions, metrics)
- KMS Key: $(terraform output kms_key_id)

## Database Connection
Host: $(terraform output rds_cluster_endpoint)
Port: 5432
Database: securebase
User: adminuser

## API Gateway
Base URL: [API_ID].execute-api.us-east-1.amazonaws.com
Endpoints: /cost/forecast, /support/tickets, /invoices, /metrics

## Next Steps
1. Deploy Phase 3a (Portal UI)
2. Deploy Phase 3b (Advanced Features)
3. Configure monitoring and alerts
4. Run production readiness checklist

EOF

cat PHASE2_DEPLOYMENT_LOG.txt
```

---

## ⚠️ Troubleshooting

### Issue: "Aurora cluster creation timeout"

**Symptom:** Terraform times out after 20+ minutes

**Fix:**
```bash
# Check Aurora status in AWS Console or CLI
aws rds describe-db-clusters --db-cluster-identifier securebase-phase2-dev

# If stuck, delete and retry
aws rds delete-db-cluster \
  --db-cluster-identifier securebase-phase2-dev \
  --skip-final-snapshot

# Retry Terraform
terraform apply -auto-approve
```

---

### Issue: "Cannot connect to RDS database"

**Symptom:** `psql` connection refused or timeout

**Fix:**
```bash
# Verify security group allows traffic
SECURITY_GROUP=$(aws rds describe-db-clusters \
  --db-cluster-identifier securebase-phase2-dev \
  --query 'DBClusters[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

# Check ingress rules
aws ec2 describe-security-groups --group-ids $SECURITY_GROUP

# Add 5432 ingress if missing
aws ec2 authorize-security-group-ingress \
  --group-id $SECURITY_GROUP \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0  # ⚠️ Dev only; restrict in production
```

---

### Issue: "Lambda layer zip file too large"

**Symptom:** "An error occurred (RequestEntityTooLarge) when calling the PublishLayerVersion operation"

**Fix:**
```bash
# Check size
du -sh lambda_layer/

# Remove unnecessary files
cd lambda_layer/python
rm -rf *.dist-info/ __pycache__ *.pyc
cd ..

# Re-zip
zip -r ../layer.zip .

# Try again
aws lambda publish-layer-version ...
```

---

## ✅ Success Criteria

- [x] Terraform plan shows ~85 resources to create
- [x] terraform apply completes without errors (~15-20 min)
- [x] Aurora cluster transitions to "available" status
- [x] Database schema initializes (15+ tables created)
- [x] psql can connect to database with adminuser
- [x] All 4 Lambda functions deploy successfully
- [x] API Gateway endpoints respond with 200 OK
- [x] Lambda functions can read from database
- [x] Cost logs under $50/month baseline

---

## 📊 Expected Costs

After Phase 2 deployment (monthly):
- **Aurora Serverless v2:** $40-80 (scales with usage)
- **RDS Proxy:** $5/month
- **Lambda:** $0-10 (1M free invocations/month)
- **DynamoDB:** $0-5 (on-demand pricing)
- **Data Transfer:** $0-10
- **KMS:** ~$1

**Total: ~$50-120/month** (dev environment, will be lower with reserved capacity)

---

## 🎯 Next Steps

Once Phase 2 is complete:

1. **Phase 3a (Portal UI)** → Deploy React frontend
   - Requires: Phase 2 API endpoints live
   - Duration: 1-2 hours

2. **Phase 3b (Advanced Features)** → WebSockets, notifications, cost forecasting
   - Requires: Phase 3a portal deployed
   - Duration: 2-3 hours

3. **Monitoring & Alerts** → CloudWatch, alarms, dashboards
   - Duration: 1 hour

4. **Production Readiness** → Security audit, load testing, compliance verification
   - Duration: 2-3 days

---

**Document Version:** 2.0  
**Last Updated:** January 19, 2026  
**Status:** ✅ Ready for deployment
