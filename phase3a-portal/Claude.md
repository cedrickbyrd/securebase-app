# SecureBase Customer Portal — `phase3a-portal/`

> **AI Agent First-Read**: This is the ONLY file you need before working anywhere in `phase3a-portal/`. It is fully self-contained. For infrastructure (Terraform), CI/CD, GitHub Actions patterns, and compliance standards (SOC2/FedRAMP/HIPAA), refer to the root `/Claude.md`.

---

## ⚠️ This Is a Separate Application

`phase3a-portal/` is a **completely separate React application** from the root `/` marketing site. They share the same GitHub repository (monorepo) but are otherwise independent.

| | Root `/` | `phase3a-portal/` |
|---|---|---|
| **Purpose** | Public marketing + signup site | Authenticated customer portal |
| **React** | **19** | **18** ← you are here |
| **Vite** | **6** | **5** ← you are here |
| **Auth** | AWS Lambda (`/api/signup`) | **Supabase Auth** (active — do NOT remove) |
| `@supabase/supabase-js` | ❌ intentionally removed (PR #508) | ✅ **present and required** |
| **`package.json`** | `/package.json` | `phase3a-portal/package.json` |
| **Deploy** | Netlify (root) | Netlify (portal subdomain) |

**Never conflate the two.** Running `npm install` at the repo root does NOT install portal dependencies. Importing root utilities into the portal will break builds.

---

## Identity

- **What it is:** Multi-tenant customer portal for the SecureBase SaaS platform (TxImhotep LLC)
- **Production:** https://portal.securebase.tximhotep.com
- **Demo:** https://demo.securebase.tximhotep.com
- **API:** https://api.securebase.tximhotep.com
- **Own config files:** `package.json`, `package-lock.json`, `vite.config.js`, `tailwind.config.js`, `vitest.config.js`, `playwright.config.js`

---

## Tech Stack

| Layer | Tool | Note |
|-------|------|------|
| Framework | **React 18** + React Router 6 | NOT React 19 |
| Build | **Vite 5** | NOT Vite 6 |
| Language | JSX (`.jsx`) | New components: prefer `.tsx` where possible |
| Styling | Tailwind CSS 3 | No inline styles |
| Charts | Chart.js 4 + react-chartjs-2, Recharts | Always `--legacy-peer-deps` on install |
| Icons | `@heroicons/react`, `lucide-react` | |
| HTTP | Axios | |
| Animation | `framer-motion` | |
| Auth | **Supabase Auth** (`@supabase/supabase-js`) | Active — do NOT replace or remove |
| PDF | `jspdf` + `html2canvas` | |
| Testing | Vitest + React Testing Library + Playwright | |
| Node | >=20.19.0 | |

---

## Package Management Rules

> **These rules apply specifically inside `phase3a-portal/`.** They are different from the root package rules.

```bash
# ✅ ALWAYS cd into the portal directory first
cd phase3a-portal

# ✅ Install packages locally with --legacy-peer-deps (required for chart.js)
npm install <package> --legacy-peer-deps

# ✅ Commit the lock file after every install
git add package-lock.json

# ✅ Use npm install (not npm ci) when adding/updating packages locally
npm install

# ❌ NEVER run npm install from the repo root expecting it to affect the portal
# ❌ NEVER add @supabase/supabase-js to the root /package.json — it lives here only
# ❌ NEVER use npm ci locally — CI only
```

**Lock file policy:** `phase3a-portal/package-lock.json` must stay in sync with `phase3a-portal/package.json`. If CI fails with `npm error code EUSAGE`, run `npm install` here and commit the updated lock file.

---

## Directory Structure

```
phase3a-portal/
├── src/
│   ├── components/         # Feature components (see Component Map below)
│   │   ├── admin/          # Admin-only views (AdminDashboard, SystemHealth)
│   │   ├── charts/         # Reusable chart wrappers
│   │   ├── navigation/     # Nav bar / sidebar
│   │   ├── onboarding/     # Onboarding flow
│   │   ├── signup/         # Signup flow
│   │   └── tenant/         # Tenant-scoped views (TenantDashboard, ComplianceDrift)
│   ├── config/             # App config / feature flags / live-config.js
│   ├── hooks/              # Custom React hooks
│   ├── mocks/              # Mock data for tests
│   ├── pages/              # Route-level page components
│   ├── services/           # API/service layer (see Services Map below)
│   ├── styles/             # Global styles
│   ├── test/               # Shared test utilities / setup
│   ├── utils/              # Formatters, helpers, analytics.js
│   ├── App.jsx             # Root component + React Router routes
│   └── main.jsx            # Vite entry point
├── tests/                  # Playwright E2E tests
├── netlify/functions/      # Netlify Functions (legacy — see Cost Optimization below)
├── public/                 # Static assets
├── .env.example            # Env var template
├── .env.staging            # Staging config (tracked)
├── .env.production         # Production config (tracked)
├── .env.demo               # Demo config (tracked)
├── vite.config.js
├── tailwind.config.js
├── vitest.config.js
└── playwright.config.js
```

---

## Component Map

> **Check this map before creating any new component.** Do NOT recreate components that already exist.

| Component | Location | Purpose |
|-----------|----------|---------|
| `Dashboard.jsx` | `components/` | Main tenant dashboard — metrics, usage, quick actions |
| `AdminDashboard.jsx` | `components/admin/` | Executive/admin metrics (7 sections, exponential back-off auto-refresh) |
| `SystemHealth.jsx` | `components/admin/` | Real-time system health widget (used inside AdminDashboard) |
| `SREDashboard.jsx` | `components/` | SRE/ops dashboard — infra health, pipelines, Lambda metrics. Memory metric accent color is `#9333EA` — do NOT change |
| `SREDashboardWrapper.jsx` | `components/` | Route wrapper for SREDashboard |
| `TenantDashboard.jsx` | `components/tenant/` | Per-tenant compliance, usage, cost, and alerts |
| `ComplianceDrift.jsx` | `components/tenant/` | 90-day compliance drift timeline with MTTR analytics |
| `Compliance.jsx` | `components/` | Compliance framework status and findings |
| `ComplianceScreen.jsx` | `components/` | Alternative compliance screen view |
| `ControlsList.jsx` | `components/` | Compliance controls browser |
| `TeamManagement.jsx` | `components/` | RBAC team member management |
| `AlertManagement.jsx` | `components/` | Alert management |
| `Analytics.jsx` | `components/` | Analytics dashboard |
| `Invoices.jsx` | `components/` | Invoice list, search, PDF download |
| `SupportTickets.jsx` | `components/` | Create tickets, thread comments |
| `Webhooks.jsx` | `components/` | Webhook configuration |
| `ApiKeys.jsx` | `components/` | Create/revoke API keys with scopes |
| `Login.jsx` | `components/` | Authentication via Supabase Auth |
| `Signup.jsx` | `components/` | Registration entry point |
| `SignupForm.jsx` | `components/signup/` | Registration form |
| `SecurityEvents.jsx` | `components/` | Security event log |
| `AuditLog.jsx` | `components/` | Immutable compliance audit trail |
| `Forecasting.jsx` | `components/` | 12-month cost forecasting |
| `NotificationCenter.jsx` | `components/` | Notification center |
| `NotificationBell.jsx` | `components/` | Nav bar notification bell |
| `ReportBuilder.jsx` | `components/` | PDF compliance report generation |
| `DemoBanner.jsx` | `components/` | Demo-mode banner with CTAs |
| `ReadOnlyWrapper.jsx` | `components/` | Disables writes in demo mode |
| `ExportEvidence.jsx` | `components/` | Export compliance evidence |
| `IPWhitelistManagement.jsx` | `components/` | IP allowlist configuration |
| `SSOConfiguration.jsx` | `components/` | SSO/SAML configuration |
| `OnboardingProgress.jsx` | `components/onboarding/` | Onboarding step tracker |

---

## Services Map

| Service | File | Purpose |
|---------|------|---------|
| API client | `api.js` | Axios instance with auth headers |
| API wrappers | `apiService.js` | High-level wrappers pointing to `VITE_API_BASE_URL` |
| Admin metrics | `adminService.js` | Admin API client — supports mock via `VITE_USE_MOCK_API=true` |
| SRE metrics | `sreService.js` | SRE metrics + `getMockHIPAACompliance()` |
| Auth abstraction | `authAdapter.js` | Switches between real Supabase auth and demo auth |
| JWT handling | `jwtService.js` | JWT encode/decode/validation |
| RBAC | `rbacService.js` | Permission checks |
| Notifications | `notificationService.js` | WebSocket-based notifications |
| Teams | `teamService.js` | Team member management |
| WebSocket | `websocketService.js` | WebSocket client |
| Analytics | `analyticsService.js` | GA4 event tracking (strips PII from events) |
| Mock API | `mockApiService.js` | Mock backend for demo/test mode |
| Demo API | `demoApiService.js` | Demo-specific API adapter |
| CRM | `crmService.js` | CRM integration |
| Lead scoring | `leadScoringService.js` | Lead scoring utilities |

---

## Environment Variables

Store portal-specific vars in `phase3a-portal/.env.local` (never commit secrets).

```env
# API
VITE_API_BASE_URL=https://api.securebase.tximhotep.com
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com
VITE_WS_URL=wss://api.securebase.tximhotep.com

# Supabase Auth (required — do NOT remove)
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# Feature flags
VITE_ENV=development
VITE_DEMO_MODE=false
VITE_DEMO_USER_EMAIL=demo@securebase.tximhotep.com
VITE_USE_MOCK_API=false
VITE_ANALYTICS_ENABLED=true
VITE_PILOT_PROGRAM_ENABLED=false

# Stripe
VITE_STRIPE_PUBLIC_KEY=pk_live_...
VITE_STANDARD_PRICE_ID=price_...
VITE_FINTECH_PRICE_ID=price_...
VITE_HEALTHCARE_PRICE_ID=price_...
VITE_GOVERNMENT_PRICE_ID=price_...
```

Demo build uses `.env.demo` (copied via `npm run build:demo`):
```env
VITE_DEMO_MODE=true
VITE_ENV=demo
VITE_DEMO_USER_EMAIL=demo@securebase.tximhotep.com
```

---

## Auth Architecture

> **This portal uses Supabase Auth. Do NOT remove or replace it.**

- Auth is abstracted through `authAdapter.js` — it delegates to `@supabase/supabase-js` for real auth and to `demoApiService.js` for demo mode
- `jwtService.js` handles JWT encode/decode/validation for API calls
- Demo mode (`VITE_DEMO_MODE=true`) bypasses Supabase Auth — auto-login via `demoApiService.js`
- **Do NOT** use the root marketing site's AWS Lambda auth pattern (`/api/signup`) here — that pattern was removed from the marketing site in PR #508 and does not apply to the portal
- `@supabase/supabase-js` is a required dependency in `phase3a-portal/package.json`; do NOT add it to the root `/package.json`

---

## 💳 Stripe Checkout — Price ID Architecture

> **⚠️ CRITICAL — Read before touching `live-config.js`, `Checkout.jsx`, or any pricing code.**

### The frontend sends `tier`, NOT `priceId`

```javascript
// phase3a-portal/src/pages/Checkout.jsx
fetch('/api/checkout', {
  method: 'POST',
  body: JSON.stringify({
    tier: plan,   // ← "standard", "fintech", "healthcare", "government", "pilot_compliance"
    email,
    name,
    successUrl,
    cancelUrl,
    // priceId is NEVER sent
  }),
});
```

### Price IDs are resolved in the Lambda — not the frontend

`/api/checkout` → AWS Lambda (`src/functions/securebase-checkout-api/index.cjs`) → resolves Price ID from `process.env['STRIPE_PRICE_STANDARD']` etc.

**The Lambda explicitly ignores any client-supplied `priceId`.** This is a security control.

### `priceId` fields in `live-config.js` are reference metadata only

The `PRICING_TIERS` object in `src/config/live-config.js` has `priceId` fields. They are:
- ✅ Human-readable documentation of which Stripe price maps to which tier
- ❌ Not sent to the checkout API
- ❌ Not used to determine billing amounts

**Do NOT propose wiring `live-config.js` priceIds to `VITE_*_PRICE_ID` env vars** — it would have no effect on checkout and adds unnecessary complexity.

### To change what Stripe charges

Update the env var on the **AWS Lambda** directly:
- AWS Console → Lambda → `securebase-checkout-api` → Configuration → Environment Variables
- Or via Terraform in `landing-zone/modules/api-gateway/`

See root `/Claude.md` `## 💳 Stripe Checkout Architecture` for the full picture.

---

## Build Scripts

```bash
# Always run from inside phase3a-portal/
cd phase3a-portal

npm run dev              # Local dev server (port 3000)
npm run build            # Production build → dist/
npm run build:staging    # Staging build (copies .env.staging)
npm run build:production # Production build (copies .env.production)
npm run build:demo       # Demo build (copies .env.demo)
npm run preview          # Preview production build locally
npm run lint             # ESLint — zero warnings policy
npm run test             # Vitest unit tests
npm run test:ui          # Vitest interactive UI
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:ui      # Playwright interactive UI
npm run test:e2e:headed  # Playwright with browser window
```

---

## Deployment

| Environment | Trigger | Target |
|-------------|---------|--------|
| Staging | `deploy-phase3a-staging.yml` on push to `main` | S3: `securebase-phase3a-staging` |
| Production | `deploy-phase3a-production.yml` | https://portal.securebase.tximhotep.com |
| Demo | `deploy-phase3a-demo.yml` | https://demo.securebase.tximhotep.com |

After S3 deploy, invalidate CloudFront:
```bash
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

---

## Demo Mode

- Triggered when `VITE_ENV=demo` or `VITE_DEMO_MODE=true`
- Auto-login — no Supabase credentials required in demo
- All write operations are intercepted by `ReadOnlyWrapper.jsx` and show a toast
- Data served from `demo-data.json` via `demoApiService.js`
- `DemoBanner.jsx` displayed at top with "Start Free Trial" / "Book Demo" CTAs
- Mock API enabled via `VITE_USE_MOCK_API=true` (uses `mockApiService.js`)

---

## Coding Conventions

- **Components:** Functional components with hooks only — no class components
- **Language:** `.jsx` for existing files; prefer `.tsx` for new components
- **Types:** Be explicit — do NOT use `any` or `unknown` TypeScript types
- **Styling:** Tailwind utility classes only — no inline styles, no `style={{}}` props
- **State:** `useState` / `useEffect` / `useCallback` — use context or service layer for shared state; avoid prop drilling
- **Imports:** Relative imports within `src/`; no barrel (`index.js`) files unless already present
- **Testing:** Every new component needs a test in `src/components/__tests__/` or `src/__tests__/`; mock services with `vi.mock()`
- **Security:** Escape all user-sourced HTML with `escHtml()`; never interpolate user input into CSS values; strip query params from analytics events

---

## ❌ Do NOT Rules

These are the most common mistakes — read before touching anything.

| Rule | Why |
|------|-----|
| Do NOT add `@supabase/supabase-js` to root `/package.json` | It belongs here only — adding it to root breaks PR #508's intentional removal |
| Do NOT install packages from the repo root expecting them in the portal | Separate `node_modules` |
| Do NOT remove or replace Supabase Auth | The entire portal auth flow depends on it |
| Do NOT use inline styles (`style={{}}`) | Use Tailwind utility classes |
| Do NOT use class components | Functional components only |
| Do NOT use `any` / `unknown` TypeScript types | Be explicit |
| Do NOT recreate existing components | Check the Component Map above first |
| Do NOT change `SREDashboard.jsx` memory metric accent color (`#9333EA`) | Design spec — see Component Map |
| Do NOT create new Netlify Functions | Use AWS Lambda via API Gateway + `netlify.toml` redirect instead |
| Do NOT call `/.netlify/functions/` directly from components | Use `/api/` proxy path via `netlify.toml` |
| Do NOT run `npm install` from the repo root for portal changes | Wrong package scope |

### Cost Optimization — No New Netlify Functions

The portal's `netlify/functions/` directory contains legacy functions. Do NOT add new ones.

**Instead:**
1. Add a new Lambda function in `phase2-backend/functions/`
2. Wire it in `landing-zone/modules/api-gateway/main.tf`
3. Expose it via a redirect in `phase3a-portal/netlify.toml`:

```toml
[[redirects]]
  from   = "/api/new-endpoint"
  to     = "https://api.securebase.tximhotep.com/new-endpoint"
  status = 200
  force  = true
```

---

## Compliance & Security Notes

- HIPAA dashboard visible to `healthcare` and `government` tier customers only
- PHI access logs must not include PII in GA4 analytics events — `analyticsService.js` strips query params
- All auditor-facing HTML reports must use `escHtml()` + CSS whitelists (no string interpolation of user data into style attributes)
- Rate limiting: 100 req/hr per customer enforced server-side
- `@supabase/supabase-js` uses RLS (Row-Level Security) policies — do NOT bypass with service-role key in the browser

---

## Current Phase (April 2026)

Phase 5.3 — Multi-Region DR, Alerting & Cost Optimization — is **in progress**. Portal work is focused on observability dashboards:

- `AdminDashboard.jsx` — Phase 5.1 ✅
- `TenantDashboard.jsx` + `ComplianceDrift.jsx` — Phase 5.2 ✅
- `SREDashboard.jsx` — Phase 5.3 🔨

See the root `/Claude.md` for the full phase status table and current sprint details.

---

## Reference to Root Claude.md

For the following topics, refer to `/Claude.md` (repo root):

- **Infrastructure (Terraform)** — landing zone, modules, environment deploy commands
- **CI/CD patterns** — GitHub Actions permissions, secret management, OIDC
- **Compliance standards** — SOC 2, FedRAMP, HIPAA control details
- **Cost optimization** — full Netlify Function migration strategy and cost comparison table
- **Phase roadmap** — full status table for all phases
- **AWS backend** — Lambda functions, API Gateway, Aurora, Lambda layers

---

## Related Docs

- [`README.md`](README.md) — General setup and quick start
- [`DEMO_ENVIRONMENT.md`](DEMO_ENVIRONMENT.md) — Demo environment details
- [`STAGING_DEPLOYMENT.md`](STAGING_DEPLOYMENT.md) — Staging deployment guide
- [`docs/`](docs/) — Additional portal documentation
- Root [`/Claude.md`](../Claude.md) — Full repo and infrastructure guide
