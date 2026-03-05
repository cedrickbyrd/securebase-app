# 14-Day Admin Dashboard Sprint

**Project:** SecureBase  
**Sprint Name:** Admin Dashboard — UI-Heavy Implementation Sprint  
**Approach Shift:** Infrastructure-heavy → UI-heavy (Admin Dashboard first)  
**Ecosystem:** AWS-native (CloudWatch, Cost Explorer, Security Hub, Lambda, DynamoDB)  
**Duration:** 14 days (2 weeks)  
**Status:** 🟡 In Planning  
**Last Updated:** March 2026

---

## 🎯 Sprint Goal

Deliver a fully functional, AWS-integrated Admin Dashboard in 14 days by front-loading UI component work and progressively wiring in AWS data sources, access control, and hardening. This sprint departs from the previous infrastructure-first pattern—the UI is built concurrently with backend integrations, reducing hand-off friction and enabling continuous demo feedback.

---

## 📅 Day-by-Day Backlog

> **Status Key:**  
> ⬜ Not Started &nbsp;|&nbsp; 🔄 In Progress &nbsp;|&nbsp; ✅ Done

### Week 1 — Foundation & Data Visualization

| Day | Task | Primary File(s) | Status |
|-----|------|-----------------|--------|
| **1** | Scaffold `AdminDashboard.jsx`; add `/admin` route with role guard in `App.jsx`; stub all section components | `phase3a-portal/src/components/AdminDashboard.jsx`<br>`phase3a-portal/src/App.jsx` | ⬜ |
| **2** | Build **Customer Overview** section — 5 KPI metric cards (Total, Active, Churned, MRR, Growth %) | `phase3a-portal/src/components/AdminDashboard.jsx` | ⬜ |
| **3** | Build **API Performance** section — latency cards (p50 / p95 / p99), error rate, throughput; add threshold colour coding | `phase3a-portal/src/components/AdminDashboard.jsx` | ⬜ |
| **4** | Build **Infrastructure Health** section — Lambda cold starts, DynamoDB throttling, Aurora connection pool, CloudFront cache-hit; wire status badges | `phase3a-portal/src/components/AdminDashboard.jsx`<br>`phase3a-portal/src/components/SystemHealth.jsx` | ⬜ |
| **5** | Build **Security & Compliance** section — Security Hub findings by severity, CIS benchmark score, open violations count, last audit date | `phase3a-portal/src/components/AdminDashboard.jsx` | ⬜ |
| **6** | Build **Cost Analytics** section — current-month spend, projected month-end, top-5 cost-driver bar chart (AWS Cost Explorer data shape) | `phase3a-portal/src/components/AdminDashboard.jsx` | ⬜ |
| **7** | Complete `SystemHealth.jsx` — service status grid (8 AWS services), regional health cards (us-east-1 / us-west-2), uptime %, active incidents timeline | `phase3a-portal/src/components/SystemHealth.jsx` | ⬜ |

### Week 2 — AWS Integration & Hardening

| Day | Task | Primary File(s) | Status |
|-----|------|-----------------|--------|
| **8** | Implement `metrics_aggregation.py` Lambda — CloudWatch, Cost Explorer, Security Hub, DynamoDB integrations; graceful mock-data fallback | `phase2-backend/functions/metrics_aggregation.py` | ⬜ |
| **9** | Implement `adminService.js` API layer — define all 7 admin endpoints; wire real API calls with mock fallback; add error boundary in `AdminDashboard.jsx` | `phase3a-portal/src/services/adminService.js`<br>`phase3a-portal/src/components/AdminDashboard.jsx` | ⬜ |
| **10** | Provision AWS observability infrastructure (Terraform) — CloudWatch custom metrics namespace, SNS alert topics, EventBridge rules for event capture | `landing-zone/modules/phase2-database/main.tf`<br>`landing-zone/environments/dev/main.tf` | ⬜ |
| **11** | Add dashboard controls — auto-refresh (30 s), manual refresh button, time-range selector (1 h / 24 h / 7 d / 30 d), loading skeletons, error states | `phase3a-portal/src/components/AdminDashboard.jsx` | ⬜ |
| **12** | Implement role-based access control — `isAdmin` / `isExecutive` guard in `App.jsx`; verify `ProtectedRoute` wraps `/admin`; add `userRole` handling in `Login.jsx` | `phase3a-portal/src/App.jsx`<br>`phase3a-portal/src/components/Login.jsx` | ⬜ |
| **13** | Write unit tests — `AdminDashboard.test.jsx` (≥ 15 cases) and `SystemHealth.test.jsx` (≥ 15 cases); achieve > 90 % component coverage | `phase3a-portal/src/components/__tests__/AdminDashboard.test.jsx`<br>`phase3a-portal/src/components/__tests__/SystemHealth.test.jsx` | ⬜ |
| **14** | Documentation, compliance review, final QA — update `docs/ADMIN_DASHBOARD_GUIDE.md`; run `npm run lint`; validate HIPAA/SOC2 data-masking on admin views | `docs/ADMIN_DASHBOARD_GUIDE.md`<br>`phase3a-portal/src/components/AdminDashboard.jsx` | ⬜ |

---

## 📘 Week 1 — Foundation & Data Visualization

### Focus
Build the entire visual layer of the Admin Dashboard before touching production AWS data sources. All sections receive realistic mock data so stakeholders can review and iterate on UX daily.

### Goal
By end of Day 7, the Admin Dashboard renders all six data sections (Customer Overview, API Performance, Infrastructure Health, Security & Compliance, Cost Analytics, System Health) with mock data, correct colour thresholds, and responsive layout — deployable to a staging URL for review.

### Key Conventions
- Use existing Tailwind utility classes consistent with `phase3a-portal/src/components/Dashboard.jsx`
- Metric cards follow the `bg-white rounded-lg shadow p-4` pattern already established in the portal
- Colour coding: green (`text-green-600`) for healthy, yellow (`text-yellow-600`) for warning, red (`text-red-600`) for critical
- Data shapes must match the `adminService.js` API contract from the start so backend wiring on Day 8–9 is a drop-in

### Sprint Risks (Week 1)
| Risk | Mitigation |
|------|-----------|
| Mock data shapes diverge from real API | Define `adminService.js` stub on Day 1 alongside scaffold |
| Scope creep on individual chart components | Timebox each section to one day; defer animations/polish to Day 14 |
| Recharts / charting library conflicts | Use the charting approach already in `PHASE4_ANALYTICS_GUIDE.md` (no new dependencies) |

---

## 📗 Week 2 — AWS Integration & Hardening

### Focus
Wire real AWS data into the frontend built in Week 1, provision supporting infrastructure, enforce role-based access, and harden the implementation with tests, linting, and compliance checks — all within the AWS ecosystem (no third-party monitoring services).

### Goal
By end of Day 14, the Admin Dashboard:
- Pulls live data from CloudWatch, Cost Explorer, and Security Hub via `metrics_aggregation.py`
- Falls back to mock data on API errors (zero white screens)
- Is only accessible to users with `userRole = 'admin'` or `'executive'`
- Has > 90 % test coverage on both primary components
- Passes ESLint with zero errors
- Has all customer-identifying fields masked for HIPAA / SOC 2 compliance

### AWS Services Touched (Week 2)
| Service | Usage |
|---------|-------|
| **AWS CloudWatch** | Custom metrics namespace `SecureBase/AdminDashboard`; alarms for p99 latency, error rate, cold starts |
| **AWS Cost Explorer** | Month-to-date and projected spend; top-5 service cost breakdown |
| **AWS Security Hub** | Findings aggregation by severity (CRITICAL / HIGH / MEDIUM / LOW); CIS benchmark compliance score |
| **AWS DynamoDB** | `customers` table (overview KPIs); `deployments` table (recent deployment timeline) |
| **AWS Lambda** | `metrics_aggregation` function — invoked by API Gateway `/admin/*` routes |
| **AWS SNS** | Alert topics for critical dashboard thresholds (e.g., error rate > 5 %) |
| **AWS EventBridge** | Rules to capture deployment events and route to DynamoDB `deployments` table |
| **AWS API Gateway** | `/admin` route group with IAM / API-key authorisation |

### Sprint Risks (Week 2)
| Risk | Mitigation |
|------|-----------|
| CloudWatch metrics lag (1–5 min delay) | Display "last updated" timestamp; note eventual consistency in UI tooltip |
| Cost Explorer data available only from prior day | Show "through yesterday" label on cost cards |
| Security Hub not enabled in dev account | Gate Security Hub calls with `try/except`; fall back to mock findings |
| Terraform changes break existing dev environment | Apply only additive Terraform changes; use `terraform plan` before `apply` |

---

## 📊 Change Impact Summary

### Files Touched

| File | Type | Change |
|------|------|--------|
| `phase3a-portal/src/components/AdminDashboard.jsx` | React Component | **New / Major** — primary dashboard (≈ 600 lines) |
| `phase3a-portal/src/components/SystemHealth.jsx` | React Component | **New / Major** — service status grid (≈ 256 lines) |
| `phase3a-portal/src/services/adminService.js` | Service Layer | **New** — 7 admin API endpoints + mock fallback (≈ 395 lines) |
| `phase3a-portal/src/App.jsx` | App Entry | **Modified** — add `/admin` route, role guard, nav item |
| `phase3a-portal/src/components/Login.jsx` | Auth Component | **Modified** — persist `userRole` to localStorage on login |
| `phase2-backend/functions/metrics_aggregation.py` | Lambda Function | **New** — CloudWatch / Cost Explorer / Security Hub aggregator (≈ 539 lines) |
| `landing-zone/modules/phase2-database/main.tf` | Terraform Module | **Modified** — CloudWatch namespace, SNS topics, EventBridge rules |
| `landing-zone/environments/dev/main.tf` | Terraform Entry | **Modified** — pass new CloudWatch/SNS vars to module |
| `phase3a-portal/src/components/__tests__/AdminDashboard.test.jsx` | Test | **New** — ≥ 15 test cases |
| `phase3a-portal/src/components/__tests__/SystemHealth.test.jsx` | Test | **New** — ≥ 15 test cases |
| `docs/ADMIN_DASHBOARD_GUIDE.md` | Documentation | **Updated** — add controls, API reference, troubleshooting |

### Admin View Progress

| Feature | Sprint Day | Status |
|---------|-----------|--------|
| Route `/admin` with role guard | Day 1 | ⬜ |
| Customer Overview KPI cards | Day 2 | ⬜ |
| API Performance metrics | Day 3 | ⬜ |
| Infrastructure Health status | Days 4 & 7 | ⬜ |
| Security & Compliance alerts | Day 5 | ⬜ |
| Cost Analytics (Cost Explorer) | Day 6 | ⬜ |
| Live CloudWatch data | Day 8 | ⬜ |
| API layer with error boundary | Day 9 | ⬜ |
| Auto-refresh & time-range controls | Day 11 | ⬜ |
| RBAC enforcement | Day 12 | ⬜ |
| Full test coverage (> 90 %) | Day 13 | ⬜ |
| Documentation & compliance sign-off | Day 14 | ⬜ |

### Compliance Notes

> These notes apply to all Admin Dashboard data surfaces. Review before each deployment to staging or production.

- **HIPAA (Healthcare customers):** Customer names, account IDs, and emails must be masked to initials + last-4 on all admin view cards and tables. The `AdminDashboard.jsx` component must call the existing `maskPII()` utility for any field sourced from the `customers` DynamoDB table.
- **SOC 2 Type II (All customers):** All admin API calls must be logged to CloudTrail. Ensure the Lambda execution role includes `cloudtrail:LookupEvents` read-only and that the admin API Gateway stage has access logging enabled to a dedicated CloudWatch log group (`/aws/apigateway/securebase-admin`).
- **CIS Benchmark (Infrastructure):** Security Hub findings displayed in the Security & Compliance section must include the CIS control ID (e.g., `CIS 1.7 — Disable root user`). Source from Security Hub `ProductFields.ControlId`.
- **Data retention:** CloudWatch custom metrics for the admin dashboard use a 90-day retention policy in dev and 365 days in production (consistent with existing log groups in `landing-zone/modules/`).
- **Access control audit:** On Day 12, verify that no non-admin user session can hit `/admin/*` API Gateway endpoints. The Lambda authoriser must return `403` for `userRole != 'admin' && userRole != 'executive'`.

---

## 🤖 Copilot Prompting Synergy

Use the following prompts on the specified sprint days to maximise Copilot assistance. Each prompt is scoped to the day's task and provides enough context for high-quality code generation.

### Day 1 — Scaffold & Routing
```
In phase3a-portal/src/App.jsx, add a protected route at "/admin" that renders
AdminDashboard. Only show the nav item and allow access if
localStorage.getItem("userRole") is "admin" or "executive". Follow the existing
ProtectedRoute pattern used for /invoices.
```

### Day 2 — Customer Overview Cards
```
In AdminDashboard.jsx, add a "Customer Overview" section with 5 metric cards:
Total Customers, Active Customers, Churned (last 30d), Monthly Recurring Revenue
(MRR in $), and MoM Growth %. Use Tailwind classes consistent with the existing
Dashboard.jsx card pattern. Source data from adminService.getCustomerMetrics().
Colour the Growth % card green if positive, red if negative.
```

### Day 3 — API Performance
```
In AdminDashboard.jsx add an "API Performance" section. Display p50, p95, and p99
latency (ms), error rate (%), and requests per second as metric cards. Flag p99 >
500ms as yellow and > 1000ms as red using Tailwind text-colour utilities.
Source from adminService.getApiPerformance(timeRange).
```

### Day 5 — Security & Compliance
```
In AdminDashboard.jsx add a "Security & Compliance" section. Show counts for
CRITICAL, HIGH, MEDIUM, and LOW Security Hub findings as cards. Add a CIS
Benchmark score card (0–100) with green ≥ 80, yellow 60–79, red < 60 colouring.
Add a "Last Audit" date card. Source from adminService.getSecurityMetrics().
Mask any customer identifiers using the existing maskPII utility.
```

### Day 8 — Lambda Aggregation Backend
```
Create phase2-backend/functions/metrics_aggregation.py. Implement a Lambda handler
that aggregates metrics from:
  1. CloudWatch (API Gateway and Lambda metrics via get_metric_statistics)
  2. AWS Cost Explorer (get_cost_and_usage, last 30d, group by SERVICE)
  3. AWS Security Hub (get_findings, filter by RecordState=ACTIVE)
  4. DynamoDB customers table (scan for active/churned counts, MRR sum)
Return all data as a single JSON payload. On any AWS API error, log the exception
and return mock data from a MOCK_DATA constant at the top of the file.
Follow the error-handling pattern used in phase2-backend/functions/auth_v2.py.
```

### Day 9 — API Service Layer
```
Create phase3a-portal/src/services/adminService.js. Define these async functions,
each calling the corresponding API Gateway endpoint with the X-API-Key header from
localStorage:
  - getCustomerMetrics(timeRange)  → GET /admin/customers?timeRange=...
  - getApiPerformance(timeRange)   → GET /admin/api-performance?timeRange=...
  - getInfrastructureHealth()      → GET /admin/infrastructure
  - getSecurityMetrics()           → GET /admin/security
  - getCostAnalytics(timeRange)    → GET /admin/costs?timeRange=...
  - getDeployments(limit)          → GET /admin/deployments?limit=...
  - getAllMetrics(timeRange)        → GET /admin/metrics?timeRange=...
If fetch throws or response is not ok, return the corresponding mock object.
Follow the pattern in phase3a-portal/src/services/apiService.js.
```

### Day 10 — Terraform Observability Infrastructure
```
In landing-zone/modules/phase2-database/main.tf, add:
  1. An aws_cloudwatch_log_group named /aws/apigateway/securebase-admin with
     90-day retention for dev and 365-day retention for prod (use var.environment).
  2. An aws_sns_topic named securebase-admin-alerts.
  3. An aws_cloudwatch_metric_alarm for API error rate > 5% that publishes to
     the SNS topic.
  4. An aws_cloudwatch_event_rule that captures AWS CodeDeploy deployment events
     and targets a Lambda function ARN (passed as var.deployments_lambda_arn).
Follow the Terraform style in the existing file (resource naming, tag blocks).
```

### Day 13 — Unit Tests
```
In phase3a-portal/src/components/__tests__/AdminDashboard.test.jsx, write at least
15 test cases using Vitest and React Testing Library. Mock adminService with vi.mock.
Cover: initial render, all six dashboard sections visible, time range selector
interaction, auto-refresh toggle, manual refresh button, loading skeleton display,
error state display when API returns null, and RBAC (admin vs customer role).
Follow the test patterns in `Dashboard.test.jsx` (phase3a-portal/src/components/__tests__/Dashboard.test.jsx).
```

### Day 14 — Compliance & Final QA
```
Review AdminDashboard.jsx for any place where customer name, email, or account ID
is displayed. Wrap each with the maskPII() utility imported from
phase3a-portal/src/utils/security.js. Then run:
  npm run lint
  npm test -- --coverage
and fix all ESLint errors. Confirm coverage for AdminDashboard.jsx and
SystemHealth.jsx is above 90% before marking Day 14 done.
```

---

## 🔗 Related Documents

| Document | Description |
|----------|-------------|
| [`PHASE5_SCOPE.md`](../PHASE5_SCOPE.md) | Full Phase 5 specification including multi-region DR scope |
| [`PHASE5.1_IMPLEMENTATION_SUMMARY.md`](../PHASE5.1_IMPLEMENTATION_SUMMARY.md) | Phase 5.1 completion report — reference for existing code line counts |
| [`docs/ADMIN_DASHBOARD_GUIDE.md`](./ADMIN_DASHBOARD_GUIDE.md) | End-user guide for the Admin Dashboard (updated on Day 14) |
| [`docs/ADMIN_DASHBOARD_VISUAL_DESIGN.md`](./ADMIN_DASHBOARD_VISUAL_DESIGN.md) | Visual design specifications and mockups |
| [`PHASE5_QUICK_REFERENCE.md`](../PHASE5_QUICK_REFERENCE.md) | Quick commands and reference for Phase 5 work |
| [`API_REFERENCE.md`](../API_REFERENCE.md) | Full backend API documentation including `/admin` endpoints |

---

**Document Version:** 1.0  
**Created:** March 2026  
**Status:** 🟡 Sprint Planning — Ready for Day 1 Kickoff
