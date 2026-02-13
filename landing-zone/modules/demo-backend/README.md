# SecureBase Demo Backend

**Lightweight serverless backend for Phase 2 demo - Production-like API with deterministic data**

## Overview

This Terraform module creates a fully-functional serverless backend API that:
- ✅ Uses the exact 5 test clients from `phase3a-portal/src/mocks/mockData.js`
- ✅ Provides real API endpoints with JWT authentication
- ✅ Returns deterministic data (same as the mock data)
- ✅ Costs pennies to run (DynamoDB on-demand + Lambda)
- ✅ Deploys in minutes with Terraform
- ✅ Easy to destroy when done

## Architecture

```
┌─────────────────┐
│  Netlify CDN    │
│  (Frontend)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Gateway    │ ◄── CORS enabled for Netlify
│  REST API       │
└────────┬────────┘
         │
    ┌────┴────────────────────┐
    │                         │
    ▼                         ▼
┌──────────┐         ┌──────────────┐
│ Lambda   │         │  DynamoDB    │
│ Functions│◄────────┤  Tables      │
│  (5)     │         │  (3)         │
└──────────┘         └──────────────┘
│  auth              │  customers
│  customers         │  invoices
│  invoices          │  metrics
│  metrics           
│  health
```

### Components

1. **API Gateway REST API** - Single endpoint with routes
2. **5 Lambda Functions** (Python 3.11):
   - `auth` - JWT token generation and validation
   - `customers` - Customer data queries
   - `invoices` - Invoice data queries
   - `metrics` - Aggregated metrics
   - `health` - Health check
3. **3 DynamoDB Tables** (on-demand):
   - `customers` - 5 demo customers
   - `invoices` - 30 invoices (5 customers × 6 months)
   - `metrics` - 1 global metrics record
4. **CloudWatch Logs** - 7-day retention

## Demo Customers

The backend includes 5 realistic demo customers across different tiers:

| Customer | Email | Tier | Framework | Monthly Price |
|----------|-------|------|-----------|---------------|
| HealthCorp Medical Systems | admin@healthcorp.example.com | Healthcare | HIPAA | $15,000 |
| FinTechAI Analytics | admin@fintechai.example.com | Fintech | SOC 2 Type II | $8,000 |
| StartupMVP Inc | admin@startupmvp.example.com | Standard | CIS Foundations | $2,000 |
| GovContractor Defense Solutions | admin@govcontractor.example.com | Government | FedRAMP Low | $25,000 |
| SaaSPlatform Cloud Services | admin@saasplatform.example.com | Fintech | SOC 2 Type II | $8,000 |

## Quick Start

### Prerequisites

- AWS CLI configured with credentials
- Terraform >= 1.0
- Python 3.11+ (for data generation scripts)

### Deploy

```bash
# Navigate to your environment directory
cd landing-zone/environments/dev

# Add demo-backend module to your main.tf
cat >> main.tf <<EOF

# Demo Backend Module
module "demo_backend" {
  source = "../../modules/demo-backend"
  
  project_name  = "securebase"
  environment   = "demo"
  jwt_secret    = "change-this-in-production"
  
  auto_populate_data = true
  log_retention_days = 7
  
  tags = {
    Project     = "SecureBase"
    Environment = "Demo"
  }
}

output "demo_backend_api_endpoint" {
  value = module.demo_backend.api_endpoint
}

output "demo_backend_credentials" {
  value     = module.demo_backend.demo_credentials
  sensitive = true
}
EOF

# Initialize and deploy
terraform init
terraform plan
terraform apply

# Get API endpoint
API_ENDPOINT=$(terraform output -raw demo_backend_api_endpoint)
echo "API Endpoint: $API_ENDPOINT"

# Get demo credentials
terraform output -json demo_backend_credentials
```

### Test the API

```bash
# Health check
curl $API_ENDPOINT/health

# Login
TOKEN=$(curl -X POST $API_ENDPOINT/auth \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "login",
    "email": "admin@healthcorp.example.com",
    "password": "demo-healthcare-2026"
  }' | jq -r '.token')

echo "Token: $TOKEN"

# Get customers
curl $API_ENDPOINT/customers \
  -H "Authorization: Bearer $TOKEN"

# Get invoices
curl $API_ENDPOINT/invoices \
  -H "Authorization: Bearer $TOKEN"

# Get metrics
curl $API_ENDPOINT/metrics \
  -H "Authorization: Bearer $TOKEN"
```

## API Endpoints

### Authentication

**POST /auth**
```json
// Login
{
  "action": "login",
  "email": "admin@healthcorp.example.com",
  "password": "demo-healthcare-2026"
}

// Response
{
  "token": "eyJ...",
  "customer": {
    "id": "demo-customer-001",
    "name": "HealthCorp Medical Systems",
    "email": "admin@healthcorp.example.com",
    "tier": "healthcare"
  },
  "expires_in": 86400
}
```

**POST /auth** (verify)
```json
{
  "action": "verify",
  "token": "eyJ..."
}
```

### Customers

**GET /customers** - List all customers (requires auth)
**GET /customers/{id}** - Get single customer (requires auth)

### Invoices

**GET /invoices** - List all invoices (requires auth)
**GET /invoices?customer_id=demo-customer-001** - Filter by customer
**GET /invoices/{id}** - Get single invoice (requires auth)

### Metrics

**GET /metrics** - Get aggregated metrics (requires auth)

### Health

**GET /health** - Health check (no auth required)

## Data Loading

### Automatic (Recommended)

Set `auto_populate_data = true` in module configuration (default). Terraform will load data on first apply.

### Manual

If you need to reload data or load it separately:

```bash
cd landing-zone/modules/demo-backend/scripts

# Load all data
./load_data.sh \
  securebase-demo-customers-demo \
  securebase-demo-invoices-demo \
  securebase-demo-metrics-demo

# Or load individually
python3 generate_batch_files.py
aws dynamodb batch-write-item --request-items file://load_customers.json
aws dynamodb batch-write-item --request-items file://load_invoices_batch1.json
```

## Cost Estimate

**Monthly cost for demo environment (assuming light usage):**

| Service | Usage | Cost |
|---------|-------|------|
| API Gateway | 10K requests/month | $0.04 |
| Lambda | 10K invocations, 128-256MB | $0.02 |
| DynamoDB | On-demand, ~100KB data | $0.25 |
| CloudWatch Logs | 100MB/month | $0.05 |
| **Total** | | **~$0.36/month** |

**With moderate usage (100K requests/month): ~$1-2/month**

## Frontend Integration

Update your Netlify frontend environment variables:

```bash
# Netlify environment variables
VITE_API_ENDPOINT=https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/demo
VITE_DEMO_MODE=false
```

Update `phase3a-portal/src/services/api.js`:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT;

// Use real API endpoints instead of mock data
export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email, password })
  });
  return response.json();
}
```

## Development

### Lambda Functions

All Lambda functions are in `lambda/` directory:
- `auth.py` - Authentication with JWT
- `customers.py` - Customer data queries
- `invoices.py` - Invoice data queries
- `metrics.py` - Metrics queries
- `health.py` - Health check

To update a function:
```bash
# Edit the function
vim lambda/auth.py

# Terraform will detect changes and redeploy
terraform apply
```

### Data Files

- `data/customers.json` - 5 demo customers
- `data/invoices.json` - 30 invoices (generated)
- `data/metrics.json` - Global metrics (static demo data for consistent demos)
- `data/generate_invoices.py` - Invoice generation script

**Note:** The metrics.json file contains static historical data (Sep 2025 - Feb 2026) 
for consistent demo presentations. This is intentional for demo purposes. In production, 
metrics would be calculated dynamically from real data.

To regenerate invoices:
```bash
cd data
python3 generate_invoices.py > invoices.json
```

### CORS Configuration

CORS is configured in Lambda functions to allow all origins (`*`) for demo purposes. In production, restrict to your domain:

```python
def cors_headers():
    return {
        "Access-Control-Allow-Origin": "https://your-custom-domain.com",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    }
```

## Monitoring

### CloudWatch Logs

```bash
# View auth logs
aws logs tail /aws/lambda/securebase-demo-auth-demo --follow

# View customers logs
aws logs tail /aws/lambda/securebase-demo-customers-demo --follow

# View all logs
aws logs tail --follow --filter-pattern "ERROR"
```

### Metrics

```bash
# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=securebase-demo-auth-demo \
  --start-time 2026-02-01T00:00:00Z \
  --end-time 2026-02-04T00:00:00Z \
  --period 3600 \
  --statistics Sum

# API Gateway requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=securebase-demo-api-demo \
  --start-time 2026-02-01T00:00:00Z \
  --end-time 2026-02-04T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## Troubleshooting

### CORS errors

If you see CORS errors in the browser:
1. Verify Lambda functions return CORS headers
2. Check API Gateway has OPTIONS methods configured
3. Ensure `Access-Control-Allow-Origin` matches your frontend domain

### 401 Unauthorized

1. Verify JWT token is being sent in `Authorization: Bearer <token>` header
2. Check token hasn't expired (24 hour expiry)
3. Login again to get fresh token

### Empty data

If API returns empty arrays:
1. Check data was loaded: `aws dynamodb scan --table-name securebase-demo-customers-demo`
2. Reload data: `cd scripts && ./load_data.sh`
3. Check Lambda environment variables point to correct tables

### Lambda errors

View logs for detailed error messages:
```bash
aws logs tail /aws/lambda/securebase-demo-<function>-demo --follow
```

Common issues:
- Missing DynamoDB table permissions
- Wrong table names in environment variables
- Python syntax errors

## Cleanup

```bash
# Remove the module from main.tf
# Then destroy resources
terraform destroy

# Or destroy specific module
terraform destroy -target=module.demo_backend
```

**Note:** This will delete all DynamoDB tables and data. Back up if needed.

## Security Considerations

This is a **DEMO** backend with intentional simplifications:

1. **Hardcoded credentials** - For demo only. Production should use proper auth provider.
2. **Simple JWT** - Uses basic HMAC signing. Production should use PyJWT library.
3. **No rate limiting** - Add API Gateway throttling for production.
4. **CORS allows all** - Restrict to specific domains in production.
5. **Logs in plaintext** - Consider encryption for sensitive data.

## Production Readiness

To make this production-ready:

1. ✅ Replace demo credentials with real authentication (Cognito, Auth0, etc.)
2. ✅ Use PyJWT library for proper JWT handling
3. ✅ Add API Gateway API keys or usage plans
4. ✅ Enable DynamoDB encryption at rest (already enabled)
5. ✅ Enable point-in-time recovery for DynamoDB
6. ✅ Add CloudWatch alarms for errors
7. ✅ Implement rate limiting
8. ✅ Add request validation
9. ✅ Use Secrets Manager for JWT secret
10. ✅ Enable AWS WAF for API Gateway

## Files Structure

```
demo-backend/
├── main.tf                 # Main Terraform configuration
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── README.md              # This file
├── lambda/                # Lambda function code
│   ├── auth.py
│   ├── customers.py
│   ├── invoices.py
│   ├── metrics.py
│   └── health.py
├── data/                  # Demo data files
│   ├── customers.json
│   ├── invoices.json
│   ├── metrics.json
│   └── generate_invoices.py
└── scripts/               # Helper scripts
    ├── generate_batch_files.py
    └── load_data.sh
```

## Contributing

This module is specific to SecureBase demo infrastructure. For changes:

1. Test locally with `terraform plan`
2. Update README if adding features
3. Ensure backward compatibility
4. Keep costs minimal (use on-demand pricing)

## License

Part of SecureBase PaaS infrastructure. Internal use only.

## Support

For issues or questions:
- Check CloudWatch Logs first
- Review Terraform outputs
- Verify AWS credentials and permissions
- See troubleshooting section above

---

**Last Updated:** 2026-02-04  
**Version:** 1.0.0  
**Terraform:** >= 1.0  
**AWS Provider:** ~> 5.0
