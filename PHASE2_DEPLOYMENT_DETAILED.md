# Phase 2 Deployment Guide: Serverless Database & API

## Executive Summary

Phase 2 transforms SecureBase from infrastructure-only to a complete multi-tenant SaaS platform. This guide provides step-by-step deployment of the database layer, Lambda functions, and API Gateway.

**Timeline:** 2-3 weeks
**Prerequisites:** Phase 1 deployed successfully (AWS Organizations + 10 VPCs)
**Cost:** ~$150/month baseline (scales to $400+ with 25 customers)

---

## Architecture Overview

```
API Gateway (REST/GraphQL)
       ↓
   Lambda Authorizer (auth_v2.py)
       ↓
  Lambda Functions (billing, metrics, invoices, etc.)
       ↓
   RDS Proxy (connection pooling)
       ↓
  Aurora Serverless v2 PostgreSQL
       ↓
   [15+ Tables with RLS Policies]
       ↓
DynamoDB Cache (session cache, metrics)
```

**Key Improvements:**
- RLS prevents cross-tenant data access at database level
- RDS Proxy reduces Lambda cold starts from 5s to 100ms
- DynamoDB cache reduces database queries by 90%
- Immutable audit trails for compliance (7-year retention)

---

## Part 1: Database Infrastructure (Week 1)

### Step 1.1: Deploy Aurora Cluster

```bash
# Prerequisite: Phase 1 complete (terraform apply in landing-zone/environments/dev)

# Navigate to Phase 2 Terraform
cd landing-zone/environments/dev

# Add Phase 2 database module to main.tf
cat >> main.tf <<'EOF'

# Phase 2: Multi-tenant Database
module "phase2_database" {
  source = "../modules/phase2-database"
  
  environment              = var.environment
  vpc_id                   = module.vpc[0].vpc_id  # Reference Phase 1 VPC
  database_subnets         = module.vpc[0].private_subnet_ids
  lambda_subnets           = module.vpc[0].private_subnet_ids
  tags                     = var.tags
  
  # Aurora Serverless configuration
  max_aurora_capacity      = 4    # 4 ACUs = 8GB RAM, ~200 concurrent connections
  min_aurora_capacity      = 0.5  # 0.5 ACUs = 1GB RAM (scales down after 300s idle)
  rds_backup_retention     = 35   # days
}
EOF

# Plan the deployment
terraform plan -out=phase2.tfplan

# Review resource count (expect ~15 new resources)
# - 1 Aurora cluster
# - 1 RDS Proxy
# - 3 DynamoDB tables
# - 1 KMS key
# - 3 Security groups
# - 2 CloudWatch log groups

# Apply
terraform apply phase2.tfplan

# Note: Cluster creation takes 5-10 minutes
# Monitor in AWS Console: RDS → Databases → securebase-phase2
```

**Outputs saved automatically:**
- RDS endpoint (writer): `rds_endpoint_writer`
- RDS endpoint (reader): `rds_endpoint_reader`
- RDS Proxy endpoint: `rds_proxy_endpoint`
- DynamoDB table names
- Security group IDs

### Step 1.2: Initialize Database Schema

```bash
# Prerequisites:
# - AWS CLI configured with credentials
# - psql client installed: apt-get install postgresql-client
# - RDS cluster deployed and accessible

cd phase2-backend/database

# Make init script executable
chmod +x init_database.sh

# Run initialization (prompts for confirmation)
./init_database.sh dev

# What the script does:
# 1. Retrieves RDS endpoint from Terraform outputs
# 2. Retrieves admin password from Secrets Manager (or uses env var)
# 3. Creates schema with 15+ tables
# 4. Enables RLS on all tables
# 5. Creates application roles (securebase_app, securebase_analytics)
# 6. Loads tier features and initial data
# 7. Tests connection and verifies schema
# 8. Stores app credentials in Secrets Manager

# Expected output:
# ✓ Database created/verified
# ✓ Schema loaded successfully
# ✓ Application roles created
# ✓ Schema verification complete
```

**Verify schema creation:**

```bash
# Connect to database
psql -h <RDS_ENDPOINT> -U postgres -d securebase

# Inside psql:
-- List tables
\dt

-- List RLS policies (should show 7 policies)
SELECT schemaname, tablename, policyname FROM pg_policies;

-- Check tier features
SELECT tier, max_accounts, custom_scps FROM tier_features;

-- Quit
\q
```

### Step 1.3: Store Secrets in Secrets Manager

```bash
# Store JWT secret for token generation
aws secretsmanager create-secret \
  --name phase2/jwt_secret \
  --description "JWT signing key for session tokens" \
  --secret-string $(openssl rand -base64 32) \
  --region us-east-1

# Store RDS connection string for Lambda
# (Usually created automatically by init_database.sh)
aws secretsmanager describe-secret \
  --secret-id phase2/rds/app \
  --region us-east-1
```

---

## Part 2: Lambda Layer & Functions (Week 1-2)

### Step 2.1: Build and Deploy Lambda Layer

```bash
# The Lambda layer contains shared database utilities
cd phase2-backend

# Structure should be:
# lambda_layer/
# ├── python/
# │   ├── db_utils.py      # Database connection pooling, helpers
# │   └── ...
# └── requirements.txt

# Create layer package
mkdir -p lambda_layer/python
cp lambda_layer/python/*.py lambda_layer/python/

# Install dependencies
pip install -r requirements.txt -t lambda_layer/python/

# Package as ZIP (AWS Lambda expects specific structure)
cd lambda_layer
zip -r ../db_utils_layer.zip .
cd ..

# Upload to Lambda Layers
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name securebase-db-utils \
  --zip-file fileb://db_utils_layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1 \
  --query 'LayerVersionArn' \
  --output text)

echo "Layer ARN: $LAYER_ARN"
# Save this for function deployment
```

### Step 2.2: Deploy Auth Lambda Function

```bash
# Package auth function
cd functions
zip -r ../auth_lambda.zip auth_v2.py

# Create Lambda function
aws lambda create-function \
  --function-name securebase-auth \
  --runtime python3.11 \
  --role arn:aws:iam::<ACCOUNT_ID>:role/lambda-execution-role \
  --handler auth_v2.lambda_handler \
  --zip-file fileb://../auth_lambda.zip \
  --timeout 30 \
  --memory-size 256 \
  --layers "$LAYER_ARN" \
  --environment Variables="{\
    RDS_HOST=$(terraform output -raw rds_proxy_endpoint),\
    RDS_DATABASE=securebase,\
    RDS_USER=securebase_app,\
    DDB_TABLE_CACHE=securebase-cache,\
    LOG_LEVEL=INFO\
  }" \
  --region us-east-1

# Test the function
aws lambda invoke \
  --function-name securebase-auth \
  --payload '{"headers":{"Authorization":"Bearer invalid_key"},"requestContext":{"requestId":"test-123"}}' \
  --region us-east-1 \
  response.json

cat response.json
# Should return 401: Invalid API key
```

### Step 2.3: Deploy Billing Worker Lambda

```bash
# Similar process for billing worker
zip -r ../billing_lambda.zip billing_worker.py

aws lambda create-function \
  --function-name securebase-billing-worker \
  --runtime python3.11 \
  --role arn:aws:iam::<ACCOUNT_ID>:role/lambda-execution-role \
  --handler billing_worker.lambda_handler \
  --zip-file fileb://../billing_lambda.zip \
  --timeout 300 \
  --memory-size 512 \
  --layers "$LAYER_ARN" \
  --environment Variables="{\
    RDS_HOST=$(terraform output -raw rds_proxy_endpoint),\
    RDS_DATABASE=securebase,\
    RDS_USER=securebase_app,\
    DDB_TABLE_CACHE=securebase-cache\
  }" \
  --region us-east-1

# Schedule billing worker (1st of month at 00:00 UTC)
aws events put-rule \
  --name securebase-billing-monthly \
  --schedule-expression "cron(0 0 1 * ? *)" \
  --state ENABLED \
  --region us-east-1

aws events put-targets \
  --rule securebase-billing-monthly \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:securebase-billing-worker" \
  --region us-east-1

# Grant EventBridge permission to invoke Lambda
aws lambda add-permission \
  --function-name securebase-billing-worker \
  --statement-id AllowInvokeFromEventBridge \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:<ACCOUNT_ID>:rule/securebase-billing-monthly \
  --region us-east-1
```

---

## Part 3: API Gateway Setup (Week 2)

### Step 3.1: Create REST API

```bash
# Create API Gateway
API_ID=$(aws apigateway create-rest-api \
  --name securebase-phase2-api \
  --description "SecureBase Phase 2 Multi-tenant API" \
  --endpoint-configuration types=REGIONAL \
  --region us-east-1 \
  --query 'id' \
  --output text)

echo "API ID: $API_ID"

# Create authorizer (uses auth Lambda)
AUTHORIZER_ID=$(aws apigateway create-authorizer \
  --rest-api-id "$API_ID" \
  --name securebase-authorizer \
  --type TOKEN \
  --authorizer-uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:securebase-auth/invocations \
  --identity-source method.request.header.Authorization \
  --region us-east-1 \
  --query 'id' \
  --output text)

echo "Authorizer ID: $AUTHORIZER_ID"

# Grant API Gateway permission to invoke authorizer Lambda
aws lambda add-permission \
  --function-name securebase-auth \
  --statement-id AllowAPIGatewayInvoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --region us-east-1
```

### Step 3.2: Create API Resources

```bash
# Get root resource ID
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id "$API_ID" \
  --query 'items[0].id' \
  --output text \
  --region us-east-1)

# Create /invoices resource
INVOICES_ID=$(aws apigateway create-resource \
  --rest-api-id "$API_ID" \
  --parent-id "$ROOT_ID" \
  --path-part invoices \
  --region us-east-1 \
  --query 'id' \
  --output text)

# Create GET /invoices method
aws apigateway put-method \
  --rest-api-id "$API_ID" \
  --resource-id "$INVOICES_ID" \
  --http-method GET \
  --authorization-type CUSTOM \
  --authorizer-id "$AUTHORIZER_ID" \
  --region us-east-1

# Create method response
aws apigateway put-method-response \
  --rest-api-id "$API_ID" \
  --resource-id "$INVOICES_ID" \
  --http-method GET \
  --status-code 200 \
  --region us-east-1

# (Similar pattern for /metrics, /api-keys, etc.)
```

### Step 3.3: Deploy API to Stage

```bash
# Create deployment
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --description "Phase 2 API v1" \
  --region us-east-1 \
  --query 'id' \
  --output text)

# Create stage
aws apigateway create-stage \
  --rest-api-id "$API_ID" \
  --stage-name prod \
  --deployment-id "$DEPLOYMENT_ID" \
  --description "Production" \
  --variables "environment=prod" \
  --region us-east-1

# Get API endpoint
API_ENDPOINT="https://${API_ID}.execute-api.us-east-1.amazonaws.com/prod"
echo "API Endpoint: $API_ENDPOINT"
```

---

## Part 4: Testing & Validation (Week 2-3)

### Step 4.1: RLS Isolation Test

```python
# Test that RLS prevents cross-tenant access
import psycopg2
from db_utils import set_rls_context, query_many

# Connect as customer_1
conn = psycopg2.connect(...)
set_rls_context(customer_id='uuid-1', role='customer')

# Try to view customer_2's invoices
invoices = query_many("""
  SELECT * FROM invoices 
  ORDER BY created_at DESC
""")

# Should return ONLY invoices for uuid-1
assert all(inv['customer_id'] == 'uuid-1' for inv in invoices)
print("✓ RLS isolation verified")
```

### Step 4.2: API Authentication Test

```bash
# Create test API key
curl -X POST https://api.example.com/api-keys \
  -H "Authorization: Bearer admin_token" \
  -d '{"name":"test-key","scopes":["read:invoices"]}'

# Returns: {"api_key":"sb_xyz123_abc456...","prefix":"sb_xyz123"}

# Test authentication
API_KEY="sb_xyz123_abc456..."
curl -X GET https://api.example.com/invoices \
  -H "Authorization: Bearer $API_KEY"

# Expected response (200):
# {"session_token":"eyJ...","customer_id":"uuid","expires_in":86400}
```

### Step 4.3: Billing Calculation Test

```python
# Test billing calculation for different tiers
from db_utils import calculate_charges
from datetime import date

# Standard tier usage
charges = calculate_charges(
  customer_id='standard-customer',
  month='2025-01-01'
)

# Expected breakdown:
# - Base: $2,000 (standard tier)
# - Log storage: $10 (100 GB @ $0.03/GB)
# - NAT processing: $45
# - Total before tax: $2,055
# - No volume discount (< $5K)
# - Tax (8%): $164.40
# - Total: $2,219.40

assert charges['tier_base_cost'] == 2000
assert charges['total_amount'] > 2200  # After tax
print("✓ Billing calculation verified")
```

---

## Part 5: Monitoring & Observability (Week 2-3)

### Step 5.1: CloudWatch Dashboards

```bash
# Create custom dashboard
aws cloudwatch put-dashboard \
  --dashboard-name SecureBase-Phase2 \
  --dashboard-body file://dashboard-config.json
```

**dashboard-config.json:**
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/RDS", "DatabaseConnections", {"stat": "Average"}],
          ["AWS/RDS", "CPUUtilization", {"stat": "Average"}],
          ["AWS/Lambda", "Duration", {"stat": "Average"}],
          ["AWS/Lambda", "Errors", {"stat": "Sum"}],
          ["AWS/DynamoDB", "ConsumedReadCapacityUnits", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Phase 2 Performance"
      }
    }
  ]
}
```

### Step 5.2: Alarms

```bash
# RDS CPU utilization alarm
aws cloudwatch put-metric-alarm \
  --alarm-name securebase-rds-high-cpu \
  --alarm-description "RDS CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:<ACCOUNT_ID>:securebase-alerts

# Lambda errors alarm
aws cloudwatch put-metric-alarm \
  --alarm-name securebase-lambda-errors \
  --alarm-description "Lambda errors > 0.5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:<ACCOUNT_ID>:securebase-alerts
```

---

## Part 6: Go-Live Checklist

### Pre-Launch (Days 1-3)

- [ ] All Terraform modules deployed successfully
- [ ] Database schema initialized with RLS policies
- [ ] Application IAM roles configured
- [ ] Secrets Manager contains all required secrets
- [ ] Lambda layers built and uploaded
- [ ] All Lambda functions deployed and tested
- [ ] API Gateway endpoints working
- [ ] CloudWatch dashboards created
- [ ] Alarms configured and SNS topics active

### Launch (Day 4)

- [ ] Database backed up
- [ ] Load test with 10 concurrent customers
- [ ] RLS isolation verified (no cross-tenant data leakage)
- [ ] Billing calculation tested for all tiers
- [ ] Audit log immutability verified
- [ ] Performance monitoring active
- [ ] Incident response runbook prepared

### Post-Launch (Days 5+)

- [ ] Monitor CloudWatch metrics for 24 hours
- [ ] Verify no errors in Lambda logs
- [ ] Confirm audit events logged correctly
- [ ] Test automated backups
- [ ] Review scaling metrics (Aurora ACU usage)
- [ ] Prepare for Phase 3 (customer portal)

---

## Troubleshooting

### Database Connection Fails

```bash
# Check RDS Proxy health
aws rds describe-db-proxies \
  --query 'DBProxies[0].{Status:Status,IdleClientTimeout:IdleClientTimeout}' \
  --region us-east-1

# Check security group rules
aws ec2 describe-security-groups \
  --filter "Name=group-id,Values=<sg-id>" \
  --region us-east-1
```

### Lambda Timeout

```bash
# Check if RDS Proxy connection is slow
# Lambda timeout = 30s, but RDS cold start + query could be ~5-10s

# Solution: Increase Lambda timeout to 60s or reduce database query time

# Monitor in CloudWatch Logs
aws logs tail /aws/lambda/securebase-auth --follow
```

### RLS Policy Blocking Queries

```bash
# If getting "violates row-level security policy" errors:

-- Check if RLS context is set correctly
SELECT current_setting('app.current_customer_id');

-- Should return customer UUID, not empty

-- Re-run set_customer_context:
SELECT set_customer_context('customer-uuid', 'customer');
```

---

## Cost Breakdown

| Component | Monthly Cost (10 customers) | Per-Customer |
|-----------|---------------------------|--------------|
| Aurora Serverless (0.5-4 ACU) | $100-150 | $10-15 |
| RDS Proxy | $40 | $4 |
| DynamoDB (cache table) | $10 | $1 |
| Lambda (auth + billing) | $5-10 | <$1 |
| **Total Infrastructure** | **$155-210** | **$15.50-21** |
| + Tier costs ($2K-25K) | $20K-250K | $2K-25K |
| **Total with Tiers** | **$20K-250K** | **$2K-25K** |

---

## Next Steps

After Phase 2 go-live:

1. **Week 4:** Deploy Phase 3 (customer portal - React + GraphQL)
2. **Week 5:** Implement compliance reporting dashboard
3. **Week 6:** Add support ticketing system
4. **Week 7:** Security audit + penetration testing

See `PHASE3_ARCHITECTURE.md` for details.

---

## Support & Documentation

- **Schema Documentation:** `database/schema.sql` (15+ tables with comments)
- **Lambda Layer:** `lambda_layer/python/db_utils.py` (50+ helper functions)
- **API Docs:** `API_REFERENCE.md` (REST + GraphQL specs)
- **Runbooks:** `RUNBOOKS/` directory (incident response procedures)

---

**Phase 2 is the foundation of customer-facing SaaS. Test thoroughly before production deployment.**
