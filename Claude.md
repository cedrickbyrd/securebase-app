# CLAUDE.md - SecureBase Development Guide

**Repository:** `cedrickbyrd/securebase-app`  
**Role Context:** Principal Cloud Architect | Compliance-First SaaS Platform  
**Mission:** Build SOC 2, FedRAMP, and HIPAA-ready infrastructure and features

---

## 🎯 Project Overview

SecureBase is a security-first, multi-tenant AWS PaaS platform that has evolved from an AWS landing zone orchestrator into a comprehensive suite for **compliance automation**, **AI Agent Authentication**, **Non-Human Identity Management (NHI/IAM)**, and **Sovereign Infrastructure Orchestration**. Every code change must prioritize security, auditability, and regulatory compliance.

**Current Phase Status (April 2026):**
| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | AWS Landing Zone (Terraform IaC) | ✅ Complete |
| Phase 2 | Serverless Database & API Backend | ✅ Complete |
| Phase 3a | Customer Portal (React) | ✅ Complete |
| Phase 3b | Support Tickets, Webhooks & Cost Forecasting | ✅ Complete |
| Phase 4 | Enterprise Features (RBAC, Analytics, Notifications) | ✅ Complete |
| Phase 5.1 | Executive/Admin Dashboard | ✅ Complete |
| Phase 5.2 | Tenant/Customer Dashboard & Compliance Drift | ✅ Complete |
| Phase 5.3 | Multi-Region DR, Alerting & Cost Optimization | 🔨 In Progress |
| Phase 6 | Compliance Automation & Operations Scale | 📅 Planned |

### 🔨 Phase 5.3 Current Sprint

> See [`PHASE5.3_SCOPE.md`](PHASE5.3_SCOPE.md) for the full scope definition.

Active components being built in Phase 5.3:

- **Component 4 — Logging & Distributed Tracing** (`landing-zone/modules/phase5-logging/`) — Centralized log aggregation, X-Ray tracing, structured JSON logging across all Lambdas
- **Component 5 — Alerting & Incident Response** (`landing-zone/modules/phase5-alerting/`) — CloudWatch alarms, SNS topics, PagerDuty integration, runbook automation
- **Component 6 — Multi-Region DR** (`landing-zone/modules/multi-region/`, `landing-zone/environments/prod-us-west-2/`) — Aurora Global Database, DynamoDB Global Tables, Route 53 failover; **RTO < 15 min, RPO < 1 min**
- **Component 7 — Infrastructure Scaling & Cost Optimization** — Auto-scaling policies, Compute Savings Plans, Aurora capacity scheduler, cost anomaly detection

**Pending Lambda functions** (not yet deployed):
- `phase2-backend/functions/failover_orchestrator.py` — Automated us-east-1 → us-west-2 failover
- `phase2-backend/functions/health_check_aggregator.py` — Custom Route 53 health checks
- `phase2-backend/functions/failback_orchestrator.py` — Controlled failback after incident recovery

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
      // CRITICAL: Anonymize IP addresses for HIPAA compliance
      anonymize_ip: true,
      
      // Disable advertising features
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      
      // Cookie settings (use first-party only)
      cookie_flags: 'SameSite=Strict;Secure',
      cookie_domain: 'auto',
      cookie_expires: 60 * 60 * 24 * 90, // 90 days
    },
    gtagOptions: {
      // Disable all advertising features
      send_page_view: false, // We'll send manually
    },
  });
};

// Track page views (call on route changes)
export const trackPageView = (path: string, title?: string) => {
  // NEVER include PII/PHI in page URLs or titles
  const sanitizedPath = sanitizePath(path);
  const sanitizedTitle = title || document.title;
  
  ReactGA.send({ 
    hitType: 'pageview', 
    page: sanitizedPath,
    title: sanitizedTitle,
  });
};

// Track user interactions (buttons, features)
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
  dimensions?: Record<string, string>
) => {
  // NEVER pass PII/PHI in event parameters
  ReactGA.event({
    category,
    action,
    label,
    value,
    ...dimensions,
  });
};

// Sanitize paths to remove PII/PHI
const sanitizePath = (path: string): string => {
  // Remove user IDs, emails, organization names, etc.
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

#### Integration in App (src/App.tsx)

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initializeAnalytics, trackPageView } from './utils/analytics';

function App() {
  const location = useLocation();

  useEffect(() => {
    // Initialize GA4 once on app mount
    const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
    const isProduction = import.meta.env.PROD;

    if (measurementId) {
      initializeAnalytics({ measurementId, isProduction });
    }
  }, []);

  useEffect(() => {
    // Track page views on route change
    trackPageView(location.pathname);
  }, [location]);

  return (
    // Your app components
  );
}
```

#### Cookie Consent Banner (GDPR/CCPA Requirement)

```typescript
// src/components/CookieConsent.tsx
import { useState, useEffect } from 'react';
import ReactGA from 'react-ga4';

export const CookieConsent: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('analytics_consent');
    if (!consent) {
      setShowBanner(true);
    } else if (consent === 'accepted') {
      // User previously accepted
      ReactGA.gtag('consent', 'update', {
        analytics_storage: 'granted',
      });
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('analytics_consent', 'accepted');
    ReactGA.gtag('consent', 'update', {
      analytics_storage: 'granted',
    });
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem('analytics_consent', 'declined');
    ReactGA.gtag('consent', 'update', {
      analytics_storage: 'denied',
    });
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50">
      <div className="container mx-auto flex items-center justify-between">
        <p className="text-sm">
          We use analytics to improve your experience. No personal health information is tracked.
        </p>
        <div className="flex gap-4">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm border border-white rounded hover:bg-gray-800"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm bg-blue-600 rounded hover:bg-blue-700"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
```

#### GA4 Event Tracking Examples

```typescript
// Track feature usage
import { trackEvent } from '@/utils/analytics';

// Compliance dashboard loaded
trackEvent('Dashboard', 'View', 'SOC2_Dashboard');

// Report generated
trackEvent('Report', 'Generate', 'Compliance_PDF', reportPageCount);

// Assessment completed
trackEvent('Assessment', 'Complete', 'HIPAA_Security_Rule');

// Integration connected
trackEvent('Integration', 'Connect', 'AWS_CloudTrail');
```

#### GA4 Custom Dimensions (GA4 Admin Console Setup)

Configure these in your GA4 property for better insights:

1. **user_role** (User-scoped) - Values: `admin`, `auditor`, `viewer`
2. **compliance_framework** (Event-scoped) - Values: `SOC2`, `FedRAMP`, `HIPAA`
3. **organization_tier** (User-scoped) - Values: `free`, `pro`, `enterprise`
4. **feature_flag** (Event-scoped) - Track which beta features are enabled

```typescript
// Set user properties (NEVER use PII)
ReactGA.gtag('set', 'user_properties', {
  user_role: 'admin', // Generic role, not user ID
  organization_tier: 'enterprise',
});

// Track with custom dimensions
trackEvent('Feature', 'Enable', 'AI_Risk_Assessment', undefined, {
  compliance_framework: 'SOC2',
  feature_flag: 'ai_enabled',
});
```

#### Privacy Policy Requirements

Update your Privacy Policy to include:

```markdown
### Analytics and Cookies

SecureBase uses Google Analytics 4 to understand how users interact with our platform. 
We collect:
- Page views and navigation patterns
- Feature usage and button clicks
- Session duration and bounce rates

We DO NOT collect:
- Personal Identifiable Information (PII)
- Protected Health Information (PHI)
- Email addresses, names, or contact details
- Financial information or payment data

All IP addresses are anonymized. You can opt-out of analytics tracking at any time 
in your account settings.
```

#### Testing GA4 Implementation

```bash
# Install GA4 debugger extension for Chrome
# Visit: https://chrome.google.com/webstore/detail/google-analytics-debugger

# Test events in development
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX npm run dev

# Check browser console for GA4 debug output
# Verify events in GA4 DebugView (real-time)
```

#### GA4 Dashboard Recommendations

**Custom Reports to Build:**
1. **Compliance Framework Adoption** - Which frameworks are most used?
2. **Feature Funnel** - Dashboard view → Assessment start → Report generation
3. **Integration Health** - Which integrations have highest engagement?
4. **User Role Distribution** - How many admins vs. viewers?
5. **Time to Value** - Days from signup to first completed assessment

#### ⚠️ NEVER Track

- User emails or names
- Organization names (use hashed IDs)
- Audit findings or vulnerabilities
- Compliance scores or grades
- Customer lists or vendor names
- Any data field marked as PII/PHI in your data model
- URL parameters containing sensitive identifiers

#### BAA (Business Associate Agreement) with Google

**CRITICAL:** If your users are HIPAA-covered entities:
- GA4 standard does NOT support HIPAA/BAA
- Use **Google Analytics 360** (paid) with BAA for HIPAA environments
- Alternative: Use privacy-first analytics like Plausible or Fathom
- Or implement server-side tracking with your own analytics database

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
# Features
git commit -m "feat: add automated SOC 2 evidence collection"

# Bug fixes
git commit -m "fix: resolve session timeout race condition"

# Documentation
git commit -m "docs: add FedRAMP control mapping"

# Security patches
git commit -m "security: update react-chartjs-2 to patch CVE-2024-XXXXX"

# Infrastructure
git commit -m "infra: add CloudWatch alarms for API latency"
```

### Pull Request Process

1. **Create Feature Branch:** `git checkout -b feat/your-feature`
2. **Write Tests:** Ensure >80% code coverage for new features
3. **Run Linters:** `npm run lint && npm run typecheck`
4. **Security Scan:** `npm audit --production`
5. **Open PR:** Target `main` branch with description linking to issue
6. **Code Review:** Require 1 approval from CODEOWNERS
7. **CI Checks:** All GitHub Actions must pass (see below)
8. **Merge:** Squash commits for clean history

---

## ⚙️ GitHub Actions & CI/CD

### Required Workflow Patterns

**Principle: Least Privilege Permissions**

```yaml
# ✅ GOOD: Explicit minimal permissions
name: Deploy to Production
on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write  # For OIDC authentication to AWS

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4  # Pinned to major version
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsDeployRole
          aws-region: us-east-1
```

```yaml
# ❌ AVOID: Over-privileged or missing permissions
permissions: write-all  # TOO BROAD

# ❌ AVOID: No permissions block at all (defaults to read/write)
```

### Action Version Pinning (Supply Chain Security)

```yaml
# ✅ PREFERRED: Pin to commit SHA
- uses: actions/checkout@8e5e7e5ab8b370d6c329ec480221332ada57f0ab  # v4.1.1

# ✅ ACCEPTABLE: Pin to major version with Dependabot updates
- uses: actions/checkout@v4

# ❌ AVOID: Floating tags
- uses: actions/checkout@main
```

### Secret Management

**Never commit secrets.** Use GitHub Actions Secrets:

```yaml
env:
  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
```

**For AWS, prefer OIDC over long-lived credentials:**

```yaml
- name: Configure AWS with OIDC
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: us-east-1
    # No access keys needed!
```

---

## 💰 Cost Optimization: Avoid Netlify Functions

> **Policy:** Do **NOT** introduce new Netlify Functions. Existing functions are grandfathered but should be migrated opportunistically. Netlify functions are billed per invocation and execution time — at scale this is significantly more expensive than the existing AWS Lambda + API Gateway infrastructure that is already live.

### Why Netlify Functions Cost More

| Factor | Netlify Functions | AWS Lambda (API Gateway) |
|--------|-------------------|--------------------------|
| Free tier | 125,000 req/month | 1M req/month (free tier) |
| Pricing beyond free | $25/month Starter + overages | ~$0.20 per 1M requests |
| Already deployed? | Requires Netlify hosting plan | ✅ Already live |
| Execution timeout | 10s default (26s max) | Up to 15 minutes |
| Trust signal | Netlify-branded URL | Custom domain via API Gateway |

### Preferred Alternatives

#### 1. AWS Lambda via API Gateway (primary — already live)
All backend logic should go through the existing API Gateway, proxied by Netlify redirects at zero additional cost:

```
/api/checkout   → https://4f0i48ueak.execute-api.us-east-1.amazonaws.com/prod/checkout
/api/login      → https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod/auth/login
/api/signup     → https://api.securebase.tximhotep.com/signup
```

Add new Lambda functions in `phase2-backend/functions/` and wire them in `landing-zone/modules/api-gateway/main.tf`. Then expose them via a Netlify redirect in `netlify.toml` (see option 3 below).

#### 2. Direct Supabase Client Calls (for simple data reads/writes)
Use the Supabase JS SDK directly from the browser for non-sensitive operations. RLS policies enforce row-level security without needing a server intermediary.

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY  // Public anon key — safe in browser
);

// Lead capture — replaces the submit-lead Netlify function for simple cases
const { error } = await supabase
  .from('leads')
  .upsert({ email, company, trigger }, { onConflict: 'email' });
```

#### 3. Netlify Redirects to AWS (zero cost, already configured)
Use Netlify's redirect layer (`netlify.toml`) to proxy requests to AWS API Gateway at no additional cost. This is already used for `/api/checkout`, `/api/login`, etc. Add new routes here instead of writing a new function.

```toml
# netlify.toml — add new routes here instead of creating new Netlify functions
[[redirects]]
  from   = "/api/new-endpoint"
  to     = "https://api.securebase.tximhotep.com/new-endpoint"
  status = 200
  force  = true
```

### Current Netlify Functions — Migration Status

| Function | Purpose | Preferred Migration Path |
|----------|---------|--------------------------|
| `submit-lead.js` | Lead capture → Supabase | Direct `supabase.from('leads').upsert(...)` from frontend |
| `checkout.js` | Stripe session creation | Already mirrored by AWS Lambda at `/api/checkout` — remove Netlify copy |
| `lead-preview-auth.js` | JWT cookie after Contact Sales | Move JWT issuance to AWS Lambda in `phase2-backend/functions/` |
| `demo-auth.js` | Demo login JWT | Move to AWS Lambda or Supabase Auth |
| `get-admin-metrics.js` | Admin metrics proxy | Already served by `/admin/*` API Gateway routes |
| `get-trust-metrics.js` | Trust metrics proxy | Already served by API Gateway |

### ❌ What NOT to Do

```javascript
// ❌ AVOID: Creating a new Netlify function
// netlify/functions/my-new-feature.js
exports.handler = async (event) => { ... };

// ❌ AVOID: Calling a Netlify function directly from a component
const res = await fetch('/.netlify/functions/my-feature', { ... });
```

### ✅ What to Do Instead

```javascript
// ✅ GOOD: Call the existing API Gateway via the Netlify redirect proxy
const res = await fetch('/api/my-feature', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

// ✅ GOOD: Direct Supabase client call for simple data operations
const { data, error } = await supabase.from('table').insert(payload);
```

---

## 🔭 Phase 5 Observability Architecture

Phase 5 adds enterprise-grade observability, dashboards, alerting, and multi-region DR to the platform. Key new modules and components introduced:

### New Terraform Modules
- `landing-zone/modules/phase5-admin-metrics/` — CloudWatch aggregation Lambda, DynamoDB tables for admin metrics; 7 API endpoints at `/admin/*`
- `landing-zone/modules/phase5-tenant-metrics/` — Per-tenant DynamoDB tables (`securebase-metrics-history`, `securebase-compliance-violations`, `securebase-audit-trail`) with KMS encryption
- `landing-zone/modules/multi-region/` *(In Progress)* — Aurora Global Database, DynamoDB Global Tables, Route 53 failover, S3 CRR, CloudFront multi-origin

### New Lambda Functions
- `phase2-backend/functions/metrics_aggregation.py` — CloudWatch + Cost Explorer aggregation for admin dashboard
- `phase2-backend/functions/tenant_metrics.py` — Per-tenant compliance, usage, and cost metrics (6 endpoints, JWT auth)
- `phase2-backend/functions/failover_orchestrator.py` *(Planned)* — Automated us-east-1 → us-west-2 failover
- `phase2-backend/functions/health_check_aggregator.py` *(Planned)* — Custom Route 53 health checks

### New Frontend Components
- `phase3a-portal/src/components/admin/AdminDashboard.jsx` — Executive metrics (7 sections, exponential back-off auto-refresh)
- `phase3a-portal/src/components/admin/SystemHealth.jsx` — Real-time system health widget
- `phase3a-portal/src/services/adminService.js` — Admin API client (mock data via `VITE_USE_MOCK_API=true`)
- `phase3a-portal/src/components/TenantDashboard.jsx` — Per-tenant compliance, usage, cost, alerts
- `phase3a-portal/src/components/ComplianceDrift.jsx` — 90-day drift timeline with MTTR analytics
- `phase3a-portal/src/components/SREDashboard.jsx` — SRE operations view (purple `#9333EA` accent for memory metrics)

### SLA Targets (Phase 5.3)
- **RTO:** < 15 minutes | **RPO:** < 1 minute
- **Uptime SLA:** 99.95% (4.4 hours downtime/year)
- **Dashboard load:** < 2 seconds (p95)
- **Alert noise:** < 5% false positive rate

---

## 🏗 Infrastructure as Code (Terraform)

### ⚠️ Terraform Deployment Directory

Running Terraform from the wrong directory is the most common and consequential mistake — always target a specific environment under `landing-zone/environments/`.

```bash
# ❌ WRONG — runs against root module, not an environment
cd landing-zone && terraform apply

# ✅ CORRECT — always target a specific environment directory
cd landing-zone/environments/dev && terraform apply
cd landing-zone/environments/prod && terraform apply
cd landing-zone/environments/prod-us-west-2 && terraform apply  # Phase 5.3 secondary region
```

### Required Variables for Compliance

Every Terraform module must expose:

```hcl
variable "encryption_at_rest" {
  description = "Enable AES-256 encryption for data at rest"
  type        = bool
  default     = true
}

variable "encryption_in_transit" {
  description = "Minimum TLS version (1.2 or 1.3)"
  type        = string
  default     = "TLSv1_3_2021"
  
  validation {
    condition     = contains(["TLSv1_2_2021", "TLSv1_3_2021"], var.encryption_in_transit)
    error_message = "TLS version must be 1.2 or higher for compliance."
  }
}

variable "tags" {
  description = "Compliance tracking tags"
  type        = map(string)
  default = {
    Environment       = "production"
    ComplianceFramework = "SOC2,FedRAMP,HIPAA"
    DataClassification  = "sensitive"
    ManagedBy         = "terraform"
  }
}
```

### S3 Bucket Example (Compliance-Ready)

```hcl
resource "aws_s3_bucket" "compliance_evidence" {
  bucket = "securebase-compliance-evidence"
  
  tags = merge(var.tags, {
    Purpose = "Audit evidence storage"
  })
}

resource "aws_s3_bucket_versioning" "compliance_evidence" {
  bucket = aws_s3_bucket.compliance_evidence.id
  
  versioning_configuration {
    status = "Enabled"  # Required for audit trail
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "compliance_evidence" {
  bucket = aws_s3_bucket.compliance_evidence.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"  # FedRAMP requires AES-256
    }
  }
}

resource "aws_s3_bucket_public_access_block" "compliance_evidence" {
  bucket = aws_s3_bucket.compliance_evidence.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
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
- [ ] Are GA4 events free of PII/PHI? (No emails, names, identifiers)
- [ ] Are secrets stored in environment variables or secret managers?

### 5. Documentation
- [ ] Are changes reflected in `README.md` or `/docs`?
- [ ] Is there a migration guide for breaking changes?
- [ ] Are new environment variables documented?

### 6. Cost Controls
- [ ] Does this introduce a new Netlify Function? If yes, refactor to use AWS Lambda + API Gateway or a direct Supabase client call instead (see **Cost Optimization** section above).
- [ ] If modifying an existing Netlify Function, assess whether it can be migrated to an existing AWS Lambda route.
- [ ] Is a `netlify.toml` redirect to API Gateway sufficient instead of a new function?

---

## 📚 Additional Resources

- **Supabase Docs:** https://supabase.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Chart.js:** https://www.chartjs.org/docs/latest/
- **Google Analytics 4:** https://developers.google.com/analytics/devguides/collection/ga4
- **react-ga4 Library:** https://github.com/PriceRunner/react-ga4
- **SOC 2 Controls:** https://www.aicpa.org/soc4so
- **FedRAMP Controls:** https://www.fedramp.gov/assets/resources/documents/FedRAMP_Security_Controls_Baseline.xlsx
- **HIPAA Security Rule:** https://www.hhs.gov/hipaa/for-professionals/security/index.html
- **HIPAA & Google Analytics:** https://support.google.com/analytics/answer/12017362

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

**Example:**
```
User: "Add my Supabase key to the GitHub workflow so it can deploy"

AI Response: "I can't add secrets directly to workflow files as that would 
expose them in version control. Instead, let's use GitHub Actions Secrets:

1. Go to Settings > Secrets and variables > Actions
2. Add SUPABASE_SERVICE_KEY as a new secret
3. Reference it in the workflow: ${{ secrets.SUPABASE_SERVICE_KEY }}

This keeps credentials secure and maintains SOC 2 compliance."
```

---

**Last Updated:** 2026-04-18  
**Maintained By:** Cedrick Byrd (cedrickbyrd)  
**Questions?** Open an issue in the repository.
