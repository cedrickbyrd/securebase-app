# Phase 4 Component 1: Advanced Analytics & Reporting

**Component:** Analytics & Reporting  
**Phase:** 4.1  
**Duration:** 2 weeks  
**Status:** In Progress - Day 1

---

## Overview

The Analytics component provides customers with advanced data visualization, custom reporting, and scheduled report delivery capabilities. It enables multi-dimensional analysis of cost, security, compliance, and usage metrics.

---

## Features Implemented

### Frontend Components

#### 1. Analytics.jsx (600 lines) ✅
**Location:** `/workspaces/securebase-app/phase3a-portal/src/components/Analytics.jsx`

**Features:**
- Multi-tab interface (Overview, Cost, Security, Compliance, Usage)
- Date range selector (7d, 30d, 90d, 12m, custom)
- Dimension selector (service, region, tag, account, compliance)
- Summary stat cards with trend indicators
- Export functionality (PDF, CSV, Excel, JSON)
- Report scheduling UI
- Saved reports gallery
- Real-time data refresh

**UI Components:**
- StatCard: Displays key metrics with change indicators
- ExportModal: Format selection for exports
- ScheduleModal: Configure scheduled report delivery
- Chart placeholders (to be implemented with Recharts)

**State Management:**
- `analyticsData`: Current analytics data
- `savedReports`: List of saved report configurations
- `activeTab`: Current view (overview, cost, security, compliance, usage)
- `selectedDateRange`: Time period for analysis
- `selectedDimension`: Grouping dimension

#### 2. analyticsService.js (300 lines) ✅
**Location:** `/workspaces/securebase-app/phase3a-portal/src/services/analyticsService.js`

**API Methods:**
- `getAnalytics(params)`: Fetch analytics data with filtering
- `getSavedReports()`: List saved report configurations
- `getReport(reportId)`: Fetch specific report
- `saveReport(data)`: Create new report configuration
- `updateReport(id, updates)`: Modify existing report
- `deleteReport(id)`: Remove report configuration
- `exportReport(params)`: Generate export file (blob)
- `scheduleReport(data)`: Schedule automatic delivery
- `getScheduledReports()`: List active schedules
- `updateSchedule(id, updates)`: Modify schedule
- `deleteSchedule(id)`: Cancel scheduled report
- `getTemplates()`: Get pre-built report templates
- `createFromTemplate(id, params)`: Create from template
- `getSummary(dateRange)`: Get summary metrics
- `getCostBreakdown(params)`: Cost analysis by dimension
- `getSecurityAnalytics(params)`: Security metrics
- `getComplianceAnalytics(params)`: Compliance scores
- `getUsageAnalytics(params)`: Usage metrics

### Backend Functions

#### 3. report_engine.py (500 lines) ✅
**Location:** `/workspaces/securebase-app/phase2-backend/functions/report_engine.py`

**Endpoints:**
- `GET /analytics` - Get analytics data with filtering
- `GET /analytics/summary` - Get summary statistics
- `GET /analytics/cost-breakdown` - Cost breakdown by dimension
- `GET /analytics/security` - Security analytics (placeholder)
- `GET /analytics/compliance` - Compliance analytics (placeholder)
- `GET /analytics/usage` - Usage analytics (placeholder)
- `GET /reports` - List saved reports
- `GET /reports/{id}` - Get specific report
- `POST /reports` - Create new report
- `PUT /reports/{id}` - Update report
- `DELETE /reports/{id}` - Delete report
- `POST /analytics/export` - Export report (placeholder)
- `POST /reports/schedule` - Schedule report delivery (placeholder)

**Features:**
- Customer ID extraction from JWT authorizer
- DynamoDB integration for report storage
- Query result caching (1-hour TTL)
- Date range parsing (7d, 30d, 90d, 12m)
- Multi-dimensional aggregation
- Summary statistics calculation
- Decimal to JSON serialization helper

### Infrastructure

#### 4. Analytics DynamoDB Module ✅
**Location:** `/workspaces/securebase-app/landing-zone/modules/analytics/`

**Tables Created:**
1. **securebase-{env}-reports**
   - Hash Key: `customer_id`
   - Range Key: `id`
   - GSI: `CreatedAtIndex` (by customer_id + created_at)
   - TTL enabled
   - Point-in-time recovery enabled

2. **securebase-{env}-report-schedules**
   - Hash Key: `customer_id`
   - Range Key: `schedule_id`
   - GSI: `NextRunIndex` (for cron execution)
   - TTL enabled

3. **securebase-{env}-report-cache**
   - Hash Key: `cache_key`
   - TTL enabled (1-hour default)

4. **securebase-{env}-metrics**
   - Hash Key: `customer_id`
   - Range Key: `timestamp`
   - GSI: `ServiceIndex`, `RegionIndex`
   - TTL enabled

**S3 Bucket:**
- `securebase-{env}-reports-{account-id}`
- Versioning enabled
- Server-side encryption (AES256)
- Lifecycle: 90-day expiration

---

## Next Steps (Week 1 Remaining)

### 1. ReportBuilder Component
- [ ] Drag-drop field selector
- [ ] Custom metric selection
- [ ] Report preview functionality
- [ ] Template system

### 2. Data Visualization
- [ ] Install Recharts library
- [ ] Implement line charts (time-series)
- [ ] Implement bar charts (comparisons)
- [ ] Implement pie charts (distributions)
- [ ] Implement heatmaps (patterns)

### 3. Export Implementation
- [ ] PDF generation (ReportLab or Puppeteer)
- [ ] CSV export
- [ ] Excel export (openpyxl)
- [ ] JSON export

### 4. Integration
- [ ] Wire Analytics module to root Terraform
- [ ] Deploy Lambda function
- [ ] Add API Gateway routes
- [ ] Test end-to-end flow

---

## Testing Checklist

- [ ] Analytics component renders without errors
- [ ] Date range selector updates data
- [ ] Dimension selector changes grouping
- [ ] Export modal displays correctly
- [ ] Schedule modal accepts valid inputs
- [ ] API calls succeed with mock data
- [ ] Error handling displays user-friendly messages
- [ ] Loading states show appropriately
- [ ] Mobile responsive design verified
- [ ] Accessibility (keyboard navigation, screen readers)

---

## API Contract

### GET /analytics
**Query Parameters:**
```
dateRange: '7d' | '30d' | '90d' | '12m' | 'custom'
dimension: 'service' | 'region' | 'tag' | 'account' | 'compliance'
filters: JSON (optional)
```

**Response:**
```json
{
  "dateRange": "30d",
  "dimension": "service",
  "startDate": "2025-12-20T00:00:00Z",
  "endDate": "2026-01-19T00:00:00Z",
  "summary": {
    "totalCost": 1234.56,
    "apiCalls": 50000,
    "complianceScore": 95,
    "activeResources": 120,
    "costChange": 5.2,
    "apiCallsChange": 12.3,
    "complianceChange": 2.1,
    "resourcesChange": -1.5
  },
  "data": [
    {
      "dimension": "lambda",
      "totalCost": 500.00,
      "totalUsage": 10000,
      "count": 15
    }
  ],
  "metadata": {
    "recordCount": 30,
    "aggregatedCount": 5,
    "generatedAt": "2026-01-19T15:30:00Z"
  }
}
```

### POST /reports
**Request Body:**
```json
{
  "name": "Monthly Cost Report",
  "dateRange": "30d",
  "dimension": "service",
  "config": {
    "filters": {},
    "metrics": ["cost", "usage"]
  }
}
```

**Response:**
```json
{
  "customer_id": "cust_123",
  "id": "rpt_20260119_153000",
  "name": "Monthly Cost Report",
  "dateRange": "30d",
  "dimension": "service",
  "config": {...},
  "createdAt": "2026-01-19T15:30:00Z",
  "updatedAt": "2026-01-19T15:30:00Z"
}
```

---

## Performance Targets

- [ ] Query execution <5s (p95) for 90-day period
- [ ] Cache hit rate >70%
- [ ] Report generation <10s for PDF export
- [ ] API latency <500ms (p95)
- [ ] Page load time <2s
- [ ] Chart render <1s

---

## Known Limitations (To Address in Week 2)

1. **Chart visualization**: Placeholders only, Recharts integration pending
2. **Export functionality**: Returns mock data, needs PDF/CSV/Excel generation
3. **Scheduled reports**: API placeholder, EventBridge integration needed
4. **Security/Compliance analytics**: Mock data, AWS service integration pending
5. **Real metrics**: Currently using mock data, needs DynamoDB query implementation

---

## Dependencies

**NPM Packages (to install):**
```bash
npm install recharts  # Data visualization
npm install date-fns  # Date manipulation
```

**Python Packages (Lambda layer):**
```
reportlab  # PDF generation
openpyxl   # Excel generation
pandas     # Data processing
```

---

## Documentation

- Component usage examples
- API reference
- Report template guide
- Performance tuning guide
- Troubleshooting common issues
- **[Lambda Layer Verification Guide](docs/ANALYTICS_LAYER_VERIFICATION.md)**

---

## Verification & Testing

### Lambda Layer Verification

The Analytics system uses a Lambda layer containing ReportLab and openpyxl for PDF and Excel report generation. Use the verification script to ensure the layer is properly attached and functional:

```bash
# Verify layer in dev environment
./scripts/verify-analytics-layer.sh dev us-east-1

# Verify layer in production
./scripts/verify-analytics-layer.sh prod us-west-2
```

The script performs comprehensive checks:
- ✅ Lambda layer exists in AWS
- ✅ Layer is attached to analytics-reporter and report-engine functions
- ✅ Layer dependencies (ReportLab, openpyxl) are available
- ✅ PDF generation functional test
- ✅ Excel generation functional test
- ✅ Terraform configuration alignment

For detailed verification instructions, see: [Analytics Layer Verification Guide](docs/ANALYTICS_LAYER_VERIFICATION.md)

### Integration Tests

Run layer-specific tests:

```bash
# Test layer dependencies
pytest tests/integration/test_analytics_layer.py -v

# Test layer performance
pytest tests/integration/test_analytics_layer.py::TestLayerPerformance -v
```

### Manual Verification in AWS Console

1. Navigate to Lambda → Layers
2. Verify `securebase-{env}-reporting` exists
3. Open `securebase-{env}-analytics-reporter` function
4. Check that the reporting layer is attached
5. Test with a PDF generation event

---

**Last Updated:** January 28, 2026 (Added Lambda Layer Verification)  
**Next Update:** January 29, 2026
