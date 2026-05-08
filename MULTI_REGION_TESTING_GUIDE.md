# Multi-Region Testing Guide

## Monthly DR drill schedule

- **Frequency:** Monthly (first Tuesday, 02:00 UTC)
- **Owner:** Platform Operations / On-call SRE
- **Goal:** Validate DR controls for RTO < 15 min and RPO < 1 min

### Monthly checklist

- [ ] Freeze non-essential deployments for drill window
- [ ] Confirm us-west-2 standby services are healthy
- [ ] Confirm failover Lambda permissions (least privilege IAM)
- [ ] Confirm KMS keys and encrypted resources are healthy
- [ ] Run automated integration tests
- [ ] Capture timing and data-loss metrics
- [ ] Execute rollback if criteria are not met

## Automated DR test script invocations

```bash
cd phase2-backend/functions
python -m unittest -q test_dr_integration.py
python -m unittest -q test_failover_orchestrator.py
python -m unittest -q test_failback_orchestrator.py
python -m unittest -q test_health_check_aggregator.py
```

## Success criteria

- Aurora failover completes in **< 15 minutes**
- Zero data loss (RPO < 1 minute)
- Automated DR success rate > 95%
- API health endpoint stable after failover/failback

## Chaos engineering scenarios

1. **AZ failure simulation** (single AZ impairment)
2. **Region failure simulation** (primary endpoint outage)
3. **Database failure simulation** (Aurora writer unavailable)

Each scenario must log start/end timestamps, observed RTO/RPO, and remediation actions.

## How to run `test_dr_integration.py`

```bash
cd phase2-backend/functions
python -m unittest -q test_dr_integration.py
```

## Rollback if drill fails

1. Stop drill and keep traffic on known healthy region.
2. Re-run `failover_orchestrator` or `failback_orchestrator` as needed.
3. Verify Route 53 points to healthy endpoint.
4. Validate Aurora writer/replica state.
5. Open incident ticket and attach logs/metrics for root cause analysis.
