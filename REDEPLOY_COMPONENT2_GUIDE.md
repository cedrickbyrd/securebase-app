# How to Redeploy Phase 4 Component 2

**Quick Answer:** Run `./redeploy-phase4-component2.sh`

---

## What is Component 2?

**Component 2** is the **Team Collaboration & RBAC (Role-Based Access Control)** system that enables:
- Multi-user team support
- 4 predefined roles (Admin, Manager, Analyst, Viewer)
- User management (create, invite, edit, delete)
- Session management (login, MFA, logout)
- Permission enforcement
- Audit logging

---

## Quick Deployment

### First Time (Full Deployment)
```bash
./deploy-phase4-component2.sh
```

This will:
1. Package 3 Lambda functions
2. Create JWT secret (if not exists)
3. Configure Terraform
4. Deploy all infrastructure
5. Validate deployment

**Time:** 5-10 minutes

### Updates (Code Changes Only)
```bash
./redeploy-phase4-component2.sh
```

This will:
1. Re-package Lambda functions
2. Update code in AWS
3. Verify updates

**Time:** 1-2 minutes

### Verify Deployment
```bash
./validate-phase4-component2.sh
```

This checks:
- DynamoDB tables
- Lambda functions
- IAM roles
- CloudWatch logs
- Secrets Manager

---

## What Gets Deployed

### Infrastructure
| Type | Count | Names |
|------|-------|-------|
| DynamoDB Tables | 3 | user-sessions, user-invites, activity-feed |
| Lambda Functions | 3 | user-management, session-management, permission-management |
| IAM Roles | 3 | One per Lambda function |
| CloudWatch Logs | 3 | One per Lambda function |
| Secrets | 1 | JWT signing secret |

### Lambda Functions
1. **user-management** - User CRUD operations
   - Source: `phase2-backend/functions/user_management.py`
   - Package: `phase2-backend/deploy/user_management.zip`

2. **session-management** - Authentication & sessions
   - Source: `phase2-backend/functions/session_management.py`
   - Package: `phase2-backend/deploy/session_management.zip`

3. **permission-management** - RBAC enforcement
   - Source: `phase2-backend/functions/rbac_engine.py`
   - Package: `phase2-backend/deploy/permission_management.zip`

---

## Common Tasks

### Update Single Lambda Function
```bash
# Package the function
cd phase2-backend/functions
zip -j ../deploy/user_management.zip user_management.py

# Update in AWS
aws lambda update-function-code \
  --function-name securebase-dev-user-management \
  --zip-file fileb://../deploy/user_management.zip
```

### View Lambda Logs
```bash
aws logs tail /aws/lambda/securebase-dev-user-management --follow
```

### Test Lambda Function
```bash
aws lambda invoke \
  --function-name securebase-dev-user-management \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  output.json

cat output.json
```

### Check Deployment Status
```bash
# Check Lambda functions
aws lambda list-functions | grep securebase-dev

# Check DynamoDB tables
aws dynamodb list-tables | grep securebase-dev

# Check IAM roles
aws iam list-roles | grep securebase-dev
```

---

## Troubleshooting

### Problem: Lambda not found
**Solution:** Run full deployment: `./deploy-phase4-component2.sh`

### Problem: JWT secret missing
**Solution:** Script will create it automatically, or manually:
```bash
JWT_SECRET=$(openssl rand -base64 32)
aws secretsmanager create-secret \
  --name "securebase/dev/jwt-secret" \
  --secret-string "$JWT_SECRET"
```

### Problem: Terraform module not found
**Solution:** Run `terraform init -upgrade` in `landing-zone/environments/dev/`

### Problem: Database connection fails
**Solution:** Check Aurora endpoint and security groups

---

## Documentation

- **Full Guide:** [DEPLOY_PHASE4_COMPONENT2.md](DEPLOY_PHASE4_COMPONENT2.md)
- **Quick Reference:** [PHASE4_COMPONENT2_QUICK_REFERENCE.md](PHASE4_COMPONENT2_QUICK_REFERENCE.md)
- **API Reference:** `docs/TEAM_MANAGEMENT_API.md`
- **Permission Matrix:** `docs/RBAC_PERMISSION_MATRIX.md`

---

## Next Steps After Deployment

1. **Initialize Database Schema**
   ```bash
   cd phase2-backend/database
   psql -h <aurora-endpoint> -U securebase_app -d securebase -f rbac_schema.sql
   ```

2. **Configure API Gateway**
   - Add Lambda integrations
   - Configure authorizer
   - Test endpoints

3. **Test User Management**
   - Open portal UI
   - Test user creation
   - Test role assignment
   - Test session management

4. **Monitor CloudWatch**
   - Check Lambda invocations
   - Review error rates
   - Monitor latency

---

**Need Help?**
- Check [DEPLOY_PHASE4_COMPONENT2.md](DEPLOY_PHASE4_COMPONENT2.md) for detailed instructions
- Review logs: `aws logs tail /aws/lambda/securebase-dev-user-management --follow`
- Contact: support@securebase.aws
