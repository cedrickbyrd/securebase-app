# Team Management API Reference

**SecureBase Phase 4 - Team Collaboration & RBAC**  
**Version:** 1.0  
**Last Updated:** January 26, 2026

---

## Table of Contents

1. [Authentication](#authentication)
2. [User Management Endpoints](#user-management-endpoints)
3. [Session Management Endpoints](#session-management-endpoints)
4. [Activity Feed Endpoints](#activity-feed-endpoints)
5. [Error Codes](#error-codes)
6. [Rate Limiting](#rate-limiting)
7. [Examples](#examples)

---

## Authentication

All team management API endpoints require JWT session token authentication (except login).

### Authorization Header
```
Authorization: Bearer <session_token>
```

### Session Token

Obtained via `/auth/login` or `/auth/mfa/verify` endpoints.

**Token Properties:**
- Expires in 24 hours
- Contains: `user_id`, `customer_id`, `role`, `session_id`
- Cryptographically signed with HS256

---

## User Management Endpoints

### Create User

Create a new user in the customer account.

**Endpoint:** `POST /users`

**Required Role:** Admin or Manager

**Request Body:**
```json
{
  "email": "string (required)",
  "name": "string (required)",
  "role": "admin|manager|analyst|viewer (required)",
  "job_title": "string (optional)",
  "department": "string (optional)",
  "phone": "string (optional)"
}
```

**Response:** `201 Created`
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "analyst",
  "status": "active",
  "temp_password": "********",
  "must_change_password": true,
  "created_at": "2026-01-26T10:00:00Z"
}
```

**Permissions:**
- Admin: Can create users of any role
- Manager: Can create Manager, Analyst, Viewer only

**Errors:**
- `400` - Invalid request body
- `403` - Insufficient permissions
- `409` - Email already exists

**Example:**
```bash
curl -X POST https://api.securebase.aws/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@example.com",
    "name": "Jane Smith",
    "role": "analyst",
    "department": "Security"
  }'
```

---

### List Users

Get all users in the customer account with optional filters.

**Endpoint:** `GET /users`

**Required Role:** Any

**Query Parameters:**
```
role=admin|manager|analyst|viewer (optional)
status=active|suspended|deleted (optional)
search=string (optional, searches name and email)
limit=number (optional, default 50, max 100)
offset=number (optional, default 0)
```

**Response:** `200 OK`
```json
{
  "users": [
    {
      "user_id": "uuid",
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "admin",
      "status": "active",
      "mfa_enabled": true,
      "last_login": "2026-01-25T15:30:00Z",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0
}
```

**Example:**
```bash
# Get all active analysts
curl "https://api.securebase.aws/users?role=analyst&status=active" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Get User

Get details of a specific user.

**Endpoint:** `GET /users/{user_id}`

**Required Role:** Any

**Response:** `200 OK`
```json
{
  "user_id": "uuid",
  "customer_id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "analyst",
  "status": "active",
  "job_title": "Security Analyst",
  "department": "IT Security",
  "phone": "+1-555-0100",
  "mfa_enabled": true,
  "is_locked": false,
  "failed_login_attempts": 0,
  "last_login": "2026-01-26T09:00:00Z",
  "last_password_change": "2026-01-15T00:00:00Z",
  "created_at": "2026-01-10T00:00:00Z",
  "updated_at": "2026-01-25T12:00:00Z"
}
```

**Errors:**
- `404` - User not found

---

### Update User

Update user profile information.

**Endpoint:** `PUT /users/{user_id}`

**Required Role:** Admin or Manager

**Request Body:**
```json
{
  "name": "string (optional)",
  "job_title": "string (optional)",
  "department": "string (optional)",
  "phone": "string (optional)"
}
```

**Response:** `200 OK`
```json
{
  "user_id": "uuid",
  "name": "John Doe Updated",
  "updated_at": "2026-01-26T10:30:00Z"
}
```

**Permissions:**
- Admin: Can update any user
- Manager: Can update non-admin users

**Errors:**
- `403` - Cannot update admin users (Manager role)
- `404` - User not found

---

### Update User Role

Change a user's role.

**Endpoint:** `PUT /users/{user_id}/role`

**Required Role:** Admin or Manager

**Request Body:**
```json
{
  "role": "admin|manager|analyst|viewer"
}
```

**Response:** `200 OK`
```json
{
  "user_id": "uuid",
  "role": "manager",
  "previous_role": "analyst",
  "updated_at": "2026-01-26T10:30:00Z"
}
```

**Permissions:**
- Admin: Can assign any role
- Manager: Can assign Manager, Analyst, Viewer only

**Side Effects:**
- Permissions automatically updated
- All active sessions remain valid (use updated role)
- Activity logged

**Errors:**
- `403` - Cannot promote to admin (Manager role)
- `404` - User not found

---

### Update User Status

Suspend or activate a user account.

**Endpoint:** `PUT /users/{user_id}/status`

**Required Role:** Admin or Manager

**Request Body:**
```json
{
  "status": "active|suspended"
}
```

**Response:** `200 OK`
```json
{
  "user_id": "uuid",
  "status": "suspended",
  "previous_status": "active",
  "updated_at": "2026-01-26T10:30:00Z"
}
```

**Side Effects (when suspended):**
- All active sessions terminated
- User cannot log in
- API keys disabled
- Activity logged

**Errors:**
- `404` - User not found

---

### Reset Password

Generate a new temporary password for a user.

**Endpoint:** `POST /users/{user_id}/reset-password`

**Required Role:** Admin or Manager

**Response:** `200 OK`
```json
{
  "user_id": "uuid",
  "temp_password": "TempP@ss123",
  "must_change_password": true,
  "expires_at": "2026-01-27T10:30:00Z"
}
```

**Side Effects:**
- All active sessions terminated
- User must change password on next login
- Email sent to user with new password

**Errors:**
- `404` - User not found

**Security:**
- Temporary password valid for 24 hours
- Must be changed on first use
- Old password invalidated immediately

---

### Unlock Account

Unlock a locked user account.

**Endpoint:** `POST /users/{user_id}/unlock`

**Required Role:** Admin or Manager

**Response:** `200 OK`
```json
{
  "user_id": "uuid",
  "is_locked": false,
  "failed_login_attempts": 0,
  "unlocked_at": "2026-01-26T10:30:00Z"
}
```

**Side Effects:**
- Failed login counter reset to 0
- User can log in immediately

**Errors:**
- `404` - User not found
- `400` - Account not locked

---

### Delete User

Soft delete a user account.

**Endpoint:** `DELETE /users/{user_id}`

**Required Role:** Admin or Manager

**Response:** `200 OK`
```json
{
  "user_id": "uuid",
  "status": "deleted",
  "deleted_at": "2026-01-26T10:30:00Z"
}
```

**Important:**
- This is a **soft delete** (data retained for audit)
- User cannot log in
- All sessions terminated
- API keys revoked
- Hard delete after 7 years (compliance)

**Errors:**
- `403` - Cannot delete self
- `404` - User not found

---

## Session Management Endpoints

### Login

Authenticate a user and create a session.

**Endpoint:** `POST /auth/login`

**Required Role:** None (public)

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (without MFA):** `200 OK`
```json
{
  "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-01-27T10:30:00Z",
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "analyst"
  },
  "mfa_required": false,
  "must_change_password": false
}
```

**Response (with MFA):** `200 OK`
```json
{
  "temp_token": "temporary-token-123",
  "mfa_required": true,
  "user": {
    "user_id": "uuid",
    "email": "user@example.com"
  }
}
```

**Errors:**
- `401` - Invalid credentials
- `423` - Account locked (too many failed attempts)
- `403` - Account suspended

**Security:**
- Account locked after 5 failed attempts (30 min)
- IP and device tracked
- All login attempts logged

---

### Verify MFA

Complete MFA verification after login.

**Endpoint:** `POST /auth/mfa/verify`

**Required Role:** None (requires temp_token)

**Request Body:**
```json
{
  "temp_token": "string (required)",
  "mfa_code": "string (6 digits, required)"
}
```

**Response:** `200 OK`
```json
{
  "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-01-27T10:30:00Z",
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  }
}
```

**Errors:**
- `401` - Invalid MFA code
- `400` - Invalid temp_token

**Security:**
- MFA code valid for 30 seconds
- TOTP-based (Google Authenticator, Microsoft Authenticator)
- Temp token valid for 5 minutes

---

### Setup MFA

Generate MFA secret and QR code for user.

**Endpoint:** `POST /auth/mfa/setup`

**Required Role:** Any (for own account), Admin/Manager (for others)

**Request Body:**
```json
{
  "user_id": "string (required)"
}
```

**Response:** `200 OK`
```json
{
  "mfa_secret": "JBSWY3DPEHPK3PXP",
  "qr_code_url": "otpauth://totp/SecureBase:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=SecureBase",
  "backup_codes": [
    "12345-67890",
    "23456-78901",
    "34567-89012"
  ]
}
```

**Important:**
- MFA not enabled until first successful verification
- QR code URL for easy setup in authenticator apps
- Backup codes for account recovery

---

### Refresh Session

Renew session token using refresh token.

**Endpoint:** `POST /auth/refresh`

**Required Role:** None (requires refresh_token)

**Request Body:**
```json
{
  "refresh_token": "string (required)"
}
```

**Response:** `200 OK`
```json
{
  "session_token": "new-session-token",
  "expires_at": "2026-01-27T10:30:00Z"
}
```

**Errors:**
- `401` - Invalid or expired refresh token

---

### Logout

Invalidate current session.

**Endpoint:** `POST /auth/logout`

**Required Role:** Any

**Request Body:**
```json
{
  "session_token": "string (required)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "logged_out_at": "2026-01-26T10:30:00Z"
}
```

**Side Effects:**
- Session immediately invalidated
- Cannot be used for further requests

---

### Get Session Info

Get information about current session.

**Endpoint:** `GET /auth/session`

**Required Role:** Any

**Response:** `200 OK`
```json
{
  "session_id": "uuid",
  "user_id": "uuid",
  "customer_id": "uuid",
  "role": "analyst",
  "created_at": "2026-01-26T10:00:00Z",
  "expires_at": "2026-01-27T10:00:00Z",
  "last_activity": "2026-01-26T10:25:00Z",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0..."
}
```

---

## Activity Feed Endpoints

### Get Activity Feed

Get activity/audit logs with filters.

**Endpoint:** `GET /activity`

**Required Role:** Any

**Query Parameters:**
```
user_id=uuid (optional)
action=string (optional, e.g., "user.created")
resource_type=string (optional, e.g., "user")
resource_id=uuid (optional)
start_date=ISO8601 (optional)
end_date=ISO8601 (optional)
limit=number (optional, default 50, max 100)
offset=number (optional, default 0)
```

**Response:** `200 OK`
```json
{
  "activities": [
    {
      "activity_id": "uuid",
      "customer_id": "uuid",
      "user_id": "uuid",
      "user_name": "Admin User",
      "action": "user.created",
      "resource_type": "user",
      "resource_id": "uuid",
      "changes": {
        "email": "newuser@example.com",
        "role": "analyst"
      },
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2026-01-26T10:00:00Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Permission Filtering:**
- Admin/Manager/Analyst: See all activities
- Viewer: See only own activities

**Example:**
```bash
# Get all user creation events
curl "https://api.securebase.aws/activity?action=user.created" \
  -H "Authorization: Bearer $TOKEN"

# Get activity for specific user
curl "https://api.securebase.aws/activity?user_id=abc-123" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Get User Activity

Get activity logs for a specific user.

**Endpoint:** `GET /activity/user/{user_id}`

**Required Role:** Admin, Manager, Analyst (for any user), Any (for self)

**Query Parameters:**
```
start_date=ISO8601 (optional)
end_date=ISO8601 (optional)
limit=number (optional, default 50, max 100)
offset=number (optional, default 0)
```

**Response:** Same as Activity Feed

---

### Get Resource Activity

Get activity logs for a specific resource.

**Endpoint:** `GET /activity/resource/{type}/{id}`

**Required Role:** Admin, Manager, Analyst

**Response:** Same as Activity Feed

**Example:**
```bash
# Get all activity for a specific user record
curl "https://api.securebase.aws/activity/resource/user/abc-123" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Codes

### Standard HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request body or parameters |
| 401 | Unauthorized | Invalid or missing authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 423 | Locked | Account is locked |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "error_code": "MACHINE_READABLE_CODE",
  "details": {
    "field": "email",
    "reason": "already_exists"
  }
}
```

---

## Rate Limiting

### Limits

| Endpoint Category | Rate Limit | Window |
|------------------|------------|--------|
| Authentication | 10 requests | 1 minute |
| User Management | 100 requests | 1 minute |
| Activity Feed | 200 requests | 1 minute |
| General API | 500 requests | 1 minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75
X-RateLimit-Reset: 1706263200
```

### Rate Limit Exceeded Response

```json
{
  "error": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 45
}
```

---

## Examples

### Complete User Onboarding Flow

```bash
# 1. Admin creates new user
curl -X POST https://api.securebase.aws/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@example.com",
    "name": "Jane Smith",
    "role": "analyst"
  }'

# Response includes temp_password

# 2. New user logs in with temp password
curl -X POST https://api.securebase.aws/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@example.com",
    "password": "TempPassword123!"
  }'

# Response: must_change_password = true

# 3. User changes password (separate endpoint, not shown)
# 4. User logs in again with new password
# 5. User sets up MFA (optional)
curl -X POST https://api.securebase.aws/auth/mfa/setup \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid"
  }'

# 6. User logs in with MFA
# First, login with password
curl -X POST https://api.securebase.aws/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@example.com",
    "password": "NewPassword123!"
  }'

# Response includes temp_token and mfa_required=true

# Then verify MFA code
curl -X POST https://api.securebase.aws/auth/mfa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "temp_token": "temp-token-from-login",
    "mfa_code": "123456"
  }'

# Success! Returns session_token
```

---

## API Versioning

Current version: **v1**

Base URL: `https://api.securebase.aws/v1`

Future versions will be backward compatible for 12 months.

---

## Support

**API Questions:**
- Email: api-support@securebase.aws
- Documentation: docs.securebase.aws/api
- Status Page: status.securebase.aws

**Report Issues:**
- GitHub: github.com/cedrickbyrd/securebase-app/issues
- Email: security@securebase.aws (security issues)

---

**Team Management API Reference**  
**Version:** 1.0  
**Last Updated:** January 26, 2026  
**SecureBase Phase 4 - Team Collaboration & RBAC**
