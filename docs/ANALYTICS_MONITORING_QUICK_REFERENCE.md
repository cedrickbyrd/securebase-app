# Analytics Lambda Monitoring - Quick Reference

Quick commands for monitoring Analytics Lambda functions and infrastructure.

## Prerequisites

```bash
# Ensure AWS credentials are configured
aws configure
# or
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_REGION=us-east-1
```

## Quick Monitoring Script

### Basic Usage

```bash
# Monitor all (default - shows metrics, alarms, errors summary)
./scripts/monitor-analytics.sh

# Monitor specific environment
./scripts/monitor-analytics.sh dev          # Development
./scripts/monitor-analytics.sh staging      # Staging  
./scripts/monitor-analytics.sh prod         # Production
```

### Specific Operations

```bash
# View CloudWatch logs only
./scripts/monitor-analytics.sh dev logs

# View metrics only
./scripts/monitor-analytics.sh dev metrics

# Check alarm status
./scripts/monitor-analytics.sh dev alarms

# Get dashboard URL
./scripts/monitor-analytics.sh dev dashboard

# Complete health check
./scripts/monitor-analytics.sh dev all
```

## Lambda Functions

| Function Name | Purpose | Trigger |
|---------------|---------|---------|
| `analytics-aggregator` | Collect and aggregate metrics | EventBridge (hourly) |
| `analytics-reporter` | Generate reports (PDF, Excel, CSV) | API Gateway |
| `analytics-query` | Handle analytics API queries | API Gateway |
| `report-engine` | Legacy report generation | API Gateway |

## AWS CLI Quick Commands

### Tail Logs (Real-time)

```bash
# Analytics Query (API)
aws logs tail /aws/lambda/securebase-dev-analytics-query --follow

# Analytics Aggregator (Hourly job)
aws logs tail /aws/lambda/securebase-dev-analytics-aggregator --follow

# Analytics Reporter
aws logs tail /aws/lambda/securebase-dev-analytics-reporter --follow

# Report Engine
aws logs tail /aws/lambda/securebase-dev-report-engine --follow
```

### Get Recent Logs

```bash
# Last 1 hour
aws logs tail /aws/lambda/securebase-dev-analytics-query --since 1h

# Last 24 hours
aws logs tail /aws/lambda/securebase-dev-analytics-query --since 24h

# Filter for errors
aws logs tail /aws/lambda/securebase-dev-analytics-query --since 1h --filter-pattern ERROR
```

### Lambda Metrics

**Platform Note:** The `date` command examples below use GNU date syntax (Linux). 
On macOS/BSD systems, replace `-d '1 hour ago'` with `-v-1H`. 
The monitoring script (`monitor-analytics.sh`) handles both platforms automatically.

```bash
# Invocation count (last hour) - Linux
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=securebase-dev-analytics-query \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --query 'Datapoints[0].Sum'

# Invocation count (last hour) - macOS/BSD
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=securebase-dev-analytics-query \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --query 'Datapoints[0].Sum'

# Error count (last hour)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=securebase-dev-analytics-query \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --query 'Datapoints[0].Sum'

# Average duration (last hour)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=securebase-dev-analytics-query \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average \
  --query 'Datapoints[0].Average'
```

### Check Alarms

```bash
# List all analytics alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix securebase-dev-analytics \
  --query 'MetricAlarms[*].[AlarmName,StateValue]' \
  --output table

# Get alarm details
aws cloudwatch describe-alarms \
  --alarm-names securebase-dev-analytics-lambda-errors \
  --query 'MetricAlarms[0]' \
  --output json
```

### Manual Lambda Invocation

```bash
# Invoke analytics-query
aws lambda invoke \
  --function-name securebase-dev-analytics-query \
  --payload '{"httpMethod":"GET","path":"/analytics/summary"}' \
  /tmp/response.json && cat /tmp/response.json

# Invoke analytics-aggregator (trigger metric collection)
aws lambda invoke \
  --function-name securebase-dev-analytics-aggregator \
  --payload '{}' \
  /tmp/response.json && cat /tmp/response.json
```

## CloudWatch Insights Queries

### Find Errors

```sql
fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

### Analyze Performance

```sql
fields @timestamp, @duration, @memorySize, @maxMemoryUsed
| filter @type = "REPORT"
| stats avg(@duration), max(@duration), percentile(@duration, 95)
```

### Find Slow Queries (> 1 second)

```sql
fields @timestamp, @duration, @message
| filter @type = "REPORT" and @duration > 1000
| sort @timestamp desc
| limit 20
```

### Count Errors by Type

```sql
fields @message
| filter @message like /ERROR/
| parse @message /ERROR: (?<error_type>.*)/
| stats count() by error_type
```

### Lambda Cold Starts

```sql
fields @timestamp, @initDuration, @duration
| filter @type = "REPORT"
| stats avg(@initDuration), avg(@duration), max(@duration) by bin(5m)
```

## Dashboard Access

### CloudWatch Console

```bash
# Direct link to dashboard (replace {env} with dev/staging/prod)
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-{env}-analytics
```

### Get Dashboard URL via Script

```bash
./scripts/monitor-analytics.sh dev dashboard
```

## Health Check Indicators

### Healthy Status ✓

```
Invocations: > 0
Errors: 0 or < 5%
Throttles: 0
Avg Duration: < 1000ms
Alarms: OK
```

### Warning Status ⚠

```
Throttles: > 0
Error Rate: 1-5%
Duration: 1-2 seconds
Alarms: INSUFFICIENT_DATA
```

### Degraded Status ✗

```
Error Rate: > 5%
Throttles: Frequent
Duration: > 2 seconds
Alarms: ALARM state
```

## Troubleshooting Quick Fixes

### No Data / Function Not Invoked

```bash
# Manually invoke to generate logs
aws lambda invoke \
  --function-name securebase-dev-analytics-query \
  --payload '{"httpMethod":"GET","path":"/analytics/summary"}' \
  /tmp/response.json
```

### High Error Rate

```bash
# Check recent errors
aws logs tail /aws/lambda/securebase-dev-analytics-query \
  --since 1h --filter-pattern ERROR

# View full error context in CloudWatch Insights (use query from above)
```

### Throttling Issues

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

```bash
# Increase Lambda memory (improves CPU allocation)
aws lambda update-function-configuration \
  --function-name securebase-dev-analytics-query \
  --memory-size 512

# Increase timeout (if hitting timeout)
aws lambda update-function-configuration \
  --function-name securebase-dev-analytics-query \
  --timeout 30
```

## Monitoring Checklist

Daily:
- [ ] Run `./scripts/monitor-analytics.sh dev all`
- [ ] Check for any ALARM state alarms
- [ ] Verify error count is 0 or < 5%
- [ ] Review dashboard for anomalies

Weekly:
- [ ] Analyze performance trends
- [ ] Review CloudWatch Insights for patterns
- [ ] Check cost metrics
- [ ] Update alarm thresholds if needed

Monthly:
- [ ] Review all metrics and optimize
- [ ] Audit log retention settings
- [ ] Test alarm notifications
- [ ] Update documentation

## Common Files

| File | Purpose |
|------|---------|
| `scripts/monitor-analytics.sh` | Main monitoring script |
| `docs/ANALYTICS_MONITORING_GUIDE.md` | Comprehensive guide |
| `landing-zone/modules/analytics/cloudwatch.tf` | CloudWatch infrastructure |
| `landing-zone/modules/analytics/lambda.tf` | Lambda configuration |
| `PHASE4_README.md` | Phase 4 overview and monitoring section |

## Support Resources

- [Analytics Monitoring Guide](docs/ANALYTICS_MONITORING_GUIDE.md) - Full documentation
- [CloudWatch Logs Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [Lambda Monitoring Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/lambda-monitoring.html)
- [CloudWatch Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
