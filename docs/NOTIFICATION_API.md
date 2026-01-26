# Notification API Reference

**Version:** 1.0  
**Last Updated:** 2026-01-26  
**Component:** Phase 4 Component 3 - Notifications & Alerting System

---

## Overview

The Notification API provides endpoints for managing user notifications and subscription preferences. All endpoints require authentication via JWT token in the Authorization header.

**Base URL:** `/api` (configured via `VITE_API_BASE_URL` environment variable)

**Authentication:** Bearer token in Authorization header
```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### 1. GET /notifications

Fetch user notifications with pagination and filtering.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `user_id` | string | No* | from token | User ID (extracted from JWT if not provided) |
| `customer_id` | string | No* | from token | Customer ID (extracted from JWT if not provided) |
| `type` | string | No | all | Filter by type: `security_alert`, `billing`, `compliance`, `system`, `informational` |
| `read` | boolean | No | all | Filter by read status: `true` (read), `false` (unread) |
| `limit` | integer | No | 10 | Number of results per page (max: 100) |
| `cursor` | string | No | - | Pagination cursor from previous response |

\* Required if not present in JWT token

#### Response

**Success (200 OK)**
```json
{
  "notifications": [
    {
      "id": "notif-123456789",
      "customer_id": "cust-abc",
      "user_id": "user-xyz",
      "type": "security_alert",
      "priority": "high",
      "title": "Unauthorized Access Attempt",
      "body": "Failed login attempt detected from IP 192.168.1.1",
      "body_html": "<p>Failed login attempt detected from IP <strong>192.168.1.1</strong></p>",
      "read_at": null,
      "created_at": 1706284800000,
      "metadata": {
        "ip_address": "192.168.1.1",
        "location": "Unknown"
      }
    }
  ],
  "unreadCount": 5,
  "hasMore": true,
  "cursor": "eyJpZCI6Im5vdGlmLTEyMzQ1Njc4OSIsImNyZWF0ZWRfYXQiOjE3MDYyODQ4MDAwMDB9"
}
```

**Error (400/401/500)**
```json
{
  "error": "Error message"
}
```

#### Example

```bash
curl -X GET "https://api.securebase.aws/notifications?user_id=user-xyz&limit=10&read=false" \
  -H "Authorization: Bearer <token>"
```

---

### 2. POST /notifications/mark-read

Mark one or more notifications as read.

#### Request Body

```json
{
  "notification_ids": ["notif-123", "notif-456", "notif-789"]
}
```

#### Response

**Success (200 OK)**
```json
{
  "success": true,
  "markedCount": 3
}
```

**Error (400/401/500)**
```json
{
  "error": "No notification IDs provided"
}
```

#### Example

```bash
curl -X POST "https://api.securebase.aws/notifications/mark-read" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"notification_ids": ["notif-123", "notif-456"]}'
```

---

### 3. GET /subscriptions

Get user notification preferences for all event types and channels.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `user_id` | string | No* | from token | User ID |
| `customer_id` | string | No* | from token | Customer ID |

#### Response

**Success (200 OK)**
```json
{
  "subscriptions": {
    "security_alert": {
      "email": true,
      "sms": true,
      "webhook": false,
      "in_app": true
    },
    "billing": {
      "email": true,
      "sms": false,
      "webhook": false,
      "in_app": true
    },
    "compliance": {
      "email": true,
      "sms": false,
      "webhook": false,
      "in_app": true
    },
    "system": {
      "email": false,
      "sms": false,
      "webhook": false,
      "in_app": true
    },
    "informational": {
      "email": false,
      "sms": false,
      "webhook": false,
      "in_app": true
    }
  },
  "emailVerified": true,
  "smsNumber": "+14155551234",
  "webhookUrl": "https://example.com/webhooks/notifications"
}
```

#### Example

```bash
curl -X GET "https://api.securebase.aws/subscriptions?user_id=user-xyz" \
  -H "Authorization: Bearer <token>"
```

---

### 4. PUT /subscriptions

Update user notification preferences.

#### Request Body

```json
{
  "subscriptions": {
    "security_alert": {
      "email": true,
      "sms": true,
      "webhook": false,
      "in_app": true
    },
    "billing": {
      "email": true,
      "sms": false,
      "webhook": false,
      "in_app": true
    }
  }
}
```

#### Response

**Success (200 OK)**
```json
{
  "success": true
}
```

**Error (400/401/500)**
```json
{
  "error": "No subscriptions provided"
}
```

#### Example

```bash
curl -X PUT "https://api.securebase.aws/subscriptions" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptions": {
      "security_alert": {"email": true, "sms": true, "in_app": true}
    }
  }'
```

---

### 5. POST /notifications/test

Send a test notification to verify delivery for a specific channel.

#### Request Body

```json
{
  "channel": "email"
}
```

**Valid channels:** `email`, `sms`, `in_app`, `webhook`

#### Response

**Success (200 OK)**
```json
{
  "success": true,
  "deliveryId": "test-1706284800000",
  "messageId": "msg-abc123",
  "note": ""
}
```

**Error (400/401/500)**
```json
{
  "error": "Invalid channel: invalid_channel"
}
```

#### Example

```bash
curl -X POST "https://api.securebase.aws/notifications/test" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"channel": "email"}'
```

---

## Data Models

### Notification Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique notification identifier |
| `customer_id` | string | Customer ID (for RLS) |
| `user_id` | string | User ID (recipient) |
| `type` | string | Notification type (enum) |
| `priority` | string | Priority level: `critical`, `high`, `medium`, `low` |
| `title` | string | Notification title/subject |
| `body` | string | Plain text body |
| `body_html` | string | HTML-formatted body |
| `read_at` | number\|null | Timestamp when marked as read (milliseconds since epoch) |
| `created_at` | number | Creation timestamp (milliseconds since epoch) |
| `metadata` | object | Additional context data |

### Notification Types

- `security_alert`: Security events (GuardDuty findings, unauthorized access, etc.)
- `billing`: Billing events (invoices, payment failures, usage thresholds)
- `compliance`: Compliance events (Config rule violations, audit findings)
- `system`: System events (deployments, maintenance windows)
- `informational`: Non-critical updates (tips, new features)

### Priority Levels

- `critical`: Immediate action required (security incidents)
- `high`: Important but not urgent (payment failures)
- `medium`: Standard notifications (deployment complete)
- `low`: Informational only (tips, updates)

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid parameters, missing required fields) |
| 401 | Unauthorized (invalid or missing JWT token) |
| 404 | Not Found (route not found) |
| 500 | Internal Server Error |

---

## Rate Limiting

- **Rate Limit:** 100 requests per minute per user
- **Exceeded Response:** HTTP 429 (Too Many Requests)

---

## CORS Headers

All responses include CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type,Authorization
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
```

---

## Security

### Authentication

All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

The token must include:
- `user_id`: User identifier
- `customer_id`: Customer identifier

### Row-Level Security (RLS)

All queries are scoped to the authenticated customer via `customer_id` extracted from the JWT token. Users cannot access notifications from other customers.

### Encryption

- **In Transit:** All API traffic uses TLS 1.2+
- **At Rest:** DynamoDB tables encrypted with AWS-managed keys

---

## Examples

### Fetch Unread Notifications

```javascript
import { getNotifications } from './services/notificationService';

const fetchUnread = async () => {
  const data = await getNotifications({
    userId: 'user-xyz',
    customerId: 'cust-abc',
    read: false,
    limit: 20
  });
  
  console.log(`${data.unreadCount} unread notifications`);
  console.log(data.notifications);
};
```

### Mark Notification as Read

```javascript
import { markAsRead } from './services/notificationService';

const markNotificationRead = async (notificationId) => {
  const result = await markAsRead([notificationId]);
  console.log(`Marked ${result.markedCount} notifications as read`);
};
```

### Update Preferences

```javascript
import { updateSubscriptions } from './services/notificationService';

const updatePrefs = async () => {
  await updateSubscriptions({
    security_alert: {
      email: true,
      sms: true,
      webhook: false,
      in_app: true
    }
  });
  console.log('Preferences updated');
};
```

---

## Testing

### Manual Testing

Use the `/notifications/test` endpoint to verify delivery:

```bash
# Test email delivery
curl -X POST "https://api.securebase.aws/notifications/test" \
  -H "Authorization: Bearer <token>" \
  -d '{"channel": "email"}'

# Test SMS delivery
curl -X POST "https://api.securebase.aws/notifications/test" \
  -H "Authorization: Bearer <token>" \
  -d '{"channel": "sms"}'
```

### Integration Tests

See `phase2-backend/tests/test_notification_api.py` for comprehensive test suite.

---

## Support

- **Documentation:** [NOTIFICATION_USER_GUIDE.md](./NOTIFICATION_USER_GUIDE.md)
- **Troubleshooting:** [NOTIFICATION_TROUBLESHOOTING.md](./NOTIFICATION_TROUBLESHOOTING.md)
- **Architecture:** [NOTIFICATION_ARCHITECTURE.md](./NOTIFICATION_ARCHITECTURE.md)

---

**Last Updated:** 2026-01-26  
**Version:** 1.0  
**Component:** Phase 4 Component 3 - Notifications & Alerting System
