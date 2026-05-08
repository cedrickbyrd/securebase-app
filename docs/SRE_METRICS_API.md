# SRE Metrics API Reference

**Phase 5.3 — SRE/Operations Dashboard Backend**

Base URL: `https://api.securebase.tximhotep.com`  
Portal proxy: `/api/sre/*` → `https://api.securebase.tximhotep.com/sre/:splat`

> **Authentication note**: API Gateway methods use `NONE` authorization (consistent with other Phase 5 admin endpoints in this repo). In a production deployment, add an API Gateway Authorizer or restrict access to internal VPC endpoints. All endpoints return CORS headers scoped to `https://securebase.tximhotep.com`.

---

## Endpoints

### 1. `GET /sre/infrastructure`

Returns CPU, memory, disk, and network metrics for Lambda and ECS/EC2 workloads.

**Response (200 OK)**
```json
{
  "timestamp": "2026-05-08T03:00:00Z",
  "lambda": {
    "invocations": 4200,
    "errors": 12,
    "avg_duration_ms": 145.3
  },
  "ecs": {
    "cpu_utilization_pct": 34.7,
    "memory_utilization_pct": 62.1
  },
  "errors": []
}
```

**CloudWatch sources**
| Metric | Namespace | Stat |
|--------|-----------|------|
| Invocations | AWS/Lambda | Sum |
| Errors | AWS/Lambda | Sum |
| Duration | AWS/Lambda | Average |
| CPUUtilization | AWS/ECS | Average |
| MemoryUtilization | AWS/ECS | Average |

---

### 2. `GET /sre/deployments`

Returns the last 10 deployments from the `sre_ops_metrics` DynamoDB table, with aggregate success rate and average duration.

**Query parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 10 | Number of deployments to return (max 100) |

**Response (200 OK)**
```json
{
  "timestamp": "2026-05-08T03:00:00Z",
  "deployments": [
    {
      "metric_type": "deployment",
      "timestamp": "2026-05-07T22:10:00Z",
      "service": "api-gateway",
      "version": "v2.4.1",
      "status": "success",
      "duration_seconds": 118,
      "deployed_by": "github-actions"
    }
  ],
  "summary": {
    "total": 10,
    "success_count": 9,
    "failure_count": 1,
    "success_rate_pct": 90.0,
    "avg_duration_seconds": 124.5
  },
  "errors": []
}
```

---

### 3. `GET /sre/scaling`

Returns Lambda concurrency (current vs reserved) and API Gateway request/throttle counts.

**Response (200 OK)**
```json
{
  "timestamp": "2026-05-08T03:00:00Z",
  "lambda": {
    "concurrent_executions": 42,
    "throttles": 0
  },
  "api_gateway": {
    "request_count": 8240,
    "throttle_count": 3
  },
  "errors": []
}
```

---

### 4. `GET /sre/database`

Returns Aurora query latency percentiles, connection count, IOPS, replication lag, and DynamoDB throttle/latency data.

**Response (200 OK)**
```json
{
  "timestamp": "2026-05-08T03:00:00Z",
  "aurora": {
    "read_latency_p95_ms": 8.3,
    "write_latency_p95_ms": 12.1,
    "connection_count": 24,
    "read_iops": 4200,
    "write_iops": 860,
    "replica_lag_ms": 45.0
  },
  "dynamodb": {
    "read_throttle_events": 0,
    "write_throttle_events": 0,
    "avg_latency_ms": 2.1
  },
  "errors": []
}
```

**CloudWatch sources**
| Metric | Namespace | Dimension |
|--------|-----------|-----------|
| ReadLatency (p95) | AWS/RDS | DBClusterIdentifier |
| WriteLatency (p95) | AWS/RDS | DBClusterIdentifier |
| DatabaseConnections | AWS/RDS | DBClusterIdentifier |
| VolumeReadIOPs | AWS/RDS | DBClusterIdentifier |
| VolumeWriteIOPs | AWS/RDS | DBClusterIdentifier |
| AuroraReplicaLag | AWS/RDS | DBClusterIdentifier |
| ReadThrottleEvents | AWS/DynamoDB | — |
| WriteThrottleEvents | AWS/DynamoDB | — |

---

### 5. `GET /sre/cache`

Returns ElastiCache Redis hit rate, eviction count, current connections, and memory utilization.

**Response (200 OK)**
```json
{
  "timestamp": "2026-05-08T03:00:00Z",
  "redis": {
    "hit_rate_pct": 97.4,
    "cache_hits": 38200,
    "cache_misses": 1000,
    "evictions": 0,
    "current_connections": 18,
    "memory_usage_pct": 43.2
  },
  "errors": []
}
```

**CloudWatch sources**
| Metric | Namespace | Dimension |
|--------|-----------|-----------|
| CacheHits | AWS/ElastiCache | CacheClusterId |
| CacheMisses | AWS/ElastiCache | CacheClusterId |
| Evictions | AWS/ElastiCache | CacheClusterId |
| CurrConnections | AWS/ElastiCache | CacheClusterId |
| DatabaseMemoryUsagePercentage | AWS/ElastiCache | CacheClusterId |

---

### 6. `GET /sre/errors`

Returns error rates by service from CloudWatch and a sample of recent Lambda errors from CloudWatch Logs Insights.

**Response (200 OK)**
```json
{
  "timestamp": "2026-05-08T03:00:00Z",
  "lambda": {
    "error_count": 12,
    "invocation_count": 8400,
    "error_rate_pct": 0.14
  },
  "api_gateway": {
    "4xx_count": 230,
    "5xx_count": 3,
    "total_requests": 8240,
    "error_rate_pct": 0.04
  },
  "recent_log_errors": [
    {
      "@timestamp": "2026-05-08 02:55:00.000",
      "@message": "ERROR Exception in auth_v2: token expired"
    }
  ],
  "errors": []
}
```

**Notes**
- `recent_log_errors` is sampled from the last 15 minutes via CloudWatch Logs Insights (max 10 entries).
- If Logs Insights times out or returns an error, the field is empty and the error is captured in `errors`.

---

### 7. `GET /sre/lambda`

Returns per-function Lambda metrics: cold starts, average duration, throttle count, and DLQ depth.

**Response (200 OK)**
```json
{
  "timestamp": "2026-05-08T03:00:00Z",
  "functions": [
    {
      "function_name": "securebase-dev-auth-v2",
      "cold_starts": 3,
      "avg_duration_ms": 142.7,
      "throttles": 0,
      "dlq_depth": 0
    },
    {
      "function_name": "securebase-dev-billing-worker",
      "cold_starts": 0,
      "avg_duration_ms": 890.2,
      "throttles": 0,
      "dlq_depth": null
    }
  ],
  "aggregate": {
    "total_functions": 12,
    "functions_with_throttles": 0,
    "functions_with_dlq_messages": 0
  },
  "errors": []
}
```

**Notes**
- Functions are filtered to those whose name starts with `securebase-{environment}-`.
- Results are capped at 20 functions per call to control CloudWatch API costs.
- `dlq_depth` is `null` when the function has no configured DLQ.

---

### 8. `GET /sre/costs`

Returns per-service daily cost breakdown for the last 30 days from AWS Cost Explorer.

**Response (200 OK)**
```json
{
  "timestamp": "2026-05-08T03:00:00Z",
  "period": {
    "start": "2026-04-08",
    "end": "2026-05-08",
    "granularity": "DAILY"
  },
  "total_cost_usd": 1842.30,
  "by_service": [
    { "service": "Amazon Aurora", "total_usd": 620.40 },
    { "service": "AWS Lambda", "total_usd": 18.72 },
    { "service": "Amazon API Gateway", "total_usd": 12.35 },
    { "service": "Amazon DynamoDB", "total_usd": 9.10 }
  ],
  "errors": []
}
```

**Notes**
- Top 20 services by cost are returned.
- Cost Explorer API calls are billed by AWS ($0.01 per request). Use caching in production.
- On Cost Explorer error, `total_cost_usd` is `0.0` and the error is captured in `errors`.

---

### 9. `GET /sre/health`

Returns an aggregated health status for the platform: `healthy`, `degraded`, or `critical`.

**Response (200 OK) — healthy**
```json
{
  "timestamp": "2026-05-08T03:00:00Z",
  "overall_status": "healthy",
  "subsystems": {
    "lambda": "healthy",
    "api_gateway": "healthy",
    "database": "healthy",
    "cache": "healthy"
  }
}
```

**Response (200 OK) — degraded**
```json
{
  "timestamp": "2026-05-08T03:00:00Z",
  "overall_status": "degraded",
  "subsystems": {
    "lambda": "degraded",
    "api_gateway": "healthy",
    "database": "healthy",
    "cache": "healthy"
  }
}
```

**Status thresholds**

| Subsystem | Degraded | Critical |
|-----------|----------|----------|
| Lambda | error rate > 5% | error rate > 10% |
| API Gateway | 5xx rate > 5% | 5xx rate > 10% |
| Database (Aurora) | read latency > 100ms | read latency > 500ms |
| Cache (Redis) | evictions > 1,000/5min | — |

**Overall status rules**
- `healthy`: all subsystems are `healthy`
- `degraded`: at least one subsystem is `degraded`, none are `critical`
- `critical`: at least one subsystem is `critical`

---

## Error Responses

| HTTP Status | When |
|-------------|------|
| 404 | Path not found |
| 500 | Unhandled internal error |

All error responses include the standard CORS headers.

**Example 404**
```json
{"error": "Path not found: /sre/unknown"}
```

---

## Partial Data Pattern

All handlers follow a **partial data** pattern: if an AWS API call fails (e.g., CloudWatch timeout, Cost Explorer quota), the affected fields are returned as `null` (or empty arrays), and the error message is appended to the `errors` array in the response body. The HTTP status code remains `200` so the frontend can render whatever data is available.

---

## DynamoDB Table Schema

**Table name**: `securebase-{environment}-sre-ops-metrics`

| Attribute | Type | Role | Notes |
|-----------|------|------|-------|
| `metric_type` | String | Partition key | e.g., `deployment`, `alert`, `incident` |
| `timestamp` | String | Sort key | ISO 8601 format: `2026-05-08T10:30:00Z` |
| `expires_at` | Number | TTL | Unix epoch; items auto-deleted after expiry |
| `status` | String | — | e.g., `success`, `failure` |
| `duration_seconds` | Number | — | For deployment records |
| `service` | String | — | Affected service name |
| `version` | String | — | Deployed version tag |
| `deployed_by` | String | — | `github-actions` / IAM user |

**Billing mode**: PAY_PER_REQUEST (auto-scaling)  
**Encryption**: AWS-managed KMS key  
**TTL**: `expires_at` attribute (items older than 90 days are auto-deleted)

---

## CloudWatch Alarm Thresholds

| Alarm | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| `securebase-{env}-sre-lambda-error-rate` | Lambda error rate (%) | > 5% over 2 × 5-minute periods | Publish to `sre_alerts` SNS topic |
| `securebase-{env}-sre-api-latency-p95` | API Gateway p95 Latency (ms) | > 2,000ms over 2 × 5-minute periods | Publish to `sre_alerts` SNS topic |

Both alarms also fire an OK notification when they recover.

---

## Deployment

### 1. Package the Lambda

```bash
cd phase2-backend/functions
zip -j ../../deploy/sre_metrics.zip sre_metrics.py
```

### 2. Apply Terraform

```bash
cd landing-zone/environments/dev
terraform init
terraform apply -target=module.phase5_sre_metrics
```

### 3. Wire API Gateway (optional — runs with existing deployments unaffected)

Pass `sre_metrics_lambda_invoke_arn` to the `api_gateway` module in `landing-zone/main.tf`:

```hcl
module "api_gateway" {
  source = "./modules/api-gateway"
  # ... existing variables ...
  sre_metrics_lambda_invoke_arn = module.phase5_sre_metrics.sre_metrics_lambda_invoke_arn
  sre_metrics_lambda_name       = module.phase5_sre_metrics.sre_metrics_lambda_name
}
```

Then redeploy the full stack:

```bash
terraform apply
```

---

## Local Testing

```bash
cd phase2-backend/functions
AWS_DEFAULT_REGION=us-east-1 python -m unittest test_sre_metrics -v
```

Expected output: 23 tests pass.
