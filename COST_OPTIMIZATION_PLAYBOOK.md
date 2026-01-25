# SecureBase Cost Optimization Playbook

**Project:** SecureBase Multi-Tenant PaaS  
**Version:** 1.0  
**Last Updated:** January 25, 2026  
**Status:** Phase 5 Planning Document  
**Owner:** Platform Operations & FinOps Team  
**Review Cycle:** Quarterly

---

## 📋 Executive Summary

This Cost Optimization Playbook provides strategies, best practices, and automation policies for managing infrastructure costs across the SecureBase platform. The playbook focuses on optimizing AWS services while maintaining performance, availability, and security requirements.

**Key Goals:**
- **Cost Predictability:** <10% variance month-over-month
- **Infrastructure Efficiency:** >70% resource utilization
- **Cost per Customer:** <$100/month at scale (100+ customers)
- **Auto-Scaling Effectiveness:** Scale down during low traffic periods
- **Reserved Instance Coverage:** >60% for predictable workloads

**Target Cost Structure (Production):**
- Single-Region: $75-130/month (baseline)
- Multi-Region: $145-291/month (Phase 5)
- Per-Customer Incremental: $50-80/month

---

## 🎯 Cost Optimization Framework

### The Four Pillars

1. **Right-Sizing:** Match resource capacity to actual demand
2. **Auto-Scaling:** Dynamic capacity adjustment based on load
3. **Reserved Capacity:** Commit to predictable workloads (Savings Plans, RIs)
4. **Lifecycle Policies:** Automated data archival and deletion

---

## 💰 Cost Breakdown by Service

### Current Cost Structure (Single Region)

| Service | Monthly Cost | % of Total | Optimization Potential |
|---------|--------------|------------|------------------------|
| **Aurora Serverless v2** | $44-87 | 35-45% | HIGH (right-sizing, scaling) |
| **Lambda** | $10-20 | 8-15% | MEDIUM (concurrency, duration) |
| **DynamoDB** | $5-15 | 4-12% | MEDIUM (on-demand vs provisioned) |
| **API Gateway** | $3.50 | 3-5% | LOW (request-based) |
| **CloudFront** | $5-10 | 4-8% | MEDIUM (cache optimization) |
| **S3** | $5-10 | 4-8% | HIGH (lifecycle, Intelligent-Tier) |
| **CloudWatch** | $3-8 | 2-6% | MEDIUM (log retention) |
| **Data Transfer** | $5-15 | 4-12% | MEDIUM (cross-region, CDN) |
| **RDS Proxy** | $11 | 8-10% | LOW (connection pooling benefit) |
| **Route53** | $0.50-1 | <1% | LOW (essential) |
| **Secrets Manager** | $1-2 | <1% | LOW (essential) |
| **KMS** | $1-2 | <1% | LOW (encryption required) |
| **TOTAL** | **$75-130** | 100% | **~30% potential savings** |

### Multi-Region Cost Impact (Phase 5)

| Service | Single-Region | Multi-Region | Increase |
|---------|---------------|--------------|----------|
| Aurora | $44-87 | $88-174 | 2x |
| DynamoDB | $5-15 | $10-30 | 2x + replication |
| Lambda | $10-20 | $20-40 | 2x |
| S3 | $5-10 | $10-20 | 2x + CRR |
| Data Transfer | $5-15 | $20-40 | ~3x (cross-region) |
| **TOTAL** | **$75-130** | **$145-291** | **~2x** |

**Note:** Multi-region is a business requirement for 99.95% SLA, so focus optimization on efficiency within this architecture.

---

## 📊 Service-Specific Optimization Strategies

### 1. Aurora Serverless v2 Optimization

**Current Configuration:**
- ACU Range: 0.5 - 16 ACUs
- Cost: $0.12/ACU-hour
- Multi-AZ: Yes (required)

**Optimization Strategies:**

#### A. Right-Size ACU Limits

```bash
# Analyze current Aurora utilization
aws cloudwatch get-metric-statistics \
  --region us-east-1 \
  --namespace AWS/RDS \
  --metric-name ServerlessDatabaseCapacity \
  --dimensions Name=DBClusterIdentifier,Value=securebase-prod-cluster \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Maximum,Average

# Expected output: Peak ACU usage, average usage
# If peak <8 ACUs, reduce max from 16 to 8
# Estimated savings: ~$40/month
```

**Recommendation:**
```hcl
# landing-zone/modules/phase2-database/aurora.tf

resource "aws_rds_cluster" "main" {
  # Current: max_capacity = 16
  # Optimized for <100 customers:
  serverlessv2_scaling_configuration {
    min_capacity = 0.5  # Keep minimum low
    max_capacity = 8    # Reduce from 16 (sufficient for 100 customers)
  }
  # Estimated savings: $350-700/month at peak (50% reduction)
}
```

#### B. Schedule Low-Traffic Scaling

```python
# phase2-backend/functions/aurora_scheduler.py
# EventBridge rule: cron(0 2 * * ? *)  # 2 AM UTC (low traffic)

import boto3

def lambda_handler(event, context):
    rds = boto3.client('rds', region_name='us-east-1')
    
    # Night mode: Reduce minimum ACUs during low traffic (2 AM - 6 AM UTC)
    if is_low_traffic_period():
        rds.modify_db_cluster(
            DBClusterIdentifier='securebase-prod-cluster',
            ServerlessV2ScalingConfiguration={
                'MinCapacity': 0.5,  # Allow scale to minimum
                'MaxCapacity': 4     # Reduce peak for low traffic
            }
        )
    else:
        # Day mode: Restore normal scaling
        rds.modify_db_cluster(
            DBClusterIdentifier='securebase-prod-cluster',
            ServerlessV2ScalingConfiguration={
                'MinCapacity': 0.5,
                'MaxCapacity': 8
            }
        )
```

**Estimated Savings:** $100-200/month (by reducing capacity during off-peak 6 hours/day)

---

### 2. Lambda Cost Optimization

**Current Configuration:**
- Runtime: Python 3.11
- Memory: 128 MB (default) to 512 MB (analytics)
- Concurrency: Reserved for critical functions

**Optimization Strategies:**

#### A. Optimize Memory Allocation

```bash
# Use AWS Lambda Power Tuning tool
# https://github.com/alexcasalboni/aws-lambda-power-tuning

# Example: Find optimal memory for auth function
aws lambda invoke \
  --function-name securebase-prod-auth-v2 \
  --payload '{"powerTuningInput": {"lambdaARN": "arn:aws:lambda:...", "powerValues": [128,256,512,1024]}}' \
  output.json

# Typical result: 256 MB is sweet spot (faster, but not proportionally more expensive)
```

**Recommendation:**
- **auth_v2.py:** 256 MB (currently 128 MB) - Faster execution offsets cost
- **billing_worker.py:** 512 MB (currently 1024 MB) - Over-provisioned
- **metrics.py:** 256 MB (currently 512 MB) - Right-sized

**Estimated Savings:** $5-10/month

---

#### B. Reduce Cold Starts with Provisioned Concurrency (Selectively)

```hcl
# Only for latency-critical functions (auth, API endpoints)
# NOT for background workers (billing, metrics)

resource "aws_lambda_provisioned_concurrency_config" "auth" {
  function_name                     = aws_lambda_function.auth_v2.function_name
  provisioned_concurrent_executions = 2  # Keep 2 warm instances
  qualifier                         = aws_lambda_alias.prod.name
}

# Cost: $0.000004133 per GB-second (provisioned) vs $0.000016667 (on-demand)
# For 2 instances × 256 MB × 24h: ~$5/month
# Benefit: Zero cold starts for critical auth path
```

**Trade-off:** Spend $5/month on provisioned concurrency to avoid 500-1000ms cold starts affecting customer experience.

---

#### C. Optimize Lambda Execution Duration

```python
# phase2-backend/lambda_layer/python/db_utils.py

# BAD: Create new DB connection on every invocation
def get_db_connection():
    return psycopg2.connect(dsn)

# GOOD: Reuse connections across invocations (global scope)
db_conn = None

def get_db_connection():
    global db_conn
    if db_conn is None or db_conn.closed:
        db_conn = psycopg2.connect(dsn)
    return db_conn

# Result: Reduce execution time by 50-100ms per invocation
# Estimated savings: $3-5/month
```

---

### 3. DynamoDB Optimization

**Current Configuration:**
- Billing Mode: On-Demand (PAY_PER_REQUEST)
- Cost: $1.25 per million writes, $0.25 per million reads

**Optimization Strategies:**

#### A. Evaluate On-Demand vs Provisioned

```bash
# Calculate monthly request volume
aws cloudwatch get-metric-statistics \
  --region us-east-1 \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=securebase-customers \
  --start-time $(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum

# If >25 RCU or >25 WCU consistently, switch to Provisioned
# Break-even: ~25 RCU/WCU (740 hours/month)
```

**Cost Comparison (100 customers):**

| Mode | Read Requests/Month | Write Requests/Month | Cost |
|------|---------------------|----------------------|------|
| **On-Demand** | 50M reads | 10M writes | ~$25/month |
| **Provisioned (25 RCU/WCU)** | 50M reads | 10M writes | ~$15/month |

**Recommendation:** Switch to Provisioned at >100 customers  
**Estimated Savings:** $10/month per table (5 tables = $50/month)

---

#### B. Enable Auto-Scaling for Provisioned Tables

```hcl
# landing-zone/modules/phase2-database/dynamodb.tf

resource "aws_appautoscaling_target" "dynamodb_table_read" {
  max_capacity       = 100
  min_capacity       = 5
  resource_id        = "table/securebase-customers"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "dynamodb_table_read_policy" {
  name               = "DynamoDBReadCapacityUtilization:${aws_appautoscaling_target.dynamodb_table_read.resource_id}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.dynamodb_table_read.resource_id
  scalable_dimension = aws_appautoscaling_target.dynamodb_table_read.scalable_dimension
  service_namespace  = aws_appautoscaling_target.dynamodb_table_read.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70.0  # Scale at 70% utilization
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
  }
}
```

---

#### C. Use DynamoDB Accelerator (DAX) for Read-Heavy Workloads

**When to Use:** If read requests >100M/month and read-to-write ratio >10:1

**Cost Analysis:**
- DAX Node (cache.t3.small): $0.04/hour = ~$30/month
- Reduced DynamoDB reads: Save ~$20/month (80M reads at $0.25/M)
- **Net Cost:** +$10/month, but 10-100x faster reads

**Decision:** Defer to Phase 6 (not needed at <100 customers)

---

### 4. S3 Storage Optimization

**Current Usage:**
- Audit logs: ~10 GB/month (growing)
- Customer reports/exports: ~5 GB/month
- Terraform state: ~100 MB

**Optimization Strategies:**

#### A. Lifecycle Policies for Audit Logs

```hcl
# landing-zone/modules/logging/s3.tf

resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    id     = "archive-old-logs"
    status = "Enabled"

    transition {
      days          = 90   # Move to IA after 90 days
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365  # Move to Glacier after 1 year
      storage_class = "GLACIER"
    }

    expiration {
      days = 2555  # Delete after 7 years (compliance requirement)
    }
  }
}
```

**Cost Savings:**
- Standard: $0.023/GB/month
- Standard-IA: $0.0125/GB/month (after 90 days)
- Glacier: $0.004/GB/month (after 1 year)

**Estimated Savings:** $5-10/month (50% reduction for logs >90 days old)

---

#### B. Intelligent-Tiering for Unpredictable Access Patterns

```hcl
resource "aws_s3_bucket_lifecycle_configuration" "customer_exports" {
  bucket = aws_s3_bucket.customer_exports.id

  rule {
    id     = "intelligent-tiering"
    status = "Enabled"

    transition {
      days          = 0  # Immediately upon upload
      storage_class = "INTELLIGENT_TIERING"
    }
  }
}
```

**Cost:**
- Monitoring fee: $0.0025 per 1,000 objects
- Storage automatically moved to Archive Access Tier after 90 days
- Estimated savings: $2-5/month

---

### 5. Data Transfer Cost Optimization

**Current Costs:**
- Inter-region (us-east-1 → us-west-2): $0.02/GB
- CloudFront to internet: $0.085/GB (first 10 TB)
- VPC to internet: $0.09/GB

**Optimization Strategies:**

#### A. Maximize CloudFront Cache Hit Ratio

```javascript
// phase3a-portal/src/services/apiService.js

// BAD: Unique URLs prevent caching
const response = await fetch(`/api/data?timestamp=${Date.now()}`);

// GOOD: Cache-friendly URLs with explicit cache headers
const response = await fetch('/api/data', {
  headers: {
    'Cache-Control': 'max-age=300'  // 5 minutes
  }
});
```

**Target:** >80% cache hit ratio  
**Estimated Savings:** $10-20/month on data transfer

---

#### B. Compress API Responses

```python
# phase2-backend/functions/auth_v2.py

import gzip

def lambda_handler(event, context):
    response_body = generate_response()
    
    # Check if client accepts gzip
    if 'gzip' in event.get('headers', {}).get('Accept-Encoding', ''):
        response_body = gzip.compress(response_body.encode('utf-8'))
        headers['Content-Encoding'] = 'gzip'
    
    return {
        'statusCode': 200,
        'headers': headers,
        'body': response_body
    }
```

**Estimated Savings:** 70% reduction in payload size = $5-10/month

---

### 6. CloudWatch Logs Optimization

**Current Configuration:**
- Log retention: 7 days (dev), 30 days (staging), 365 days (prod)
- Cost: $0.50/GB ingested, $0.03/GB/month stored

**Optimization Strategies:**

#### A. Reduce Log Verbosity in Production

```python
# phase2-backend/lambda_layer/python/db_utils.py

import logging
import os

# Use environment variable for log level
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)

# PRODUCTION: INFO level (not DEBUG)
# Estimated reduction: 80% fewer logs
```

**Estimated Savings:** $5-10/month

---

#### B. Export Logs to S3 for Long-Term Storage

```bash
# Monthly cron job to export old CloudWatch Logs to S3
aws logs create-export-task \
  --log-group-name /aws/lambda/securebase-prod-auth-v2 \
  --from $(date -d '30 days ago' +%s)000 \
  --to $(date +%s)000 \
  --destination securebase-prod-archived-logs \
  --destination-prefix cloudwatch-exports/

# Cost comparison:
# CloudWatch Logs: $0.03/GB/month
# S3 Standard-IA: $0.0125/GB/month
# Savings: 58%
```

**Estimated Savings:** $3-5/month

---

## 🤖 Automation & Monitoring

### Auto-Scaling Policies

#### Lambda Concurrency Auto-Scaling

```hcl
# landing-zone/modules/api-gateway/lambda.tf

resource "aws_lambda_function" "auth_v2" {
  # ... existing config

  reserved_concurrent_executions = 50  # Max concurrent executions

  # Auto-scaling via Application Auto Scaling
  # Scales 10-100 based on throttled invocations metric
}

resource "aws_appautoscaling_target" "lambda" {
  max_capacity       = 100
  min_capacity       = 10
  resource_id        = "function:${aws_lambda_function.auth_v2.function_name}:provisioned-concurrency"
  scalable_dimension = "lambda:function:ProvisionedConcurrentExecutions"
  service_namespace  = "lambda"
}
```

---

### Cost Anomaly Detection

```hcl
# landing-zone/modules/monitoring/cost-anomaly.tf

resource "aws_ce_anomaly_monitor" "securebase" {
  name              = "SecureBaseAnomalyMonitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "securebase" {
  name      = "SecureBaseCostAlerts"
  frequency = "DAILY"

  monitor_arn_list = [
    aws_ce_anomaly_monitor.securebase.arn
  ]

  subscriber {
    type    = "EMAIL"
    address = "finops@securebase.io"
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      values        = ["100"]  # Alert if anomaly >$100
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }
}
```

---

### Monthly Cost Review Dashboard

```bash
# Cost analysis script (run monthly)
#!/bin/bash

# Generate cost report for past 30 days
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query "ResultsByTime[0].Groups[]" \
  --output table

# Check for cost anomalies
aws ce get-anomalies \
  --date-interval Start=$(date -d '7 days ago' +%Y-%m-%d) \
  --max-results 10 \
  --query "Anomalies[?Impact.TotalImpact>50]" \
  --output table
```

---

## 📈 Scaling Thresholds & Capacity Planning

### Customer Growth Projections

| Customers | Aurora ACUs | DynamoDB RCU/WCU | Lambda Concurrency | Monthly Cost |
|-----------|-------------|------------------|--------------------|--------------|
| **10** | 2-4 | On-Demand | 10 | $75-130 |
| **50** | 4-8 | 10/10 Provisioned | 25 | $200-350 |
| **100** | 6-12 | 25/25 Provisioned | 50 | $400-600 |
| **500** | 10-20 | 100/100 Provisioned | 200 | $1,500-2,500 |
| **1,000** | 16-32 | 250/250 Provisioned | 500 | $3,000-5,000 |

### Scaling Decision Points

**At 50 customers:**
- [ ] Switch DynamoDB to Provisioned mode
- [ ] Increase Aurora max ACUs to 12
- [ ] Enable Lambda reserved concurrency (critical functions)
- [ ] Implement CloudFront cache optimization

**At 100 customers:**
- [ ] Deploy multi-region architecture (Phase 5)
- [ ] Purchase Aurora Reserved Instances (1-year)
- [ ] Enable DynamoDB auto-scaling
- [ ] Implement Savings Plans (Compute)

**At 500 customers:**
- [ ] Evaluate Aurora Provisioned (vs Serverless)
- [ ] Deploy ElastiCache (DAX for DynamoDB)
- [ ] Multi-region active-active (beyond Phase 5)
- [ ] Dedicated infrastructure for top 10 customers

---

## 💡 Best Practices Checklist

### Monthly FinOps Review

- [ ] Review AWS Cost Explorer for anomalies
- [ ] Check unutilized resources (idle Lambda versions, old snapshots)
- [ ] Validate auto-scaling effectiveness
- [ ] Update capacity planning projections
- [ ] Review and renew Reserved Instances/Savings Plans

### Quarterly Optimization Sprint

- [ ] Run Lambda Power Tuning on all functions
- [ ] Analyze CloudWatch Logs retention policies
- [ ] Review S3 lifecycle policies
- [ ] Audit unused IAM roles, Security Groups
- [ ] Benchmark DynamoDB: On-Demand vs Provisioned
- [ ] Validate CloudFront cache hit ratio

### Annual Architecture Review

- [ ] Evaluate Aurora Serverless vs Provisioned
- [ ] Consider AWS Graviton (Arm-based) for Lambda/RDS
- [ ] Review multi-region strategy cost/benefit
- [ ] Analyze Reserved Instance coverage
- [ ] Benchmark against industry cost metrics

---

## 📊 Cost Optimization KPIs

| KPI | Target | Current | Status |
|-----|--------|---------|--------|
| **Cost Per Customer** | <$100/month | TBD | 🟡 Pending Phase 5 |
| **Aurora ACU Utilization** | >60% | TBD | 🟡 Pending monitoring |
| **Lambda Execution Efficiency** | >80% | TBD | 🟡 Pending tuning |
| **CloudFront Cache Hit Ratio** | >80% | TBD | 🟡 Pending CDN config |
| **DynamoDB Throttling** | <1% | 0% | 🟢 Healthy |
| **S3 Intelligent-Tiering Adoption** | 100% | 0% | 🔴 Not implemented |
| **Reserved Instance Coverage** | >60% | 0% | 🔴 Defer to Phase 6 |
| **Monthly Cost Variance** | <10% | N/A | 🟡 New metric |

---

## 🛠️ Tools & Resources

### AWS Cost Management Tools

- **AWS Cost Explorer:** Visualize spending trends
- **AWS Budgets:** Set alerts for cost thresholds
- **AWS Compute Optimizer:** Right-sizing recommendations
- **AWS Trusted Advisor:** Cost optimization checks (Premium Support)

### Third-Party Tools (Optional)

- **CloudHealth by VMware:** Multi-cloud cost management
- **CloudZero:** Real-time cost allocation
- **Infracost:** Terraform cost estimation (CI/CD integration)

### Terraform Cost Estimation

```bash
# Install Infracost
brew install infracost  # macOS
curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh  # Linux

# Run cost estimate before applying changes
cd landing-zone/environments/prod
infracost breakdown --path .

# Example output:
# Aurora Serverless v2: $44-87/month
# Lambda: $10-20/month
# TOTAL: $75-130/month
```

---

## 📞 FinOps Team Contacts

| Role | Responsibilities | Contact |
|------|-----------------|---------|
| **FinOps Lead** | Cost governance, budget approval | finops-lead@securebase.io |
| **Platform Engineer** | Infrastructure optimization | platform-team@securebase.io |
| **DevOps Engineer** | Auto-scaling, monitoring | devops@securebase.io |
| **VP Engineering** | Strategic cost decisions | vp-eng@securebase.io |

---

## 📝 Document Maintenance

### Review Schedule

- **Monthly:** Cost KPIs review, anomaly detection
- **Quarterly:** Optimization sprint, update projections
- **Annually:** Full architecture cost audit

### Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 25, 2026 | Platform Team | Initial Phase 5 planning document |

---

**Next Review:** Phase 5 kickoff (May 2026)  
**Target Savings:** 20-30% cost reduction through optimization  
**Status:** Draft (Pending Phase 5 implementation)

---

**SecureBase Cost Optimization Playbook**  
*Delivering enterprise SaaS at <$100/customer/month*
