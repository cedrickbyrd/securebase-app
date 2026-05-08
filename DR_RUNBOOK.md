# DR Runbook (On-Call Operations, Phase 5)

## 1) Prerequisites & Tooling

- AWS CLI v2 with production break-glass/OIDC role access
- Access to CloudWatch dashboards and alarms
- Access to Route53 hosted zone and health checks
- Access to SSM Parameter Store (`/securebase/dr/*`)
- Access to Lambda functions:
  - `securebase-prod-failover-orchestrator`
  - `securebase-prod-health-check-aggregator`
  - `securebase-prod-failback-orchestrator`

## 2) Severity Levels & Escalation

- **SEV-1:** Full production outage / regional impairment
- **SEV-2:** Partial outage / significant degradation
- **SEV-3:** DR risk warning (replication lag, noisy alarms)

Escalation: **On-call SRE → Platform Lead → Security/Compliance Lead → Engineering Director**.

## 3) Automated Failover Procedure (Preferred)

### Preconditions
1. Confirm failover guard is enabled in SSM:
```bash
aws ssm get-parameter --name /securebase/dr/failover_enabled
```
2. Confirm incident command has approved failover.

### Execute
```bash
aws lambda invoke \
  --function-name securebase-prod-failover-orchestrator \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failover_result.json
cat /tmp/failover_result.json
```

### Automation IDs
- Lambda automation entrypoint: `securebase-prod-failover-orchestrator`
- Health aggregation: `securebase-prod-health-check-aggregator`
- Failback entrypoint: `securebase-prod-failback-orchestrator`

## 4) Manual Failover Procedure (Fallback)

Use only if automated orchestration fails.

1. Promote Aurora secondary cluster to writer.
2. Validate DynamoDB global table health in secondary region.
3. Update Route53 failover records to secondary endpoint.
4. Update active-region SSM parameter.
5. Validate API, auth, billing, and reporting endpoints.
6. Communicate failover complete in incident channels.

## 5) Rollback / Failback Procedure

1. Confirm primary region health fully restored.
2. Run controlled failback:
```bash
aws lambda invoke \
  --function-name securebase-prod-failback-orchestrator \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failback_result.json
cat /tmp/failback_result.json
```
3. Verify Route53 now resolves to primary.
4. Verify Aurora global topology healthy.
5. Close incident only after 30+ minutes stable metrics.

## 6) Scheduled DR Drill Checklist

- [ ] Trigger synthetic outage scenario in approved window
- [ ] Run automated failover and measure elapsed time
- [ ] Validate RTO < 15 minutes
- [ ] Validate RPO targets and replication integrity
- [ ] Run automated failback and verify restoration
- [ ] Archive drill evidence (CloudWatch, CloudTrail, incident timeline)

### Pass/Fail Criteria

- **PASS:** All critical services recovered within RTO, replication healthy, no data integrity issues
- **FAIL:** Any critical service exceeds RTO, unresolved replication errors, or failed validation checks

## 7) Monitoring Validation After Recovery

- [ ] API Gateway p95 latency and 5xx error alarms clear
- [ ] Lambda error/throttle alarms clear
- [ ] Aurora DB connection and replica lag metrics healthy
- [ ] DynamoDB throttles/replication lag healthy
- [ ] S3 CRR lag alarm not in ALARM state
- [ ] Alert routing (PagerDuty/Opsgenie) functioning

## 8) Communication Templates

**Initial notice**
> SecureBase is investigating a regional service degradation. DR procedures are in progress. Next update in 10 minutes.

**Failover complete**
> SecureBase failover complete. Traffic is now served from us-west-2. Monitoring continues.

**Failback complete**
> SecureBase traffic has been restored to us-east-1 primary. Incident is resolved; post-incident review in progress.
