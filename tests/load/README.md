# SecureBase Load Testing

This directory contains load testing scripts for the SecureBase platform.

## Tools

We provide two load testing tools:

1. **Artillery** - YAML-based, easy to use, built-in reporting
2. **k6** - JavaScript-based, advanced metrics, better for CI/CD

## Prerequisites

### Artillery
```bash
npm install -g artillery
npm install -g artillery-plugin-expect
npm install -g artillery-plugin-metrics-by-endpoint
```

### k6
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Running Tests

### Quick Start

**Artillery:**
```bash
# Run load test
artillery run artillery-config.yml

# Run with custom target
artillery run --target https://api-staging.securebase.com artillery-config.yml

# Generate HTML report
artillery run artillery-config.yml --output report.json
artillery report report.json --output report.html
```

**k6:**
```bash
# Run load test
k6 run k6-load-test.js

# Run with custom environment
API_BASE_URL=https://api-staging.securebase.com k6 run k6-load-test.js

# Run with cloud output (requires k6 Cloud account)
k6 run --out cloud k6-load-test.js
```

### Test Scenarios

#### 1. Baseline Performance Test
**Goal:** Establish performance baseline with minimal load

**Artillery:**
```bash
artillery run --config test-configs/baseline.yml artillery-config.yml
```

**k6:**
```bash
K6_STAGES='[{"duration":"5m","target":10}]' k6 run k6-load-test.js
```

**Expected Results:**
- p50 latency: < 30ms
- p95 latency: < 80ms
- p99 latency: < 150ms
- Error rate: 0%

#### 2. Sustained Load Test
**Goal:** Test performance under expected production load

**Load:** 100 concurrent users for 10 minutes

**Expected Results:**
- p50 latency: < 50ms
- p95 latency: < 100ms
- p99 latency: < 200ms
- Error rate: < 0.5%
- Cache hit rate: > 70%

#### 3. Spike Test
**Goal:** Test system behavior under sudden traffic spike

**Load:** 10 → 500 users in 30 seconds

**Expected Results:**
- Auto-scaling responds within 2 minutes
- No errors during spike
- API Gateway throttling activated
- Lambda concurrency scales appropriately

#### 4. Endurance Test
**Goal:** Detect memory leaks and performance degradation

**Load:** 50 users for 24 hours

**Expected Results:**
- No memory growth in Lambda functions
- Consistent latency throughout test
- No connection pool exhaustion
- Database connections stable

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API p50 latency | < 50ms | CloudWatch |
| API p95 latency | < 100ms | Load test |
| API p99 latency | < 200ms | Load test |
| Error rate | < 1% | Load test |
| Throughput | 1000+ req/s | Load test |
| CloudFront cache hit | > 80% | CloudWatch |
| ElastiCache hit | > 70% | CloudWatch |
| Lambda cold start | < 500ms | X-Ray |

## Interpreting Results

### Artillery Report

```json
{
  "aggregate": {
    "counters": {
      "http.requests": 12000,
      "http.responses": 11950,
      "http.codes.200": 11900,
      "http.codes.4xx": 30,
      "http.codes.5xx": 20
    },
    "rates": {
      "http.request_rate": 100
    },
    "http.request_rate": null,
    "firstCounterAt": 1706112000000,
    "firstHistogramAt": 1706112001000,
    "lastCounterAt": 1706115600000,
    "lastHistogramAt": 1706115599000,
    "histograms": {
      "http.response_time": {
        "min": 12,
        "max": 450,
        "count": 11950,
        "mean": 65,
        "median": 55,
        "p95": 98,
        "p99": 175
      }
    }
  }
}
```

**Good Indicators:**
- ✅ p95 < 100ms
- ✅ Error rate < 1%
- ✅ Steady throughput
- ✅ No timeouts

**Warning Signs:**
- ⚠️ Increasing latency over time (memory leak?)
- ⚠️ High error rate (> 1%)
- ⚠️ Timeouts (connection pool exhaustion?)
- ⚠️ Decreasing throughput (throttling?)

### k6 Report

```
     ✓ login successful
     ✓ invoices loaded
     ✓ metrics loaded

     checks.........................: 99.8%  ✓ 11940    ✗ 20
     data_received..................: 50 MB  417 kB/s
     data_sent......................: 12 MB  100 kB/s
     http_req_blocked...............: avg=1.2ms    min=0s      med=0s      max=500ms   p(95)=0s
     http_req_duration..............: avg=65ms     min=12ms    med=55ms    max=450ms   p(95)=98ms
       { expected_response:true }...: avg=64ms     min=12ms    med=54ms    max=400ms   p(95)=97ms
     http_req_failed................: 0.5%   ✓ 60       ✗ 11940
     http_reqs......................: 12000  100/s
     iteration_duration.............: avg=10.2s    min=8.5s    med=10s     max=15s     p(95)=12s
     iterations.....................: 1200   10/s
     vus............................: 100    min=10     max=300
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Load Test

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run load test
        env:
          API_BASE_URL: ${{ secrets.API_BASE_URL }}
        run: k6 run tests/load/k6-load-test.js
      
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: summary.json
```

## Troubleshooting

### High Error Rate

**Symptoms:**
- Error rate > 5%
- Many 5xx responses

**Diagnosis:**
```bash
# Check Lambda errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --statistics Sum

# Check API Gateway errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 5XXError \
  --statistics Sum
```

**Solutions:**
1. Increase Lambda concurrency
2. Check database connection pool
3. Review Lambda timeout settings
4. Check for memory exhaustion

### Slow Response Times

**Symptoms:**
- p95 > 200ms
- Increasing latency over time

**Diagnosis:**
```bash
# Check slow Lambda functions
aws logs insights query \
  --log-group-name /aws/lambda/securebase-prod \
  --query-string 'fields @timestamp, @duration | filter @type="REPORT" | sort @duration desc | limit 20'

# Check cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHitRate \
  --statistics Average
```

**Solutions:**
1. Enable ElastiCache
2. Optimize database queries
3. Increase Lambda memory
4. Enable API Gateway caching

### Connection Timeouts

**Symptoms:**
- Socket timeout errors
- Connection refused

**Diagnosis:**
```bash
# Check Lambda concurrent executions
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name ConcurrentExecutions \
  --statistics Maximum

# Check RDS connections
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --statistics Average
```

**Solutions:**
1. Implement RDS Proxy
2. Increase database max_connections
3. Reduce Lambda timeout
4. Add connection pooling

## Best Practices

1. **Start small** - Begin with baseline test before sustained load
2. **Monitor during test** - Watch CloudWatch dashboards in real-time
3. **Test in staging first** - Never run full load test against production initially
4. **Gradual ramp-up** - Always include warm-up phase
5. **Realistic scenarios** - Model actual user behavior, not just API hammering
6. **Clean up** - Delete test data after load tests
7. **Document results** - Keep history of test results for comparison
8. **Set thresholds** - Fail tests if performance degrades
9. **Regular testing** - Run load tests weekly/monthly
10. **Correlate metrics** - Compare load test results with CloudWatch metrics

## Additional Resources

- [Artillery Documentation](https://www.artillery.io/docs)
- [k6 Documentation](https://k6.io/docs/)
- [AWS Load Testing Best Practices](https://aws.amazon.com/solutions/implementations/distributed-load-testing-on-aws/)
- [Performance Testing Guide](../docs/PERFORMANCE_TUNING_GUIDE.md)
