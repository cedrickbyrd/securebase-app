# Sprint #2 — Phase 5.3–5.6: SRE Dashboard, Multi-Region DR, Alerting & Tracing

**Sprint:** #2  
**Branch:** `copilot/start-sprint-2`  
**Start Date:** April 2026  
**Target End:** ~6 weeks from start  
**Owner:** @cedrickbyrd  

---

## 🎯 Sprint Goal

Complete the remaining Phase 5 deliverables:
1. Finish Phase 5.3 — SRE/Operations Dashboard (backend + infrastructure)
2. Implement Phase 5.4 — Multi-Region Disaster Recovery (Terraform)
3. Implement Phase 5.5 — Alerting & Incident Response (PagerDuty integration)
4. Implement Phase 5.6 — Distributed Tracing (AWS X-Ray)

---

## 📊 Sprint Context

| Component | Status Before Sprint |
|-----------|----------------------|
| Phase 5.1 — Admin Dashboard | ✅ Complete |
| Phase 5.2 — Tenant Dashboard | ✅ Complete |
| Phase 5.3 — SRE Dashboard (frontend) | ✅ Complete (`SREDashboard.jsx`, `AlertManagement.jsx`) |
| Phase 5.3 — SRE Dashboard (backend + infra) | 🔨 **This Sprint** |
| Phase 5.4 — Multi-Region DR | 🔨 **This Sprint** |
| Phase 5.5 — Alerting & Incident Response | 🔨 **This Sprint** |
| Phase 5.6 — Distributed Tracing | 🔨 **This Sprint** |

---

## 📦 Deliverables

### 5.3 — SRE Dashboard Backend & Infrastructure

**Backend:**
- [ ] `phase2-backend/functions/sre_metrics.py` — Lambda for SRE metrics (CloudWatch aggregation, Lambda cold starts, DB IOPS, DLQ depth, deployment history)
- [ ] `phase2-backend/functions/test_sre_metrics.py` — Unit tests (>90% coverage)

**Infrastructure (Terraform):**
- [ ] `landing-zone/modules/phase5-sre-metrics/main.tf` — DynamoDB table `sre_ops_metrics`, SNS topics, CloudWatch alarms, IAM roles
- [ ] `landing-zone/modules/phase5-sre-metrics/outputs.tf`
- [ ] `landing-zone/modules/phase5-sre-metrics/variables.tf`
- [ ] Wire module in `landing-zone/environments/dev/main.tf`

**API Gateway:**
- [ ] Add `/sre/*` routes in `landing-zone/modules/api-gateway/main.tf`

**Docs:**
- [ ] `SRE_METRICS_API.md` — API reference for SRE endpoints

---

### 5.4 — Multi-Region Disaster Recovery

**Infrastructure (Terraform):**
- [ ] `landing-zone/modules/multi-region/main.tf` — Aurora Global Database, DynamoDB Global Tables, S3 CRR, Route 53 health-check failover
- [ ] `landing-zone/modules/multi-region/outputs.tf`
- [ ] `landing-zone/modules/multi-region/variables.tf`
- [ ] Wire module in `landing-zone/environments/dev/main.tf`

**Target SLA:**
- RTO < 15 minutes
- RPO < 1 minute
- Aurora replication lag < 1 second (us-east-1 → us-west-2)

**Docs:**
- [ ] `MULTI_REGION_DR_GUIDE.md` — Failover runbook and validation steps

---

### 5.5 — Alerting & Incident Response

**Backend:**
- [ ] `phase2-backend/functions/alerting_engine.py` — Lambda for alert evaluation, PagerDuty webhook dispatch, escalation policy
- [ ] `phase2-backend/functions/test_alerting_engine.py`

**Infrastructure:**
- [ ] `landing-zone/modules/phase5-alerting/main.tf` — SNS topics, CloudWatch anomaly detection alarms (40+ rules), EventBridge rules, PagerDuty integration via SSM Parameter Store
- [ ] Wire module in `landing-zone/environments/dev/main.tf`

**Docs:**
- [ ] `ALERT_PLAYBOOKS.md` — 20+ alert scenarios with remediation steps

---

### 5.6 — Distributed Tracing (AWS X-Ray)

**Infrastructure:**
- [ ] Enable X-Ray active tracing on all Lambda functions (update `landing-zone/modules/lambda-functions/main.tf`)
- [ ] X-Ray sampling rules for cost control
- [ ] CloudWatch ServiceLens integration
- [ ] VPC Flow Logs enabled for zero-leakage verification

**Docs:**
- [ ] `DISTRIBUTED_TRACING_GUIDE.md` — X-Ray setup, sampling config, ServiceLens dashboards

---

## ✅ Acceptance Criteria

| Criterion | Target |
|-----------|--------|
| SRE Dashboard loads with live CloudWatch data | <2 seconds |
| Alert detection latency | <5 minutes |
| Alert false-positive rate | <5% |
| Aurora Global Database replication lag | <1 second |
| Automated failover success rate | >95% |
| RTO | <15 minutes |
| RPO | <1 minute |
| X-Ray traces visible for all API→Lambda→Aurora paths | 100% |
| All Lambda functions with active tracing | 100% |

---

## 🔗 Related Issues & Documents

- Issue [#26](https://github.com/cedrickbyrd/securebase-app/issues/26) — SRE/Operations Dashboard
- [`PHASE5_SCOPE.md`](./PHASE5_SCOPE.md) — Full Phase 5 specification
- [`DISASTER_RECOVERY_PLAN.md`](./DISASTER_RECOVERY_PLAN.md) — DR strategy
- [`DR_RUNBOOK.md`](./DR_RUNBOOK.md) — Step-by-step operational runbook
- [`SRE_RUNBOOK.md`](./SRE_RUNBOOK.md) — SRE operational runbook
- [`ROADMAP.md`](./ROADMAP.md) — Project roadmap

---

## 🏁 Definition of Done

- [ ] All backend Lambda functions deployed and returning live data
- [ ] All Terraform modules validated (`terraform validate`) and planned (`terraform plan`)
- [ ] All unit tests passing with >90% coverage
- [ ] SREDashboard wired to live `/sre/*` API endpoints (not just mock data)
- [ ] Multi-region module plan reviewed and approved
- [ ] PagerDuty integration tested end-to-end
- [ ] X-Ray traces visible in AWS Console
- [ ] All docs updated
- [ ] PR approved and merged to `main`
