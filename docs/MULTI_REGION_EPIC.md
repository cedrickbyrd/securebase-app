# Multi-Region DR Epic

**Last Updated:** May 8, 2026  
**Status:** In Progress

---

## Goal

Deliver active-passive disaster recovery across `us-east-1` (primary) and `us-west-2` (secondary) with clear failover, failback, and operational validation requirements.

---

## Acceptance Criteria

- [ ] Route 53 health checks configured for both regions
- [ ] Lambda functions replicated and warm in `us-west-2`
- [ ] API Gateway deployed in `us-west-2` with correct stage variables
- [ ] RDS/Aurora read replica or cross-region backup in `us-west-2`
- [ ] Failover tested end-to-end (simulate `us-east-1` outage)
- [ ] Failback procedure documented and tested (reference `FAILBACK_PROCEDURE.md`)
- [ ] CloudWatch alarms configured in both regions
- [ ] Terraform state correctly split or uses workspaces for multi-region
- [ ] `DISASTER_RECOVERY_PLAN.md` and `DR_RUNBOOK.md` updated to reflect dual-region

---

## Current Status

Secondary region scaffolding was merged in PR #622. The acceptance criteria above are the remaining verification gates and should not be considered complete until they are explicitly validated.

---

## Related Files

- [`../DISASTER_RECOVERY_PLAN.md`](../DISASTER_RECOVERY_PLAN.md)
- [`../DR_RUNBOOK.md`](../DR_RUNBOOK.md)
- [`../FAILBACK_PROCEDURE.md`](../FAILBACK_PROCEDURE.md)
- [`../MULTI_REGION_TESTING_GUIDE.md`](../MULTI_REGION_TESTING_GUIDE.md)

---

## Milestone Notes

This epic exists so multi-region work is tracked as a milestone instead of being treated as a single `[WIP]` infrastructure PR. All remaining DR scope should be measured against the checklist above before production promotion.
