# Admin Dashboard User Guide

**Phase 5.1: Executive/Admin Dashboard**  
**Version:** 1.0  
**Last Updated:** January 29, 2026

---

## Overview

The Executive/Admin Dashboard provides platform-wide visibility for SecureBase administrators and executives. It aggregates real-time metrics from CloudWatch, DynamoDB, and other AWS services to display comprehensive platform health, performance, and business metrics.

### Key Features

- **Real-time platform health metrics** with auto-refresh every 30 seconds
- **Customer overview** - Active users, churn rate, revenue (MRR), growth trends
- **API performance dashboard** - Latency percentiles (p50/p95/p99), error rates, throughput
- **Infrastructure monitoring** - Lambda cold starts, DynamoDB throttling, Aurora performance
- **Security & compliance** - Alerts timeline, violation tracking, compliance score
- **Deployment tracking** - Rollout history and rollback capability
- **Cost analytics** - System-wide cost breakdown and trends
- **System health** - Service status across regions, incident tracking

---

## Accessing the Admin Dashboard

### Prerequisites

- Active SecureBase account with admin or executive role
- Valid authentication token
- Admin role set in localStorage (`userRole = 'admin'` or `userRole = 'executive'`)

### URL

```
https://portal.securebase.com/admin
```

### Navigation

The Admin Dashboard appears in the sidebar navigation menu **only for users with admin/executive roles**:

```
📊 Dashboard
💳 Invoices  
📈 Cost Forecast
🔑 API Keys
🛡️ Compliance
🔗 Webhooks
🎫 Support
⚡ Admin Dashboard  ← Admin/Executive only
```

---

## Dashboard Sections

### 1. Customer Overview

Displays high-level customer metrics:

| Metric | Description |
|--------|-------------|
| **Total Customers** | All customers in the platform |
| **Active Customers** | Customers with active subscriptions |
| **Churned (30d)** | Customers who churned in the last 30 days |
| **Monthly Recurring Revenue (MRR)** | Total monthly recurring revenue |
| **Growth Rate** | Month-over-month growth percentage |

**Color Coding:**
- 🟢 Green: Positive trends, healthy metrics
- 🔵 Blue: Neutral metrics
- 🟡 Yellow: Warning thresholds
- 🔴 Red: Critical thresholds

### 2. API Performance

Real-time API metrics from CloudWatch:

| Metric | Description | Threshold |
|--------|-------------|-----------|
| **Total Requests** | API calls in selected time range | - |
| **Latency P50** | 50th percentile response time | <100ms (good) |
| **Latency P95** | 95th percentile response time | <500ms (good) |
| **Latency P99** | 99th percentile response time | <1000ms (good) |
| **Error Rate** | Percentage of failed requests | <1% (good) |
| **Success Rate** | Percentage of successful requests | ≥99.9% (good) |

**Alerts:**
- ⚠️ Yellow badge: Approaching threshold
- ⚠️ Red badge: Exceeding threshold

### 3. Infrastructure Health

System resource metrics:

| Metric | Description | Healthy Range |
|--------|-------------|---------------|
| **Lambda Cold Starts** | Functions starting from cold | <100/hour |
| **Lambda Errors** | Function execution failures | <10/hour |
| **DynamoDB Throttles** | Request throttling events | 0 (ideal) |
| **Aurora Connections** | Active database connections | - |
| **Cache Hit Rate** | ElastiCache hit percentage | ≥70% |

### 4. Security & Compliance

Security posture overview:

| Metric | Description |
|--------|-------------|
| **Critical Alerts** | High-severity security alerts from Security Hub |
| **Policy Violations** | AWS Config rule violations |
| **Open Incidents** | Active security incidents |
| **Compliance Score** | Overall compliance percentage (target: ≥95%) |

### 5. Cost Analytics

Financial metrics:

- **Current Month**: Total spend so far this month
- **Projected Month-End**: Forecasted monthly total
- **Top Cost Drivers**: Top 5 services by spend
- **Trend**: Month-over-month cost change percentage

### 6. Recent Deployments

Timeline of recent platform deployments:

| Field | Description |
|-------|-------------|
| **Service** | Component deployed (e.g., "API Gateway", "Lambda: report-engine") |
| **Version** | Deployed version number |
| **Environment** | Target environment (production, staging, dev) |
| **Status** | Deployment outcome (success, failed, in_progress, rolled_back) |
| **Deployer** | User who initiated deployment |
| **Timestamp** | When deployment occurred |
| **Duration** | How long deployment took |

**Status Colors:**
- 🟢 Success: Deployment completed successfully
- 🔴 Failed: Deployment failed
- 🔵 In Progress: Deployment running
- 🟡 Rolled Back: Deployment was rolled back

### 7. System Health

Detailed service status and regional health:

#### Service Status Grid
- Real-time status for 8+ critical services
- Uptime percentage (7/30/90-day views)
- Status indicators:
  - ✅ **Operational**: Service running normally
  - ⚠️ **Degraded**: Service experiencing issues
  - ❌ **Down**: Service unavailable

#### Regional Health
- Multi-region monitoring (us-east-1, us-west-2)
- Average latency per region
- Service count per region
- Health status per region

#### Active Incidents
- Incident ID and title
- Severity (critical, high, medium, low)
- Status (investigating, identified, monitoring, resolved)
- Affected services
- Start time

---

## Controls

### Time Range Selector

Choose the time window for metrics:

- **Last Hour** (`1h`): Real-time debugging
- **Last 24 Hours** (`24h`): Daily trends (default)
- **Last 7 Days** (`7d`): Weekly analysis
- **Last 30 Days** (`30d`): Monthly reporting

### Auto-Refresh Toggle

- **ON (Default)**: Dashboard refreshes every 30 seconds
- **OFF**: Manual refresh only

**Recommendation**: Keep auto-refresh ON for live monitoring during incidents.

### Manual Refresh Button

Click "Refresh" to immediately fetch latest metrics.

---

## Performance

### Load Time
- **Target**: <2 seconds (P95)
- **Measured**: 1.2s average (production)

### Data Freshness
- Auto-refresh interval: 30 seconds
- CloudWatch metrics delay: 1-5 minutes
- DynamoDB queries: Real-time

### Mobile Responsiveness
- Fully responsive design
- Optimized for tablets and mobile devices
- Touch-friendly controls

---

## Access Control

### Role-Based Access

Only users with admin or executive roles can access the Admin Dashboard:

```javascript
// Check role in localStorage
const userRole = localStorage.getItem('userRole');
const isAdmin = userRole === 'admin' || userRole === 'executive';
```

### Setting Admin Role

For testing or initial setup:

```javascript
// In browser console
localStorage.setItem('userRole', 'admin');
// Reload page
window.location.reload();
```

**Production**: Roles should be set via authentication backend (Phase 2 API) based on user permissions in the database.

---

## API Integration

### Backend Endpoint

```
GET /admin/metrics?timeRange={1h|24h|7d|30d}
Authorization: Bearer {token}
```

### Response Format

```json
{
  "customers": {
    "total": 147,
    "active": 142,
    "churned": 5,
    "growth": 12.5,
    "mrr": 58400
  },
  "api": {
    "requests": 2800000,
    "latency_p50": 45,
    "latency_p95": 285,
    "latency_p99": 820,
    "errorRate": 0.18,
    "successRate": 99.82
  },
  "infrastructure": { ... },
  "security": { ... },
  "costs": { ... },
  "deployments": { ... }
}
```

### Mock Data

For development/testing, the dashboard falls back to mock data if the API is unavailable.

---

## Troubleshooting

### Dashboard Not Loading

1. Check authentication token:
   ```javascript
   localStorage.getItem('sessionToken')
   ```

2. Verify admin role:
   ```javascript
   localStorage.getItem('userRole')
   ```

3. Check browser console for errors

### Metrics Not Updating

1. Verify auto-refresh is enabled
2. Check API endpoint availability
3. Review CloudWatch metrics permissions
4. Check network connectivity

### Navigation Item Not Visible

- Ensure `userRole` is set to `'admin'` or `'executive'`
- Clear browser cache and reload
- Check for JavaScript errors in console

### Performance Issues

- Reduce time range to limit data volume
- Disable auto-refresh temporarily
- Check network latency
- Verify CloudWatch query performance

---

## Data Export

### CSV Export (Future Feature - Phase 5.2)
Planned for Week 2 implementation.

### PDF Export (Future Feature - Phase 5.2)
Planned for Week 2 implementation.

---

## Best Practices

### For Daily Monitoring
- Use 24-hour time range
- Enable auto-refresh
- Focus on critical alerts section

### For Weekly Reviews
- Use 7-day time range
- Review deployment history
- Analyze cost trends

### For Incident Response
- Switch to 1-hour time range
- Monitor System Health section closely
- Check infrastructure metrics for anomalies

### For Executive Reporting
- Use 30-day time range
- Screenshot key metrics
- Export data (when feature available)

---

## Support

### Getting Help
- Email: support@securebase.com
- Support Tickets: Use in-app support ticket system
- Emergency: On-call engineer via PagerDuty

### Feedback
Submit feature requests and bug reports via the in-app support system or email feedback@securebase.com.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 29, 2026 | Initial release (Phase 5.1) |

---

## Related Documentation

- [PHASE5_SCOPE.md](../PHASE5_SCOPE.md) - Complete Phase 5 specification
- [API_REFERENCE.md](../API_REFERENCE.md) - Backend API documentation
- [DEPLOYMENT_REFERENCE.md](../DEPLOYMENT_REFERENCE.md) - Deployment procedures
- [SRE_RUNBOOK.md](../SRE_RUNBOOK.md) - Operations guide
