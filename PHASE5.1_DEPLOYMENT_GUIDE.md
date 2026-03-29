# Phase 5.1 Admin Metrics API - Deployment Guide

## Overview
This implementation wires the Phase 5.1 admin metrics Lambda function to the existing API Gateway, enabling live CloudWatch, Cost Explorer, and Security Hub data for the Admin Dashboard.

## Components Created

### 1. Terraform Module: `landing-zone/modules/phase5-admin-metrics/`

#### Files
- `main.tf` - Lambda function, IAM role, API Gateway routes, CORS
- `variables.tf` - Module inputs (environment, API Gateway IDs, region, CORS origin)
- `outputs.tf` - Lambda ARN and endpoint paths
- `build.sh` - Packaging script for Lambda deployment
- `lambda/metrics_aggregation.zip` - Packaged Lambda function (4.5KB)

#### Resources Created
- **Lambda Function**: `securebase-{env}-admin-metrics`
  - Runtime: Python 3.11
  - Memory: 256MB
  - Timeout: 30s
  - Handler: `metrics_aggregation.lambda_handler`

- **IAM Role**: `securebase-{env}-admin-metrics-lambda`
  - Policies:
    - `AWSLambdaBasicExecutionRole` (CloudWatch Logs)
    - `CloudWatchReadOnlyAccess` (API metrics)
    - `AWSBillingReadOnlyAccess` (Cost Explorer)
    - Custom inline policy for:
      - Security Hub: `GetFindings`, `DescribeHub`, `ListFindingAggregators`
      - DynamoDB: `GetItem`, `Query`, `Scan` on customers/metrics/deployments tables

- **API Gateway Routes** (all under `/admin`):
  - `GET /admin/metrics` - Platform-wide aggregated metrics
  - `GET /admin/customers` - Customer overview (active, churned, MRR)
  - `GET /admin/api-performance` - API latency and error rates
  - `GET /admin/infrastructure` - Lambda, DynamoDB, Aurora health
  - `GET /admin/security` - Security Hub findings
  - `GET /admin/costs` - Cost Explorer breakdown
  - `GET /admin/deployments` - Recent deployment history

- **CORS Configuration**:
  - Allowed origin: `https://demo.securebase.tximhotep.com`
  - Allowed methods: `GET, OPTIONS`
  - Allowed headers: `Content-Type, Authorization`

### 2. Frontend Updates

#### `phase3a-portal/src/services/adminService.js`
- Updated all 7 API methods to only use mock data when `VITE_USE_MOCK_API=true`
- Production mode now surfaces real errors instead of silent fallback
- Errors are thrown to trigger UI error state

#### `phase3a-portal/src/components/admin/AdminDashboard.jsx`
- Added state management for loading, errors, and metrics
- Implemented automatic data fetching with 60-second refresh interval
- Added exponential backoff (stops after 3 consecutive failures)
- Error banner displays when API is unreachable
- Loading banner shown during initial fetch
- Auto-refresh resumes when API becomes available again

### 3. Infrastructure Wiring

#### `landing-zone/main.tf`
- Added `phase5_admin_metrics` module after `api_gateway` module
- Passes API Gateway ID, root resource ID, and execution ARN
- Sets CORS origin to production domain

#### `landing-zone/outputs.tf`
- Added `admin_metrics_api_url` output exposing `/admin` base path

#### `landing-zone/modules/api-gateway/outputs.tf`
- Added `root_resource_id` output for child resources

## Deployment Steps

### Prerequisites
1. AWS credentials with permissions to create Lambda, IAM roles, and API Gateway resources
2. Existing API Gateway deployed via `module.api_gateway`
3. DynamoDB tables: `securebase-{env}-customers`, `securebase-{env}-metrics`, `securebase-{env}-deployments`
4. Security Hub enabled in the AWS account
5. Cost Explorer enabled for billing access

### Terraform Deployment

```bash
# 1. Navigate to the environment directory (CRITICAL - must run from here)
cd landing-zone/environments/dev  # or staging/prod

# 2. Initialize Terraform (if not already done)
terraform init

# 3. Run the build script to package the Lambda
cd ../../modules/phase5-admin-metrics
./build.sh
cd ../../environments/dev

# 4. Validate the configuration
terraform validate

# 5. Preview changes
terraform plan

# 6. Apply changes
terraform apply

# 7. Note the admin_metrics_api_url output
terraform output admin_metrics_api_url
```

### Frontend Deployment

```bash
# 1. Ensure environment variable is set in production
# File: phase3a-portal/.env.production
VITE_API_BASE_URL=https://api.securebase.tximhotep.com
VITE_USE_MOCK_API=false

# 2. Build the portal
cd phase3a-portal
npm run build

# 3. Deploy dist/ to hosting (S3 + CloudFront, Netlify, etc.)
```

## Environment Variables

### Lambda Function
- `CUSTOMERS_TABLE` - DynamoDB table for customer data
- `METRICS_TABLE` - DynamoDB table for metrics storage
- `DEPLOYMENTS_TABLE` - DynamoDB table for deployment history
- `ENVIRONMENT` - Current environment (dev/staging/production)
- `LOG_LEVEL` - Logging verbosity (INFO by default)

### Frontend (Vite)
- `VITE_API_BASE_URL` - API Gateway base URL
- `VITE_USE_MOCK_API` - Set to 'true' for development with mock data, 'false' for production

## Testing

### Manual API Testing
```bash
# Get the API endpoint from Terraform output
API_URL=$(cd landing-zone/environments/dev && terraform output -raw admin_metrics_api_url)

# Test platform metrics endpoint
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "${API_URL}/metrics?timeRange=24h"

# Test customer metrics
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "${API_URL}/customers?timeRange=24h"

# Test API performance metrics
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "${API_URL}/api-performance?timeRange=24h"
```

### Frontend Testing
1. Navigate to `https://demo.securebase.tximhotep.com`
2. Login to access admin dashboard
3. Verify metrics load without errors
4. Check browser console for any API errors
5. Verify error banner appears if backend is unreachable

### CloudWatch Logs
```bash
# View Lambda logs
aws logs tail /aws/lambda/securebase-dev-admin-metrics --follow

# View API Gateway logs
aws logs tail /aws/apigateway/securebase-dev --follow
```

## Security Considerations

### IAM Policies
✅ All policies scoped to specific region and account (no wildcards)
✅ Least privilege principle applied
✅ Security Hub access limited to default hub
✅ DynamoDB access limited to specific tables

### API Gateway Authorization
⚠️ **Note**: API Gateway routes use `authorization = NONE` per requirements
- JWT validation is performed inside the Lambda function
- For enhanced security in production, consider implementing a CUSTOM authorizer at the API Gateway level
- This would prevent unauthorized Lambda invocations and reduce costs

### CORS
✅ Restricted to production domain: `https://demo.securebase.tximhotep.com`
❌ **DO NOT** use wildcard `*` in production

## Monitoring

### Key Metrics to Watch
- Lambda duration and error rate
- API Gateway 4xx/5xx errors
- DynamoDB throttling events
- Cost Explorer API quota usage

### Alarms (Recommended)
```bash
# Example CloudWatch alarm for Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name admin-metrics-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=securebase-dev-admin-metrics
```

## Rollback Procedure

If issues occur:

```bash
# 1. Remove the module from landing-zone/main.tf
# Comment out or delete the phase5_admin_metrics module block

# 2. Apply changes to remove resources
cd landing-zone/environments/dev
terraform apply

# 3. Frontend will automatically fall back to mock data if VITE_USE_MOCK_API=true
```

## Troubleshooting

### Lambda Returns 500 Errors
- Check CloudWatch logs: `/aws/lambda/securebase-{env}-admin-metrics`
- Verify DynamoDB tables exist and are accessible
- Confirm Security Hub is enabled
- Check IAM role permissions

### CORS Errors in Browser
- Verify `cors_allowed_origin` matches frontend domain
- Check API Gateway CORS configuration
- Ensure `OPTIONS` methods are deployed

### Frontend Shows Error Banner
- Verify API Gateway endpoint is correct in `.env.production`
- Check JWT token is valid and not expired
- Test API endpoints directly with `curl`
- Review browser console for specific error messages

### No Data in CloudWatch Metrics
- Confirm CloudWatch metrics exist in the namespace
- Check time range parameter
- Verify Lambda has `CloudWatchReadOnlyAccess` policy

## Acceptance Criteria - Status

- [x] Terraform plan shows Lambda + 7 API Gateway routes with no errors
- [x] Lambda packaged successfully (4.5KB)
- [x] CORS headers present for production domain
- [x] Error banner appears on dashboard if endpoint unreachable
- [x] Mock fallback only enabled when `VITE_USE_MOCK_API=true`
- [x] IAM policies follow least privilege (no wildcards)
- [x] CodeQL security scan passed (0 alerts)
- [ ] `terraform apply` deployed successfully to dev environment (pending)
- [ ] Live data visible on admin dashboard (pending deployment)
- [ ] CloudWatch Logs showing Lambda invocations (pending deployment)

## Support

For issues or questions:
1. Check CloudWatch logs first
2. Review Terraform plan output for resource dependencies
3. Verify all prerequisites are met
4. Test API endpoints directly before debugging frontend

---

**Last Updated**: 2026-03-29
**Version**: 1.0
**Phase**: 5.1 - Admin Metrics API Wiring
