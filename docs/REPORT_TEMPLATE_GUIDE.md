# Phase 4 Report Template Guide

**Version:** 1.0  
**Last Updated:** January 23, 2026  
**Purpose:** Guide for using and creating report templates in SecureBase Analytics

---

## Table of Contents
1. [Overview](#overview)
2. [Pre-Built Templates](#pre-built-templates)
3. [Creating Custom Templates](#creating-custom-templates)
4. [Template Configuration](#template-configuration)
5. [Best Practices](#best-practices)
6. [Examples](#examples)

---

## Overview

Report templates provide pre-configured analytics reports for common use cases. Templates include:
- Predefined field selections
- Optimal filtering criteria
- Recommended visualizations
- Export-ready formatting

**Benefits:**
- ✅ Quick setup - Deploy reports in seconds
- ✅ Best practices - Based on industry standards
- ✅ Consistency - Standardized across organization
- ✅ Customizable - Easily modify to fit needs

---

## Pre-Built Templates

### 1. Cost Analysis Report

**Purpose:** Comprehensive cost breakdown and trend analysis

**Template ID:** `cost-analysis`

**Included Metrics:**
- Total cost by service
- Cost trends over time
- Top 10 cost drivers
- Budget vs actual comparison
- Cost per region
- Reserved instance utilization

**Configuration:**
```json
{
  "templateId": "cost-analysis",
  "name": "Monthly Cost Analysis",
  "dateRange": "30d",
  "dimensions": ["service", "region", "tag"],
  "metrics": [
    "total_cost",
    "cost_change_percentage",
    "cost_by_service",
    "cost_by_region",
    "reserved_vs_on_demand"
  ],
  "visualizations": [
    {
      "type": "line",
      "title": "Cost Trend (30 days)",
      "data": "daily_cost"
    },
    {
      "type": "bar",
      "title": "Top 10 Services by Cost",
      "data": "service_cost"
    },
    {
      "type": "pie",
      "title": "Cost by Region",
      "data": "region_cost"
    }
  ],
  "filters": {},
  "groupBy": "service"
}
```

**Usage:**
```javascript
// Create from template
const report = await analyticsService.createFromTemplate('cost-analysis', {
  dateRange: '30d',
  customFilters: {
    region: 'us-east-1'
  }
});
```

**Sample Output:**
- **Total Cost:** $12,500.00
- **Cost Change:** +5.2% vs previous period
- **Top Service:** EC2 ($5,000, 40%)
- **Recommendations:** 3 cost optimization opportunities

---

### 2. Security Report

**Purpose:** Security posture and findings analysis

**Template ID:** `security`

**Included Metrics:**
- Security score (0-100)
- Critical/High/Medium/Low findings
- Open findings by service
- Compliance status
- Security trends
- Top vulnerabilities

**Configuration:**
```json
{
  "templateId": "security",
  "name": "Weekly Security Report",
  "dateRange": "7d",
  "dimensions": ["severity", "service", "resource_type"],
  "metrics": [
    "security_score",
    "total_findings",
    "findings_by_severity",
    "findings_by_service",
    "remediation_time"
  ],
  "visualizations": [
    {
      "type": "gauge",
      "title": "Security Score",
      "data": "security_score"
    },
    {
      "type": "heatmap",
      "title": "Findings by Severity",
      "data": "severity_distribution"
    },
    {
      "type": "bar",
      "title": "Top 10 Vulnerable Services",
      "data": "service_findings"
    }
  ],
  "filters": {
    "status": "open"
  },
  "groupBy": "severity"
}
```

**Usage:**
```bash
curl -X POST "https://api.securebase.io/v1/reports/templates/security" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "dateRange": "7d",
    "filters": {
      "severity": ["critical", "high"]
    }
  }'
```

**Sample Output:**
- **Security Score:** 95/100
- **Critical Findings:** 3
- **High Findings:** 8
- **Trend:** Improving (+2 pts)

---

### 3. Compliance Report

**Purpose:** Compliance status by framework

**Template ID:** `compliance`

**Supported Frameworks:**
- HIPAA
- PCI-DSS
- SOC 2
- CIS Benchmarks
- NIST 800-53
- ISO 27001

**Included Metrics:**
- Overall compliance score
- Passed/Failed controls
- Non-compliant resources
- Control status by category
- Compliance trends
- Remediation priorities

**Configuration:**
```json
{
  "templateId": "compliance",
  "name": "HIPAA Compliance Report",
  "dateRange": "30d",
  "framework": "hipaa",
  "dimensions": ["control_category", "resource_type"],
  "metrics": [
    "compliance_score",
    "total_controls",
    "passed_controls",
    "failed_controls",
    "non_compliant_resources"
  ],
  "visualizations": [
    {
      "type": "gauge",
      "title": "Compliance Score",
      "data": "compliance_score"
    },
    {
      "type": "bar",
      "title": "Control Status by Category",
      "data": "category_status"
    },
    {
      "type": "table",
      "title": "Failed Controls",
      "data": "failed_controls"
    }
  ],
  "filters": {
    "framework": "hipaa",
    "status": "all"
  },
  "groupBy": "control_category"
}
```

**Usage:**
```python
# Python SDK
report = client.reports.create_from_template(
    template_id='compliance',
    framework='hipaa',
    date_range='30d'
)
```

**Sample Output:**
- **Compliance Score:** 98/100
- **Total Controls:** 250
- **Passed:** 245
- **Failed:** 5
- **Status:** Compliant with minor issues

---

### 4. Usage Report

**Purpose:** Resource usage and API activity analysis

**Template ID:** `usage`

**Included Metrics:**
- Total API calls
- API calls by service
- Compute hours
- Storage usage
- Data transfer
- Active resources

**Configuration:**
```json
{
  "templateId": "usage",
  "name": "Monthly Usage Report",
  "dateRange": "30d",
  "dimensions": ["service", "api_endpoint", "region"],
  "metrics": [
    "total_api_calls",
    "api_calls_by_service",
    "compute_hours",
    "storage_gb",
    "data_transfer_gb",
    "active_resources"
  ],
  "visualizations": [
    {
      "type": "line",
      "title": "Daily API Calls",
      "data": "daily_api_calls"
    },
    {
      "type": "bar",
      "title": "API Calls by Service",
      "data": "service_api_calls"
    },
    {
      "type": "area",
      "title": "Storage Growth",
      "data": "storage_trend"
    }
  ],
  "filters": {},
  "groupBy": "service"
}
```

**Sample Output:**
- **Total API Calls:** 450,000
- **Compute Hours:** 21,600
- **Storage:** 15 TB
- **Growth:** +10% MoM

---

### 5. Executive Summary

**Purpose:** High-level overview for executives

**Template ID:** `executive-summary`

**Included Metrics:**
- Total spend
- Month-over-month change
- Security posture
- Compliance status
- Key alerts
- Cost optimization opportunities

**Configuration:**
```json
{
  "templateId": "executive-summary",
  "name": "Executive Summary",
  "dateRange": "30d",
  "dimensions": ["service", "region"],
  "metrics": [
    "total_cost",
    "cost_change",
    "security_score",
    "compliance_score",
    "critical_alerts",
    "savings_opportunities"
  ],
  "visualizations": [
    {
      "type": "summary_cards",
      "data": "kpi_summary"
    },
    {
      "type": "trend",
      "title": "30-Day Cost Trend",
      "data": "cost_trend"
    }
  ],
  "filters": {},
  "groupBy": "none"
}
```

**Sample Output:**
- **Monthly Cost:** $12,500 (+5.2%)
- **Security Score:** 95/100
- **Compliance:** 98% (HIPAA)
- **Critical Alerts:** 0
- **Potential Savings:** $1,200/mo

---

## Creating Custom Templates

### Step 1: Define Template Structure

```json
{
  "name": "My Custom Report",
  "description": "Custom analytics report",
  "category": "custom",
  "fields": [
    "cost",
    "usage",
    "service",
    "region",
    "timestamp"
  ],
  "filters": {
    "service": "EC2",
    "region": "us-east-1"
  },
  "groupBy": "service",
  "dateRange": "30d",
  "visualizations": [
    {
      "type": "bar",
      "title": "Cost by Service",
      "field": "cost",
      "groupBy": "service"
    }
  ]
}
```

### Step 2: Test Template

```javascript
// Test template configuration
const preview = await analyticsService.previewTemplate({
  name: "My Custom Report",
  fields: ["cost", "usage", "service"],
  filters: { region: "us-east-1" },
  groupBy: "service",
  dateRange: "7d"
});

console.log(preview.data);
```

### Step 3: Save Template

```javascript
// Save as reusable template
const savedTemplate = await analyticsService.saveTemplate({
  name: "My Custom Report",
  description: "Custom EC2 cost analysis",
  config: {
    // ... template configuration
  },
  shared: true  // Share with team
});

console.log(`Template saved: ${savedTemplate.id}`);
```

### Step 4: Use Custom Template

```javascript
// Create report from custom template
const report = await analyticsService.createFromTemplate(
  savedTemplate.id,
  {
    dateRange: '30d',
    customFilters: {}
  }
);
```

---

## Template Configuration

### Available Fields

**Financial Metrics:**
- `cost` - Total cost
- `cost_change` - Cost change percentage
- `budget` - Budget allocation
- `forecast` - Cost forecast

**Usage Metrics:**
- `usage` - Resource usage
- `api_calls` - API call count
- `compute_hours` - Compute hours
- `storage_gb` - Storage in GB

**Security Metrics:**
- `security_score` - Security score (0-100)
- `findings` - Security findings count
- `vulnerabilities` - Vulnerability count
- `compliance_score` - Compliance score

**Dimensions:**
- `service` - AWS service name
- `region` - AWS region
- `account` - Account ID
- `tag` - Resource tag
- `resource_type` - Resource type

### Visualization Types

| Type | Use Case | Data Format |
|------|----------|-------------|
| `line` | Trends over time | Time-series data |
| `bar` | Comparisons | Categorical data |
| `pie` | Distributions | Percentage data |
| `gauge` | Scores/Percentages | Single value (0-100) |
| `heatmap` | Multi-dimensional | Matrix data |
| `table` | Detailed listings | Tabular data |
| `area` | Stacked trends | Time-series with categories |

### Filter Operators

```json
{
  "filters": {
    "cost": { "gt": 100 },              // Greater than
    "usage": { "lt": 1000 },            // Less than
    "service": { "in": ["EC2", "S3"] }, // In list
    "region": { "eq": "us-east-1" },    // Equals
    "timestamp": {
      "gte": "2024-01-01",              // Greater than or equal
      "lte": "2024-01-31"               // Less than or equal
    }
  }
}
```

---

## Best Practices

### 1. Choose the Right Date Range
- **7 days:** Security reports, daily operations
- **30 days:** Cost analysis, monthly reviews
- **90 days:** Trend analysis, quarterly reports
- **12 months:** Annual reviews, budget planning

### 2. Optimize Performance
- Limit fields to only what's needed
- Use aggregations for large datasets
- Cache frequently used reports
- Schedule reports during off-peak hours

### 3. Export Guidelines
- **CSV:** Best for data analysis in Excel
- **JSON:** Best for programmatic access
- **PDF:** Best for sharing and presentations
- **Excel:** Best for formatted reports with charts

### 4. Scheduling Best Practices
- Daily reports: Security, critical alerts
- Weekly reports: Team updates, sprint reviews
- Monthly reports: Cost analysis, executive summaries
- Quarterly reports: Compliance, strategic planning

---

## Examples

### Example 1: Cost Optimization Report

```javascript
const report = await analyticsService.createFromTemplate('cost-analysis', {
  dateRange: '90d',
  filters: {
    cost: { gt: 100 }  // Only services costing > $100
  },
  groupBy: 'service',
  visualizations: ['line', 'bar', 'pie'],
  exportFormat: 'pdf'
});

// Export and download
const pdf = await analyticsService.exportReport({
  format: 'pdf',
  data: report.data,
  reportName: 'Q1 Cost Optimization',
  options: {
    includeCharts: true,
    pageSize: 'letter'
  }
});
```

### Example 2: Security Compliance Dashboard

```javascript
const securityReport = await analyticsService.createFromTemplate('security', {
  dateRange: '7d',
  filters: {
    severity: ['critical', 'high']
  }
});

const complianceReport = await analyticsService.createFromTemplate('compliance', {
  framework: 'hipaa',
  dateRange: '30d'
});

// Combine into single dashboard
const dashboard = {
  security: securityReport,
  compliance: complianceReport,
  timestamp: new Date().toISOString()
};
```

### Example 3: Scheduled Monthly Report

```javascript
// Create report
const monthlyReport = await analyticsService.createFromTemplate('executive-summary', {
  dateRange: '30d'
});

// Schedule delivery
await analyticsService.scheduleReport({
  reportId: monthlyReport.id,
  schedule: 'monthly',  // First day of each month
  recipients: [
    'ceo@example.com',
    'cfo@example.com',
    'cto@example.com'
  ],
  format: 'pdf',
  options: {
    timezone: 'America/New_York',
    time: '08:00',
    subject: 'SecureBase Monthly Summary'
  }
});
```

---

## Troubleshooting

### Template Not Found
**Error:** `Template 'xyz' not found`  
**Solution:** Verify template ID. Use `GET /reports/templates` to list available templates.

### Missing Required Fields
**Error:** `Missing required field: framework`  
**Solution:** Compliance template requires `framework` parameter. Check template documentation.

### Export Timeout
**Error:** `Export timeout exceeded`  
**Solution:** Reduce date range or limit data rows. Consider scheduled exports for large reports.

### Schedule Delivery Failed
**Error:** `Failed to deliver report`  
**Solution:** Verify email addresses and webhook URLs. Check delivery status logs.

---

## Support & Resources

**Documentation:**
- API Reference: [ANALYTICS_API_REFERENCE.md](./ANALYTICS_API_REFERENCE.md)
- SDK Examples: [examples/](./examples/)

**Support:**
- Email: support@securebase.io
- Slack: #analytics-support
- Docs: https://docs.securebase.io/analytics

**Changelog:**
- v1.0 (Jan 2026): Initial release with 5 templates

---

**Document Version:** 1.0  
**Last Updated:** January 23, 2026  
**Maintained by:** SecureBase Analytics Team
