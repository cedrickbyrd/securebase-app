# Phase 5.4 DR Validation Runbook

**Owner:** Platform Operations / On-call SRE  
**Estimated time:** 30–45 minutes  
**Goal:** Close all Phase 5.4 production validation gates in a single operator session

---

## Prerequisites

```bash
# AWS CLI configured with prod credentials (OIDC or admin role)
aws sts get-caller-identity  # confirm you're in account 731184206915

# Confirm you can reach both regions
aws ec2 describe-vpcs --region us-east-1 --query 'Vpcs[0].VpcId'
aws ec2 describe-vpcs --region us-west-2 --query 'Vpcs[0].VpcId'
```

---

## Gate 1 — CloudFront Distribution Responding

```bash
# Test the primary custom domain through CloudFront
curl -I https://api.securebase.tximhotep.com/health

# Expected: HTTP/2 200 or 404 (404 = CloudFront reached Lambda but route not found = success)
# Failure: Connection refused, SSL error, or 403 ForbiddenException

# If 403: the Host header is wrong. Confirm primary origin in cloudfront-failover.tf
# is d-ky35u7ca93.execute-api.us-east-1.amazonaws.com (NOT the raw execute-api URL)
```

**Pass criteria:** HTTP response received (any 2xx or 4xx). No connection error.  
**Gate closes:** ✅ CloudFront distribution live + responding

---

## Gate 2 — Aurora Global DB Secondary Cluster Healthy

```bash
# List all global clusters
aws rds describe-global-clusters \
  --query 'GlobalClusters[*].{ID:GlobalClusterIdentifier,Status:Status,Members:GlobalClusterMembers[*].{ARN:DBClusterArn,Writer:IsWriter}}' \
  --output table

# Confirm secondary cluster in us-west-2
aws rds describe-db-clusters \
  --region us-west-2 \
  --query 'DBClusters[?contains(DBClusterIdentifier,`securebase`)].{ID:DBClusterIdentifier,Status:Status,Role:tags}' \
  --output table
```

**Pass criteria:** Global cluster status = `available`. Secondary cluster status = `available`.  
**Gate closes:** ✅ Aurora Global DB secondary cluster healthy

---

## Gate 3 — DynamoDB Replication Lag < 1 Minute

```bash
# Check replication latency in CloudWatch for each prod table
for TABLE in securebase-prod-metrics securebase-prod-report-cache securebase-prod-report-schedules securebase-prod-reports; do
  echo "=== $TABLE ==="
  aws cloudwatch get-metric-statistics \
    --namespace AWS/DynamoDB \
    --metric-name ReplicationLatency \
    --dimensions Name=TableName,Value=$TABLE Name=ReceivingRegion,Value=us-west-2 \
    --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
    --period 60 \
    --statistics Maximum \
    --query 'Datapoints[*].Maximum' \
    --output text
done

# macOS: use 'date -u -v-10M' instead of 'date -u -d "10 minutes ago"'
```

**Pass criteria:** All values < 60000 ms (60 seconds).  
**Gate closes:** ✅ DynamoDB Global Table replication lag < 1 min

---

## Gate 4 — Secondary /health Endpoint Reachable

```bash
# Get the secondary API Gateway URL
SECONDARY_URL=$(aws apigatewayv2 get-apis \
  --region us-west-2 \
  --query "Items[?contains(Name,'health-secondary')].ApiEndpoint" \
  --output text)

echo "Secondary health URL: $SECONDARY_URL"
curl -sf "${SECONDARY_URL}/health" | jq .

# If URL is empty, check by API name:
aws apigatewayv2 get-apis --region us-west-2 --output table
```

**Pass criteria:** Returns `{"status": "healthy"}` or similar JSON.  
**Informational gate** (already deployed per Terraform; this confirms runtime reachability).

---

## Gate 5 — Run the Automated DR Validation Script

This runs all 7 checks in one shot:

```bash
# From repo root, with AWS credentials active:
cd landing-zone/modules/multi-region
bash dr-validation.sh prod

# Or trigger via GitHub Actions (no local AWS creds needed):
# GitHub → Actions → "Validate DR Stack" → Run workflow → Branch: main
```

**Pass criteria:** `=== Results: 7 passed, 0 failed ===`

Note: Check 5 (Route53 health check) will likely fail or skip — Route53 is intentionally disabled (DNS in Netlify; CloudFront origin group handles failover). If the script exits with check 5 as the only failure, treat as pass. Update the script's check 5 to probe CloudFront directly if needed.

---

## Gate 6 — First DR Drill (RTO < 15 Minutes)

This is the full failover → validate → failback cycle. **Schedule this for a low-traffic window.**

### Pre-drill (5 min)

```bash
# Capture baseline — DynamoDB replication lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB --metric-name ReplicationLatency \
  --dimensions Name=TableName,Value=securebase-prod-metrics Name=ReceivingRegion,Value=us-west-2 \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 --statistics Maximum --output text

# Note the Aurora writer ARN
aws rds describe-global-clusters \
  --query 'GlobalClusters[0].GlobalClusterMembers[?IsWriter==`true`].DBClusterArn' \
  --output text

# Record drill start time
DRILL_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Drill started: $DRILL_START"
```

### Simulate failover (invoke failover Lambda)

```bash
# Invoke the failover orchestrator in us-west-2
aws lambda invoke \
  --function-name securebase-prod-failover-orchestrator \
  --region us-west-2 \
  --payload '{"action": "failover", "reason": "DR drill", "operator": "cedrickbyrd"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failover-response.json

cat /tmp/failover-response.json | jq .
```

### Monitor failover progress (watch for < 15 min)

```bash
# Poll Aurora cluster status every 30s
watch -n 30 'aws rds describe-db-clusters --region us-west-2 \
  --query "DBClusters[?contains(DBClusterIdentifier,\`securebase\`)].{Status:Status,Writer:MultiAZ}" \
  --output table'

# Confirm new writer is in us-west-2
aws rds describe-global-clusters \
  --query 'GlobalClusters[0].GlobalClusterMembers[?IsWriter==`true`].DBClusterArn'

# Test API still serving traffic
curl -sf https://api.securebase.tximhotep.com/health

# Record failover complete time
DRILL_FAILOVER_DONE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Failover complete: $DRILL_FAILOVER_DONE"
```

### Validate (5 min)

```bash
# Run the 7-check validation script against the secondary region
bash landing-zone/modules/multi-region/dr-validation.sh prod

# Check DynamoDB lag from new writer
for TABLE in securebase-prod-metrics securebase-prod-report-cache; do
  aws cloudwatch get-metric-statistics \
    --namespace AWS/DynamoDB --metric-name ReplicationLatency \
    --dimensions Name=TableName,Value=$TABLE Name=ReceivingRegion,Value=us-east-1 \
    --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
    --period 60 --statistics Maximum --output text
done
```

### Failback (return to us-east-1)

```bash
# Invoke failback orchestrator
aws lambda invoke \
  --function-name securebase-prod-failback-orchestrator \
  --region us-east-1 \
  --payload '{"action": "failback", "reason": "DR drill complete", "operator": "cedrickbyrd"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failback-response.json

cat /tmp/failback-response.json | jq .

# Confirm primary writer restored
aws rds describe-global-clusters \
  --query 'GlobalClusters[0].GlobalClusterMembers[?IsWriter==`true`].DBClusterArn'

# Record drill end time
DRILL_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Drill complete: $DRILL_END"
echo "Total RTO: measure $DRILL_START to $DRILL_FAILOVER_DONE"
```

### Post-drill

```bash
# Final validation
bash landing-zone/modules/multi-region/dr-validation.sh prod

# Check PagerDuty/SNS received the failover event
# (CloudWatch alarm should have fired during failover window)
aws cloudwatch describe-alarm-history \
  --alarm-name-prefix securebase-prod \
  --start-date $DRILL_START \
  --output table | head -50
```

**Pass criteria:**
- Failover completes (new writer in us-west-2) in < 15 minutes → RTO gate ✅
- No DynamoDB data loss observed (replication lag was < 60s pre-drill) → RPO gate ✅
- API serving traffic throughout or resumes within RTO window
- Failback restores us-east-1 as writer cleanly

---

## Drill Result Documentation

After the drill, record:

```
DR Drill — [DATE]
Operator: cedrickbyrd
Drill start:          [DRILL_START]
Failover complete:    [DRILL_FAILOVER_DONE]
Actual RTO:           [X minutes Y seconds]
RPO observed:         [max replication lag seen]
API continuity:       [continuous / X second gap]
Failback complete:    [DRILL_END]
All 7 validation checks passed: [YES / NO — detail failures]
Notes: [anything unexpected]
```

Update `PHASE5.4_IMPLEMENTATION_COMPLETE.md` gates to ✅ once all pass.

---

## If the Drill Fails

Follow `FAILBACK_PROCEDURE.md` to restore primary. Open a GitHub issue tagging the failed check. Do not mark Phase 5.4 fully validated until the drill passes cleanly.

**Created:** 2026-05-10  
**Author:** cedrickbyrd  
**Frequency:** Monthly thereafter (first Tuesday, 02:00 UTC)
