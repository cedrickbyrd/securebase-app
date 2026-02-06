# SecureBase Demo Backend - Deployment Guide

Complete step-by-step deployment guide for SecureBase Phase 2 Demo Backend.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Frontend Integration](#frontend-integration)
6. [Monitoring Setup](#monitoring-setup)
7. [Rollback Procedure](#rollback-procedure)

---

## Prerequisites

### Required Tools

- ✅ **Terraform** >= 1.0 ([Install Guide](https://terraform.io/downloads))
- ✅ **AWS CLI** >= 2.0 ([Install Guide](https://aws.amazon.com/cli/))
- ✅ **Python** >= 3.11
- ✅ **jq** (for JSON parsing)
- ✅ **curl** (for API testing)

### AWS Requirements

- ✅ AWS Account with appropriate permissions
- ✅ AWS CLI configured with credentials
- ✅ Permissions required:
  - `lambda:*`
  - `apigateway:*`
  - `dynamodb:*`
  - `iam:*` (for Lambda execution role)
  - `logs:*` (for CloudWatch)

### Verify Prerequisites

```bash
# Check Terraform
terraform version

# Check AWS CLI
aws --version
aws sts get-caller-identity

# Check Python
python3 --version

# Check jq
jq --version
```

---

## Pre-Deployment Checklist

### 1. Review Configuration

```bash
cd landing-zone/modules/demo-backend

# Review module configuration
cat README.md
cat example.tf

# Review Lambda functions
ls -la lambda/
cat lambda/auth.py | head -50

# Review data files
ls -la data/
cat data/customers.json | jq
```

### 2. Estimate Costs

**Expected monthly cost:** ~$0.36 - $2.00

| Service | Estimated Cost |
|---------|---------------|
| DynamoDB | $0.25 |
| Lambda | $0.02 |
| API Gateway | $0.04 |
| CloudWatch | $0.05 |

### 3. Review Security

- [ ] JWT secret will be set (change default)
- [ ] CORS configured for your domain
- [ ] CloudWatch logging enabled
- [ ] DynamoDB encryption enabled
- [ ] IAM roles follow least privilege

---

## Deployment Steps

### Step 1: Add Module to Environment

```bash
# Navigate to your environment
cd landing-zone/environments/dev

# Backup current main.tf
cp main.tf main.tf.backup

# Add demo-backend module
cat >> main.tf <<'EOF'

#############################################################################
# Demo Backend Module
#############################################################################

module "demo_backend" {
  source = "../../modules/demo-backend"
  
  project_name = "securebase"
  environment  = "demo"
  
  # IMPORTANT: Change this in production!
  jwt_secret = "your-secure-jwt-secret-here-change-me"
  
  auto_populate_data = true
  log_retention_days = 7
  
  enable_point_in_time_recovery = false  # Set true for production
  
  tags = {
    Project     = "SecureBase"
    Environment = "Demo"
    Deployment  = "Phase2-Backend"
  }
}

# Outputs
output "demo_backend_api_endpoint" {
  value = module.demo_backend.api_endpoint
}

output "demo_backend_health_check" {
  value = module.demo_backend.health_check_url
}

output "demo_backend_credentials" {
  value     = module.demo_backend.demo_credentials
  sensitive = true
}
EOF

echo "✓ Module configuration added to main.tf"
```

### Step 2: Initialize Terraform

```bash
# Initialize Terraform (downloads providers, modules)
terraform init

# Validate configuration
terraform validate

# Format configuration
terraform fmt
```

### Step 3: Review Plan

```bash
# Generate and review execution plan
terraform plan -out=demo-backend.plan

# Review what will be created:
# - 3 DynamoDB tables
# - 5 Lambda functions
# - 1 API Gateway
# - 5 CloudWatch log groups
# - IAM roles and policies
```

### Step 4: Apply Configuration

```bash
# Apply the plan
terraform apply demo-backend.plan

# Or apply directly (with confirmation)
terraform apply

# This will take ~2-3 minutes
```

### Step 5: Capture Outputs

```bash
# Save API endpoint
API_ENDPOINT=$(terraform output -raw demo_backend_api_endpoint)
echo $API_ENDPOINT > /tmp/demo-backend-endpoint.txt

# Save demo credentials
terraform output -json demo_backend_credentials > /tmp/demo-credentials.json

# Display test commands
terraform output demo_backend_test_commands
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
API_ENDPOINT=$(terraform output -raw demo_backend_api_endpoint)

# Test health endpoint
curl -s $API_ENDPOINT/health | jq

# Expected output:
# {
#   "status": "healthy",
#   "timestamp": 1738800000,
#   "version": "1.0.0",
#   "service": "SecureBase Demo Backend",
#   "components": {
#     "api": "healthy",
#     "database": "healthy",
#     "auth": "healthy"
#   }
# }
```

### 2. Test Authentication

```bash
# Login with demo credentials
TOKEN=$(curl -s -X POST $API_ENDPOINT/auth \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "login",
    "email": "admin@healthcorp.example.com",
    "password": "demo-healthcare-2026"
  }' | jq -r '.token')

echo "Token received: ${TOKEN:0:50}..."

# Verify token
curl -s -X POST $API_ENDPOINT/auth \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"verify\",\"token\":\"$TOKEN\"}" | jq
```

### 3. Test Data Endpoints

```bash
# Get customers
curl -s $API_ENDPOINT/customers \
  -H "Authorization: Bearer $TOKEN" | jq '. | length'
# Expected: 5

# Get invoices
curl -s $API_ENDPOINT/invoices \
  -H "Authorization: Bearer $TOKEN" | jq '. | length'
# Expected: 30

# Get metrics
curl -s $API_ENDPOINT/metrics \
  -H "Authorization: Bearer $TOKEN" | jq .monthly_cost
# Expected: 58240
```

### 4. Run Full Test Suite

```bash
cd ../../modules/demo-backend/scripts
./test_api.sh $API_ENDPOINT

# Should show:
# Passed: 15
# Failed: 0
# All tests passed!
```

### 5. Verify DynamoDB Tables

```bash
# List tables
aws dynamodb list-tables | grep securebase-demo

# Check customers
aws dynamodb scan \
  --table-name securebase-demo-customers-demo \
  --select COUNT

# Check invoices
aws dynamodb scan \
  --table-name securebase-demo-invoices-demo \
  --select COUNT

# Check metrics
aws dynamodb get-item \
  --table-name securebase-demo-metrics-demo \
  --key '{"id":{"S":"global"}}' | jq .Item.monthly_cost
```

### 6. Check CloudWatch Logs

```bash
# List log groups
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/securebase-demo

# View recent logs
aws logs tail /aws/lambda/securebase-demo-auth-demo \
  --since 10m
```

---

## Frontend Integration

### Option 1: Netlify Environment Variables

```bash
# Get API endpoint
API_ENDPOINT=$(terraform output -raw demo_backend_api_endpoint)

# Set in Netlify
netlify env:set VITE_API_ENDPOINT $API_ENDPOINT
netlify env:set VITE_DEMO_MODE false

# Redeploy
cd phase3a-portal
netlify deploy --prod
```

### Option 2: Manual .env Configuration

```bash
# Create .env file
cat > phase3a-portal/.env.production <<EOF
VITE_API_ENDPOINT=$API_ENDPOINT
VITE_DEMO_MODE=false
EOF

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

### Update Frontend Code

Update `phase3a-portal/src/services/api.js`:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT;

export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email, password })
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  const data = await response.json();
  localStorage.setItem('auth_token', data.token);
  return data;
}

export async function fetchCustomers() {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/customers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

// ... similar updates for other endpoints
```

---

## Monitoring Setup

### CloudWatch Alarms

```bash
# Create alarm for Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name securebase-demo-lambda-errors \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1

# Create alarm for API Gateway 5xx errors
aws cloudwatch put-metric-alarm \
  --alarm-name securebase-demo-api-5xx \
  --alarm-description "Alert on API 5xx errors" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

### Log Insights Queries

```bash
# View auth logs
aws logs start-query \
  --log-group-name /aws/lambda/securebase-demo-auth-demo \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc'
```

---

## Rollback Procedure

### Quick Rollback

```bash
# Destroy demo-backend module only
cd landing-zone/environments/dev
terraform destroy -target=module.demo_backend

# Confirm: yes
```

### Full Rollback

```bash
# Restore backup
cp main.tf.backup main.tf

# Apply to remove module
terraform apply

# Clean up
rm -f demo-backend.plan
rm -f /tmp/demo-backend-endpoint.txt
rm -f /tmp/demo-credentials.json
```

### Data Backup Before Rollback

```bash
# Backup DynamoDB tables (optional)
aws dynamodb scan --table-name securebase-demo-customers-demo > customers-backup.json
aws dynamodb scan --table-name securebase-demo-invoices-demo > invoices-backup.json
aws dynamodb scan --table-name securebase-demo-metrics-demo > metrics-backup.json
```

---

## Troubleshooting

### Issue: Terraform Apply Fails

**Error:** "Error creating Lambda function"

**Solution:**
```bash
# Check IAM permissions
aws iam get-role --role-name securebase-demo-lambda-role-demo

# Verify Lambda package exists
ls -la landing-zone/modules/demo-backend/builds/

# Re-run terraform init
terraform init -upgrade
```

### Issue: Data Not Loading

**Error:** DynamoDB tables are empty

**Solution:**
```bash
# Manually load data
cd landing-zone/modules/demo-backend/scripts
./load_data.sh \
  securebase-demo-customers-demo \
  securebase-demo-invoices-demo \
  securebase-demo-metrics-demo
```

### Issue: CORS Errors

**Error:** "Access-Control-Allow-Origin" missing

**Solution:**
```bash
# Verify CORS headers
curl -I -X OPTIONS $API_ENDPOINT/auth

# Update Lambda functions if needed
# Edit lambda/*.py files to ensure cors_headers() is called
```

---

## Success Criteria

✅ Health check returns 200 OK  
✅ All 5 demo customers can login  
✅ Customers API returns 5 records  
✅ Invoices API returns 30 records  
✅ Metrics API returns aggregated data  
✅ Test suite passes 15/15 tests  
✅ CloudWatch logs show no errors  
✅ Monthly cost < $2  

---

## Next Steps

1. ✅ Deploy backend (complete!)
2. 🔄 Integrate with frontend
3. 🔄 Test end-to-end user flows
4. 🔄 Demo to stakeholders
5. 🔄 Collect feedback
6. 🔄 Plan production deployment

---

**Deployment Time:** ~5 minutes  
**Verification Time:** ~10 minutes  
**Total Time:** ~15 minutes  

**Questions?** See [README.md](README.md) and [QUICKSTART.md](QUICKSTART.md)
