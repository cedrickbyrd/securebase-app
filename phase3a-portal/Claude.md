# SecureBase Customer Portal — phase3a-portal

AI coding assistant instructions for the `phase3a-portal` subproject.

---

## Project Overview

React-based multi-tenant customer portal for the SecureBase SaaS platform (TxImhotep LLC). Deployed to Netlify (production) and AWS S3 + CloudFront (demo/staging).

- **Production:** https://securebase.tximhotep.com  
- **Demo (CloudFront):** https://dxft3rdv46wz7.cloudfront.net  
- **API:** https://api.securebase.tximhotep.com  

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | React 18 + React Router 6 |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 + CSS Modules |
| Charts | Chart.js 4 / react-chartjs-2, Recharts |
| Icons | Lucide React, Heroicons |
| HTTP | Axios |
| Animation | Framer Motion |
| Auth | JWT (jwtService.js) + AWS Cognito (demo) |
| Testing | Vitest + React Testing Library + Playwright (E2E) |
| Node | >=20.19.0 |

---

## Directory Structure

```
phase3a-portal/
├── src/
│   ├── components/         # Feature components (see below)
│   │   ├── admin/          # Admin-only views
│   │   ├── charts/         # Reusable chart wrappers
│   │   ├── navigation/     # Nav bar / sidebar
│   │   ├── onboarding/     # Onboarding flow
│   │   ├── signup/         # Signup flow
│   │   └── tenant/         # Tenant-scoped views
│   ├── config/             # App config / feature flags
│   ├── hooks/              # Custom React hooks
│   ├── mocks/              # Mock data for tests
│   ├── pages/              # Route-level page components
│   ├── services/           # API/service layer (see below)
│   ├── styles/             # Global styles
│   ├── test/               # Shared test utilities / setup
│   ├── utils/              # Formatters and helpers
│   ├── App.jsx             # Root component + React Router routes
│   └── main.jsx            # Vite entry point
├── tests/                  # Playwright E2E tests
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

## Key Components

| Component | Purpose |
|-----------|---------|
| `Dashboard.jsx` | Main customer dashboard — metrics, usage, quick actions |
| `Invoices.jsx` | Invoice list, search, PDF download |
| `ApiKeys.jsx` | Create/revoke API keys with scopes |
| `Compliance.jsx` / `ComplianceScreen.jsx` | Compliance framework status & findings |
| `SupportTickets.jsx` | Create tickets, thread comments |
| `Forecasting.jsx` | 12-month cost forecasting with ML |
| `Notifications.jsx` / `NotificationBell.jsx` | Real-time notifications |
| `SREDashboard.jsx` | SRE/ops dashboard (infra health, pipelines, Lambda metrics) |
| `TeamManagement.jsx` | RBAC team member management |
| `AuditLog.jsx` | Immutable compliance audit trail |
| `Login.jsx` | Authentication (API key + Cognito demo mode) |
| `DemoBanner.jsx` | Demo-mode banner with CTAs |
| `ReadOnlyWrapper.jsx` | Disables writes in demo mode |

---

## Key Services

| Service | Purpose |
|---------|---------|
| `api.js` | Axios instance with auth headers |
| `apiService.js` | High-level API call wrappers |
| `mockApiService.js` | Mock backend for demo/test mode |
| `demoApiService.js` | Demo-specific API adapter |
| `authAdapter.js` | Switches between real and demo auth |
| `jwtService.js` | JWT encode/decode/validation |
| `sreService.js` | SRE metrics + `getMockHIPAACompliance()` |
| `notificationService.js` | WebSocket notifications |
| `rbacService.js` | Permission checks |
| `analyticsService.js` | GA4 event tracking |

---

## Environment Variables

All variables are prefixed with `VITE_` (Vite convention).

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | API Gateway base URL |
| `VITE_WS_URL` | WebSocket endpoint |
| `VITE_ENV` | `development` / `staging` / `production` / `demo` |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key |
| `VITE_PILOT_PROGRAM_ENABLED` | Feature flag for pilot features |
| `VITE_ANALYTICS_ENABLED` | Enable GA4 tracking |
| `VITE_HEALTHCARE_PRICE_ID` | Stripe price ID for healthcare tier |
| `VITE_FINTECH_PRICE_ID` | Stripe price ID for fintech tier |
| `VITE_GOVERNMENT_PRICE_ID` | Stripe price ID for government tier |
| `VITE_STANDARD_PRICE_ID` | Stripe price ID for standard tier |

---

## NPM Scripts

```bash
npm run dev           # Vite dev server on :3000
npm run build         # Production build → dist/
npm run build:staging # Staging build (uses .env.staging)
npm run build:demo    # Demo build (uses .env.demo)
npm run preview       # Preview production build
npm run lint          # ESLint (zero warnings policy)
npm run test          # Vitest unit tests
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E tests
```

---

## Demo Mode

- Triggered when `VITE_ENV=demo`
- Auto-login — no credentials required
- All write operations are intercepted by `ReadOnlyWrapper.jsx` and show a toast
- Data served from `demo-data.json` via `demoApiService.js`
- `DemoBanner.jsx` displayed at top with "Start Free Trial" / "Book Demo" CTAs
- Demo data resets every 24 hours

---

## Coding Conventions

- **Components:** Functional components with hooks only; no class components
- **Styling:** Tailwind utility classes preferred; use CSS Modules for complex component-specific styles
- **State:** `useState` / `useEffect` / `useCallback` — avoid prop drilling; use context or service layer for shared state
- **Imports:** Use relative imports within `src/`; no barrel (`index.js`) files unless already present
- **Testing:** Every new component should have a corresponding test in `src/components/__tests__/` or `src/__tests__/`; mock services with `vi.mock()`
- **Security:** Escape all user-sourced HTML with `escHtml()`; never interpolate user input into CSS values; strip query params from analytics events

---

## Deployment

| Environment | Command | Target |
|-------------|---------|--------|
| Staging | `./deploy-staging.sh` | S3: `securebase-phase3a-staging` |
| Demo | `./deploy-demo.sh` | S3: `securebase-phase3a-demo` + CloudFront |
| Production | Netlify (auto on `main` push) | https://securebase.tximhotep.com |

After S3 deploy, invalidate CloudFront:
```bash
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

---

## Compliance & Security Notes

- HIPAA dashboard visible to `healthcare` and `government` tier customers only
- PHI access logs must not include PII in GA4 analytics events
- All auditor-facing HTML reports must use `escHtml()` + CSS whitelists (no string interpolation of user data into style attributes)
- Rate limiting: 100 req/hr per customer enforced server-side

---

## Related Docs

- [`README.md`](README.md) — General setup and deployment
- [`DEMO_ENVIRONMENT.md`](DEMO_ENVIRONMENT.md) — Demo environment details
- [`STAGING_DEPLOYMENT.md`](STAGING_DEPLOYMENT.md) — Staging deployment guide
- [`E2E_TESTING_GUIDE.md`](../E2E_TESTING_GUIDE.md) — End-to-end testing guide
