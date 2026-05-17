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
| **Auth** | AWS Lambda (`/api/signup`) | **AWS Lambda JWT** via API Gateway |
| `@supabase/supabase-js` | ❌ removed (PR #508) | ❌ NOT used — do NOT add |
| **`package.json`** | `/package.json` | `phase3a-portal/package.json` |
| **Deploy** | Netlify (root) | Netlify (`securebase-portal` site) |

**Never conflate the two.** Running `npm install` at the repo root does NOT install portal dependencies.

---

## Identity

- **What it is:** Multi-tenant customer portal for the SecureBase SaaS platform (TxImhotep LLC)
- **Production:** https://portal.securebase.tximhotep.com (Netlify site: `securebase-portal`, ID: `d9e565ff-5b33-4e21-b461-fbe24851f1bd`)
- **Demo:** https://demo.securebase.tximhotep.com (Netlify site: `securebase-demo`)
- **API:** https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod (proxied via `/api/*` in `_redirects`)
- **Own config files:** `package.json`, `package-lock.json`, `vite.config.js`, `tailwind.config.js`, `vitest.config.js`, `playwright.config.js`

---

## Auth Architecture

> **Portal auth = AWS Lambda JWT via API Gateway. No Supabase.**

- `Login.jsx` calls `apiService.authenticate(email, password)` → POST `/api/auth/login` → Netlify proxy → API Gateway → `securebase-production-auth-v2` Lambda
- JWT stored in `sessionStorage` as `sessionToken`
- `App.jsx` reads `sessionStorage.getItem('sessionToken')` or `localStorage.getItem('sessionToken')` to determine `isAuthenticated`
- Demo mode (`VITE_DEMO_MODE=true`) auto-login via `demoApiService.js` — stores `demo_mode=true` in `localStorage`
- `authAdapter.js` and `jwtService.js` handle JWT encode/decode/validation
- **Do NOT add Supabase** — it is not used and not installed

### API Gateway (prod stage)
| Route | Resource ID | Lambda |
|-------|------------|--------|
| POST /auth/login | `ogsr28` | `securebase-production-auth-v2` |
| POST /auth/register | `mbndhd` | `securebase-production-auth-v2` |
| POST /auth/invite | `0dwugx` | `securebase-production-auth-v2` |
| POST /auth/accept-invite | `2eq116` | `securebase-production-auth-v2` |
| POST /auth/forgot-password | `eygv1k` | `securebase-production-auth-v2` |
| POST /auth/reset-password | `wt3dik` | `securebase-production-auth-v2` |
| POST /auth/mfa/setup | `h4upcf` | `securebase-production-auth-v2` |
| POST /auth/mfa/verify | `ukslk6` | `securebase-production-auth-v2` |

### Netlify proxy (`public/_redirects`)
All `/api/auth/*` routes proxy to API Gateway with `200!` force flag.
SPA fallback `/* /index.html 200` must be last.

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
| Auth | **AWS Lambda JWT** | No Supabase — see Auth Architecture above |
| PDF | `jspdf` + `html2canvas` | |
| Testing | Vitest + React Testing Library + Playwright | |
| Node | >=20.19.0 | |

---

## Package Management Rules

```bash
# ✅ ALWAYS cd into the portal directory first
cd phase3a-portal

# ✅ Install packages locally with --legacy-peer-deps (required for chart.js)
npm install <package> --legacy-peer-deps

# ✅ Commit the lock file after every install
git add package-lock.json

# ❌ NEVER run npm install from the repo root expecting it to affect the portal
# ❌ NEVER add @supabase/supabase-js — it is not used here
# ❌ NEVER use npm ci locally — CI only
```

---

## Deployment

| Environment | Site | How to deploy |
|-------------|------|---------------|
| Production | `securebase-portal` (`d9e565ff`) | `NETLIFY_SITE_ID=d9e565ff-5b33-4e21-b461-fbe24851f1bd npx netlify deploy --prod` |
| Demo | `securebase-demo` (`e2653a23`) | `NETLIFY_SITE_ID=e2653a23-41aa-41bd-81a3-7195a455f1ab npx netlify deploy --prod` |
| GitHub Actions | `deploy-phase3a-production.yml` | `workflow_dispatch` — type `DEPLOY TO PRODUCTION` |

**Always deploy from `phase3a-portal/` directory. Never deploy from repo root.**

---

## Directory Structure

```
phase3a-portal/
├── src/
│   ├── components/         # Feature components (see Component Map below)
│   ├── config/             # App config / feature flags
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Route-level page components
│   ├── services/           # API/service layer
│   ├── styles/             # Global styles
│   ├── utils/              # Formatters, helpers, analytics.js
│   ├── App.jsx             # Root component + React Router routes
│   └── main.jsx            # Vite entry point
├── tests/e2e/              # Playwright E2E tests
├── public/
│   └── _redirects          # Netlify proxy rules — MUST be here for Vite to copy to dist/
├── netlify.toml            # Build config + redirect rules
└── playwright.config.js    # Firefox-only locally; all browsers on CI
```

---

## Component Map

| Component | Location | Purpose |
|-----------|----------|---------|
| `Login.jsx` | `components/` | Lambda JWT auth — inputs use `id="email"` and `id="password"` |
| `AcceptInvite.jsx` | `components/` | Token-based account activation |
| `ForgotPassword.jsx` | `components/` | Password reset request |
| `ResetPassword.jsx` | `components/` | Token-based password reset |
| `Dashboard.jsx` | `components/` | Main tenant dashboard |
| `AdminDashboard.jsx` | `components/admin/` | Executive/admin metrics |
| `SystemHealth.jsx` | `components/admin/` | Real-time system health widget |
| `SREDashboard.jsx` | `components/` | SRE/ops dashboard — memory metric accent `#9333EA` do NOT change |
| `SREDashboardWrapper.jsx` | `components/` | Route wrapper for SREDashboard |
| `TenantDashboard.jsx` | `components/tenant/` | Per-tenant compliance, usage, cost |
| `ComplianceDrift.jsx` | `components/tenant/` | 90-day compliance drift timeline |
| `HIPAADashboard.jsx` | `components/` | HIPAA compliance dashboard |
| `Compliance.jsx` | `components/` | Compliance framework status |
| `AlertManagement.jsx` | `components/` | Alert management |
| `TeamManagement.jsx` | `components/` | RBAC team member management |
| `Invoices.jsx` | `components/` | Invoice list, PDF download |
| `SupportTickets.jsx` | `components/` | Support ticket threads |
| `Webhooks.jsx` | `components/` | Webhook configuration |
| `ApiKeys.jsx` | `components/` | API key management |
| `AuditLog.jsx` | `components/` | Immutable compliance audit trail |
| `DemoBanner.jsx` | `components/` | Demo-mode banner |
| `ReadOnlyWrapper.jsx` | `components/` | Disables writes in demo mode |

---

## Services Map

| Service | File | Purpose |
|---------|------|---------|
| API client | `api.js` | Axios instance with auth headers |
| API wrappers | `apiService.js` | Calls `VITE_API_BASE_URL` — uses `/api/auth/*` proxy in production |
| Auth abstraction | `authAdapter.js` | Routes between real Lambda auth and demo auth |
| JWT handling | `jwtService.js` | JWT encode/decode/validation + `loginDemo()` |
| RBAC | `rbacService.js` | Permission checks |
| Admin metrics | `adminService.js` | Admin API — mock via `VITE_USE_MOCK_API=true` |
| SRE metrics | `sreService.js` | SRE metrics |
| Mock API | `mockApiService.js` | Mock backend for demo/test mode |
| Demo API | `demoApiService.js` | Demo-specific adapter |
| Analytics | `analyticsService.js` | GA4 (strips PII from events) |

---

## Environment Variables

```env
# API — in production VITE_API_BASE_URL should be blank or /api so proxy is used
VITE_API_BASE_URL=https://api.securebase.tximhotep.com
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com

# Feature flags
VITE_ENV=development
VITE_DEMO_MODE=false
VITE_USE_MOCK_API=false
VITE_ANALYTICS_ENABLED=true
VITE_PILOT_PROGRAM_ENABLED=false

# Stripe
VITE_STRIPE_PUBLIC_KEY=pk_live_...
```

---

## ❌ Do NOT Rules

| Rule | Why |
|------|-----|
| Do NOT add `@supabase/supabase-js` anywhere | Not used — portal auth is Lambda JWT |
| Do NOT install packages from repo root | Wrong `node_modules` scope |
| Do NOT create new Netlify Functions | Use AWS Lambda + API Gateway + `netlify.toml` redirect |
| Do NOT call `/.netlify/functions/` directly | Use `/api/` proxy path |
| Do NOT deploy portal from repo root | Use `cd phase3a-portal` first |
| Do NOT deploy to `securebase-demo` site for portal | Use `securebase-portal` site ID `d9e565ff` |
| Do NOT change `SREDashboard.jsx` memory metric accent color (`#9333EA`) | Design spec |
| Do NOT use inline styles (`style={{}}`) | Tailwind utility classes only |
| Do NOT use class components | Functional components only |
| Do NOT recreate existing components | Check Component Map first |

---

## E2E Tests

```bash
cd phase3a-portal
npx playwright test tests/e2e/customer1-comprehensive.spec.js --reporter=list
```

- Runs firefox only locally (Mac 10.15 limitation)
- All 5 browsers on CI (`CI=true`)
- 74 tests across 7 suites covering Lambda API, CORS, proxy, SPA routes, and Customer #1 pilot flows

---

## Compliance & Security Notes

- HIPAA dashboard visible to `healthcare` and `government` tier only
- PHI never logged — `analyticsService.js` strips query params from GA4 events
- Rate limiting: 100 req/hr per customer enforced server-side in Lambda
- All auditor-facing HTML uses `escHtml()` — no string interpolation of user data into style attributes
- **Customer PII (names, emails, tokens) must never appear in repo files, issues, or commit messages**
