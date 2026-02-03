# Phase 4 Component 2 - Quick Start Checklist

**Component:** Team Collaboration & RBAC  
**Status:** Ready for Deployment  
**Last Updated:** February 3, 2026

---

## ⚡ 5-Minute Quick Start

### Prerequisites Check

```bash
# 1. Check AWS credentials
aws sts get-caller-identity

# 2. Verify Phase 2 infrastructure exists
aws rds describe-db-clusters --db-cluster-identifier securebase-dev

# 3. Confirm Lambda packages exist
ls -lh phase2-backend/deploy/{user_management,session_management,permission_management}.zip
```

---

## 🚀 Deployment Sequence

### 1. Navigate to Environment Directory
```bash
cd landing-zone/environments/dev
```

### 2. Initialize and Deploy Terraform
```bash
# Initialize
terraform init -upgrade

# Plan (review changes)
terraform plan -out=component2.tfplan

# Apply (deploy infrastructure)
terraform apply component2.tfplan
```

**Time:** 3-5 minutes  
**Creates:** 12 AWS resources

---

### 3. Initialize Database Schema
```bash
cd ../../phase2-backend/database

# Get database connection details
PROXY_ENDPOINT=$(terraform -chdir=../../landing-zone/environments/dev output -raw rds_proxy_endpoint)
DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id securebase/dev/rds-password --query SecretString --output text | jq -r .password)

# Apply schema
PGPASSWORD=$DB_PASSWORD psql -h $PROXY_ENDPOINT -U securebase_app -d securebase -f rbac_schema.sql
```

**Time:** 30 seconds  
**Creates:** 6 PostgreSQL tables with RLS

---

### 4. Validate Deployment
```bash
cd ../../..
./validate-phase4-component2.sh
```

**Expected:** All green checkmarks ✓

---

## ✅ Deployment Checklist

- [ ] AWS credentials configured
- [ ] Terraform initialized (`terraform init`)
- [ ] Terraform plan reviewed (`terraform plan`)
- [ ] Infrastructure deployed (`terraform apply`)
- [ ] Database schema applied (`psql ... -f rbac_schema.sql`)
- [ ] Deployment validated (`./validate-phase4-component2.sh`)
- [ ] Lambda functions tested
- [ ] CloudWatch logs monitored

---

## 🔍 Validation Commands

```bash
# Check DynamoDB tables
aws dynamodb list-tables | grep securebase-dev

# Check Lambda functions
aws lambda list-functions | grep securebase-dev

# Check database tables
PGPASSWORD=$DB_PASSWORD psql -h $PROXY_ENDPOINT -U securebase_app -d securebase -c "\dt"

# View Lambda logs
aws logs tail /aws/lambda/securebase-dev-user-management --follow
```

---

## 🐛 Quick Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| Lambda not found | Run `terraform apply` |
| Database connection fails | Check security groups, verify RDS Proxy endpoint |
| Permission denied | Re-apply database schema |
| JWT secret missing | Terraform creates automatically |

**Full Troubleshooting:** See [RBAC_TROUBLESHOOTING.md](docs/RBAC_TROUBLESHOOTING.md)

---

## 📚 Documentation

- **Detailed Deployment:** [PHASE4_COMPONENT2_DEPLOYMENT_GUIDE.md](PHASE4_COMPONENT2_DEPLOYMENT_GUIDE.md)
- **API Reference:** [docs/TEAM_MANAGEMENT_API.md](docs/TEAM_MANAGEMENT_API.md)
- **Permission Matrix:** [docs/RBAC_PERMISSION_MATRIX.md](docs/RBAC_PERMISSION_MATRIX.md)
- **Troubleshooting:** [docs/RBAC_TROUBLESHOOTING.md](docs/RBAC_TROUBLESHOOTING.md)

---

## 🎯 Success Criteria

✅ All checks pass in `./validate-phase4-component2.sh`

**Components Deployed:**
- 3 DynamoDB tables (user-sessions, user-invites, activity-feed)
- 3 Lambda functions (user-management, session-management, permission-management)
- 3 IAM roles
- 3 CloudWatch log groups
- 6 PostgreSQL tables with RLS

---

**Total Time:** ~10 minutes  
**Status:** ✅ Production Ready
