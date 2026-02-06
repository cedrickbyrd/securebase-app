# SecureBase Demo Backend Module - File Index

Complete reference of all files in the demo-backend module.

## Module Structure

```
demo-backend/
├── README.md                    # Main documentation
├── QUICKSTART.md               # 1-minute quick start guide
├── DEPLOYMENT.md               # Complete deployment guide
├── example.tf                  # Example usage configuration
├── main.tf                     # Main Terraform configuration
├── variables.tf                # Input variables
├── outputs.tf                  # Output values
├── .gitignore                  # Git ignore patterns
│
├── lambda/                     # Lambda function code (Python 3.11)
│   ├── auth.py                # JWT authentication (215 lines)
│   ├── customers.py           # Customer data queries (111 lines)
│   ├── invoices.py            # Invoice data queries (125 lines)
│   ├── metrics.py             # Metrics queries (89 lines)
│   └── health.py              # Health check endpoint (73 lines)
│
├── data/                       # Demo data files
│   ├── customers.json         # 5 demo customers (1.5 KB)
│   ├── invoices.json          # 30 invoices, auto-generated (23 KB)
│   ├── metrics.json           # Global metrics (1 KB)
│   └── generate_invoices.py  # Invoice generation script (122 lines)
│
└── scripts/                    # Helper scripts
    ├── generate_batch_files.py # DynamoDB batch file generator (167 lines)
    ├── load_data.sh           # Data loading script (71 lines)
    └── test_api.sh            # API test suite (154 lines)
```

## File Descriptions

### Documentation

| File | Description | Lines/Size |
|------|-------------|------------|
| `README.md` | Complete module documentation with architecture, API reference, troubleshooting | 400+ lines |
| `QUICKSTART.md` | 1-minute and 5-minute quick start guides | 200+ lines |
| `DEPLOYMENT.md` | Step-by-step deployment guide with verification | 450+ lines |

### Terraform Configuration

| File | Description | Resources |
|------|-------------|-----------|
| `main.tf` | Infrastructure definition | 3 DynamoDB tables, 5 Lambda functions, API Gateway, IAM roles |
| `variables.tf` | Module input variables | 7 variables |
| `outputs.tf` | Module outputs | 7 outputs |
| `example.tf` | Usage example | Example configuration |

### Lambda Functions

| File | Purpose | Lines | Endpoints |
|------|---------|-------|-----------|
| `auth.py` | JWT authentication | 215 | POST /auth |
| `customers.py` | Customer queries | 111 | GET /customers, GET /customers/{id} |
| `invoices.py` | Invoice queries | 125 | GET /invoices, GET /invoices/{id} |
| `metrics.py` | Metrics queries | 89 | GET /metrics |
| `health.py` | Health checks | 73 | GET /health |

### Data Files

| File | Records | Size | Description |
|------|---------|------|-------------|
| `customers.json` | 5 | 1.5 KB | 5 demo customers across tiers |
| `invoices.json` | 30 | 23 KB | 6 months × 5 customers |
| `metrics.json` | 1 | 1 KB | Aggregated platform metrics |

### Scripts

| File | Purpose | Usage |
|------|---------|-------|
| `generate_batch_files.py` | Generate DynamoDB batch-write JSON files | Called by load_data.sh |
| `load_data.sh` | Load demo data into DynamoDB | `./load_data.sh <tables>` |
| `test_api.sh` | Comprehensive API test suite | `./test_api.sh <endpoint>` |

## Quick Reference

### Get Started in 1 Minute

```bash
cd landing-zone/environments/dev
cat ../../modules/demo-backend/example.tf >> main.tf
terraform init && terraform apply -auto-approve
terraform output demo_backend_api_endpoint
```

### Deploy Infrastructure

```bash
terraform apply
# Creates: 3 tables, 5 lambdas, 1 API, IAM roles, CloudWatch logs
# Time: ~2-3 minutes
# Cost: ~$0.36/month
```

### Test API

```bash
./scripts/test_api.sh $API_ENDPOINT
# Runs 15 tests: auth, customers, invoices, metrics, health, CORS
# Expected: All tests pass
```

### Load Data

```bash
./scripts/load_data.sh
# Loads: 5 customers, 30 invoices, 1 metrics record
# Time: ~10 seconds
```

## API Endpoints Summary

| Endpoint | Method | Auth | Returns |
|----------|--------|------|---------|
| `/health` | GET | No | Health status |
| `/auth` | POST | No | JWT token |
| `/customers` | GET | Yes | 5 customers |
| `/customers/{id}` | GET | Yes | Single customer |
| `/invoices` | GET | Yes | 30 invoices |
| `/invoices/{id}` | GET | Yes | Single invoice |
| `/metrics` | GET | Yes | Platform metrics |

## Demo Credentials

All 5 customers use pattern: `admin@{company}.example.com` / `demo-{tier}-2026`

1. **HealthCorp** - Healthcare/HIPAA - $15,000/mo
2. **FinTechAI** - Fintech/SOC2 - $8,000/mo  
3. **StartupMVP** - Standard/CIS - $2,000/mo
4. **GovContractor** - Government/FedRAMP - $25,000/mo
5. **SaaSPlatform** - Fintech/SOC2 - $8,000/mo

## Infrastructure Components

### DynamoDB Tables

1. **customers** - Hash: `id`, GSI: `email-index`
2. **invoices** - Hash: `id`, GSI: `customer-index` (customer_id, created_at)
3. **metrics** - Hash: `id` (single record)

All tables use:
- Billing mode: PAY_PER_REQUEST (on-demand)
- Encryption: AWS managed
- PITR: Optional (disabled by default for demo)

### Lambda Functions

All functions use:
- Runtime: Python 3.11
- Memory: 128-256 MB
- Timeout: 10-30 seconds
- Logs: 7-day retention

### API Gateway

- Type: REST API
- Endpoint: Regional
- CORS: Enabled for all routes
- Throttling: Default (10,000 req/s)

## Cost Breakdown

| Component | Pricing Model | Est. Monthly Cost |
|-----------|--------------|-------------------|
| DynamoDB Tables (3) | On-demand | $0.25 |
| Lambda Invocations | First 1M free | $0.02 |
| API Gateway | First 1M free, then $3.50/M | $0.04 |
| CloudWatch Logs | $0.50/GB | $0.05 |
| Data Transfer | $0.09/GB (out) | $0.00 |
| **Total** | | **$0.36** |

*Based on 10K requests/month. Moderate usage (100K/mo) ≈ $1-2/month*

## Testing Matrix

| Test | Endpoint | Expected | Status |
|------|----------|----------|--------|
| Health check | GET /health | 200 OK | ✅ |
| Login (valid) | POST /auth | 200 + token | ✅ |
| Login (invalid) | POST /auth | 401 error | ✅ |
| Token verify | POST /auth | 200 valid | ✅ |
| Get customers (no auth) | GET /customers | 401 error | ✅ |
| Get customers (auth) | GET /customers | 200 + 5 items | ✅ |
| Get customer by ID | GET /customers/id | 200 + item | ✅ |
| Get invoices (all) | GET /invoices | 200 + 30 items | ✅ |
| Get invoices (filtered) | GET /invoices?customer_id | 200 + 6 items | ✅ |
| Get invoice by ID | GET /invoices/id | 200 + item | ✅ |
| Get metrics | GET /metrics | 200 + data | ✅ |
| CORS preflight | OPTIONS /auth | 200 + headers | ✅ |

## Security Features

✅ JWT token authentication  
✅ DynamoDB encryption at rest  
✅ HTTPS only (via API Gateway)  
✅ IAM least privilege roles  
✅ CloudWatch logging enabled  
✅ CORS configured  
✅ No hardcoded AWS credentials  

## Known Limitations (Demo Mode)

⚠️ Hardcoded demo credentials  
⚠️ Simple JWT implementation (not PyJWT)  
⚠️ CORS allows all origins  
⚠️ No rate limiting  
⚠️ No request validation  

See DEPLOYMENT.md "Production Readiness" for upgrade path.

## Related Documentation

- [README.md](README.md) - Main documentation
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide  
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [example.tf](example.tf) - Usage example

## Module Statistics

- **Total Files:** 19
- **Lines of Code:** ~2,500
- **Lambda Functions:** 5 (613 LOC total)
- **Terraform Resources:** 40+
- **API Endpoints:** 7
- **Demo Data Records:** 36 (5 customers + 30 invoices + 1 metrics)
- **Deployment Time:** ~3 minutes
- **Monthly Cost:** ~$0.36

## Version

- **Module Version:** 1.0.0
- **Terraform Required:** >= 1.0
- **AWS Provider:** ~> 5.0
- **Python Runtime:** 3.11
- **Last Updated:** 2026-02-04

---

**Status:** ✅ Production-ready for demo environments  
**Next Steps:** See DEPLOYMENT.md for deployment instructions
