# Analytics Terraform Module

Terraform module for Phase 4 Advanced Analytics & Reporting infrastructure.

## Features

- DynamoDB tables for reports, schedules, cache, and metrics
- Lambda function for report generation
- S3 bucket for report exports
- IAM roles with least-privilege permissions
- CloudWatch logging and monitoring

## Resources Created

### DynamoDB Tables
- `securebase-{env}-reports`: Report metadata and configurations
- `securebase-{env}-report-schedules`: Scheduled report delivery
- `securebase-{env}-report-cache`: Query result caching (with TTL)
- `securebase-{env}-metrics`: Time-series metrics data

### Lambda Function
- `securebase-{env}-report-engine`: PDF, CSV, Excel, JSON report generation

### S3 Bucket
- `securebase-{env}-reports-{account_id}`: Report export storage

## Usage

```hcl
module "analytics" {
  source = "./modules/analytics"

  environment = "dev"
  
  # Optional: Lambda layer ARN for reporting libraries
  reporting_layer_arn = "arn:aws:lambda:us-east-1:123456789012:layer:reporting:1"
  
  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| environment | Environment name (dev, staging, prod) | `string` | n/a | yes |
| tags | Common tags to apply to all resources | `map(string)` | `{}` | no |
| reporting_layer_arn | ARN of Lambda layer containing ReportLab and openpyxl | `string` | `null` | no |

## Outputs

| Name | Description |
|------|-------------|
| reports_table_name | DynamoDB reports table name |
| reports_table_arn | DynamoDB reports table ARN |
| schedules_table_name | DynamoDB schedules table name |
| schedules_table_arn | DynamoDB schedules table ARN |
| cache_table_name | DynamoDB cache table name |
| cache_table_arn | DynamoDB cache table ARN |
| metrics_table_name | DynamoDB metrics table name |
| metrics_table_arn | DynamoDB metrics table ARN |
| reports_bucket_name | S3 bucket name for report exports |
| reports_bucket_arn | S3 bucket ARN for report exports |
| report_engine_function_name | Lambda function name for report engine |
| report_engine_function_arn | Lambda function ARN for report engine |
| report_engine_invoke_arn | Lambda function invoke ARN for API Gateway |

## Testing

Run module tests:

```bash
cd tests
terraform init
terraform validate
terraform plan
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.5 |
| aws | ~> 5.0 |

## Providers

| Name | Version |
|------|---------|
| aws | ~> 5.0 |

## Security

- All DynamoDB tables encrypted at rest
- S3 bucket encrypted with AES256
- IAM roles follow least-privilege principle
- CloudWatch Logs retention configured
- Point-in-time recovery enabled

## Cost Optimization

- DynamoDB uses PAY_PER_REQUEST billing
- S3 lifecycle policy expires old reports after 90 days
- Lambda memory optimized for performance
- CloudWatch Logs retention set to 30 days

## Monitoring

- CloudWatch Log Group: `/aws/lambda/securebase-{env}-report-engine`
- Recommended metrics to monitor:
  - Lambda invocations and errors
  - DynamoDB read/write capacity
  - S3 bucket size
  - Report generation duration

## License

Copyright © 2026 SecureBase
