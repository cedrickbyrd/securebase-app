# Phase 3B Performance Operations Guide

Quick reference for monitoring and maintaining Phase 3B performance.

## 🚨 Quick Links

- **CloudWatch Dashboard**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-prod-phase3b-performance
- **Capacity Planning Doc**: `PHASE3B_CAPACITY_PLANNING.md`
- **Lambda Optimization Guide**: `phase2-backend/LAMBDA_OPTIMIZATION_GUIDE.md`

---

## 📊 Performance Targets (SLA)

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| API Latency (p95) | <500ms | >500ms | >1000ms |
| Success Rate | >99% | <99% | <95% |
| DynamoDB Throttles | 0/min | >1/min | >10/min |
| Lambda Errors | <1% | >1% | >5% |
| Page Load Time | <2s | >2s | >5s |

---

## 🔍 Daily Monitoring Checklist

### Morning Check (5 min)
```bash
# 1. Check CloudWatch dashboard
# Visit: https://console.aws.amazon.com/cloudwatch/home

# 2. Review yesterday's metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average,Maximum

# 3. Check for alarms
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --query 'MetricAlarms[*].[AlarmName,StateReason]' \
  --output table
```

### What to Look For
- ✅ All alarms in OK state
- ✅ API latency trending stable
- ✅ No DynamoDB throttling
- ✅ Success rate >99%

---

## 🚨 Incident Response

### High Latency (p95 >1s)

**Symptoms:**
- API Gateway latency >1s
- Customer complaints about slowness

**Troubleshooting:**
```bash
# 1. Check Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=securebase-prod-support-tickets \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,p95

# 2. Check DynamoDB performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name SuccessfulRequestLatency \
  --dimensions Name=TableName,Value=securebase-prod-support-tickets \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# 3. Check for errors in logs
aws logs tail /aws/lambda/securebase-prod-support-tickets --since 1h --filter-pattern "ERROR"
```

**Resolution:**
1. If Lambda cold starts high → Enable provisioned concurrency
2. If DynamoDB latency high → Increase RCU or add caching
3. If external API slow → Add timeout and retry logic

---

### DynamoDB Throttling

**Symptoms:**
- UserErrors metric > 0
- 400 errors in application logs
- "ProvisionedThroughputExceededException"

**Immediate Action:**
```bash
# Manually increase capacity (temporary)
aws dynamodb update-table \
  --table-name securebase-prod-support-tickets \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=100

# Verify auto-scaling is enabled
aws application-autoscaling describe-scalable-targets \
  --service-namespace dynamodb \
  --resource-ids table/securebase-prod-support-tickets
```

**Root Cause:**
- Traffic spike beyond auto-scaling speed
- Inefficient query patterns (scans instead of queries)
- Missing indexes

**Prevention:**
- Review query patterns weekly
- Ensure GSI for common filters
- Enable on-demand billing for unpredictable workloads

---

### Lambda Errors Spike

**Symptoms:**
- Error rate >5%
- 5XX responses from API Gateway

**Investigation:**
```bash
# Get error logs
aws logs tail /aws/lambda/securebase-prod-support-tickets \
  --since 1h \
  --filter-pattern "ERROR" \
  --format short

# Check specific error types
aws logs filter-log-events \
  --log-group-name /aws/lambda/securebase-prod-support-tickets \
  --start-time $(date -u -d '1 hour ago' +%s)000 \
  --filter-pattern "\"Task timed out\"" \
  --query 'events[*].message' \
  --output text
```

**Common Causes:**
1. **Timeout errors** → Increase Lambda timeout or optimize code
2. **Memory errors** → Increase Lambda memory
3. **Database connection errors** → Check connection pool settings
4. **External API failures** → Add retry logic and circuit breaker

---

## 📈 Performance Optimization Workflow

### When to Optimize

Trigger optimization when:
- [ ] p95 latency >500ms for 24 hours
- [ ] Cost per customer >$1/month
- [ ] DynamoDB throttling >10 events/day
- [ ] Lambda cold starts >20%

### Optimization Priority

1. **Quick Wins (1-2 days)**
   - Right-size Lambda memory
   - Add connection pooling
   - Enable API Gateway caching

2. **Medium Effort (1 week)**
   - Add DynamoDB indexes
   - Implement in-memory caching
   - Batch DynamoDB operations

3. **Large Projects (2+ weeks)**
   - Add ElastiCache layer
   - Multi-region deployment
   - Lambda provisioned concurrency

---

## 💰 Cost Monitoring

### Weekly Cost Review
```bash
# Get Lambda cost estimate
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d '7 days ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --filter file://lambda-filter.json

# DynamoDB cost
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d '7 days ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --filter file://dynamodb-filter.json
```

### Cost Optimization Checklist
- [ ] Review DynamoDB auto-scaling max limits
- [ ] Check for unused provisioned capacity
- [ ] Verify log retention settings (30 days dev, 90 days prod)
- [ ] Clean up old DynamoDB backups
- [ ] Review Lambda memory allocation vs usage

---

## 🧪 Load Testing Schedule

### Monthly Load Test
```bash
# Simulate 100 concurrent users for 5 minutes
python3 scripts/load-test.py \
  --users 100 \
  --duration 300 \
  --output monthly-load-test-$(date +%Y%m%d).json

# Compare against baseline
diff monthly-load-test-baseline.json monthly-load-test-$(date +%Y%m%d).json
```

### Quarterly Stress Test
```bash
# Simulate 500 concurrent users for 15 minutes
python3 scripts/load-test.py \
  --users 500 \
  --duration 900 \
  --output quarterly-stress-test-$(date +%Y%m%d).json
```

---

## 📋 Monthly Review Checklist

### Performance Review (1st of month)
- [ ] Review CloudWatch metrics from past 30 days
- [ ] Check p95 latency trends
- [ ] Analyze error rate patterns
- [ ] Review DynamoDB throttling incidents
- [ ] Update capacity projections

### Cost Review (1st of month)
- [ ] Compare actual vs projected costs
- [ ] Identify cost optimization opportunities
- [ ] Review resource utilization (over/under provisioned)
- [ ] Update budget forecasts

### Capacity Planning (1st of month)
- [ ] Review customer growth rate
- [ ] Project infrastructure needs for next quarter
- [ ] Plan scaling activities
- [ ] Budget for infrastructure expansion

---

## 🛠️ Useful Commands

### Performance Benchmarking
```bash
# Run quick benchmark
./scripts/performance-benchmark.sh

# Full load test (100 users, 5 min)
python3 scripts/load-test.py --users 100 --duration 300
```

### CloudWatch Queries
```bash
# Get p95 latency for last hour
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --statistics p95 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300

# Check error count
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --statistics Sum \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300
```

### DynamoDB Operations
```bash
# Describe table
aws dynamodb describe-table --table-name securebase-prod-support-tickets

# Check auto-scaling status
aws application-autoscaling describe-scaling-activities \
  --service-namespace dynamodb \
  --resource-id table/securebase-prod-support-tickets

# Update provisioned capacity (emergency)
aws dynamodb update-table \
  --table-name securebase-prod-support-tickets \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=100
```

---

## 📞 Escalation

### Performance Issues
- **Level 1**: On-call engineer (15 min SLA)
- **Level 2**: Infrastructure team lead (30 min SLA)
- **Level 3**: CTO (1 hour SLA)

### Contact
- On-call: PagerDuty alert
- Slack: #infrastructure-alerts
- Email: infrastructure@securebase.com

---

## 📚 Additional Resources

- Capacity Planning Guide: `PHASE3B_CAPACITY_PLANNING.md`
- Lambda Optimization: `phase2-backend/LAMBDA_OPTIMIZATION_GUIDE.md`
- DynamoDB Best Practices: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html
- Lambda Performance: https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html

---

**Last Updated:** January 22, 2026  
**Owner:** Infrastructure Team  
**Review Frequency:** Monthly
