# Phase 4 Component 2: RBAC Deployment Guide

## Overview
This guide covers deploying the Team Collaboration & RBAC features for SecureBase Phase 4.

## Prerequisites
- ✅ Phase 2 database deployed (Aurora PostgreSQL)
- ✅ Phase 3a portal deployed
- ✅ API Gateway infrastructure operational
- ⚠️ AWS SES verified sender email (for user invites)
- ⚠️ JWT secret created in AWS Secrets Manager

## Deployment Steps

### 1. Database Schema Deployment

Deploy the RBAC schema to Aurora PostgreSQL:

```bash
cd /home/runner/work/securebase-app/securebase-app/phase2-backend/database

# Get RDS endpoint from Terraform outputs
RDS_ENDPOINT=$(cd ../../landing-zone && terraform output -raw rds_proxy_endpoint)

# Deploy schema
psql -h $RDS_ENDPOINT -U securebase_app -d securebase -f rbac_schema.sql
```

Verify tables created:
```sql
\dt users
\dt user_sessions
\dt user_permissions
\dt user_invites
\dt activity_feed
\dt team_roles
```

### 2. Package Lambda Functions

```bash
cd /home/runner/work/securebase-app/securebase-app/phase2-backend/functions

# Package all RBAC Lambda functions
./package-rbac-lambdas.sh
```

Expected output:
```
✅ All RBAC Lambda functions packaged successfully!

📁 Deployment files created in ../deploy/:
user_management.zip
session_management.zip
activity_feed.zip
rbac_engine.zip
```

### 3. Configure AWS SES (First Time Only)

Verify your sender email for user invitations:

```bash
aws ses verify-email-identity --email-address noreply@securebase.aws --region us-east-1
```

Check verification status:
```bash
aws ses get-identity-verification-attributes \
  --identities noreply@securebase.aws \
  --region us-east-1
```

### 4. Deploy Infrastructure with Terraform

```bash
cd /home/runner/work/securebase-app/securebase-app/landing-zone

# Initialize (if first time)
terraform init

# Plan to see what will be created
terraform plan

# Apply changes
terraform apply
```

Resources created:
- ✅ 3 DynamoDB tables (user_sessions, user_invites, activity_feed)
- ✅ 3 Lambda functions (user_management, session_management, permission_management)
- ✅ IAM roles and policies
- ✅ CloudWatch log groups
- ✅ API Gateway routes (/users, /auth/login, /activity)

### 5. Verify Deployment

Check Lambda functions:
```bash
aws lambda list-functions --query 'Functions[?contains(FunctionName, `rbac`) || contains(FunctionName, `user`) || contains(FunctionName, `session`)].FunctionName'
```

Check DynamoDB tables:
```bash
aws dynamodb list-tables --query 'TableNames[?contains(@, `user`) || contains(@, `session`) || contains(@, `activity`)]'
```

Check API Gateway endpoints:
```bash
API_ID=$(aws apigateway get-rest-apis --query 'items[?name==`securebase-dev-api`].id' --output text)
aws apigateway get-resources --rest-api-id $API_ID --query 'items[?contains(path, `/users`) || contains(path, `/auth/login`) || contains(path, `/activity`)].path'
```

### 6. Test RBAC Endpoints

Test user creation:
```bash
curl -X POST https://api.securebase.dev/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "name": "Test User",
    "role": "analyst"
  }'
```

Test login:
```bash
curl -X POST https://api.securebase.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "temporary-password-from-email"
  }'
```

### 7. Deploy Frontend Updates

```bash
cd /home/runner/work/securebase-app/securebase-app/phase3a-portal

# Install dependencies (if needed)
npm install

# Build for production
npm run build

# Deploy to S3/CloudFront (adjust for your setup)
aws s3 sync dist/ s3://your-portal-bucket/
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Validation Checklist

### Backend
- [ ] All Lambda functions deployed successfully
- [ ] DynamoDB tables created with correct schemas
- [ ] API Gateway routes responding (200 or 401)
- [ ] CloudWatch logs showing function invocations
- [ ] Database schema deployed (6 tables)

### Frontend
- [ ] Team Management page accessible (/team route)
- [ ] Navigation shows "Team" link for admin/manager roles
- [ ] User list loads without errors
- [ ] Add user form works
- [ ] Role assignment works

### Integration
- [ ] User creation sends invite email via SES
- [ ] Login flow works with temporary password
- [ ] MFA setup flow functional (optional)
- [ ] Activity feed shows all user actions
- [ ] Permission checks enforce RBAC rules

### Security
- [ ] JWT tokens required for protected endpoints
- [ ] Permission checks prevent unauthorized access
- [ ] Audit logging captures all user actions
- [ ] Password hashing uses bcrypt
- [ ] Sessions expire after 24 hours

## Troubleshooting

### Issue: Lambda function missing dependencies
**Error:** `ModuleNotFoundError: No module named 'bcrypt'`

**Solution:**
```bash
cd phase2-backend/functions
pip install -r requirements.txt -t .
./package-rbac-lambdas.sh
```

### Issue: API Gateway returns 403 Forbidden
**Error:** `User is not authorized to access this resource`

**Solution:**
- Check JWT authorizer configuration
- Verify Authorization header format: `Bearer <token>`
- Check Lambda authorizer logs in CloudWatch

### Issue: SES email not sending
**Error:** `Email address is not verified`

**Solution:**
```bash
# Verify sender email
aws ses verify-email-identity --email-address noreply@securebase.aws

# Check verification status
aws ses get-identity-verification-attributes --identities noreply@securebase.aws
```

### Issue: Database connection errors
**Error:** `could not connect to server: Connection refused`

**Solution:**
- Check RDS security group allows Lambda access
- Verify database secret ARN is correct
- Check VPC configuration for Lambda functions

## Rollback Procedure

If deployment fails:

1. **Revert Terraform changes:**
```bash
cd landing-zone
terraform apply -target=module.rbac -destroy
```

2. **Remove database schema (if needed):**
```sql
DROP TABLE IF EXISTS activity_feed CASCADE;
DROP TABLE IF EXISTS user_invites CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS team_roles CASCADE;
```

3. **Revert frontend changes:**
```bash
cd phase3a-portal
git checkout HEAD -- src/App.jsx
npm run build
# Redeploy
```

## Performance Monitoring

Monitor these metrics post-deployment:

- **Lambda Duration:** Should be < 500ms for user operations
- **API Latency:** Should be < 200ms for permission checks
- **DynamoDB Read/Write Units:** Monitor for throttling
- **Email Delivery Rate:** Should be > 95%
- **Session Creation Rate:** Track login activity

## Support

For issues:
- Check CloudWatch Logs: `/aws/lambda/securebase-{env}-{function}`
- Review API Gateway logs
- Check database query logs in Aurora
- Consult `RBAC_TROUBLESHOOTING.md`

## Next Steps

After successful deployment:
1. Create initial admin user manually
2. Test full user lifecycle (create, login, MFA, delete)
3. Run integration test suite
4. Update documentation with actual API endpoints
5. Train support team on new features
6. Notify customers about multi-user capabilities

---

**Last Updated:** 2026-02-03  
**Version:** 1.0  
**Status:** Production Ready
