# CloudWatch Analytics Monitoring - Quick Reference

## One-Line Commands

```bash
# Check current status (dev, last hour)
./scripts/check-analytics-cloudwatch.sh

# Check staging (last 2 hours)
./scripts/check-analytics-cloudwatch.sh -e staging -t 7200

# Check production (last 24 hours)
./scripts/check-analytics-cloudwatch.sh -e prod -t 86400 -v

# Monitor specific region
AWS_REGION=us-west-2 ./scripts/check-analytics-cloudwatch.sh
```

## What It Checks

✅ **Lambda Functions**
- Invocations, errors, throttles, duration, concurrency
- `analytics-query`, `analytics-aggregator`, `analytics-reporter`, `report-engine`

✅ **Error Logs**
- Recent ERROR-level logs from CloudWatch Logs
- Timestamps and error messages

✅ **CloudWatch Alarms**
- Lambda errors, throttles, duration
- DynamoDB throttling
- API Gateway 5XX, latency

✅ **DynamoDB Tables**
- Throttling events (UserErrors)
- Tables: metrics, reports, report-cache, report-schedules

✅ **API Gateway**
- Request count, 4XX/5XX errors, latency

## Common Issues

### ✗ Lambda Errors
```bash
# View detailed logs
aws logs tail /aws/lambda/securebase-dev-analytics-query --follow

# Check function configuration
aws lambda get-function --function-name securebase-dev-analytics-query
```

### ✗ Lambda Throttles
```bash
# Check concurrency limit
aws lambda get-function-concurrency --function-name securebase-dev-analytics-query

# Increase reserved concurrency (if needed)
aws lambda put-function-concurrency \
  --function-name securebase-dev-analytics-query \
  --reserved-concurrent-executions 10
```

### ✗ DynamoDB Throttling
```bash
# Check table details
aws dynamodb describe-table --table-name securebase-dev-metrics

# Switch to on-demand (if provisioned)
aws dynamodb update-table \
  --table-name securebase-dev-metrics \
  --billing-mode PAY_PER_REQUEST
```

### ⚠ High Latency
```bash
# Increase Lambda memory (improves CPU)
aws lambda update-function-configuration \
  --function-name securebase-dev-analytics-query \
  --memory-size 512

# Check cold start metrics (dynamic dates)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=securebase-dev-analytics-query \
  --start-time $(date -u -d '1 day ago' '+%Y-%m-%dT%H:%M:%SZ') \
  --end-time $(date -u '+%Y-%m-%dT%H:%M:%SZ') \
  --period 3600 \
  --statistics Average,Maximum
```

## CloudWatch Console Links

**Dashboard:**
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-{env}-analytics
```

**Logs:**
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups
```

**Alarms:**
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:
```

## CloudWatch Insights Queries

**All errors (last 24 hours):**
```
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

**Performance stats:**
```
fields @timestamp, @duration
| filter @type = "REPORT"
| stats avg(@duration), max(@duration), p99(@duration) by bin(5m)
```

**Invocations by status:**
```
filter @type = "REPORT"
| stats count() by @requestId
| stats count() as total
```

## Post-Deployment Checklist

1. ✅ Run monitoring script immediately after deployment
   ```bash
   ./scripts/check-analytics-cloudwatch.sh
   ```

2. ✅ Wait 1 hour for EventBridge to trigger aggregator
   ```bash
   ./scripts/check-analytics-cloudwatch.sh -t 3600
   ```

3. ✅ Check alarms are configured
   ```bash
   aws cloudwatch describe-alarms --alarm-name-prefix securebase-dev-analytics
   ```

4. ✅ Subscribe to SNS alerts
   ```bash
   aws sns subscribe \
     --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:securebase-dev-analytics-alerts \
     --protocol email \
     --notification-endpoint your-email@example.com
   ```

5. ✅ Test analytics API endpoints
   ```bash
   curl -H "Authorization: Bearer $JWT_TOKEN" \
     https://api.securebase.example.com/analytics/usage?period=7d
   ```

## Automation

**Add to CI/CD:**
```bash
# In deployment script
./scripts/check-analytics-cloudwatch.sh -e $ENVIRONMENT -t 300
if [ $? -ne 0 ]; then
  echo "Post-deployment health check failed"
  # Rollback or alert
fi
```

**Continuous Monitoring:**
```bash
# Run every 5 minutes
watch -n 300 './scripts/check-analytics-cloudwatch.sh'

# Or use cron
*/5 * * * * /path/to/scripts/check-analytics-cloudwatch.sh -e prod >> /var/log/analytics-monitor.log 2>&1
```

## Metrics Thresholds

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Errors | 0 | 1-5/hour | >5/hour |
| Throttles | 0 | 1-3 | >3 |
| Duration | <500ms | 500-1000ms | >1000ms |
| Latency (API) | <200ms | 200-500ms | >500ms |
| DynamoDB Throttles | 0 | 1-5 | >5 |

## Environment Variables

```bash
# Override defaults
export ENVIRONMENT=staging
export AWS_REGION=us-west-2
export TIME_WINDOW=7200  # 2 hours

./scripts/check-analytics-cloudwatch.sh
```

## Quick Fixes

**Clear Lambda cache:**
```bash
# Update environment variable to bust cache
aws lambda update-function-configuration \
  --function-name securebase-dev-analytics-query \
  --environment "Variables={CACHE_VERSION=$(date +%s)}"
```

**Restart aggregator:**
```bash
# Manually invoke aggregator
aws lambda invoke \
  --function-name securebase-dev-analytics-aggregator \
  --payload '{}' \
  /tmp/response.json
```

**Clear DynamoDB cache table:**
```bash
# Scan and delete items (dev only!)
aws dynamodb scan --table-name securebase-dev-report-cache \
  --query "Items[*].cache_key" \
  --output text | while read key; do
    aws dynamodb delete-item \
      --table-name securebase-dev-report-cache \
      --key "{\"cache_key\":{\"S\":\"$key\"}}"
done
```

## Support Resources

📖 **Full Guide:** `docs/CLOUDWATCH_MONITORING_GUIDE.md`  
🔧 **Troubleshooting:** `TROUBLESHOOTING.md`  
🚨 **SRE Runbook:** `SRE_RUNBOOK.md`  
📊 **Analytics Guide:** `PHASE4_ANALYTICS_GUIDE.md`

**AWS Documentation:**
- [CloudWatch Lambda Metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html)
- [CloudWatch Logs Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)
- [DynamoDB Metrics](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html)
