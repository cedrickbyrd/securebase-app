# SecureBase Performance Tuning Guide

**Version:** 1.0  
**Last Updated:** January 24, 2026  
**Audience:** DevOps Engineers, Platform Engineers, SREs

---

## Table of Contents

1. [Overview](#overview)
2. [Performance Targets](#performance-targets)
3. [CDN Optimization](#cdn-optimization)
4. [API Performance](#api-performance)
5. [Lambda Optimization](#lambda-optimization)
6. [Database Performance](#database-performance)
7. [Caching Strategy](#caching-strategy)
8. [Load Testing](#load-testing)
9. [Monitoring & Alerting](#monitoring--alerting)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides comprehensive performance tuning recommendations for the SecureBase platform to achieve:

- **API p95 latency < 100ms**
- **Page load time < 2s globally**
- **99.95% uptime**
- **Lighthouse score > 90**

### Architecture Overview

```
User Request
    ↓
CloudFront CDN (Global Edge Locations)
    ↓
S3 (Static Assets) OR API Gateway (Dynamic Content)
    ↓
Lambda Functions (with ElastiCache caching)
    ↓
Aurora PostgreSQL / DynamoDB
```

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API p50 latency | < 50ms | CloudWatch API Gateway metrics |
| API p95 latency | < 100ms | CloudWatch API Gateway metrics |
| API p99 latency | < 200ms | CloudWatch API Gateway metrics |
| Page load time (p95) | < 2s | CloudWatch RUM or custom metrics |
| Time to First Byte (TTFB) | < 200ms | Browser DevTools, CloudWatch |
| Lighthouse Performance | > 90 | Chrome Lighthouse |
| CloudFront cache hit rate | > 80% | CloudWatch CloudFront metrics |
| ElastiCache hit rate | > 70% | CloudWatch ElastiCache metrics |
| Lambda cold start | < 500ms | CloudWatch Lambda metrics |
| Database query time | < 100ms | Aurora Performance Insights |
| Uptime | 99.95% | CloudWatch Synthetics |

---

## CDN Optimization

### CloudFront Configuration

**Implementation:**
```hcl
module "cloudfront" {
  source = "./modules/cloudfront"
  
  environment     = "prod"
  bucket_name     = "securebase-prod-portal"
  price_class     = "PriceClass_100"  # US, Canada, Europe
  
  # API caching
  api_gateway_domain = "api.securebase.com"
  api_cache_ttl      = 300  # 5 minutes for GET requests
}
```

**Cache Behaviors:**

| Path | TTL | Use Case |
|------|-----|----------|
| `/` | 1 hour | HTML pages |
| `/assets/*` | 1 year | Versioned JS/CSS (immutable) |
| `/static/*` | 7 days | Images, fonts |
| `/api/*` | 5 min | API responses (GET only) |

**Best Practices:**

1. **Versioned Assets**: Use content hashes in filenames
   ```javascript
   // vite.config.js
   export default {
     build: {
       rollupOptions: {
         output: {
           entryFileNames: 'assets/[name].[hash].js',
           chunkFileNames: 'assets/[name].[hash].js',
           assetFileNames: 'assets/[name].[hash].[ext]'
         }
       }
     }
   }
   ```

2. **Compression**: Enable Gzip and Brotli
   - Automatically enabled in CloudFront for text-based content
   - Reduces payload size by 60-80%

3. **Image Optimization**:
   - Use WebP format with JPEG fallback
   - Lazy load below-the-fold images
   - Implement responsive images with `srcset`

4. **Cache Invalidation**:
   ```bash
   # After deployment
   aws cloudfront create-invalidation \
     --distribution-id E1234ABCD \
     --paths "/*"
   ```

**Monitoring:**
```bash
# Check cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=E1234ABCD \
  --start-time 2026-01-24T00:00:00Z \
  --end-time 2026-01-24T23:59:59Z \
  --period 3600 \
  --statistics Average
```

**Target:** > 80% cache hit rate

---

## API Performance

### API Gateway Optimization

**1. Enable Caching**
```terraform
resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.prod.stage_name
  method_path = "*/*"

  settings {
    # Enable caching for GET requests
    caching_enabled      = true
    cache_ttl_in_seconds = 300  # 5 minutes
    cache_data_encrypted = true
    
    # Performance settings
    throttling_burst_limit = 5000
    throttling_rate_limit  = 10000
    
    # Monitoring
    metrics_enabled = true
    logging_level   = "INFO"
  }
}
```

**2. Response Compression**
```terraform
resource "aws_api_gateway_rest_api" "main" {
  name = "securebase-api"
  
  minimum_compression_size = 1024  # Compress responses > 1KB
}
```

**3. Lambda Proxy Integration Optimization**
```python
# Lambda response format for API Gateway
def lambda_handler(event, context):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=300, public',  # Allow CloudFront caching
            'X-Cache-Status': 'MISS'  # For debugging
        },
        'body': json.dumps(response_data)
    }
```

**4. Cache Key Strategy**
```python
# Include only necessary parameters in cache key
cache_key_parameters = {
    'integration.request.querystring.customer_id': True,
    'integration.request.querystring.date_range': True,
    # Exclude auth headers from cache key (handled separately)
}
```

**Monitoring:**
- Target p95 latency: < 100ms
- Monitor via CloudWatch Insights:
  ```
  fields @timestamp, @duration, @requestId
  | filter @type = "REPORT"
  | stats pct(@duration, 95) as p95 by bin(5m)
  ```

---

## Lambda Optimization

### Memory Allocation

**Finding Optimal Memory:**
```bash
# Use AWS Lambda Power Tuning tool
npm install -g aws-lambda-power-tuning
aws-lambda-power-tuning --function-name securebase-prod-auth \
  --power-values 128,256,512,1024,1536,2048,3008 \
  --num 50
```

**Recommendations by Function Type:**

| Function Type | Recommended Memory | Typical Duration |
|--------------|-------------------|------------------|
| API Authorizer | 256 MB | 50-100ms |
| Simple CRUD | 512 MB | 100-200ms |
| Complex Query | 1024 MB | 200-500ms |
| Report Generation | 2048 MB | 1-5s |
| Data Processing | 3008 MB | 5-30s |

### Cold Start Reduction

**1. Provisioned Concurrency**
```terraform
resource "aws_lambda_provisioned_concurrency_config" "auth" {
  function_name                     = aws_lambda_function.auth.function_name
  provisioned_concurrent_executions = 5  # Keep 5 warm instances
  qualifier                         = aws_lambda_alias.prod.name
}
```

**Cost:** ~$15/month per instance, but eliminates cold starts for critical paths

**2. Optimize Package Size**
```bash
# Before: 50 MB (slow cold start)
# After: 5 MB (fast cold start)

# Strip unnecessary files
rm -rf node_modules/aws-sdk  # Included in Lambda runtime
rm -rf **/__pycache__
rm -rf **/test*

# Use Lambda layers for shared dependencies
aws lambda publish-layer-version \
  --layer-name common-dependencies \
  --zip-file fileb://layer.zip
```

**3. Connection Reuse**
```python
# Initialize connections outside handler
import os
import boto3
from functools import lru_cache

# Reuse clients across invocations
dynamodb = boto3.client('dynamodb')
secrets = boto3.client('secretsmanager')

@lru_cache(maxsize=1)
def get_db_connection():
    # Connection pooling for Aurora
    import psycopg2.pool
    return psycopg2.pool.SimpleConnectionPool(
        minconn=1,
        maxconn=5,
        host=os.environ['DB_HOST'],
        database=os.environ['DB_NAME']
    )

def lambda_handler(event, context):
    # Reuse connection pool
    pool = get_db_connection()
    conn = pool.getconn()
    try:
        # Query logic
        pass
    finally:
        pool.putconn(conn)
```

**4. Reserved Concurrency**
```terraform
resource "aws_lambda_function" "critical" {
  function_name = "securebase-prod-critical-api"
  runtime       = "python3.11"
  memory_size   = 1024
  timeout       = 30
  
  # Reserve capacity to prevent throttling
  reserved_concurrent_executions = 100
}
```

### X-Ray Tracing

**Enable:**
```terraform
resource "aws_lambda_function" "main" {
  tracing_config {
    mode = "Active"
  }
}
```

**Instrument Code:**
```python
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

# Patch libraries
patch_all()

@xray_recorder.capture('process_request')
def process_request(customer_id):
    # Subsegments automatically tracked
    result = query_database(customer_id)
    return result
```

**Analyze:**
```bash
# View service map
aws xray get-service-graph \
  --start-time 2026-01-24T00:00:00Z \
  --end-time 2026-01-24T23:59:59Z
```

---

## Database Performance

### Aurora PostgreSQL Optimization

**1. Connection Pooling via RDS Proxy**
```terraform
resource "aws_db_proxy" "main" {
  name                   = "securebase-prod-proxy"
  engine_family          = "POSTGRESQL"
  auth {
    secret_arn = aws_secretsmanager_secret.db_credentials.arn
  }
  
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = var.private_subnet_ids
  require_tls            = true
  
  # Connection pooling settings
  idle_client_timeout    = 1800  # 30 minutes
  max_connections_percent = 90
  max_idle_connections_percent = 50
}
```

**2. Indexing Strategy**
```sql
-- Identify slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- > 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Add indexes for common access patterns
CREATE INDEX idx_invoices_customer_date 
ON invoices(customer_id, invoice_date DESC);

CREATE INDEX idx_metrics_customer_timestamp 
ON usage_metrics(customer_id, timestamp DESC);

-- Partial indexes for common filters
CREATE INDEX idx_tickets_open 
ON support_tickets(customer_id, created_at)
WHERE status = 'open';
```

**3. Query Optimization**
```sql
-- Before: Full table scan (slow)
SELECT * FROM usage_metrics 
WHERE customer_id = 'abc123'
ORDER BY timestamp DESC
LIMIT 100;

-- After: Index scan (fast)
SELECT metric_name, value, timestamp 
FROM usage_metrics 
WHERE customer_id = 'abc123'
AND timestamp > NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC
LIMIT 100;
```

**4. Auto-Scaling Configuration**
```terraform
resource "aws_rds_cluster" "main" {
  cluster_identifier  = "securebase-prod"
  engine              = "aurora-postgresql"
  engine_mode         = "provisioned"
  
  serverlessv2_scaling_configuration {
    min_capacity = 0.5  # 0.5 ACU = 1 GB RAM
    max_capacity = 4.0  # 4 ACU = 8 GB RAM
  }
}
```

**Monitoring:**
```bash
# Check slow queries
aws rds describe-db-log-files \
  --db-instance-identifier securebase-prod-instance-1 | \
  grep slowquery

# Download slow query log
aws rds download-db-log-file-portion \
  --db-instance-identifier securebase-prod-instance-1 \
  --log-file-name slowquery/postgresql-slowquery.log
```

---

## Caching Strategy

### Multi-Level Caching

```
User Request
    ↓
CloudFront (Edge Cache) - 1 hour TTL
    ↓ (cache miss)
API Gateway Cache - 5 min TTL
    ↓ (cache miss)
ElastiCache (Redis) - 1-24 hour TTL
    ↓ (cache miss)
Database (Aurora)
```

### ElastiCache Implementation

**1. Setup**
```terraform
module "elasticache" {
  source = "./modules/elasticache"
  
  environment    = "prod"
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  node_type      = "cache.r6g.large"  # 13 GB RAM
  num_cache_nodes = 2  # Primary + replica
}
```

**2. Lambda Integration**
```python
import redis
import json
import os

# Initialize Redis client (reuse across invocations)
redis_client = redis.Redis(
    host=os.environ['REDIS_HOST'],
    port=6379,
    password=os.environ['REDIS_AUTH_TOKEN'],
    ssl=True,
    decode_responses=True,
    socket_keepalive=True,
    socket_connect_timeout=2,
    socket_timeout=2,
    health_check_interval=30
)

def get_customer_metrics(customer_id, date_range):
    # Try cache first
    cache_key = f"metrics:{customer_id}:{date_range}"
    
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except redis.RedisError as e:
        # Log error but don't fail request
        print(f"Redis error: {e}")
    
    # Cache miss - query database
    metrics = query_database(customer_id, date_range)
    
    # Store in cache (1 hour TTL)
    try:
        redis_client.setex(
            cache_key,
            3600,
            json.dumps(metrics, default=str)
        )
    except redis.RedisError:
        pass  # Don't fail on cache write error
    
    return metrics
```

**3. Cache Invalidation**
```python
def invalidate_cache(customer_id):
    # Invalidate all metrics for customer
    pattern = f"metrics:{customer_id}:*"
    
    for key in redis_client.scan_iter(match=pattern):
        redis_client.delete(key)
```

**TTL Recommendations:**

| Data Type | TTL | Reasoning |
|-----------|-----|-----------|
| Invoices | 1 hour | Changes monthly |
| Real-time metrics | 5 min | Frequently updated |
| Historical reports | 24 hours | Static historical data |
| API keys | 1 hour | Rarely changed |
| Tier features | 1 day | Almost never changes |

**Monitoring:**
```python
# Add cache metrics
import boto3

cloudwatch = boto3.client('cloudwatch')

def publish_cache_metric(hit):
    cloudwatch.put_metric_data(
        Namespace='SecureBase/Performance',
        MetricData=[{
            'MetricName': 'CacheHitRate',
            'Value': 1 if hit else 0,
            'Unit': 'Percent'
        }]
    )
```

---

## Load Testing

### Tools

**Artillery (Recommended)**
```bash
npm install -g artillery

# Create load test scenario
cat > load-test.yml <<EOF
config:
  target: 'https://api.securebase.com'
  phases:
    - duration: 60
      arrivalRate: 10      # 10 requests/sec
      name: "Warm up"
    - duration: 300
      arrivalRate: 100     # 100 requests/sec
      name: "Sustained load"
    - duration: 60
      arrivalRate: 200     # Spike to 200 requests/sec
      name: "Spike test"

scenarios:
  - name: "API Load Test"
    flow:
      - get:
          url: "/v1/customers/{{ \$randomString() }}/invoices"
          headers:
            Authorization: "Bearer {{ \$env.API_TOKEN }}"
      - think: 2  # 2 second pause between requests
EOF

# Run test
artillery run load-test.yml --output report.json

# Generate HTML report
artillery report report.json
```

**k6 (Alternative)**
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '5m', target: 100 },  // Sustained
    { duration: '1m', target: 200 },  // Spike
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'],  // 95% < 100ms
    http_req_failed: ['rate<0.01'],    // < 1% errors
  },
};

export default function () {
  let response = http.get('https://api.securebase.com/v1/health', {
    headers: { 'Authorization': `Bearer ${__ENV.API_TOKEN}` },
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  sleep(1);
}
```

```bash
k6 run load-test.js
```

### Test Scenarios

**1. Baseline Performance**
- 10 users, 5 minutes
- Measure p50, p95, p99 latency
- Establish performance baseline

**2. Capacity Test**
- Gradually increase load from 10 → 1000 users
- Find breaking point
- Identify bottlenecks

**3. Spike Test**
- Sudden load increase (10 → 500 users in 10s)
- Test auto-scaling responsiveness
- Check for throttling/errors

**4. Endurance Test**
- Sustained load (100 users) for 24 hours
- Detect memory leaks
- Validate connection pool behavior

### Success Criteria

- p95 latency < 100ms under sustained load
- Error rate < 1%
- No memory leaks over 24 hours
- Auto-scaling responds within 2 minutes
- Cache hit rate > 70%

---

## Monitoring & Alerting

### CloudWatch Dashboards

**Created Automatically:**
```bash
# View performance dashboard
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-prod-performance

# View uptime dashboard
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-prod-uptime
```

### Key Metrics to Monitor

**API Performance:**
```bash
# p95 latency over time
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value=securebase-api \
  --start-time 2026-01-24T00:00:00Z \
  --end-time 2026-01-24T23:59:59Z \
  --period 300 \
  --statistics p95
```

**Lambda Performance:**
```bash
# Cold start duration
aws logs insights query \
  --log-group-name /aws/lambda/securebase-prod-auth \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @duration | filter @type="REPORT" and @initDuration > 0 | stats avg(@initDuration) as avg_cold_start'
```

**Cache Performance:**
```bash
# ElastiCache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHitRate \
  --dimensions Name=ReplicationGroupId,Value=securebase-prod-redis \
  --start-time 2026-01-24T00:00:00Z \
  --end-time 2026-01-24T23:59:59Z \
  --period 3600 \
  --statistics Average
```

### Alarms

**Pre-configured alarms:**
- API p95 latency > 100ms for 10 minutes
- Lambda errors > 10 in 5 minutes
- Lambda throttles detected
- API 5xx errors > 5 in 5 minutes
- DynamoDB read/write throttles
- ElastiCache CPU > 75%
- ElastiCache memory > 85%
- CloudFront 5xx error rate > 1%

**Alert Channels:**
- SNS → Email
- SNS → Slack (via webhook)
- SNS → PagerDuty (for critical alerts)

---

## Troubleshooting

### High API Latency

**Symptoms:**
- p95 latency > 100ms
- Slow page loads

**Diagnosis:**
```bash
# Find slow endpoints
aws logs insights query \
  --log-group-name /aws/apigateway/securebase-prod \
  --query-string 'fields path, @duration | filter @type="REPORT" | sort @duration desc | limit 20'

# Check Lambda duration
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --statistics p95
```

**Solutions:**
1. Enable API Gateway caching
2. Increase Lambda memory allocation
3. Implement ElastiCache
4. Optimize database queries
5. Add database indexes

### High Lambda Cold Starts

**Symptoms:**
- Initial requests slow
- Intermittent slowness

**Diagnosis:**
```bash
# Count cold starts
aws logs insights query \
  --log-group-name /aws/lambda/securebase-prod \
  --query-string 'filter @type="REPORT" | stats count(@initDuration) as cold_starts by bin(1h)'
```

**Solutions:**
1. Enable provisioned concurrency (5-10 instances)
2. Reduce package size (< 10 MB)
3. Use Lambda layers for dependencies
4. Keep functions warm with scheduled pings

### Low Cache Hit Rate

**Symptoms:**
- ElastiCache hit rate < 70%
- High database load

**Diagnosis:**
```bash
# Check cache metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHits,CacheMisses
```

**Solutions:**
1. Increase cache TTLs
2. Review cache key strategy (too granular?)
3. Increase Redis memory (scale up node type)
4. Implement cache warming on deployment

### Database Connection Exhaustion

**Symptoms:**
- "Too many connections" errors
- Lambda timeouts

**Diagnosis:**
```bash
# Check active connections
aws rds describe-db-instances \
  --db-instance-identifier securebase-prod | \
  jq '.DBInstances[0].DBInstanceStatus'
```

**Solutions:**
1. Implement RDS Proxy for connection pooling
2. Reduce Lambda timeout (force connection release)
3. Increase max_connections in Aurora parameter group
4. Use connection pooling in Lambda code

---

## Checklist

### Pre-Deployment

- [ ] Load test completed with passing results
- [ ] All performance alarms configured
- [ ] CloudWatch dashboards created
- [ ] Cache warming scripts ready
- [ ] Rollback plan documented

### Post-Deployment

- [ ] Monitor p95 latency for 24 hours
- [ ] Verify cache hit rates > 70%
- [ ] Check for Lambda cold starts
- [ ] Review error rates (< 1%)
- [ ] Validate auto-scaling behavior

### Monthly Review

- [ ] Analyze slow query logs
- [ ] Review cache eviction rates
- [ ] Check Lambda memory utilization
- [ ] Assess cost vs performance tradeoffs
- [ ] Update performance baselines

---

## Additional Resources

- [AWS Performance Best Practices](https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/welcome.html)
- [CloudFront Optimization](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ConfiguringCaching.html)
- [Lambda Performance](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Aurora Performance Insights](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_PerfInsights.html)

---

**Document Version:** 1.0  
**Last Updated:** January 24, 2026  
**Next Review:** February 24, 2026
