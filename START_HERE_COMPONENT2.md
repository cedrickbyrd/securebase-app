# 🚀 Phase 4 Component 2 Deployment - START HERE

**Quick Answer:** To redeploy Phase 4 Component 2, run:
```bash
./redeploy-phase4-component2.sh
```

---

## 📋 What is Phase 4 Component 2?

**Component 2** is the **Team Collaboration & RBAC** system that provides:
- Multi-user team support (100+ users per customer)
- Role-based access control (Admin, Manager, Analyst, Viewer)
- User management (create, invite, edit, delete users)
- Session management (login, MFA, logout)
- Permission enforcement
- Complete audit logging

---

## 🎯 Three Ways to Deploy

### 1️⃣ First Time (Full Deployment)
```bash
./deploy-phase4-component2.sh
```
- ⏱️ **Time:** 5-10 minutes
- 🎯 **Use when:** Deploying for the first time
- 📦 **Deploys:** All 13 resources (DynamoDB, Lambda, IAM, etc.)

### 2️⃣ Quick Update (Code Only)
```bash
./redeploy-phase4-component2.sh
```
- ⏱️ **Time:** 1-2 minutes
- 🎯 **Use when:** Updating Lambda function code
- 📦 **Updates:** 3 Lambda functions only

### 3️⃣ Validation
```bash
./validate-phase4-component2.sh
```
- ⏱️ **Time:** 30 seconds
- 🎯 **Use when:** Checking deployment health
- 📦 **Checks:** All 13 resources

---

## 📚 Documentation

### Start Here
👉 **[COMPONENT2_INDEX.md](COMPONENT2_INDEX.md)** - Complete navigation guide

### Quick Guides
- **[REDEPLOY_COMPONENT2_GUIDE.md](REDEPLOY_COMPONENT2_GUIDE.md)** - Simple how-to
- **[PHASE4_COMPONENT2_QUICK_REFERENCE.md](PHASE4_COMPONENT2_QUICK_REFERENCE.md)** - Command reference

### Comprehensive
- **[DEPLOY_PHASE4_COMPONENT2.md](DEPLOY_PHASE4_COMPONENT2.md)** - Full deployment guide
- **[COMPONENT2_DEPLOYMENT_SUMMARY.md](COMPONENT2_DEPLOYMENT_SUMMARY.md)** - Executive summary

---

## 📦 What Gets Deployed

| Type | Count | Names |
|------|-------|-------|
| DynamoDB Tables | 3 | user-sessions, user-invites, activity-feed |
| Lambda Functions | 3 | user-management, session-management, permission-management |
| IAM Roles | 3 | One per Lambda function |
| CloudWatch Logs | 3 | One per Lambda function |
| Secrets Manager | 1 | JWT signing secret |
| **Total** | **13** | Complete RBAC system |

---

## ⚡ Quick Commands

```bash
# Deploy everything
./deploy-phase4-component2.sh

# Update Lambda code only
./redeploy-phase4-component2.sh

# Verify deployment
./validate-phase4-component2.sh

# View logs
aws logs tail /aws/lambda/securebase-dev-user-management --follow

# Check Lambda status
aws lambda get-function --function-name securebase-dev-user-management

# List DynamoDB tables
aws dynamodb list-tables | grep securebase-dev
```

---

## ✅ Success Criteria

After deployment, verify:
- ✅ 3 DynamoDB tables created
- ✅ 3 Lambda functions deployed and Active
- ✅ IAM roles attached
- ✅ CloudWatch logs configured
- ✅ JWT secret in Secrets Manager

**Automated check:** Run `./validate-phase4-component2.sh`

---

## 🆘 Common Issues

| Problem | Quick Fix |
|---------|-----------|
| Lambda not found | Run `./deploy-phase4-component2.sh` |
| JWT secret missing | Script creates it automatically |
| Terraform errors | Run `terraform init -upgrade` |
| Database connection fails | Check Aurora endpoint and security groups |

**Full troubleshooting:** See [DEPLOY_PHASE4_COMPONENT2.md](DEPLOY_PHASE4_COMPONENT2.md)

---

## 🎓 Learning Path

1. **Brand New?** → Start with [REDEPLOY_COMPONENT2_GUIDE.md](REDEPLOY_COMPONENT2_GUIDE.md)
2. **Need Commands?** → See [PHASE4_COMPONENT2_QUICK_REFERENCE.md](PHASE4_COMPONENT2_QUICK_REFERENCE.md)
3. **Deep Dive?** → Read [DEPLOY_PHASE4_COMPONENT2.md](DEPLOY_PHASE4_COMPONENT2.md)
4. **Just Overview?** → Check [COMPONENT2_DEPLOYMENT_SUMMARY.md](COMPONENT2_DEPLOYMENT_SUMMARY.md)

---

## 📞 Need Help?

- 📖 **Documentation:** [COMPONENT2_INDEX.md](COMPONENT2_INDEX.md)
- 📧 **Email:** support@securebase.aws
- 🐛 **Issues:** Run `./validate-phase4-component2.sh` for diagnostics

---

**Status:** ✅ Ready for Production Use  
**Last Updated:** February 2, 2026  
**Version:** 1.0.0
