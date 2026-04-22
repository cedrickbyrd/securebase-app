# GA4 Dashboard Configuration for SecureBase
# Compliance-Specific Metrics and Funnels

## B) GA4 Dashboard Setup Guide

This document provides step-by-step instructions for creating custom dashboards, reports, and explorations in Google Analytics 4 tailored for SecureBase's compliance-as-code platform.

---

## 1. Key Events Configuration

### Custom Events to Create

Navigate to: **Admin → Events → Create event**

Create the following events if they're not auto-captured:

| Event Name | Purpose |
|-----------|---------|
| `policy_scan_initiated` | User starts a compliance scan |
| `policy_scan_completed` | Scan finishes with results |
| `report_downloaded` | User downloads compliance report |
| `remediation_started` | User begins fixing a finding |
| `remediation_completed` | Finding is successfully remediated |
| `alert_viewed` | SRE alert is opened |
| `alert_acknowledged` | Alert is acknowledged |
| `integration_connected` | New integration added |

---

## 2. Custom Dimensions (User Properties)

Navigate to: **Admin → Custom definitions → Create custom dimensions**

### User-Scoped Dimensions

| Dimension Name | Event Parameter | Scope | Description |
|---------------|----------------|-------|-------------|
| `user_role` | `user_role` | User | admin, auditor, sre, viewer |
| `account_tier` | `account_tier` | User | free, team, enterprise |
| `compliance_frameworks` | `compliance_frameworks` | User | SOC2, HIPAA, etc. |
| `organization_size` | `organization_size` | User | startup, smb, enterprise |
| `industry` | `industry` | User | fintech, healthcare, saas |

### Event-Scoped Dimensions

| Dimension Name | Event Parameter | Scope | Description |
|---------------|----------------|-------|-------------|
| `policy_type` | `policy_type` | Event | Which policy was scanned |
| `severity` | `severity` | Event | critical, high, medium, low |
| `report_type` | `report_type` | Event | Type of report generated |
| `remediation_method` | `remediation_method` | Event | automated vs manual |

---

## 3. Conversion Events (Key Actions)

Navigate to: **Admin → Events → Mark as conversion**

Mark these events as conversions:

- ✅ `policy_scan_completed`
- ✅ `report_downloaded`
- ✅ `remediation_completed`
- ✅ `integration_connected`
- ✅ `sign_up`
- ✅ `purchase`

---

## 4. Custom Funnels

### Funnel 1: Compliance Workflow

Navigate to: **Explore → Funnel exploration → Create new**

**Funnel steps:**
1. `page_view` (page_path contains '/compliance')
2. `policy_scan_initiated`
3. `policy_scan_completed`
4. `report_generated`
5. `report_downloaded`

**Breakdown by:**
- `user_role`
- `policy_type`
- `account_tier`

**Expected Insights:**
- Where users drop off in the compliance workflow
- Which roles complete the full workflow
- Which compliance frameworks drive highest engagement

---

### Funnel 2: Remediation Workflow

**Funnel steps:**
1. `policy_scan_completed` (with findings)
2. `remediation_started`
3. `remediation_completed`

**Breakdown by:**
- `severity`
- `remediation_method`
- `user_role`

**Expected Insights:**
- Remediation completion rates by severity
- Time-to-remediation for critical findings
- Automated vs manual remediation adoption

---

### Funnel 3: SRE Alert Response

**Funnel steps:**
1. `alert_viewed`
2. `alert_acknowledged`
3. `remediation_started`

**Breakdown by:**
- `alert_type`
- `severity`

**Expected Insights:**
- Alert acknowledgment rates
- Which alert types drive action

---

## 5. Custom Reports

### Report 1: Compliance Dashboard Performance

Navigate to: **Explore → Free form → Create new**

**Dimensions:**
- Page path and screen class
- User role
- Policy type

**Metrics:**
- Views per active user
- Average engagement time
- Event count (`policy_scan_initiated`, `report_downloaded`)

**Filters:**
- Page path contains 'compliance' OR 'sre' OR 'dashboard'

**Expected Insights:**
- Which dashboards drive deepest engagement (answering the 15.67 views/user question)
- Role-based usage patterns

---

### Report 2: Feature Adoption by Role

**Dimensions:**
- User role
- Event name

**Metrics:**
- Event count
- Users
- Events per user

**Filters:**
- Event name: `policy_scan_initiated`, `report_downloaded`, `integration_connected`, `remediation_completed`

**Breakdown:**
Create a table showing:
```
| User Role | Scans Initiated | Reports Downloaded | Remediations | Integrations |
|-----------|----------------|-------------------|--------------|--------------|
| Admin     | 234            | 145               | 67           | 12           |
| Auditor   | 156            | 189               | 23           | 2            |
| SRE       | 89             | 45                | 156          | 8            |
| Viewer    | 45             | 12                | 0            | 0            |
```

**Expected Insights:**
- Which roles use which features
- Feature adoption rates
- Training/onboarding gaps

---

### Report 3: Policy Scanner Effectiveness

**Dimensions:**
- Policy type
- Scan scope

**Metrics:**
- Total scans (`policy_scan_initiated`)
- Completed scans (`policy_scan_completed`)
- Completion rate (calculated field)
- Average findings count (custom metric)

**Expected Insights:**
- Which policies are scanned most
- Scan completion rates
- Finding patterns by policy type

---

## 6. Path Exploration: User Journeys

Navigate to: **Explore → Path exploration → Create new**

### Configuration:

**Starting point:**
- Event: `page_view`
- Page path: contains '/login' or '/'

**Ending point:**
- Event: `report_downloaded` OR `remediation_completed`

**Steps to show:** 5-7

**Breakdown by:**
- User role
- Account tier

**Expected Insights:**
- Common paths to conversion
- Where users get stuck
- Difference between demo users and paid users

---

## 7. Cohort Analysis: Engagement Over Time

Navigate to: **Explore → Cohort exploration → Create new**

**Cohort inclusion criteria:**
- First visit date (by week)

**Return criteria:**
- `policy_scan_initiated` (Weekly)

**Breakdown by:**
- Account tier

**Expected Insights:**
- Retention rates by tier
- Weekly active usage patterns
- When users drop off after signup

---

## 8. Segment Configuration

Navigate to: **Admin → Audiences → Create audience**

### Audience 1: Power Users

**Conditions:**
- `policy_scan_initiated` count >= 5 in last 30 days
- `report_downloaded` count >= 2 in last 30 days

**Use case:** Target for upsell, beta features

---

### Audience 2: At-Risk Users

**Conditions:**
- First visit date: 7-30 days ago
- `policy_scan_initiated` count = 0 in last 14 days

**Use case:** Re-engagement campaigns

---

### Audience 3: Remediation Champions

**Conditions:**
- `remediation_completed` count >= 3 in last 30 days
- `remediation_method` contains 'automated'

**Use case:** Case study candidates, testimonials

---

## 9. Custom Metrics

Navigate to: **Admin → Custom definitions → Create custom metric**

### Metric 1: Scan Completion Rate

**Calculation:**
```
policy_scan_completed / policy_scan_initiated * 100
```

**Event scope:** Event
**Unit:** Percent

---

### Metric 2: Time to Remediation

**Calculation:**
```
Average duration between remediation_started and remediation_completed
```

**Event scope:** Event
**Unit:** Minutes

---

### Metric 3: Compliance Score Change

**Calculation:**
```
Average compliance_score (from policy_scan_completed)
```

**Event scope:** Event
**Unit:** Standard (0-100)

---

## 10. Alerts & Insights

Navigate to: **Admin → Custom Insights**

### Alert 1: Scan Failure Rate Spike

**Condition:**
- `policy_scan_failed` count increases by >50% week-over-week

**Action:** Email notification to engineering team

---

### Alert 2: Drop in Report Downloads

**Condition:**
- `report_downloaded` count decreases by >30% day-over-day

**Action:** Check for UI bugs, email product team

---

### Alert 3: Critical Finding Response Time

**Condition:**
- Average time between `alert_viewed` (severity=critical) and `alert_acknowledged` exceeds 15 minutes

**Action:** Notify SRE team lead

---

## 11. Data Studio Dashboard (Legacy) / Looker Studio

### Dashboard Layout:

**Page 1: Executive Overview**
- Total users (by tier)
- Scans completed (trend)
- Reports generated (trend)
- Top 5 compliance frameworks

**Page 2: Feature Engagement**
- Funnel: Login → Scan → Report → Remediation
- Heatmap: Features by user role
- Time series: Daily active features

**Page 3: SRE Dashboard Analytics**
- Alert volume by severity
- Mean time to acknowledge (MTTA)
- Mean time to remediate (MTTR)
- Infrastructure filter usage

**Page 4: Conversion & Revenue**
- Free → Team → Enterprise funnel
- Feature usage by tier
- Time to upgrade (days)

---

## 12. Real-Time Monitoring

Navigate to: **Reports → Realtime**

### Configure real-time monitoring for:

1. **Live scans** - `policy_scan_initiated` count
2. **Active users by dashboard** - Page path filter
3. **Critical alerts** - `alert_viewed` where severity=critical

**Use case:** Monitor product launches, demo days, incident response

---

## 13. Bot Traffic Filter

Navigate to: **Admin → Data Settings → Data Filters**

### Create filter: "Known Bots"

**Filter type:** Internal Traffic
**Traffic type:** Bot traffic

**Conditions:**
- User-Agent contains: `bot|crawler|spider|scraper|headless`
- Screen resolution = 0x0
- Engaged sessions = 0

**Expected impact:** Reduce your 99.97% direct traffic noise

---

## 14. Enhanced Measurement Settings

Navigate to: **Admin → Data Streams → [Your Stream] → Enhanced measurement**

### Enable/Configure:

- ✅ **Page views** - Auto-tracking
- ✅ **Scrolls** - Track 90% scroll depth (to see if users read findings)
- ✅ **Outbound clicks** - Track external docs/integration links
- ✅ **Site search** - Query parameter: `q` or `search`
- ✅ **Video engagement** - If you have demo videos
- ✅ **File downloads** - Track .pdf, .csv, .json downloads
- ✅ **Form interactions** - Track remediation forms

---

## 15. Integration with BigQuery (Optional)

For advanced analysis:

Navigate to: **Admin → Product Links → BigQuery Links → Link**

### Benefits:
- SQL queries on raw event data
- Custom attribution modeling
- Join with CRM data (revenue per user)
- Long-term historical analysis

### Example Query: "Which features predict upgrade?"

```sql
SELECT 
  user_role,
  account_tier,
  COUNT(DISTINCT CASE WHEN event_name = 'policy_scan_initiated' THEN user_pseudo_id END) as scanners,
  COUNT(DISTINCT CASE WHEN event_name = 'integration_connected' THEN user_pseudo_id END) as integrators,
  COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN user_pseudo_id END) as upgrades
FROM `your-project.analytics_XXXXX.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260301' AND '20260407'
GROUP BY user_role, account_tier
ORDER BY upgrades DESC
```

---

## Implementation Checklist

### Week 1: Core Setup
- [ ] Create all custom events
- [ ] Configure user properties
- [ ] Mark conversion events
- [ ] Enable enhanced measurement
- [ ] Set up bot filtering

### Week 2: Funnels & Reports
- [ ] Create 3 core funnels (Compliance, Remediation, SRE)
- [ ] Build custom reports (Performance, Adoption, Effectiveness)
- [ ] Configure path exploration
- [ ] Set up cohort analysis

### Week 3: Alerts & Optimization
- [ ] Create custom metrics
- [ ] Set up automated alerts
- [ ] Build Data Studio dashboard
- [ ] Configure audiences for remarketing

---

## Expected Results

After implementing these dashboards and reports:

1. **Understand the 15.67 views/user on SRE Dashboard**
   - Path exploration will show which features drive repeat visits
   - Section engagement will reveal time spent on each metric

2. **Fix the 0.27% conversion from portal to login**
   - Funnel will show if it's a traffic quality or UX issue
   - Bot filtering will reveal true conversion rate (likely 2-3%)

3. **Identify power user patterns**
   - Cohort analysis shows which features drive retention
   - Feature adoption report shows what champions use

4. **Prove product-market fit**
   - Remediation completion rates
   - Time savings from automated remediation
   - Compliance score improvements

---

## Next Steps

Once this is implemented, you'll be able to answer:

- "Which compliance frameworks should we prioritize?"
- "Do auditors or admins drive more value?"
- "What's the ROI of automated remediation?"
- "Which features correlate with upgrades?"

Want me to create:
- SQL queries for BigQuery export?
- Automated email reports?
- Slack integration for critical alerts?
