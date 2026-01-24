# Phase 4: Enterprise Security & SSO Setup Guide

## Overview

Phase 4 adds enterprise-grade security controls to SecureBase, including:

- **SSO Integration** (SAML 2.0, OIDC) with <2s login target
- **Enhanced MFA** (TOTP, SMS, hardware tokens, backup codes)
- **IP Whitelisting** with 100% enforcement
- **API Key Rotation** with automated policies
- **Device Fingerprinting** and suspicious activity detection
- **Security Event Monitoring** with <15min incident response
- **SOC 2 Type II** audit preparation

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Infrastructure Deployment](#infrastructure-deployment)
4. [SSO Configuration](#sso-configuration)
5. [IP Whitelist Setup](#ip-whitelist-setup)
6. [API Key Rotation](#api-key-rotation)
7. [Security Monitoring](#security-monitoring)
8. [Portal UI Access](#portal-ui-access)
9. [Testing & Validation](#testing--validation)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Components

- ✅ Phase 1: Landing Zone deployed
- ✅ Phase 2: Backend deployed with Aurora PostgreSQL
- ✅ Phase 3a: Customer Portal deployed
- ✅ AWS CLI configured with admin access
- ✅ Terraform 1.0+ installed

### Required Permissions

- AWS IAM admin access for Terraform
- RDS admin access for database schema updates
- SNS permissions for security alerts
- KMS permissions for encryption

---

## Database Setup

### 1. Deploy Phase 4 Security Schema

Connect to your Aurora PostgreSQL database:

```bash
cd phase2-backend/database

# Set environment variables
export RDS_HOST="your-rds-proxy-endpoint.rds.amazonaws.com"
export RDS_DATABASE="securebase"
export RDS_USER="securebase_admin"

# Apply Phase 4 security schema
psql -h $RDS_HOST -U $RDS_USER -d $RDS_DATABASE -f phase4_security_schema.sql
```

### 2. Verify Schema Installation

```sql
-- Check new tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'sso_providers', 'sso_user_mappings', 'ip_whitelists',
  'mfa_backup_codes', 'device_fingerprints', 'security_events',
  'password_history', 'api_key_rotation_policy', 'password_policies'
);

-- Check helper functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'is_ip_whitelisted', 'generate_mfa_backup_codes',
  'verify_mfa_backup_code', 'log_security_event', 'validate_password'
);
```

Expected output: 9 tables and 5 functions.

### 3. Initialize Default Policies

```sql
-- Create default password policy for existing customers
INSERT INTO password_policies (customer_id, created_at)
SELECT id, CURRENT_TIMESTAMP FROM customers;

-- Create default API key rotation policy (disabled by default)
INSERT INTO api_key_rotation_policy (customer_id, auto_rotation_enabled, rotation_frequency)
SELECT id, false, '90_days' FROM customers;
```

---

## Infrastructure Deployment

### 1. Package Lambda Functions

```bash
cd phase2-backend/functions

# Package SSO handler
chmod +x package-lambda.sh
./package-lambda.sh sso_handler

# Package security middleware
./package-lambda.sh security_middleware

# Package API key rotation
./package-lambda.sh api_key_rotation
```

Verify deployment packages:
```bash
ls -lh ../deploy/
# Should show: sso_handler.zip, security_middleware.zip, api_key_rotation.zip
```

### 2. Deploy Terraform Infrastructure

```bash
cd landing-zone/environments/dev

# Edit main.tf to include phase4-security module
cat >> main.tf <<EOF

# Phase 4: Enterprise Security
module "phase4_security" {
  source = "../../modules/phase4-security"

  environment              = var.environment
  project_name            = var.org_name
  lambda_execution_role_arn = module.iam.lambda_execution_role_arn
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  rds_proxy_endpoint      = module.phase2_database.rds_proxy_endpoint
  rds_database_name       = "securebase"
  rds_secret_arn          = module.phase2_database.rds_secret_arn
  jwt_secret_arn          = aws_secretsmanager_secret.jwt_secret.arn
  callback_base_url       = "https://portal.securebase.com"
  db_layer_arn           = module.lambda_functions.db_layer_arn
  security_alert_email    = "security@yourcompany.com"

  tags = var.tags
}
EOF

# Initialize and apply
terraform init
terraform plan
terraform apply
```

### 3. Verify Deployment

```bash
# Check Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `sso`) || contains(FunctionName, `security`)].FunctionName'

# Check SNS topic
aws sns list-topics --query 'Topics[?contains(TopicArn, `security-alerts`)]'

# Check EventBridge rules
aws events list-rules --name-prefix "securebase-dev-api-key-rotation"
```

### 4. Confirm SNS Subscription

Check your email for SNS subscription confirmation from `security@securebase.com` and click the confirmation link.

---

## SSO Configuration

### OIDC Setup (Google Workspace Example)

#### 1. Create OAuth Client in Google Admin Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create new
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Configure:
   - Application type: **Web application**
   - Name: `SecureBase SSO`
   - Authorized redirect URIs: `https://portal.securebase.com/auth/sso/callback`
6. Save **Client ID** and **Client Secret**

#### 2. Configure in SecureBase Portal

1. Log into SecureBase portal as admin
2. Navigate to **Security** > **SSO Configuration**
3. Click **Add Provider**
4. Fill in:
   - Provider Type: **OIDC**
   - Provider Name: `Google Workspace`
   - Issuer URL: `https://accounts.google.com`
   - Client ID: `<your-client-id>`
   - Client Secret: `<your-client-secret>`
   - Scopes: `openid email profile`
   - Default Role: `viewer`
   - Status: `testing` (switch to `active` after testing)
   - Auto-provision users: ✅ Enabled
5. Click **Save Provider**

#### 3. Test SSO Login

```bash
# Get SSO login URL
curl -X GET "https://api.securebase.com/v1/auth/sso/providers" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Initiate SSO login (in browser)
https://api.securebase.com/v1/auth/sso/login/PROVIDER_ID
```

**Success Criteria:**
- ✅ Login completes in <2 seconds
- ✅ User redirected to portal with valid session
- ✅ User auto-created if new
- ✅ Audit log entry created

### SAML 2.0 Setup (Okta Example)

#### 1. Create SAML Application in Okta

1. Log into Okta Admin Dashboard
2. **Applications** > **Create App Integration**
3. Select **SAML 2.0**
4. Configure:
   - App name: `SecureBase`
   - Single sign on URL: `https://portal.securebase.com/auth/sso/saml/acs`
   - Audience URI: `SecureBase`
   - Name ID format: `EmailAddress`
   - Attribute Statements:
     - `email` → `user.email`
     - `name` → `user.displayName`
5. Download **X.509 Certificate**
6. Copy **SSO URL** and **Entity ID**

#### 2. Configure in SecureBase

1. Portal > **Security** > **SSO Configuration** > **Add Provider**
2. Fill in:
   - Provider Type: **SAML 2.0**
   - Provider Name: `Okta`
   - Entity ID: `<okta-entity-id>`
   - SSO URL: `<okta-sso-url>`
   - X.509 Certificate: Paste PEM certificate
   - Default Role: `viewer`
   - Auto-provision: ✅ Enabled
3. Click **Save Provider**

---

## IP Whitelist Setup

### Enable IP Whitelisting

1. Portal > **Security** > **IP Whitelist Management**
2. Click **Add IP Range**
3. Configure:
   - **IP Range**: `203.0.113.0/24` (office network CIDR)
   - **Description**: Office headquarters
   - **Expiration**: Leave empty (permanent)
4. Click **Add to Whitelist**

### Common IP Range Examples

| Use Case | CIDR Notation | Description |
|----------|---------------|-------------|
| Single IP | `203.0.113.42` | Specific server/workstation |
| Small office | `192.168.1.0/24` | 256 addresses (192.168.1.0-255) |
| VPN subnet | `10.0.0.0/16` | 65,536 addresses |
| AWS region | `52.94.0.0/16` | AWS us-east-1 IP range |

### Testing IP Whitelist Enforcement

```bash
# From allowed IP - should succeed
curl -X POST https://api.securebase.com/v1/security/validate-ip \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"customer_id": "YOUR_CUSTOMER_ID"}'

# From blocked IP - should return 403
# Response: {"error": "IP address not whitelisted", "whitelisted": false}
```

**Success Criteria:**
- ✅ 100% enforcement (all non-whitelisted IPs blocked)
- ✅ Usage tracking updated on each request
- ✅ Security event logged for blocked IPs

---

## API Key Rotation

### Enable Auto-Rotation

Via API:
```bash
curl -X POST https://api.securebase.com/v1/security/api-key-rotation-policy \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_rotation_enabled": true,
    "rotation_frequency": "90_days",
    "rotation_warning_days": 7,
    "old_key_grace_period_hours": 24,
    "notify_on_rotation": true,
    "notification_emails": ["devops@yourcompany.com"]
  }'
```

### Rotation Frequencies

- `30_days` - High security (monthly rotation)
- `60_days` - Medium security (bi-monthly)
- `90_days` - **Recommended** (quarterly)
- `180_days` - Lower security (semi-annual)
- `365_days` - Minimal rotation (annual)

### Manual Rotation

```bash
# Trigger immediate rotation
aws lambda invoke \
  --function-name securebase-dev-api-key-rotation \
  --payload '{}' \
  /tmp/rotation-response.json

cat /tmp/rotation-response.json
```

### Rotation Email Notification

Recipients will receive:
- **7 days before rotation**: Warning email
- **On rotation day**: New API key email with 24-hour grace period
- **Subject**: `[SecureBase] API Key Rotated - Action Required`

**Action Required:**
1. Copy new API key from email
2. Update applications/scripts with new key
3. Old key remains valid for 24 hours

---

## Security Monitoring

### View Security Events

Portal > **Security** > **Security Events Dashboard**

**Event Types:**
- `failed_login` - Invalid credentials
- `suspicious_ip` - Access from non-whitelisted IP
- `new_device` - Login from unrecognized device
- `brute_force_attempt` - Multiple failed logins
- `mfa_failed` - MFA verification failure
- `api_key_leaked` - API key detected in public repository

### Security Alert Levels

| Severity | Response Time Target | Alert Method |
|----------|---------------------|--------------|
| Critical | <5 minutes | Email + SMS |
| High | <15 minutes | Email |
| Medium | <1 hour | Email (batched) |
| Low | <4 hours | Dashboard only |

### SNS Alert Configuration

Security alerts are sent to:
- Email: `security@yourcompany.com` (configured in Terraform)
- Future: PagerDuty, Slack webhooks

Sample alert format:
```json
{
  "event_id": "evt_abc123",
  "customer_id": "cust_xyz",
  "event_type": "brute_force_attempt",
  "severity": "high",
  "description": "User admin@company.com: 10 failed login attempts in 5 minutes",
  "ip_address": "203.0.113.42",
  "timestamp": "2025-01-24T17:00:00Z"
}
```

### CloudWatch Metrics

Monitor via CloudWatch Dashboard:
- `SecureBase/Security/HighSeverityEvents` - Count of high/critical events
- `SecureBase/Security/FailedLogins` - Failed login rate
- `SecureBase/Performance/SSOLoginDuration` - SSO login time (target: <2000ms)

### Export Security Events

```bash
# Via API
curl -X GET "https://api.securebase.com/v1/security/events?limit=1000&severity=critical" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -o security-events.json

# Via Portal
# Security Events > Export CSV button
```

---

## Portal UI Access

### Security Admin Menu

After deployment, portal navigation includes:

```
Security (Admin Only)
├── SSO Configuration
│   ├── Add OIDC Provider
│   ├── Add SAML Provider
│   └── Provider Performance Metrics
├── IP Whitelist Management
│   ├── Add IP Range
│   ├── View Active Whitelists
│   └── Usage Statistics
└── Security Events Dashboard
    ├── Event Timeline
    ├── Severity Filters
    └── Export to CSV
```

### Role-Based Access

| Role | SSO Config | IP Whitelist | Security Events |
|------|------------|--------------|-----------------|
| Admin | ✅ Read/Write | ✅ Read/Write | ✅ Read/Write |
| Manager | ❌ No Access | ✅ Read Only | ✅ Read Only |
| Analyst | ❌ No Access | ❌ No Access | ✅ Read Only |
| Viewer | ❌ No Access | ❌ No Access | ❌ No Access |

---

## Testing & Validation

### 1. SSO Login Performance Test

```bash
#!/bin/bash
# test-sso-performance.sh

for i in {1..10}; do
  START=$(date +%s%3N)
  
  # Initiate SSO login and measure time
  curl -X GET "https://api.securebase.com/v1/auth/sso/login/PROVIDER_ID" \
    -w "\n%{time_total}" \
    -o /dev/null \
    -s
  
  END=$(date +%s%3N)
  DURATION=$((END - START))
  
  echo "Test $i: ${DURATION}ms"
  
  if [ $DURATION -gt 2000 ]; then
    echo "❌ FAILED: Exceeds 2s target"
  else
    echo "✅ PASSED: Within 2s target"
  fi
done
```

**Success Criteria:**
- ✅ Average login time <2000ms
- ✅ 95th percentile <2500ms

### 2. IP Whitelist Enforcement Test

```bash
# Test from allowed IP
docker run --rm curlimages/curl:latest \
  curl -X POST https://api.securebase.com/v1/security/validate-ip \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"customer_id": "YOUR_CUSTOMER_ID", "ip_address": "203.0.113.42"}'

# Expected: {"whitelisted": true}

# Test from blocked IP
docker run --rm curlimages/curl:latest \
  curl -X POST https://api.securebase.com/v1/security/validate-ip \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"customer_id": "YOUR_CUSTOMER_ID", "ip_address": "198.51.100.1"}'

# Expected: {"error": "IP address not whitelisted", "whitelisted": false}
```

**Success Criteria:**
- ✅ 100% enforcement (no false positives/negatives)
- ✅ Security event logged for blocked IPs

### 3. Security Event Response Time Test

```bash
# Trigger security event
curl -X POST https://api.securebase.com/v1/auth/login \
  -d '{"email": "test@example.com", "password": "wrong-password"}' \
  -H "Content-Type: application/json"

# Check response time
curl -X GET "https://api.securebase.com/v1/security/events?limit=1" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  | jq '.events[0] | {detected_at, resolved_at, response_time: (.resolved_at - .detected_at)}'
```

**Success Criteria:**
- ✅ High severity events detected within 1 minute
- ✅ Incident response initiated within 15 minutes
- ✅ Alert sent to security team

### 4. MFA Backup Codes Test

```sql
-- Generate backup codes for user
SELECT * FROM generate_mfa_backup_codes(
  'user-uuid-here'::UUID,
  'customer-uuid-here'::UUID,
  10
);

-- Should return 10 plaintext codes (shown only once)
-- Codes are hashed in database

-- Verify a backup code
SELECT verify_mfa_backup_code(
  'user-uuid-here'::UUID,
  'BACKUP-CODE',
  '203.0.113.42'::INET
);

-- Should return TRUE and mark code as used
```

---

## Troubleshooting

### Issue: SSO Login >2 seconds

**Symptoms:**
- CloudWatch alarm triggered
- Portal shows performance warning

**Diagnosis:**
```bash
# Check SSO provider latency
curl -o /dev/null -s -w "Total: %{time_total}s\n" \
  https://accounts.google.com/.well-known/openid-configuration

# Check Lambda execution time
aws logs tail /aws/lambda/securebase-dev-sso-handler --follow
```

**Solutions:**
1. Enable Lambda Provisioned Concurrency (reduces cold starts)
2. Increase Lambda memory (faster CPU)
3. Cache OIDC discovery metadata
4. Contact SSO provider support if provider-side latency

---

### Issue: IP Whitelist Not Enforcing

**Symptoms:**
- Blocked IPs can still access API
- No security events logged

**Diagnosis:**
```sql
-- Check whitelist entries
SELECT * FROM ip_whitelists WHERE customer_id = 'YOUR_CUSTOMER_ID';

-- Test function directly
SELECT is_ip_whitelisted('customer-uuid'::UUID, '203.0.113.42'::INET);
```

**Solutions:**
1. Verify whitelist has at least 1 active entry (empty = allows all)
2. Check CIDR notation is valid
3. Ensure Lambda has RDS connectivity
4. Verify RLS policies are enabled

---

### Issue: No Security Alerts Received

**Symptoms:**
- High severity events not triggering emails
- SNS topic exists but no messages

**Diagnosis:**
```bash
# Check SNS subscription status
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:securebase-dev-security-alerts

# Test SNS manually
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:securebase-dev-security-alerts \
  --message "Test security alert" \
  --subject "[TEST] Security Alert"
```

**Solutions:**
1. Confirm SNS subscription in email
2. Check Lambda SNS publish permissions
3. Verify `SECURITY_SNS_TOPIC_ARN` environment variable in Lambda
4. Check spam/junk folders

---

### Issue: API Key Rotation Not Working

**Symptoms:**
- EventBridge rule triggers but keys not rotated
- No email notifications sent

**Diagnosis:**
```bash
# Check EventBridge rule status
aws events describe-rule --name securebase-dev-api-key-rotation-schedule

# Check Lambda logs
aws logs tail /aws/lambda/securebase-dev-api-key-rotation --follow

# Manually invoke Lambda
aws lambda invoke \
  --function-name securebase-dev-api-key-rotation \
  /tmp/rotation-test.json
```

**Solutions:**
1. Verify SES email address verified
2. Check `auto_rotation_enabled = true` in policy
3. Ensure `next_rotation_at` is in past
4. Check Lambda timeout (should be 60s+)

---

## Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| SSO Login Time | <2s | Monitor via CloudWatch | 🎯 |
| IP Whitelist Enforcement | 100% | Monitor via audit logs | 🎯 |
| Incident Response Time | <15min | Monitor via security events | 🎯 |
| MFA Enablement Rate | >85% | Track via user table | 📊 |
| Critical Vulnerabilities | 0 | Run CodeQL/vulnerability scans | 🔒 |

---

## Next Steps

1. ✅ **Enable SSO** for primary identity provider
2. ✅ **Configure IP whitelists** for office networks
3. ✅ **Enable API key rotation** (90-day policy recommended)
4. ✅ **Set up security alerts** (confirm SNS subscription)
5. ✅ **Train security team** on incident response dashboard
6. 📋 **Schedule SOC 2 audit** (documentation complete)
7. 📋 **Implement WebAuthn/FIDO2** (Phase 4.1)
8. 📋 **Add SMS MFA** provider (Phase 4.1)

---

## Support

For issues or questions:
- **Documentation**: `/docs/PAAS_ARCHITECTURE.md`
- **Security Issues**: `security@securebase.com`
- **GitHub Issues**: `https://github.com/cedrickbyrd/securebase-app/issues`
