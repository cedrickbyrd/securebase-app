# CloudWatch Monitoring Guide - Analytics Lambda Functions

## Overview

This guide explains how to monitor the Analytics Lambda functions using AWS CloudWatch to detect errors, performance issues, and invocation problems post-deployment.

## Quick Start

### Prerequisites
- AWS CLI installed and configured
- Valid AWS credentials with CloudWatch read permissions
- Analytics Lambda functions deployed to AWS

### Basic Usage

```bash
# Check dev environment (last hour)
./scripts/check-analytics-cloudwatch.sh

# Check staging environment (last 2 hours)
./scripts/check-analytics-cloudwatch.sh -e staging -t 7200

# Check production (last 24 hours with verbose output)
./scripts/check-analytics-cloudwatch.sh -e prod -t 86400 -v
```

## Monitoring Script Features

The `check-analytics-cloudwatch.sh` script provides comprehensive monitoring for:

### 1. Lambda Function Metrics
For each Analytics Lambda function:
- **Invocations**: Total number of function invocations
- **Errors**: Number of failed invocations
- **Throttles**: Number of throttled invocations (concurrency limit)
- **Duration**: Average execution time in milliseconds
- **Concurrent Executions**: Maximum concurrent invocations

Functions monitored:
- `analytics-query` - Real-time API queries
- `analytics-aggregator` - Hourly metrics aggregation
- `analytics-reporter` - Report generation
- `report-engine` - Legacy report engine

### 2. Error Log Analysis
- Retrieves recent ERROR-level logs from CloudWatch Logs
- Displays timestamps and error messages
- Automatically filters for the specified time window

### 3. CloudWatch Alarms Status
Checks status of configured alarms:
- Lambda function errors
- Lambda function throttles
- Lambda function duration (latency)
- DynamoDB throttling events
- API Gateway 5XX errors
- API Gateway latency

### 4. DynamoDB Metrics
Monitors analytics DynamoDB tables:
- `securebase-{env}-metrics` - Time-series metrics data
- `securebase-{env}-reports` - Report metadata
- `securebase-{env}-report-cache` - Query cache
- `securebase-{env}-report-schedules` - Scheduled reports

Checks for:
- Throttling events (UserErrors)
- System errors

### 5. API Gateway Metrics
For analytics API endpoints:
- Total request count
- 4XX client errors
- 5XX server errors
- Average latency

## Command Line Options

```
Usage: check-analytics-cloudwatch.sh [OPTIONS]

Options:
  -e, --environment ENV    Environment (dev, staging, prod) [default: dev]
  -r, --region REGION      AWS region [default: us-east-1]
  -t, --time-window SECS   Time window in seconds [default: 3600]
  -v, --verbose            Show verbose output
  -h, --help               Show this help message

Environment Variables:
  ENVIRONMENT              Override default environment
  AWS_REGION               Override default AWS region
  TIME_WINDOW              Override default time window
```

## Understanding the Output

### Status Indicators

- ✓ (Green) - No issues detected
- ✗ (Red) - Errors or problems detected
- ⚠ (Yellow) - Warnings or missing resources

### Sample Output

```
==========================================
CloudWatch Analytics Monitoring Report
==========================================
Environment: dev
Region: us-east-1
Time Window: 3600 seconds (60 minutes)
Timestamp: 2026-01-28 14:00:00 UTC
==========================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Function: Analytics Query API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Invocations: 147
  ✓ Errors: 0
  ✓ Throttles: 0
  ✓ Avg Duration: 245ms
  Max Concurrent: 3

  Recent Error Logs:
  No errors found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CloudWatch Alarms Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ securebase-dev-analytics-lambda-errors: OK
  ✓ securebase-dev-analytics-lambda-duration: OK
  ✓ securebase-dev-analytics-lambda-throttles: OK

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ All systems operational
  ✓ No errors or throttling detected
```

## Common Issues and Troubleshooting

### Issue: High Error Rate

**Symptoms:**
- ✗ Errors: 15 (or any number > 0)
- Error logs showing exceptions

**Troubleshooting Steps:**
1. Review error logs displayed in the output
2. Check CloudWatch Logs for full stack traces:
   ```bash
   aws logs tail /aws/lambda/securebase-dev-analytics-query --follow
   ```
3. Check Lambda function configuration (environment variables, permissions)
4. Review recent code deployments

### Issue: Lambda Throttling

**Symptoms:**
- ✗ Throttles: 5
- Functions being rate-limited

**Troubleshooting Steps:**
1. Check concurrent execution limit:
   ```bash
   aws lambda get-function-concurrency --function-name securebase-dev-analytics-query
   ```
2. Review account-level Lambda concurrency limits
3. Consider increasing reserved concurrency for critical functions
4. Implement exponential backoff in clients

### Issue: High Latency

**Symptoms:**
- ⚠ Avg Duration: 1500ms (slow)
- API Gateway latency exceeded 500ms

**Troubleshooting Steps:**
1. Check DynamoDB table performance:
   - Review read/write capacity
   - Check for hot partitions
2. Review Lambda function memory allocation
3. Check for cold start issues (increase function memory or use provisioned concurrency)
4. Review query optimization in code

### Issue: DynamoDB Throttling

**Symptoms:**
- ✗ securebase-dev-metrics: 10 throttling events

**Troubleshooting Steps:**
1. Check DynamoDB table capacity:
   ```bash
   aws dynamodb describe-table --table-name securebase-dev-metrics
   ```
2. Consider switching from provisioned to on-demand billing
3. Review access patterns for optimization
4. Implement exponential backoff in Lambda functions

### Issue: API Gateway 5XX Errors

**Symptoms:**
- ✗ 5XX Errors: 12

**Troubleshooting Steps:**
1. Check Lambda function errors (usually the root cause)
2. Review API Gateway integration configuration
3. Check Lambda timeout settings
4. Review CloudWatch Logs for API Gateway execution logs

## Monitoring Best Practices

### 1. Regular Monitoring
Run the monitoring script:
- **After deployment**: Immediately and 1 hour after
- **Daily**: During business hours
- **On-demand**: When alerts are triggered or issues reported

### 2. Set Up SNS Notifications
Configure email/SMS notifications for CloudWatch alarms:
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:securebase-dev-analytics-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

### 3. CloudWatch Dashboard
Access the pre-configured dashboard:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-dev-analytics
```

### 4. Log Insights Queries
Use CloudWatch Insights for advanced analysis:

**Find all errors in last 24 hours:**
```
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

**Performance analysis:**
```
fields @timestamp, @duration, @message
| filter @type = "REPORT"
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)
```

### 5. Automated Monitoring
Add to CI/CD pipeline:
```bash
# In deployment script
./scripts/check-analytics-cloudwatch.sh -e staging -t 600
if [ $? -ne 0 ]; then
  echo "CloudWatch monitoring detected issues"
  exit 1
fi
```

## AWS Console Access

### CloudWatch Logs
Direct links to log groups:
- Analytics Query: `/aws/lambda/securebase-{env}-analytics-query`
- Analytics Aggregator: `/aws/lambda/securebase-{env}-analytics-aggregator`
- Analytics Reporter: `/aws/lambda/securebase-{env}-analytics-reporter`
- Report Engine: `/aws/lambda/securebase-{env}-report-engine`

### CloudWatch Metrics
Navigate to: CloudWatch → Metrics → Lambda → By Function Name

### CloudWatch Alarms
Navigate to: CloudWatch → Alarms → All Alarms
Filter by: `securebase-{env}-analytics`

## Integration with Existing Tools

### Integration with SRE Runbook
This monitoring script complements the SRE Runbook (see `SRE_RUNBOOK.md`):
- Use for incident detection
- Part of troubleshooting procedures
- Health check validation

### Integration with Deployment Scripts
The script can be called from:
- `deploy-phase4-analytics.sh` - Post-deployment validation
- `DEPLOY_NOW.sh` - Production deployment verification
- CI/CD pipelines - Automated monitoring

## Advanced Usage

### Custom Time Windows
```bash
# Last 5 minutes
./scripts/check-analytics-cloudwatch.sh -t 300

# Last week
./scripts/check-analytics-cloudwatch.sh -t 604800
```

### Multi-Region Monitoring
```bash
# Check us-west-2
./scripts/check-analytics-cloudwatch.sh -r us-west-2

# Check eu-west-1
./scripts/check-analytics-cloudwatch.sh -r eu-west-1
```

### Continuous Monitoring
```bash
# Run every 5 minutes
watch -n 300 './scripts/check-analytics-cloudwatch.sh'
```

## Metrics Reference

### Lambda Function Metrics

| Metric | Namespace | Dimension | Description |
|--------|-----------|-----------|-------------|
| Invocations | AWS/Lambda | FunctionName | Number of times function was invoked |
| Errors | AWS/Lambda | FunctionName | Number of invocations that resulted in errors |
| Throttles | AWS/Lambda | FunctionName | Number of throttled invocations |
| Duration | AWS/Lambda | FunctionName | Execution time in milliseconds |
| ConcurrentExecutions | AWS/Lambda | FunctionName | Number of concurrent executions |

### DynamoDB Metrics

| Metric | Namespace | Dimension | Description |
|--------|-----------|-----------|-------------|
| UserErrors | AWS/DynamoDB | TableName | Requests rejected due to throttling |
| SystemErrors | AWS/DynamoDB | TableName | Server-side errors |
| ConsumedReadCapacityUnits | AWS/DynamoDB | TableName | Read capacity consumed |
| ConsumedWriteCapacityUnits | AWS/DynamoDB | TableName | Write capacity consumed |

### API Gateway Metrics

| Metric | Namespace | Dimension | Description |
|--------|-----------|-----------|-------------|
| Count | AWS/ApiGateway | ApiName | Total API requests |
| 4XXError | AWS/ApiGateway | ApiName | Client-side errors |
| 5XXError | AWS/ApiGateway | ApiName | Server-side errors |
| Latency | AWS/ApiGateway | ApiName | Request latency in milliseconds |

## Support

For issues or questions:
1. Check error logs in CloudWatch
2. Review `TROUBLESHOOTING.md`
3. Consult `SRE_RUNBOOK.md` for incident response
4. Contact DevOps team

## Related Documentation

- [Phase 4 Analytics Guide](PHASE4_ANALYTICS_GUIDE.md)
- [SRE Runbook](../SRE_RUNBOOK.md)
- [Deployment Guide](PHASE4_DEPLOYMENT_INSTRUCTIONS.md)
- [API Reference](../API_REFERENCE.md)
