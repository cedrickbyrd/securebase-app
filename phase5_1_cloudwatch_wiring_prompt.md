# GitHub Copilot Prompt: Wire Phase 5.1 to Live CloudWatch API Gateway

## Context

Repository: `cedrickbyrd/securebase-app`  
Priority: HIGH — Phase 5.1 is code-complete but serving mock data. This wires it to real infrastructure.

### What Exists (Do NOT recreate)
- `phase3a-portal/src/services/adminService.js` — API client with 7 endpoints, falls back to mock data on error
- `phase2-backend/functions/metrics_aggregation.py` — Lambda handler with full CloudWatch, DynamoDB, Cost Explorer, Security Hub integration
- `landing-zone/modules/api-gateway/` — API Gateway Terraform module (REGIONAL endpoint)
- `landing-zone/outputs.tf` — Outputs `api_gateway_endpoint` already
- `phase3a-portal/.env.production` — `VITE_API_BASE_URL=https://api.securebase.tximhotep.com`
- `phase3a-portal/.env.example` — All `VITE_*` env vars documented

### The Gap
The `metrics_aggregation.py` Lambda exists but is **not deployed or wired to API Gateway**.  
The `adminService.js` calls `https://api.securebase.tximhotep.com/admin/*` but those routes **do not exist** yet in API Gateway.  
The Terraform in `landing-zone/` has no Phase 5.1 Lambda resource or `/admin` routes defined.

---

## Task

Create a new Terraform module `landing-zone/modules/phase5-admin-metrics/` that:

### 1. Lambda Deployment
```hcl
# Deploy metrics_aggregation.py as a Lambda function
resource "aws_lambda_function" "admin_metrics" {
  function_name = "securebase-${var.environment}-admin-metrics"
  filename      = "${path.module}/lambda/metrics_aggregation.zip"
  handler       = "metrics_aggregation.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      CUSTOMERS_TABLE   = "securebase-${var.environment}-customers"
      METRICS_TABLE     = "securebase-${var.environment}-metrics"
      DEPLOYMENTS_TABLE = "securebase-${var.environment}-deployments"
      ENVIRONMENT       = var.environment
      LOG_LEVEL         = "INFO"
    }
  }

  role = aws_iam_role.admin_metrics_lambda.arn
}
```

### 2. IAM Role for Lambda
The Lambda needs these AWS managed policies / inline permissions:
- `CloudWatchReadOnlyAccess`
- `AWSCostAndUsageReportROAccess`
- `SecurityHub:GetFindings` (inline)
- DynamoDB `GetItem`, `Query`, `Scan` on `securebase-*` tables (inline)
- Basic Lambda execution (`AWSLambdaBasicExecutionRole`)

### 3. API Gateway Routes on Existing Gateway
Wire the Lambda to the **existing** `aws_api_gateway_rest_api.securebase_api` (do NOT create a new gateway). Add these 7 routes under `/admin`:

| Method | Path | Handler |
|--------|------|---------|
| GET | /admin/metrics | metrics_aggregation.lambda_handler |
| GET | /admin/customers | metrics_aggregation.lambda_handler |
| GET | /admin/api-performance | metrics_aggregation.lambda_handler |
| GET | /admin/infrastructure | metrics_aggregation.lambda_handler |
| GET | /admin/security | metrics_aggregation.lambda_handler |
| GET | /admin/costs | metrics_aggregation.lambda_handler |
| GET | /admin/deployments | metrics_aggregation.lambda_handler |

Each route needs:
- `aws_api_gateway_resource` under parent `/admin`
- `aws_api_gateway_method` (GET, authorization: NONE for now — JWT auth is handled in Lambda)
- `aws_api_gateway_integration` (AWS_PROXY, POST to Lambda invoke ARN)
- CORS `OPTIONS` method with `Access-Control-Allow-Origin: https://demo.securebase.tximhotep.com`
- `aws_lambda_permission` allowing `apigateway.amazonaws.com` to invoke

### 4. API Gateway Deployment / Stage
- Create `aws_api_gateway_deployment` triggered on route changes
- Stage name: `var.environment` (dev/staging/production)
- Enable CloudWatch logging on the stage (already have IAM role from existing module)
- Output the invoke URL as `admin_api_invoke_url`

### 5. Lambda Packaging Helper Script
Create `landing-zone/modules/phase5-admin-metrics/build.sh`:
```bash
#!/bin/bash
# Packages metrics_aggregation.py for Lambda deployment
set -e
SRC="../../../../phase2-backend/functions/metrics_aggregation.py"
OUT="lambda/metrics_aggregation.zip"
mkdir -p lambda
cp $SRC lambda/
cd lambda && zip ../metrics_aggregation.zip metrics_aggregation.py && cd ..
echo "✅ Lambda packaged: $OUT"
```

### 6. Wire into Landing Zone
In `landing-zone/main.tf`, add:
```hcl
module "phase5_admin_metrics" {
  source      = "./modules/phase5-admin-metrics"
  environment = var.environment
  tags        = local.common_tags
  api_gateway_id          = module.api_gateway.api_gateway_id
  api_gateway_root_resource_id = module.api_gateway.root_resource_id
  api_gateway_execution_arn    = module.api_gateway.execution_arn
}
```

In `landing-zone/outputs.tf`, add:
```hcl
output "admin_metrics_api_url" {
  value = module.phase5_admin_metrics.admin_api_invoke_url
  description = "Live CloudWatch metrics endpoint for Phase 5.1 Admin Dashboard"
}
```

### 7. Update adminService.js — Remove Mock Fallback in Production
In `phase3a-portal/src/services/adminService.js`, update the catch blocks to NOT fall back to mock data when `import.meta.env.VITE_USE_MOCK_API !== 'true'`:

```javascript
} catch (error) {
  console.error('Error fetching platform metrics:', error);
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return this.getMockPlatformMetrics(timeRange);
  }
  throw error; // Surface real errors in production so dashboard shows error state
}
```

Apply this pattern to all 7 fetch methods in adminService.js.

### 8. Add Error State to AdminDashboard.jsx
In `phase3a-portal/src/components/admin/AdminDashboard.jsx`, add an error banner component that renders when the API call throws (instead of silently showing stale/empty data):

```jsx
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
    <p className="text-red-800 font-medium">⚠️ Unable to load live metrics</p>
    <p className="text-red-600 text-sm">{error.message} — Check CloudWatch endpoint configuration.</p>
  </div>
)}
```

---

## Acceptance Criteria

- [ ] `terraform plan` in `landing-zone/` shows Lambda + 7 API Gateway routes with no errors
- [ ] `terraform apply` deploys successfully to `dev` environment
- [ ] `curl https://<invoke_url>/dev/admin/metrics` returns real CloudWatch JSON (not mock)
- [ ] `https://demo.securebase.tximhotep.com` Admin Dashboard shows live data with no console errors
- [ ] `VITE_USE_MOCK_API=false` in `.env.production` confirmed — mock fallback disabled
- [ ] CORS headers present: `Access-Control-Allow-Origin: https://demo.securebase.tximhotep.com`
- [ ] CloudWatch Logs show Lambda invocations under `/aws/lambda/securebase-production-admin-metrics`
- [ ] Error banner appears on dashboard if endpoint unreachable (not silent failure)

---

## File Checklist (Create/Modify)

**Create:**
- `landing-zone/modules/phase5-admin-metrics/main.tf`
- `landing-zone/modules/phase5-admin-metrics/variables.tf`
- `landing-zone/modules/phase5-admin-metrics/outputs.tf`
- `landing-zone/modules/phase5-admin-metrics/build.sh`

**Modify:**
- `landing-zone/main.tf` — add `module "phase5_admin_metrics"`
- `landing-zone/outputs.tf` — add `admin_metrics_api_url`
- `phase3a-portal/src/services/adminService.js` — remove unconditional mock fallback
- `phase3a-portal/src/components/admin/AdminDashboard.jsx` — add error state UI

**Do NOT modify:**
- `phase2-backend/functions/metrics_aggregation.py` — Lambda code is complete
- `landing-zone/modules/api-gateway/` — reuse existing gateway, don't replace it
- `phase3a-portal/.env.production` — already correctly set

---

## Constraints & Notes

- Use Terraform `~> 5.0` AWS provider (matches existing `provider.tf`)
- Python runtime: `python3.11` (matches existing Lambda functions in repo)
- CORS origin: `https://demo.securebase.tximhotep.com` — do NOT use wildcard `*` in production
- JWT auth is handled inside the Lambda — API Gateway authorization remains NONE for now
- Tag all resources with `Environment = var.environment` and `Phase = "5.1"` for cost tracking
- Do NOT introduce `--legacy-peer-deps` changes — frontend peer deps are already stabilized

---

**Commit message suggestion:**
```
feat(phase5.1): wire admin metrics Lambda to API Gateway CloudWatch endpoint

- Add Terraform module phase5-admin-metrics with Lambda + 7 /admin routes
- Wire to existing API Gateway (securebase-{env}-api)
- Remove unconditional mock fallback in adminService.js
- Add error state UI to AdminDashboard.jsx
- Output admin_metrics_api_url from landing-zone

Closes #[issue for Phase 5.1 live wiring]
```
