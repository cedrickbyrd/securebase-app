# SecureBase Demo Backend - Quick Start Guide

## 1-Minute Quick Start

```bash
# 1. Navigate to your environment
cd landing-zone/environments/dev

# 2. Add demo-backend module (copy from example.tf)
cat ../../modules/demo-backend/example.tf >> main.tf

# 3. Deploy
terraform init
terraform apply -auto-approve

# 4. Get API endpoint
API_ENDPOINT=$(terraform output -raw demo_backend_api_endpoint)

# 5. Test it!
curl $API_ENDPOINT/health
```

## 5-Minute Full Test

```bash
# 1. Deploy (as above)
terraform apply -auto-approve

# 2. Get endpoint
API_ENDPOINT=$(terraform output -raw demo_backend_api_endpoint)
echo "API: $API_ENDPOINT"

# 3. Health check
curl $API_ENDPOINT/health | jq

# 4. Login
TOKEN=$(curl -s -X POST $API_ENDPOINT/auth \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "login",
    "email": "admin@healthcorp.example.com",
    "password": "demo-healthcare-2026"
  }' | jq -r '.token')

echo "Token: $TOKEN"

# 5. Get customers
curl -s $API_ENDPOINT/customers \
  -H "Authorization: Bearer $TOKEN" | jq

# 6. Get invoices
curl -s $API_ENDPOINT/invoices \
  -H "Authorization: Bearer $TOKEN" | jq '.[0:3]'

# 7. Get metrics
curl -s $API_ENDPOINT/metrics \
  -H "Authorization: Bearer $TOKEN" | jq

echo "✓ All tests passed!"
```

## Run Test Suite

```bash
# Run comprehensive tests
cd landing-zone/modules/demo-backend/scripts
./test_api.sh $API_ENDPOINT
```

## Connect to Frontend

```bash
# Update Netlify environment variables
netlify env:set VITE_API_ENDPOINT $API_ENDPOINT
netlify env:set VITE_DEMO_MODE false

# Redeploy frontend
cd phase3a-portal
npm run build
netlify deploy --prod
```

## Get Demo Credentials

```bash
# Show all 5 demo customer credentials
terraform output -json demo_backend_credentials | jq

# Or view specific customer
terraform output -json demo_backend_credentials | \
  jq -r '.customer_1 | "Email: \(.email)\nPassword: \(.password)"'
```

## Check Costs

```bash
# View DynamoDB table costs (should be < $1/month)
# Note: Adjust time range as needed (last 24 hours shown)
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=securebase-demo-customers-demo \
  --start-time 2026-02-03T00:00:00 \
  --end-time 2026-02-04T00:00:00 \
  --period 3600 \
  --statistics Sum

# View Lambda invocation count
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --start-time 2026-02-03T00:00:00 \
  --end-time 2026-02-04T00:00:00 \
  --period 3600 \
  --statistics Sum
```

## Cleanup

```bash
# Destroy all resources
cd landing-zone/environments/dev
terraform destroy -target=module.demo_backend -auto-approve

# Or remove from main.tf and destroy
# (edit main.tf to remove module block)
terraform apply
```

## Troubleshooting

### Issue: CORS errors

```bash
# Check CORS headers
curl -I -X OPTIONS $API_ENDPOINT/auth

# Should see:
# access-control-allow-origin: *
# access-control-allow-methods: GET,POST,OPTIONS
```

### Issue: 401 Unauthorized

```bash
# Get fresh token
TOKEN=$(curl -s -X POST $API_ENDPOINT/auth \
  -H 'Content-Type: application/json' \
  -d '{"action":"login","email":"admin@healthcorp.example.com","password":"demo-healthcare-2026"}' \
  | jq -r '.token')

# Verify token
curl -X POST $API_ENDPOINT/auth \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"verify\",\"token\":\"$TOKEN\"}"
```

### Issue: Empty data

```bash
# Check DynamoDB tables
aws dynamodb scan --table-name securebase-demo-customers-demo --max-items 1

# Reload data
cd landing-zone/modules/demo-backend/scripts
./load_data.sh
```

### Issue: Lambda errors

```bash
# View logs
aws logs tail /aws/lambda/securebase-demo-auth-demo --follow

# Check permissions
aws iam get-role-policy \
  --role-name securebase-demo-lambda-role-demo \
  --policy-name securebase-demo-lambda-dynamodb-demo
```

## Next Steps

1. ✅ Deploy demo backend (done!)
2. ✅ Test with curl (done!)
3. 🔄 Connect to Netlify frontend
4. 🔄 Replace mock data in frontend with API calls
5. 🔄 Test full user flow (login → view customers → view invoices)
6. 🎉 Demo to stakeholders!

## Demo Customer Logins

All passwords follow pattern: `demo-{tier}-2026`

1. **HealthCorp** (Healthcare):
   - Email: `admin@healthcorp.example.com`
   - Password: `demo-healthcare-2026`

2. **FinTechAI** (Fintech):
   - Email: `admin@fintechai.example.com`
   - Password: `demo-fintech-2026`

3. **StartupMVP** (Standard):
   - Email: `admin@startupmvp.example.com`
   - Password: `demo-standard-2026`

4. **GovContractor** (Government):
   - Email: `admin@govcontractor.example.com`
   - Password: `demo-government-2026`

5. **SaaSPlatform** (Fintech):
   - Email: `admin@saasplatform.example.com`
   - Password: `demo-fintech2-2026`

---

**Total time to deploy:** ~3 minutes  
**Total cost:** ~$0.36/month  
**Perfect for:** Demos, testing, development
