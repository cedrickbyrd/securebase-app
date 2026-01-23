# Phase 4 Analytics API Reference

**Version:** 1.0  
**Last Updated:** January 23, 2026  
**Base URL:** `https://api.securebase.io/v1`

---

## Table of Contents
1. [Authentication](#authentication)
2. [Analytics Endpoints](#analytics-endpoints)
3. [Report Management](#report-management)
4. [Export Formats](#export-formats)
5. [Scheduled Reports](#scheduled-reports)
6. [Error Handling](#error-handling)
7. [Rate Limits](#rate-limits)

---

## Authentication

All API requests require authentication using JWT tokens in the `Authorization` header:

```http
Authorization: Bearer <your-jwt-token>
```

The JWT token contains the `customerId` claim used for data isolation and multi-tenancy.

---

## Analytics Endpoints

### GET /analytics

Query analytics data with multi-dimensional filtering.

**Query Parameters:**
- `dateRange` (optional): Time period - `7d`, `30d`, `90d`, `12m`, `custom` (default: `30d`)
- `dimension` (optional): Grouping dimension - `service`, `region`, `tag`, `account`, `compliance` (default: `service`)
- `startDate` (optional): Start date for custom range (ISO 8601 format)
- `endDate` (optional): End date for custom range (ISO 8601 format)
- `filters` (optional): JSON object with filter criteria

**Example Request:**
```bash
curl -X GET "https://api.securebase.io/v1/analytics?dateRange=30d&dimension=service" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "data": [
    {
      "service": "EC2",
      "cost": 500.00,
      "usage": 2400,
      "region": "us-east-1",
      "timestamp": "2024-01-15T00:00:00Z"
    },
    {
      "service": "S3",
      "cost": 100.50,
      "usage": 50000,
      "region": "us-west-2",
      "timestamp": "2024-01-15T00:00:00Z"
    }
  ],
  "summary": {
    "totalCost": 600.50,
    "totalUsage": 52400,
    "dateRange": "30d",
    "dimension": "service"
  },
  "cached": false,
  "executionTime": 1.24
}
```

**Performance:** < 5s (p95)

---

### GET /analytics/summary

Get high-level summary statistics.

**Query Parameters:**
- `dateRange` (optional): Time period (default: `30d`)

**Example Response:**
```json
{
  "summary": {
    "totalCost": 1250.00,
    "costChange": 5.2,
    "securityScore": 95,
    "complianceScore": 98,
    "activeResources": 150,
    "criticalFindings": 3
  }
}
```

---

### GET /analytics/cost-breakdown

Get detailed cost breakdown by dimension.

**Query Parameters:**
- `dateRange` (optional): Time period (default: `30d`)
- `dimension` (required): Grouping - `service`, `region`, `tag`, `account`
- `topN` (optional): Limit to top N results (default: 10)

**Example Request:**
```bash
curl -X GET "https://api.securebase.io/v1/analytics/cost-breakdown?dimension=service&topN=5" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "breakdown": [
    {"service": "EC2", "cost": 500.00, "percentage": 40.0},
    {"service": "RDS", "cost": 300.00, "percentage": 24.0},
    {"service": "S3", "cost": 200.00, "percentage": 16.0},
    {"service": "Lambda", "cost": 150.00, "percentage": 12.0},
    {"service": "DynamoDB", "cost": 100.00, "percentage": 8.0}
  ],
  "total": 1250.00,
  "dimension": "service"
}
```

---

### GET /analytics/security

Get security analytics and findings.

**Query Parameters:**
- `dateRange` (optional): Time period (default: `7d`)
- `severity` (optional): Filter by severity - `critical`, `high`, `medium`, `low`

**Example Response:**
```json
{
  "findings": [
    {
      "severity": "critical",
      "count": 3,
      "title": "Unencrypted S3 Buckets",
      "resources": ["bucket-1", "bucket-2", "bucket-3"]
    },
    {
      "severity": "high",
      "count": 5,
      "title": "Open Security Groups",
      "resources": ["sg-12345", "sg-67890"]
    }
  ],
  "securityScore": 95,
  "trend": -2
}
```

---

### GET /analytics/compliance

Get compliance analytics by framework.

**Query Parameters:**
- `framework` (optional): Compliance framework - `hipaa`, `pci-dss`, `soc2`, `cis`
- `dateRange` (optional): Time period (default: `30d`)

**Example Response:**
```json
{
  "framework": "hipaa",
  "score": 98,
  "controls": {
    "passed": 245,
    "failed": 5,
    "total": 250
  },
  "failedControls": [
    {
      "id": "164.312(a)(1)",
      "title": "Access Control",
      "status": "non-compliant",
      "resources": 3
    }
  ]
}
```

---

### GET /analytics/usage

Get resource usage analytics.

**Query Parameters:**
- `dateRange` (optional): Time period (default: `30d`)
- `metric` (optional): Specific metric - `api_calls`, `compute_hours`, `storage_gb`

**Example Response:**
```json
{
  "usage": [
    {
      "date": "2024-01-15",
      "apiCalls": 15000,
      "computeHours": 720,
      "storageGB": 500
    }
  ],
  "totals": {
    "apiCalls": 450000,
    "computeHours": 21600,
    "storageGB": 15000
  }
}
```

---

## Report Management

### GET /reports

List all saved reports for the authenticated customer.

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)

**Example Response:**
```json
{
  "reports": [
    {
      "id": "rpt-123abc",
      "name": "Monthly Cost Analysis",
      "description": "Detailed cost breakdown by service",
      "config": {
        "dateRange": "30d",
        "dimension": "service",
        "filters": {}
      },
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-20T15:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

---

### GET /reports/{reportId}

Get details of a specific report.

**Path Parameters:**
- `reportId` (required): Report identifier

**Example Response:**
```json
{
  "report": {
    "id": "rpt-123abc",
    "name": "Monthly Cost Analysis",
    "description": "Detailed cost breakdown by service",
    "config": {
      "dateRange": "30d",
      "dimension": "service",
      "filters": {"region": "us-east-1"}
    },
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-20T15:45:00Z",
    "lastRun": "2024-01-23T08:00:00Z"
  }
}
```

---

### POST /reports

Create a new saved report.

**Request Body:**
```json
{
  "name": "Weekly Security Report",
  "description": "Security findings from the past week",
  "config": {
    "dateRange": "7d",
    "dimension": "security",
    "filters": {
      "severity": "high"
    }
  }
}
```

**Example Response:**
```json
{
  "report": {
    "id": "rpt-456def",
    "name": "Weekly Security Report",
    "created_at": "2024-01-23T14:30:00Z"
  },
  "message": "Report created successfully"
}
```

**Status Codes:**
- `201`: Report created successfully
- `400`: Invalid request body
- `409`: Report with same name already exists

---

### PUT /reports/{reportId}

Update an existing report.

**Path Parameters:**
- `reportId` (required): Report identifier

**Request Body:**
```json
{
  "name": "Updated Report Name",
  "description": "Updated description",
  "config": {
    "dateRange": "90d",
    "dimension": "service"
  }
}
```

**Status Codes:**
- `200`: Report updated successfully
- `404`: Report not found
- `400`: Invalid request body

---

### DELETE /reports/{reportId}

Delete a saved report.

**Path Parameters:**
- `reportId` (required): Report identifier

**Status Codes:**
- `200`: Report deleted successfully
- `404`: Report not found

---

## Export Formats

### POST /analytics/export

Export analytics data in various formats.

**Request Body:**
```json
{
  "format": "pdf",
  "data": [...],
  "reportName": "Monthly Cost Report",
  "options": {
    "includeCharts": true,
    "pageSize": "letter",
    "orientation": "portrait"
  }
}
```

**Supported Formats:**
- `csv`: Comma-separated values (text/csv)
- `json`: JSON format (application/json)
- `pdf`: PDF document (application/pdf)
- `excel`: Excel spreadsheet (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

**CSV Export Example:**
```bash
curl -X POST "https://api.securebase.io/v1/analytics/export" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "data": [...],
    "reportName": "Cost Report"
  }' \
  --output report.csv
```

**PDF Export Example:**
```bash
curl -X POST "https://api.securebase.io/v1/analytics/export" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "pdf",
    "data": [...],
    "reportName": "Security Report",
    "options": {
      "includeCharts": true,
      "pageSize": "letter"
    }
  }' \
  --output report.pdf
```

**Performance:** < 10s for PDF export (p95)

---

## Scheduled Reports

### POST /reports/schedule

Schedule automatic report delivery.

**Request Body:**
```json
{
  "reportId": "rpt-123abc",
  "schedule": "daily",
  "recipients": ["admin@example.com", "team@example.com"],
  "format": "pdf",
  "enabled": true,
  "options": {
    "timezone": "America/New_York",
    "time": "08:00"
  }
}
```

**Schedule Options:**
- `daily`: Every day at specified time
- `weekly`: Every week on specified day
- `monthly`: First day of each month
- `custom`: Cron expression

**Delivery Methods:**
- Email: Send to specified email addresses
- Slack: Post to Slack webhook
- Webhook: HTTP POST to custom endpoint

**Example Response:**
```json
{
  "schedule": {
    "id": "sch-789ghi",
    "reportId": "rpt-123abc",
    "schedule": "daily",
    "nextRun": "2024-01-24T08:00:00Z",
    "enabled": true
  },
  "message": "Report scheduled successfully"
}
```

**Success Rate Target:** > 98%

---

### GET /reports/{reportId}/schedules

Get all schedules for a specific report.

**Example Response:**
```json
{
  "schedules": [
    {
      "id": "sch-789ghi",
      "schedule": "daily",
      "recipients": ["admin@example.com"],
      "format": "pdf",
      "enabled": true,
      "lastRun": "2024-01-23T08:00:00Z",
      "nextRun": "2024-01-24T08:00:00Z",
      "deliveryStatus": "success"
    }
  ]
}
```

---

### PUT /reports/schedules/{scheduleId}

Update a scheduled report.

**Request Body:**
```json
{
  "enabled": false,
  "recipients": ["newadmin@example.com"],
  "schedule": "weekly"
}
```

---

### DELETE /reports/schedules/{scheduleId}

Cancel a scheduled report.

**Status Codes:**
- `200`: Schedule cancelled successfully
- `404`: Schedule not found

---

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  },
  "timestamp": "2024-01-23T14:30:00Z"
}
```

**Common Error Codes:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_REQUEST | Malformed request body or parameters |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource already exists |
| 422 | VALIDATION_ERROR | Request validation failed |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Temporary service unavailability |

---

## Rate Limits

**Default Limits:**
- Analytics queries: 100 requests/minute per customer
- Export operations: 20 requests/minute per customer
- Report CRUD: 50 requests/minute per customer

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706025600
```

**Exceeding Limits:**
When rate limit is exceeded, the API returns `429 Too Many Requests`:

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60,
  "limit": 100,
  "window": 60
}
```

---

## SDK Examples

### JavaScript/Node.js

```javascript
const SecureBaseAnalytics = require('@securebase/analytics');

const client = new SecureBaseAnalytics({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.securebase.io/v1'
});

// Get analytics data
const data = await client.analytics.get({
  dateRange: '30d',
  dimension: 'service'
});

// Export to PDF
const pdf = await client.analytics.export({
  format: 'pdf',
  data: data,
  reportName: 'Monthly Report'
});

// Schedule report
await client.reports.schedule({
  reportId: 'rpt-123',
  schedule: 'daily',
  recipients: ['admin@example.com'],
  format: 'pdf'
});
```

### Python

```python
from securebase import AnalyticsClient

client = AnalyticsClient(
    api_key='your-api-key',
    base_url='https://api.securebase.io/v1'
)

# Get analytics data
data = client.analytics.get(
    date_range='30d',
    dimension='service'
)

# Export to CSV
csv_file = client.analytics.export(
    format='csv',
    data=data,
    report_name='Monthly Report'
)

# Schedule report
client.reports.schedule(
    report_id='rpt-123',
    schedule='daily',
    recipients=['admin@example.com'],
    format='pdf'
)
```

---

## Changelog

### v1.0 (January 2026)
- Initial release
- Analytics queries with multi-dimensional filtering
- 4 export formats (CSV, JSON, PDF, Excel)
- Scheduled report delivery
- Report management (CRUD operations)
- Pre-built templates (Cost, Security, Compliance)

---

## Support

For API support, contact:
- Email: api-support@securebase.io
- Documentation: https://docs.securebase.io/api
- Status Page: https://status.securebase.io

---

**Document Version:** 1.0  
**Last Updated:** January 23, 2026  
**Maintained by:** SecureBase Engineering Team
