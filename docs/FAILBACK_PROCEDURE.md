# SecureBase Failback Procedure

**Phase:** 5.3 — Multi-Region DR  
**Applies To:** Production (`prod`) and Staging (`staging`)  
**Last Updated:** May 2026  
**Owner:** Platform Operations  

> ⚠️ **Failback is a manual procedure.** Never run it automatically. Always complete a post-incident review before initiating failback.

---

## Prerequisites

Before starting failback, confirm **all** of the following:

- [ ] Primary region (us-east-1) is fully healthy — Aurora, Lambda, API Gateway
- [ ] Root cause of the original outage has been identified and resolved
- [ ] Primary health check (`securebase-prod-primary-health`) is passing in the AWS Console
- [ ] All primary Aurora instances show status `available`
- [ ] No active incidents or active alarms in us-east-1
- [ ] Stakeholders have been notified that a 5–10 minute elevated error rate is expected during DNS cutover
- [ ] Database replication lag from secondary → primary is below **5 seconds** (check CloudWatch: `SecureBase/prod/DR > ReplicationLag`)

---

## Step 1 — Validate Primary Region Readiness

Invoke the failback orchestrator in dry-run mode to confirm readiness without making any changes:

```bash
aws lambda invoke \
  --function-name securebase-prod-failback-orchestrator \
  --payload '{"action": "dry_run"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failback_dryrun.json

cat /tmp/failback_dryrun.json
```

Expected response:
```json
{
  "message": "Dry run complete",
  "primary_healthy": true,
  "global_cluster_members": [...],
  "primary_health_check_disabled": true
}
```

If `primary_healthy` is `false`, stop. Do not proceed until the primary region is healthy.

---

## Step 2 — Notify Stakeholders

Send a pre-failback notification in your incident channel:

```
[SECUREBASE FAILBACK] Initiating return of traffic to us-east-1 (primary region).
Expected elevated error rate for 60–90 seconds during Route 53 DNS propagation.
Estimated completion: ~15 minutes.
```

---

## Step 3 — Execute Failback

```bash
aws lambda invoke \
  --function-name securebase-prod-failback-orchestrator \
  --payload '{"action": "failback"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failback_result.json

cat /tmp/failback_result.json
```

The Lambda will:
1. Re-validate primary health
2. Run `rds:SwitchoverGlobalCluster` to restore us-east-1 as the Aurora writer
3. Wait up to 15 minutes for the switchover to complete
4. Re-enable the primary Route 53 health check
5. Publish SNS notifications at each step

---

## Step 4 — Verify Traffic Return

After the Lambda completes (watch CloudWatch Logs for `securebase-prod-failback-orchestrator`):

**Route 53 (1–2 minutes after Lambda completes):**
```bash
dig +short api.securebase.tximhotep.com
# Should resolve to us-east-1 API Gateway IP range
```

**API health check:**
```bash
curl -s https://api.securebase.tximhotep.com/health | jq .
# Expected: {"status": "healthy", "region": "us-east-1", ...}
```

**Aurora writer:**
```bash
aws rds describe-global-clusters \
  --global-cluster-identifier securebase-prod-global \
  --query 'GlobalClusters[0].GlobalClusterMembers[?IsWriter==`true`].DBClusterArn'
# Should return the us-east-1 cluster ARN
```

---

## Step 5 — Monitor (30 minutes)

Watch the following dashboards for 30 minutes post-failback:

- **SRE Dashboard**: `securebase-prod-sre-operations-dashboard`
- **API Latency**: Confirm p95 < 500ms
- **Error Rate**: Confirm < 1%
- **Aurora**: Confirm CPU < 50%, connections stable
- **Health Check Aggregator**: Confirm `primary_healthy = true` in CloudWatch Logs

---

## Step 6 — Post-Incident Actions

Once traffic is stable on us-east-1:

1. **Re-sync secondary region**: Confirm Aurora Global DB replication to us-west-2 has resumed (lag should return to < 1 minute)
2. **Restore S3 CRR**: Verify cross-region replication rules are active on audit-logs bucket
3. **Review DynamoDB Global Table state**: Confirm both regions are in sync
4. **File post-mortem**: Use the template in `docs/INCIDENT_POSTMORTEM_TEMPLATE.md`
5. **Schedule DR drill**: Next monthly drill should simulate the same failure scenario

---

## Rollback (if failback causes new issues)

If us-east-1 becomes unstable again during failback, re-execute the original failover:

```bash
aws lambda invoke \
  --function-name securebase-prod-failover-orchestrator \
  --payload '{"action": "failover"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/re_failover.json
```

---

## Timing Reference

| Step | Expected Duration |
|------|-------------------|
| Dry-run validation | < 30 seconds |
| Aurora switchover | 5–15 minutes |
| Route 53 DNS propagation | 60–90 seconds |
| Total failback time | < 20 minutes |
| Post-failback monitoring | 30 minutes |

---

## Escalation Contacts

| Role | Action |
|------|--------|
| On-call SRE | Execute this procedure |
| Platform Lead | Approve step 3 before executing |
| VP Engineering | Notify before any production failback |
