# Tenant Dashboard User Guide

## Overview

The Tenant Dashboard is a comprehensive, customer-facing interface that provides real-time visibility into your organization's compliance posture, resource usage, and cost metrics. This guide will help you understand and effectively use all dashboard features.

## Table of Contents

1. [Accessing the Dashboard](#accessing-the-dashboard)
2. [Dashboard Overview](#dashboard-overview)
3. [Compliance Status](#compliance-status)
4. [Usage Metrics](#usage-metrics)
5. [Cost Breakdown](#cost-breakdown)
6. [Audit Trail](#audit-trail)
7. [Active Alerts](#active-alerts)
8. [Compliance Drift Detection](#compliance-drift-detection)
9. [Best Practices](#best-practices)

---

## Accessing the Dashboard

### Login Requirements
1. Navigate to your SecureBase portal at `https://portal.securebase.com`
2. Enter your registered email address
3. Enter your password
4. Complete MFA verification if enabled

### Navigation
- From the main menu, select **"Customer Dashboard"** or **"Tenant Dashboard"**
- The dashboard auto-refreshes every 60 seconds to show real-time data
- Manual refresh available via the header button

---

## Dashboard Overview

The dashboard is organized into several key sections:

### Header Controls
- **Time Range Selector**: Choose data timeframe (7 days, 30 days, 90 days)
- **Export Report**: Generate PDF or Excel export of current metrics
- **Last Updated**: Timestamp of most recent data refresh

### Visual Organization
- **Top Row**: Compliance score and violations
- **Framework Cards**: Individual compliance framework status
- **Usage Metrics**: API calls, storage, compute usage
- **Cost Section**: Current spend and forecasting
- **Audit Trail**: Recent configuration changes
- **Alerts**: Active security and compliance alerts

---

## Compliance Status

### Compliance Score Card

**Understanding Your Score:**
- **Green (≥90%)**: Excellent compliance posture
- **Yellow (80-89%)**: Warning - improvement needed
- **Red (<80%)**: Critical - immediate action required

**Key Metrics:**
- **Overall Score**: Aggregate compliance across all frameworks
- **Next Audit Date**: Scheduled external audit
- **Last Assessment**: Most recent compliance evaluation

### Violations Breakdown

**Severity Levels:**
- **Critical**: Immediate security/compliance risk (resolve within 24 hours)
- **High**: Significant risk (resolve within 7 days)
- **Medium**: Moderate risk (resolve within 30 days)
- **Low**: Minor issue (address in next maintenance window)

**Action Steps:**
1. Click on a violation severity level to see detailed list
2. Review recommended remediation steps
3. Assign to responsible team member
4. Track resolution in Audit Trail

### Framework Compliance

**Supported Frameworks:**

#### SOC 2 Type II
- **Purpose**: Service organization controls for security, availability, processing integrity, confidentiality, privacy
- **Audit Frequency**: Annual
- **Target**: ≥95% compliance

#### HIPAA
- **Purpose**: Health Insurance Portability and Accountability Act
- **Covers**: PHI protection, safeguards (administrative, physical, technical)
- **Audit Frequency**: Annual + triggered audits
- **Target**: 100% compliance for PHI-handling controls

#### PCI-DSS Level 1
- **Purpose**: Payment Card Industry Data Security Standard
- **Covers**: Cardholder data protection, secure networks
- **Audit Frequency**: Annual by QSA
- **Target**: 100% compliance (required for card processing)

#### GDPR
- **Purpose**: General Data Protection Regulation
- **Covers**: EU citizen data protection, privacy rights
- **Audit Frequency**: Continuous monitoring
- **Target**: 100% compliance (legal requirement)

**Progress Indicators:**
- Green progress bar: On track for compliance
- Numerical fraction: Controls passed / total controls
- Percentage: Overall framework compliance score

---

## Usage Metrics

### API Calls This Month

**Key Statistics:**
- **Total Calls**: Cumulative API requests for billing period
- **Success Rate**: Percentage of successful (2xx/3xx) responses
- **Daily Breakdown**: Bar chart showing daily API usage trends

**Top Endpoints:**
- Ranked list of most-called API endpoints
- Useful for optimizing usage patterns
- Identifies automation opportunities

**Optimization Tips:**
- Batch requests when possible to reduce call count
- Implement caching for frequently accessed data
- Use webhooks instead of polling where available

### Data Stored

**Storage Categories:**
- **Documents**: Evidence files, reports, attachments
- **Evidence Files**: Compliance evidence (screenshots, logs, configs)
- **Audit Logs**: System and user activity logs (immutable)

**Storage Management:**
- Archive old evidence files to reduce costs
- Set retention policies based on framework requirements:
  - SOC 2: 7 years
  - HIPAA: 6 years minimum
  - PCI: 1 year minimum
- Use lifecycle policies to auto-archive to Glacier

### Compute Hours

**Metrics Tracked:**
- **Lambda Execution Time**: Total compute hours for serverless functions
- **DB Query Time**: Cumulative database query duration
- **Avg Response Time**: Mean API endpoint response latency

**Performance Benchmarks:**
- Response time <200ms: Excellent
- Response time 200-500ms: Good
- Response time >500ms: Needs optimization

**Optimization Strategies:**
- Enable Lambda function concurrency limits
- Implement database query caching
- Use RDS Proxy for connection pooling
- Optimize N+1 queries with batch loading

---

## Cost Breakdown

### Current Month Spend

**Components:**
- **Current Month**: Actual costs accrued to date
- **Forecasted**: Projected month-end total based on current trajectory
- **Trend Line**: Visual representation of daily spend

**Cost Alerts:**
- Orange indicator: Spending >80% of budget
- Red indicator: Spending >100% of budget

### Cost by Service

**Service Categories:**
1. **API Gateway**: Request processing, data transfer
2. **Lambda**: Compute time, invocations, data transfer
3. **Database**: Aurora instances, storage, I/O operations
4. **Storage**: S3 buckets, EBS volumes, snapshots
5. **Data Transfer**: Inter-region, internet egress

**Cost Optimization:**
- Review horizontal bar chart to identify top cost drivers
- Compare month-over-month trends
- Implement cost allocation tags for chargeback

### Usage vs Plan Limits

**Tracked Limits:**
- **API Calls**: Monitor to avoid overage charges
- **Storage GB**: Track against tier allocation
- **User Seats**: Ensure you're not paying for unused licenses

**Color Coding:**
- Blue progress bar: Normal usage (<80% of limit)
- Orange progress bar: Approaching limit (≥80% of limit)

**Upgrade Recommendations:**
When you see:
- "Upgrade to higher tier for 15% savings"
  - **Why**: Volume discounts kick in at higher tiers
  - **Action**: Contact sales for tier comparison
- "Enable auto-scaling to reduce waste"
  - **Why**: Right-size compute resources
  - **Action**: Review analytics to set scaling policies

---

## Audit Trail

### Understanding Audit Events

**Event Types:**
- **Policy**: Security policy changes (password, MFA, encryption)
- **Role**: IAM role creation, modification, deletion
- **User**: User account lifecycle events
- **API Key**: API key rotation, revocation
- **Configuration**: Infrastructure config changes

**Event Fields:**
- **Timestamp**: When the change occurred (UTC)
- **Changed By**: User email or service account
- **Resource**: What was changed (type + ID)
- **Action**: Created, Updated, Deleted, Activated, Deactivated
- **Status**: Success, Failed, Rolled Back

### Filtering Audit Events

**Available Filters:**
1. **Date Range**: Last 7/30/90 days or custom range
2. **Resource Type**: Filter by Policy, Role, User, API Key, Configuration
3. **User**: Show changes by specific user
4. **Status**: Filter by success/failure

**Use Cases:**
- **Compliance Audits**: Export filtered view for auditors
- **Security Investigations**: Trace unauthorized changes
- **Change Management**: Review recent deployments
- **Troubleshooting**: Identify configuration drift root cause

---

## Active Alerts

### Alert Priority

**Severity Classification:**
- **Critical**: System compromised or compliance violation
- **High**: Significant risk or impending limit
- **Medium**: Warning condition, plan corrective action
- **Low**: Informational, no immediate action required

### Alert Actions

**Available Actions:**
1. **View Details**: Open full alert context with logs
2. **Acknowledge**: Mark as seen (reduces noise in dashboard)
3. **Assign**: Delegate to team member
4. **Resolve**: Mark as fixed and add resolution notes

### Common Alerts

#### Critical Compliance Violation Detected
**Example**: "Password policy weakened below SOC 2 requirements"
- **Impact**: Audit finding, certification risk
- **Recommended Action**: Restore password complexity to 14+ chars, special chars required
- **Timeline**: Resolve within 24 hours

#### API Usage Approaching Limit
**Example**: "API calls at 85% of monthly quota with 10 days remaining"
- **Impact**: Service degradation or overage charges
- **Recommended Action**: Optimize usage or upgrade tier
- **Timeline**: Review within 48 hours

#### Storage Capacity Warning
**Example**: "Evidence storage at 78% capacity"
- **Impact**: Upload failures, compliance gaps
- **Recommended Action**: Archive old evidence or increase storage limit
- **Timeline**: Plan expansion within 7 days

---

## Compliance Drift Detection

### What is Drift?

**Definition**: When a control transitions from compliant to non-compliant state without authorized change.

**Common Causes:**
1. Manual configuration changes bypassing approval workflow
2. Automated deployments without compliance validation
3. Software updates introducing new vulnerabilities
4. Expired certificates or credentials
5. Cloud provider service changes

### Drift Timeline

**Visualization Features:**
- **90-Day History**: Shows compliance score over time
- **Green Line**: Normal compliant state
- **Red Dots**: Detected drift events
- **Tooltips**: Hover to see event details

### Drift Event Cards

**Information Provided:**
- **Control ID & Name**: Which control drifted (e.g., "AC-2: Account Management")
- **Framework**: Associated compliance framework
- **Detection Time**: When drift was identified
- **State Transition**: Compliant → Non-Compliant
- **Root Cause**: Auto-detected or manually entered reason
- **Remediation Steps**: Ordered list of corrective actions
- **Status**: Open, In Progress, Resolved, Acknowledged

### Drift Analytics

**Key Metrics:**

#### Mean Time to Resolve (MTTR)
- **Definition**: Average hours to fix drift issues
- **Target**: <24 hours for critical, <72 hours for high
- **Improvement**: Automate remediation where possible

#### Drift Frequency
- **Shows**: Which control categories drift most often
- **Use**: Prioritize preventive controls
- **Example**: If "Access Control" drifts frequently, implement SCPs to prevent changes

#### Top Drifting Controls
- **Ranking**: Most frequently violated controls
- **Action**: Implement compensating controls or automation
- **Example**: If "MFA Required" drifts often, use SCP to enforce at organization level

---

## Best Practices

### Daily Activities
- [ ] Review active alerts (morning check-in)
- [ ] Check compliance score trend
- [ ] Monitor cost against forecast
- [ ] Acknowledge or assign new alerts

### Weekly Activities
- [ ] Review top drifting controls
- [ ] Analyze API usage patterns for optimization
- [ ] Export weekly compliance report for stakeholders
- [ ] Review audit trail for unauthorized changes

### Monthly Activities
- [ ] Full compliance framework review
- [ ] Cost optimization analysis
- [ ] Update remediation workflows based on MTTR
- [ ] Archive old evidence files
- [ ] Review and renew expiring credentials

### Quarterly Activities
- [ ] Compliance gap analysis
- [ ] Budget vs. actual cost review
- [ ] Tier evaluation (upgrade/downgrade)
- [ ] Disaster recovery testing validation
- [ ] Security awareness training for team

### Annual Activities
- [ ] External audit preparation
- [ ] Compliance certification renewals
- [ ] Multi-year cost forecasting
- [ ] Business continuity plan update

---

## Troubleshooting

### Dashboard Not Loading
1. Clear browser cache (Ctrl+Shift+Del)
2. Check internet connection
3. Try incognito/private mode
4. Verify session hasn't expired (re-login)
5. Contact support if issue persists

### Data Appears Stale
- Check "Last Updated" timestamp in header
- Click manual refresh button
- Verify no maintenance window is active
- Check status page at `status.securebase.com`

### Metrics Don't Match Expected Values
- Verify time range selector (7d vs 30d vs 90d)
- Check filter settings (framework, severity)
- Allow 5-10 minutes for data aggregation
- Export data and compare with source systems

### Export Report Failing
- Ensure popup blocker is disabled
- Try smaller date range
- Use Chrome or Firefox (latest versions)
- Check available disk space
- Contact support for manual export

---

## Glossary

- **API Gateway**: AWS service that creates, publishes, and manages APIs
- **Drift**: Unauthorized deviation from compliant configuration
- **Evidence**: Documentation proving compliance control implementation
- **GSI**: Global Secondary Index (DynamoDB query optimization)
- **Lambda**: AWS serverless compute service
- **MTTR**: Mean Time to Resolve (average time to fix issues)
- **RLS**: Row-Level Security (database multi-tenancy isolation)
- **SCP**: Service Control Policy (AWS Organizations governance)
- **TTL**: Time to Live (automatic data expiration)

---

## Support

### Getting Help
- **Email**: support@securebase.com
- **Phone**: 1-800-SECURE-BASE (1-800-732-8732)
- **Live Chat**: Available in dashboard (bottom-right corner)
- **Knowledge Base**: https://docs.securebase.com

### Support Hours
- **Standard**: Mon-Fri 9 AM - 5 PM EST
- **Priority**: 24/7 for critical issues
- **Emergency**: Page on-call engineer via support line

### Escalation Path
1. **Level 1**: General support inquiries
2. **Level 2**: Technical specialists
3. **Level 3**: Engineering team
4. **Critical**: Incident commander for outages

---

**Document Version**: 1.0  
**Last Updated**: March 28, 2026  
**Phase**: 5.2 - Tenant Dashboard
