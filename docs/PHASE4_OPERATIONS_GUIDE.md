# Phase 4 Operations Guide

**Version:** 1.0  
**Last Updated:** January 24, 2026  
**Target Audience:** DevOps, SREs, Operations Team

---

## Overview

This guide provides operational procedures for managing Phase 4 infrastructure (Analytics and RBAC modules) in production.

---

## Daily Operations

### Health Checks

Run daily health checks to ensure all Phase 4 services are operational:

```bash
#!/bin/bash
# Daily health check script

# Check DynamoDB tables
echo "=== DynamoDB Table Status ==="
aws dynamodb describe-table --table-name securebase-prod-user-sessions --query 'Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount}'
aws dynamodb describe-table --table-name securebase-prod-user-invites --query 'Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount}'
aws dynamodb describe-table --table-name securebase-prod-activity-feed --query 'Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount}'
aws dynamodb describe-table --table-name securebase-prod-reports --query 'Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount}'

# Check Lambda functions
echo ""
echo "=== Lambda Function Status ==="
aws lambda get-function --function-name securebase-prod-user-management --query 'Configuration.{Name:FunctionName,State:State,LastModified:LastModified}'
aws lambda get-function --function-name securebase-prod-session-management --query 'Configuration.{Name:FunctionName,State:State,LastModified:LastModified}'
aws lambda get-function --function-name securebase-prod-report-engine --query 'Configuration.{Name:FunctionName,State:State,LastModified:LastModified}'

# Check recent errors
echo ""
echo "=== Recent Lambda Errors (Last Hour) ==="
aws logs filter-log-events \
  --log-group-name /aws/lambda/securebase-prod-user-management \
  --start-time $(date -u -d '1 hour ago' +%s)000 \
  --filter-pattern "ERROR"
```

### Monitoring Dashboard

Access CloudWatch dashboards:
- Production: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=SecureBase-Phase4-Prod
- Development: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=SecureBase-Phase4-Dev

Key metrics to monitor:
- Lambda invocation count and errors
- DynamoDB read/write capacity consumption
- API Gateway request count and latency
- S3 bucket size (reports)

---

## Incident Response

### Lambda Function Errors

**Symptom:** Increased error rate in CloudWatch Logs

**Investigation:**
```bash
# Get recent error logs
aws logs tail /aws/lambda/securebase-prod-user-management --since 1h --filter-pattern ERROR

# Check Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=securebase-prod-user-management \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Resolution:**
1. Check function configuration for environment variable changes
2. Verify database connectivity
3. Check IAM permissions
4. Review recent code deployments
5. Roll back if recent deployment caused issue

### DynamoDB Throttling

**Symptom:** UserErrors metric increasing

**Investigation:**
```bash
# Check throttle metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=securebase-prod-user-sessions \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Resolution:**
1. Review recent traffic patterns
2. Check for inefficient queries
3. Consider switching to provisioned capacity if sustained high traffic
4. Implement caching for frequently accessed data
5. Add indexes if scan operations are occurring

### API Gateway 5xx Errors

**Symptom:** API Gateway returning 500-series errors

**Investigation:**
```bash
# Check API Gateway logs
aws logs tail /aws/api-gateway/securebase-prod --since 1h --filter-pattern "5xx"

# Check integration with Lambda
aws apigateway get-integration \
  --rest-api-id [api-id] \
  --resource-id [resource-id] \
  --http-method GET
```

**Resolution:**
1. Verify Lambda function is responding
2. Check Lambda timeout settings (increase if needed)
3. Verify IAM permissions for API Gateway to invoke Lambda
4. Review API Gateway integration configuration

---

## Maintenance Procedures

### Updating Lambda Functions

```bash
# 1. Build new deployment package
cd phase2-backend/functions
./package-lambda.sh

# 2. Test locally (optional)
./test-lambda.sh user_management

# 3. Deploy to staging first
aws lambda update-function-code \
  --function-name securebase-staging-user-management \
  --zip-file fileb://../deploy/user_management.zip

# 4. Test staging deployment
aws lambda invoke \
  --function-name securebase-staging-user-management \
  --payload '{"httpMethod":"GET","path":"/users"}' \
  response.json

# 5. Deploy to production
aws lambda update-function-code \
  --function-name securebase-prod-user-management \
  --zip-file fileb://../deploy/user_management.zip

# 6. Monitor for errors
aws logs tail /aws/lambda/securebase-prod-user-management --follow
```

### Updating Environment Variables

```bash
# Update Lambda environment variables
aws lambda update-function-configuration \
  --function-name securebase-prod-user-management \
  --environment Variables="{
    SESSIONS_TABLE=securebase-prod-user-sessions,
    INVITES_TABLE=securebase-prod-user-invites,
    ACTIVITY_FEED_TABLE=securebase-prod-activity-feed,
    DATABASE_ENDPOINT=prod-proxy.region.rds.amazonaws.com,
    DATABASE_NAME=securebase,
    DATABASE_SECRET_ARN=arn:aws:secretsmanager:...,
    ENVIRONMENT=prod,
    LOG_LEVEL=INFO
  }"
```

### Rotating Secrets

```bash
# Rotate database credentials
aws secretsmanager rotate-secret \
  --secret-id securebase-prod-db-credentials

# Rotate JWT secret
aws secretsmanager rotate-secret \
  --secret-id securebase-prod-jwt-secret

# Lambda functions automatically pick up new secrets on next invocation
```

### Cleaning Up Old Data

```bash
# DynamoDB TTL automatically removes expired items
# Manual cleanup if needed:

# Remove old user sessions (older than 30 days)
# Note: Use carefully in production
python3 << 'EOF'
import boto3
from datetime import datetime, timedelta

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('securebase-prod-user-sessions')

cutoff = (datetime.now() - timedelta(days=30)).isoformat()

response = table.scan(
    FilterExpression='expires_at < :cutoff',
    ExpressionAttributeValues={':cutoff': cutoff}
)

for item in response['Items']:
    table.delete_item(Key={
        'customer_id': item['customer_id'],
        'session_id': item['session_id']
    })
EOF

# S3 lifecycle policy automatically removes old reports after 90 days
# Verify lifecycle policy:
aws s3api get-bucket-lifecycle-configuration \
  --bucket securebase-prod-reports-[account-id]
```

---

## Scaling Procedures

### Increase Lambda Concurrency

```bash
# Set reserved concurrency for high-traffic functions
aws lambda put-function-concurrency \
  --function-name securebase-prod-user-management \
  --reserved-concurrent-executions 100

# Check current concurrency
aws lambda get-function-concurrency \
  --function-name securebase-prod-user-management
```

### Switch DynamoDB to Provisioned Capacity

```bash
# For sustained high traffic, switch from PAY_PER_REQUEST to PROVISIONED

# Update table billing mode
aws dynamodb update-table \
  --table-name securebase-prod-user-sessions \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=50

# Enable auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/securebase-prod-user-sessions \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --min-capacity 10 \
  --max-capacity 1000

aws application-autoscaling put-scaling-policy \
  --service-namespace dynamodb \
  --resource-id table/securebase-prod-user-sessions \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --policy-name scaling-policy \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '
  {
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "DynamoDBReadCapacityUtilization"
    }
  }'
```

---

## Backup and Recovery

### DynamoDB Point-in-Time Recovery

All tables have point-in-time recovery enabled. To restore:

```bash
# Restore to a specific point in time
aws dynamodb restore-table-to-point-in-time \
  --source-table-name securebase-prod-user-sessions \
  --target-table-name securebase-prod-user-sessions-restored \
  --restore-date-time 2026-01-24T12:00:00

# Verify restore
aws dynamodb describe-table \
  --table-name securebase-prod-user-sessions-restored
```

### S3 Bucket Versioning

Reports bucket has versioning enabled. To restore a deleted object:

```bash
# List versions
aws s3api list-object-versions \
  --bucket securebase-prod-reports-[account-id] \
  --prefix reports/2026/01/

# Restore specific version
aws s3api copy-object \
  --bucket securebase-prod-reports-[account-id] \
  --copy-source securebase-prod-reports-[account-id]/reports/2026/01/report.pdf?versionId=[version-id] \
  --key reports/2026/01/report.pdf
```

### Lambda Function Versions

```bash
# Publish a new version
aws lambda publish-version \
  --function-name securebase-prod-user-management \
  --description "Production release v1.2.3"

# Create alias pointing to version
aws lambda create-alias \
  --function-name securebase-prod-user-management \
  --name PROD \
  --function-version 5

# Roll back by updating alias
aws lambda update-alias \
  --function-name securebase-prod-user-management \
  --name PROD \
  --function-version 4
```

---

## Performance Optimization

### Lambda Cold Start Optimization

```bash
# Increase memory to improve cold starts
aws lambda update-function-configuration \
  --function-name securebase-prod-user-management \
  --memory-size 1024

# Enable provisioned concurrency (keeps functions warm)
aws lambda put-provisioned-concurrency-config \
  --function-name securebase-prod-user-management \
  --provisioned-concurrent-executions 5 \
  --qualifier PROD
```

### DynamoDB Performance Tuning

```bash
# Add a Global Secondary Index for frequently queried attributes
aws dynamodb update-table \
  --table-name securebase-prod-activity-feed \
  --attribute-definitions \
    AttributeName=resource_type,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --global-secondary-index-updates '[
    {
      "Create": {
        "IndexName": "ResourceTypeIndex",
        "KeySchema": [
          {"AttributeName": "resource_type", "KeyType": "HASH"},
          {"AttributeName": "timestamp", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"}
      }
    }
  ]'
```

---

## Security Operations

### Audit Log Review

```bash
# Review activity feed for suspicious activity
aws dynamodb scan \
  --table-name securebase-prod-activity-feed \
  --filter-expression "action = :action" \
  --expression-attribute-values '{":action":{"S":"failed_login"}}' \
  --limit 100

# Export to S3 for analysis
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:us-east-1:123456789012:table/securebase-prod-activity-feed \
  --s3-bucket securebase-audit-exports \
  --s3-prefix activity-feed/ \
  --export-format DYNAMODB_JSON
```

### Access Review

```bash
# List all IAM policies attached to Lambda roles
aws iam list-attached-role-policies \
  --role-name securebase-prod-user-management-role

# Get specific policy details
aws iam get-role-policy \
  --role-name securebase-prod-user-management-role \
  --policy-name user-management-permissions
```

---

## Cost Optimization

### Monthly Cost Review

```bash
# Get DynamoDB costs
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-01-31 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --filter file://filter.json

# filter.json content:
{
  "Dimensions": {
    "Key": "SERVICE",
    "Values": ["Amazon DynamoDB"]
  }
}

# Get Lambda costs
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-01-31 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["AWS Lambda"]}}'
```

### Optimization Recommendations

1. **DynamoDB**: Review unused indexes and remove them
2. **Lambda**: Right-size memory allocation based on CloudWatch metrics
3. **S3**: Verify lifecycle policies are working
4. **CloudWatch Logs**: Reduce retention if not needed for compliance

---

## Compliance & Reporting

### Generate Compliance Report

```bash
# Export activity feed for compliance audit
python3 << 'EOF'
import boto3
import csv
from datetime import datetime, timedelta

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('securebase-prod-activity-feed')

start_date = (datetime.now() - timedelta(days=30)).isoformat()

response = table.scan(
    FilterExpression='timestamp > :start',
    ExpressionAttributeValues={':start': start_date}
)

with open('activity_report.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Timestamp', 'Customer', 'User', 'Action', 'Resource', 'IP Address'])
    
    for item in response['Items']:
        writer.writerow([
            item['timestamp'],
            item['customer_id'],
            item['user_id'],
            item['action'],
            item.get('resource_type', ''),
            item.get('ip_address', '')
        ])
EOF
```

---

## Contact Information

**On-Call Rotation:**
- Primary: DevOps Team
- Secondary: Backend Engineering
- Escalation: Engineering Manager

**Escalation Path:**
1. DevOps Engineer (15 min response)
2. Senior DevOps Engineer (30 min response)
3. Engineering Manager (1 hour response)
4. VP Engineering (2 hour response)

**Communication Channels:**
- Slack: #securebase-ops
- PagerDuty: SecureBase Phase 4
- Email: ops@securebase.com

---

**Document Version:** 1.0  
**Last Updated:** January 24, 2026  
**Next Review:** February 24, 2026
