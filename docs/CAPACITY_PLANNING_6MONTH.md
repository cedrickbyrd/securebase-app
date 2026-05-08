# SecureBase 6-Month Capacity Planning Model

## Current Baseline
- **Lambda concurrency:** 200 reserved (core APIs), 100 reserved (ops workloads)
- **Aurora Serverless v2 ACU:** min 0.5 / max 4
- **DynamoDB throughput:** PAY_PER_REQUEST for tenant metrics; provisioned autoscaling for predictable tables

## Growth Assumptions
- **Tenant growth rate:** +12% month-over-month
- **API request growth:** +15% month-over-month

## Month-by-Month Projections

| Month | Lambda Reserved Concurrency | Aurora ACU (Min/Max) | DynamoDB Capacity (Read/Write) | S3 Storage | Estimated AWS Cost |
|---|---:|---|---|---:|---:|
| Month 1 | 300 | 0.5 / 4 | 200 / 100 | 2.0 TB | $310 |
| Month 2 | 340 | 0.5 / 4 | 240 / 120 | 2.3 TB | $330 |
| Month 3 | 390 | 1 / 6 | 280 / 140 | 2.6 TB | $355 |
| Month 4 | 450 | 1 / 6 | 330 / 165 | 3.0 TB | $380 |
| Month 5 | 520 | 1 / 8 | 390 / 195 | 3.5 TB | $410 |
| Month 6 | 600 | 2 / 8 | 460 / 230 | 4.0 TB | $445 |

## Scaling Trigger Thresholds and Recommended Actions
- **Lambda concurrency > 75% sustained (15 min):** Increase reserved concurrency by 20% and review throttles.
- **Aurora CPU > 70% sustained (30 min):** Raise max ACU by +2 and evaluate connection pooling.
- **DynamoDB throttles > 0 for 3 periods:** Increase autoscaling max and inspect hot partitions.
- **S3 storage growth > 20% month-over-month:** Expand lifecycle tiering and archive policies.
- **Monthly cost > 80% budget by day 20:** Trigger FinOps review and apply RI/SP recommendations.

## Review Cadence
- **Monthly SRE capacity review** with FinOps, Platform, and on-call leads.
