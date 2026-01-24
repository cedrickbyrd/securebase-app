# SecureBase Disaster Recovery & Backup Procedures

**Version:** 1.0  
**Last Updated:** January 24, 2026  
**Audience:** DevOps Engineers, SREs, Operations Team

---

## Table of Contents

1. [Overview](#overview)
2. [RTO & RPO Targets](#rto--rpo-targets)
3. [Backup Strategy](#backup-strategy)
4. [Disaster Recovery Plan](#disaster-recovery-plan)
5. [Runbooks](#runbooks)
6. [Testing Procedures](#testing-procedures)
7. [Monitoring & Alerts](#monitoring--alerts)

---

## Overview

This document outlines the disaster recovery (DR) and backup procedures for the SecureBase platform to ensure business continuity and data protection.

### Disaster Scenarios Covered

1. **Database corruption or data loss**
2. **AWS region outage**
3. **Accidental deletion of resources**
4. **Security incident (ransomware, breach)**
5. **Application-level failures**
6. **Infrastructure misconfigurations**

### Success Criteria

- **99.95% uptime** (22 minutes downtime/month)
- **RTO < 1 hour** for critical services
- **RPO < 5 minutes** for database
- **DR test passes quarterly**

---

## RTO & RPO Targets

### Service Level Objectives

| Service | RTO (Recovery Time) | RPO (Recovery Point) | Criticality |
|---------|-------------------|---------------------|-------------|
| Customer Portal (Static) | 15 minutes | 0 (versioned in S3) | High |
| API Gateway | 30 minutes | 0 (stateless) | Critical |
| Lambda Functions | 15 minutes | 0 (versioned code) | Critical |
| Aurora Database | 1 hour | 5 minutes | Critical |
| DynamoDB Tables | 30 minutes | 5 minutes | High |
| ElastiCache Redis | 15 minutes | 1 hour (cache rebuild) | Medium |
| CloudFront CDN | 5 minutes | 0 (global distribution) | High |

### Recovery Priority

**P0 - Immediate (< 15 min):**
- API authentication and authorization
- Customer portal access
- Critical API endpoints

**P1 - Urgent (< 1 hour):**
- Aurora database recovery
- Full API functionality
- Billing system

**P2 - Important (< 4 hours):**
- Analytics and reporting
- Support ticket system
- Webhooks

**P3 - Normal (< 24 hours):**
- Historical report regeneration
- Audit log backfill

---

## Backup Strategy

### Aurora PostgreSQL

**Automated Backups:**
```terraform
resource "aws_rds_cluster" "main" {
  cluster_identifier      = "securebase-prod"
  engine                  = "aurora-postgresql"
  
  # Automated backups
  backup_retention_period = 35  # 35 days (max)
  preferred_backup_window = "03:00-04:00"  # 3-4 AM UTC
  
  # Point-in-time recovery
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  # Deletion protection
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "securebase-prod-final-snapshot"
  
  tags = {
    Backup = "Required"
    Retention = "35days"
  }
}
```

**Manual Snapshots:**
```bash
# Create manual snapshot before major changes
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier securebase-prod \
  --db-cluster-snapshot-identifier securebase-prod-pre-migration-$(date +%Y%m%d)

# List snapshots
aws rds describe-db-cluster-snapshots \
  --db-cluster-identifier securebase-prod

# Copy snapshot to another region (DR)
aws rds copy-db-cluster-snapshot \
  --source-db-cluster-snapshot-identifier arn:aws:rds:us-east-1:123456789012:cluster-snapshot:securebase-prod-snapshot \
  --target-db-cluster-snapshot-identifier securebase-prod-snapshot-dr \
  --source-region us-east-1 \
  --region us-west-2 \
  --kms-key-id arn:aws:kms:us-west-2:123456789012:key/abc123
```

**Point-in-Time Recovery:**
```bash
# Restore to specific time
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier securebase-prod \
  --db-cluster-identifier securebase-prod-restored \
  --restore-to-time 2026-01-24T10:30:00Z \
  --use-latest-restorable-time
```

**Backup Schedule:**
- **Automated**: Daily at 3 AM UTC
- **Manual**: Before deployments, schema changes
- **Retention**: 35 days automated, 90 days manual
- **Cross-region copy**: Weekly to us-west-2

### DynamoDB

**Point-in-Time Recovery:**
```terraform
resource "aws_dynamodb_table" "customers" {
  name           = "securebase-prod-customers"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "customer_id"
  
  # Enable PITR
  point_in_time_recovery {
    enabled = true
  }
  
  tags = {
    Backup = "Required"
    Retention = "35days"
  }
}
```

**On-Demand Backups:**
```bash
# Create backup
aws dynamodb create-backup \
  --table-name securebase-prod-customers \
  --backup-name securebase-prod-customers-$(date +%Y%m%d)

# List backups
aws dynamodb list-backups \
  --table-name securebase-prod-customers

# Restore from backup
aws dynamodb restore-table-from-backup \
  --target-table-name securebase-prod-customers-restored \
  --backup-arn arn:aws:dynamodb:us-east-1:123456789012:table/securebase-prod-customers/backup/01234567890123-abc123
```

**AWS Backup Integration:**
```terraform
resource "aws_backup_plan" "dynamodb" {
  name = "securebase-prod-dynamodb-backup"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 3 * * ? *)"  # 3 AM daily
    
    lifecycle {
      delete_after = 35  # Days
    }
    
    copy_action {
      destination_vault_arn = aws_backup_vault.dr_region.arn
      
      lifecycle {
        delete_after = 90  # Days in DR region
      }
    }
  }
}

resource "aws_backup_selection" "dynamodb" {
  name         = "dynamodb-backup-selection"
  iam_role_arn = aws_iam_role.backup.arn
  plan_id      = aws_backup_plan.dynamodb.id

  resources = [
    "arn:aws:dynamodb:*:*:table/securebase-prod-*"
  ]
}
```

### S3 Buckets

**Versioning & Lifecycle:**
```terraform
resource "aws_s3_bucket" "portal" {
  bucket = "securebase-prod-portal"
  
  tags = {
    Backup = "Required"
  }
}

resource "aws_s3_bucket_versioning" "portal" {
  bucket = aws_s3_bucket.portal.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "portal" {
  bucket = aws_s3_bucket.portal.id

  rule {
    id     = "archive-old-versions"
    status = "Enabled"
    
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
    
    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }
    
    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

# Cross-region replication
resource "aws_s3_bucket_replication_configuration" "portal" {
  bucket = aws_s3_bucket.portal.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "replicate-to-dr"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.portal_dr.arn
      storage_class = "STANDARD_IA"
      
      replication_time {
        status = "Enabled"
        time {
          minutes = 15
        }
      }
      
      metrics {
        status = "Enabled"
        event_threshold {
          minutes = 15
        }
      }
    }
  }
}
```

### Lambda Functions

**Versioning & Aliases:**
```terraform
resource "aws_lambda_function" "auth" {
  function_name = "securebase-prod-auth"
  runtime       = "python3.11"
  
  # Enable versioning
  publish = true
  
  tags = {
    Backup = "Code in Git"
  }
}

resource "aws_lambda_alias" "prod" {
  name             = "prod"
  function_name    = aws_lambda_function.auth.function_name
  function_version = aws_lambda_function.auth.version
  
  # Gradual rollout
  routing_config {
    additional_version_weights = {
      "2" = 0.1  # 10% traffic to new version
    }
  }
}
```

**Code Backup:**
```bash
# All Lambda code stored in Git
git tag -a v1.2.3 -m "Production release 2026-01-24"
git push origin v1.2.3

# Download deployed Lambda code (emergency recovery)
aws lambda get-function --function-name securebase-prod-auth \
  --query 'Code.Location' --output text | xargs curl -o lambda-backup.zip
```

### ElastiCache Redis

**Snapshots:**
```terraform
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "securebase-prod-redis"
  description                = "Redis cluster for caching"
  
  # Automated snapshots
  snapshot_retention_limit   = 7
  snapshot_window            = "03:00-05:00"
  
  # Manual snapshot before changes
  final_snapshot_identifier  = "securebase-prod-redis-final"
}
```

```bash
# Create manual snapshot
aws elasticache create-snapshot \
  --replication-group-id securebase-prod-redis \
  --snapshot-name securebase-prod-redis-$(date +%Y%m%d)

# Copy to DR region
aws elasticache copy-snapshot \
  --source-snapshot-name securebase-prod-redis-20260124 \
  --target-snapshot-name securebase-prod-redis-20260124-dr \
  --target-bucket securebase-dr-snapshots \
  --source-region us-east-1 \
  --region us-west-2
```

**Note:** Redis cache is **not critical** for DR. Can be rebuilt from database.

### Secrets Manager

**Replication:**
```terraform
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "securebase/prod/database"
  description = "Aurora database credentials"
  
  # Replicate to DR region
  replica {
    region     = "us-west-2"
    kms_key_id = aws_kms_key.dr_region.id
  }
  
  tags = {
    Backup = "Replicated"
  }
}
```

### Terraform State

**S3 Backend with Versioning:**
```terraform
terraform {
  backend "s3" {
    bucket         = "securebase-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    
    # Enable versioning on bucket
  }
}
```

**State Backup:**
```bash
# Manual state backup before major changes
terraform state pull > terraform-state-backup-$(date +%Y%m%d).json

# Store in secure S3 bucket
aws s3 cp terraform-state-backup-*.json s3://securebase-state-backups/
```

---

## Disaster Recovery Plan

### Scenario 1: Database Corruption

**Detection:**
- Application errors
- Data integrity violations
- Monitoring alerts

**Recovery Steps:**

1. **Stop writes immediately**
   ```bash
   # Disable API Gateway stage
   aws apigateway update-stage \
     --rest-api-id abc123 \
     --stage-name prod \
     --patch-operations op=replace,path=/deploymentId,value=old-deployment-id
   ```

2. **Identify corruption timestamp**
   ```bash
   # Check CloudWatch logs
   aws logs filter-log-events \
     --log-group-name /aws/rds/cluster/securebase-prod/postgresql \
     --start-time $(date -d '1 hour ago' +%s)000 \
     --filter-pattern "ERROR"
   ```

3. **Restore from point-in-time**
   ```bash
   # Restore to 5 minutes before corruption
   aws rds restore-db-cluster-to-point-in-time \
     --source-db-cluster-identifier securebase-prod \
     --db-cluster-identifier securebase-prod-restored \
     --restore-to-time "2026-01-24T10:25:00Z"
   ```

4. **Validate restored data**
   ```bash
   # Connect and verify
   psql -h securebase-prod-restored.cluster-abc123.us-east-1.rds.amazonaws.com \
     -U admin -d securebase -c "SELECT COUNT(*) FROM customers;"
   ```

5. **Update application configuration**
   ```bash
   # Update Lambda environment variables
   aws lambda update-function-configuration \
     --function-name securebase-prod-auth \
     --environment "Variables={DB_HOST=securebase-prod-restored.cluster-abc123.us-east-1.rds.amazonaws.com}"
   ```

6. **Resume operations**
   ```bash
   # Re-enable API Gateway
   aws apigateway update-stage \
     --rest-api-id abc123 \
     --stage-name prod \
     --patch-operations op=replace,path=/deploymentId,value=current-deployment-id
   ```

**RTO:** 45 minutes  
**RPO:** 5 minutes

### Scenario 2: AWS Region Outage

**Detection:**
- AWS Health Dashboard alerts
- Elevated error rates across all services
- Region-wide service unavailability

**Recovery Steps:**

1. **Activate DR region (us-west-2)**
   ```bash
   # Switch DNS to DR region
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z1234ABCD \
     --change-batch file://failover-to-dr.json
   ```

2. **Promote Aurora read replica**
   ```bash
   # Promote read replica to primary
   aws rds promote-read-replica-db-cluster \
     --db-cluster-identifier securebase-prod-dr-us-west-2
   ```

3. **Update application configuration**
   ```bash
   # Deploy Lambda functions in DR region
   cd terraform/dr
   terraform apply -var="region=us-west-2"
   ```

4. **Validate services**
   ```bash
   # Health check
   curl https://api-dr.securebase.com/health
   
   # Sample API call
   curl -H "Authorization: Bearer $TOKEN" \
     https://api-dr.securebase.com/v1/customers/test
   ```

5. **Communicate with customers**
   ```bash
   # Send status update
   aws sns publish \
     --topic-arn arn:aws:sns:us-west-2:123456789012:customer-alerts \
     --message "SecureBase is now operating from our DR site. All services are available."
   ```

6. **Failback when primary region recovers**
   ```bash
   # Reverse DNS changes
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z1234ABCD \
     --change-batch file://failback-to-primary.json
   ```

**RTO:** 1 hour  
**RPO:** 5 minutes

### Scenario 3: Accidental Resource Deletion

**Detection:**
- Terraform plan shows unexpected changes
- Monitoring alerts for missing resources
- Application errors

**Recovery Steps:**

1. **Identify deleted resources**
   ```bash
   # Check CloudTrail logs
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteDBCluster \
     --max-results 10
   ```

2. **Restore from Terraform state backup**
   ```bash
   # Restore previous state
   aws s3 cp s3://securebase-state-backups/terraform-state-backup-20260123.json .
   terraform state push terraform-state-backup-20260123.json
   
   # Re-create resources
   terraform plan
   terraform apply
   ```

3. **Or restore from AWS Backup**
   ```bash
   # For databases
   aws rds restore-db-cluster-from-snapshot \
     --db-cluster-identifier securebase-prod \
     --snapshot-identifier securebase-prod-auto-backup-2026-01-24
   
   # For DynamoDB
   aws dynamodb restore-table-from-backup \
     --target-table-name securebase-prod-customers \
     --backup-arn arn:aws:dynamodb:us-east-1:123456789012:table/securebase-prod-customers/backup/01234567890
   ```

**RTO:** 30 minutes - 2 hours (depending on resource)  
**RPO:** Last backup (typically < 24 hours)

### Scenario 4: Security Incident

**Detection:**
- GuardDuty findings
- Unusual API activity
- Security team alert

**Recovery Steps:**

1. **Isolate affected resources**
   ```bash
   # Revoke all API keys
   aws lambda invoke \
     --function-name securebase-prod-revoke-all-keys \
     --payload '{"reason":"security_incident"}' \
     response.json
   
   # Disable affected IAM users
   aws iam update-access-key --access-key-id AKIAIOSFODNN7EXAMPLE \
     --status Inactive --user-name CompromisedUser
   ```

2. **Audit compromise scope**
   ```bash
   # Check CloudTrail for unauthorized access
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=Username,AttributeValue=CompromisedUser \
     --start-time $(date -d '7 days ago' +%s) \
     --max-results 1000 > audit.json
   ```

3. **Restore from known-good backup**
   ```bash
   # Restore database from backup before incident
   aws rds restore-db-cluster-to-point-in-time \
     --source-db-cluster-identifier securebase-prod \
     --db-cluster-identifier securebase-prod-clean \
     --restore-to-time "2026-01-20T00:00:00Z"
   ```

4. **Rotate all credentials**
   ```bash
   # Rotate database password
   aws rds modify-db-cluster \
     --db-cluster-identifier securebase-prod \
     --master-user-password $(openssl rand -base64 32) \
     --apply-immediately
   
   # Rotate API secrets
   aws secretsmanager rotate-secret \
     --secret-id securebase/prod/api-keys
   ```

5. **Implement additional security controls**
   ```terraform
   # Add IP whitelist
   resource "aws_wafv2_ip_set" "allowed_ips" {
     name  = "securebase-allowed-ips"
     scope = "REGIONAL"
     
     addresses = [
       "203.0.113.0/24",  # Known good IPs only
     ]
   }
   ```

**RTO:** 2-4 hours  
**RPO:** Backup before incident (may lose some data)

---

## Runbooks

### Daily Checklist

- [ ] Verify automated backups completed
  ```bash
  aws rds describe-db-cluster-snapshots \
    --db-cluster-identifier securebase-prod \
    --snapshot-type automated \
    --max-records 1
  ```

- [ ] Check backup health
  ```bash
  aws backup list-backup-jobs \
    --by-state COMPLETED \
    --start-time $(date -d 'yesterday' +%Y-%m-%dT00:00:00Z)
  ```

- [ ] Review CloudWatch alarms
  ```bash
  aws cloudwatch describe-alarms \
    --state-value ALARM
  ```

### Weekly Checklist

- [ ] Test backup restoration (non-production)
  ```bash
  # Restore to test environment
  aws rds restore-db-cluster-from-snapshot \
    --db-cluster-identifier securebase-test-restore \
    --snapshot-identifier securebase-prod-auto-backup-latest
  ```

- [ ] Verify cross-region replication
  ```bash
  aws s3api head-bucket \
    --bucket securebase-dr-us-west-2 \
    --region us-west-2
  ```

- [ ] Review and update DR documentation

### Monthly Checklist

- [ ] Test DR failover (in maintenance window)
- [ ] Review and update RTO/RPO targets
- [ ] Audit backup retention policies
- [ ] Validate secrets rotation
- [ ] Test restore procedures for each service

### Quarterly Checklist

- [ ] Full DR drill with stakeholders
- [ ] Review and update disaster scenarios
- [ ] Audit IAM permissions for backup/restore
- [ ] Capacity planning for DR region
- [ ] Update on-call procedures

---

## Testing Procedures

### Monthly DR Test

**Objective:** Verify backup integrity and recovery procedures

**Scope:**
- Restore Aurora database from snapshot
- Restore DynamoDB tables from backup
- Verify data integrity

**Procedure:**

1. **Create test environment**
   ```bash
   cd terraform/test-dr
   terraform apply -var="test_date=$(date +%Y%m%d)"
   ```

2. **Restore database**
   ```bash
   aws rds restore-db-cluster-from-snapshot \
     --db-cluster-identifier securebase-test-restore \
     --snapshot-identifier $(aws rds describe-db-cluster-snapshots \
       --db-cluster-identifier securebase-prod \
       --query 'DBClusterSnapshots[0].DBClusterSnapshotIdentifier' \
       --output text)
   ```

3. **Verify data**
   ```bash
   psql -h securebase-test-restore.cluster-abc123.us-east-1.rds.amazonaws.com \
     -U admin -d securebase -f tests/data-integrity-check.sql
   ```

4. **Measure RTO**
   ```bash
   echo "Start time: $(date -Iseconds)" >> dr-test-log.txt
   # ... perform recovery ...
   echo "End time: $(date -Iseconds)" >> dr-test-log.txt
   ```

5. **Document results**
   ```bash
   # Create test report
   cat > dr-test-report-$(date +%Y%m%d).md <<EOF
   # DR Test Report
   
   Date: $(date)
   Tester: $USER
   
   ## Results
   - RTO Achieved: XX minutes (Target: 60 minutes)
   - RPO Achieved: XX minutes (Target: 5 minutes)
   - Data Integrity: PASS/FAIL
   - Issues Found: None/Details
   
   ## Recommendations
   - ...
   EOF
   ```

6. **Cleanup**
   ```bash
   terraform destroy -var="test_date=$(date +%Y%m%d)"
   ```

### Quarterly Full DR Drill

**Objective:** Simulate complete region failure

**Scope:**
- Failover to DR region (us-west-2)
- Restore all services
- Validate customer access
- Test failback procedures

**Participants:**
- DevOps team
- Engineering team
- Support team
- Management

**Timeline:** 4 hours (scheduled maintenance window)

**Success Criteria:**
- All services restored in DR region within 1 hour
- No data loss
- Customer access validated
- Successful failback to primary region

---

## Monitoring & Alerts

### Backup Monitoring

**CloudWatch Alarms:**

```terraform
resource "aws_cloudwatch_metric_alarm" "backup_failed" {
  alarm_name          = "securebase-prod-backup-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BackupJobFailures"
  namespace           = "AWS/Backup"
  period              = 86400  # 24 hours
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Backup job failed"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "rds_snapshot_age" {
  alarm_name          = "securebase-prod-rds-snapshot-age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BackupAge"
  namespace           = "AWS/RDS"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 86400  # 24 hours
  alarm_description   = "Aurora snapshot older than 24 hours"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
}
```

### DR Readiness Checks

**Lambda Function:**

```python
import boto3
from datetime import datetime, timedelta

def check_dr_readiness(event, context):
    """Verify DR readiness every 24 hours"""
    
    checks = {
        'aurora_backup': check_aurora_backup(),
        'dynamodb_backup': check_dynamodb_backup(),
        's3_replication': check_s3_replication(),
        'secrets_replication': check_secrets_replication(),
        'dr_region_health': check_dr_region_health()
    }
    
    failed = [k for k, v in checks.items() if not v]
    
    if failed:
        send_alert(f"DR readiness check failed: {', '.join(failed)}")
    
    return {
        'statusCode': 200 if not failed else 500,
        'body': json.dumps(checks)
    }

def check_aurora_backup():
    rds = boto3.client('rds')
    snapshots = rds.describe_db_cluster_snapshots(
        DBClusterIdentifier='securebase-prod',
        SnapshotType='automated',
        MaxRecords=1
    )
    
    if not snapshots['DBClusterSnapshots']:
        return False
    
    latest = snapshots['DBClusterSnapshots'][0]
    snapshot_time = latest['SnapshotCreateTime']
    
    # Check if snapshot is less than 24 hours old
    return (datetime.now(timezone.utc) - snapshot_time) < timedelta(hours=24)
```

**CloudWatch Event Rule:**

```terraform
resource "aws_cloudwatch_event_rule" "dr_readiness_check" {
  name                = "securebase-dr-readiness-check"
  description         = "Check DR readiness daily"
  schedule_expression = "rate(24 hours)"
}

resource "aws_cloudwatch_event_target" "dr_readiness_check" {
  rule      = aws_cloudwatch_event_rule.dr_readiness_check.name
  target_id = "DrReadinessLambda"
  arn       = aws_lambda_function.dr_readiness_check.arn
}
```

---

## Contacts & Escalation

### On-Call Rotation

| Role | Primary | Backup |
|------|---------|--------|
| DevOps Lead | person@example.com | backup@example.com |
| Database Admin | dba@example.com | dba-backup@example.com |
| Security Lead | security@example.com | security-backup@example.com |
| VP Engineering | vp@example.com | - |

### Escalation Path

1. **P0 - Critical Outage** (> 10% customers affected)
   - Notify: DevOps on-call
   - CC: VP Engineering, CTO
   - SLA: 5 minute response

2. **P1 - Major Incident** (Single region down, data loss)
   - Notify: DevOps on-call, Database Admin
   - CC: Engineering Lead
   - SLA: 15 minute response

3. **P2 - Minor Incident** (Degraded performance, single customer)
   - Notify: DevOps on-call
   - SLA: 1 hour response

### Communication Channels

- **Slack:** #incidents, #on-call
- **PagerDuty:** Critical alerts
- **Email:** incidents@securebase.com
- **Status Page:** status.securebase.com

---

## Compliance & Audit

### Retention Policies

| Data Type | Retention | Storage Class | Compliance |
|-----------|-----------|---------------|------------|
| Aurora Snapshots | 35 days | N/A | SOC 2 |
| DynamoDB Backups | 35 days | N/A | SOC 2 |
| S3 Versions | 365 days | Glacier after 90 days | GDPR |
| CloudTrail Logs | 10 years | Glacier | SOC 2, HIPAA |
| Application Logs | 90 days | S3 Standard | SOC 2 |

### Audit Requirements

- **SOC 2 Type II:** Quarterly DR tests documented
- **HIPAA:** Encrypted backups, access logs
- **GDPR:** Data deletion capabilities, audit trail

---

## Appendix

### Automation Scripts

All DR scripts are located in `scripts/dr/`:

- `backup-now.sh` - Create manual backups of all services
- `restore-database.sh` - Restore Aurora from snapshot
- `failover-to-dr.sh` - Failover to DR region
- `validate-backups.sh` - Verify backup integrity
- `test-recovery.sh` - Run DR test in isolated environment

### Additional Resources

- [AWS Backup Documentation](https://docs.aws.amazon.com/backup/)
- [RDS Point-in-Time Recovery](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)
- [DynamoDB Backup and Restore](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/BackupRestore.html)

---

**Document Version:** 1.0  
**Last DR Test:** TBD  
**Next DR Test:** TBD  
**Last Updated:** January 24, 2026  
**Next Review:** February 24, 2026
