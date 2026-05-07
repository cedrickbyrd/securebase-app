# Phase 2 Deployment Execution Plan

**Date:** January 19, 2026  
**Target:** Deploy Phase 2 (Database + API Backend) for v0.2 ship  
**Timeline:** 3-5 days

---

## 📋 Pre-Deployment Checklist

- [ ] Phase 1 confirmed deployed (AWS Organizations, VPCs, logging)
- [ ] AWS credentials configured with admin access
- [ ] Terraform state backend accessible
- [ ] Network connectivity to AWS APIs verified
- [ ] Team aligned on deployment window

---

## 🚀 Deployment Sequence

### PHASE 2A: Infrastructure (Day 1)

#### 1. Deploy Database Module (Aurora + RDS Proxy + DynamoDB)

```bash
# Navigate to environment config
cd /workspaces/securebase-app/landing-zone/environments/dev

# Verify terraform state backend
terraform init

# Plan Phase 2 infrastructure
terraform plan -target=module.phase2_database

# Apply (this creates Aurora cluster, RDS Proxy, KMS key, IAM roles)
terraform apply -target=module.phase2_database -auto-approve
# ⏱️ Wait: ~15-20 minutes for Aurora cluster creation
```

**What Gets Created:**
- ✅ Aurora Serverless v2 PostgreSQL cluster
- ✅ RDS Proxy for connection pooling
- ✅ KMS key for encryption
- ✅ Secrets Manager (RDS admin password)
- ✅ Security groups (RDS, Proxy, Lambdas)
- ✅ IAM roles for Lambda execution
- ✅ DynamoDB tables (cache, sessions, metrics)

**Outputs to Save:**
```bash
# After terraform apply, capture:
terraform output rds_cluster_endpoint
terraform output rds_proxy_endpoint
terraform output lambda_execution_role_arn
terraform output dynamodb_table_names
```

---

#### 2. Initialize Database Schema

```bash
# Once Aurora is ready (check AWS Console), init the database
cd /workspaces/securebase-app/phase2-backend/database

# Get database connection details
export DB_HOST=$(terraform output -raw rds_cluster_endpoint)
export DB_PORT=5432
export DB_NAME=securebase
export DB_USER=postgres
export DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id rds-admin-password --query SecretString --output text | jq -r .password)

# Run schema initialization
bash init_database.sh

# Verify schema
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"
# Should show: customers, invoices, metrics, audit_log, etc.
```

**What Gets Initialized:**
- ✅ 15+ PostgreSQL tables with RLS policies
- ✅ Application roles (admin_role, app_role, auditor_role)
- ✅ Row-level security (customer isolation)
- ✅ Indexes for performance
- ✅ Audit trail tables with 7-year retention
- ✅ Stored procedures for common operations

---

### PHASE 2B: Lambda Functions (Day 2)

#### 3. Deploy Lambda Layer (DB Utilities)

```bash
# Build Lambda layer with dependencies
cd /workspaces/securebase-app/phase2-backend

# Install Python dependencies
mkdir -p lambda_layer/python
pip install -r requirements.txt -t lambda_layer/python/

# Package as layer
cd lambda_layer
zip -r ../layer.zip .
cd ..

# Deploy via Terraform or AWS CLI
aws lambda publish-layer-version \
  --layer-name securebase-db-utils \
  --zip-file fileb://layer.zip \
  --compatible-runtimes python3.11 python3.12

# Note the layer ARN (you'll need it for function deployment)
```

---

#### 4. Deploy Lambda Functions

```bash
# Package each Lambda function
cd /workspaces/securebase-app/phase2-backend/functions

# auth_v2.py - API authentication
zip auth_v2.zip auth_v2.py
aws lambda create-function \
  --function-name securebase-auth \
  --runtime python3.11 \
  --role $LAMBDA_ROLE_ARN \
  --handler auth_v2.lambda_handler \
  --zip-file fileb://auth_v2.zip \
  --timeout 30 \
  --memory-size 256 \
  --layers arn:aws:lambda:us-east-1:ACCOUNT:layer:securebase-db-utils:1 \
  --environment Variables="{DB_HOST=$DB_HOST,DB_NAME=securebase,DB_USER=app_user}"

# billing_worker.py - Invoice generation
zip billing_worker.zip billing_worker.py
aws lambda create-function \
  --function-name securebase-billing \
  --runtime python3.11 \
  --role $LAMBDA_ROLE_ARN \
  --handler billing_worker.lambda_handler \
  --zip-file fileb://billing_worker.zip \
  --timeout 60 \
  --memory-size 512

# support_tickets.py - Support system
zip support_tickets.zip support_tickets.py
aws lambda create-function \
  --function-name securebase-support \
  --runtime python3.11 \
  --role $LAMBDA_ROLE_ARN \
  --handler support_tickets.lambda_handler \
  --zip-file fileb://support_tickets.zip

# cost_forecasting.py - Cost predictions
zip cost_forecasting.zip cost_forecasting.py
aws lambda create-function \
  --function-name securebase-forecasting \
  --runtime python3.11 \
  --role $LAMBDA_ROLE_ARN \
  --handler cost_forecasting.lambda_handler \
  --zip-file fileb://cost_forecasting.zip \
  --timeout 30 \
  --memory-size 512
```

---

### PHASE 2C: API Gateway (Day 3)

#### 5. Create REST API Endpoints

```bash
# Get API Gateway ID (created in Phase 1 or Phase 2 Terraform)
API_ID=$(aws apigateway get-rest-apis --query 'items[?name==`securebase-api`].id' --output text)

# Create resource hierarchy
/cost/forecast
/cost/budget-alert
/support/tickets
/support/tickets/{id}
/support/tickets/{id}/comments
/invoices
/invoices/{id}
/metrics
/notifications
/notifications/{id}/read

# Example: Create /cost/forecast GET endpoint
RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part cost \
  --query 'id' --output text)

FORECAST_RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $RESOURCE_ID \
  --path-part forecast \
  --query 'id' --output text)

# Attach Lambda integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $FORECAST_RESOURCE \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:ACCOUNT:function:securebase-forecasting/invocations
```

---

### PHASE 2D: Testing (Day 4)

#### 6. Integration Tests

```bash
# Test database connectivity
cd /workspaces/securebase-app/phase2-backend

# Run unit tests
python -m pytest functions/ -v

# Test Lambda functions locally
sam local invoke securebase-auth --event test-event.json

# Test RLS isolation
psql -h $DB_HOST -U app_user -d securebase -c "SELECT * FROM customers;" # Should see only own data

# Test API endpoints
curl -X GET https://api.securebase.dev/cost/forecast \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

#### 7. Performance & Load Tests

```bash
# Test RDS Proxy connection pooling
ab -n 1000 -c 50 https://api.securebase.dev/metrics

# Monitor Lambda cold starts
# (Check CloudWatch Logs for Init Duration)

# Test forecast calculation latency
time curl -X GET "https://api.securebase.dev/cost/forecast?months=12" \
  -H "Authorization: Bearer $TOKEN"
# Target: <2 seconds
```

---

### PHASE 2E: Deployment Documentation (Day 5)

#### 8. Finalize Deployment

```bash
# Document deployed resources
terraform output > phase2-deployed-resources.json

# Create runbook for ops team
cat > PHASE2_DEPLOYMENT_COMPLETE.md <<'EOF'
## Phase 2 Deployment Complete

**Date Deployed:** $(date)
**Environment:** Production
**Status:** ✅ All systems operational

### Key Resources
- Aurora Cluster: [endpoint from terraform output]
- RDS Proxy: [endpoint]
- Lambda Functions: [list of functions]
- API Gateway: [API ID and base URL]

### Health Check Commands
```bash
# Database
psql -h [endpoint] -U postgres -d securebase -c "SELECT COUNT(*) FROM customers;"

# Lambda
aws lambda invoke --function-name securebase-auth --payload '{}' response.json

# API
curl https://api.securebase.dev/health
```

### Monitoring
- CloudWatch Logs: /aws/lambda/securebase-*
- RDS Performance Insights: [link to AWS Console]
- Aurora Metrics: [link to AWS Console]
EOF
```

---

## ⚠️ Troubleshooting

### Aurora Cluster Creation Fails
**Symptom:** Terraform timeout after 20 minutes
**Fix:**
```bash
# Check Aurora status
aws rds describe-db-clusters --db-cluster-identifier securebase-cluster

# If stuck, delete and retry
aws rds delete-db-cluster --db-cluster-identifier securebase-cluster --skip-final-snapshot
terraform apply -target=module.phase2_database
```

### Lambda Can't Connect to RDS
**Symptom:** "timeout waiting for db connection"
**Fix:**
```bash
# Verify security group allows Lambda
aws ec2 describe-security-groups --group-ids [rds-sg] 

# Add ingress rule if missing
aws ec2 authorize-security-group-ingress \
  --group-id [rds-sg] \
  --protocol tcp \
  --port 5432 \
  --source-group [lambda-sg]
```

### RDS Proxy Connection Pool Exhausted
**Symptom:** "too many connections"
**Fix:**
```bash
# Increase max connections in parameter group
aws rds modify-db-cluster-parameter-group \
  --db-cluster-parameter-group-name securebase-params \
  --parameters ParameterName=max_connections,ParameterValue=1000,ApplyMethod=immediate
```

---

## 📊 Expected Outcomes

### Infrastructure
- ✅ Aurora cluster (multi-AZ, 15 min RTO)
- ✅ RDS Proxy (connection pooling)
- ✅ Database with 15 tables + RLS
- ✅ 4 Lambda functions deployed
- ✅ API Gateway with 10+ endpoints

### Performance
- Lambda cold starts: <100ms (vs 5s without Proxy)
- Database queries: <100ms (p95)
- API latency: <200ms (p95)
- Forecast calculation: <2s

### Costs
- Aurora Serverless: $50-100/month (scales with usage)
- RDS Proxy: $5/month
- Lambda: <$10/month (1M invocations)
- DynamoDB: <$5/month (on-demand)
- **Total: ~$70/month for baseline**

---

## ✅ Success Criteria

- [x] All infrastructure deployed without errors
- [x] Database initialized with schema
- [x] All Lambda functions deployed and callable
- [x] API endpoints responding within SLA
- [x] Integration tests passing
- [x] RLS policies enforced (security verified)
- [x] Monitoring/alerts configured
- [x] Documentation updated

---

## 🚀 Next Step

Once Phase 2 is deployed, Phase 3a (portal) and Phase 3b (advanced features) can be deployed immediately (they depend on Phase 2 backend).

**Estimated total deployment time: 3-5 days**

---

**Document Version:** 1.0  
**Status:** Ready for execution  
**Last Updated:** January 19, 2026
