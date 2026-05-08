# SecureBase Cost Optimization Playbook (Phase 5)

## 1) Current Cost Baseline (Fill with live monthly values)

Populate monthly values from AWS Cost Explorer grouped by `SERVICE` and filtered by `Project=securebase` tag (last 30 days). Initial baseline must be completed within 2 weeks of Phase 5 production rollout. Maintain monthly tracking in the FinOps operations sheet; update this repository table quarterly (or after major architecture changes).

| Service | Current Spend (USD) | Baseline Target (USD) | Notes |
|---|---:|---:|---|
| Lambda | TBD | TBD | Include invocations, duration, provisioned concurrency |
| DynamoDB | TBD | TBD | Include table + global table replica costs |
| Aurora | TBD | TBD | Include ACU usage + storage + I/O |
| S3 | TBD | TBD | Include storage tiers + CRR transfer |
| CloudFront | TBD | TBD | Include requests + data transfer out |
| CloudWatch/X-Ray | TBD | TBD | Include logs, metrics, traces |
| Route53 | TBD | TBD | Include health checks + DNS queries |
| **Total** | **TBD** | **TBD** | Monthly FinOps review source of truth |

## 2) Per-Service Optimization Strategies

### Lambda
- Use reserved concurrency for noisy functions to protect critical paths.
- Use provisioned concurrency only for latency-sensitive APIs.
- Right-size memory and timeout based on p95 duration profiling.

### DynamoDB
- Use auto scaling on provisioned tables with a 70–80% utilization target, tuned based on observed throttling risk and cost/performance trade-offs.
  - Prefer **70%** for unpredictable bursty workloads and stricter latency SLOs.
  - Prefer **80%** for steady predictable workloads where higher utilization improves cost efficiency.
- Keep tables on on-demand when average utilization stays below ~10 RCU / 10 WCU or <1M requests/month.
- Monitor throttles and replication metrics for global tables.
- Implementation reference: configure `target_tracking_scaling_policy_configuration.target_value` in Terraform auto-scaling policies under `landing-zone/modules/phase5-cost/main.tf` and `landing-zone/modules/phase5-cost-optimization/main.tf`.

### Aurora
- Tune Serverless v2 min/max ACU by environment and traffic profile.
- Use scheduler-based off-peak ACU reduction.
- Track connection count and replica lag to avoid overprovisioning.

### S3
- Apply lifecycle transitions to Intelligent-Tiering/Glacier classes.
- Enforce CRR only on required compliance buckets.
- Expire noncurrent versions and incomplete multipart uploads.

### CloudFront
- Use optimized cache policy for API and static origins.
- Monitor cache hit ratio and adjust TTLs.
- Reduce unnecessary origin fetches to lower transfer and compute costs.

## 3) Cost Allocation Tagging Strategy

Apply and enforce these tags for all new Phase 5 resources:
- `Project=securebase`
- `Phase=5`
- `ManagedBy=IaC`
- `Environment=<dev|staging|prod>`
- `ComplianceFramework=SOC2,FedRAMP,HIPAA` (where applicable)

## 4) Reserved Capacity / Savings Plans Guidance

- Evaluate Compute Savings Plans for steady Lambda/API baseline.
- Evaluate Aurora reserved capacity once usage stabilizes.
- Reassess commitments monthly using 30/90-day usage trends.

## 5) Monthly Cost Review Process

1. Export month-to-date spend by service and tag.
2. Review anomaly alerts and root causes.
3. Compare actual vs baseline by environment.
4. Track realized savings from automation changes.
5. Create action items and owners for next cycle.

## 6) Automation Opportunities

- EventBridge schedules for Aurora ACU right-sizing windows.
- DynamoDB target-tracking auto scaling policies.
- S3 lifecycle and Intelligent-Tiering automation.
- Cost anomaly alerts routed via SNS + incident tooling.
- CI drift detection for cost-critical Terraform resources.
