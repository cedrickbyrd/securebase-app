# SRE Runbook - SecureBase Operations Guide

**Version:** 1.0  
**Last Updated:** January 26, 2026  
**Owner:** SRE Team  
**Status:** Active

---

## Table of Contents

1. [Overview](#overview)
2. [Dashboard Access](#dashboard-access)
3. [On-Call Procedures](#on-call-procedures)
4. [Alert Response Workflows](#alert-response-workflows)
5. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
6. [Escalation Procedures](#escalation-procedures)
7. [Incident Management](#incident-management)
8. [Runbook Index](#runbook-index)
9. [Emergency Contacts](#emergency-contacts)

---

## Overview

This runbook provides on-call engineers with procedures for responding to alerts, troubleshooting infrastructure issues, and managing incidents in the SecureBase platform.

### Platform Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SecureBase Platform                       │
├─────────────────────────────────────────────────────────────┤
│  CloudFront → API Gateway → Lambda → Aurora/DynamoDB        │
│                          ↓                                   │
│                    ElastiCache (Redis)                       │
│                          ↓                                   │
│              CloudWatch + X-Ray Monitoring                   │
└─────────────────────────────────────────────────────────────┘
```

### SLA Targets

- **Uptime:** 99.95% (4.4 hours downtime/year)
- **API Latency (p95):** <500ms
- **Error Rate:** <1%
- **RTO (Recovery Time Objective):** <15 minutes
- **RPO (Recovery Point Objective):** <1 minute

---

## Dashboard Access

### SRE Operations Dashboard

**URL:** https://portal.securebase.example.com/sre-dashboard

**Features:**
- Infrastructure health (CPU, memory, disk, network)
- Deployment pipeline status
- Auto-scaling metrics
- Database performance (Aurora, DynamoDB)
- Cache hit rates (Redis)
- Error rates by service
- Lambda performance metrics
- Cost per service

**Refresh Rate:** 30 seconds (auto-refresh)

### Alert Management

**URL:** https://portal.securebase.example.com/alerts

**Features:**
- Real-time alert monitoring
- Alert acknowledgment and resolution
- Incident tracking
- Runbook links
- PagerDuty integration

### CloudWatch Dashboards

**Primary Dashboard:** SecureBase-SRE-Dashboard  
**Access:** AWS Console → CloudWatch → Dashboards

**Key Metrics:**
- Lambda concurrency and duration
- Aurora database connections and latency
- DynamoDB capacity and throttling
- API Gateway requests and errors
- ElastiCache hit rate and memory
- EC2 infrastructure metrics
- Estimated billing

---

## On-Call Procedures

### Daily Responsibilities

1. **Morning Check (9:00 AM)**
   - Review SRE dashboard for overnight alerts
   - Check deployment pipeline status
   - Review error rate trends
   - Verify backup completion

2. **Continuous Monitoring**
   - Respond to PagerDuty alerts within 5 minutes
   - Monitor Slack #sre-alerts channel
   - Review CloudWatch alarms

3. **End of Day (5:00 PM)**
   - Document any incidents or changes
   - Update incident tickets
   - Handoff notes to next on-call engineer

### Handoff Checklist

- [ ] Review open incidents
- [ ] Check for scheduled maintenance
- [ ] Verify backup status
- [ ] Review recent deployments
- [ ] Update incident log
- [ ] Brief next on-call engineer

---

## Alert Response Workflows

### Alert Severity Levels

| Severity | Response Time | Escalation |
|----------|--------------|------------|
| **Critical** | Immediate (<5 min) | Escalate after 15 min |
| **High** | <15 minutes | Escalate after 30 min |
| **Medium** | <1 hour | Escalate after 2 hours |
| **Low** | <4 hours | No auto-escalation |
| **Info** | Next business day | No escalation |

### General Response Flow

```
Alert Triggered → Acknowledge → Investigate → Mitigate → Resolve → Document
```

1. **Acknowledge** the alert in PagerDuty/Alert Management UI
2. **Review** alert details and affected resources
3. **Check** SRE dashboard for related metrics
4. **Follow** appropriate runbook (see index below)
5. **Mitigate** the issue using documented procedures
6. **Escalate** if unresolved within SLA
7. **Resolve** alert once issue is fixed
8. **Document** resolution and learnings

---

## Common Issues & Troubleshooting

### High CPU Usage on Lambda

**Alert:** "High CPU usage on Lambda function: {function-name}"

**Symptoms:**
- CPU utilization >85%
- Increased duration
- Potential throttling

**Runbook:**

1. **Check Lambda metrics:**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Duration \
     --dimensions Name=FunctionName,Value=auth-v2 \
     --start-time 2026-01-26T00:00:00Z \
     --end-time 2026-01-26T23:59:59Z \
     --period 300 \
     --statistics Average,Maximum
   ```

2. **Review X-Ray traces:**
   - Open X-Ray console
   - Filter by function name
   - Identify slow operations

3. **Check for infinite loops or memory leaks:**
   - Review CloudWatch Logs
   - Look for repeated error messages
   - Check memory usage trend

4. **Mitigation:**
   - Increase Lambda memory (scales CPU proportionally)
   - Optimize function code
   - Add caching for expensive operations
   - Consider breaking into smaller functions

5. **Escalate if:**
   - Issue persists after optimization
   - Affects multiple functions
   - Causes service degradation

---

### Aurora Database Connection Pool Nearing Capacity

**Alert:** "Aurora database connection pool nearing capacity"

**Symptoms:**
- Connection count >80% of max
- Connection timeout errors
- Increased query latency

**Runbook:**

1. **Check current connections:**
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   SELECT usename, application_name, state, count(*)
   FROM pg_stat_activity
   GROUP BY usename, application_name, state;
   ```

2. **Identify long-running queries:**
   ```sql
   SELECT pid, usename, application_name, state, query_start, query
   FROM pg_stat_activity
   WHERE state != 'idle'
   AND query_start < NOW() - INTERVAL '5 minutes'
   ORDER BY query_start;
   ```

3. **Kill problematic connections (if necessary):**
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE pid = <problem_pid>;
   ```

4. **Review connection pooling:**
   - Check Lambda function timeout settings
   - Verify connection reuse in application code
   - Review RDS Proxy configuration

5. **Mitigation:**
   - Increase max_connections parameter
   - Implement RDS Proxy for connection pooling
   - Optimize Lambda function connection handling
   - Add connection cleanup in error handlers

6. **Escalate if:**
   - Database becomes unresponsive
   - Connection errors affect multiple services
   - Replication lag increases

---

### DynamoDB Write Throttling

**Alert:** "DynamoDB write throttling detected"

**Symptoms:**
- Write capacity exceeded
- ProvisionedThroughputExceededException errors
- Increased latency

**Runbook:**

1. **Check current capacity:**
   ```bash
   aws dynamodb describe-table \
     --table-name customer_metrics \
     --query 'Table.[ProvisionedThroughput,BillingModeSummary]'
   ```

2. **Review throttled requests:**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/DynamoDB \
     --metric-name UserErrors \
     --dimensions Name=TableName,Value=customer_metrics \
     --start-time 2026-01-26T00:00:00Z \
     --end-time 2026-01-26T23:59:59Z \
     --period 300 \
     --statistics Sum
   ```

3. **Identify write patterns:**
   - Check for batch write operations
   - Review Lambda function logs
   - Identify hot partition keys

4. **Mitigation:**
   - Increase write capacity units (if provisioned mode)
   - Switch to on-demand billing mode
   - Implement exponential backoff in application
   - Distribute writes across partition keys
   - Use batch write operations efficiently

5. **Escalate if:**
   - Throttling persists after capacity increase
   - Affects critical business operations
   - Requires table redesign

---

### API Gateway Error Rate Spike

**Alert:** "API Gateway error rate spike"

**Symptoms:**
- 5xx errors >1%
- Client complaints
- Increased latency

**Runbook:**

1. **Check error distribution:**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/ApiGateway \
     --metric-name 5XXError \
     --dimensions Name=ApiName,Value=securebase-api \
     --start-time 2026-01-26T00:00:00Z \
     --end-time 2026-01-26T23:59:59Z \
     --period 300 \
     --statistics Sum
   ```

2. **Review API Gateway logs:**
   - Check CloudWatch Logs Insights
   - Filter by error status codes
   - Identify affected endpoints

3. **Check backend health:**
   - Verify Lambda function health
   - Check Aurora database status
   - Review DynamoDB metrics

4. **Mitigation:**
   - Identify root cause (Lambda, database, timeout)
   - Increase Lambda timeout if needed
   - Scale backend resources
   - Implement circuit breakers
   - Add retry logic with backoff

5. **Escalate if:**
   - Error rate >5%
   - Multiple endpoints affected
   - Backend services unavailable

---

### Lambda Cold Starts Increased

**Alert:** "Lambda cold starts increased"

**Symptoms:**
- Cold start percentage >3%
- First request latency high
- Intermittent slow responses

**Runbook:**

1. **Check cold start metrics:**
   - Review X-Ray service map
   - Check Init Duration in CloudWatch Logs
   - Identify affected functions

2. **Review provisioned concurrency:**
   ```bash
   aws lambda get-provisioned-concurrency-config \
     --function-name auth-v2 \
     --qualifier PROD
   ```

3. **Mitigation:**
   - Enable provisioned concurrency for critical functions
   - Reduce Lambda package size
   - Optimize import statements (lazy loading)
   - Use Lambda layers for dependencies
   - Keep functions warm with CloudWatch Events

4. **Escalate if:**
   - Cold starts affect critical user flows
   - Provisioned concurrency doesn't help
   - Requires architecture changes

---

### ElastiCache Memory Usage High

**Alert:** "ElastiCache memory usage high"

**Symptoms:**
- Memory usage >80%
- Evictions increasing
- Cache miss rate increasing

**Runbook:**

1. **Check cache metrics:**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/ElastiCache \
     --metric-name DatabaseMemoryUsagePercentage \
     --dimensions Name=CacheClusterId,Value=redis-cluster \
     --start-time 2026-01-26T00:00:00Z \
     --end-time 2026-01-26T23:59:59Z \
     --period 300 \
     --statistics Average,Maximum
   ```

2. **Review eviction stats:**
   - Check eviction count
   - Review cache key patterns
   - Identify large keys

3. **Connect to Redis:**
   ```bash
   redis-cli -h redis-cluster.xxxxx.cache.amazonaws.com -p 6379
   INFO memory
   INFO stats
   ```

4. **Mitigation:**
   - Review TTL settings
   - Implement LRU eviction policy
   - Scale up instance type
   - Add more cache nodes
   - Optimize cached data size

5. **Escalate if:**
   - Memory usage continues to grow
   - Evictions affect performance
   - Requires architecture review

---

### Deployment Pipeline Failure

**Alert:** "Deployment pipeline failure: {service}"

**Symptoms:**
- Build/deploy step failed
- Service not updated
- Rollback may be needed

**Runbook:**

1. **Check pipeline status:**
   ```bash
   aws codepipeline get-pipeline-state \
     --name securebase-frontend-pipeline
   ```

2. **Review failed stage logs:**
   - Open CodePipeline console
   - Check failed stage details
   - Review build logs in CodeBuild

3. **Common failure causes:**
   - Dependency conflicts
   - Syntax errors
   - Test failures
   - Terraform apply errors
   - Permission issues

4. **Mitigation:**
   - Fix identified issue in code
   - Retry pipeline execution
   - Rollback to previous version if critical
   - Update dependencies if needed

5. **Escalate if:**
   - Critical service deployment blocked
   - Requires code changes
   - Affects production availability

---

## Escalation Procedures

### Escalation Levels

**Level 0: On-Call SRE**
- Initial alert response
- Standard troubleshooting
- Follow runbooks

**Level 1: Senior SRE**
- Escalate after 15-30 minutes (based on severity)
- Complex troubleshooting required
- Multiple services affected

**Level 2: Engineering Manager**
- Escalate after 1 hour
- Service outage
- Customer impact
- Requires coordination

**Level 3: Director/VP Engineering**
- Major outage (>1 hour)
- Data loss risk
- Security incident
- Press/legal involvement

### Escalation Matrix

| Alert Severity | Initial Response | Level 1 | Level 2 | Level 3 |
|----------------|------------------|---------|---------|---------|
| Critical | Immediate | 15 min | 30 min | 1 hour |
| High | 15 min | 30 min | 1 hour | 2 hours |
| Medium | 1 hour | 2 hours | 4 hours | N/A |
| Low | 4 hours | 8 hours | N/A | N/A |

### PagerDuty Escalation

PagerDuty automatically escalates based on:
- Time since alert triggered
- No acknowledgment within SLA
- Alert severity

**Override:** Manually escalate in PagerDuty if needed

---

## Incident Management

### Incident Lifecycle

1. **Detection** - Alert triggered
2. **Triage** - Assess severity and impact
3. **Investigation** - Root cause analysis
4. **Mitigation** - Temporary fix to restore service
5. **Resolution** - Permanent fix applied
6. **Post-Mortem** - Document learnings

### Incident Severity

**SEV-1 (Critical)**
- Complete service outage
- Data loss
- Security breach
- Response: All hands on deck

**SEV-2 (High)**
- Partial service degradation
- Major feature unavailable
- Affects >50% of users
- Response: Dedicated incident team

**SEV-3 (Medium)**
- Minor service degradation
- Workaround available
- Affects <50% of users
- Response: Single SRE with support

**SEV-4 (Low)**
- No user impact
- Internal tool issue
- Cosmetic bug
- Response: Standard on-call

### Incident Communication

**Slack Channels:**
- `#sre-alerts` - Real-time alerts
- `#incidents` - Active incident updates
- `#postmortems` - Post-incident reviews

**Status Page:**
- Update status.securebase.com
- Post incident updates
- Notify affected customers

**Email:**
- Use incident@securebase.com
- Include stakeholders
- Provide regular updates (every 30 min for SEV-1/2)

### Post-Mortem Template

```markdown
# Incident Post-Mortem: [Title]

**Incident ID:** INC-2026-XXX
**Date:** YYYY-MM-DD
**Duration:** X hours Y minutes
**Severity:** SEV-X
**Participants:** [Names]

## Summary
[Brief description of what happened]

## Timeline
- HH:MM - Event 1
- HH:MM - Event 2
- HH:MM - Resolution

## Root Cause
[What caused the incident]

## Impact
- Users affected: X
- Services affected: Y
- Revenue impact: $Z

## Resolution
[How it was fixed]

## Action Items
- [ ] Action 1 (Owner: Name, Due: Date)
- [ ] Action 2 (Owner: Name, Due: Date)

## Lessons Learned
[What we learned and how to prevent]
```

---

## Runbook Index

### Infrastructure

- [High CPU on Lambda](/runbooks/high-cpu-lambda)
- [High Memory on EC2](/runbooks/high-memory-ec2)
- [Disk Space Alert](/runbooks/disk-space)
- [Network Throttling](/runbooks/network-throttling)

### Database

- [Aurora Connection Pool](/runbooks/aurora-connections)
- [Aurora Replication Lag](/runbooks/aurora-replication-lag)
- [DynamoDB Throttling](/runbooks/dynamodb-throttling)
- [Database Backup Failure](/runbooks/database-backup-failure)

### Cache

- [ElastiCache Memory High](/runbooks/cache-memory)
- [Cache Hit Rate Low](/runbooks/cache-hit-rate)
- [Cache Cluster Down](/runbooks/cache-cluster-down)

### API & Lambda

- [API Error Rate Spike](/runbooks/api-errors)
- [Lambda Throttling](/runbooks/lambda-throttling)
- [Lambda Cold Starts](/runbooks/lambda-cold-starts)
- [API Gateway Timeout](/runbooks/api-timeout)

### Deployment

- [Pipeline Failure](/runbooks/pipeline-failures)
- [Rollback Procedure](/runbooks/rollback)
- [Terraform Apply Failed](/runbooks/terraform-failed)

### Security

- [Security Alert Response](/runbooks/security-alert)
- [IAM Permission Denied](/runbooks/iam-denied)
- [Unusual API Activity](/runbooks/unusual-activity)

### Monitoring

- [CloudWatch Agent Down](/runbooks/cloudwatch-agent)
- [X-Ray Trace Gaps](/runbooks/xray-gaps)
- [Alert Not Firing](/runbooks/alert-not-firing)

---

## Emergency Contacts

### On-Call Rotation

**Primary:** Check PagerDuty for current on-call  
**Secondary:** Check PagerDuty for backup on-call

### Key Contacts

**SRE Team Lead**
- Name: John Doe
- Email: john.doe@securebase.com
- Phone: +1-555-0100
- Slack: @john.doe

**Engineering Manager**
- Name: Jane Smith
- Email: jane.smith@securebase.com
- Phone: +1-555-0101
- Slack: @jane.smith

**Director of Engineering**
- Name: Bob Johnson
- Email: bob.johnson@securebase.com
- Phone: +1-555-0102
- Slack: @bob.johnson

**Security Team**
- Email: security@securebase.com
- Phone: +1-555-0200
- Slack: #security

**Database Team**
- Email: dba@securebase.com
- Phone: +1-555-0300
- Slack: #database

### Vendor Support

**AWS Support**
- Account: Enterprise
- Phone: +1-800-AWS-HELP
- Portal: https://console.aws.amazon.com/support

**PagerDuty Support**
- Email: support@pagerduty.com
- Phone: +1-844-700-DUTY

---

## Appendix

### Useful Commands

**CloudWatch Logs Insights Queries:**

```sql
-- Find Lambda errors
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 20

-- API Gateway 5xx errors
fields @timestamp, status, method, path
| filter status >= 500
| stats count() by status, path
| sort count desc

-- Slow database queries
fields @timestamp, query, duration
| filter duration > 1000
| sort duration desc
| limit 10
```

**AWS CLI Common Commands:**

```bash
# List all running Lambda functions
aws lambda list-functions --query 'Functions[*].[FunctionName,Runtime,LastModified]' --output table

# Check RDS instance status
aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus,Engine]' --output table

# Get DynamoDB table metrics
aws dynamodb describe-table --table-name customer_metrics --query 'Table.[TableStatus,ItemCount,TableSizeBytes]'

# List CloudWatch alarms in alarm state
aws cloudwatch describe-alarms --state-value ALARM --query 'MetricAlarms[*].[AlarmName,StateReason]' --output table
```

### Monitoring URLs

- **SRE Dashboard:** https://portal.securebase.com/sre-dashboard
- **Alert Management:** https://portal.securebase.com/alerts
- **CloudWatch Console:** https://console.aws.amazon.com/cloudwatch
- **X-Ray Console:** https://console.aws.amazon.com/xray
- **PagerDuty:** https://securebase.pagerduty.com
- **Status Page:** https://status.securebase.com

---

**Document Maintenance:**
- Review quarterly
- Update after major incidents
- Add new runbooks as needed
- Archive outdated procedures

**Last Review:** January 26, 2026  
**Next Review:** April 26, 2026
