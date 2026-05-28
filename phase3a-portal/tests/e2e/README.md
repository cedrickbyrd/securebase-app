# SecureBase E2E Smoke Tests

Covers the Customer #1 (Matthew Matturro / TriNetX) full onboarding journey.

## What's tested

| Layer | Tests |
|-------|-------|
| **API contract** | OPTIONS preflight, input validation (400s), error responses, no email enumeration |
| **Netlify proxy** | `/api/auth/*` routes proxy to Lambda (not 404) |
| **SPA routes** | `/login`, `/accept-invite`, `/forgot-password`, `/reset-password` all load |

## Run

```bash
cd phase3a-portal

# Against production (default)
npx playwright test tests/e2e/customer1-journey.spec.js

# Against staging
PORTAL_URL=https://staging.securebase.tximhotep.com \
  npx playwright test tests/e2e/customer1-journey.spec.js

# API only (headless, no browser)
npx playwright test tests/e2e/customer1-journey.spec.js --grep "API contract|proxy"
```

### Customer recovery gate

Use the dedicated operator gate for real customer recovery validation:

```bash
cd phase3a-portal
npm run test:e2e:customer-recovery
```

Detailed setup and interpretation: `tests/e2e/CUSTOMER_RECOVERY_GATE.md`.

## Environment variables

| Var | Default | Description |
|-----|---------|-------------|
| `PORTAL_URL` | `https://portal.securebase.tximhotep.com` | Portal base URL |
| `API_URL` | API Gateway prod endpoint | Direct Lambda URL |
| `SMOKE_EMAIL` | `smoke-test@securebase.tximhotep.com` | Email for full-journey test |
| `TEST_EMAIL` | _(none)_ | Tenant test user email for compliance E2E |
| `TEST_PASSWORD` | _(none)_ | Tenant test user password for compliance E2E |
| `TEST_ADMIN_EMAIL` | _(none)_ | Admin test user email for compliance E2E |
| `TEST_ADMIN_PASSWORD` | _(none)_ | Admin test user password for compliance E2E |

## CI

This test runs in the `e2e-tests.yml` GitHub Actions workflow on every push to `main`.
