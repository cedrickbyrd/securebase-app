# Archived Netlify Functions

## securebase-checkout-api.js

**Archived:** April 5, 2026  
**Reason:** Migrated to AWS Lambda for enterprise compliance and cost efficiency

### Why AWS Lambda?
- HIPAA compliance (BAA support)  
- Cost: $2/month vs $2,500/month at enterprise scale  
- CloudTrail audit integration  
- Single-cloud narrative (AWS-only stack)  
- FedRAMP authorization for government customers

### Current Architecture
### Restore Instructions
If you need to switch back to Netlify Functions:

1. Copy function back:
```bash
   cp archived/netlify-functions/securebase-checkout-api.js netlify/functions/
```

2. Install dependencies:
```bash
   npm install stripe --legacy-peer-deps
```

3. Update netlify.toml redirect:
```toml
   [[redirects]]
     from = "/api/checkout"
     to = "/.netlify/functions/securebase-checkout-api"
     status = 200
```

4. Set `STRIPE_SECRET_KEY` environment variable

5. Deploy

### Migration Details
- See MIGRATION_NOTES.md for technical details
- Frontend updated: phase3a-portal/src/pages/Checkout.jsx
- CSP headers updated in netlify.toml for Stripe

---

## demo-auth.js

**Archived:** April 2026  
**Reason:** Migrated to AWS Lambda for HIPAA/FedRAMP compliance and single-cloud consistency

### Why AWS Lambda?
- HIPAA BAA ✅, FedRAMP ✅
- CloudTrail audit integration
- Single-cloud narrative (AWS-only stack)
- Consistent credential management via AWS Secrets Manager

### Current Architecture
- `/api/demo-auth` → `https://api.securebase.tximhotep.com/demo-auth` (AWS Lambda via netlify.toml redirect)
- AWS Lambda handler: `landing-zone/modules/demo-backend/lambda/auth.py`

### Auth Flow Change
- **Before:** HttpOnly JWT cookie (`demo_jwt`) set in `Set-Cookie` response header
- **After:** JWT Bearer token returned in response body as `{ "token": "...", "customer": {...}, "expires_in": 86400 }`

### Restore Instructions
If you need to switch back to the Netlify function:

1. Copy function back:
```bash
   cp archived/netlify-functions/demo-auth.js netlify/functions/
```

2. Install dependencies:
```bash
   npm install jsonwebtoken --legacy-peer-deps
```

3. Update netlify.toml redirect:
```toml
   [[redirects]]
     from = "/api/demo-auth"
     to = "/.netlify/functions/demo-auth"
     status = 200
```

4. Set `JWT_SECRET`, `DEMO_EMAIL`, and `DEMO_PASSWORD` as Netlify environment variables

5. Deploy

### Migration Details
- See MIGRATION_NOTES.md for technical details
- Workflow updated: `.github/workflows/validate-demo.yml`
