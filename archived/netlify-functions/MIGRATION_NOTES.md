# Migration: Netlify Functions → AWS Lambda

**Date:** April 5, 2026

## Changes

### API Endpoint
- **Before:** `/.netlify/functions/securebase-checkout-api`
- **After:** `/api/checkout` → AWS Lambda (via netlify.toml redirect)

### Request Parameters
- **Before:** `customer_email`, `price_id`, `plan_name`
- **After:** `email`, `name`, `priceId`

### Files Modified
1. `netlify.toml` - Updated redirect, added CSP headers for Stripe
2. `phase3a-portal/src/pages/Checkout.jsx` - Updated API call, added name field
3. Removed: `netlify/functions/securebase-checkout-api.js`

## Cost Comparison
| Volume | Netlify Functions | AWS Lambda | Savings |
|--------|-------------------|------------|---------|
| 1M/mo  | $250             | $0.20      | 99.92%  |
| 10M/mo | $2,500           | $2         | 99.92%  |

## Compliance
- AWS Lambda: HIPAA BAA ✅, FedRAMP ✅
- Netlify Functions: HIPAA BAA ❌, FedRAMP ❌

## Testing
- AWS Lambda endpoint tested: ✅
- CSP headers verified: ✅
- Frontend integration: ✅
- End-to-end checkout: Pending browser test

---

## demo-auth.js — Migrated to AWS Lambda (April 2026)

### API Endpoint
- **Before:** `/.netlify/functions/demo-auth` (via `/api/demo-auth` redirect in netlify.toml)
- **After:** `/api/demo-auth` → `https://api.securebase.tximhotep.com/demo-auth` (AWS Lambda via netlify.toml redirect)

### Auth Flow Change
- **Before:** HttpOnly JWT cookie (`demo_jwt`) set in `Set-Cookie` response header
- **After:** JWT Bearer token returned in response body as `{ "token": "...", "customer": {...}, "expires_in": 86400 }`

### Credentials Change
- **Before:** `DEMO_EMAIL` / `DEMO_PASSWORD` env vars (default: `demo@securebase.tximhotep.com` / `SecureBaseDemo2026!`)
- **After:** Seeded demo accounts in AWS Lambda (`landing-zone/modules/demo-backend/lambda/auth.py`):
  - `admin@healthcorp.example.com` / `demo-healthcare-2026`
  - `admin@fintechai.example.com` / `demo-fintech-2026`
  - `admin@startupmvp.example.com` / `demo-standard-2026`

### Files Modified
1. `netlify.toml` — redirect updated from `/.netlify/functions/demo-auth` to `https://api.securebase.tximhotep.com/demo-auth`
2. Archived: `netlify/functions/demo-auth.js` → `archived/netlify-functions/demo-auth.js`
3. `.github/workflows/validate-demo.yml` — updated "Verify JWT demo auth cookie" step

### Why AWS Lambda?
- HIPAA BAA ✅, FedRAMP ✅
- CloudTrail audit integration
- Single-cloud narrative (AWS-only stack)
- Consistent credential management via AWS Secrets Manager

---

## demo-auth.js — Re-archival after PR #523 reversion (April 2026)

### Context
PR #523 (merged 2026-04-15 while still marked `[WIP]`) reintroduced a
Netlify function at `phase3a-portal/netlify/functions/demo-auth.js` and
rerouted `/api/demo-auth` away from the AWS Lambda and back to Netlify.
This reversed the April 5 migration above and violated the cost /
compliance policy in `.github/copilot-instructions.md` (Cost Optimization:
Avoid Netlify Functions).

Daily validation (issue #524) continued to fail because the new Netlify
function required `JWT_SECRET` or `RSA_PRIVATE_KEY` which was never set
on the Netlify site, so every login attempt returned HTTP 500.

### Reversion
- Both `netlify.toml` files restored: `/api/demo-auth` → `https://api.securebase.tximhotep.com/demo-auth`
- `phase3a-portal/netlify/functions/demo-auth.js` re-archived to this directory
- Overwrites the April 5 archival with the more complete 5-account implementation from PR #523 for reference only — it MUST NOT be re-deployed as a Netlify function.

### Remaining work
The AWS Lambda itself was returning HTTP 403 at the time PR #523 was opened
(see PR #523 description). That root cause was never diagnosed — PR #523
sidestepped it by introducing a second, unauthorised implementation.
Tracked in companion diagnostic issue filed alongside the reversion PR.

### Policy reminder
Per `.github/copilot-instructions.md`:
> Do NOT introduce new Netlify Functions. Existing functions are
> grandfathered but should be migrated opportunistically.

`demo-auth` was already migrated. Any future change to this endpoint MUST
be made on the AWS Lambda (`landing-zone/modules/demo-backend/lambda/auth.py`)
and exposed via the existing netlify.toml redirect.
