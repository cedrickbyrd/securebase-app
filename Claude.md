xX# CLAUDE.md - SecureBase Development Guide

**Repository:** `cedrickbyrd/securebase-app`  
**Role Context:** Principal Cloud Architect | Compliance-First SaaS Platform  
**Mission:** Build SOC 2, FedRAMP, and HIPAA-ready infrastructure and features

---

## 🎯 Project Overview

SecureBase is a security-first, multi-tenant AWS PaaS platform that has evolved from an AWS landing zone orchestrator into a comprehensive suite for **compliance automation**, **AI Agent Authentication**, **Non-Human Identity Management (NHI/IAM)**, and **Sovereign Infrastructure Orchestration**. Every code change must prioritize security, auditability, and regulatory compliance.

**Current Phase Status (May 2026):**
| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | AWS Landing Zone (Terraform IaC) | ✅ Complete |
| Phase 2 | Serverless Database & API Backend | ✅ Complete |
| Phase 3a | Customer Portal (React) | ✅ Complete |
| Phase 3b | Support Tickets, Webhooks & Cost Forecasting | ✅ Complete |
| Phase 4 | Enterprise Features (RBAC, Analytics, Notifications) | ✅ Complete |
| Phase 5.1 | Executive/Admin Dashboard | ✅ Complete |
| Phase 5.2 | Tenant/Customer Dashboard & Compliance Drift | ✅ Complete |
| Phase 5.3 | Logging, Alerting & SRE Dashboard | ✅ Complete |
| Phase 5.4 | Multi-Region DR Production Wiring (49/49 resources applied) | ✅ Complete — validation gates open |
| Phase 6 | Compliance Automation & Operations Scale | 🔨 In Progress |

### ✅ Phase 5.4 — Delivered 2026-05-10

> See [`PHASE5.4_IMPLEMENTATION_COMPLETE.md`](PHASE5.4_IMPLEMENTATION_COMPLETE.md) for the full delivery report.

Phase 5.4 drove `terraform apply` on the multi-region DR infrastructure scaffolded in Phase 5.3. All 49/49 resources applied against live AWS prod. Key deliverables:

- **CloudFront multi-origin failover** — origin group for GET/HEAD/OPTIONS; direct primary for `/api/*` (AWS restriction on write methods with origin groups)
- **Aurora Global Database** — `securebase-phase2-dev` promoted to global cluster; secondary reader in us-west-2
- **DynamoDB Global Tables** — 4 prod tables replicated (`securebase-prod-metrics`, `-report-cache`, `-report-schedules`, `-reports`); streams enabled 2026-05-10
- **S3 CRR** — `securebase-audit-logs-prod` replicating to us-west-2 with KMS
- **DR Lambda functions** — `failover_orchestrator.py`, `failback_orchestrator.py`, `health_check_aggregator.py` deployed in us-west-2
- **Secondary `/health` endpoint** — Node.js 20.x Lambda + API GWv2 in us-west-2
- **Daily DR validation workflow** — `.github/workflows/validate-dr.yml` (OIDC auth, 7-check `dr-validation.sh`)
- **SRE Dashboard** — CloudWatch query library, DLQ depth monitoring, on-call runbooks (PR #645)

**Validation gates still open** (run `validate-dr.yml` to close):
- CloudFront distribution live health check
- Aurora Global DB secondary cluster healthy
- DynamoDB replication lag < 1 min
- First automated DR drill (RTO < 15 min)

**Phase 5.4 CloudFront wiring note:**  
Primary origin must be `d-ky35u7ca93.execute-api.us-east-1.amazonaws.com` (the API GW custom domain regional endpoint). Using the raw execute-api URL (`9xyetu7zq3...`) returns 403 ForbiddenException when the `Host` header is `api.securebase.tximhotep.com`. Route 53 is intentionally disabled — DNS lives in Netlify; CloudFront origin group provides failover.

### 🔨 Phase 6 — Active Sprint

> See [`PHASE6_SCOPE.md`](PHASE6_SCOPE.md) for the full scope definition.

Phase 6 makes compliance a product feature. Active components:

- **6.1 Immutable Audit Logging** — S3 Object Lock (COMPLIANCE mode, 7-year), Macie, `audit_log_packager.py`, `/admin/evidence` API
- **6.2 Compliance Automation** — 50+ AWS Config rules, SOC 2/HIPAA/FedRAMP conformance packs, `compliance_score_recalculator.py`, daily DynamoDB snapshots
- **6.3 Scalability** — Lambda provisioned concurrency, API GW caching, Aurora ACU 2–128, DynamoDB GSI optimization
- **6.4 Build Debt** — remove `--legacy-peer-deps`, migrate mock data to `tests/fixtures/`, consolidate root markdown to `docs/`
- **6.5 Developer Experience** — `docker-compose.yml`, Storybook, OpenAPI spec, Playwright E2E

Scaffolded infrastructure:
- `landing-zone/modules/phase6-audit-logging/`
- `landing-zone/modules/phase6-compliance/`
- `phase6-backend/functions/audit_log_packager.py`
- `phase6-backend/functions/audit_evidence_api.py`
- `phase6-backend/compliance/soc2_mapping.json`, `hipaa_mapping.json`, `fedramp_mapping.json`

**Core Principles:**
- Security by default, not by addition
- Least privilege access at every layer
- Audit trails for all data operations
- Infrastructure as Code for reproducibility

---

## 🛠 Build & Environment Constraints

### Package Management
```bash
# REQUIRED: Always use --legacy-peer-deps for chart dependencies
npm install react-chartjs-2 chart.js --save --legacy-peer-deps

# For fresh installations
npm install --legacy-peer-deps
```

### Lock File Policy

The `package-lock.json` out-of-sync with `package.json` is the **#1 cause of CI/CD failures** in this repo. All deploy workflows use `npm ci`, which requires the lock file to be in exact sync.

**Rules:**
- Always run `npm install` (not `npm ci`) locally when adding or updating packages
- Always commit the updated `package-lock.json` after any `npm install`
- Use `npm ci` in CI only — never locally for dependency changes
- This repo has **two separate npm packages** — run `npm install` separately in each:
  - Root `/` — marketing site (React 19, Vite 6)
  - `phase3a-portal/` — customer portal (React 18, Vite 5)
- `@supabase/supabase-js` is a dependency of the **root** package only — do NOT add it to `phase3a-portal/` (it was intentionally removed in PR #508)

**When lock file is out of sync (CI fails with `npm error code EUSAGE`):**
```bash
# Root package
npm install
git add package-lock.json
git commit -m "chore: sync package-lock.json with package.json"

# Portal package
cd phase3a-portal
npm install
git add package-lock.json
git commit -m "chore: sync phase3a-portal/package-lock.json"
```

### Technology Stack
- **Frontend:** React 18+ with TypeScript. The portal (`phase3a-portal/`) currently uses `.jsx`. New components should use `.tsx` where possible. The marketing site (`src/`) uses `.tsx`.
- **Build Tool:** Vite (fast dev server, HMR)
- **Styling:** Tailwind CSS (utility-first)
- **Charts:** `react-chartjs-2` + `chart.js`
- **PDF Generation:** `jspdf` + `html2canvas`
- **Analytics:** Google Analytics 4 (GA4) with privacy controls
- **Backend/Auth:** Supabase (PostgreSQL + Auth) — **note: Supabase auth is no longer used in the marketing site (`src/`) signup flow** (see PR #508); the marketing site now calls the Lambda `/signup` backend directly via `VITE_API_BASE_URL`
- **Runtime:** Node.js LTS (currently v20.x)

### Auth Architecture

| Context | Auth Method | Notes |
|---|---|---|
| Marketing site `/signup` | AWS Lambda (`/api/signup`) | Supabase auth removed in PR #508 |
| Marketing site (other) | None / JWT from Lambda | `VITE_API_BASE_URL` used |
| Portal (`phase3a-portal`) | Supabase Auth | Still active |

- Do **NOT** use `supabase.auth` in the marketing site (`src/`) signup flow
- Do **NOT** add `@supabase/supabase-js` to `phase3a-portal/` — it was intentionally removed in PR #508
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are no longer used by the marketing site signup

### Environment Variables
Store in `.env.local` (never commit):
```env
VITE_SUPABASE_URL=your-project-url     # No longer used by marketing site /signup (see PR #508)
VITE_SUPABASE_ANON_KEY=your-anon-key  # No longer used by marketing site /signup (see PR #508)
VITE_API_BASE_URL=https://api.securebase.tximhotep.com  # Used by marketing site /signup (Lambda backend)
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_DEMO_MODE=false
VITE_DEMO_USER_EMAIL=demo@securebase.tximhotep.com
VITE_USE_MOCK_API=false
```

**Demo build** uses `.env.demo` (copied via `npm run build:demo`):
```env
VITE_DEMO_MODE=true
VITE_DEMO_USER_EMAIL=demo@securebase.tximhotep.com
```

---

## 🛡 Compliance & Security Standards

### SOC 2 Type II Requirements
- **Access Controls:** Implement RBAC (Role-Based Access Control)
- **Audit Logging:** Log all authentication events, data access, and configuration changes
- **Encryption:** AES-256 at rest, TLS 1.3 in transit
- **Data Retention:** Configurable retention policies with automated purging

### FedRAMP Moderate Baseline
- **Multi-Factor Authentication:** Required for all admin accounts
- **Session Management:** 15-minute idle timeout, absolute 8-hour limit
- **Incident Response:** Automated alerting for security events
- **Continuous Monitoring:** Real-time compliance drift detection

### HIPAA Technical Safeguards
- **PHI Handling:** Never log Protected Health Information
- **De-identification:** Hash/mask PHI in development environments
- **Access Audit:** Log every access to PHI with user ID, timestamp, purpose
- **Breach Notification:** Automated detection of unauthorized access

### Security Checklist for All Code Changes

**Before committing, verify:**

- [ ] No hardcoded credentials, API keys, or secrets
- [ ] PII/PHI never logged to console or error messages
- [ ] GA4 tracking excludes all PII/PHI (no emails, names, org IDs in events)
- [ ] Supabase RLS (Row-Level Security) policies enforced
- [ ] Input validation on all user-provided data
- [ ] CSRF protection on state-changing operations
- [ ] Content Security Policy headers configured
- [ ] Dependencies scanned for vulnerabilities (`npm audit`)

---

## 📝 Code Style & Patterns

### React Component Architecture

**Preferred Pattern:**
```typescript
// Functional components with TypeScript
interface ComplianceCheckProps {
  controlId: string;
  status: 'passing' | 'failing' | 'pending';
}

export const ComplianceCheck: React.FC<ComplianceCheckProps> = ({ 
  controlId, 
  status 
}) => {
  // Component logic
  return (
    <div className="p-4 border rounded-lg">
      {/* Tailwind utility classes */}
    </div>
  );
};
```

**Avoid:**
- Class components (unless required for error boundaries)
- Inline styles (use Tailwind utilities)
- Any/unknown types (be explicit with TypeScript)

### Styling Guidelines

```tsx
// ✅ GOOD: Tailwind utilities
<button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
  Generate Report
</button>

// ❌ AVOID: Inline styles
<button style={{ padding: '8px 16px', backgroundColor: '#2563eb' }}>
  Generate Report
</button>
```

### Data Visualization (react-chartjs-2)

```typescript
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register required components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Use in component
<Line 
  data={complianceData} 
  options={{ 
    responsive: true,
    plugins: {
      title: { display: true, text: 'Compliance Score Trend' }
    }
  }} 
/>
```

### PDF Report Generation

```typescript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const generateComplianceReport = async (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL('image/png');
  
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`compliance-report-${Date.now()}.pdf`);
};
```

### Google Analytics 4 (GA4) - Privacy-First Implementation

**CRITICAL: HIPAA Compliance Requirements**

When implementing GA4 for SecureBase, you **MUST** adhere to strict privacy controls to maintain HIPAA compliance:

#### Installation

```bash
npm install react-ga4 --save
```

#### Configuration (src/utils/analytics.ts)

```typescript
import ReactGA from 'react-ga4';

interface AnalyticsConfig {
  measurementId: string;
  isProduction: boolean;
}

// HIPAA-compliant GA4 configuration
export const initializeAnalytics = ({ measurementId, isProduction }: AnalyticsConfig) => {
  if (!isProduction) {
    console.log('Analytics disabled in development');
    return;
  }

  ReactGA.initialize(measurementId, {
    gaOptions: {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_flags: 'SameSite=Strict;Secure',
      cookie_domain: 'auto',
      cookie_expires: 60 * 60 * 24 * 90,
    },
    gtagOptions: {
      send_page_view: false,
    },
  });
};

export const trackPageView = (path: string, title?: string) => {
  const sanitizedPath = sanitizePath(path);
  ReactGA.send({ hitType: 'pageview', page: sanitizedPath, title: title || document.title });
};

export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
  dimensions?: Record<string, string>
) => {
  ReactGA.event({ category, action, label, value, ...dimensions });
};

const sanitizePath = (path: string): string => {
  return path
    .replace(/\/org\/[^/]+/g, '/org/:id')
    .replace(/\/user\/[^/]+/g, '/user/:id')
    .replace(/\/client\/[^/]+/g, '/client/:id')
    .replace(/\/assessment\/[^/]+/g, '/assessment/:id')
    .replace(/\/report\/[^/]+/g, '/report/:id')
    .replace(/[?&]email=[^&]*/g, '')
    .replace(/[?&]name=[^&]*/g, '');
};
```

#### ⚠️ NEVER Track

- User emails or names
- Organization names (use hashed IDs)
- Audit findings or vulnerabilities
- Compliance scores or grades
- Customer lists or vendor names
- Any data field marked as PII/PHI in your data model
- URL parameters containing sensitive identifiers

---

## 🚀 Git Workflow

> **Documentation Policy:** New documentation files must go in the `docs/` directory. Do NOT create new `*.md` files in the repository root — the root already has 200+ markdown files and new ones will be ignored or cause confusion.

### Branch Naming Convention
```
feat/add-hipaa-controls
fix/authentication-timeout
docs/update-compliance-matrix
chore/upgrade-dependencies
security/patch-xss-vulnerability
```

### Commit Messages (Conventional Commits)
```bash
git commit -m "feat: add automated SOC 2 evidence collection"
git commit -m "fix: resolve session timeout race condition"
git commit -m "docs: add FedRAMP control mapping"
git commit -m "security: update react-chartjs-2 to patch CVE-2024-XXXXX"
git commit -m "infra: add CloudWatch alarms for API latency"
```

### Pull Request Process

1. **Create Feature Branch:** `git checkout -b feat/your-feature`
2. **Write Tests:** Ensure >80% code coverage for new features
3. **Run Linters:** `npm run lint && npm run typecheck`
4. **Security Scan:** `npm audit --production`
5. **Open PR:** Target `main` branch with description linking to issue
6. **Code Review:** Require 1 approval from CODEOWNERS
7. **CI Checks:** All GitHub Actions must pass
8. **Merge:** Squash commits for clean history

---

## ⚙️ GitHub Actions & CI/CD

### Required Workflow Patterns

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsDeployRole
          aws-region: us-east-1
```

### Secret Management

Never commit secrets. Use GitHub Actions Secrets and OIDC for AWS:

```yaml
- name: Configure AWS with OIDC
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: us-east-1
```

---

## 💰 Cost Optimization: Avoid Netlify Functions

> **Policy:** Do **NOT** introduce new Netlify Functions. Use AWS Lambda + API Gateway or direct Supabase client calls instead.

### Current Netlify Redirects to AWS

```toml
# netlify.toml — add new routes here instead of new Netlify functions
[[redirects]]
  from   = "/api/new-endpoint"
  to     = "https://api.securebase.tximhotep.com/new-endpoint"
  status = 200
  force  = true
```

---

## 🔭 Phase 5 Observability Architecture

### Terraform Modules
- `landing-zone/modules/phase5-admin-metrics/` — CloudWatch aggregation Lambda, DynamoDB tables, 7 `/admin/*` endpoints
- `landing-zone/modules/phase5-tenant-metrics/` — Per-tenant DynamoDB tables with KMS encryption
- `landing-zone/modules/phase5-logging/` — CloudWatch log groups, X-Ray tracing ✅
- `landing-zone/modules/phase5-alerting/` — CloudWatch alarms, SNS, PagerDuty ✅
- `landing-zone/modules/multi-region/` — Aurora Global DB, DynamoDB Global Tables, S3 CRR, CloudFront failover ✅ (49/49 applied 2026-05-10)

### Lambda Functions
- `phase2-backend/functions/metrics_aggregation.py` — CloudWatch + Cost Explorer for admin dashboard
- `phase2-backend/functions/tenant_metrics.py` — Per-tenant metrics (6 endpoints, JWT auth)
- `phase2-backend/functions/failover_orchestrator.py` ✅ — Automated us-east-1 → us-west-2 failover
- `phase2-backend/functions/health_check_aggregator.py` ✅ — Custom Route 53 / CloudFront health checks
- `phase2-backend/functions/failback_orchestrator.py` ✅ — Controlled failback after recovery

### Frontend Components
- `phase3a-portal/src/components/admin/AdminDashboard.jsx` — Executive metrics
- `phase3a-portal/src/components/admin/SystemHealth.jsx` — Real-time system health
- `phase3a-portal/src/components/tenant/TenantDashboard.jsx` — Per-tenant view
- `phase3a-portal/src/components/tenant/ComplianceDrift.jsx` — 90-day drift timeline
- `phase3a-portal/src/components/SREDashboard.jsx` — CloudWatch query library, DLQ depth, runbooks ✅
- `phase3a-portal/src/components/AlertManagement.jsx` — Alert management UI

### SLA Targets (Achieved via Phase 5.4)
- **RTO:** < 15 minutes | **RPO:** < 1 minute
- **Uptime SLA:** 99.95% (4.4 hours downtime/year)
- **Dashboard load:** < 2 seconds (p95)
- **Alert noise:** < 5% false positive rate

---

## 🏗 Infrastructure as Code (Terraform)

### ⚠️ Terraform Deployment Directory

```bash
# ❌ WRONG
cd landing-zone && terraform apply

# ✅ CORRECT
cd landing-zone/environments/dev && terraform apply
cd landing-zone/environments/prod && terraform apply
cd landing-zone/environments/prod-us-west-2 && terraform apply
```

### Multi-Region Apply Target

```bash
# Phase 5.4: apply only the multi-region module
cd landing-zone/environments/prod
terraform apply -target=module.multi_region -var-file=multi-region.tfvars
```

### Required Variables for Compliance

```hcl
variable "encryption_at_rest" {
  description = "Enable AES-256 encryption for data at rest"
  type        = bool
  default     = true
}

variable "encryption_in_transit" {
  description = "Minimum TLS version"
  type        = string
  default     = "TLSv1_3_2021"
}

variable "tags" {
  description = "Compliance tracking tags"
  type        = map(string)
  default = {
    Environment         = "production"
    ComplianceFramework = "SOC2,FedRAMP,HIPAA"
    DataClassification  = "sensitive"
    ManagedBy           = "terraform"
  }
}
```

---

## 🔍 AI Assistant Audit Checklist

Before suggesting any code or configuration changes, **verify:**

### 1. IAM & Permissions
- [ ] Does this introduce over-privileged IAM roles?
- [ ] Are GitHub Actions using minimal `permissions:` blocks?
- [ ] Is AWS OIDC used instead of long-lived access keys?

### 2. Dependency Management
- [ ] Does `npm install` include `--legacy-peer-deps` for chart.js?
- [ ] Are all dependencies from trusted sources?
- [ ] Are there known vulnerabilities? (`npm audit`)

### 3. Compliance Tagging
- [ ] Are cloud resources tagged with `Environment`, `ComplianceFramework`, `DataClassification`?
- [ ] Is encryption enabled (at rest: AES-256, in transit: TLS 1.3)?
- [ ] Are audit logs enabled for all data access?

### 4. Secure Coding
- [ ] Is user input validated and sanitized?
- [ ] Are there SQL injection risks? (Use parameterized queries)
- [ ] Is PII/PHI logged anywhere?
- [ ] Are GA4 events free of PII/PHI?
- [ ] Are secrets stored in environment variables or secret managers?

### 5. Documentation
- [ ] Are changes reflected in `README.md` or `/docs`?
- [ ] Is there a migration guide for breaking changes?
- [ ] Are new environment variables documented?

### 6. Cost Controls
- [ ] Does this introduce a new Netlify Function? If yes, refactor to AWS Lambda + API Gateway.
- [ ] Is a `netlify.toml` redirect to API Gateway sufficient instead?

---

## 📚 Additional Resources

- **Supabase Docs:** https://supabase.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Chart.js:** https://www.chartjs.org/docs/latest/
- **Google Analytics 4:** https://developers.google.com/analytics/devguides/collection/ga4
- **SOC 2 Controls:** https://www.aicpa.org/soc4so
- **FedRAMP Controls:** https://www.fedramp.gov/assets/resources/documents/FedRAMP_Security_Controls_Baseline.xlsx
- **HIPAA Security Rule:** https://www.hhs.gov/hipaa/for-professionals/security/index.html

---

## 🤖 How AI Assistants Should Use This File

When working on `cedrickbyrd/securebase-app`, you are acting as a **Principal Cloud Architect** for a compliance-first SaaS platform. Your primary responsibility is ensuring every suggestion aligns with:

1. **Security posture** (least privilege, encryption, secrets management)
2. **Compliance requirements** (SOC 2, FedRAMP, HIPAA)
3. **Code quality** (TypeScript, testing, documentation)
4. **Operational excellence** (IaC, CI/CD, monitoring)

**Before proposing any change:**
- Read the relevant section of this guide
- Check the audit checklist
- Consider the compliance impact
- Suggest secure alternatives when user requests conflict with best practices

---

**Last Updated:** 2026-05-10  
**Maintained By:** Cedrick Byrd (cedrickbyrd)  
**Questions?** Open an issue in the repository.
