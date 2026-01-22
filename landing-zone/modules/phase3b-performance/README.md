# Phase 3B Performance Optimization Module

This Terraform module provides performance optimizations and capacity planning infrastructure for Phase 3B features.

## Features

- **DynamoDB Auto-Scaling**: Automatically scales read/write capacity based on demand
- **CloudWatch Monitoring**: Comprehensive dashboards and alarms for performance metrics
- **Cost Optimization**: Right-sized capacity with on-demand billing for low-traffic tables
- **Performance Alerts**: Automated alerts for throttling, high latency, and errors

## Usage

```hcl
module "phase3b_performance" {
  source = "./modules/phase3b-performance"
  
  environment                  = "prod"
  project_name                 = "securebase"
  aws_region                   = "us-east-1"
  alert_email                  = "devops@securebase.com"
  enable_auto_scaling          = true
  enable_performance_monitoring = true
}
```

## Resources Created

### DynamoDB Tables
- `support_tickets` - Support ticket data with auto-scaling (25-100 RCU/WCU)
- Global Secondary Indexes for status and priority filtering
- TTL enabled for automatic cleanup
- Point-in-time recovery (production only)

### CloudWatch Monitoring
- Performance dashboard with Lambda, DynamoDB, and API Gateway metrics
- CloudWatch Alarms for:
  - DynamoDB throttling
  - Lambda high duration (>1s)
  - Lambda errors (>10 in 5 min)
  - High latency (p95 >500ms)

### Auto-Scaling Policies
- Target tracking at 70% utilization
- Scale-out cooldown: 30 seconds
- Scale-in cooldown: 60 seconds
- Min capacity: 25 RCU/WCU
- Max capacity: 100 RCU/WCU

## Scaling Thresholds

| Customer Count | RCU/WCU | Monthly Cost |
|---------------|---------|--------------|
| 0-100 | 25/25 | $30 |
| 100-500 | 50/50 | $60 |
| 500-1,000 | 75/75 | $90 |
| 1,000-5,000 | 150/150 | $180 |
| 5,000+ | Auto-scale to 100+ | $240+ |

## Performance Targets

- API latency (p95): < 500ms
- Lambda duration (avg): < 300ms
- DynamoDB query latency: < 100ms
- Cache hit rate: > 60%
- Error rate: < 1%

## Monitoring

Access the performance dashboard:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=securebase-{env}-phase3b-performance
```

## Outputs

- `support_tickets_table_name` - Name of the support tickets DynamoDB table
- `performance_dashboard_url` - URL to CloudWatch dashboard
- `alert_topic_arn` - SNS topic ARN for performance alerts

## Cost Optimization

This module implements several cost optimization strategies:

1. **On-demand billing** for low-traffic tables (webhooks, cost forecasts)
2. **Auto-scaling** prevents over-provisioning
3. **Log retention** limits (30 days dev, 90 days prod)
4. **TTL-based cleanup** automatically deletes old records

## Maintenance

Review and adjust:
- Auto-scaling thresholds quarterly
- CloudWatch alarm thresholds based on actual usage
- Log retention policies based on compliance requirements
