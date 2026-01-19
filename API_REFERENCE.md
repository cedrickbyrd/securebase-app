# Phase 2 API Reference

## Overview

SecureBase Phase 2 provides a multi-tenant REST API for managing AWS Organizations, compliance, and billing.

**Base URL:** `https://api.securebase.io/v1` (or `https://{api-id}.execute-api.us-east-1.amazonaws.com/prod`)

**Authentication:** Bearer token (API key or session token)

**Format:** JSON

**Rate Limit:** 1,000 requests/minute per customer

---

## Authentication

All endpoints require an `Authorization` header with a Bearer token.

### API Key Format
```
Authorization: Bearer sb_ABC123DEF456_hash789...
```

**Type:** API Key (long-lived, rotate quarterly)
**Generation:** Via `/api-keys/create` endpoint
**Prefix:** `sb_` (9 random chars for display)
**Hash:** SHA-256 of full key (never stored plaintext)

### Session Token Format
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Type:** JWT (24-hour expiration)
**Algorithm:** HS256
**Claims:** sub (customer_id), name, iat, exp, jti (key_prefix)
**Generation:** Automatically when authenticating with API key

---

## Endpoints

### Authentication

#### POST /auth/authenticate
Authenticate with API key and receive session token.

**Request:**
```bash
curl -X POST https://api.securebase.io/v1/auth/authenticate \
  -H "Authorization: Bearer sb_ABC123DEF456_..." \
  -H "Content-Type: application/json"
```

**Response (200):**
```json
{
  "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_name": "ACME Finance",
  "tier": "fintech",
  "expires_in": 86400
}
```

**Response (401):**
```json
{
  "error": "Invalid API key",
  "request_id": "req_abc123"
}
```

---

### Invoices

#### GET /invoices
List customer's invoices.

**Parameters:**
- `limit` (optional, default: 12): Number of invoices to return
- `month` (optional): Filter by month (YYYY-MM-01)
- `status` (optional): Filter by status (draft, issued, paid, overdue, cancelled)

**Request:**
```bash
curl -X GET "https://api.securebase.io/v1/invoices?limit=12&status=paid" \
  -H "Authorization: Bearer {session_token}"
```

**Response (200):**
```json
{
  "invoices": [
    {
      "id": "inv_550e8400",
      "invoice_number": "INV-ACMEFIN-202501",
      "month": "2025-01-01",
      "tier_base_cost": 8000.00,
      "usage_charges": {
        "log_storage": 25.50,
        "nat_processing": 120.75,
        "cloudtrail_events": 0.50,
        "config_evaluations": 15.25,
        "guardduty_findings": 50.00
      },
      "usage_total": 212.00,
      "volume_discount": 0.05,
      "subtotal": 8212.00,
      "tax_amount": 656.96,
      "total_amount": 8868.96,
      "status": "paid",
      "issued_at": "2025-01-01T00:00:00Z",
      "due_at": "2025-01-31T23:59:59Z",
      "paid_at": "2025-01-15T12:30:00Z",
      "payment_method": "aws_marketplace"
    }
  ],
  "total_count": 24,
  "page": 1,
  "page_size": 12
}
```

---

#### GET /invoices/{invoice_id}
Get single invoice details.

**Request:**
```bash
curl -X GET https://api.securebase.io/v1/invoices/inv_550e8400 \
  -H "Authorization: Bearer {session_token}"
```

**Response (200):**
```json
{
  "invoice": {
    "id": "inv_550e8400",
    "invoice_number": "INV-ACMEFIN-202501",
    "month": "2025-01-01",
    ...
    "line_items": [
      {
        "description": "Log Storage",
        "quantity": 100.0,
        "unit": "GB",
        "unit_price": 0.03,
        "total": 3.00
      },
      {
        "description": "NAT Gateway Processing",
        "quantity": 1.5,
        "unit": "TB",
        "unit_price": 45.00,
        "total": 67.50
      }
    ]
  }
}
```

---

#### GET /invoices/{invoice_id}/download
Download invoice as PDF.

**Request:**
```bash
curl -X GET https://api.securebase.io/v1/invoices/inv_550e8400/download \
  -H "Authorization: Bearer {session_token}" \
  -o invoice.pdf
```

**Response (200):** PDF file (application/pdf)

---

### Usage Metrics

#### GET /metrics
Get customer's usage metrics.

**Parameters:**
- `month` (optional): Month to retrieve (YYYY-MM-01, default: current month)
- `metrics` (optional): Comma-separated list of metrics to return

**Request:**
```bash
curl -X GET "https://api.securebase.io/v1/metrics?month=2025-01-01" \
  -H "Authorization: Bearer {session_token}"
```

**Response (200):**
```json
{
  "month": "2025-01-01",
  "usage": {
    "account_count": 5,
    "ou_count": 3,
    "scp_count": 2,
    "cloudtrail_events_logged": 125000,
    "config_rule_evaluations": 50000,
    "guardduty_findings": 42,
    "security_hub_findings": 18,
    "log_storage_gb": 100.25,
    "archive_storage_gb": 250.75,
    "nat_gateway_bytes_processed": 1099511627776,
    "vpn_connections_count": 2,
    "data_transfer_gb": 50.25
  },
  "forecast": {
    "estimated_month_total_gb": 102.50,
    "estimated_charges": 3075.50
  }
}
```

---

#### GET /metrics/history
Get historical metrics (last 12 months).

**Request:**
```bash
curl -X GET https://api.securebase.io/v1/metrics/history \
  -H "Authorization: Bearer {session_token}"
```

**Response (200):**
```json
{
  "metrics": [
    {
      "month": "2025-01-01",
      "account_count": 5,
      "log_storage_gb": 100.25,
      ...
    },
    {
      "month": "2024-12-01",
      "account_count": 5,
      "log_storage_gb": 98.50,
      ...
    }
  ]
}
```

---

### API Keys

#### GET /api-keys
List customer's API keys.

**Request:**
```bash
curl -X GET https://api.securebase.io/v1/api-keys \
  -H "Authorization: Bearer {session_token}"
```

**Response (200):**
```json
{
  "api_keys": [
    {
      "id": "key_abc123",
      "name": "Production Key",
      "key_prefix": "sb_ABC123D",
      "scopes": ["read:invoices", "read:metrics"],
      "created_at": "2025-01-01T10:00:00Z",
      "expires_at": "2025-04-01T10:00:00Z",
      "last_used_at": "2025-01-19T14:30:00Z",
      "is_active": true
    }
  ]
}
```

---

#### POST /api-keys/create
Create a new API key.

**Request:**
```bash
curl -X POST https://api.securebase.io/v1/api-keys/create \
  -H "Authorization: Bearer {session_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Staging API Key",
    "scopes": ["read:invoices", "read:metrics"],
    "expires_in_days": 90
  }'
```

**Response (201):**
```json
{
  "api_key": "sb_XYZ789_full_key_hash_never_returned_again...",
  "key_id": "key_xyz789",
  "key_prefix": "sb_XYZ789",
  "message": "Store this API key securely. You will not be able to view it again."
}
```

---

#### DELETE /api-keys/{key_id}
Revoke an API key.

**Request:**
```bash
curl -X DELETE https://api.securebase.io/v1/api-keys/key_abc123 \
  -H "Authorization: Bearer {session_token}"
```

**Response (204):** No content

---

### Compliance

#### GET /compliance/status
Get compliance status for all frameworks.

**Request:**
```bash
curl -X GET https://api.securebase.io/v1/compliance/status \
  -H "Authorization: Bearer {session_token}"
```

**Response (200):**
```json
{
  "frameworks": [
    {
      "framework": "soc2",
      "status": "compliant",
      "controls_total": 220,
      "controls_passing": 215,
      "controls_failing": 5,
      "last_scan": "2025-01-19T12:00:00Z",
      "issues": [
        {
          "control_id": "CC6.1",
          "description": "MFA not enforced on 1 user",
          "severity": "high",
          "remediation": "Enable MFA for user john.doe@acme.com"
        }
      ]
    },
    {
      "framework": "hipaa",
      "status": "compliant",
      "controls_total": 164,
      "controls_passing": 164,
      "controls_failing": 0,
      "last_scan": "2025-01-19T12:00:00Z"
    }
  ]
}
```

---

#### GET /compliance/findings
Get detailed compliance findings.

**Parameters:**
- `framework` (required): soc2, hipaa, fedramp, cis
- `severity` (optional): critical, high, medium, low

**Request:**
```bash
curl -X GET "https://api.securebase.io/v1/compliance/findings?framework=soc2&severity=high" \
  -H "Authorization: Bearer {session_token}"
```

**Response (200):**
```json
{
  "framework": "soc2",
  "findings": [
    {
      "finding_id": "soc2-cc6-001",
      "control_id": "CC6.1",
      "title": "MFA not enforced",
      "description": "Multi-factor authentication is not required",
      "severity": "high",
      "resource": "user:john.doe@acme.com",
      "discovery_date": "2025-01-19T12:00:00Z",
      "remediation_steps": [
        "Navigate to AWS IAM Console",
        "Select Users",
        "Click on john.doe@acme.com",
        "Enable MFA"
      ],
      "estimated_fix_time_minutes": 5
    }
  ]
}
```

---

### Accounts

#### GET /accounts
List AWS accounts in customer's Organization.

**Request:**
```bash
curl -X GET https://api.securebase.io/v1/accounts \
  -H "Authorization: Bearer {session_token}"
```

**Response (200):**
```json
{
  "accounts": [
    {
      "account_id": "123456789012",
      "name": "Production",
      "email": "prod@acme.com",
      "arn": "arn:aws:organizations::123456789012:account/o-abc123/123456789012",
      "status": "ACTIVE",
      "joined_date": "2024-12-01T10:00:00Z",
      "ou_id": "ou-abc1-123456",
      "ou_name": "Production"
    }
  ],
  "total_count": 5
}
```

---

### Support Tickets

#### POST /support/tickets/create
Create a new support ticket.

**Request:**
```bash
curl -X POST https://api.securebase.io/v1/support/tickets/create \
  -H "Authorization: Bearer {session_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "MFA Setup Help",
    "description": "Need help configuring MFA for our users",
    "priority": "normal"
  }'
```

**Response (201):**
```json
{
  "ticket": {
    "id": "ticket_123",
    "ticket_number": "TKT-2025-0123",
    "subject": "MFA Setup Help",
    "priority": "normal",
    "status": "open",
    "created_at": "2025-01-19T15:30:00Z",
    "support_team_email": "support@securebase.io"
  }
}
```

---

#### GET /support/tickets
List customer's support tickets.

**Request:**
```bash
curl -X GET "https://api.securebase.io/v1/support/tickets?status=open" \
  -H "Authorization: Bearer {session_token}"
```

**Response (200):**
```json
{
  "tickets": [
    {
      "id": "ticket_123",
      "ticket_number": "TKT-2025-0123",
      "subject": "MFA Setup Help",
      "priority": "normal",
      "status": "open",
      "created_at": "2025-01-19T15:30:00Z",
      "updated_at": "2025-01-19T16:00:00Z",
      "assigned_to": "support@securebase.io"
    }
  ]
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid parameter: limit must be between 1 and 100",
  "request_id": "req_abc123"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid or expired authentication token",
  "request_id": "req_abc123"
}
```

### 403 Forbidden
```json
{
  "error": "Customer account is suspended",
  "request_id": "req_abc123"
}
```

### 404 Not Found
```json
{
  "error": "Invoice not found: inv_xyz789",
  "request_id": "req_abc123"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded: 1000 requests per minute",
  "retry_after": 60,
  "request_id": "req_abc123"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "request_id": "req_abc123",
  "support_email": "support@securebase.io"
}
```

---

## HTTP Status Codes

| Code | Meaning | Use |
|------|---------|-----|
| 200 | OK | Request succeeded |
| 201 | Created | Resource successfully created |
| 204 | No Content | Delete successful |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing/invalid auth token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Backend error |

---

## Rate Limiting

**Limit:** 1,000 requests/minute per customer

**Headers returned:**
- `X-RateLimit-Limit`: 1000
- `X-RateLimit-Remaining`: 999
- `X-RateLimit-Reset`: Unix timestamp when limit resets

**When exceeded:**
- Status: 429
- Retry-After: seconds to wait before next request
- Back off exponentially: 1s, 2s, 4s, 8s

---

## Pagination

Endpoints returning lists support pagination:

**Parameters:**
- `page` (optional, default: 1): Page number
- `page_size` (optional, default: 20, max: 100): Items per page

**Response:**
```json
{
  "items": [...],
  "total_count": 150,
  "page": 1,
  "page_size": 20,
  "total_pages": 8
}
```

---

## Webhooks (Phase 3)

Webhooks will send real-time events to your server:

**Events:**
- `invoice.issued` - New invoice created
- `compliance.status_changed` - Compliance status update
- `account.created` - New AWS account created
- `alert.critical` - Critical finding detected

**Configuration:**
```bash
curl -X POST https://api.securebase.io/v1/webhooks \
  -H "Authorization: Bearer {session_token}" \
  -d '{
    "url": "https://your-server.com/webhooks/securebase",
    "events": ["invoice.issued", "compliance.status_changed"]
  }'
```

---

## SDK Examples

### Python
```python
import requests

API_KEY = "sb_ABC123DEF456_..."
headers = {"Authorization": f"Bearer {API_KEY}"}

# Authenticate
response = requests.post(
    "https://api.securebase.io/v1/auth/authenticate",
    headers=headers
)
session_token = response.json()["session_token"]

# Get invoices
headers["Authorization"] = f"Bearer {session_token}"
invoices = requests.get(
    "https://api.securebase.io/v1/invoices",
    headers=headers
).json()
```

### JavaScript
```javascript
const apiKey = "sb_ABC123DEF456_...";

// Authenticate
const authResponse = await fetch(
  "https://api.securebase.io/v1/auth/authenticate",
  {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` }
  }
);
const { session_token } = await authResponse.json();

// Get invoices
const invoicesResponse = await fetch(
  "https://api.securebase.io/v1/invoices",
  {
    headers: { Authorization: `Bearer ${session_token}` }
  }
);
const { invoices } = await invoicesResponse.json();
```

---

## Support

**Documentation:** https://docs.securebase.io
**API Status:** https://status.securebase.io
**Email:** api-support@securebase.io
**Slack:** #securebase-api (for early access partners)

---

*API Version: 1.0*
*Last Updated: January 19, 2025*
