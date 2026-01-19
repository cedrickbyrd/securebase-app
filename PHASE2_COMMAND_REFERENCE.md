# Phase 2 Production Deployment - Command Reference

## 🚀 ONE-COMMAND DEPLOYMENT

```bash
bash /workspaces/securebase-app/deploy-phase2-production.sh
```

---

## 📋 Manual Deployment Commands

If you prefer to run commands manually, copy-paste them one at a time:

### 1. Navigate to Terraform Directory
```bash
cd /workspaces/securebase-app/landing-zone/environments/dev
pwd  # Verify location
```

### 2. Backup & Configure
```bash
cp terraform.tfvars terraform.tfvars.backup.$(date +%s)
cp terraform.tfvars.phase2 terraform.tfvars
head -10 terraform.tfvars  # Verify Phase 2 config loaded
```

### 3. Initialize Terraform
```bash
terraform init
```

### 4. Validate Configuration
```bash
terraform validate
```

### 5. Create Deployment Plan
```bash
terraform plan -out=tfplan.phase2
```

### 6. Review Plan Summary
```bash
terraform show tfplan.phase2 | grep -E "will be created|will be changed|will be destroyed"
```

### 7. Deploy Infrastructure (⚠️ This is the main deployment step)
```bash
terraform apply tfplan.phase2
```

**⏱️ Wait 15-20 minutes for Aurora cluster creation**

### 8. Extract Database Endpoint
```bash
terraform output -raw rds_cluster_endpoint
# Copy the output for next steps
```

### 9. Extract RDS Proxy Endpoint
```bash
terraform output -raw rds_proxy_endpoint
```

### 10. Get Lambda Execution Role
```bash
terraform output -raw lambda_execution_role_arn
```

### 11. Get DynamoDB Tables
```bash
terraform output dynamodb_table_names
```

### 12. Export Database Details for Later Use
```bash
# Set environment variables for reference
export DB_HOST=$(terraform output -raw rds_cluster_endpoint)
export DB_PORT=5432
export DB_NAME=securebase
export DB_USER=adminuser
export DB_REGION=us-east-1
export DB_CLUSTER_ID="securebase-phase2-dev"

# Verify
echo "Database Host: $DB_HOST"
```

### 13. Retrieve Database Password
```bash
# From Secrets Manager
export DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id rds-admin-password-securebase-phase2-dev \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq -r '.password')

echo "Password retrieved"
```

### 14. Test Database Connection
```bash
# Create pgpass file for passwordless authentication
cat > /tmp/.pgpass <<EOF
$DB_HOST:$DB_PORT:*:$DB_USER:$DB_PASSWORD
EOF
chmod 600 /tmp/.pgpass
export PGPASSFILE=/tmp/.pgpass

# Test connection
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT version();"
```

### 15. Save Deployment Outputs
```bash
terraform output -json > phase2-deployment-outputs.json
terraform output > phase2-deployment.txt
cat phase2-deployment.txt
```

### 16. Create Deployment Report
```bash
cat > PHASE2_DEPLOYMENT_COMPLETE.txt <<EOF
# Phase 2 Production Deployment Complete

Date: $(date)
Status: ✅ COMPLETE

## Deployment Details
- AWS Account: $(aws sts get-caller-identity --query Account --output text)
- Region: us-east-1
- Environment: dev

## Database Connection
- Host: $DB_HOST
- Port: $DB_PORT
- Database: $DB_NAME
- User: $DB_USER
- Password: Stored in Secrets Manager

## AWS Resources Created
- Aurora Cluster: securebase-phase2-dev
- RDS Proxy: securebase-phase2-dev-proxy
- DynamoDB Tables: cache, sessions, metrics
- KMS Key: $(terraform output -raw kms_key_id)
- Lambda Role: $LAMBDA_ROLE

## Next Steps
1. Initialize database schema
2. Deploy Lambda functions
3. Configure API Gateway
4. Deploy Phase 3a Portal UI

## Monitoring
- RDS: https://console.aws.amazon.com/rds
- DynamoDB: https://console.aws.amazon.com/dynamodb
- CloudWatch Logs: https://console.aws.amazon.com/logs

EOF

cat PHASE2_DEPLOYMENT_COMPLETE.txt
```

---

## 🔍 Verification Commands

### Check Aurora Status
```bash
aws rds describe-db-clusters \
  --db-cluster-identifier securebase-phase2-dev \
  --query 'DBClusters[0].[DBClusterIdentifier,Status,Engine,EngineVersion]' \
  --output text
```

### Check RDS Proxy Status
```bash
aws rds describe-db-proxies \
  --db-proxy-name securebase-phase2-dev-proxy \
  --query 'DBProxies[0].[DBProxyName,Status]' \
  --output text
```

### List DynamoDB Tables
```bash
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `securebase`)]' \
  --output table
```

### Verify Security Groups
```bash
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*phase2*" \
  --query 'SecurityGroups[*].[GroupName,GroupId,VpcId]' \
  --output table
```

### Check IAM Roles
```bash
aws iam list-roles \
  --query 'Roles[?contains(RoleName, `lambda-exec`)].{Name:RoleName,Arn:Arn}' \
  --output table
```

### View KMS Keys
```bash
aws kms describe-key \
  --key-id alias/securebase-phase2 \
  --query 'KeyMetadata.[KeyId,Description,KeyState]' \
  --output text 2>/dev/null || echo "Key not found"
```

---

## 📊 Post-Deployment Commands

### View All Terraform Outputs
```bash
cd /workspaces/securebase-app/landing-zone/environments/dev
terraform output
```

### Export Outputs to JSON
```bash
terraform output -json > /tmp/phase2-outputs.json
jq '.' /tmp/phase2-outputs.json
```

### Check Terraform State
```bash
terraform state list
```

### Backup Terraform State
```bash
cp terraform.tfstate terraform.tfstate.backup.$(date +%s)
```

---

## 🔐 Database Access Commands

### Connect to PostgreSQL (if psql available)
```bash
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
```

### Run SQL Query
```bash
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres \
  -c "SELECT version();"
```

### List Tables (after schema init)
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"
```

### Check RLS Policies
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d customers" | grep -i policy
```

---

## 🛑 Rollback Commands (If Needed)

### Destroy All Phase 2 Resources
```bash
cd /workspaces/securebase-app/landing-zone/environments/dev

# Plan destruction
terraform plan -destroy -out=destroy.plan

# Execute destruction (⚠️ This will DELETE resources)
terraform destroy -auto-approve
```

### Restore from Backup
```bash
# Restore config
cp terraform.tfvars.backup.[TIMESTAMP] terraform.tfvars

# Restore state (if you have backup)
cp terraform.tfstate.backup.[TIMESTAMP] terraform.tfstate

# Re-apply
terraform apply
```

---

## 📈 Monitoring Commands

### Watch Aurora Cluster Creation
```bash
watch -n 10 'aws rds describe-db-clusters \
  --db-cluster-identifier securebase-phase2-dev \
  --query "DBClusters[0].[Status,Engine,EngineVersion,Endpoint]" \
  --output text'
```

### Monitor RDS Proxy Status
```bash
watch -n 10 'aws rds describe-db-proxies \
  --db-proxy-name securebase-phase2-dev-proxy \
  --query "DBProxies[0].[Status,DebugLoggingEnabled]" \
  --output text'
```

### Check Aurora CPU Usage
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBClusterIdentifier,Value=securebase-phase2-dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --output table
```

### Check DynamoDB Metrics
```bash
aws cloudwatch list-metrics \
  --namespace AWS/DynamoDB \
  --query 'Metrics[?contains(Dimensions[0].Value, `securebase`)]' \
  --output table
```

---

## 🔧 Troubleshooting Commands

### Check Terraform Errors
```bash
# Check most recent errors
terraform state list
terraform state show 'module.phase2_database'
```

### Verify AWS Credentials
```bash
aws sts get-caller-identity
```

### Check Available Regions
```bash
aws ec2 describe-regions --output table
```

### List VPCs
```bash
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,CidrBlock,Tags[0].Value]' --output table
```

### Check Security Group Rules
```bash
aws ec2 describe-security-groups \
  --group-names "*phase2*rds*" \
  --query 'SecurityGroups[*].[GroupName,GroupId,IpPermissions]' \
  --output json | jq '.'
```

---

## 📝 Notes

- **Aurora Initialization Time:** 10-20 minutes (normal for first deploy)
- **Connection Pooling:** Reduces Lambda cold starts significantly
- **Auto-scaling:** Database automatically scales between 0.5-4 ACUs
- **Backup:** 35-day retention configured by default
- **Encryption:** All data encrypted with KMS key
- **Audit Logging:** CloudTrail and PostgreSQL audit logs enabled
- **Cost:** ~$50-120/month for dev, 2-4x for production

---

## 📚 Additional Resources

- Full deployment guide: [PHASE2_TERRAFORM_DEPLOYMENT_GUIDE.md](PHASE2_TERRAFORM_DEPLOYMENT_GUIDE.md)
- Quick reference: [PHASE2_PRODUCTION_DEPLOYMENT.md](PHASE2_PRODUCTION_DEPLOYMENT.md)
- Visual guide: [PHASE2_VISUAL_GUIDE.md](PHASE2_VISUAL_GUIDE.md)
- Manual commands: [PHASE2_MANUAL_COMMANDS.md](PHASE2_MANUAL_COMMANDS.md)

---

**Status:** Ready for Production Deployment  
**Date:** January 19, 2026  
**Last Updated:** January 19, 2026
