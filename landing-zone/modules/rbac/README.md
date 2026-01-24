# RBAC Terraform Module

Terraform module for Phase 4 Role-Based Access Control (RBAC) and user management infrastructure.

## Features

- DynamoDB tables for user sessions, invites, and activity tracking
- Lambda functions for user management, session management, and permissions
- IAM roles with least-privilege permissions
- CloudWatch logging and monitoring
- Full audit trail of user actions

## Resources Created

### DynamoDB Tables
- `securebase-{env}-user-sessions`: JWT session management
- `securebase-{env}-user-invites`: User invitation tracking
- `securebase-{env}-activity-feed`: Audit log of all user actions

### Lambda Functions
- `securebase-{env}-user-management`: User CRUD operations and role assignment
- `securebase-{env}-session-management`: Authentication and session validation
- `securebase-{env}-permission-management`: Permission checks and enforcement

## Usage

```hcl
module "rbac" {
  source = "./modules/rbac"

  environment         = "dev"
  database_endpoint   = "proxy.region.rds.amazonaws.com"
  database_name       = "securebase"
  database_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:db"
  jwt_secret_arn      = "arn:aws:secretsmanager:us-east-1:123456789012:secret:jwt"
  
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
| database_endpoint | RDS Proxy endpoint for database connections | `string` | n/a | yes |
| database_name | Name of the PostgreSQL database | `string` | `"securebase"` | no |
| database_secret_arn | ARN of Secrets Manager secret containing database credentials | `string` | n/a | yes |
| jwt_secret_arn | ARN of Secrets Manager secret containing JWT signing key | `string` | n/a | yes |
| tags | Common tags to apply to all resources | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| user_sessions_table_name | DynamoDB user sessions table name |
| user_sessions_table_arn | DynamoDB user sessions table ARN |
| user_invites_table_name | DynamoDB user invites table name |
| user_invites_table_arn | DynamoDB user invites table ARN |
| activity_feed_table_name | DynamoDB activity feed table name |
| activity_feed_table_arn | DynamoDB activity feed table ARN |
| user_management_function_name | Lambda function name for user management |
| user_management_function_arn | Lambda function ARN for user management |
| user_management_invoke_arn | Lambda function invoke ARN for API Gateway |
| session_management_function_name | Lambda function name for session management |
| session_management_function_arn | Lambda function ARN for session management |
| session_management_invoke_arn | Lambda function invoke ARN for API Gateway |
| permission_management_function_name | Lambda function name for permission management |
| permission_management_function_arn | Lambda function ARN for permission management |
| permission_management_invoke_arn | Lambda function invoke ARN for API Gateway |

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

## Security Features

- All DynamoDB tables encrypted at rest
- IAM roles follow least-privilege principle
- Session management with JWT tokens
- Activity feed provides complete audit trail
- Secrets Manager for sensitive credentials
- CloudWatch Logs for monitoring

## RBAC Roles

The module supports integration with PostgreSQL RBAC roles:
- **admin**: Full access to all resources
- **manager**: Can manage users and view all data
- **analyst**: Read-only access to most resources
- **viewer**: Limited read-only access

## Audit & Compliance

The activity feed table tracks:
- User login/logout events
- Permission changes
- Resource access
- Configuration modifications
- Failed authentication attempts

All events include:
- Timestamp
- User ID
- Action type
- Resource affected
- IP address
- Before/after values

## Cost Optimization

- DynamoDB uses PAY_PER_REQUEST billing
- TTL enabled for expired sessions and invites
- CloudWatch Logs retention set to 30 days
- Lambda memory optimized per function

## Monitoring

CloudWatch Log Groups:
- `/aws/lambda/securebase-{env}-user-management`
- `/aws/lambda/securebase-{env}-session-management`
- `/aws/lambda/securebase-{env}-permission-management`

Recommended metrics to monitor:
- Lambda invocations and errors
- Authentication success/failure rates
- Session creation rate
- Permission check latency
- Activity feed write rate

## Integration

This module integrates with:
- Phase 2 database (PostgreSQL via RDS Proxy)
- API Gateway for HTTP endpoints
- Phase 3a Portal for frontend
- AWS Secrets Manager for credentials

## License

Copyright © 2026 SecureBase
