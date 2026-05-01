# Multi-Region DR Testing Guide

**Phase:** 5.3 — Multi-Region DR  
**Test Frequency:** Monthly (production), Weekly (staging)  
**Owner:** Platform Operations  
**Last Updated:** May 2026  

---

## Overview

This guide covers the monthly DR drill schedule for SecureBase's active-passive multi-region setup:

- **Primary:** us-east-1 (active writer)
- **Secondary:** us-west-2 (standby replica)
- **RTO Target:** < 15 minutes
- **RPO Target:** < 1 minute

All tests should be scheduled during low-traffic windows (Sundays 02:00–04:00 UTC for production).

---

## Test Levels

| Level | Scope | Disruption | Frequency |
|-------|-------|-----------|-----------|
| L1 — Health Check Drill | Validate health checks fire correctly | None | Weekly |
| L2 — DNS Failover Simulation | Toggle Route 53 weights without Aurora change | 60s elevated errors | Bi-weekly |
| L3 — Full Regional Failover | Complete Aurora promotion + DNS cutover | 5–10 min downtime | Monthly |
| L4 — Chaos Engineering | Inject failures via AWS FIS | Partial degradation | Quarterly |

---

## Level 1 — Health Check Drill

**Duration:** ~5 minutes  
**Disruption:** None

### Steps

1. Invoke health check aggregator manually:
   ```bash
   aws lambda invoke \
     --function-name securebase-prod-health-check-aggregator \
     --payload '{}' \
     /tmp/hc_result.json && cat /tmp/hc_result.json
   ```

2. Verify both regions return `"healthy": true`

3. Check CloudWatch metrics are published:
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace "SecureBase/prod/DR" \
     --metric-name "HealthCheckStatus" \
     --dimensions Name=Role,Value=primary Name=Region,Value=us-east-1 \
     --start-time $(date -u -d '10 minutes ago' +%FT%TZ) \
     --end-time $(date -u +%FT%TZ) \
     --period 60 \
     --statistics Average
   ```

4. Check DynamoDB DR state table for a new `HEALTH#prod` snapshot

### Pass Criteria
- Both regions healthy
- CloudWatch metrics visible
- DynamoDB snapshot written within 90 seconds

---

## Level 2 — DNS Failover Simulation

**Duration:** ~15 minutes  
**Disruption:** 60–90 seconds of elevated error rate

### Pre-test Checklist
- [ ] Notify on-call team
- [ ] Confirm secondary API Gateway is responding: `curl https://{secondary_fqdn}/health`
- [ ] Set browser cache/CDN cache TTL expectations

### Steps

1. **Disable primary health check** (simulates primary region failure):
   ```bash
   aws route53 update-health-check \
     --health-check-id ${PRIMARY_HEALTH_CHECK_ID} \
     --disabled
   ```

2. **Wait 60–90 seconds**, then verify traffic routes to secondary:
   ```bash
   for i in {1..10}; do
     curl -s -H "X-Trace: test-$i" https://api.securebase.tximhotep.com/health | jq .region
     sleep 3
   done
   # Expected: "us-west-2" responses
   ```

3. **Restore primary health check**:
   ```bash
   aws route53 update-health-check \
     --health-check-id ${PRIMARY_HEALTH_CHECK_ID} \
     --no-disabled
   ```

4. **Wait 60–90 seconds**, verify traffic returns to us-east-1.

### Pass Criteria
- Traffic routes to us-west-2 within 90 seconds of health check disable
- Traffic returns to us-east-1 within 90 seconds of re-enable
- No data corruption observed
- Error rate returns to baseline within 5 minutes

---

## Level 3 — Full Regional Failover Test

**Duration:** 30–45 minutes  
**Disruption:** ~10 minutes planned downtime

> **Requires approval from Platform Lead and VP Engineering before execution.**

### Pre-test Checklist
- [ ] Confirm maintenance window is scheduled and customers are notified
- [ ] Confirm all developers have merged open PRs (no in-flight deployments)
- [ ] Verify secondary region Aurora cluster is healthy: `aws rds describe-db-clusters --db-cluster-identifier securebase-prod-secondary`
- [ ] Verify Aurora replication lag < 5 seconds
- [ ] Confirm SNS email subscriptions are active (on-call will receive notifications)
- [ ] Dry run both failover and failback orchestrators

### Phase 1 — Execute Failover (T+0)
```bash
aws lambda invoke \
  --function-name securebase-prod-failover-orchestrator \
  --payload '{"action": "failover"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failover_result.json

cat /tmp/failover_result.json
# Expected: {"message": "Failover completed", "failover_id": "fo-..."}
```

Record: `T_failover_initiated` = current time

### Phase 2 — Validate Secondary (T+10 min)
```bash
# Confirm API is serving from secondary
curl -v https://api.securebase.tximhotep.com/health 2>&1 | grep -E "(< HTTP|region)"

# Confirm Aurora writer is in us-west-2
aws rds describe-global-clusters \
  --global-cluster-identifier securebase-prod-global \
  --query 'GlobalClusters[0].GlobalClusterMembers[?IsWriter==`true`]'

# Run smoke tests
./tests/smoke/run_smoke_tests.sh --env prod --region secondary
```

Record: `T_validation_complete` = current time  
Calculate: `RTO_actual = T_validation_complete - T_failover_initiated`

### Phase 3 — Execute Failback (T+30 min)

Follow the [Failback Procedure](FAILBACK_PROCEDURE.md).

### Phase 4 — Capture Results

Fill in the DR drill report:

```markdown
## DR Drill Report — [DATE]

**Test Level:** L3 Full Regional Failover  
**Environment:** Production  
**Tester:** [Name]  
**Approvers:** [Names]

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| RTO | < 15 min | X min | ✅/❌ |
| RPO | < 1 min | X sec | ✅/❌ |
| Aurora switchover time | < 10 min | X min | ✅/❌ |
| DNS propagation | < 2 min | X sec | ✅/❌ |
| Data integrity | 0 rows lost | X rows | ✅/❌ |
| Error rate during cutover | < 5% | X% | ✅/❌ |

**Issues encountered:** [list]
**Action items:** [list]
```

---

## Level 4 — Chaos Engineering (AWS FIS)

**Duration:** 2–4 hours  
**Disruption:** Partial service degradation (conducted in staging only until validated)

### Recommended Experiment Templates

1. **Lambda Function Failures**: Inject failures into auth-v2 Lambda to test fallback behavior
2. **Network Partition**: Block traffic between Lambda and Aurora for 60 seconds
3. **AZ Outage Simulation**: Terminate EC2 instances in a single AZ (if applicable)
4. **High CPU on Aurora**: Inject CPU load to trigger Serverless v2 scale-up

See `landing-zone/modules/fis-experiments/` (Phase 6 scope) for Terraform-managed FIS templates.

---

## Recovery Time Measurement

Automate RTO/RPO measurement using CloudWatch:

```bash
# Time from health check failure to secondary serving requests
aws cloudwatch get-metric-statistics \
  --namespace "SecureBase/prod/DR" \
  --metric-name "HealthCheckStatus" \
  --dimensions Name=Role,Value=secondary \
  --start-time ${FAILOVER_START} \
  --end-time ${FAILOVER_END} \
  --period 60 \
  --statistics Average
```

For RPO measurement, compare DynamoDB Global Table item counts between primary and secondary immediately after failover completes.

---

## Runbook for Stuck Failover

If the `failover_orchestrator` Lambda returns an error or does not complete within 15 minutes:

1. **Check Lambda logs**: CloudWatch → `/aws/securebase/prod/failover-orchestrator`
2. **Check Aurora global cluster status**:
   ```bash
   aws rds describe-global-clusters --global-cluster-identifier securebase-prod-global
   ```
3. **Manual Aurora promotion** (emergency fallback):
   ```bash
   aws rds remove-from-global-cluster \
     --global-cluster-identifier securebase-prod-global \
     --db-cluster-identifier ${SECONDARY_CLUSTER_ARN}
   ```
4. **Manual Route 53 update**: Change failover record to point directly to secondary API Gateway FQDN
5. **Notify Platform Lead immediately**
