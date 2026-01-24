# Phase 4 API Documentation

## Enterprise Security & SSO APIs

This document describes the RESTful API endpoints added in Phase 4 for enterprise security features.

**Base URL:** `https://api.securebase.com/v1`

**Authentication:** All endpoints require `Authorization: Bearer <token>` header unless noted as public.

---

## Table of Contents

1. [SSO Endpoints](#sso-endpoints)
2. [Security Middleware Endpoints](#security-middleware-endpoints)
3. [API Key Rotation](#api-key-rotation)
4. [Session Management Extensions](#session-management-extensions)
5. [Error Codes](#error-codes)

---

## SSO Endpoints

### List SSO Providers

Get all configured SSO providers for the authenticated customer.

```http
GET /auth/sso/providers
Authorization: Bearer <session_token>
```

**Response 200:**
```json
{
  "providers": [
    {
      "id": "prov_abc123",
      "provider_type": "oidc",
      "provider_name": "Google Workspace",
      "status": "active",
      "oidc_issuer_url": "https://accounts.google.com",
      "oidc_client_id": "12345.apps.googleusercontent.com",
      "oidc_scopes": ["openid", "email", "profile"],
      "auto_provision_users": true,
      "default_role": "viewer",
      "total_logins": 1247,
      "failed_logins": 3,
      "avg_login_time_ms": 1523,
      "last_successful_login_at": "2025-01-24T16:45:00Z",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

---

### Create SSO Provider

Configure a new SSO provider (OIDC or SAML 2.0).

```http
POST /auth/sso/providers
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**OIDC Provider Request:**
```json
{
  "provider_type": "oidc",
  "provider_name": "Google Workspace",
  "oidc_issuer_url": "https://accounts.google.com",
  "oidc_client_id": "12345.apps.googleusercontent.com",
  "oidc_client_secret": "secret123",
  "oidc_scopes": ["openid", "email", "profile"],
  "auto_provision_users": true,
  "default_role": "viewer",
  "status": "testing"
}
```

**SAML Provider Request:**
```json
{
  "provider_type": "saml2",
  "provider_name": "Okta",
  "saml_entity_id": "http://www.okta.com/abc123",
  "saml_sso_url": "https://company.okta.com/app/abc123/sso/saml",
  "saml_x509_cert": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "saml_name_id_format": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  "auto_provision_users": true,
  "default_role": "viewer",
  "status": "testing"
}
```

**Response 200:**
```json
{
  "provider_id": "prov_xyz789",
  "message": "SSO provider created successfully"
}
```

**Errors:**
- `400` - Invalid provider configuration
- `401` - Unauthorized (admin role required)
- `409` - Provider with same name already exists

---

### Initiate SSO Login

Redirect user to SSO provider for authentication.

```http
GET /auth/sso/login/{provider_id}
```

**Public endpoint** - No authentication required.

**Response 302:**
```
Location: https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&state=...
```

For OIDC, redirects to provider's authorization endpoint.
For SAML, redirects to provider's SSO URL with SAML request.

**Performance:** <500ms redirect generation time

---

### SSO Callback

Handle callback from SSO provider (OIDC).

```http
GET /auth/sso/callback?code=...&state=...
```

**Public endpoint** - Invoked by SSO provider.

**Query Parameters:**
- `code` - Authorization code from provider
- `state` - CSRF protection token

**Response 302:**
```
Location: https://portal.securebase.com/#session_token=...&refresh_token=...&expires_at=...
```

**Performance Target:** <2000ms total SSO login time

**Errors:**
- `400` - Invalid or expired state
- `401` - Authentication failed at provider
- `403` - User auto-provisioning disabled

---

### SAML Assertion Consumer Service

Handle SAML POST response from provider.

```http
POST /auth/sso/saml/acs
Content-Type: application/x-www-form-urlencoded
```

**Public endpoint** - Invoked by SAML provider.

**Request Body:**
```
SAMLResponse=...&RelayState=...
```

**Response 302:**
```
Location: https://portal.securebase.com/#session_token=...
```

**Note:** Full SAML implementation requires `python3-saml` library.

---

### Delete SSO Provider

Disable an SSO provider.

```http
DELETE /auth/sso/providers/{provider_id}
Authorization: Bearer <admin_token>
```

**Response 200:**
```json
{
  "message": "SSO provider disabled"
}
```

---

## Security Middleware Endpoints

### Validate IP Address

Check if IP address is whitelisted for customer.

```http
POST /security/validate-ip
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "customer_id": "cust_abc123",
  "ip_address": "203.0.113.42"
}
```

**Response 200:**
```json
{
  "ip_address": "203.0.113.42",
  "whitelisted": true
}
```

**Response 403 (Blocked):**
```json
{
  "error": "IP address not whitelisted",
  "ip_address": "198.51.100.1",
  "whitelisted": false
}
```

**Enforcement:** 100% - All requests from non-whitelisted IPs are blocked.

---

### Check Device Fingerprint

Validate device and detect suspicious activity.

```http
POST /security/check-device
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "user_id": "user_123",
  "customer_id": "cust_abc",
  "fingerprint": "sha256-hash-of-device-attributes"
}
```

**Response 200:**
```json
{
  "device_id": "dev_xyz789",
  "trust_level": "trusted",
  "is_new_device": false,
  "requires_verification": false
}
```

**Trust Levels:**
- `trusted` - Known device, verified
- `unverified` - New device, needs verification
- `suspicious` - Flagged for unusual activity (e.g., impossible travel)
- `blocked` - Administrative block

**Triggers:**
- New device security event
- Suspicious activity alert if different country within 5 minutes

---

### Validate Password

Check password against customer's complexity policy.

```http
POST /security/validate-password
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "password": "MyP@ssw0rd!2025",
  "user_id": "user_123"
}
```

**Response 200:**
```json
{
  "valid": true,
  "message": "Password meets complexity requirements"
}
```

**Response 400 (Invalid):**
```json
{
  "valid": false,
  "error": "Password must contain at least one uppercase letter"
}
```

**Default Policy:**
- Minimum length: 12 characters
- Requires: uppercase, lowercase, numbers, special chars
- Disallows: common passwords, user info, sequential chars
- History: Cannot reuse last 5 passwords

---

### List Security Events

Get security events for customer with filtering.

```http
GET /security/events?severity=high&status=open&limit=100
Authorization: Bearer <token>
```

**Query Parameters:**
- `severity` - Filter by severity (critical, high, medium, low, info)
- `status` - Filter by status (open, investigating, resolved, false_positive)
- `limit` - Max results (default: 100, max: 1000)

**Response 200:**
```json
{
  "events": [
    {
      "id": "evt_abc123",
      "event_type": "brute_force_attempt",
      "severity": "high",
      "status": "open",
      "description": "User admin@company.com: 10 failed login attempts in 5 minutes",
      "user_id": "user_123",
      "user_email": "admin@company.com",
      "ip_address": "203.0.113.42",
      "details": {
        "attempts": 10,
        "time_window_minutes": 5
      },
      "detected_at": "2025-01-24T16:50:00Z",
      "resolved_at": null,
      "alert_sent": true
    }
  ]
}
```

**Event Types:**
- `failed_login` - Invalid credentials
- `account_locked` - Too many failed attempts
- `suspicious_ip` - Non-whitelisted IP access
- `new_device` - Login from new device
- `mfa_failed` - MFA verification failed
- `password_reset_request` - Password reset requested
- `api_key_leaked` - API key detected in public repo
- `unusual_activity` - Anomaly detection triggered
- `brute_force_attempt` - Multiple rapid failures
- `session_hijack_attempt` - Session token misuse
- `privilege_escalation_attempt` - Unauthorized role change
- `data_exfiltration_attempt` - Bulk data export detected

---

### Add IP Whitelist

Add IP address or CIDR range to whitelist.

```http
POST /security/ip-whitelist
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:**
```json
{
  "ip_range": "192.168.1.0/24",
  "description": "Office headquarters network",
  "expires_at": "2026-01-24T00:00:00Z"
}
```

**Response 200:**
```json
{
  "whitelist_id": "wl_xyz789",
  "message": "IP whitelist added successfully"
}
```

**CIDR Examples:**
- `203.0.113.42` - Single IP
- `192.168.1.0/24` - 256 addresses (192.168.1.0-255)
- `10.0.0.0/16` - 65,536 addresses

**Errors:**
- `400` - Invalid CIDR notation
- `401` - Unauthorized (admin role required)

---

### Remove IP Whitelist

Remove IP from whitelist.

```http
DELETE /security/ip-whitelist/{whitelist_id}
Authorization: Bearer <admin_token>
```

**Response 200:**
```json
{
  "message": "IP whitelist removed"
}
```

---

### List IP Whitelists

Get all active IP whitelists for customer.

```http
GET /security/ip-whitelist
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "whitelists": [
    {
      "id": "wl_abc123",
      "ip_range": "192.168.1.0/24",
      "description": "Office headquarters",
      "status": "active",
      "expires_at": null,
      "last_used_at": "2025-01-24T16:45:00Z",
      "usage_count": 12547,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

---

## API Key Rotation

### Get Rotation Policy

Get API key rotation policy for customer.

```http
GET /security/api-key-rotation-policy
Authorization: Bearer <admin_token>
```

**Response 200:**
```json
{
  "customer_id": "cust_abc123",
  "auto_rotation_enabled": true,
  "rotation_frequency": "90_days",
  "rotation_warning_days": 7,
  "old_key_grace_period_hours": 24,
  "notify_on_rotation": true,
  "notification_emails": ["devops@company.com"],
  "last_rotation_at": "2025-01-20T02:00:00Z",
  "next_rotation_at": "2025-04-20T02:00:00Z",
  "total_rotations": 4
}
```

---

### Update Rotation Policy

Configure automatic API key rotation.

```http
POST /security/api-key-rotation-policy
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:**
```json
{
  "auto_rotation_enabled": true,
  "rotation_frequency": "90_days",
  "rotation_warning_days": 7,
  "old_key_grace_period_hours": 24,
  "notify_on_rotation": true,
  "notification_emails": ["devops@company.com", "security@company.com"]
}
```

**Rotation Frequencies:**
- `30_days` - Monthly (high security)
- `60_days` - Bi-monthly
- `90_days` - Quarterly (recommended)
- `180_days` - Semi-annual
- `365_days` - Annual

**Response 200:**
```json
{
  "message": "API key rotation policy updated",
  "next_rotation_at": "2025-04-20T02:00:00Z"
}
```

**Grace Period:**
- Old API key remains valid for specified hours after rotation
- Allows time to update applications without downtime
- Recommended: 24 hours

---

## Session Management Extensions

### Generate MFA Backup Codes

Generate one-time backup codes for MFA recovery.

```http
POST /auth/mfa/backup-codes
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "user_id": "user_123",
  "count": 10
}
```

**Response 200:**
```json
{
  "backup_codes": [
    "2A8F3D9E",
    "7B4C1F6A",
    "9E2D8C3F",
    ...
  ],
  "message": "Save these codes securely. They will not be shown again."
}
```

**⚠️ Security:**
- Codes shown only once
- Hashed with SHA-256 in database
- One-time use only
- Invalidate previous unused codes

---

### Verify MFA Backup Code

Use backup code for MFA verification.

```http
POST /auth/mfa/verify-backup
Content-Type: application/json
```

**Request:**
```json
{
  "user_id": "user_123",
  "backup_code": "2A8F3D9E"
}
```

**Response 200:**
```json
{
  "valid": true,
  "message": "Backup code verified. Recommend regenerating codes."
}
```

**Response 401:**
```json
{
  "valid": false,
  "error": "Invalid or already used backup code"
}
```

---

## Error Codes

### Standard HTTP Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content (success, no response body)
- `302` - Redirect (SSO flows)
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid auth token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `423` - Locked (account locked due to failed attempts)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `501` - Not Implemented (SAML ACS placeholder)

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific validation error"
  }
}
```

### Security-Specific Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `IP_NOT_WHITELISTED` | IP address not in whitelist | 403 |
| `DEVICE_UNVERIFIED` | Device fingerprint not verified | 403 |
| `MFA_REQUIRED` | MFA verification required | 401 |
| `MFA_FAILED` | Invalid MFA code | 401 |
| `ACCOUNT_LOCKED` | Too many failed attempts | 423 |
| `SESSION_EXPIRED` | Session token expired | 401 |
| `SSO_PROVIDER_ERROR` | Error from SSO provider | 502 |
| `INVALID_PASSWORD` | Password doesn't meet policy | 400 |

---

## Rate Limiting

All API endpoints are rate-limited per customer:

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| SSO Login | 100 requests | 1 hour |
| Security Events | 1000 requests | 1 hour |
| IP Whitelist | 100 requests | 1 hour |
| Password Validation | 1000 requests | 1 hour |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1706112000
```

**Response 429:**
```json
{
  "error": "Rate limit exceeded. Retry after 2025-01-24T18:00:00Z",
  "retry_after": "2025-01-24T18:00:00Z"
}
```

---

## Performance SLAs

| Metric | Target | Measured By |
|--------|--------|-------------|
| SSO Login Time | <2s | CloudWatch metric `SSOLoginDuration` |
| IP Validation | <100ms | Lambda execution time |
| Security Event Query | <500ms | Database query time |
| API Key Rotation | <60s | Lambda function timeout |

**Monitoring:**
- CloudWatch alarms trigger on SLA violations
- SNS alerts sent to operations team
- Metrics exported to Prometheus (optional)

---

## Authentication Flow Examples

### OIDC SSO Login (Google)

```
1. User clicks "Sign in with Google" in portal
   GET /auth/sso/login/prov_google_123

2. API redirects to Google
   302 → https://accounts.google.com/o/oauth2/v2/auth?...

3. User authenticates at Google
   (Google UI)

4. Google redirects back with code
   GET /auth/sso/callback?code=xyz&state=abc

5. API exchanges code for token
   POST https://oauth2.googleapis.com/token

6. API creates/retrieves user
   INSERT/SELECT on users table

7. API creates session
   INSERT into user_sessions

8. API redirects to portal with session
   302 → https://portal.securebase.com/#session_token=...

Total Time: <2000ms ✅
```

---

## Webhook Notifications

Security events can trigger webhooks (Phase 4.1):

```json
POST https://your-webhook-url.com/security
Content-Type: application/json
X-SecureBase-Signature: sha256=...

{
  "event_id": "evt_abc123",
  "event_type": "brute_force_attempt",
  "severity": "high",
  "customer_id": "cust_xyz",
  "timestamp": "2025-01-24T17:00:00Z",
  "data": {
    "user_email": "admin@company.com",
    "ip_address": "203.0.113.42",
    "attempts": 10
  }
}
```

**Signature Verification:**
```python
import hmac
import hashlib

def verify_webhook(payload, signature, secret):
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

---

## SDK Examples

### Python

```python
import requests

API_BASE = "https://api.securebase.com/v1"
TOKEN = "your-session-token"

# List SSO providers
response = requests.get(
    f"{API_BASE}/auth/sso/providers",
    headers={"Authorization": f"Bearer {TOKEN}"}
)
providers = response.json()["providers"]

# Add IP whitelist
response = requests.post(
    f"{API_BASE}/security/ip-whitelist",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={
        "ip_range": "192.168.1.0/24",
        "description": "Office network"
    }
)
```

### JavaScript (Node.js)

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://api.securebase.com/v1',
  headers: { 'Authorization': `Bearer ${process.env.SESSION_TOKEN}` }
});

// Get security events
const { data } = await api.get('/security/events', {
  params: { severity: 'critical', status: 'open' }
});

console.log(`${data.events.length} critical events`);
```

### cURL

```bash
# Configure SSO provider
curl -X POST https://api.securebase.com/v1/auth/sso/providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_type": "oidc",
    "provider_name": "Google",
    "oidc_issuer_url": "https://accounts.google.com",
    "oidc_client_id": "123.apps.googleusercontent.com",
    "oidc_client_secret": "secret",
    "default_role": "viewer"
  }'
```

---

## Support

- **API Status**: https://status.securebase.com
- **Documentation**: https://docs.securebase.com
- **Support**: support@securebase.com
- **Security Issues**: security@securebase.com (PGP key available)

**API Version:** v1  
**Last Updated:** January 24, 2025  
**Changelog:** See `/docs/API_CHANGELOG.md`
