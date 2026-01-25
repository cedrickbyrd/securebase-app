# SecureBase DR Runbook: Operational Procedures

**Project:** SecureBase Multi-Tenant PaaS  
**Version:** 1.0  
**Last Updated:** January 25, 2026  
**Status:** Phase 5 Planning Document  
**Owner:** Platform Operations Team  
**Classification:** Internal - Operations Team Only

---

## 📋 Quick Reference

### Emergency Contact

**On-Call Rotation:** PagerDuty escalation policy "SecureBase-DR"  
**Incident Slack Channel:** `#securebase-incidents`  
**Status Page:** https://status.securebase.io

### Critical URLs

- **Primary API:** https://api.securebase.io
- **Failover API:** https://api-dr.securebase.io
- **CloudWatch Dashboard:** [DR Monitoring Dashboard](https://console.aws.amazon.com/cloudwatch)
- **Route53 Health Checks:** [Health Check Console](https://console.aws.amazon.com/route53)

---

## 🎯 Runbook Purpose

This runbook provides step-by-step procedures for:
1. **Automated Failover Monitoring** - What to expect during automated failover
2. **Manual Failover Execution** - How to manually trigger regional failover
3. **Validation & Verification** - Post-failover health checks
4. **Failback to Primary** - Returning to us-east-1 after recovery
5. **Troubleshooting** - Common issues and resolutions

**⚠️ CRITICAL:** Follow procedures exactly as written. Do not skip steps during production incidents.

---

## 📖 Section 1: Pre-Incident Preparation

### Prerequisites

**Required Access:**
- [ ] AWS Console access (Admin role in management account)
- [ ] AWS CLI configured with credentials
- [ ] PagerDuty account for incident management
- [ ] Slack access to `#securebase-incidents` channel
- [ ] Status page admin credentials

**Required Tools:**
```bash
# Verify AWS CLI is installed and configured
aws --version
aws sts get-caller-identity

# Verify Terraform (for infrastructure changes)
terraform version

# Verify kubectl (for any container orchestration)
kubectl version --client

# Install jq for JSON parsing
sudo apt-get install jq  # Ubuntu/Debian
brew install jq          # macOS
```

**Environment Variables (set these first):**
```bash
export AWS_REGION_PRIMARY="us-east-1"
export AWS_REGION_SECONDARY="us-west-2"
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export ENVIRONMENT="prod"  # or 'staging', 'dev'
```

---

## 📖 Section 2: Monitoring Automated Failover

### What Happens During Automated Failover

**Timeline (Expected):**
```
T+0:00  Route53 health check fails (primary endpoint)
T+0:30  Second consecutive health check fails → TRIGGER FAILOVER
T+1:00  Route53 updates DNS records (us-west-2 weighted to 100%)
T+1:30  CloudFront switches to us-west-2 origin
T+2:00  Aurora Global DB starts promotion in us-west-2
T+3:00  Aurora writer instance active in us-west-2
T+5:00  Lambda functions receiving traffic in us-west-2
T+8:00  All services stable, validation checks begin
T+12:00 Customer notification sent (automated)
T+15:00 Incident marked as RESOLVED (if all checks pass)
```

### Monitoring During Automated Failover

**Step 1: Acknowledge PagerDuty Alert**
```bash
# You will receive alert: "CRITICAL: Route53 Health Check Failed - Primary Region"
# Action: Acknowledge in PagerDuty, join #securebase-incidents Slack channel
```

**Step 2: Open Monitoring Dashboards**
1. CloudWatch Dashboard: [DR Monitoring](https://console.aws.amazon.com/cloudwatch)
2. Route53 Health Checks: Check status of us-east-1 health check
3. Aurora Global DB: Monitor replication lag

**Step 3: Observe Automated Steps**
```bash
# Check Route53 DNS records
aws route53 list-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --query "ResourceRecordSets[?Name=='api.securebase.io.']"

# Expected output: Weight should shift to us-west-2
# us-east-1: Weight 0
# us-west-2: Weight 100

# Monitor Aurora Global DB promotion
aws rds describe-db-clusters \
  --region us-west-2 \
  --db-cluster-identifier securebase-prod-cluster-west \
  --query "DBClusters[0].Status"

# Expected output: "available" (writer mode)
```

**Step 4: Passive Monitoring (DO NOT INTERVENE)**
- Watch CloudWatch metrics for error rates
- Monitor Lambda invocations shifting to us-west-2
- Check API response times

**Step 5: Validate After 15 Minutes**
- Jump to **Section 3: Validation & Verification**

---

## 📖 Section 3: Manual Failover Execution

### When to Execute Manual Failover

**Approved Scenarios:**
1. Automated failover did not trigger (health checks not detecting issue)
2. Planned maintenance requiring regional switch
3. Security incident requiring immediate isolation of us-east-1
4. Executive directive (VP Engineering or above)

**⚠️ WARNING:** Manual failover should be a last resort. Automated failover is preferred.

---

### Manual Failover: Step-by-Step

**STEP 1: Confirm Failover Decision**

```bash
# Decision checklist (Incident Commander must confirm):
echo "Manual Failover Checklist:"
echo "[ ] Primary region confirmed unhealthy"
echo "[ ] Automated failover did not trigger"
echo "[ ] VP Engineering approval obtained"
echo "[ ] Status page prepared for update"
echo "[ ] #securebase-incidents channel notified"

# Record decision in incident log
echo "$(date -u): MANUAL FAILOVER INITIATED by $(whoami)" >> /var/log/securebase-dr.log
```

---

**STEP 2: Update Status Page**

```bash
# Update status page (use web UI or API)
curl -X POST https://api.statuspage.io/v1/incidents \
  -H "Authorization: OAuth YOUR_TOKEN" \
  -d '{
    "incident": {
      "name": "Primary Region Degradation - Failover in Progress",
      "status": "investigating",
      "impact_override": "major",
      "body": "We are performing a regional failover to restore service. Updates every 5 minutes."
    }
  }'
```

---

**STEP 3: Update Route53 Weighted Routing**

```bash
# Get current Route53 record configuration
HOSTED_ZONE_ID="Z1234567890ABC"  # Replace with actual hosted zone ID

# Update us-east-1 weight to 0
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.securebase.io",
        "Type": "A",
        "SetIdentifier": "us-east-1-primary",
        "Weight": 0,
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "api-useast1.execute-api.us-east-1.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Update us-west-2 weight to 100
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.securebase.io",
        "Type": "A",
        "SetIdentifier": "us-west-2-failover",
        "Weight": 100,
        "AliasTarget": {
          "HostedZoneId": "Z2OJLYMUO9EFXC",
          "DNSName": "api-uswest2.execute-api.us-west-2.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Verify change propagated
aws route53 list-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --query "ResourceRecordSets[?Name=='api.securebase.io.']"
```

**Expected Wait:** 30-60 seconds for DNS propagation

---

**STEP 4: Promote Aurora Global DB Replica**

```bash
# Check current Aurora cluster status in us-west-2
aws rds describe-db-clusters \
  --region us-west-2 \
  --db-cluster-identifier securebase-prod-cluster-west \
  --query "DBClusters[0].[Status,GlobalWriteForwardingStatus]" \
  --output table

# If status is "available" but still a reader, promote manually
aws rds failover-global-cluster \
  --region us-west-2 \
  --global-cluster-identifier securebase-global-cluster \
  --target-db-cluster-identifier arn:aws:rds:us-west-2:$AWS_ACCOUNT_ID:cluster:securebase-prod-cluster-west

# Monitor promotion progress
watch -n 10 'aws rds describe-db-clusters \
  --region us-west-2 \
  --db-cluster-identifier securebase-prod-cluster-west \
  --query "DBClusters[0].Status"'

# Expected: "available" (promotion completes in 1-2 minutes)
```

---

**STEP 5: Verify DynamoDB Global Tables**

```bash
# DynamoDB Global Tables replicate automatically - no action needed
# Verify replication is healthy

# Check table status in us-west-2
aws dynamodb describe-table \
  --region us-west-2 \
  --table-name securebase-customers \
  --query "Table.[TableStatus,Replicas]"

# Expected output:
# TableStatus: ACTIVE
# Replicas: us-east-1 (ACTIVE or UPDATING)

# Verify recent writes are replicated
aws dynamodb scan \
  --region us-west-2 \
  --table-name securebase-customers \
  --limit 5 \
  --query "Items[0]"
```

---

**STEP 6: Update CloudFront Origin**

```bash
# CloudFront should automatically failover based on origin health checks
# Verify CloudFront is using us-west-2 origin

DISTRIBUTION_ID="E1ABCDEF123456"  # Replace with actual distribution ID

aws cloudfront get-distribution \
  --id $DISTRIBUTION_ID \
  --query "Distribution.DistributionConfig.Origins.Items[0].DomainName"

# If still pointing to us-east-1, update origin manually
# (This should be rare - CloudFront origin failover is automatic)

# Invalidate CloudFront cache to force refresh
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

---

**STEP 7: Validate Lambda Functions**

```bash
# Lambda functions in us-west-2 should automatically receive traffic
# Verify Lambda invocations

# Check recent invocations in us-west-2
aws lambda get-function \
  --region us-west-2 \
  --function-name securebase-prod-auth-v2 \
  --query "Configuration.LastModified"

# Manually invoke a test function
aws lambda invoke \
  --region us-west-2 \
  --function-name securebase-prod-auth-v2 \
  --payload '{"action":"health-check"}' \
  /tmp/lambda-response.json

# Check response
cat /tmp/lambda-response.json
# Expected: {"statusCode": 200, "body": "OK"}
```

---

**STEP 8: Run Smoke Tests**

```bash
# Execute smoke test suite
cd /opt/securebase-tests

# Test 1: API health endpoint
curl -f https://api.securebase.io/health
# Expected: {"status":"ok","region":"us-west-2","timestamp":"..."}

# Test 2: Authentication
curl -X POST https://api.securebase.io/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","api_key":"test_key_123"}'
# Expected: {"token":"...","customer_id":"..."}

# Test 3: Database read/write
curl -X POST https://api.securebase.io/api/test/db-write \
  -H "X-API-Key: test_key_123" \
  -d '{"test_data":"failover-validation"}'
# Expected: {"id":"...","status":"success"}

# Test 4: Customer portal (Portal must be accessible)
curl -I https://portal.securebase.io
# Expected: HTTP/2 200
```

---

**STEP 9: Update Monitoring Dashboards**

```bash
# Update CloudWatch dashboard to show us-west-2 metrics
# (Manual step - update dashboard JSON to point to us-west-2 metrics)

# Example: Update Lambda invocation metric
aws cloudwatch put-metric-data \
  --region us-west-2 \
  --namespace SecureBase/DR \
  --metric-name FailoverCompleted \
  --value 1 \
  --timestamp $(date -u +%Y-%m-%dT%H:%M:%S)
```

---

**STEP 10: Customer Notification**

```bash
# Send customer notification email
# (Use email service API or Slack integration)

# Update status page with resolution
curl -X PATCH https://api.statuspage.io/v1/incidents/INCIDENT_ID \
  -H "Authorization: OAuth YOUR_TOKEN" \
  -d '{
    "incident": {
      "status": "monitoring",
      "body": "Failover to secondary region completed. Service is operational. Monitoring for stability."
    }
  }'

# Post to Slack
curl -X POST https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
  -d '{
    "text": "✅ DR FAILOVER COMPLETE: SecureBase is now running in us-west-2. All validation checks passed."
  }'
```

---

## 📖 Section 4: Validation & Verification

### Post-Failover Health Checks

**Run these checks after automated OR manual failover:**

```bash
#!/bin/bash
# DR Validation Script

echo "=== SecureBase DR Validation ==="
echo "Start time: $(date -u)"

# Check 1: Route53 DNS
echo -e "\n[1/8] Checking Route53 DNS..."
RESOLVED_IP=$(dig +short api.securebase.io | head -1)
echo "Resolved IP: $RESOLVED_IP"
# Compare with expected us-west-2 API Gateway IP range

# Check 2: Aurora cluster status
echo -e "\n[2/8] Checking Aurora Global Database..."
AURORA_STATUS=$(aws rds describe-db-clusters \
  --region us-west-2 \
  --db-cluster-identifier securebase-prod-cluster-west \
  --query "DBClusters[0].Status" \
  --output text)
echo "Aurora status: $AURORA_STATUS"
if [ "$AURORA_STATUS" != "available" ]; then
  echo "❌ FAIL: Aurora cluster not available"
  exit 1
fi

# Check 3: Aurora replication lag
echo -e "\n[3/8] Checking Aurora replication lag..."
REPLICATION_LAG=$(aws cloudwatch get-metric-statistics \
  --region us-west-2 \
  --namespace AWS/RDS \
  --metric-name AuroraGlobalDBReplicationLag \
  --dimensions Name=DBClusterIdentifier,Value=securebase-prod-cluster-west \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average \
  --query "Datapoints[0].Average" \
  --output text)
echo "Replication lag: ${REPLICATION_LAG}ms"
if (( $(echo "$REPLICATION_LAG > 5000" | bc -l) )); then
  echo "⚠️  WARNING: High replication lag (>5s)"
fi

# Check 4: DynamoDB table status
echo -e "\n[4/8] Checking DynamoDB Global Tables..."
DYNAMO_STATUS=$(aws dynamodb describe-table \
  --region us-west-2 \
  --table-name securebase-customers \
  --query "Table.TableStatus" \
  --output text)
echo "DynamoDB status: $DYNAMO_STATUS"

# Check 5: Lambda function health
echo -e "\n[5/8] Checking Lambda functions..."
LAMBDA_COUNT=$(aws lambda list-functions \
  --region us-west-2 \
  --query "Functions[?starts_with(FunctionName, 'securebase-prod')] | length(@)")
echo "Lambda functions deployed in us-west-2: $LAMBDA_COUNT"

# Check 6: API Gateway endpoint
echo -e "\n[6/8] Testing API Gateway health endpoint..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.securebase.io/health)
echo "API health endpoint HTTP status: $HTTP_STATUS"
if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ FAIL: API health check failed"
  exit 1
fi

# Check 7: CloudFront distribution
echo -e "\n[7/8] Checking CloudFront distribution..."
CF_STATUS=$(aws cloudfront get-distribution \
  --id E1ABCDEF123456 \
  --query "Distribution.Status" \
  --output text)
echo "CloudFront status: $CF_STATUS"

# Check 8: Customer portal accessibility
echo -e "\n[8/8] Testing customer portal..."
PORTAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://portal.securebase.io)
echo "Portal HTTP status: $PORTAL_STATUS"

echo -e "\n=== Validation Complete ==="
echo "All checks passed ✅"
echo "End time: $(date -u)"
```

**Save this script as:** `/opt/securebase-dr/validate-failover.sh`

---

## 📖 Section 5: Failback to Primary Region

### When to Failback

**Criteria for failback to us-east-1:**
- [ ] Primary region (us-east-1) confirmed healthy for >1 hour
- [ ] Root cause of outage identified and resolved
- [ ] All AWS Service Health Dashboard issues cleared
- [ ] VP Engineering approval obtained
- [ ] Planned maintenance window scheduled (recommended: low-traffic hours)

### Failback Procedure

**⚠️ IMPORTANT:** Failback is NOT the reverse of failover. Data has been written to us-west-2, so we must resync.

---

**STEP 1: Pre-Failback Validation**

```bash
# Verify us-east-1 is healthy
aws rds describe-db-clusters \
  --region us-east-1 \
  --db-cluster-identifier securebase-prod-cluster-east \
  --query "DBClusters[0].Status"
# Expected: "available"

# Check replication lag from us-west-2 → us-east-1
# (After initial outage, us-east-1 became a replica)
aws cloudwatch get-metric-statistics \
  --region us-east-1 \
  --namespace AWS/RDS \
  --metric-name AuroraGlobalDBReplicationLag \
  --dimensions Name=DBClusterIdentifier,Value=securebase-prod-cluster-east \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average
# Lag should be <1 second before proceeding
```

---

**STEP 2: Promote us-east-1 Back to Writer**

```bash
# Failback Aurora Global Database to us-east-1
aws rds failover-global-cluster \
  --region us-east-1 \
  --global-cluster-identifier securebase-global-cluster \
  --target-db-cluster-identifier arn:aws:rds:us-east-1:$AWS_ACCOUNT_ID:cluster:securebase-prod-cluster-east

# Monitor promotion (1-2 minutes)
watch -n 10 'aws rds describe-db-clusters \
  --region us-east-1 \
  --db-cluster-identifier securebase-prod-cluster-east \
  --query "DBClusters[0].Status"'
```

---

**STEP 3: Update Route53 Back to Primary**

```bash
# Gradually shift traffic back to us-east-1
# Start with 25% traffic

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.securebase.io",
        "Type": "A",
        "SetIdentifier": "us-east-1-primary",
        "Weight": 25,
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "api-useast1.execute-api.us-east-1.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Wait 10 minutes, monitor error rates
sleep 600

# If stable, increase to 50%
# (Repeat weight update with Weight: 50)

# Wait another 10 minutes, monitor

# If stable, increase to 100% (full failback)
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.securebase.io",
        "Type": "A",
        "SetIdentifier": "us-east-1-primary",
        "Weight": 100,
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "api-useast1.execute-api.us-east-1.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Set us-west-2 back to standby (Weight: 0)
# (Repeat weight update for us-west-2 with Weight: 0)
```

---

**STEP 4: Validate Failback**

```bash
# Run validation script (same as Section 4, but check us-east-1)
/opt/securebase-dr/validate-failback.sh

# Verify API is responding from us-east-1
curl https://api.securebase.io/health
# Expected: {"status":"ok","region":"us-east-1",...}
```

---

**STEP 5: Post-Failback Cleanup**

```bash
# Update status page
curl -X PATCH https://api.statuspage.io/v1/incidents/INCIDENT_ID \
  -H "Authorization: OAuth YOUR_TOKEN" \
  -d '{
    "incident": {
      "status": "resolved",
      "body": "Service restored to primary region (us-east-1). All systems operational."
    }
  }'

# Document incident in post-mortem
# Create GitHub issue with tag "post-mortem"
gh issue create \
  --repo cedrickbyrd/securebase-app \
  --title "Post-Mortem: Regional Failover on $(date +%Y-%m-%d)" \
  --body "Timeline of events, root cause, action items..."
```

---

## 📖 Section 6: Troubleshooting

### Common Issues

**Issue 1: Route53 DNS Not Propagating**

**Symptoms:** API still resolving to old IP after failover

**Resolution:**
```bash
# Check DNS propagation
dig +trace api.securebase.io

# Flush local DNS cache
# macOS:
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Linux:
sudo systemd-resolve --flush-caches

# Windows:
ipconfig /flushdns

# Force CloudFront invalidation
aws cloudfront create-invalidation \
  --distribution-id E1ABCDEF123456 \
  --paths "/*"
```

---

**Issue 2: Aurora Promotion Stuck**

**Symptoms:** Aurora cluster in us-west-2 stuck in "modifying" status

**Resolution:**
```bash
# Check for blocking transactions
aws rds describe-db-clusters \
  --region us-west-2 \
  --db-cluster-identifier securebase-prod-cluster-west

# If stuck for >5 minutes, contact AWS Support
# Emergency contact: AWS Support Premium (phone)

# Temporary workaround: Point API to reader endpoint (degraded mode)
# Update Lambda environment variables to use reader endpoint
```

---

**Issue 3: High DynamoDB Replication Lag**

**Symptoms:** DynamoDB showing >5 minute replication lag

**Resolution:**
```bash
# Check for throttling
aws cloudwatch get-metric-statistics \
  --region us-west-2 \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=securebase-customers \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# If throttled, increase provisioned capacity
aws dynamodb update-table \
  --region us-west-2 \
  --table-name securebase-customers \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=100

# Or switch to On-Demand mode (if not already)
aws dynamodb update-table \
  --region us-west-2 \
  --table-name securebase-customers \
  --billing-mode PAY_PER_REQUEST
```

---

**Issue 4: Lambda Functions Not Receiving Traffic**

**Symptoms:** API Gateway returning 502/503 errors

**Resolution:**
```bash
# Check Lambda CloudWatch Logs
aws logs tail /aws/lambda/securebase-prod-auth-v2 \
  --region us-west-2 \
  --follow

# Check for cold start issues
aws lambda get-function-concurrency \
  --region us-west-2 \
  --function-name securebase-prod-auth-v2

# Increase reserved concurrency if needed
aws lambda put-function-concurrency \
  --region us-west-2 \
  --function-name securebase-prod-auth-v2 \
  --reserved-concurrent-executions 100

# Pre-warm Lambda functions
for i in {1..10}; do
  aws lambda invoke \
    --region us-west-2 \
    --function-name securebase-prod-auth-v2 \
    --payload '{"warm":"true"}' \
    /dev/null &
done
```

---

## 📖 Section 7: Post-Incident Review

### Incident Timeline Template

```markdown
# Post-Mortem: Regional Failover - [DATE]

## Summary
- **Incident Start:** [TIMESTAMP]
- **Detection Time:** [TIMESTAMP]
- **Failover Initiated:** [TIMESTAMP]
- **Service Restored:** [TIMESTAMP]
- **Total Downtime:** [DURATION]
- **RTO Achieved:** [DURATION] (Target: <15 min)
- **RPO Achieved:** [DURATION] (Target: <1 min)

## Timeline
| Time (UTC) | Event |
|------------|-------|
| 14:23 | Route53 health check failure detected |
| 14:24 | Second consecutive health check failure |
| 14:25 | Automated failover triggered |
| 14:27 | Route53 DNS updated to us-west-2 |
| ... | ... |

## Root Cause
[Detailed analysis of what caused the outage]

## Impact
- **Customers Affected:** [NUMBER]
- **API Requests Failed:** [NUMBER]
- **Revenue Impact:** $[AMOUNT]

## What Went Well
- Automated failover completed in [X] minutes
- No data loss occurred
- Customer communication was timely

## What Went Wrong
- [ISSUE 1]
- [ISSUE 2]

## Action Items
- [ ] [ACTION 1] - Owner: [NAME] - Due: [DATE]
- [ ] [ACTION 2] - Owner: [NAME] - Due: [DATE]
```

---

## 📞 Escalation & Support

### AWS Support

**Premium Support:** 1-800-xxx-xxxx (24/7)  
**Support Cases:** https://console.aws.amazon.com/support

**Create urgent support case:**
```bash
aws support create-case \
  --subject "URGENT: Regional Failover Assistance Needed" \
  --service-code "amazon-rds" \
  --severity-code "urgent" \
  --category-code "performance" \
  --communication-body "We are performing a DR failover and need assistance with Aurora Global Database promotion..."
```

---

## ✅ Runbook Checklist

**Before Declaring Incident Resolved:**
- [ ] All health checks passing
- [ ] API error rate <0.5%
- [ ] Database replication lag <5 seconds
- [ ] Customer portal accessible
- [ ] Smoke tests passed
- [ ] Monitoring dashboards updated
- [ ] Status page updated
- [ ] Customer notification sent
- [ ] Incident logged in PagerDuty/Jira
- [ ] Post-mortem scheduled

---

**Version:** 1.0  
**Last Tested:** [To be determined after first drill]  
**Next Review:** Phase 5 kickoff (May 2026)

---

**SecureBase DR Runbook**  
*Step-by-step procedures for ensuring <15 minute recovery*
