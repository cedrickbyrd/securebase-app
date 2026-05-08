# SecureBase Disaster Recovery Plan (Phase 5)

## 1) DR Architecture Overview

```
                        Internet / Clients
                                |
                        Route53 Health Checks
                                |
                    +-----------+-----------+
                    |                       |
          us-east-1 (PRIMARY)      us-west-2 (SECONDARY)
          active serving region      warm standby region
                    |                       |
             API Gateway + Lambda     API Gateway + Lambda
                    |                       |
              Aurora Global DB <-----> Aurora Global Replica
                    |
          DynamoDB Global Tables (bi-directional replication)
                    |
         S3 Buckets (CRR to secondary region replica buckets)
```

## 2) RTO/RPO Targets by Service

| Service | RTO Target | RPO Target | Replication/Resiliency Mechanism |
|---|---:|---:|---|
| API Gateway + Lambda | < 15 min | N/A (stateless) | Secondary regional stack + Route53 failover |
| Aurora PostgreSQL | < 15 min | < 1 min | Aurora Global Database |
| DynamoDB | < 15 min | < 1 min | Global Tables replication |
| S3 (audit/reporting artifacts) | < 15 min | < 5 min | S3 Cross-Region Replication |
| DNS Routing | < 15 min (includes TTL + detection + routing switch) | N/A | Route53 health checks + failover policy (TTL 30s recommended for prod failover paths) |

### DNS Configuration Note

Lower TTL improves failover convergence but increases DNS query volume. For production **failover Route53 records only** (`api_primary` / `api_secondary` in `landing-zone/modules/multi-region/route53-failover.tf`), use 30s TTL as a required DR setting to align with RTO goals.

## 3) Failover Decision Tree (Automated vs Manual)

1. **CloudWatch + Route53 health alarms fire**
2. If health check failures persist past threshold:
   - **Automated path (default):** invoke `failover_orchestrator` and update DNS/active region marker
3. If orchestrator fails or data-plane checks fail:
   - **Manual path:** incident commander executes manual runbook steps
4. After failover:
   - validate API, DB, replication, dashboards
   - continue incident communications until stable

## 4) Service Recovery Procedures

### Aurora Global Database
1. Confirm primary writer impairment and replica health.
2. Promote secondary writer via orchestrator/manual command.
3. Confirm application connectivity in secondary region.
4. Re-establish global topology for failback planning.

### DynamoDB Global Tables
1. Confirm replica table status is `ACTIVE`.
2. Verify write/read health in secondary region.
3. Validate replication lag alarms are clear.

### S3 CRR
1. Confirm replication role and rule health.
2. Validate recent objects are present in replica buckets.
3. Confirm KMS permissions and replica encryption status.

### Route53 Failover
1. Confirm primary health checks are failing as expected.
2. Confirm secondary health checks are healthy.
3. Validate failover routing record answers secondary endpoint.
4. Validate synthetic API checks from external probes.

## 5) Post-Failover Validation Checklist

- [ ] Route53 resolves to active secondary endpoint
- [ ] API p95 latency < 2s and error rate within threshold
- [ ] Aurora writer accepts traffic in active region
- [ ] DynamoDB read/write paths healthy and replication stable
- [ ] S3 replica data current for critical buckets
- [ ] CloudWatch alarms stable (no unresolved critical alarms)
- [ ] Compliance/audit logging verified and retained

## 6) Contact Matrix & Escalation

| Role | Primary Channel | Escalation Timeout |
|---|---|---|
| On-Call SRE | PagerDuty/Opsgenie + Slack `#incident-bridge` | Immediate |
| Platform Lead | Slack + phone bridge | 10 minutes |
| Security/Compliance Lead | Slack + email | 15 minutes |
| Engineering Director | Phone + incident bridge | 20 minutes |

Escalation path: **On-Call SRE (immediate) → Platform Lead (10 min) → Security/Compliance Lead (15 min) → Engineering Director (20 min)**.

## 7) References

- [DR_RUNBOOK.md](DR_RUNBOOK.md)
- [FAILBACK_PROCEDURE.md](FAILBACK_PROCEDURE.md)
- [MULTI_REGION_TESTING_GUIDE.md](MULTI_REGION_TESTING_GUIDE.md)
