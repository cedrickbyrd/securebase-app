# Phase 4: Security Configuration Guide

**Version:** 1.0  
**Last Updated:** January 24, 2026  
**Audience:** Security Engineers, IT Administrators  

---

## Overview

Comprehensive guide to configuring enterprise security features in SecureBase Phase 4, including SSO/SAML integration, multi-factor authentication, IP whitelisting, and advanced session controls.

### Security Features Covered
- ✅ SSO/SAML 2.0 integration (Okta, Azure AD, OneLogin)
- ✅ Multi-factor authentication (TOTP, SMS, hardware keys)
- ✅ IP whitelisting (network-level access control)
- ✅ Session management (timeout, concurrent sessions)
- ✅ Password policies (complexity, rotation)
- ✅ API key security (rotation, scope limits)
- ✅ Audit logging (compliance, forensics)

---

## SSO/SAML Integration

### Supported Identity Providers
- **Okta** ✅ Tested and validated
- **Azure AD** ✅ Tested and validated
- **OneLogin** ✅ Tested and validated
- **Google Workspace** ✅ Supported
- **Auth0** ✅ Supported
- **Custom SAML 2.0** ✅ Supported (any compliant IdP)

### Setup Time: 15-30 minutes

---

### Option 1: Okta Integration

**Step 1: Create Okta Application**
```bash
1. Log in to Okta Admin Console
2. Applications → Create App Integration
3. Select "SAML 2.0"
4. Click "Next"

App Settings:
  App name: SecureBase
  App logo: [Upload SecureBase logo]
  
SAML Settings:
  Single sign-on URL: https://portal.securebase.com/saml/acs
  Audience URI: https://portal.securebase.com/saml/metadata
  Name ID format: EmailAddress
  Application username: Email
  
Attribute Statements:
  email: user.email
  firstName: user.firstName
  lastName: user.lastName
  groups: user.groups (optional)
  
5. Click "Next" → "Finish"
```

**Step 2: Download Metadata**
```bash
1. In Okta app → Sign On tab
2. Click "View SAML setup instructions"
3. Copy "Identity Provider Metadata" XML
4. Save as okta-metadata.xml
```

**Step 3: Configure SecureBase**
```bash
1. Log in to SecureBase → Settings → Security → SSO
2. Click "Configure SAML"
3. Upload okta-metadata.xml
4. OR paste metadata XML directly
5. Click "Validate & Save"

SecureBase will:
  • Parse IdP metadata
  • Validate certificate
  • Test SAML endpoints
  • Show validation results
```

**Step 4: Test SSO Login**
```bash
1. Open incognito/private window
2. Go to https://portal.securebase.com
3. Click "Sign in with SSO"
4. Enter your Okta email
5. Redirects to Okta login
6. Enter Okta credentials
7. Redirects back to SecureBase (logged in!)
```

**Step 5: Assign Users in Okta**
```bash
1. Okta Admin → Applications → SecureBase
2. Assignments tab → Assign to People/Groups
3. Select users/groups
4. Click "Assign" → "Done"

Users can now log in via SSO!
```

---

### Option 2: Azure AD Integration

**Step 1: Create Azure AD Enterprise App**
```bash
1. Azure Portal → Azure Active Directory
2. Enterprise Applications → New Application
3. Create your own application
4. Name: "SecureBase"
5. Select: "Integrate any other application (Non-gallery)"
6. Click "Create"
```

**Step 2: Configure SAML**
```bash
1. Single sign-on → SAML
2. Click "Edit" on Basic SAML Configuration

Settings:
  Identifier (Entity ID): https://portal.securebase.com/saml/metadata
  Reply URL (ACS): https://portal.securebase.com/saml/acs
  Sign on URL: https://portal.securebase.com
  
3. Save

4. Download Federation Metadata XML
   (Section 3: SAML Certificates)
```

**Step 3: Configure Attributes**
```bash
User Attributes & Claims:
  Required claims (automatically mapped):
    - email: user.mail
    - givenname: user.givenname
    - surname: user.surname
    - unique_user_identifier: user.userprincipalname
    
  Additional claims (optional):
    - groups: user.groups
```

**Step 4: Configure SecureBase**
```bash
Same as Okta Step 3:
  Settings → Security → SSO → Upload Azure metadata XML
```

**Step 5: Assign Users**
```bash
1. Azure AD → Enterprise Apps → SecureBase
2. Users and groups → Add user/group
3. Select users/groups
4. Assign
```

---

### Option 3: Custom SAML Provider

**Requirements:**
- SAML 2.0 compliant IdP
- HTTP-POST binding support
- X.509 certificate for signing

**Metadata Exchange:**
```bash
# SecureBase SP Metadata (provide to your IdP):
URL: https://portal.securebase.com/saml/metadata
Entity ID: https://portal.securebase.com/saml/metadata
ACS URL: https://portal.securebase.com/saml/acs
Binding: HTTP-POST

# Required Attributes:
- email (required)
- firstName (optional)
- lastName (optional)
```

**Upload IdP Metadata to SecureBase:**
```bash
Settings → Security → SSO → Upload metadata XML
```

---

### Troubleshooting SSO

**Issue: "SAML Response Invalid"**
```bash
Cause: Clock skew between IdP and SP
Solution:
  1. Verify server time sync (NTP)
  2. Allow 5-minute clock skew in SecureBase
  3. Check certificate validity
```

**Issue: "Signature Verification Failed"**
```bash
Cause: Certificate mismatch or expiry
Solution:
  1. Re-download IdP metadata
  2. Verify certificate hasn't expired
  3. Ensure metadata uploaded correctly
```

**Issue: "User Not Found"**
```bash
Cause: User doesn't exist in SecureBase
Solution:
  Option 1: Enable Just-In-Time (JIT) provisioning
    Settings → SSO → Enable JIT Provisioning
    Users auto-created on first SSO login
    
  Option 2: Pre-create users
    Team → Add User → Use SSO email
```

---

## Multi-Factor Authentication (MFA)

### MFA Options

#### Option 1: Authenticator App (Recommended)
**Supported Apps:**
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- Duo Mobile

**User Setup (2 minutes):**
```bash
1. Login → Settings → Security → MFA
2. Click "Enable MFA"
3. Choose "Authenticator App"
4. Open authenticator app on phone
5. Scan QR code displayed
6. Enter 6-digit code shown in app
7. Save 10 backup codes (in case phone lost)
8. Click "Enable MFA"

Future logins:
  1. Enter email + password
  2. Enter 6-digit code from app
  3. Logged in!
```

#### Option 2: SMS (via Twilio)
**Admin Setup:**
```bash
Settings → Security → MFA → SMS Provider
  Provider: Twilio
  Account SID: [from Twilio]
  Auth Token: [from Twilio]
  From Number: +1234567890
  
Save Configuration
```

**User Setup:**
```bash
1. Login → Settings → Security → MFA
2. Click "Enable MFA"
3. Choose "SMS"
4. Enter phone number: +1 234 567 8900
5. Click "Send Code"
6. Enter 6-digit code from SMS
7. Save backup codes
8. Click "Enable MFA"
```

#### Option 3: Hardware Security Keys (Advanced)
**Supported Keys:**
- YubiKey (WebAuthn/U2F)
- Google Titan Security Key
- Any FIDO2/WebAuthn compatible key

**User Setup:**
```bash
1. Login → Settings → Security → MFA
2. Click "Enable MFA"
3. Choose "Security Key"
4. Insert USB key (or tap NFC)
5. Follow browser prompts
6. Name your key (e.g., "YubiKey 5")
7. Save backup codes
8. Click "Enable MFA"
```

### MFA Policies (Admin Controls)

**Require MFA for All Users:**
```bash
Settings → Security → MFA Policies
  Require MFA: ✅ Yes
  Grace Period: 7 days (users must enable within 7 days)
  Enforcement: After grace period, login blocked until MFA enabled
```

**Require MFA for Specific Roles:**
```bash
Settings → Security → MFA Policies → Advanced
  Admin role: ✅ Required (no grace period)
  Manager role: ✅ Required (7-day grace)
  Analyst role: ⬜ Optional
  Viewer role: ⬜ Optional
```

**MFA Bypass (Emergency Access):**
```bash
Settings → Security → MFA → Emergency Bypass
  Bypass Codes: Generate 5 one-time codes
  Use Case: User lost phone, locked out
  Admin Action: Provide code to user (via secure channel)
  After Use: Code expires, user must re-enable MFA
```

---

## IP Whitelisting

### Use Cases
- Restrict access to office networks only
- Block access from untrusted regions
- Comply with data residency requirements

### Configuration

**Single IP Address:**
```bash
Settings → Security → IP Whitelisting → Add IP

IP Address: 203.0.113.50
Description: Office Desktop - John
[Add to Whitelist]
```

**IP Range (CIDR):**
```bash
Settings → Security → IP Whitelisting → Add IP Range

IP Range: 203.0.113.0/24
Description: Corporate Office Network
Allows: 203.0.113.0 to 203.0.113.255 (256 IPs)
[Add to Whitelist]
```

**Multiple Locations:**
```bash
# Office A
203.0.113.0/24 - "HQ Office Network"

# Office B
198.51.100.0/24 - "Branch Office Network"

# VPN
192.0.2.100/32 - "Corporate VPN Exit IP"

# Home Offices (individual IPs)
203.0.114.50 - "CEO Home Office"
203.0.114.51 - "CTO Home Office"
```

**Enforcement:**
```bash
Settings → Security → IP Whitelisting
  Block All Other IPs: ✅ Yes
  Allow List Size: 5 entries
  
Status: ACTIVE ✅
```

**Testing:**
```bash
1. Add your current IP to whitelist
2. Enable "Block All Other IPs"
3. Test login from current IP (should work)
4. Test from phone (cellular, not on whitelist - should be blocked)
5. If blocked incorrectly, disable enforcement to regain access
```

### Bypass for Emergencies

**Temporary Bypass Link:**
```bash
Settings → Security → IP Whitelisting → Generate Bypass Link
  Valid For: 1 hour
  One-Time Use: Yes
  
Generated Link:
https://portal.securebase.com/auth/bypass/abc123xyz...

Email to user who needs emergency access
Link expires after use or 1 hour
```

---

## Session Management

### Session Settings

**Session Timeout:**
```bash
Settings → Security → Sessions
  Timeout: 8 hours
  Options: 15 min, 1 hr, 8 hrs, 24 hrs
  
  After timeout:
    - User automatically logged out
    - Must re-authenticate
    - Work not saved may be lost (auto-save enabled)
```

**Concurrent Sessions:**
```bash
Settings → Security → Sessions
  Max Concurrent: 3
  
  Use Case: Desktop + Laptop + Mobile
  Enforcement: Oldest session terminated when limit exceeded
```

**Remember Me:**
```bash
Settings → Security → Sessions
  Allow "Remember Me": ✅ Yes
  Duration: 30 days
  
  User Experience:
    - Check "Remember Me" at login
    - Stay logged in for 30 days (or until logout)
    - Still subject to IP whitelist, MFA
```

### Session Monitoring

**Active Sessions:**
```bash
Settings → Security → Sessions → Active Sessions

Current Sessions:
  1. Desktop (Chrome) - 203.0.113.50 - Active now
  2. Laptop (Firefox) - 198.51.100.25 - 2 hours ago
  3. Mobile (Safari) - 192.0.2.10 - 1 day ago
  
Actions:
  [Terminate Session] - End specific session remotely
  [Terminate All] - Log out all devices (force re-login)
```

**Session Audit:**
```bash
Settings → Security → Audit Log → Filter: "Session"

Recent Activity:
  • 2026-01-24 10:00 - User logged in (Desktop, Chrome)
  • 2026-01-24 10:05 - Session active (Desktop)
  • 2026-01-23 15:30 - User logged out (Mobile)
  • 2026-01-22 09:00 - Session timeout (Laptop)
```

---

## Password Policies

### Default Policy

```bash
Settings → Security → Password Policy

Requirements:
  Minimum Length: 12 characters
  Uppercase: Required (at least 1)
  Lowercase: Required (at least 1)
  Numbers: Required (at least 1)
  Special Characters: Required (!@#$%^&*)
  
Restrictions:
  Cannot contain email/username
  Cannot be common passwords (checked against list)
  Cannot be same as last 3 passwords
  
Rotation:
  Expire After: 90 days (optional)
  Warning: 7 days before expiry
```

### Custom Policy (Enterprise)

```bash
Settings → Security → Password Policy → Advanced

Industry Compliance:
  ⬜ Standard (12 chars, mixed case, numbers, symbols)
  ⬜ HIPAA (14 chars, 90-day rotation, stricter)
  ✅ PCI-DSS (15 chars, 60-day rotation, strictest)
  
Apply Policy
```

---

## API Key Security

### API Key Management

**Create API Key:**
```bash
Settings → API Keys → Create New Key
  Name: "Production API Access"
  Scope: read:analytics, write:reports
  Expires: 90 days (auto-rotation)
  IP Restrictions: 203.0.113.0/24
  
[Generate Key]

API Key: sk_live_abc123...
Secret: Copy and save securely (shown once!)
```

**Key Rotation:**
```bash
Settings → API Keys → Production API Access → Rotate
  
New Key: sk_live_xyz789...
Old Key: Valid for 7 days (grace period)
  
Action Required:
  1. Update application with new key
  2. Test with new key
  3. Revoke old key after testing
```

**Scope Limits:**
```bash
Available Scopes:
  read:analytics - View analytics data
  write:reports - Create/update reports
  read:users - View user list
  write:users - Manage users (admin only)
  read:audit - View audit logs
  
Best Practice: Least privilege (only grant needed scopes)
```

---

## Audit Logging

### What's Logged

**User Actions:**
- Login/logout
- MFA enabled/disabled
- Password changes
- User created/updated/deleted
- Role changes
- Permission grants/revokes

**Data Access:**
- Report created/viewed/exported
- Analytics query run
- API call made
- Settings changed

**Security Events:**
- Failed login attempts
- MFA failure
- IP blocked (whitelist)
- Session timeout
- API key created/rotated

### Viewing Audit Logs

```bash
Settings → Security → Audit Log

Filters:
  User: [Select user]
  Action: [Select action type]
  Date Range: Last 30 days
  IP Address: [Filter by IP]
  
[Apply Filters]

Results (100 per page):
  • 2026-01-24 10:15 - john@company.com - Login - 203.0.113.50
  • 2026-01-24 10:20 - john@company.com - MFA Enabled - 203.0.113.50
  • 2026-01-24 10:25 - john@company.com - Report Created (Monthly Cost) - 203.0.113.50
```

### Export Audit Logs

```bash
Settings → Security → Audit Log → Export

Format: CSV, JSON, PDF
Date Range: Custom
Include: All fields
Encryption: AES-256 (for sensitive data)

[Download Export]

Use Case: Compliance audits, forensics, reporting
```

---

## Compliance & Best Practices

### SOC 2 Compliance

**Controls Implemented:**
- ✅ Access control (RBAC, MFA)
- ✅ Encryption (at rest, in transit)
- ✅ Audit logging (100% coverage)
- ✅ Session management
- ✅ Password policies
- ✅ Network security (IP whitelist)

**Audit Evidence:**
```bash
# Collect for auditors:
1. Audit logs (last 12 months)
2. Access control matrix
3. MFA enablement report
4. Security policy documentation
5. Incident response logs
```

### HIPAA Compliance

**Required Settings:**
```bash
Settings → Security → Compliance → HIPAA Mode

Enabled Features:
  ✅ MFA required for all users
  ✅ Session timeout: 15 minutes (idle)
  ✅ Password rotation: 90 days
  ✅ Audit logging: Enabled (7-year retention)
  ✅ Encryption: AES-256
  ✅ IP whitelisting: Recommended

[Enable HIPAA Mode]
```

### GDPR Compliance

**Data Subject Rights:**
```bash
Settings → Security → GDPR

Enabled Features:
  ✅ Data export (user can download all data)
  ✅ Data deletion (right to be forgotten)
  ✅ Consent management (track consent for processing)
  ✅ Data breach notification (< 72 hours)
  
Contact: privacy@securebase.com
```

---

## Security Checklist

Before going to production:

- [ ] SSO configured and tested
- [ ] MFA enabled for all admin users
- [ ] IP whitelist configured (if required)
- [ ] Session timeout set appropriately
- [ ] Password policy meets compliance requirements
- [ ] API keys rotated (if existing)
- [ ] Audit logging enabled and tested
- [ ] Security team trained on features
- [ ] Incident response plan documented
- [ ] Backup access method tested (emergency bypass)

**All checked?** You're production-ready! ✅

---

**Security Guide Version:** 1.0  
**Last Updated:** January 24, 2026  
**Compliance:** SOC 2, HIPAA, GDPR Ready  

**For questions:** security@securebase.com
