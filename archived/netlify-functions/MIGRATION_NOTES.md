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
