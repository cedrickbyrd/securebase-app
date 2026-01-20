# API Gateway Deployment Guide

## Overview
This module deploys a production-grade API Gateway REST API with comprehensive security controls for SecureBase multi-tenant SaaS platform.

## Security Features

### ✅ Authentication & Authorization
- **JWT Authorizer**: Lambda-based REQUEST authorizer validates session tokens
- **Authorizer Caching**: 5-minute TTL reduces Lambda invocations (cost optimization)
- **Public Auth Endpoint**: `/auth` endpoint accepts API keys, returns session tokens

### ✅ Encryption & Transport Security
- **TLS 1.2+**: Minimum TLS version enforced
- **HTTPS Only**: No HTTP endpoints exposed
- **Regional Endpoint**: Lower latency vs edge-optimized

### ✅ Logging & Monitoring
- **Access Logs**: Full request/response logging to CloudWatch
- **CloudWatch Metrics**: 4XX/5XX errors, latency, request count
- **X-Ray Tracing**: Distributed tracing enabled for debugging
- **CloudWatch Alarms**: 
  - 4XX errors > 100 in 5 minutes
  - 5XX errors > 10 in 5 minutes  
  - Latency > 5000ms average

### ✅ Rate Limiting & Throttling
- **Default Rate Limit**: 100 req/sec per API key
- **Default Burst Limit**: 200 concurrent requests
- **Per-Method Overrides**: Can customize for high-traffic endpoints

### ✅ CORS Configuration
- **Preflight OPTIONS**: Mock integration for fast response
- **Allowed Origins**: Configurable (default: portal.securebase.com)
- **Cache-Control**: 7200 second max-age for preflight responses
- **Secure Headers**: Content-Type, Authorization only

### ✅ Security Headers
All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

## API Endpoints

### Authentication
- `POST /auth` - Exchange API key for session token (public)

### Webhooks
- `GET /webhooks` - List webhooks (authenticated)
- `POST /webhooks` - Create webhook (authenticated)

### Invoices
- `GET /invoices` - List invoices (authenticated)

### Support
- `GET /support/tickets` - List tickets (authenticated)
- `POST /support/tickets` - Create ticket (authenticated)

### Forecasting
- `GET /forecasting` - Get cost forecasts (authenticated)

## Deployment

### Prerequisites
1. Lambda functions deployed:
   - `auth_v2` - Authentication handler
   - `webhook_manager` - Webhook CRUD operations
   - `billing_worker` - Invoice generation
   - `support_tickets` - Support ticket system
   - `cost_forecasting` - Cost prediction

2. Variables configured in root module:
   ```hcl
   module "api_gateway" {
     source = "./modules/api-gateway"
     
     environment = var.environment
     aws_region  = var.aws_region
     
     # Lambda ARNs
     auth_lambda_arn        = module.auth_lambda.arn
     auth_lambda_name       = module.auth_lambda.name
     webhook_lambda_arn     = module.webhook_lambda.arn
     webhook_lambda_name    = module.webhook_lambda.name
     billing_lambda_arn     = module.billing_lambda.arn
     billing_lambda_name    = module.billing_lambda.name
     support_lambda_arn     = module.support_lambda.arn
     support_lambda_name    = module.support_lambda.name
     forecasting_lambda_arn = module.forecasting_lambda.arn
     forecasting_lambda_name = module.forecasting_lambda.name
     
     # Security settings
     default_rate_limit   = 100
     default_burst_limit  = 200
     log_retention_days   = 30
     
     # CORS
     allowed_origins = ["https://portal.securebase.com"]
     
     tags = var.tags
   }
   ```

### Deploy
```bash
cd landing-zone/environments/dev
terraform init
terraform plan -target=module.api_gateway
terraform apply -target=module.api_gateway
```

### Verify Deployment
```bash
# Get API endpoint
terraform output api_gateway_endpoint

# Test auth endpoint (public)
curl -X POST https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/auth \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Test authenticated endpoint
curl -X GET https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/webhooks \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Cost Estimation

### API Gateway Costs
- **Free Tier**: 1M API calls/month (12 months)
- **After Free Tier**: $3.50 per million requests
- **Data Transfer**: $0.09/GB out

### Monthly Estimate (10,000 customers)
- 10,000 customers × 1,000 API calls/month = 10M requests
- 10M requests × $3.50 = **$35/month**
- CloudWatch Logs (1GB/month): **$0.50/month**
- **Total: ~$36/month**

### Optimization Tips
1. **Enable authorizer caching** (already enabled - 5 min TTL)
2. **Compress responses** (enabled with minimum_compression_size = 0)
3. **Use CloudFront** for static content caching
4. **Monitor 4XX errors** to catch client misconfigurations

## Troubleshooting

### Issue: Authorizer returns 401 Unauthorized
**Cause**: JWT token expired or invalid
**Solution**: Refresh session token by calling `/auth` with API key

### Issue: CORS preflight fails
**Cause**: Origin not in allowed list
**Solution**: Add origin to `allowed_origins` variable

### Issue: Lambda permission denied
**Cause**: API Gateway doesn't have invoke permission
**Solution**: Check `aws_lambda_permission` resources are applied

### Issue: High 5XX errors
**Cause**: Lambda timeout or errors
**Solution**: 
1. Check CloudWatch logs for Lambda errors
2. Increase Lambda memory/timeout
3. Check VPC security groups (if VPC-enabled)

## Next Steps (v0.3 Hardening)
- [ ] Add AWS WAF with OWASP rulesets
- [ ] Configure request validation models
- [ ] Add per-method throttling for high-traffic endpoints
- [ ] Implement API key rotation policy
- [ ] Add custom domain with ACM certificate
- [ ] Enable API Gateway caching ($$)

## Outputs
- `api_gateway_endpoint` - Base URL for API (e.g., https://abc123.execute-api.us-east-1.amazonaws.com/dev)
- `api_endpoints` - Map of all endpoint URLs
- `cloudwatch_log_group_name` - Log group for debugging
