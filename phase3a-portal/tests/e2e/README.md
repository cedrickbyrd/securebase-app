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

## Environment variables

| Var | Default | Description |
|-----|---------|-------------|
| `PORTAL_URL` | `https://portal.securebase.tximhotep.com` | Portal base URL |
| `API_URL` | API Gateway prod endpoint | Direct Lambda URL |
| `SMOKE_EMAIL` | `smoke-test@securebase.tximhotep.com` | Email for full-journey test |

## CI

This test runs in the `e2e-tests.yml` GitHub Actions workflow on every push to `main`.
