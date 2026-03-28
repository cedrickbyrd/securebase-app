# Tenant Metrics API Reference

## Overview

The Tenant Metrics API provides programmatic access to customer-specific compliance, usage, and cost data. This API powers the Tenant Dashboard frontend and can be used to build custom integrations, reports, and monitoring tools.

**Base URL**: `https://api.securebase.com`  
**Version**: 1.0  
**Protocol**: HTTPS only  
**Content-Type**: `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Error Handling](#error-handling)
4. [Endpoints](#endpoints)
   - [GET /tenant/metrics](#get-tenantmetrics)
   - [GET /tenant/compliance](#get-tenantcompliance)
   - [GET /tenant/usage](#get-tenantusage)
   - [GET /tenant/costs](#get-tenantcosts)
   - [GET /tenant/audit-trail](#get-tenantaudit-trail)
   - [GET /tenant/drift-events](#get-tenantdrift-events)
5. [Response Schemas](#response-schemas)
6. [Code Examples](#code-examples)
7. [Webhooks](#webhooks)

---

## Authentication

### JWT Bearer Token

All API requests must include a valid JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

### Obtaining a Token

**Endpoint**: `POST /auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "your_password",
  "mfa_code": "123456"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_abc123...",
  "tenant_id": "tenant_abc123"
}
```

### Token Claims

The JWT token includes:
- `tenant_id`: Your organization's unique identifier
- `user_id`: The authenticated user's ID
- `email`: User email address
- `roles`: User permission roles
- `exp`: Expiration timestamp (Unix epoch)
- `iat`: Issued at timestamp

### Token Refresh

**Endpoint**: `POST /auth/refresh`

**Request Body**:
```json
{
  "refresh_token": "refresh_abc123..."
}
```

**Response**: Same as login response with new tokens

---

## Rate Limiting

### Limits

- **Standard Tier**: 1,000 requests/hour per tenant
- **Professional Tier**: 5,000 requests/hour per tenant
- **Enterprise Tier**: 20,000 requests/hour per tenant

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4987
X-RateLimit-Reset: 1743264000
```

### Rate Limit Exceeded

**HTTP Status**: `429 Too Many Requests`

**Response**:
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 3600,
  "limit": 5000,
  "reset_at": "2026-03-28T17:00:00Z"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Maintenance mode or AWS service issue |

### Error Response Format

```json
{
  "error": "Error type",
  "message": "Human-readable error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "parameter_name",
    "reason": "Validation failure reason"
  },
  "request_id": "req_abc123"
}
```

### Common Errors

#### Invalid Token
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired JWT token",
  "code": "INVALID_TOKEN"
}
```

#### Tenant Not Found
```json
{
  "error": "Not Found",
  "message": "Tenant not found",
  "code": "TENANT_NOT_FOUND"
}
```

#### Parameter Validation
```json
{
  "error": "Bad Request",
  "message": "Invalid timeRange parameter",
  "code": "INVALID_PARAMETER",
  "details": {
    "field": "timeRange",
    "allowed_values": ["7d", "30d", "90d"]
  }
}
```

---

## Endpoints

### GET /tenant/metrics

Get comprehensive tenant metrics (all-in-one endpoint).

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeRange` | string | No | `30d` | Time range: `7d`, `30d`, `90d` |

**Example Request:**

```bash
curl -X GET \
  'https://api.securebase.com/tenant/metrics?timeRange=30d' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Response (200 OK):**

```json
{
  "compliance": {
    "score": 94.5,
    "violations": {
      "critical": 2,
      "high": 5,
      "medium": 12,
      "low": 8
    },
    "frameworks": {
      "soc2": { "passed": 78, "total": 82 },
      "hipaa": { "passed": 156, "total": 164 },
      "pci": { "passed": 291, "total": 315 },
      "gdpr": { "passed": 45, "total": 50 }
    },
    "nextAudit": "2026-05-15",
    "lastAssessment": "2026-03-01",
    "trend": [92.1, 93.4, 92.8, 94.2, 94.5]
  },
  "usage": {
    "apiCalls": {
      "total": 45320,
      "byDay": [1200, 1450, 1380, 1520, 1490, 1610, 1550],
      "topEndpoints": [
        { "name": "/api/compliance/check", "calls": 12500 },
        { "name": "/api/evidence/upload", "calls": 8200 }
      ],
      "successRate": 99.82
    },
    "storage": {
      "documents": 1250,
      "evidenceGB": 125.4,
      "logsGB": 45.2
    },
    "compute": {
      "lambdaHours": 125.5,
      "dbQueryTime": 3456,
      "avgResponseMs": 145
    }
  },
  "costs": {
    "currentMonth": 1245.67,
    "forecasted": 1580.34,
    "breakdown": {
      "apiGateway": 125.34,
      "lambda": 456.78,
      "database": 523.12,
      "storage": 98.45,
      "dataTransfer": 41.98
    },
    "planLimits": {
      "apiCalls": { "used": 45000, "limit": 100000 },
      "storageGB": { "used": 125, "limit": 500 },
      "userSeats": { "used": 8, "limit": 10 }
    }
  },
  "timestamp": "2026-03-28T16:41:18Z"
}
```

---

### GET /tenant/compliance

Get compliance status and framework details.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `framework` | string | No | `all` | Framework filter: `soc2`, `hipaa`, `pci`, `gdpr`, `all` |

**Example Request:**

```bash
curl -X GET \
  'https://api.securebase.com/tenant/compliance?framework=soc2' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Response (200 OK):**

```json
{
  "score": 94.5,
  "violations": {
    "critical": 2,
    "high": 5,
    "medium": 12,
    "low": 8
  },
  "frameworks": {
    "soc2": { "passed": 78, "total": 82 }
  },
  "nextAudit": "2026-05-15",
  "lastAssessment": "2026-03-01",
  "trend": [92.1, 93.4, 92.8, 94.2, 94.5]
}
```

---

### GET /tenant/usage

Get usage metrics (API calls, storage, compute).

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeRange` | string | No | `30d` | Time range: `7d`, `30d`, `90d` |

**Example Request:**

```bash
curl -X GET \
  'https://api.securebase.com/tenant/usage?timeRange=7d' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Response (200 OK):**

```json
{
  "apiCalls": {
    "total": 10580,
    "byDay": [1200, 1450, 1380, 1520, 1490, 1610, 1550],
    "topEndpoints": [
      { "name": "/api/compliance/check", "calls": 3200 },
      { "name": "/api/evidence/upload", "calls": 2100 }
    ],
    "successRate": 99.82
  },
  "storage": {
    "documents": 1250,
    "evidenceGB": 125.4,
    "logsGB": 45.2
  },
  "compute": {
    "lambdaHours": 28.3,
    "dbQueryTime": 856,
    "avgResponseMs": 142
  }
}
```

---

### GET /tenant/costs

Get cost breakdown and forecasting.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeRange` | string | No | `30d` | Time range: `7d`, `30d`, `90d` |

**Example Request:**

```bash
curl -X GET \
  'https://api.securebase.com/tenant/costs?timeRange=30d' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Response (200 OK):**

```json
{
  "currentMonth": 1245.67,
  "forecasted": 1580.34,
  "breakdown": {
    "apiGateway": 125.34,
    "lambda": 456.78,
    "database": 523.12,
    "storage": 98.45,
    "dataTransfer": 41.98
  },
  "planLimits": {
    "apiCalls": { "used": 45000, "limit": 100000 },
    "storageGB": { "used": 125, "limit": 500 },
    "userSeats": { "used": 8, "limit": 10 }
  },
  "trend": [1150, 1180, 1200, 1220, 1245.67]
}
```

---

### GET /tenant/audit-trail

Get configuration change audit trail.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | `20` | Number of events to return (max 100) |
| `offset` | integer | No | `0` | Pagination offset |

**Example Request:**

```bash
curl -X GET \
  'https://api.securebase.com/tenant/audit-trail?limit=10&offset=0' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Response (200 OK):**

```json
{
  "events": [
    {
      "event_id": "evt_abc123",
      "timestamp": "2026-03-28T14:30:00Z",
      "tenant_id": "tenant_abc123",
      "resource_type": "Policy",
      "resource_id": "pol_password_policy",
      "action": "Updated",
      "changed_by": "admin@example.com",
      "status": "success",
      "changes": {
        "field": "min_length",
        "old_value": 12,
        "new_value": 14
      },
      "ip_address": "203.0.113.45",
      "user_agent": "Mozilla/5.0..."
    }
  ],
  "count": 10,
  "offset": 0,
  "limit": 10
}
```

---

### GET /tenant/drift-events

Get compliance drift detection events.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeRange` | string | No | `30d` | Time range: `7d`, `30d`, `90d` |
| `severity` | string | No | `all` | Severity filter: `critical`, `high`, `medium`, `low`, `all` |

**Example Request:**

```bash
curl -X GET \
  'https://api.securebase.com/tenant/drift-events?timeRange=90d&severity=critical' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Response (200 OK):**

```json
{
  "events": [
    {
      "violation_id": "viol_abc123",
      "tenant_id": "tenant_abc123",
      "detection_timestamp": "2026-03-15T10:30:00Z",
      "control_id": "AC-2",
      "control_name": "Account Management",
      "control_category": "Access Control",
      "framework": "soc2",
      "severity": "critical",
      "status": "resolved",
      "previous_state": "compliant",
      "current_state": "non-compliant",
      "root_cause": "Password policy weakened - minimum length reduced from 14 to 8 characters",
      "remediation_steps": [
        "Restore password minimum length to 14 characters",
        "Review admin change logs for policy modifications"
      ],
      "assigned_to": "security@example.com",
      "resolution_timestamp": "2026-03-16T14:20:00Z",
      "resolution_notes": "Password policy restored to compliant settings."
    }
  ],
  "analytics": {
    "mttr": 27.8,
    "frequency": [
      { "category": "Access Control", "count": 3 },
      { "category": "Audit and Accountability", "count": 2 }
    ],
    "topDriftingControls": [
      { "control": "AC-2: Account Management", "count": 3 },
      { "control": "IA-5: Authenticator Management", "count": 2 }
    ]
  },
  "count": 1
}
```

---

## Response Schemas

### ComplianceSchema

```typescript
interface ComplianceStatus {
  score: number;                    // 0-100
  violations: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  frameworks: {
    [key: string]: {
      passed: number;
      total: number;
    };
  };
  nextAudit: string;                // ISO 8601 date
  lastAssessment: string;           // ISO 8601 date
  trend: number[];                  // Last 5 days
}
```

### UsageSchema

```typescript
interface UsageMetrics {
  apiCalls: {
    total: number;
    byDay: number[];
    topEndpoints: Array<{
      name: string;
      calls: number;
    }>;
    successRate: number;            // Percentage
  };
  storage: {
    documents: number;
    evidenceGB: number;
    logsGB: number;
  };
  compute: {
    lambdaHours: number;
    dbQueryTime: number;            // Seconds
    avgResponseMs: number;
  };
}
```

### CostSchema

```typescript
interface CostMetrics {
  currentMonth: number;             // USD
  forecasted: number;               // USD
  breakdown: {
    [service: string]: number;      // USD per service
  };
  planLimits: {
    [resource: string]: {
      used: number;
      limit: number;
    };
  };
  trend: number[];                  // Historical cost
}
```

---

## Code Examples

### JavaScript (Fetch API)

```javascript
const API_BASE_URL = 'https://api.securebase.com';
const token = 'your_jwt_token';

async function getTenantMetrics(timeRange = '30d') {
  const response = await fetch(
    `${API_BASE_URL}/tenant/metrics?timeRange=${timeRange}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Usage
getTenantMetrics('30d')
  .then(metrics => console.log('Compliance Score:', metrics.compliance.score))
  .catch(error => console.error('Error:', error));
```

### Python (Requests)

```python
import requests

API_BASE_URL = 'https://api.securebase.com'
token = 'your_jwt_token'

def get_tenant_metrics(time_range='30d'):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(
        f'{API_BASE_URL}/tenant/metrics',
        params={'timeRange': time_range},
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()

# Usage
try:
    metrics = get_tenant_metrics('30d')
    print(f"Compliance Score: {metrics['compliance']['score']}")
except requests.exceptions.HTTPError as e:
    print(f"Error: {e}")
```

### cURL

```bash
#!/bin/bash

API_BASE_URL="https://api.securebase.com"
TOKEN="your_jwt_token"

# Get tenant metrics
curl -X GET \
  "${API_BASE_URL}/tenant/metrics?timeRange=30d" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.compliance.score'
```

---

## Webhooks

### Subscribing to Events

**Endpoint**: `POST /webhooks`

**Request Body**:
```json
{
  "url": "https://your-domain.com/webhook",
  "events": [
    "compliance.drift_detected",
    "compliance.violation_resolved",
    "usage.limit_exceeded",
    "cost.forecast_exceeded"
  ],
  "secret": "webhook_secret_abc123"
}
```

### Webhook Payload Format

```json
{
  "event_id": "evt_webhook_abc123",
  "event_type": "compliance.drift_detected",
  "timestamp": "2026-03-28T16:41:18Z",
  "tenant_id": "tenant_abc123",
  "data": {
    "violation_id": "viol_abc123",
    "control_id": "AC-2",
    "severity": "critical"
  },
  "signature": "sha256=abc123..."
}
```

### Verifying Webhook Signatures

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

---

## Support

- **API Documentation**: https://docs.securebase.com/api
- **Email**: api-support@securebase.com
- **Status Page**: https://status.securebase.com

---

**API Version**: 1.0  
**Last Updated**: March 28, 2026  
**Phase**: 5.2 - Tenant Dashboard
