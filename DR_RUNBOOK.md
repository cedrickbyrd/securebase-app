# DR Runbook (On-Call Operations)

## Severity and escalation

- **SEV-1:** Full production outage / major regional impairment
- **SEV-2:** Partial outage / degraded regional health
- **SEV-3:** Warning-level DR risk (replication lag, alarm noise)

Escalation path: On-call SRE → Platform Lead → VP Engineering.

## Automated failover (preferred)

1. Confirm failover guard (`/securebase/dr/failover_enabled`) is true.
2. Invoke `securebase-prod-failover-orchestrator`.
3. Confirm Aurora promotion and active-region SSM update.
4. Confirm Route 53 now routes to standby endpoint.
5. Validate API and DB health in us-west-2.

```bash
aws lambda invoke \
  --function-name securebase-prod-failover-orchestrator \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failover_result.json
cat /tmp/failover_result.json
```

## Manual override procedures

Use manual override only when automation is blocked or misfiring.

1. Manually promote Aurora secondary cluster.
2. Manually update Route 53 weighted records.
3. Manually update active-region indicator in SSM.
4. Announce status in incident channels.

## Communication templates

**Initial incident notice**

> SecureBase is investigating a regional service degradation. DR procedures are in progress. Next update in 10 minutes.

**Failover complete**

> SecureBase failover complete. Traffic is now served from us-west-2. Monitoring continues.

**Failback complete**

> SecureBase traffic has been restored to us-east-1 primary. Incident is resolved; post-incident review in progress.

## Post-incident actions

- [ ] Confirm all workloads stable in active region
- [ ] Validate replication restored and healthy
- [ ] Export CloudWatch/CloudTrail evidence
- [ ] Complete post-mortem with corrective actions
- [ ] Schedule follow-up DR drill for regression prevention
