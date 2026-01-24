# SecureBase Operations Dashboard Guide

**Version:** 1.0  
**Last Updated:** January 24, 2026  
**Audience:** DevOps Engineers, SREs, Operations Team

---

## Overview

This guide provides instructions for accessing and using the SecureBase operational dashboards in CloudWatch, along with key metrics to monitor and troubleshooting procedures.

## Dashboard Access

### CloudWatch Dashboards

All dashboards are located in AWS CloudWatch Console:

**Production Dashboards:**
```
# Performance Dashboard
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-prod-performance

# Uptime Dashboard
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-prod-uptime

# Phase 3B Performance
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-prod-phase3b-performance
```

**Staging Dashboards:**
```
# Performance Dashboard
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-staging-performance

# Uptime Dashboard
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-staging-uptime
```

## Dashboard Widgets

### Performance Dashboard

#### 1. API Gateway Latency
**What it shows:** Request latency (p50, p95, p99)

**Healthy:**
- p50 < 50ms
- p95 < 100ms
- p99 < 200ms

**Warning signs:**
- Gradual increase over time
- Spikes correlating with deployments
- p95 > 100ms for sustained period

**Actions:**
- Check ElastiCache hit rate
- Review slow Lambda functions
- Verify database query performance
- Check API Gateway throttling

#### 2. Lambda Duration
**What it shows:** Lambda execution time (avg, max, p95)

**Healthy:**
- Avg < 300ms
- p95 < 1000ms
- No timeouts

**Warning signs:**
- Increasing duration over time (memory leak?)
- Frequent timeouts
- High variation (cold starts?)

**Actions:**
- Check Lambda memory usage
- Review CloudWatch Insights for slow functions
- Enable X-Ray tracing
- Consider provisioned concurrency

#### 3. Lambda Concurrent Executions
**What it shows:** Number of Lambda functions running simultaneously

**Healthy:**
- Steady baseline
- Scales with traffic
- No throttling

**Warning signs:**
- Hitting account limit (1000 concurrent)
- Rapid spikes (DDoS?)
- Sustained high concurrency

**Actions:**
- Request AWS limit increase
- Check for infinite loops
- Review auto-scaling settings
- Investigate traffic source

#### 4. Lambda Errors & Throttles
**What it shows:** Error count and throttle events

**Healthy:**
- < 1% error rate
- Zero throttles

**Warning signs:**
- Sudden error spike
- Repeated throttling
- Pattern of errors (specific function?)

**Actions:**
- Check CloudWatch Logs for stack traces
- Review function code for bugs
- Increase reserved concurrency
- Check downstream service health

#### 5. DynamoDB Read/Write Latency
**What it shows:** Average and p95 latency for DynamoDB operations

**Healthy:**
- Read latency < 10ms
- Write latency < 20ms
- p95 < 100ms

**Warning signs:**
- Latency > 100ms
- Throttling detected
- Gradual increase over time

**Actions:**
- Check for hot partitions
- Review table capacity (on-demand vs provisioned)
- Verify GSI performance
- Consider caching frequently accessed data

#### 6. ElastiCache Performance
**What it shows:** Cache hit rate and misses

**Healthy:**
- Hit rate > 70%
- Steady cache usage
- Low eviction rate

**Warning signs:**
- Hit rate < 50%
- High eviction rate
- Memory usage > 85%

**Actions:**
- Review cache TTLs
- Increase node size
- Optimize cache keys
- Check for cache warming after deployments

#### 7. CloudFront Cache Statistics
**What it shows:** CDN cache hit rate and requests

**Healthy:**
- Hit rate > 80%
- Low error rate
- Fast edge response times

**Warning signs:**
- Hit rate < 50%
- High 4xx/5xx errors
- Slow edge latency

**Actions:**
- Review cache behaviors
- Check cache invalidation patterns
- Verify origin health
- Optimize cache TTLs

#### 8. Aurora Performance
**What it shows:** Database connections and CPU usage

**Healthy:**
- Connections < 100
- CPU < 60%
- No connection errors

**Warning signs:**
- Connection exhaustion
- CPU > 80%
- Slow query times

**Actions:**
- Implement RDS Proxy
- Review slow query log
- Add database indexes
- Consider Aurora auto-scaling

### Uptime Dashboard

#### 1. API Error Count (24h)
**What it shows:** Total 4xx and 5xx errors in last 24 hours

**Healthy:**
- 4xx < 1% of requests
- 5xx < 0.1% of requests

**Warning signs:**
- Sudden spike in errors
- Sustained elevated error rate
- Pattern of errors

**Actions:**
- Check API Gateway logs
- Review Lambda function errors
- Verify database connectivity
- Check third-party service status

#### 2. API Availability %
**What it shows:** Percentage of successful requests (non-5xx)

**Healthy:**
- > 99.95% (target)
- Steady over time

**Warning signs:**
- Drops below 99.9%
- Trending downward
- Sudden dip

**Actions:**
- Identify failing endpoints
- Check infrastructure health
- Review recent deployments
- Enable DR failover if needed

#### 3. Lambda Reliability
**What it shows:** Lambda errors and throttles over time

**Healthy:**
- Near-zero errors
- No throttles

**Warning signs:**
- Error clusters
- Repeated throttling
- Errors during specific time periods

**Actions:**
- Correlate with deployments
- Check for code bugs
- Review concurrency limits
- Investigate traffic patterns

## Key Metrics to Monitor

### Daily Checks (5 minutes)

**Morning Standup:**
1. Check Uptime Dashboard
   - API availability > 99.95%?
   - Any error spikes overnight?
   - Lambda reliability stable?

2. Review CloudWatch Alarms
   - Any alarms in ALARM state?
   - Clear false positives
   - Acknowledge known issues

3. Check Performance Dashboard
   - API latency within targets?
   - Cache hit rates healthy?
   - Database performance normal?

**Commands:**
```bash
# Check alarms
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --region us-east-1

# Get API error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 5XXError \
  --dimensions Name=ApiName,Value=securebase-api \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# Get cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHitRate \
  --dimensions Name=ReplicationGroupId,Value=securebase-prod-redis \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

### Weekly Reviews (30 minutes)

**Performance Review:**
1. Compare week-over-week metrics
2. Identify trends (improving/degrading)
3. Review slow queries
4. Check unused indexes
5. Review Lambda cold starts

**Capacity Planning:**
1. Check Lambda concurrency trends
2. Review database connection usage
3. Monitor cache memory usage
4. Assess API Gateway throttling
5. Review cost vs performance

**Commands:**
```bash
# Get slow Lambda functions (past week)
aws logs insights query \
  --log-group-name /aws/lambda/securebase-prod \
  --start-time $(date -u -d '7 days ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @duration, @requestId | filter @type="REPORT" and @duration > 1000 | sort @duration desc | limit 50'

# Get database slow queries
aws rds download-db-log-file-portion \
  --db-instance-identifier securebase-prod-instance-1 \
  --log-file-name error/postgresql.log.$(date +%Y-%m-%d) \
  --output text | grep 'duration'
```

### Monthly Reviews (2 hours)

**Full Performance Audit:**
1. Run load tests
2. Review all performance metrics
3. Analyze cost efficiency
4. Update capacity forecasts
5. Review and update alarms

**Documentation:**
1. Update runbooks
2. Document new metrics
3. Review oncall procedures
4. Update performance baselines

## CloudWatch Insights Queries

### Useful Queries

**1. Top 10 Slowest API Endpoints**
```
fields @timestamp, @message
| filter @type = "REPORT"
| parse @message /Duration: (?<duration>\d+\.\d+)/
| parse @message /path=(?<path>[^ ]+)/
| stats avg(duration) as avg_duration, pct(duration, 95) as p95 by path
| sort p95 desc
| limit 10
```

**2. Error Analysis**
```
fields @timestamp, @message
| filter @message like /ERROR|Exception|Failed/
| stats count() as error_count by bin(5m)
| sort @timestamp desc
```

**3. Cold Start Analysis**
```
fields @timestamp, @initDuration, @memorySize
| filter @type = "REPORT" and @initDuration > 0
| stats avg(@initDuration) as avg_cold_start, 
        pct(@initDuration, 95) as p95_cold_start,
        count() as cold_start_count by @memorySize
```

**4. Cache Effectiveness**
```
fields @timestamp, @message
| filter @message like /cache/
| parse @message /cache_hit=(?<hit>true|false)/
| stats count() as total, 
        sum(hit = 'true') as hits, 
        sum(hit = 'false') as misses,
        avg(hits / total * 100) as hit_rate by bin(5m)
```

**5. Authentication Failures**
```
fields @timestamp, @message
| filter @message like /authentication failed|invalid token/
| stats count() as auth_failures by bin(1h)
| sort @timestamp desc
```

## Alerts and Notifications

### Critical Alerts (PagerDuty)

**Triggers:**
- API availability < 99.9% for 5 minutes
- API p95 latency > 500ms for 5 minutes
- Database connection failures
- Lambda error rate > 5% for 5 minutes
- Multiple 5xx errors (>10 in 1 minute)

**Response:**
1. Acknowledge alert
2. Check dashboards
3. Identify root cause
4. Escalate if needed
5. Document incident

### Warning Alerts (Slack)

**Triggers:**
- API p95 latency > 100ms for 10 minutes
- Cache hit rate < 70% for 15 minutes
- Lambda throttles detected
- DynamoDB throttling
- Disk space > 80%

**Response:**
1. Review in next standup
2. Create ticket if persistent
3. Monitor for escalation

### Info Alerts (Email)

**Triggers:**
- Deployment started/completed
- Backup completed
- Scheduled maintenance
- Cost anomaly detected

**Response:**
- Review during weekly planning
- No immediate action needed

## Troubleshooting Workflows

### High Latency

**Symptoms:**
- API p95 > 100ms
- User complaints of slowness

**Diagnosis:**
1. Check Performance Dashboard
2. Identify slow component (API Gateway, Lambda, Database, Cache)
3. Use CloudWatch Insights to find slow requests
4. Enable X-Ray if not already enabled

**Resolution:**
- If Lambda: Increase memory, check code efficiency
- If Database: Add indexes, enable caching
- If Cache: Increase cache size, review TTLs
- If Network: Check VPC config, security groups

### High Error Rate

**Symptoms:**
- 5xx errors > 1%
- Alarm triggered

**Diagnosis:**
1. Check Uptime Dashboard
2. Review Lambda errors in CloudWatch Logs
3. Check database connectivity
4. Review recent deployments

**Resolution:**
- If code bug: Rollback deployment
- If database: Check connections, restart if needed
- If third-party: Enable circuit breaker, fallback
- If DDoS: Enable WAF, rate limiting

### Connection Exhaustion

**Symptoms:**
- "Too many connections" errors
- Lambda timeouts

**Diagnosis:**
1. Check Aurora connections metric
2. Review Lambda concurrent executions
3. Check connection pool settings

**Resolution:**
1. Implement RDS Proxy
2. Reduce Lambda timeout (force connection release)
3. Increase max_connections parameter
4. Add connection pooling in Lambda

## Dashboard Customization

### Adding Custom Metrics

**1. Publish from Lambda:**
```python
import boto3

cloudwatch = boto3.client('cloudwatch')

cloudwatch.put_metric_data(
    Namespace='SecureBase/Custom',
    MetricData=[{
        'MetricName': 'BusinessMetric',
        'Value': 123.45,
        'Unit': 'Count',
        'Dimensions': [
            {'Name': 'Environment', 'Value': 'prod'},
            {'Name': 'Function', 'Value': 'billing'}
        ]
    }]
)
```

**2. Add to Dashboard:**
```bash
# Export current dashboard
aws cloudwatch get-dashboard \
  --dashboard-name securebase-prod-performance \
  > dashboard.json

# Edit dashboard.json to add widget
# Import updated dashboard
aws cloudwatch put-dashboard \
  --dashboard-name securebase-prod-performance \
  --dashboard-body file://dashboard.json
```

### Creating Composite Alarms

**Example: API Availability Composite**
```bash
aws cloudwatch put-composite-alarm \
  --alarm-name securebase-prod-api-degraded \
  --alarm-description "API degraded (high latency OR high errors)" \
  --alarm-rule "ALARM(securebase-prod-api-latency-p95-high) OR ALARM(securebase-prod-api-5xx-errors)" \
  --actions-enabled \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:critical-alerts
```

## Best Practices

1. **Check dashboards daily** - 5 minute morning standup
2. **Set realistic thresholds** - Based on actual traffic patterns
3. **Document baselines** - Know your normal performance
4. **Review alarms weekly** - Tune to reduce noise
5. **Correlate metrics** - Don't look at metrics in isolation
6. **Use CloudWatch Insights** - For deep dive analysis
7. **Enable X-Ray tracing** - For performance troubleshooting
8. **Keep dashboards updated** - Add new services as deployed
9. **Train team members** - Everyone should know dashboards
10. **Document common issues** - Build runbooks for recurring problems

## Additional Resources

- [CloudWatch User Guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/)
- [Performance Tuning Guide](./PERFORMANCE_TUNING_GUIDE.md)
- [DR & Backup Procedures](./DR_BACKUP_PROCEDURES.md)
- [On-Call Runbook](./ONCALL_RUNBOOK.md) (to be created)

---

**Document Version:** 1.0  
**Last Updated:** January 24, 2026  
**Next Review:** February 24, 2026
