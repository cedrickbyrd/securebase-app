# MFA Enforcement Policy - SecureBase RBAC

## Overview
Multi-Factor Authentication (MFA) adds an additional layer of security by requiring users to provide a second form of verification beyond their password. This document outlines the MFA enforcement policies for SecureBase.

## MFA Requirements by Role

### Admin Role
**MFA Status:** MANDATORY  
**Enforcement:** Immediate (cannot be disabled)

- Must set up MFA within 24 hours of account creation
- Account locks if MFA not configured after grace period
- Cannot disable MFA without Super Admin approval
- MFA required for all sensitive operations:
  - User management (create, delete, role changes)
  - Permission modifications
  - Security settings changes
  - API key rotation

### Manager Role
**MFA Status:** HIGHLY RECOMMENDED  
**Enforcement:** Optional (can be made mandatory per customer)

- Encouraged to enable MFA during onboarding
- Can manage team members without MFA (with audit logging)
- MFA required for high-risk operations:
  - Adding new users
  - Changing user roles
  - Deleting users

### Analyst Role
**MFA Status:** OPTIONAL  
**Enforcement:** None (encouraged for compliance)

- Can enable MFA voluntarily
- No restrictions if MFA not enabled
- May be required by customer-specific policies

### Viewer Role
**MFA Status:** OPTIONAL  
**Enforcement:** None

- Can enable MFA for additional security
- Read-only access doesn't require MFA

## Implementation Details

### MFA Methods Supported

1. **TOTP (Time-based One-Time Password)** ✅ IMPLEMENTED
   - Google Authenticator
   - Microsoft Authenticator
   - Authy
   - Any RFC 6238 compliant app

2. **SMS-based OTP** ⚠️ PLANNED (Phase 5)
   - Via AWS SNS/Twilio
   - Less secure, not recommended for Admin

3. **Hardware Security Keys (U2F/WebAuthn)** 📅 PLANNED (Phase 5)
   - YubiKey
   - Google Titan Security Key
   - Most secure option

### MFA Setup Flow

For Admin users (mandatory):

```
1. User account created
2. Temporary password emailed
3. First login → Forced MFA setup
4. Scan QR code with authenticator app
5. Enter 6-digit code to verify
6. Backup codes generated (10 codes)
7. MFA enabled ✅
8. Normal operations allowed
```

For other roles (optional):

```
1. User logs in
2. Navigate to Security Settings
3. Click "Enable MFA"
4. Scan QR code
5. Verify with code
6. MFA enabled ✅
```

### Grace Period Policy

**Admin Users:**
- Grace period: 24 hours from account creation
- Warning emails at: 12 hours, 18 hours, 23 hours remaining
- After grace period: Account locked until MFA configured
- Unlock process: Contact support or use emergency access

**Manager Users:**
- No grace period (MFA optional)
- Periodic reminders if not enabled
- Can enable anytime from settings

### MFA Verification Flow

Login with MFA enabled:

```
1. Enter email + password
2. Password validated ✅
3. MFA challenge presented
4. User enters 6-digit code from authenticator
5. Code validated (30-second window)
6. Session token issued with MFA flag
7. User logged in ✅
```

### Backup Codes

When MFA is enabled, 10 single-use backup codes are generated:

- Format: `XXXX-XXXX-XXXX` (12 characters)
- Valid: Until used or MFA disabled
- Usage: In case authenticator app unavailable
- Security: Each code can only be used once
- Storage: User responsible for secure storage

Example backup codes:
```
A7D9-K2L4-M8N3
B3F1-H5J7-P9Q2
C6G8-K1M4-R7S5
... (7 more)
```

### MFA Enforcement Configuration

Customer-level MFA policy can be configured:

```json
{
  "customer_id": "cust_abc123",
  "mfa_policy": {
    "admin_required": true,        // Cannot be changed
    "manager_required": false,      // Customer configurable
    "analyst_required": false,      // Customer configurable
    "viewer_required": false,       // Customer configurable
    "grace_period_hours": 24,       // Default for admin
    "allow_sms": false,             // Phase 5 feature
    "allow_totp": true,             // Always enabled
    "allow_hardware_key": false     // Phase 5 feature
  }
}
```

### Emergency Access (Break-Glass)

For situations where admin loses MFA device:

1. **Backup Codes** (preferred)
   - Use one of 10 backup codes issued at MFA setup
   - Code used once and invalidated

2. **Support Ticket**
   - Email support@securebase.aws
   - Provide: Account email, company name, verification info
   - Support verifies identity (may require company documentation)
   - MFA temporarily disabled for 1 hour
   - User must re-enable MFA immediately

3. **Super Admin Override**
   - For enterprise customers only
   - Designated Super Admin can reset MFA
   - Requires approval + audit trail
   - Limited to once per quarter per user

### Audit Trail

All MFA events are logged to activity_feed:

```json
{
  "user_id": "user_123",
  "customer_id": "cust_abc",
  "action": "mfa_enabled",
  "timestamp": "2026-02-03T10:30:00Z",
  "ip_address": "203.0.113.5",
  "user_agent": "Mozilla/5.0..."
}
```

Logged events:
- `mfa_enabled` - User enables MFA
- `mfa_disabled` - User disables MFA (admin only)
- `mfa_verified` - Successful MFA verification
- `mfa_failed` - Failed MFA verification
- `mfa_backup_used` - Backup code used
- `mfa_reset` - MFA reset by support/admin

### Compliance Mapping

MFA enforcement supports compliance frameworks:

**SOC 2 Type II:**
- CC6.1: Logical access controls
- CC6.2: Authentication mechanisms
- CC6.3: Access removal

**HIPAA:**
- 164.308(a)(5)(ii)(D): Password management
- 164.312(a)(2)(i): Unique user identification

**FedRAMP:**
- AC-2: Account Management
- IA-2: Identification and Authentication
- IA-2(1): Multi-factor Authentication

**PCI DSS:**
- 8.3: Secure authentication
- 8.3.1: Multi-factor for remote access

### Performance Considerations

MFA verification timing:
- TOTP verification: < 50ms
- Code generation window: 30 seconds
- Clock skew tolerance: ±1 period (90 seconds total)
- Rate limiting: 5 failed attempts = 15 min lockout

### Security Best Practices

**For Administrators:**
1. ✅ Enable MFA immediately
2. ✅ Store backup codes securely (password manager)
3. ✅ Use authenticator app (not SMS if possible)
4. ✅ Never share MFA codes
5. ✅ Audit MFA events regularly

**For Users:**
1. ✅ Choose a reliable authenticator app
2. ✅ Save backup codes offline
3. ✅ Use different devices for email and MFA
4. ✅ Report lost devices immediately
5. ✅ Don't screenshot QR codes

**For Customers:**
1. ✅ Enforce MFA for high-privilege roles
2. ✅ Regular MFA compliance audits
3. ✅ Training on MFA importance
4. ✅ Document break-glass procedures
5. ✅ Monitor MFA usage metrics

## Configuration Examples

### Enforce MFA for all roles (high security):

```json
{
  "mfa_policy": {
    "admin_required": true,
    "manager_required": true,
    "analyst_required": true,
    "viewer_required": true
  }
}
```

### Standard configuration (recommended):

```json
{
  "mfa_policy": {
    "admin_required": true,
    "manager_required": false,
    "analyst_required": false,
    "viewer_required": false
  }
}
```

### Relaxed configuration (development/testing only):

```json
{
  "mfa_policy": {
    "admin_required": true,
    "manager_required": false,
    "analyst_required": false,
    "viewer_required": false,
    "grace_period_hours": 168  // 7 days for development
  }
}
```

**Note:** Relaxed configuration is only for development environments. Production should use standard or high-security configuration.

## API Endpoints

### Setup MFA
```
POST /auth/mfa/setup
Authorization: Bearer <token>

Response:
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code_url": "otpauth://totp/SecureBase:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=SecureBase",
  "backup_codes": ["A7D9-K2L4-M8N3", ...]
}
```

### Verify MFA
```
POST /auth/mfa/verify
Content-Type: application/json

{
  "session_id": "sess_123",
  "code": "123456"
}

Response:
{
  "verified": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Disable MFA (Admin only)
```
POST /users/{user_id}/mfa/disable
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "message": "MFA disabled for user"
}
```

## Monitoring & Alerts

Set up CloudWatch alerts for:

1. **Multiple failed MFA attempts**
   - Threshold: > 5 failures in 5 minutes
   - Action: Lock account + notify security team

2. **MFA disabled events**
   - Any MFA disable triggers alert
   - Review reason and approver

3. **Backup code exhaustion**
   - Alert when user has < 2 backup codes remaining
   - Prompt user to regenerate

4. **Grace period expiring**
   - Email admin 24h, 12h, 6h, 1h before expiration
   - Final warning when account locked

## Testing

Test MFA functionality:

```bash
# Setup MFA for test user
curl -X POST https://api.securebase.dev/auth/mfa/setup \
  -H "Authorization: Bearer <token>"

# Verify with test code (use authenticator app)
curl -X POST https://api.securebase.dev/auth/mfa/verify \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess_123", "code": "123456"}'

# Test backup code
curl -X POST https://api.securebase.dev/auth/mfa/verify \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess_123", "backup_code": "A7D9-K2L4-M8N3"}'
```

## Support Resources

- MFA Setup Guide: `/docs/MFA_USER_GUIDE.md`
- Troubleshooting: `/docs/RBAC_TROUBLESHOOTING.md`
- API Reference: `/docs/TEAM_MANAGEMENT_API.md`
- Support: support@securebase.aws

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-03  
**Owned By:** Security Team  
**Review Frequency:** Quarterly
