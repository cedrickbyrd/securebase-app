# Analytics Lambda Monitoring Guide

This guide explains how to monitor AWS CloudWatch logs and metrics for the deployed Analytics Lambda functions to confirm healthy operation.

## Overview

The Analytics module consists of four Lambda functions:
1. **analytics-aggregator** - Collects and aggregates metrics (runs hourly via EventBridge)
2. **analytics-reporter** - Generates reports in various formats (PDF, Excel, CSV)
3. **analytics-query** - Handles API queries for analytics data
4. **report-engine** - Legacy report generation engine (backwards compatibility)

## Monitoring Infrastructure

### CloudWatch Resources

All monitoring resources are defined in `landing-zone/modules/analytics/cloudwatch.tf`:

- **Log Groups**: One per Lambda function with 30-day retention
- **Dashboard**: Unified view of Lambda, DynamoDB, API Gateway, and S3 metrics
- **Alarms**: Automated alerts for errors, throttles, high latency
- **SNS Topic**: Alert notification delivery
- **Log Metric Filters**: Custom metrics from log patterns
- **CloudWatch Insights Queries**: Pre-built queries for debugging

### Metrics Tracked

**Lambda Metrics:**
- Invocations (total function calls)
- Errors (failed executions)
- Throttles (rate limit hits)
- Duration (execution time)

**DynamoDB Metrics:**
- ConsumedReadCapacityUnits
- ConsumedWriteCapacityUnits
- UserErrors (throttling)
- SystemErrors

**API Gateway Metrics:**
- Request count
- 4XX errors (client errors)
- 5XX errors (server errors)
- Latency

**S3 Metrics:**
- Object count
- Bucket size

### Alarms Configured

| Alarm Name | Threshold | Description |
|------------|-----------|-------------|
| analytics-lambda-errors | > 5/hour | Lambda error rate exceeded |
| analytics-lambda-duration | > 1s avg | Query latency too high |
| analytics-lambda-throttles | > 0 | Function throttling detected |
| analytics-dynamodb-throttles | > 5 | DynamoDB capacity exceeded |
| analytics-api-5xx | > 10 | API server errors high |
| analytics-api-latency | > 500ms | API latency exceeded |
| analytics-failed-reports | > 3/hour | Multiple report failures |

## Using the Monitoring Script

### Quick Start

```bash
# Monitor all analytics functions in dev environment
./scripts/monitor-analytics.sh

# Monitor production environment
./scripts/monitor-analytics.sh prod

# View only logs
./scripts/monitor-analytics.sh dev logs

# View only metrics
./scripts/monitor-analytics.sh dev metrics

# Check alarm status
./scripts/monitor-analytics.sh dev alarms

# Get dashboard URL
./scripts/monitor-analytics.sh dev dashboard
```

### Script Operations

#### 1. View All Monitoring Data (default)

```bash
./scripts/monitor-analytics.sh dev all
```

Shows:
- Lambda function metrics for last hour
- CloudWatch alarm status
- Dashboard URL
- Recent errors summary

**Output Example:**
```
═══════════════════════════════════════════════════
         LAMBDA FUNCTION METRICS (Last Hour)
═══════════════════════════════════════════════════

━━━ Metrics: securebase-dev-analytics-aggregator ━━━
Time range: Last 1 hour
Invocations: 1
Errors: 0
Throttles: 0
Avg Duration: 234.5 ms
Error Rate: 0.00%
✓ Health: HEALTHY
```

#### 2. View CloudWatch Logs

```bash
./scripts/monitor-analytics.sh dev logs
```

For each Lambda function:
- Shows latest log stream name
- Displays last 20 log entries
- Counts errors in last hour
- Shows recent error messages

**Use Cases:**
- Debugging function failures
- Verifying successful invocations
- Tracking execution flow
- Investigating errors

#### 3. View Metrics Only

```bash
./scripts/monitor-analytics.sh dev metrics
```

Shows CloudWatch metrics without logs:
- Invocation counts
- Error counts and rates
- Throttle events
- Average duration
- Health assessment

**Health Status:**
- `HEALTHY` - No errors, no throttles
- `WARNING` - Throttling detected
- `DEGRADED` - Error rate > 5%
- `NO DATA` - No invocations in last hour

#### 4. Check Alarms

```bash
./scripts/monitor-analytics.sh dev alarms
```

Lists all CloudWatch alarms with status:
- `OK` (green) - Normal operation
- `ALARM` (red) - Threshold breached
- `INSUFFICIENT_DATA` (yellow) - Not enough data

**Output Example:**
```
━━━ CloudWatch Alarms Status ━━━
✓ securebase-dev-analytics-lambda-errors: OK
✓ securebase-dev-analytics-lambda-duration: OK
✓ securebase-dev-analytics-lambda-throttles: OK
⚠ securebase-dev-analytics-failed-reports: INSUFFICIENT_DATA

Summary:
  Total alarms: 7
  OK: 6
  Insufficient data: 1
  Alarming: 0
```

#### 5. Dashboard Access

```bash
./scripts/monitor-analytics.sh dev dashboard
```

Provides direct link to CloudWatch dashboard:
```
✓ Dashboard exists: securebase-dev-analytics

View dashboard:
  https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-dev-analytics
```

## Manual Monitoring via AWS CLI

### Tail Live Logs

```bash
# Follow logs in real-time (analytics-query)
aws logs tail /aws/lambda/securebase-dev-analytics-query --follow

# Get last 100 lines
aws logs tail /aws/lambda/securebase-dev-analytics-aggregator --since 1h
```

### Query Logs with CloudWatch Insights

```bash
# Use pre-defined query for errors
aws logs start-query \
  --log-group-name /aws/lambda/securebase-dev-report-engine \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100'
```

### Get Specific Metrics

**Note:** The date command examples below use GNU date syntax (Linux). On macOS/BSD systems, 
replace `-d '1 hour ago'` with `-v-1H`. The monitoring script handles this automatically.

```bash
# Invocation count (last hour)
# Linux:
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=securebase-dev-analytics-query \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# macOS/BSD:
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=securebase-dev-analytics-query \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# Error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=securebase-dev-analytics-reporter \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

### List All Alarms

```bash
# Get alarm status
aws cloudwatch describe-alarms \
  --alarm-name-prefix securebase-dev-analytics \
  --query 'MetricAlarms[*].[AlarmName,StateValue,StateReason]' \
  --output table
```

## Manual Monitoring via AWS Console

### CloudWatch Dashboard

1. Navigate to **CloudWatch** → **Dashboards**
2. Select dashboard: `securebase-{env}-analytics`
3. View widgets:
   - Lambda Function Health (invocations, errors, throttles, duration)
   - DynamoDB Usage (read/write capacity, errors)
   - API Gateway Analytics (requests, errors, latency)
   - S3 Report Storage (object count, size)

### CloudWatch Logs

1. Navigate to **CloudWatch** → **Logs** → **Log groups**
2. Select log group:
   - `/aws/lambda/securebase-{env}-analytics-aggregator`
   - `/aws/lambda/securebase-{env}-analytics-reporter`
   - `/aws/lambda/securebase-{env}-analytics-query`
   - `/aws/lambda/securebase-{env}-report-engine`
3. Click **Log streams** → Select latest stream
4. Use **Filter events** to search for patterns

### CloudWatch Insights

1. Navigate to **CloudWatch** → **Logs Insights**
2. Select log groups (multi-select available)
3. Use pre-built queries:
   - `securebase-{env}-analytics-errors`
   - `securebase-{env}-analytics-performance`
4. Or create custom queries:

```sql
-- Find slow queries (> 1 second)
fields @timestamp, @duration, @message
| filter @type = "REPORT" and @duration > 1000
| sort @timestamp desc
| limit 20

-- Count errors by type
fields @message
| filter @message like /ERROR/
| parse @message /ERROR: (?<error_type>.*)/
| stats count() by error_type

-- Analyze Lambda cold starts
fields @timestamp, @initDuration, @duration
| filter @type = "REPORT"
| stats avg(@initDuration), avg(@duration), max(@duration)
```

### CloudWatch Alarms

1. Navigate to **CloudWatch** → **Alarms** → **All alarms**
2. Filter by prefix: `securebase-{env}-analytics`
3. Click alarm name to view:
   - Current state
   - Metric graph
   - State history
   - Alarm configuration

## Troubleshooting Guide

### No Data in Metrics

**Symptom:** All metrics show 0 or "NO DATA"

**Causes:**
1. Lambda has not been invoked yet
2. Wrong AWS region selected
3. Functions not deployed

**Solution:**
```bash
# Verify Lambda exists
aws lambda list-functions --query 'Functions[?contains(FunctionName, `analytics`)].FunctionName'

# Check EventBridge rule (aggregator should run hourly)
aws events list-rules --name-prefix securebase-dev-analytics

# Manually invoke aggregator
aws lambda invoke \
  --function-name securebase-dev-analytics-aggregator \
  --payload '{}' \
  /tmp/response.json
```

### High Error Rate

**Symptom:** Error metrics > 5% or alarms in ALARM state

**Investigation Steps:**

1. **Check recent errors:**
   ```bash
   ./scripts/monitor-analytics.sh dev logs
   ```

2. **View error details in CloudWatch Insights:**
   ```sql
   fields @timestamp, @message, @logStream
   | filter @message like /ERROR/
   | sort @timestamp desc
   | limit 50
   ```

3. **Common error causes:**
   - DynamoDB table not found → Check Terraform deployment
   - Permission denied → Verify IAM role permissions
   - Timeout → Increase Lambda timeout or optimize code
   - Out of memory → Increase Lambda memory allocation

### Throttling Detected

**Symptom:** Throttles metric > 0

**Causes:**
1. Lambda concurrency limit reached
2. Too many simultaneous requests

**Solution:**
```bash
# Check current concurrency
aws lambda get-function-concurrency \
  --function-name securebase-dev-analytics-query

# Increase reserved concurrency (if needed)
aws lambda put-function-concurrency \
  --function-name securebase-dev-analytics-query \
  --reserved-concurrent-executions 10
```

### High Latency

**Symptom:** Duration metrics > 1000ms or API latency alarm

**Investigation:**

1. Check Lambda duration breakdown:
   ```bash
   ./scripts/monitor-analytics.sh dev metrics
   ```

2. Analyze performance in Insights:
   ```sql
   fields @timestamp, @duration, @memorySize, @maxMemoryUsed
   | filter @type = "REPORT"
   | stats avg(@duration), percentile(@duration, 95), percentile(@duration, 99)
   ```

3. **Optimization options:**
   - Increase Lambda memory (improves CPU)
   - Enable DynamoDB caching (check cache hit rate)
   - Optimize DynamoDB queries (use indexes)
   - Reduce report complexity

### Missing Log Groups

**Symptom:** Script shows "Log group not found"

**Causes:**
1. Lambda never invoked (log group created on first invocation)
2. Terraform not deployed
3. Log group deleted manually

**Solution:**
```bash
# Check if Lambda exists
aws lambda get-function --function-name securebase-dev-analytics-query

# Invoke Lambda to create log group
aws lambda invoke \
  --function-name securebase-dev-analytics-query \
  --payload '{"httpMethod":"GET","path":"/analytics/summary"}' \
  /tmp/response.json

# Verify log group creation
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/securebase-dev
```

## Best Practices

### Regular Monitoring

1. **Daily:** Check dashboard for anomalies
2. **Weekly:** Review alarm history and trends
3. **Monthly:** Analyze performance metrics and optimize

### Alerting

Configure SNS topic subscription for alarm notifications:

```bash
# Subscribe email to alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:securebase-dev-analytics-alerts \
  --protocol email \
  --notification-endpoint ops@example.com
```

### Log Retention

Default retention: **30 days**

Adjust if needed:
```bash
aws logs put-retention-policy \
  --log-group-name /aws/lambda/securebase-dev-analytics-query \
  --retention-in-days 90
```

### Custom Metrics

Add custom metrics in Lambda code:

```python
import boto3
cloudwatch = boto3.client('cloudwatch')

# Publish custom metric
cloudwatch.put_metric_data(
    Namespace='SecureBase/Analytics',
    MetricData=[{
        'MetricName': 'ReportGenerationTime',
        'Value': duration_ms,
        'Unit': 'Milliseconds',
        'Dimensions': [{
            'Name': 'ReportType',
            'Value': 'PDF'
        }]
    }]
)
```

## Automated Monitoring

### Continuous Monitoring Script

Add to cron for automated checks:

```bash
# Check every 15 minutes
*/15 * * * * /path/to/scripts/monitor-analytics.sh prod metrics >> /var/log/analytics-monitor.log 2>&1
```

### Integration with Monitoring Tools

Export CloudWatch metrics to:
- **Datadog**: Use CloudWatch integration
- **Grafana**: CloudWatch data source
- **Prometheus**: CloudWatch Exporter
- **New Relic**: AWS integration

## Additional Resources

- [CloudWatch Logs Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [Lambda Monitoring Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/lambda-monitoring.html)
- [CloudWatch Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- Phase 4 Analytics: `PHASE4_README.md`
- Deployment Guide: `PHASE4_DEPLOYMENT_INSTRUCTIONS.md`
- Analytics Module README: `landing-zone/modules/analytics/README.md`

## Support

For issues or questions:
1. Check CloudWatch Logs for error details
2. Review alarm history in CloudWatch console
3. Run monitoring script with `all` operation
4. Consult `TROUBLESHOOTING.md` for common issues
