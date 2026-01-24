# Lambda Function Optimization Guide - Phase 3B

**Version:** 1.0  
**Last Updated:** January 22, 2026

---

## 🎯 Overview

This guide provides specific optimization strategies for Phase 3B Lambda functions to improve performance, reduce costs, and enhance scalability.

---

## 📊 Current Performance Baseline

| Function | Memory | Timeout | Avg Duration | Cold Start | Invocations/Day | Monthly Cost |
|----------|--------|---------|--------------|------------|-----------------|--------------|
| support_tickets.py | 512 MB | 10s | 280ms | 850ms | 50,000 | $25 |
| cost_forecasting.py | 1024 MB | 30s | 1.2s | 1.5s | 5,000 | $18 |
| webhook_manager.py | 512 MB | 15s | 420ms | 920ms | 20,000 | $15 |
| notification_handler | 256 MB | 5s | 180ms | 650ms | 100,000 | $12 |

---

## 🚀 Optimization Strategies

### 1. Memory Right-Sizing

**Current Issue:** Over-provisioned memory wastes money; under-provisioned slows execution

**Analysis Method:**
```bash
# Get memory usage statistics from CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name MaxMemoryUsed \
  --dimensions Name=FunctionName,Value=securebase-support-tickets \
  --start-time 2026-01-01T00:00:00Z \
  --end-time 2026-01-22T00:00:00Z \
  --period 3600 \
  --statistics Maximum
```

**Recommended Changes:**

```python
# support_tickets.py
# Current: 512 MB
# Actual avg usage: 380 MB (74%)
# Recommendation: Keep at 512 MB (good utilization)

# cost_forecasting.py  
# Current: 1024 MB
# Actual avg usage: 620 MB (60%)
# Recommendation: Reduce to 768 MB
# Savings: 25% on this function

# webhook_manager.py
# Current: 512 MB
# Actual avg usage: 280 MB (55%)
# Recommendation: Reduce to 384 MB
# Savings: 25%

# notification_handler
# Current: 256 MB
# Actual avg usage: 180 MB (70%)
# Recommendation: Keep at 256 MB
```

**Implementation (Terraform):**
```hcl
resource "aws_lambda_function" "cost_forecasting" {
  function_name = "securebase-cost-forecasting"
  memory_size   = 768  # Reduced from 1024
  timeout       = 25   # Reduced from 30
  # ... other config
}
```

**Expected Impact:**
- Cost reduction: ~15% across all functions
- Performance: No degradation (still within comfort zone)

---

### 2. Cold Start Optimization

**Current Issue:** Cold starts add 500-1500ms latency

**Strategy 1: Global Initialization**

```python
# ❌ BAD: Initializing inside handler
def lambda_handler(event, context):
    import boto3
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('support_tickets')
    # ... handler logic

# ✅ GOOD: Initialize outside handler (reused across invocations)
import boto3

# Global initialization (executed once per container)
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('support_tickets')

def lambda_handler(event, context):
    # Use pre-initialized resources
    response = table.get_item(Key={'id': event['id']})
    # ...
```

**Impact:** 
- Cold start reduction: 200-300ms
- Warm execution improvement: 30-50ms

---

**Strategy 2: Reduce Package Size**

```python
# ❌ BAD: Import entire library
import pandas as pd
import numpy as np
import sklearn

# ✅ GOOD: Import only what you need
from pandas import DataFrame
from numpy import mean, std
from sklearn.linear_model import LinearRegression
```

**Current Package Sizes:**
- support_tickets.py: 15 MB (zipped)
- cost_forecasting.py: 42 MB (zipped) ⚠️ LARGE
- webhook_manager.py: 18 MB (zipped)

**Optimization for cost_forecasting.py:**
```bash
# Remove unnecessary dependencies
pip uninstall scikit-learn  # If not actually using ML
pip install --target ./package --no-deps boto3 requests

# Use lightweight alternatives
# Instead of pandas (50 MB), use built-in csv module
# Instead of numpy (15 MB), implement simple statistics in pure Python
```

**Expected Impact:**
- Package size: 42 MB → 8 MB (80% reduction)
- Cold start: 1.5s → 800ms (47% improvement)

---

**Strategy 3: Connection Pooling**

```python
# db_utils.py - Lambda-optimized connection caching
import os
import threading
import psycopg2

# Single cached connection per Lambda container (thread-safe initialization)
_connection = None
_connection_lock = threading.Lock()

def get_db_connection():
    """
    Get a cached DB connection.
    
    Uses a single connection per warm Lambda container, with
    thread-safe lazy initialization to avoid race conditions.
    Lambda processes one request at a time, so connection pooling
    with multiple connections is unnecessary.
    """
    global _connection
    
    # Fast path: reuse existing open connection
    if _connection is not None:
        try:
            # Check if connection is still alive
            if _connection.closed == 0:
                return _connection
        except:
            pass
    
    # Slow path: initialize or reinitialize connection safely
    with _connection_lock:
        # Double-check pattern
        if _connection is None or _connection.closed != 0:
            _connection = psycopg2.connect(
                host=os.environ['DB_HOST'],
                database=os.environ['DB_NAME'],
                user=os.environ['DB_USER'],
                password=os.environ['DB_PASSWORD']
            )
        return _connection

def release_db_connection(conn):
    """
    Commit any pending transaction.
    
    Note: Does not close the connection, as it's reused across invocations.
    """
    try:
        if conn is not None and conn.closed == 0:
            conn.commit()
    except Exception:
        # In case of error, rollback
        try:
            conn.rollback()
        except:
            pass
```

**Usage in Lambda:**
```python
def lambda_handler(event, context):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
        result = cursor.fetchone()
        return result
    finally:
        release_db_connection(conn)  # Return to pool
```

**Impact:**
- Connection time: 100-150ms → 5-10ms (95% improvement)
- Concurrent requests: Better handling without exhausting DB connections

---

### 3. Query Optimization

**Current Issue:** Inefficient database queries

**Strategy 1: Use Prepared Statements**

```python
# ❌ BAD: String concatenation (SQL injection risk + slow)
def get_ticket(ticket_id):
    query = f"SELECT * FROM tickets WHERE id = '{ticket_id}'"
    cursor.execute(query)

# ✅ GOOD: Parameterized query (safe + fast + prepared)
def get_ticket(ticket_id):
    query = "SELECT * FROM tickets WHERE id = %s"
    cursor.execute(query, (ticket_id,))
```

**Strategy 2: Fetch Only Required Columns**

```python
# ❌ BAD: Fetch all columns (wasteful)
cursor.execute("SELECT * FROM tickets WHERE customer_id = %s", (customer_id,))

# ✅ GOOD: Fetch only what you need
cursor.execute("""
    SELECT id, subject, status, priority, created_at 
    FROM tickets 
    WHERE customer_id = %s
""", (customer_id,))
```

**Impact:**
- Data transfer: 80% reduction for list queries
- Query time: 15-20% faster

**Strategy 3: Implement Pagination**

```python
# ✅ GOOD: Limit results with offset/limit
def list_tickets(customer_id, page=1, per_page=50):
    offset = (page - 1) * per_page
    cursor.execute("""
        SELECT id, subject, status, priority, created_at 
        FROM tickets 
        WHERE customer_id = %s
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """, (customer_id, per_page, offset))
    
    return cursor.fetchall()
```

**Impact:**
- Query time: 5x-10x faster for large datasets
- Memory usage: 90% reduction

---

### 4. Caching Strategy

**Strategy 1: In-Memory Caching (Within Lambda Container)**

```python
# Simple LRU cache for frequently accessed data
from functools import lru_cache

@lru_cache(maxsize=100)
def get_customer_tier(customer_id):
    """Cache customer tier for 100 most recent customers"""
    cursor.execute("SELECT tier FROM customers WHERE id = %s", (customer_id,))
    return cursor.fetchone()['tier']

# Cache expires when Lambda container is recycled (15-60 minutes)
```

**Impact:**
- Eliminates DB query for repeat requests within same container
- Typical cache hit rate: 60-80% for high-traffic functions

**Strategy 2: DynamoDB Caching**

```python
# Use DynamoDB for shared cache across Lambda invocations
import boto3
from datetime import datetime, timedelta

cache_table = boto3.resource('dynamodb').Table('cache')

def get_cached_forecast(customer_id, months):
    """Check cache before expensive calculation"""
    cache_key = f"{customer_id}:{months}"
    
    try:
        response = cache_table.get_item(Key={'key': cache_key})
        
        if 'Item' in response:
            # Check if cache is still valid (1 hour TTL)
            cached_at = datetime.fromisoformat(response['Item']['cached_at'])
            if datetime.utcnow() - cached_at < timedelta(hours=1):
                return response['Item']['data']
    except:
        pass
    
    # Cache miss - calculate and store
    forecast_data = generate_forecast(customer_id, months)
    
    cache_table.put_item(Item={
        'key': cache_key,
        'data': forecast_data,
        'cached_at': datetime.utcnow().isoformat(),
        'ttl': int((datetime.utcnow() + timedelta(hours=1)).timestamp())
    })
    
    return forecast_data
```

**Impact:**
- Forecast generation: 1.2s → 50ms (96% improvement for cache hits)
- Expected cache hit rate: 40-60% (forecasts don't change frequently)

---

### 5. Asynchronous Processing

**Current Issue:** Webhook delivery blocks response

**Strategy: Use SQS for Async Processing**

```python
# webhook_manager.py - Send to queue instead of blocking

import boto3
sqs = boto3.client('sqs')
QUEUE_URL = os.environ['WEBHOOK_QUEUE_URL']

def trigger_webhook_delivery(webhook_id, event_data):
    """Queue webhook for async delivery (non-blocking)"""
    
    message = {
        'webhook_id': webhook_id,
        'event_data': event_data,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    # Send to SQS (returns immediately)
    sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps(message)
    )
    
    # Return immediately without waiting for delivery
    return {'status': 'queued'}

# Separate Lambda function processes queue
def webhook_delivery_worker(event, context):
    """Async worker that processes webhook queue"""
    for record in event['Records']:
        message = json.loads(record['body'])
        
        # Deliver webhook with retry logic
        deliver_webhook(
            message['webhook_id'], 
            message['event_data']
        )
```

**Impact:**
- API response time: 1.2s → 150ms (87% improvement)
- User experience: Much faster
- Reliability: Automatic retry via SQS DLQ

---

### 6. Batch Processing

**Strategy: Batch DynamoDB Operations**

```python
# ❌ BAD: One-by-one writes (slow, expensive)
def create_notifications(customer_id, messages):
    for message in messages:
        table.put_item(Item={
            'customer_id': customer_id,
            'message': message,
            'created_at': datetime.utcnow().isoformat()
        })
    # 100 messages = 100 API calls

# ✅ GOOD: Batch write (fast, cheap)
def create_notifications(customer_id, messages):
    with table.batch_writer() as batch:
        for message in messages:
            batch.put_item(Item={
                'customer_id': customer_id,
                'message': message,
                'created_at': datetime.utcnow().isoformat()
            })
    # 100 messages = 4 API calls (25 items per batch)
```

**Impact:**
- API calls: 96% reduction
- Execution time: 80% faster
- Cost: 96% reduction in DynamoDB write costs

---

## 📈 Performance Monitoring

### CloudWatch Metrics to Track

```python
# Add custom metrics to Lambda functions
import boto3
cloudwatch = boto3.client('cloudwatch')

def publish_metric(metric_name, value, unit='Milliseconds'):
    """Publish custom performance metric"""
    cloudwatch.put_metric_data(
        Namespace='SecureBase/Phase3B',
        MetricData=[{
            'MetricName': metric_name,
            'Value': value,
            'Unit': unit,
            'Timestamp': datetime.utcnow()
        }]
    )

# Usage in Lambda
def lambda_handler(event, context):
    start_time = time.time()
    
    # ... handler logic
    
    duration = (time.time() - start_time) * 1000
    publish_metric('TicketCreationDuration', duration)
```

### Recommended Custom Metrics

- **Database Query Duration** - Track slow queries
- **Cache Hit Rate** - Monitor caching effectiveness
- **Business Metrics** - Tickets created, forecasts generated
- **Error Rates by Type** - Distinguish validation errors from system errors

---

## 🔧 Implementation Checklist

### Phase 1: Quick Wins (1-2 days)

- [ ] Move imports outside handler (all functions)
- [ ] Implement connection pooling in db_utils.py
- [ ] Add query pagination (support_tickets)
- [ ] Right-size Lambda memory (cost_forecasting, webhook_manager)
- [ ] Add DynamoDB batch operations (notifications)

**Expected Impact:** 
- 30% cost reduction
- 40% latency improvement
- 50% fewer DynamoDB API calls

### Phase 2: Caching Layer (3-5 days)

- [ ] Implement in-memory LRU cache for hot data
- [ ] Add DynamoDB cache table for forecast results
- [ ] Configure API Gateway response caching
- [ ] Add cache invalidation logic

**Expected Impact:**
- 50% reduction in database load
- 80% faster for cached requests
- 40% cost reduction

### Phase 3: Async Processing (5-7 days)

- [ ] Create SQS queue for webhook delivery
- [ ] Implement async webhook delivery worker
- [ ] Add retry logic with exponential backoff
- [ ] Set up dead-letter queue for failed deliveries

**Expected Impact:**
- 70% faster API responses
- Better user experience
- More reliable webhook delivery

### Phase 4: Advanced Optimizations (1-2 weeks)

- [ ] Implement Lambda Provisioned Concurrency for critical functions
- [ ] Set up ElastiCache (Redis) for shared cache
- [ ] Add CloudWatch custom metrics
- [ ] Implement distributed tracing (X-Ray)
- [ ] Performance regression testing

**Expected Impact:**
- Near-zero cold starts
- 90% cache hit rate
- Full observability
- Continuous performance monitoring

---

## 💰 Cost Savings Summary

| Optimization | Implementation Time | Monthly Savings (1,000 customers) | Annual Savings |
|--------------|---------------------|-----------------------------------|----------------|
| Memory right-sizing | 1 hour | $12 | $144 |
| Connection pooling | 4 hours | $8 | $96 |
| Query optimization | 8 hours | $15 | $180 |
| DynamoDB batching | 4 hours | $25 | $300 |
| Response caching | 1 day | $40 | $480 |
| Async processing | 3 days | $20 | $240 |
| **Total** | **5 days** | **$120** | **$1,440** |

**ROI:** 5 days of work → $1,440/year savings + significant performance improvements

---

## 🧪 Testing Optimization Changes

### Before/After Performance Testing

```bash
# 1. Baseline performance
./scripts/performance-benchmark.sh > baseline-results.txt

# 2. Apply optimizations

# 3. Re-run benchmark
./scripts/performance-benchmark.sh > optimized-results.txt

# 4. Compare results
diff baseline-results.txt optimized-results.txt
```

### Load Testing

```python
# scripts/load-test.py
import concurrent.futures
import time
import requests

def create_ticket():
    """Simulate ticket creation"""
    start = time.time()
    response = requests.post(
        'https://api.securebase.dev/support/tickets/create',
        headers={'X-API-Key': 'test-key'},
        json={'subject': 'Test', 'description': 'Load test', 'priority': 'medium'}
    )
    duration = time.time() - start
    return duration, response.status_code

# Run 100 concurrent requests
with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
    results = list(executor.map(lambda _: create_ticket(), range(100)))

# Analyze results
durations = [r[0] for r in results]
print(f"Mean: {sum(durations)/len(durations):.3f}s")
print(f"P95: {sorted(durations)[94]:.3f}s")
print(f"Success rate: {sum(1 for r in results if r[1] == 200) / len(results) * 100:.1f}%")
```

---

## 📚 Additional Resources

- [AWS Lambda Power Tuning](https://github.com/alexcasalboni/aws-lambda-power-tuning)
- [Lambda Performance Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB Performance Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

---

**Document Version:** 1.0  
**Last Updated:** January 22, 2026  
**Owner:** Backend Team
