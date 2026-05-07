# Phase 2 Deployment - Manual Commands

Copy and paste these commands one at a time into your terminal.

---

## STEP 1: Navigate to Terraform Directory

```bash
cd /workspaces/securebase-app/landing-zone/environments/dev
pwd
```

Expected: `/workspaces/securebase-app/landing-zone/environments/dev`

---

## STEP 2: Backup and Configure

```bash
# Backup existing config
cp terraform.tfvars terraform.tfvars.backup.$(date +%s)

# Copy Phase 2 config
cp terraform.tfvars.phase2 terraform.tfvars

# Verify config loaded
head -5 terraform.tfvars
```

Expected: Shows Phase 2 variables (enable_phase2 = true, etc.)

---

## STEP 3: Initialize Terraform

```bash
terraform init
```

Expected: "Terraform has been successfully configured!"

---

## STEP 4: Validate Configuration

```bash
terraform validate
```

Expected: "Success! The configuration is valid."

---

## STEP 5: Create Plan

```bash
terraform plan -out=tfplan.phase2
```

Expected: Shows ~85 resources to be created (no errors)

---

## STEP 6: Review Plan Output

```bash
# See summary
grep "Plan:" tfplan.phase2.log 2>/dev/null || echo "Plan created successfully"

# Or view in detail
terraform show tfplan.phase2 | head -50
```

---

## STEP 7: Apply Terraform (⚠️ This creates AWS resources)

```bash
terraform apply tfplan.phase2
```

**IMPORTANT:** This will:
- Create Aurora cluster (~15-20 minutes)
- Create RDS Proxy
- Create DynamoDB tables
- Create KMS key
- Create security groups

Cost: ~$50-120/month for dev environment

---

## STEP 8: Monitor Deployment

While terraform apply is running, in a NEW terminal:

```bash
# Watch Aurora cluster status
watch -n 10 'aws rds describe-db-clusters --db-cluster-identifier "securebase-phase2-dev" --query "DBClusters[0].Status"'

# Expected progression: creating → available
```

---

## STEP 9: Extract Database Connection Details

Once terraform apply completes:

```bash
cd /workspaces/securebase-app/landing-zone/environments/dev

# Get database endpoint
terraform output -raw rds_cluster_endpoint

# Get RDS Proxy endpoint
terraform output -raw rds_proxy_endpoint

# Get Lambda role
terraform output -raw lambda_execution_role_arn

# Get DynamoDB tables
terraform output dynamodb_table_names

# Save all outputs
terraform output -json > phase2-outputs.json
```

---

## STEP 10: Get Database Password

```bash
# From Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id rds-admin-password-securebase-phase2-dev \
  --query 'SecretString' \
  --output text | jq -r '.password'
```

---

## STEP 11: Test Database Connection

```bash
# Set environment variables
export DB_HOST=$(terraform output -raw rds_cluster_endpoint)
export DB_PORT=5432
export DB_NAME=securebase
export DB_USER=adminuser
export DB_PASSWORD="[paste password from Step 10]"

# Test connection
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT version();"
```

Expected: PostgreSQL version output

---

## STEP 12: Initialize Database Schema

```bash
cd /workspaces/securebase-app/phase2-backend/database

# Review schema
head -50 schema.sql

# Run initialization (if password available)
export PGPASSFILE=/tmp/.pgpass
cat > $PGPASSFILE <<EOF
$DB_HOST:$DB_PORT:*:$DB_USER:$DB_PASSWORD
EOF
chmod 600 $PGPASSFILE

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f schema.sql
```

Expected: No errors, database tables created

---

## STEP 13: Verify Database Schema

```bash
# List all tables
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"

# Expected: 15+ tables (customers, invoices, support_tickets, etc.)

# Check RLS policies
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d customers" | grep -i policy
```

---

## STEP 14: Save Deployment Info

```bash
cd /workspaces/securebase-app/landing-zone/environments/dev

# Create deployment record
cat > PHASE2_DEPLOYMENT_INFO.txt <<EOF
Date: $(date)
Status: ✅ Deployed
Environment: dev
Region: us-east-1

Database Endpoint: $DB_HOST
Database Name: $DB_NAME
Database User: adminuser

Aurora Cluster: securebase-phase2-dev
RDS Proxy: securebase-phase2-dev-proxy

Lambda Execution Role: $(terraform output -raw lambda_execution_role_arn)
KMS Key: $(terraform output -raw kms_key_id)

All outputs: phase2-outputs.json
EOF

cat PHASE2_DEPLOYMENT_INFO.txt
```

---

## ✅ Phase 2 Infrastructure Complete!

Next steps:
1. ✅ Phase 2 infrastructure deployed
2. ⏳ Deploy Lambda functions (see PHASE2_TERRAFORM_DEPLOYMENT_GUIDE.md Step 10)
3. ⏳ Configure API Gateway
4. ⏳ Deploy Phase 3a Portal
5. ⏳ Deploy Phase 3b Advanced Features

---

## 🔧 Troubleshooting

**Issue: terraform: command not found**
- Solution: Install Terraform (see installation guide)

**Issue: AWS credentials not found**
- Solution: Run `aws configure` first

**Issue: Aurora taking too long**
- Solution: Normal for first deployment (10-20 minutes)
- Monitor: Check AWS RDS console

**Issue: Cannot connect to database**
- Solution: Security group may not allow traffic
- Check: `aws ec2 describe-security-groups --group-ids [sg-id]`

For more help, see: PHASE2_TERRAFORM_DEPLOYMENT_GUIDE.md
