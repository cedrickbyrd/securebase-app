# End-to-End Testing Guide
# SecureBase API Gateway + Lambda + Portal Integration

## Pre-Testing Checklist

### ❌ Missing Components (Must Complete First)

1. **Lambda Deployment Packages**
   - Status: NOT CREATED
   - Action Required: Package Lambda functions with dependencies
   - Command:
   ```bash
   cd /workspaces/securebase-app/phase2-backend/functions
   
   # Package each Lambda function
   mkdir -p ../../landing-zone/lambda-packages
   
   # Auth function
   zip -r ../../landing-zone/lambda-packages/auth_v2.zip auth_v2.py
   
   # Webhook manager
   zip -r ../../landing-zone/lambda-packages/webhook_manager.zip webhook_manager.py
   
   # Billing worker  
   zip -r ../../landing-zone/lambda-packages/billing-worker.zip billing-worker.py
   
   # Support tickets
   zip -r ../../landing-zone/lambda-packages/support_tickets.zip support_tickets.py
   
   # Cost forecasting
   zip -r ../../landing-zone/lambda-packages/cost_forecasting.zip cost_forecasting.py
   ```

2. **Lambda Layer (Python Dependencies)**
   - Status: NOT CREATED
   - Action Required: Create Lambda layer with psycopg2, boto3, PyJWT, etc.
   - Command:
   ```bash
   cd /workspaces/securebase-app
   mkdir -p lambda-layer/python
   
   pip install -r phase2-backend/requirements.txt \
     -t lambda-layer/python \
     --platform manylinux2014_x86_64 \
     --only-binary=:all:
   
   cd lambda-layer
   zip -r ../landing-zone/lambda-packages/lambda-layer.zip python
   ```

3. **Wire API Gateway to Root Terraform**
   - Status: NOT WIRED
   - Action Required: Add API Gateway module to landing-zone/main.tf
   - Code to add:
   ```hcl
   module "api_gateway" {
     source = "./modules/api-gateway"
     
     environment = var.environment
     aws_region  = var.target_region
     
     # Lambda function references (need to create lambda module first)
     auth_lambda_arn        = module.lambda_functions.auth_v2_arn
     auth_lambda_name       = module.lambda_functions.auth_v2_name
     webhook_lambda_arn     = module.lambda_functions.webhook_manager_arn
     webhook_lambda_name    = module.lambda_functions.webhook_manager_name
     billing_lambda_arn     = module.lambda_functions.billing_worker_arn
     billing_lambda_name    = module.lambda_functions.billing_worker_name
     support_lambda_arn     = module.lambda_functions.support_tickets_arn
     support_lambda_name    = module.lambda_functions.support_tickets_name
     forecasting_lambda_arn = module.lambda_functions.cost_forecasting_arn
     forecasting_lambda_name = module.lambda_functions.cost_forecasting_name
     
     default_rate_limit   = 100
     default_burst_limit  = 200
     log_retention_days   = 30
     
     tags = var.tags
     
     depends_on = [module.lambda_functions]
   }
   ```

4. **Create Lambda Functions Module Instance**
   - Status: NOT WIRED  
   - Action Required: Add lambda_functions module to main.tf
   - Code to add:
   ```hcl
   module "lambda_functions" {
     source = "./modules/lambda-functions"
     
     environment = var.environment
     aws_region  = var.target_region
     
     # VPC configuration
     private_subnet_ids       = module.phase2_database.lambda_subnet_ids
     lambda_security_group_id = module.phase2_database.lambda_security_group_id
     
     # Database configuration
     rds_proxy_endpoint = module.phase2_database.rds_proxy_endpoint
     database_name      = module.phase2_database.database_name
     jwt_secret_arn     = module.phase2_database.jwt_secret_arn
     dynamodb_table_name = "securebase-${var.environment}-sessions"
     
     # Lambda deployment packages
     lambda_packages = {
       auth_v2          = "${path.module}/lambda-packages/auth_v2.zip"
       webhook_manager  = "${path.module}/lambda-packages/webhook_manager.zip"
       billing_worker   = "${path.module}/lambda-packages/billing-worker.zip"
       support_tickets  = "${path.module}/lambda-packages/support_tickets.zip"
       cost_forecasting = "${path.module}/lambda-packages/cost_forecasting.zip"
     }
     
     tags = var.tags
     
     depends_on = [module.phase2_database]
   }
   ```

## Deployment Steps

### Step 1: Package Lambda Functions (5 minutes)
```bash
cd /workspaces/securebase-app/phase2-backend/functions
mkdir -p ../../landing-zone/lambda-packages

# Simple packaging (no layer for now - using inline deps)
for func in auth_v2 webhook_manager billing-worker support_tickets cost_forecasting; do
  echo "Packaging $func..."
  zip -r "../../landing-zone/lambda-packages/${func}.zip" "${func}.py" 2>/dev/null || \
  zip -r "../../landing-zone/lambda-packages/${func}.zip" "${func//-/_}.py"
done

ls -lh ../../landing-zone/lambda-packages/
```

### Step 2: Update Root Terraform (2 minutes)
Add module blocks to `landing-zone/main.tf` (see code blocks above)

### Step 3: Terraform Init & Plan (3 minutes)
```bash
cd /workspaces/securebase-app/landing-zone
terraform init
terraform plan -out=tfplan-api
```

### Step 4: Deploy Lambda Functions (5 minutes)
```bash
terraform apply -target=module.lambda_functions
```

### Step 5: Deploy API Gateway (3 minutes)
```bash
terraform apply -target=module.api_gateway
```

### Step 6: Get API Endpoint (1 minute)
```bash
terraform output api_gateway_endpoint
# Output: https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev
```

### Step 7: Configure React Portal (2 minutes)
Update `phase3a-portal/.env`:
```bash
VITE_API_ENDPOINT=<your-api-gateway-url>
VITE_ENVIRONMENT=dev
```

### Step 8: Build React Portal (3 minutes)
```bash
cd /workspaces/securebase-app/phase3a-portal
npm install
npm run build
```

### Step 9: Test API Endpoints (5 minutes)

#### Test 1: Auth Endpoint (Public)
```bash
API_ENDPOINT=$(cd /workspaces/securebase-app/landing-zone && terraform output -raw api_gateway_endpoint)

curl -X POST "$API_ENDPOINT/auth" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-api-key-12345" \
  -d '{}'

# Expected: 200 OK with session token OR 401 if API key doesn't exist
```

#### Test 2: Webhooks (Authenticated)
```bash
# First get session token from Test 1
SESSION_TOKEN="<token-from-test-1>"

curl -X GET "$API_ENDPOINT/webhooks" \
  -H "Authorization: Bearer $SESSION_TOKEN"

# Expected: 200 OK with empty webhook list []
```

#### Test 3: Create Webhook
```bash
curl -X POST "$API_ENDPOINT/webhooks" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhook",
    "events": ["invoice.created"],
    "description": "Test webhook"
  }'

# Expected: 201 Created with webhook object
```

#### Test 4: Support Tickets
```bash
curl -X POST "$API_ENDPOINT/support/tickets" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test ticket",
    "description": "This is a test",
    "priority": "medium"
  }'

# Expected: 201 Created with ticket object
```

### Step 10: Test React Portal (5 minutes)
```bash
cd /workspaces/securebase-app/phase3a-portal
npm run dev
```

Open browser to http://localhost:5173:
1. Login with test API key
2. Navigate to Dashboard
3. Check Webhooks tab
4. Create a support ticket
5. View invoices (should be empty initially)

## End-to-End Test Scenarios

### Scenario 1: Customer Authentication Flow
1. Customer has API key (stored in RDS)
2. Call POST /auth with API key
3. Receive JWT session token (15-min expiry)
4. Use session token for subsequent requests
5. Session token validates via JWT authorizer
6. Authorizer caches result (5 min TTL)

### Scenario 2: Webhook Creation & Delivery
1. Authenticate and get session token
2. Create webhook via POST /webhooks
3. Webhook stored in DynamoDB
4. Trigger event (e.g., invoice created)
5. Webhook manager delivers to customer URL
6. Delivery recorded in webhook_deliveries table
7. Retry on failure (exponential backoff)

### Scenario 3: Support Ticket Lifecycle
1. Customer creates ticket via POST /support/tickets
2. Ticket stored in DynamoDB with unique ID
3. List tickets via GET /support/tickets
4. Add comment to ticket
5. Update ticket status
6. View ticket history

### Scenario 4: Cost Forecasting
1. Request forecast via GET /forecasting
2. Lambda queries RDS metrics table
3. Calculate trend (7-day, 30-day)
4. Return forecast with confidence interval
5. Cache result in DynamoDB (1 hour TTL)

## Success Criteria

### ✅ Infrastructure Tests
- [ ] API Gateway deployed and accessible
- [ ] All 5 Lambda functions deployed
- [ ] VPC integration working (Lambda can reach RDS)
- [ ] CloudWatch logs receiving entries
- [ ] X-Ray tracing enabled and collecting data

### ✅ Authentication Tests
- [ ] POST /auth accepts API key
- [ ] POST /auth returns valid JWT
- [ ] JWT authorizer validates tokens
- [ ] JWT authorizer caches results
- [ ] Expired tokens rejected (401)

### ✅ API Endpoint Tests
- [ ] GET /webhooks returns list
- [ ] POST /webhooks creates webhook
- [ ] GET /invoices returns invoices
- [ ] POST /support/tickets creates ticket
- [ ] GET /forecasting returns forecast

### ✅ Security Tests
- [ ] CORS headers present
- [ ] Security headers (HSTS, X-Frame-Options) present
- [ ] Rate limiting enforced (>100 req/sec blocked)
- [ ] Invalid auth tokens rejected
- [ ] SQL injection attempts fail

### ✅ Performance Tests
- [ ] API latency <500ms (p95)
- [ ] Authorizer cache hits >80%
- [ ] Lambda cold start <3 seconds
- [ ] Lambda warm execution <200ms
- [ ] Database connection pooling active

### ✅ React Portal Tests
- [ ] Login page loads
- [ ] Authentication works
- [ ] Dashboard displays data
- [ ] Webhooks CRUD operations work
- [ ] Support ticket creation works
- [ ] API error handling works
- [ ] Loading states display correctly

## Troubleshooting

### Issue: Lambda cannot connect to RDS
**Symptom**: Timeout errors in CloudWatch logs  
**Cause**: Security group or VPC configuration  
**Fix**:
```bash
# Check security group allows Lambda → RDS
aws ec2 describe-security-groups --group-ids <lambda-sg-id>
aws ec2 describe-security-groups --group-ids <rds-sg-id>

# Ensure Lambda SG has outbound to RDS port 5432
# Ensure RDS SG allows inbound from Lambda SG
```

### Issue: API Gateway returns 403 Forbidden
**Symptom**: All requests return 403  
**Cause**: Lambda permission missing  
**Fix**:
```bash
# Check Lambda permissions
aws lambda get-policy --function-name securebase-dev-auth-v2

# Should see apigateway.amazonaws.com in Principal
```

### Issue: CORS preflight fails
**Symptom**: Browser shows CORS error  
**Cause**: OPTIONS method not configured  
**Fix**: Verify CORS module applied to all resources in API Gateway

### Issue: High Lambda costs
**Symptom**: Unexpected Lambda charges  
**Cause**: Cold starts, high memory allocation  
**Fix**:
- Enable authorizer caching (already done)
- Reduce Lambda memory if possible
- Implement provisioned concurrency for high-traffic functions

## Monitoring Dashboard

After deployment, create CloudWatch dashboard:

```bash
# Key metrics to monitor:
- API Gateway 4XX/5XX error rates
- API Gateway latency (p50, p95, p99)
- Lambda concurrent executions
- Lambda duration
- Lambda errors
- RDS connections
- DynamoDB read/write capacity
```

## Cost Estimation (End-to-End)

```
Monthly Costs (10K customers, 1M API calls):

API Gateway: $3.50
Lambda: $10-20 (depends on memory/duration)
RDS Aurora: $44-87 (dev), $175-350 (prod)
RDS Proxy: $11
DynamoDB: $5-15
CloudWatch Logs: $0.50-2
X-Ray: $0.50-1

TOTAL: $75-115/month (dev)
       $200-400/month (prod)
```

## Next Steps After E2E Tests Pass

1. **Enable AWS WAF** (v0.3 Task 2)
2. **Add request validation** (v0.3 Task 3)
3. **Harden IAM roles** (v0.3 Task 5)
4. **Migrate secrets to Secrets Manager** (v0.3 Task 8)
5. **Deploy to S3 + CloudFront** (portal hosting)
6. **Configure custom domain** (portal.securebase.com)
7. **Onboard pilot customers**

## Timeline

**Total E2E Setup Time**: 40-50 minutes  
**Testing Time**: 20-30 minutes  
**Total**: 60-80 minutes from start to full validation
