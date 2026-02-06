# SecureBase Demo Environment Security Configuration

**Last Updated:** February 2, 2026  
**Environment:** demo.securebase.io  
**Status:** Production Demo

---

## Overview

This document outlines the security measures implemented for the SecureBase demo environment at demo.securebase.io. The demo environment is designed to showcase product capabilities while maintaining strong security posture and preventing unauthorized access or data exposure.

## Key Security Principles

1. **Zero Production Data**: Demo environment contains NO real customer data, credentials, or secrets
2. **Defense in Depth**: Multiple layers of security controls
3. **Principle of Least Privilege**: Minimal permissions and access
4. **Transparency**: Clear indicators that this is a demo environment
5. **Isolation**: Complete separation from production infrastructure

---

## Security Controls Implemented

### 1. HTTP Security Headers

All security headers are configured in both `vercel.json` (root marketing site) and `phase3a-portal/netlify.toml` (customer portal demo).

#### Content Security Policy (CSP)
**Purpose:** Prevent XSS attacks by controlling which resources can be loaded

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: https: blob:;
  connect-src 'self' https://*.securebase.io https://*.securebase.com wss://*.securebase.io;
  frame-src 'self' https://js.stripe.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
```

**Note:** `unsafe-inline` and `unsafe-eval` are used for React/Vite compatibility. In production, consider using nonces.

#### X-Frame-Options
**Purpose:** Prevent clickjacking attacks

```
X-Frame-Options: DENY
```

Prevents the demo site from being embedded in iframes.

#### X-Content-Type-Options
**Purpose:** Prevent MIME-type sniffing

```
X-Content-Type-Options: nosniff
```

Forces browsers to respect declared content types.

#### X-XSS-Protection
**Purpose:** Enable browser XSS filters (legacy browsers)

```
X-XSS-Protection: 1; mode=block
```

#### Referrer-Policy
**Purpose:** Control referrer information leakage

```
Referrer-Policy: strict-origin-when-cross-origin
```

Only sends origin on cross-origin requests over HTTPS.

#### Permissions-Policy
**Purpose:** Restrict browser features and APIs

```
Permissions-Policy:
  geolocation=(),
  microphone=(),
  camera=(),
  payment=(),
  usb=(),
  magnetometer=(),
  gyroscope=(),
  accelerometer=(),
  ambient-light-sensor=()
```

Disables unnecessary browser features to reduce attack surface.

#### Strict-Transport-Security (HSTS)
**Purpose:** Force HTTPS connections

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Duration:** 1 year (31536000 seconds)  
**Scope:** All subdomains  
**Preload:** Eligible for browser preload lists

#### Custom Headers
```
X-Environment: demo
X-Robots-Tag: noindex, nofollow
```

- Identifies environment as demo
- Prevents search engine indexing

---

### 2. Authentication & Access Control

#### Mock Authentication Service
**Location:** `phase3a-portal/src/mocks/mockAuth.js`

**Features:**
- **Demo Credentials:** `demo / demo` (safe to ship - no real access)
- **Rate Limiting:** Maximum 5 failed attempts per session
- **Lockout Duration:** 1 minute after exceeding rate limit
- **Session Storage:** Tokens stored in sessionStorage (auto-clear on tab close)
- **No Backend Connection:** Completely isolated from production systems

**Rate Limiting Algorithm:**
```javascript
MAX_ATTEMPTS = 5
LOCKOUT_DURATION = 60000ms (1 minute)

if (failedAttempts >= MAX_ATTEMPTS && timeSinceLastAttempt < LOCKOUT_DURATION) {
  throw RateLimitError(429)
}
```

#### Authentication Adapter
**Location:** `phase3a-portal/src/services/authAdapter.js`

**Configuration:**
```javascript
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';
```

When `VITE_USE_MOCK_API=true`, uses `MockAuthService`. Otherwise, falls back to real auth service (when implemented).

---

### 3. Data Protection

#### Environment Variables
**Production Demo Configuration:**

```bash
# phase3a-portal netlify.toml
VITE_USE_MOCK_API=true          # Enable mock authentication
VITE_ENV=demo                    # Environment identifier
VITE_ANALYTICS_ENABLED=false    # Disable analytics in demo

# Vercel root site
VITE_ENV=demo                    # Environment identifier
```

**Secrets Management:**
- ✅ NO production API keys in demo environment
- ✅ NO real Stripe keys (test keys only, non-functional in demo)
- ✅ NO database credentials exposed
- ✅ All `.env` files properly gitignored

#### Mock Data Safety
All mock data in the demo environment:
- Contains obviously fake names (e.g., "Demo User", "Acme Corp")
- Uses synthetic metrics and trends
- Displays disclaimer banners
- Cannot trigger real AWS operations
- Cannot process real payments

---

### 4. Network Security

#### HTTPS Enforcement
- **All traffic:** HTTPS-only via HSTS header
- **Certificate:** Managed by Netlify/GitHub Pages (automatic renewal)
- **TLS Version:** TLS 1.2+ only
- **Cipher Suites:** Platform-managed (modern, secure ciphers)

#### CORS Configuration
```javascript
connect-src 'self' https://*.securebase.io https://*.securebase.com wss://*.securebase.io
```

Only allows connections to:
- Same origin (`'self'`)
- SecureBase domains (*.securebase.io, *.securebase.com)
- WebSocket connections to SecureBase domains

---

### 5. Monitoring & Incident Response

#### Security Contact
**File:** `public/.well-known/security.txt` (RFC 9116 compliant)

```
Contact: mailto:security@securebase.io
Expires: 2027-12-31T23:59:59.000Z
Canonical: https://demo.securebase.io/.well-known/security.txt
```

#### Logging Strategy
- **Client-side errors:** Captured by browser console (no sensitive data logged)
- **Authentication attempts:** Rate limit tracking in-memory (not persisted)
- **No PII collection:** Demo mode does not collect personally identifiable information

#### Error Handling
- **Generic error messages:** Do not expose system internals
- **Rate limit errors:** Clear user-facing message ("Too many attempts, try again in 1 minute")
- **No stack traces:** Production builds strip debug information

---

### 6. Deployment Security

#### Platform Security Features

**Vercel (Marketing Site):**
- ✅ DDoS protection (Cloudflare network)
- ✅ Automatic HTTPS
- ✅ Edge caching with Cloudflare CDN
- ✅ Automatic security headers
- ✅ Environment isolation

**Netlify (Customer Portal Demo):**
- ✅ DDoS protection
- ✅ Automatic HTTPS with Let's Encrypt
- ✅ CDN with 6+ global PoPs
- ✅ Automatic security headers
- ✅ Branch deploy previews (isolated)

#### Build Security
- **Dependency scanning:** npm audit run on each build
- **No secrets in builds:** Environment variables injected at runtime
- **Immutable deployments:** Each deploy creates new immutable version
- **Rollback capability:** Instant rollback to previous versions

---

### 7. Cache Control

#### Static Assets
```
Cache-Control: public, max-age=31536000, immutable
```

**Applied to:** `/assets/*` (JS, CSS, images)  
**Duration:** 1 year (assets are content-hashed)

#### Dynamic Content
```
Cache-Control: no-cache, no-store, must-revalidate
```

**Applied to:** `/index.html`, API responses  
**Purpose:** Always fetch fresh content

---

## Security Checklist

### Pre-Deployment Verification

- [x] **No production secrets** in environment variables
- [x] **Security headers** configured in netlify.toml
- [x] **Mock authentication** uses demo/demo credentials only
- [x] **Rate limiting** enabled on authentication
- [x] **HTTPS** enforced via HSTS
- [x] **CSP** configured to prevent XSS
- [x] **X-Frame-Options** set to DENY
- [x] **security.txt** file created and accessible
- [x] **Demo banners** visible to users
- [x] **No real data** in demo environment
- [x] **Error messages** don't expose internals
- [x] **Dependencies** scanned for vulnerabilities

### Post-Deployment Verification

- [ ] **SSL certificate** valid and trusted
- [ ] **Security headers** present in HTTP responses
- [ ] **Demo authentication** works correctly
- [ ] **Rate limiting** triggers after 5 failed attempts
- [ ] **CSP** not blocking legitimate resources
- [ ] **security.txt** accessible at /.well-known/security.txt
- [ ] **No console errors** in production build
- [ ] **Lighthouse security score** 100/100
- [ ] **Observatory scan** grade A+

---

## Testing Security

### Manual Testing

```bash
# 1. Test security headers
curl -I https://demo.securebase.io

# Expected headers:
# - Content-Security-Policy
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - Strict-Transport-Security
# - X-Environment: demo

# 2. Test rate limiting
# - Attempt login with wrong password 6 times
# - Should see "Too many attempts" error on 6th try
# - Wait 60 seconds, should be able to try again

# 3. Test CSP
# - Open browser console on demo site
# - Check for CSP violations
# - Should be none (or only intentional unsafe-inline for React)

# 4. Test HSTS
# - Try accessing http://demo.securebase.io
# - Should automatically redirect to https://
```

### Automated Security Scanning

**Tools:**
- **Mozilla Observatory:** https://observatory.mozilla.org
- **Security Headers:** https://securityheaders.com
- **SSL Labs:** https://www.ssllabs.com/ssltest/
- **OWASP ZAP:** For penetration testing

**Expected Results:**
- Observatory: A+ grade
- Security Headers: A grade
- SSL Labs: A+ grade
- ZAP: No high/medium vulnerabilities

---

## Compliance

### Industry Standards
- ✅ **OWASP Top 10:** Protected against major web vulnerabilities
- ✅ **CWE Top 25:** Security controls for common weaknesses
- ✅ **RFC 9116:** security.txt file implemented
- ✅ **CSP Level 3:** Modern CSP directives

### Demo Environment Limitations
**This is a DEMO environment and does NOT provide:**
- SOC 2 compliance (not applicable to demos)
- HIPAA compliance (no PHI data processed)
- PCI DSS compliance (no real payment processing)
- GDPR compliance (no PII collected in demo)

For compliance requirements, see production environment documentation.

---

## Incident Response

### Security Contact
**Email:** security@securebase.io  
**Demo Issues:** demo-support@securebase.io  
**Response Time:** <24 hours

### Escalation Path
1. **Low Severity** (demo bug, UI issue): demo-support@securebase.io
2. **Medium Severity** (potential vulnerability): security@securebase.io
3. **High Severity** (active exploit, data exposure): security@securebase.io + phone call

### Safe Harbor
We welcome responsible security research on the demo environment. Researchers acting in good faith will not face legal action.

**Allowed:**
- Testing demo.securebase.io for vulnerabilities
- Reporting issues via security@securebase.io
- Attempting to bypass rate limiting (it's a demo!)

**Not Allowed:**
- Attacking production infrastructure (portal.securebase.io)
- Denial of service attacks
- Social engineering of SecureBase employees

---

## Maintenance

### Regular Tasks

**Weekly:**
- [ ] Review security headers still present
- [ ] Check for npm dependency vulnerabilities
- [ ] Verify demo authentication working

**Monthly:**
- [ ] Run full security scan (Observatory, Security Headers, SSL Labs)
- [ ] Review and update dependencies
- [ ] Check security.txt expiry date
- [ ] Test rate limiting functionality

**Quarterly:**
- [ ] Full penetration test
- [ ] Review CSP directives for tightening
- [ ] Update this security documentation

---

## References

### Internal Documentation
- [DEMO_HOSTING_READINESS.md](../DEMO_HOSTING_READINESS.md) - Deployment readiness assessment
- [DEMO_AUTH_README.md](../phase3a-portal/DEMO_AUTH_README.md) - Authentication implementation
- [SECURITY.md](../SECURITY.md) - General security policy

### External Standards
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [MDN CSP Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [RFC 9116 security.txt](https://www.rfc-editor.org/rfc/rfc9116.html)
- [CWE Top 25](https://cwe.mitre.org/top25/)

---

**Document Owner:** DevSecOps Team  
**Review Schedule:** Quarterly  
**Next Review:** May 1, 2026
