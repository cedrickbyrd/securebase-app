# Phase 4 Component 2 - Quick Reference

## 🚀 Deployment Commands

### Initial Deployment (First Time)
```bash
./deploy-phase4-component2.sh
```

### Redeploy (After Code Changes)
```bash
./redeploy-phase4-component2.sh
```

---

## 📦 What Gets Deployed

| Resource Type | Count | Names |
|--------------|-------|-------|
| DynamoDB Tables | 3 | user-sessions, user-invites, activity-feed |
| Lambda Functions | 3 | user-management, session-management, permission-management |
| IAM Roles | 3 | One per Lambda function |
| CloudWatch Log Groups | 3 | One per Lambda function |
| Secrets Manager | 1 | JWT signing secret |

---

## ⚡ Quick Commands

### Package Lambda Functions
```bash
cd phase2-backend/functions
zip -j ../deploy/user_management.zip user_management.py
zip -j ../deploy/session_management.zip session_management.py
zip -j ../deploy/permission_management.zip rbac_engine.py
```

### Update Single Lambda Function
```bash
# User Management
aws lambda update-function-code \
  --function-name securebase-dev-user-management \
  --zip-file fileb://phase2-backend/deploy/user_management.zip

# Session Management
aws lambda update-function-code \
  --function-name securebase-dev-session-management \
  --zip-file fileb://phase2-backend/deploy/session_management.zip

# Permission Management
aws lambda update-function-code \
  --function-name securebase-dev-permission-management \
  --zip-file fileb://phase2-backend/deploy/permission_management.zip
```

### Check Lambda Status
```bash
aws lambda get-function \
  --function-name securebase-dev-user-management \
  --query 'Configuration.[State,LastUpdateStatus]'
```

### View Lambda Logs
```bash
# Tail live logs
aws logs tail /aws/lambda/securebase-dev-user-management --follow

# Get recent logs
aws logs tail /aws/lambda/securebase-dev-user-management --since 30m
```

### List DynamoDB Tables
```bash
aws dynamodb list-tables | grep securebase-dev
```

### Check DynamoDB Table
```bash
aws dynamodb describe-table \
  --table-name securebase-dev-user-sessions \
  --query 'Table.[TableName,TableStatus,ItemCount]'
```

---

## 🗄️ Database Schema

### Initialize RBAC Schema
```bash
cd phase2-backend/database

# Get Aurora endpoint
AURORA_ENDPOINT=$(cd ../../landing-zone/environments/dev && terraform output -raw aurora_endpoint)

# Get database password from Secrets Manager
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id securebase/dev/database \
  --query SecretString --output text | jq -r .password)

# Initialize schema
PGPASSWORD=$DB_PASSWORD psql \
  -h $AURORA_ENDPOINT \
  -U securebase_app \
  -d securebase \
  -f rbac_schema.sql
```

---

## 🧪 Testing

### Run Unit Tests
```bash
cd phase2-backend/functions
python -m pytest test_user_management.py test_session_management.py -v
```

### Test Lambda Locally
```bash
cd phase2-backend/functions

# Test user_management
python -c "
from user_management import lambda_handler
result = lambda_handler({'httpMethod': 'GET', 'path': '/health'}, {})
print(result)
"
```

### Invoke Lambda in AWS
```bash
# Create test event
cat > test-event.json << 'EOF'
{
  "httpMethod": "GET",
  "path": "/users",
  "headers": {
    "Authorization": "Bearer test-token"
  }
}
EOF

# Invoke
aws lambda invoke \
  --function-name securebase-dev-user-management \
  --payload file://test-event.json \
  --region us-east-1 \
  output.json

cat output.json
```

---

## 🔍 Monitoring

### CloudWatch Metrics
```bash
# Lambda invocations (last hour)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=securebase-dev-user-management \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Lambda errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=securebase-dev-user-management \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### DynamoDB Metrics
```bash
# Read capacity usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=securebase-dev-user-sessions \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

## 🔧 Troubleshooting

### Lambda Not Found
```bash
# Check if function exists
aws lambda list-functions | grep securebase-dev

# If not found, run full deployment
./deploy-phase4-component2.sh
```

### Database Connection Error
```bash
# Check Aurora endpoint
cd landing-zone/environments/dev
terraform output aurora_endpoint

# Test connectivity
nc -zv <aurora-endpoint> 5432
```

### JWT Secret Missing
```bash
# Check if secret exists
aws secretsmanager list-secrets | grep jwt-secret

# Create manually if needed
JWT_SECRET=$(openssl rand -base64 32)
aws secretsmanager create-secret \
  --name "securebase/dev/jwt-secret" \
  --secret-string "$JWT_SECRET"
```

### DynamoDB Table Not Found
```bash
# Check if tables exist
aws dynamodb list-tables | grep securebase-dev

# If missing, run Terraform
cd landing-zone/environments/dev
terraform apply
```

---

## 📚 Documentation

- **Full Deployment Guide:** `DEPLOY_PHASE4_COMPONENT2.md`
- **API Reference:** `docs/TEAM_MANAGEMENT_API.md`
- **Permission Matrix:** `docs/RBAC_PERMISSION_MATRIX.md`
- **Troubleshooting:** `RBAC_TROUBLESHOOTING.md`
- **Architecture:** `docs/RBAC_DESIGN.md`

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| "Module not found" in Terraform | Run `terraform init -upgrade` |
| "Unable to import module" in Lambda | Verify Lambda layer attached |
| "Access denied" on DynamoDB | Check IAM role permissions |
| "Database connection timeout" | Verify security groups, RDS Proxy |
| "JWT verification failed" | Check JWT secret ARN in tfvars |

---

**Quick Reference Version:** 1.0  
**Last Updated:** February 2, 2026
