# DR Runbook — Phase 6 / Track 2: Multi-Region Disaster Recovery

**Version:** 1.1  
**Phase:** 6 / Track 2  
**Last Updated:** 2026-05-14  
**Owner:** @cedrickbyrd  
**Status:** ✅ Operational (final operator validation gates tracked separately)  
**SLA:** 99.95% uptime | RTO < 15 min | RPO < 1 min

---

## Overview

This runbook covers the end-to-end disaster recovery procedures for SecureBase's multi-region architecture:

> For the Phase 5.4 production validation gate checklist (CloudFront, Aurora Global DB, DynamoDB replication, and secondary health endpoint verification), use `docs/runbooks/PHASE5_DR_DRILL.md` as the authoritative operator checklist.

| Component | Primary (us-east-1) | Secondary (us-west-2) |
|-----------|---------------------|-----------------------|
| Aurora PostgreSQL | Writer cluster | Global DB reader (auto-promotes) |
| DynamoDB | `securebase-tenants`, `securebase-controls-state`, `securebase-tenant-metrics` | Global Table replicas (active-active) |
| S3 | Evidence, audit log, report output buckets | CRR replicas (RTC enabled) |
| API Gateway | Primary REST API | Failover REST API |
| DNS / Routing | Active (CloudFront primary origin) | Standby (CloudFront secondary origin) |

---

## 1. Prerequisites & Tooling

- AWS CLI v2 with production break-glass / OIDC role access
- Access to CloudWatch dashboards and alarms
- Access to SSM Parameter Store (`/securebase/dr/*`)
- Access to Lambda functions:
  - `securebase-prod-failover-orchestrator`
  - `securebase-prod-failback-orchestrator`
  - `securebase-prod-health-check-aggregator`
  - `securebase-prod-dr-drill`
- S3 drill report bucket (see `DRILL_REPORT_BUCKET` Lambda env var)

```bash
# Verify CLI access
aws sts get-caller-identity

# Confirm failover guard state
aws ssm get-parameter \
  --name /securebase/dr/failover_enabled \
  --query 'Parameter.Value' --output text

# Confirm active region
aws ssm get-parameter \
  --name /securebase/active_region \
  --query 'Parameter.Value' --output text
```

---

## 2. Severity Levels & Escalation

| Level | Condition | Escalation |
|-------|-----------|------------|
| **SEV-1** | >80 % customers impacted OR full regional outage > 5 min | On-call SRE → Platform Lead → Exec (immediate) |
| **SEV-2** | 20–80 % impact OR p95 > 2 s / error rate > 5 % for > 10 min | On-call SRE → Platform Lead (within 15 min) |
| **SEV-3** | Elevated DR risk only (replication lag, noisy alarms, < 20 % impact) | On-call SRE (investigate, no failover required) |

**Incident commander:** On-call SRE by default; transferred to Platform Lead for extended SEV-1 events.

---

## 3. Automated Failover Procedure (Preferred)

### 3.1 Preconditions

1. Confirm failover is enabled in SSM:
   ```bash
   aws ssm get-parameter \
     --name /securebase/dr/failover_enabled \
     --query 'Parameter.Value' --output text
   # Expected: true
   ```
2. Confirm incident commander has approved failover.  
   - If `false`, escalate to Platform Lead to set `true`:
     ```bash
     aws ssm put-parameter \
       --name /securebase/dr/failover_enabled \
       --value true --type String --overwrite
     ```

### 3.2 Execute Automated Failover

```bash
aws lambda invoke \
  --function-name securebase-prod-failover-orchestrator \
  --region us-east-1 \
  --payload '{"action":"failover","reason":"SEV-1 regional outage","operator":"YOUR_NAME"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failover_result.json

cat /tmp/failover_result.json | jq .
# Expected: {"statusCode": 200, "body": "failed over to us-west-2"}
```

**T+0**: Trigger initiated  
**T+2**: Aurora secondary promoted to standalone writer  
**T+3**: SSM `/securebase/active_region` updated to `us-west-2`  
**T+5**: On-call page sent via SNS → PagerDuty/Opsgenie  
**T+7**: CloudFront routes traffic to secondary origin  
**T+15**: RTO target met — all critical services restored

### 3.3 Validate Failover

```bash
aws lambda invoke \
  --function-name securebase-prod-failover-validator \
  --region us-east-1 \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/validation_result.json

cat /tmp/validation_result.json | jq .
```

Expected checks to pass:
- `active_region_ssm` — SSM updated to `us-west-2`
- `aurora_replication_lag` — post-failover, cluster is standalone (no lag)
- `dynamodb_replicas` — all 3 tables ACTIVE in `us-west-2`
- `secondary_health_endpoint` — HTTP 200

---

## 4. Manual Failover Procedure (Fallback)

Use only if automated orchestration fails or is unavailable.

### Step 1 — Promote Aurora Secondary

```bash
# Identify the secondary cluster ARN
aws rds describe-db-clusters \
  --region us-west-2 \
  --query 'DBClusters[?contains(DBClusterIdentifier,`secondary`)].DBClusterArn' \
  --output text

# Remove from global cluster (promotes to standalone writer)
aws rds remove-from-global-cluster \
  --global-cluster-identifier securebase-prod-global \
  --db-cluster-identifier <secondary-cluster-arn>

# Wait for status: available (~3-5 min)
aws rds wait db-cluster-available \
  --db-cluster-identifier securebase-prod-secondary \
  --region us-west-2
```

### Step 2 — Verify DynamoDB Global Table Health

```bash
for TABLE in securebase-tenants securebase-controls-state securebase-tenant-metrics; do
  echo "=== $TABLE ==="
  aws dynamodb describe-table --table-name "$TABLE" --region us-east-1 \
    --query 'Table.Replicas[?RegionName==`us-west-2`].{Status:ReplicaStatus}' \
    --output table
done
```

Expected: `ACTIVE` for each table.

### Step 3 — Update Active Region SSM Parameter

```bash
aws ssm put-parameter \
  --name /securebase/active_region \
  --value us-west-2 \
  --type String \
  --overwrite
```

### Step 4 — Validate API Endpoints

```bash
# Check secondary API health
curl -s https://<secondary-api-endpoint>/health | jq .

# Check CloudFront is routing to secondary
curl -svI https://api.securebase.tximhotep.com/health 2>&1 | grep -E "X-Cache|server|HTTP"
```

### Step 5 — Communicate Failover

Post to incident channel:
> **SecureBase failover complete.** Traffic is now served from us-west-2. Monitoring continues. Next update in 15 minutes.

---

## 5. Rollback / Failback Procedure

Only after primary region health is confirmed fully restored.

### 5.1 Verify Primary Region Recovery

```bash
# Check Aurora primary cluster health
aws rds describe-db-clusters \
  --db-cluster-identifier securebase-phase2-dev \
  --region us-east-1 \
  --query 'DBClusters[0].Status'
# Expected: "available"

# Check CloudWatch error rate in us-east-1
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 5XXError \
  --dimensions Name=ApiName,Value=securebase \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 --statistics Sum \
  --region us-east-1
```

### 5.2 Execute Failback

```bash
aws lambda invoke \
  --function-name securebase-prod-failback-orchestrator \
  --region us-east-1 \
  --payload '{"confirm":true,"reason":"Primary region recovered","operator":"YOUR_NAME"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failback_result.json

cat /tmp/failback_result.json | jq .
```

### 5.3 Verify Failback

1. Confirm SSM `/securebase/active_region` returns `us-east-1`
2. Confirm Aurora is writer in `us-east-1` (status: `available`)
3. Confirm DynamoDB replicas are ACTIVE in both regions
4. Run full validation Lambda
5. Monitor for 30 minutes before closing incident

### 5.4 Close Incident

Post to incident channel:
> **SecureBase traffic restored to us-east-1.** Failback complete at [TIME]. All services healthy. Incident closed. Post-incident review scheduled for [DATE].

---

## 6. Scheduled DR Drill Procedure (Sub-task 2.5)

Monthly drills run automatically (first Sunday, 02:00 UTC) via EventBridge.

### 6.1 Manual Drill Trigger

```bash
aws lambda invoke \
  --function-name securebase-prod-dr-drill \
  --region us-east-1 \
  --payload '{"manual":true,"operator":"YOUR_NAME"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/drill_result.json

cat /tmp/drill_result.json | jq .
```

### 6.2 Drill Pass/Fail Criteria

| Metric | Target | Result |
|--------|--------|--------|
| RTO | < 900 s (15 min) | PASS / FAIL |
| RPO (Aurora lag at failover) | < 1000 ms | PASS / FAIL |
| DynamoDB replicas ACTIVE | 3/3 tables | PASS / FAIL |
| API health post-failover | HTTP 200 | PASS / FAIL |
| Failback completed | Successful | PASS / FAIL |

### 6.3 Retrieve Drill Report

```bash
# List recent drill reports
aws s3 ls s3://<DRILL_REPORT_BUCKET>/dr-drills/ --recursive | sort | tail -10

# Download latest report
aws s3 cp s3://<DRILL_REPORT_BUCKET>/dr-drills/$(date +%Y/%m/%d)/<drill-id>.json /tmp/latest_drill.json
cat /tmp/latest_drill.json | jq .
```

### 6.4 PagerDuty Alert Suppression During Drills

The `dr_drill.py` Lambda automatically sets SSM `/securebase/dr/drill_in_progress=true` before triggering failover and clears it after the drill completes.

The `alert_router.py` Lambda reads this flag and suppresses non-critical PagerDuty pages during the suppression window.

---

## 7. Aurora Global Database Operations (Sub-task 2.1)

### 7.1 Check Global Cluster Topology

```bash
aws rds describe-global-clusters \
  --global-cluster-identifier securebase-prod-global \
  --query 'GlobalClusters[0].{ID:GlobalClusterIdentifier,Members:GlobalClusterMembers[*].{ARN:DBClusterArn,Writer:IsWriter,Status:Status}}' \
  --output json | jq .
```

### 7.2 Check Replication Lag Alarm

```bash
aws cloudwatch describe-alarms \
  --alarm-names securebase-prod-aurora-global-replication-lag \
  --query 'MetricAlarms[0].{State:StateValue,Reason:StateReason}' \
  --output table
```

### 7.3 Manual Aurora Failover (planned)

Use AWS Console or CLI for a planned / managed failover (minimal interruption):

```bash
aws rds failover-global-cluster \
  --global-cluster-identifier securebase-prod-global \
  --target-db-cluster-identifier arn:aws:rds:us-west-2:<ACCOUNT_ID>:cluster:securebase-prod-secondary
```

---

## 8. DynamoDB Global Tables Operations (Sub-task 2.2)

### 8.1 Check Table Replica Status

```bash
for TABLE in securebase-tenants securebase-controls-state securebase-tenant-metrics; do
  echo "=== $TABLE ==="
  aws dynamodb describe-table --table-name "$TABLE" --region us-east-1 \
    --query 'Table.{Replicas:Replicas,StreamSpec:StreamSpecification}' \
    --output json | jq .
done
```

### 8.2 Enable Streams on a Table (if missing)

Streams must be enabled before adding a Global Table replica:

```bash
aws dynamodb update-table \
  --table-name securebase-tenants \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --region us-east-1
```

### 8.3 Application Regional Routing

Application code uses the `AWS_REGION` environment variable (set by Lambda runtime) to route DynamoDB calls to the local region:

```python
import os, boto3
dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
```

After failover, Lambda functions deployed in `us-west-2` automatically use the local replica endpoint. No manual application changes required.

---

## 9. Monitoring Validation After Recovery

Run after every failover and failback to confirm all systems are healthy:

- [ ] API Gateway p95 latency < 500 ms, 5xx error rate < 0.1 %
- [ ] Lambda error/throttle alarms clear in active region
- [ ] Aurora DB connection count and writer status healthy
- [ ] Aurora Global DB replication lag alarm in OK state
- [ ] DynamoDB replication latency alarms clear for all 3 tables
- [ ] S3 CRR `OperationsFailedReplication` alarm clear
- [ ] CloudFront cache hit rate normal
- [ ] Alert routing (PagerDuty/Opsgenie) functioning

---

## 10. Communication Templates

### Initial Notice
> SecureBase is investigating a regional service degradation in us-east-1. Automated DR procedures are in progress. Next update in 10 minutes.

### Failover Complete
> SecureBase failover complete at [TIME]. Traffic is now served from us-west-2. All critical services restored. RTO: [X] minutes. RPO: [X] ms data lag. Monitoring continues.

### Failback Complete
> SecureBase traffic has been restored to us-east-1 primary at [TIME]. All services healthy. Incident resolved. Post-incident review scheduled for [DATE].

### Drill Complete (PASS)
> ✅ Monthly DR drill PASSED. RTO: [X]s / target < 900s. RPO lag: [X]ms / target < 1000ms. Full report: [S3 URI].

### Drill Complete (FAIL)
> ❌ Monthly DR drill FAILED. Failed checks: [LIST]. Immediate review required. Report: [S3 URI].

---

## 11. Terraform Module Reference

| Module | Path | Purpose |
|--------|------|---------|
| Aurora Global | `terraform/modules/aurora-global/` | Aurora Global Cluster, secondary reader, lag alarm |
| DynamoDB Global | `terraform/modules/dynamodb-global/` | Global Table replicas, KMS replica key, lag alarms |
| Multi-Region (Phase 5) | `landing-zone/modules/multi-region/` | S3 CRR, Route53, CloudFront failover, DR Lambdas |

### Usage Example

```hcl
module "aurora_global" {
  source   = "../../modules/aurora-global"

  providers = {
    aws.primary   = aws.us_east_1
    aws.secondary = aws.us_west_2
  }

  environment      = "prod"
  primary_region   = "us-east-1"
  secondary_region = "us-west-2"
  aurora_cluster_id = "securebase-phase2-prod"
  alert_sns_arn     = module.alerting.sns_topic_arn

  tags = { tenant_id = "platform", phase = "6", track = "2" }
}

module "dynamodb_global" {
  source   = "../../modules/dynamodb-global"

  providers = {
    aws.primary   = aws.us_east_1
    aws.secondary = aws.us_west_2
  }

  environment         = "prod"
  primary_region      = "us-east-1"
  secondary_region    = "us-west-2"
  primary_kms_key_arn = module.kms.key_arn
  alert_sns_arn       = module.alerting.sns_topic_arn

  tags = { tenant_id = "platform", phase = "6", track = "2" }
}
```

---

## 12. Frequently Asked Questions

**Q: Will Aurora Serverless v2 (db.serverless) work with Global Database?**  
A: No. Aurora Serverless v2 instances (`db.serverless`) cannot be members of a Global Cluster. A provisioned instance must be added to the cluster before promotion. See comments in `terraform/modules/aurora-global/main.tf`.

**Q: Which DynamoDB tables are replicated?**  
A: `securebase-tenants`, `securebase-controls-state`, and `securebase-tenant-metrics`. These tables are the source of truth for tenant identity, compliance state, and usage metrics.

**Q: Can I add more tables to Global Tables later?**  
A: Yes. Add the table name to `var.table_names` in the `dynamodb-global` module and run `terraform apply`. DynamoDB Streams must be enabled on the table first.

**Q: What happens to in-flight writes during an Aurora failover?**  
A: Writes in flight at the moment of promotion are lost if they haven't been replicated (Aurora Global DB typical lag < 1 s). Applications using optimistic locking / idempotency keys should retry on connection failure.

**Q: How do I verify the drill suppression SSM flag was cleared?**  
A: `aws ssm get-parameter --name /securebase/dr/drill_in_progress --query Parameter.Value --output text` should return `false` after drill completion.

---

*Created: 2026-05-12 | Phase 6 / Track 2 | Owner: @cedrickbyrd*
