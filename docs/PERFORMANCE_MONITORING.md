# Phase 4 Performance Monitoring & Success Criteria

**Version:** 1.0  
**Last Updated:** January 23, 2026  
**Purpose:** Monitor and validate Phase 4 success criteria

---

## Table of Contents
1. [Success Criteria Overview](#success-criteria-overview)
2. [Performance Monitoring](#performance-monitoring)
3. [CloudWatch Metrics](#cloudwatch-metrics)
4. [Alerting & Thresholds](#alerting--thresholds)
5. [Performance Testing](#performance-testing)
6. [Success Criteria Validation](#success-criteria-validation)

---

## Success Criteria Overview

Phase 4 success is measured by the following criteria:

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| Query execution time | < 5s (p95) | CloudWatch Insights, Lambda duration |
| PDF export time | < 10s | Lambda execution metrics |
| Report delivery success rate | > 98% | SES/SNS delivery metrics |
| Customer adoption (custom reports) | > 50% | DynamoDB report count analytics |
| Test coverage | > 90% | pytest --cov output |
| API availability | > 99.9% | API Gateway metrics |
| Error rate | < 1% | Lambda error metrics |

---

## Performance Monitoring

### Architecture

```
User Request
    ↓
API Gateway (latency, errors)
    ↓
Lambda (duration, memory, cold starts)
    ↓
DynamoDB (read/write latency, throttles)
    ↓
S3 (export time, transfer rate)
    ↓
CloudWatch (all metrics aggregated)
```

### Key Performance Indicators (KPIs)

#### 1. Query Execution Time (Target: < 5s p95)

**What it measures:** Time from request to response for analytics queries

**Monitoring:**
```bash
# CloudWatch Insights query
fields @timestamp, @duration
| filter @type = "REPORT" and @message like /lambda_handler/
| stats avg(@duration), pct(@duration, 95) as p95, max(@duration) by bin(5m)
```

**Dashboard Widget:**
- Line chart showing p50, p95, p99 over time
- Alert if p95 > 5000ms for 5 minutes

#### 2. PDF Export Time (Target: < 10s)

**What it measures:** Time to generate PDF exports

**Monitoring:**
```python
# Add instrumentation in report_engine.py
import time

def export_pdf(data, report_name, filename):
    start_time = time.time()
    
    # ... PDF generation code ...
    
    execution_time = time.time() - start_time
    
    # Log metric to CloudWatch
    cloudwatch.put_metric_data(
        Namespace='SecureBase/Analytics',
        MetricData=[{
            'MetricName': 'PDFExportDuration',
            'Value': execution_time,
            'Unit': 'Seconds',
            'Dimensions': [
                {'Name': 'ReportType', 'Value': report_name}
            ]
        }]
    )
```

#### 3. Report Delivery Success Rate (Target: > 98%)

**What it measures:** Percentage of scheduled reports successfully delivered

**Monitoring:**
```javascript
// Track delivery status
const trackDelivery = async (scheduleId, status) => {
    await dynamodb.updateItem({
        TableName: 'report-schedules',
        Key: { scheduleId },
        UpdateExpression: 'SET #s = :status, lastDeliveryTime = :time',
        ExpressionAttributeNames: { '#s': 'deliveryStatus' },
        ExpressionAttributeValues: {
            ':status': status,  // 'success' or 'failed'
            ':time': new Date().toISOString()
        }
    });
    
    // Emit metric
    cloudwatch.putMetricData({
        Namespace: 'SecureBase/Analytics',
        MetricData: [{
            MetricName: 'ReportDeliverySuccess',
            Value: status === 'success' ? 1 : 0,
            Unit: 'Count'
        }]
    });
};
```

**CloudWatch Insights:**
```
fields @timestamp, deliveryStatus
| stats count() as total, 
        sum(deliveryStatus == 'success') as successful
| extend success_rate = successful / total * 100
```

#### 4. Custom Report Adoption (Target: > 50%)

**What it measures:** Percentage of customers creating custom reports

**Query:**
```sql
-- DynamoDB query to count unique customers with reports
SELECT COUNT(DISTINCT customer_id) as customers_with_reports
FROM reports
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Total active customers (from billing/customer table)
SELECT COUNT(*) as total_customers
FROM customers
WHERE status = 'active';

-- Adoption rate = customers_with_reports / total_customers * 100
```

---

## CloudWatch Metrics

### Custom Metrics to Publish

```python
import boto3
from datetime import datetime

cloudwatch = boto3.client('cloudwatch')

def publish_analytics_metrics(customer_id, metrics):
    """Publish custom metrics to CloudWatch"""
    
    metric_data = [
        {
            'MetricName': 'QueryExecutionTime',
            'Value': metrics['execution_time'],
            'Unit': 'Seconds',
            'Timestamp': datetime.utcnow(),
            'Dimensions': [
                {'Name': 'CustomerId', 'Value': customer_id},
                {'Name': 'QueryType', 'Value': metrics['query_type']}
            ]
        },
        {
            'MetricName': 'ResultSetSize',
            'Value': metrics['result_count'],
            'Unit': 'Count',
            'Timestamp': datetime.utcnow(),
            'Dimensions': [
                {'Name': 'CustomerId', 'Value': customer_id}
            ]
        },
        {
            'MetricName': 'CacheHitRate',
            'Value': metrics['cache_hit'] and 1 or 0,
            'Unit': 'None',
            'Timestamp': datetime.utcnow()
        }
    ]
    
    cloudwatch.put_metric_data(
        Namespace='SecureBase/Analytics',
        MetricData=metric_data
    )
```

### Metric Definitions

| Metric Name | Unit | Dimensions | Description |
|-------------|------|------------|-------------|
| QueryExecutionTime | Seconds | CustomerId, QueryType | Time to execute analytics query |
| PDFExportDuration | Seconds | ReportType | Time to generate PDF |
| ExcelExportDuration | Seconds | ReportType | Time to generate Excel |
| CSVExportDuration | Seconds | ReportType | Time to generate CSV |
| ReportDeliverySuccess | Count | DeliveryMethod | Successful deliveries (1) or failures (0) |
| CacheHitRate | None | - | Cache hits (1) or misses (0) |
| ResultSetSize | Count | CustomerId | Number of records returned |
| APIErrors | Count | ErrorType | API errors by type |
| ThrottledRequests | Count | - | Requests throttled by DynamoDB |

---

## Alerting & Thresholds

### CloudWatch Alarms

#### Alarm 1: Query Execution Time P95 > 5s

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "SecureBase-Analytics-SlowQueries" \
  --alarm-description "Query execution p95 exceeds 5 seconds" \
  --metric-name QueryExecutionTime \
  --namespace SecureBase/Analytics \
  --statistic p95 \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5.0 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:analytics-alerts
```

#### Alarm 2: Report Delivery Failure Rate > 2%

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "SecureBase-Analytics-DeliveryFailures" \
  --alarm-description "Report delivery failures exceed 2%" \
  --metrics file://delivery-failure-metric.json \
  --evaluation-periods 1 \
  --threshold 2.0 \
  --comparison-operator GreaterThanThreshold
```

**delivery-failure-metric.json:**
```json
[
  {
    "Id": "m1",
    "ReturnData": false,
    "MetricStat": {
      "Metric": {
        "Namespace": "SecureBase/Analytics",
        "MetricName": "ReportDeliverySuccess",
        "Dimensions": []
      },
      "Period": 3600,
      "Stat": "Sum"
    }
  },
  {
    "Id": "e1",
    "Expression": "(1 - m1 / 100) * 100",
    "Label": "Failure Rate %",
    "ReturnData": true
  }
]
```

#### Alarm 3: Lambda Errors > 1%

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "SecureBase-Analytics-LambdaErrors" \
  --alarm-description "Lambda error rate exceeds 1%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --dimensions Name=FunctionName,Value=securebase-dev-report-engine \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 0.01 \
  --comparison-operator GreaterThanThreshold
```

### Alert Escalation

| Severity | Response Time | Notification |
|----------|---------------|--------------|
| Critical | Immediate | PagerDuty + Slack + Email |
| High | < 30 min | Slack + Email |
| Medium | < 2 hours | Email |
| Low | Next business day | Weekly digest |

---

## Performance Testing

### Load Testing Script

```python
#!/usr/bin/env python3
"""
Load test for Phase 4 Analytics API
Tests query execution time under load
"""

import requests
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed

API_BASE = "https://api.securebase.io/v1"
API_KEY = "your-api-key"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

def query_analytics(customer_id, date_range='30d'):
    """Execute analytics query"""
    start = time.time()
    
    response = requests.get(
        f"{API_BASE}/analytics",
        headers=HEADERS,
        params={
            'dateRange': date_range,
            'dimension': 'service'
        }
    )
    
    duration = time.time() - start
    
    return {
        'status': response.status_code,
        'duration': duration,
        'size': len(response.content)
    }

def load_test(num_requests=100, concurrency=10):
    """Run load test"""
    print(f"Starting load test: {num_requests} requests, {concurrency} concurrent")
    
    durations = []
    errors = 0
    
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [
            executor.submit(query_analytics, 'test-customer')
            for _ in range(num_requests)
        ]
        
        for future in as_completed(futures):
            result = future.result()
            durations.append(result['duration'])
            
            if result['status'] != 200:
                errors += 1
    
    # Calculate statistics
    p50 = statistics.median(durations)
    p95 = statistics.quantiles(durations, n=20)[18]  # 95th percentile
    p99 = statistics.quantiles(durations, n=100)[98]  # 99th percentile
    
    print("\n=== Load Test Results ===")
    print(f"Total requests: {num_requests}")
    print(f"Errors: {errors} ({errors/num_requests*100:.2f}%)")
    print(f"P50: {p50:.3f}s")
    print(f"P95: {p95:.3f}s ({'✓ PASS' if p95 < 5.0 else '✗ FAIL'})")
    print(f"P99: {p99:.3f}s")
    print(f"Min: {min(durations):.3f}s")
    print(f"Max: {max(durations):.3f}s")
    print(f"Avg: {statistics.mean(durations):.3f}s")

if __name__ == '__main__':
    load_test(num_requests=100, concurrency=10)
```

### Export Performance Test

```bash
#!/bin/bash
# Test PDF export performance

API_BASE="https://api.securebase.io/v1"
API_KEY="your-api-key"

echo "Testing PDF export performance..."

for i in {1..10}; do
    start=$(date +%s.%N)
    
    curl -X POST "${API_BASE}/analytics/export" \
        -H "Authorization: Bearer ${API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "format": "pdf",
            "data": [/* ... test data ... */],
            "reportName": "Performance Test"
        }' \
        -o "/tmp/test-${i}.pdf" \
        --silent
    
    end=$(date +%s.%N)
    duration=$(echo "$end - $start" | bc)
    
    echo "Export $i: ${duration}s"
done
```

---

## Success Criteria Validation

### Automated Validation Script

```bash
#!/bin/bash
# validate-success-criteria.sh
# Validates all Phase 4 success criteria

set -e

PASSED=0
FAILED=0
TOTAL=5

echo "=== Phase 4 Success Criteria Validation ==="
echo ""

# 1. Query Execution Time < 5s (p95)
echo "1. Testing query execution time (target: < 5s p95)..."
P95=$(aws cloudwatch get-metric-statistics \
    --namespace SecureBase/Analytics \
    --metric-name QueryExecutionTime \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics p95 \
    --query 'Datapoints[0].p95' \
    --output text)

if (( $(echo "$P95 < 5.0" | bc -l) )); then
    echo "✓ PASS: Query p95 = ${P95}s"
    ((PASSED++))
else
    echo "✗ FAIL: Query p95 = ${P95}s (exceeds 5s)"
    ((FAILED++))
fi

# 2. PDF Export Time < 10s
echo ""
echo "2. Testing PDF export time (target: < 10s)..."
PDF_AVG=$(aws cloudwatch get-metric-statistics \
    --namespace SecureBase/Analytics \
    --metric-name PDFExportDuration \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Average \
    --query 'Datapoints[0].Average' \
    --output text)

if (( $(echo "$PDF_AVG < 10.0" | bc -l) )); then
    echo "✓ PASS: PDF export avg = ${PDF_AVG}s"
    ((PASSED++))
else
    echo "✗ FAIL: PDF export avg = ${PDF_AVG}s (exceeds 10s)"
    ((FAILED++))
fi

# 3. Report Delivery Success Rate > 98%
echo ""
echo "3. Testing report delivery success rate (target: > 98%)..."
SUCCESS_RATE=$(aws dynamodb scan \
    --table-name securebase-dev-report-schedules \
    --filter-expression "attribute_exists(lastDeliveryStatus)" \
    --projection-expression "lastDeliveryStatus" \
    | jq '[.Items[].lastDeliveryStatus.S] | map(select(. == "success")) | length' \
    | awk '{print $1 / 100 * 100}')

if (( $(echo "$SUCCESS_RATE > 98.0" | bc -l) )); then
    echo "✓ PASS: Delivery success rate = ${SUCCESS_RATE}%"
    ((PASSED++))
else
    echo "✗ FAIL: Delivery success rate = ${SUCCESS_RATE}% (below 98%)"
    ((FAILED++))
fi

# 4. Custom Report Adoption > 50%
echo ""
echo "4. Testing custom report adoption (target: > 50%)..."
TOTAL_CUSTOMERS=$(aws dynamodb scan \
    --table-name securebase-dev-customers \
    --select COUNT \
    --query 'Count' \
    --output text)

CUSTOMERS_WITH_REPORTS=$(aws dynamodb scan \
    --table-name securebase-dev-reports \
    --projection-expression "customer_id" \
    | jq '[.Items[].customer_id.S] | unique | length')

ADOPTION_RATE=$(echo "scale=2; $CUSTOMERS_WITH_REPORTS / $TOTAL_CUSTOMERS * 100" | bc)

if (( $(echo "$ADOPTION_RATE > 50.0" | bc -l) )); then
    echo "✓ PASS: Adoption rate = ${ADOPTION_RATE}%"
    ((PASSED++))
else
    echo "✗ FAIL: Adoption rate = ${ADOPTION_RATE}% (below 50%)"
    ((FAILED++))
fi

# 5. Test Coverage > 90%
echo ""
echo "5. Testing code coverage (target: > 90%)..."
cd /path/to/phase2-backend/functions
COVERAGE=$(python3 -m pytest test_report_engine.py test_integration.py \
    --cov=report_engine --cov-report=term \
    | grep "TOTAL" | awk '{print $NF}' | sed 's/%//')

if (( $(echo "$COVERAGE > 90.0" | bc -l) )); then
    echo "✓ PASS: Test coverage = ${COVERAGE}%"
    ((PASSED++))
else
    echo "✗ FAIL: Test coverage = ${COVERAGE}% (below 90%)"
    ((FAILED++))
fi

# Summary
echo ""
echo "=== Summary ==="
echo "Passed: $PASSED / $TOTAL"
echo "Failed: $FAILED / $TOTAL"

if [ $FAILED -eq 0 ]; then
    echo "✓ ALL SUCCESS CRITERIA MET"
    exit 0
else
    echo "✗ SOME CRITERIA NOT MET"
    exit 1
fi
```

### Manual Validation Checklist

```markdown
## Phase 4 Success Criteria - Manual Validation

- [ ] **Query Execution Time** (< 5s p95)
  - [ ] Run load test with 100 concurrent users
  - [ ] Verify p95 < 5000ms in CloudWatch
  - [ ] Test with 90-day date range
  - [ ] Test with complex filters

- [ ] **PDF Export Time** (< 10s)
  - [ ] Export report with 50 rows
  - [ ] Export report with 500 rows
  - [ ] Export with charts enabled
  - [ ] Verify all exports < 10s

- [ ] **Delivery Success Rate** (> 98%)
  - [ ] Schedule 100 test reports
  - [ ] Verify > 98 delivered successfully
  - [ ] Check email deliverability
  - [ ] Test Slack webhook delivery

- [ ] **Custom Report Adoption** (> 50%)
  - [ ] Survey 20 customers
  - [ ] Count custom reports created
  - [ ] Calculate adoption percentage
  - [ ] Document feedback

- [ ] **Test Coverage** (> 90%)
  - [ ] Run pytest with --cov flag
  - [ ] Review coverage report
  - [ ] Add tests for uncovered lines
  - [ ] Verify all critical paths tested
```

---

## Troubleshooting Performance Issues

### Slow Queries

**Symptoms:** Query p95 > 5s  
**Diagnosis:**
1. Check DynamoDB read capacity units
2. Review query filters and indexes
3. Check cache hit rate
4. Analyze query complexity

**Solutions:**
- Add GSI for frequently queried dimensions
- Implement query result caching
- Optimize date range filtering
- Use pagination for large result sets

### Slow Exports

**Symptoms:** PDF/Excel export > 10s  
**Diagnosis:**
1. Check Lambda memory allocation
2. Review data size being exported
3. Check S3 upload time
4. Analyze PDF generation complexity

**Solutions:**
- Increase Lambda memory to 1024MB
- Limit export to 1000 rows max
- Use async export for large datasets
- Optimize PDF templates

### Low Delivery Success Rate

**Symptoms:** < 98% delivery success  
**Diagnosis:**
1. Check SES sending limits
2. Review email bounce rate
3. Verify webhook URLs
4. Check network connectivity

**Solutions:**
- Request SES limit increase
- Implement retry logic
- Validate email addresses
- Add webhook health checks

---

## Dashboard Templates

### CloudWatch Dashboard JSON

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["SecureBase/Analytics", "QueryExecutionTime", {"stat": "p95"}],
          ["...", {"stat": "Average"}]
        ],
        "title": "Query Execution Time",
        "yAxis": {"left": {"min": 0, "max": 10}},
        "annotations": {
          "horizontal": [
            {"value": 5, "label": "p95 Target", "color": "#ff0000"}
          ]
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["SecureBase/Analytics", "PDFExportDuration", {"stat": "Average"}],
          [".", "ExcelExportDuration", {"stat": "Average"}],
          [".", "CSVExportDuration", {"stat": "Average"}]
        ],
        "title": "Export Duration by Format",
        "yAxis": {"left": {"min": 0}}
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          [{"expression": "m1 / (m1 + m2) * 100", "label": "Success Rate %"}],
          ["SecureBase/Analytics", "ReportDeliverySuccess", {"id": "m1", "visible": false}],
          [".", "ReportDeliveryFailure", {"id": "m2", "visible": false}]
        ],
        "title": "Report Delivery Success Rate",
        "yAxis": {"left": {"min": 95, "max": 100}},
        "annotations": {
          "horizontal": [
            {"value": 98, "label": "Target", "color": "#00ff00"}
          ]
        }
      }
    }
  ]
}
```

---

**Version:** 1.0  
**Last Updated:** January 23, 2026  
**Maintained by:** SecureBase Engineering Team
