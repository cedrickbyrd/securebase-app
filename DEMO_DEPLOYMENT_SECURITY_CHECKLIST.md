# Demo Environment Deployment Security Checklist

**Use this checklist before deploying the demo environment to production.**

---

## Pre-Deployment Checks

### 1. Environment Configuration
- [ ] `VITE_USE_MOCK_API=true` is set in deployment config
- [ ] `VITE_ENV=demo` is set
- [ ] `VITE_ANALYTICS_ENABLED=false` (optional, but recommended for demo)
- [ ] NO production API keys in environment variables
- [ ] NO production database credentials exposed
- [ ] NO real Stripe keys (use test keys if needed, but non-functional in demo mode)

### 2. Code Security
- [ ] All `.env` files are gitignored
- [ ] No secrets committed in git history
- [ ] No hardcoded credentials in code
- [ ] Mock authentication uses `demo/demo` credentials only
- [ ] Rate limiting enabled on authentication (5 attempts, 1 min lockout)
- [ ] Error messages don't expose system internals

### 3. Security Headers
- [ ] `vercel.json` includes security headers (root site)
- [ ] `phase3a-portal/netlify.toml` includes security headers (portal)
- [ ] Content-Security-Policy configured
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Strict-Transport-Security (HSTS) enabled
- [ ] Permissions-Policy restricts unnecessary features
- [ ] X-Robots-Tag: noindex, nofollow

### 4. Demo Indicators
- [ ] Demo mode banner visible on portal
- [ ] "Demo Mode Active" indicator on login page
- [ ] Demo credentials hint shown to users
- [ ] Disclaimers about mock data present
- [ ] "Start Real Trial" CTA available

### 5. Data Safety
- [ ] All demo data is obviously fake (e.g., "Demo User", "Acme Corp")
- [ ] No real customer information in mock data
- [ ] Payment processing disabled in demo mode
- [ ] API key creation disabled or read-only in demo mode
- [ ] No connections to real AWS infrastructure

### 6. Files & Assets
- [ ] `public/.well-known/security.txt` exists
- [ ] security.txt has valid contact email
- [ ] security.txt expiry date is in the future
- [ ] Demo mode assets built correctly (`npm run build`)
- [ ] No development dependencies in production bundle

---

## Deployment Checks

### 7. Platform Configuration

#### For Vercel (Marketing Site)
- [ ] Repository connected to Vercel
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Environment variable `VITE_ENV=demo` set
- [ ] Custom domain configured (if applicable)
- [ ] HTTPS enabled (automatic)

#### For Netlify (Customer Portal)
- [ ] Repository connected to Netlify
- [ ] Base directory: `phase3a-portal`
- [ ] Build command: `npm run build`
- [ ] Publish directory: `dist`
- [ ] `netlify.toml` detected and used
- [ ] Environment variables set via netlify.toml
- [ ] Custom domain configured (if applicable)
- [ ] HTTPS enabled (automatic)

### 8. Build Verification
- [ ] Build completes successfully (no errors)
- [ ] No build warnings about missing env vars
- [ ] Bundle size reasonable (<5MB for main bundle)
- [ ] Source maps disabled in production
- [ ] Console logs removed from production build

---

## Post-Deployment Verification

### 9. Functionality Testing
- [ ] Demo site loads without errors
- [ ] Can login with `demo/demo` credentials
- [ ] Rate limiting works (fails after 5 wrong attempts)
- [ ] Session expires correctly (1 hour)
- [ ] Logout functionality works
- [ ] Demo data displays correctly
- [ ] No 404 errors on navigation

### 10. Security Testing

#### HTTP Headers Test
```bash
curl -I https://demo.securebase.io
```
- [ ] `Content-Security-Policy` header present
- [ ] `X-Frame-Options: DENY` present
- [ ] `X-Content-Type-Options: nosniff` present
- [ ] `Strict-Transport-Security` present
- [ ] `X-Environment: demo` present
- [ ] `X-Robots-Tag: noindex, nofollow` present

#### SSL/TLS Test
```bash
# Check SSL certificate
openssl s_client -connect demo.securebase.io:443 -servername demo.securebase.io
```
- [ ] Valid SSL certificate (not self-signed)
- [ ] Certificate not expired
- [ ] TLS 1.2 or higher
- [ ] Strong cipher suites only

#### security.txt Test
```bash
curl https://demo.securebase.io/.well-known/security.txt
```
- [ ] File accessible and returns 200 OK
- [ ] Contains valid contact email
- [ ] Expiry date in future
- [ ] Canonical URL matches actual URL

#### CSP Test
- [ ] Open browser console on demo site
- [ ] Navigate through all pages
- [ ] Check for CSP violation errors
- [ ] Fix any violations or whitelist if intentional

### 11. Browser Testing
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### 12. Performance Testing
- [ ] Lighthouse score >90 for Performance
- [ ] Lighthouse score 100 for Best Practices
- [ ] Lighthouse score 100 for SEO (or N/A if noindex)
- [ ] Lighthouse score 100 for Accessibility
- [ ] First Contentful Paint <2s
- [ ] Time to Interactive <3s

---

## Security Scanning

### 13. Automated Security Tools

#### Mozilla Observatory
```
https://observatory.mozilla.org/analyze/demo.securebase.io
```
- [ ] Grade: A+ or A
- [ ] No failed tests
- [ ] All recommended headers present

#### Security Headers
```
https://securityheaders.com/?q=demo.securebase.io
```
- [ ] Grade: A or better
- [ ] CSP grade: A
- [ ] All headers scored

#### SSL Labs
```
https://www.ssllabs.com/ssltest/analyze.html?d=demo.securebase.io
```
- [ ] Overall grade: A or A+
- [ ] Certificate: Trusted
- [ ] Protocol support: TLS 1.2+
- [ ] Key exchange: Strong
- [ ] Cipher strength: Strong

### 14. Dependency Security
```bash
cd phase3a-portal
npm audit
```
- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities
- [ ] Medium vulnerabilities assessed and documented
- [ ] Dependencies up to date (within 1 major version)

---

## Monitoring Setup

### 15. Uptime Monitoring
- [ ] Uptime monitoring configured (UptimeRobot, Pingdom, etc.)
- [ ] Monitor URL: `https://demo.securebase.io`
- [ ] Check interval: 5 minutes
- [ ] Alert email configured
- [ ] Alert threshold: 2 consecutive failures

### 16. Error Tracking
- [ ] Error tracking tool configured (Sentry, Rollbar, etc.)
- [ ] Demo environment errors sent to separate project
- [ ] Source maps uploaded for debugging
- [ ] Alert thresholds configured
- [ ] Team notifications set up

### 17. Analytics (Optional)
- [ ] Analytics tool configured (if VITE_ANALYTICS_ENABLED=true)
- [ ] Privacy-friendly analytics (Plausible, Simple Analytics)
- [ ] Demo traffic separated from production
- [ ] No PII collected
- [ ] Cookie consent not required (no tracking cookies)

---

## Documentation

### 18. Update Documentation
- [ ] README.md updated with demo URL
- [ ] DEMO_SECURITY_CONFIG.md reviewed and current
- [ ] API documentation reflects demo mode
- [ ] Team notified of deployment
- [ ] Runbook updated with demo environment details

### 19. Communication
- [ ] Stakeholders notified of demo URL
- [ ] Demo credentials shared with sales team
- [ ] Demo limitations documented
- [ ] Support team trained on demo vs. production
- [ ] Demo environment added to status page

---

## Final Sign-Off

### Pre-Production
- [ ] All checklist items completed
- [ ] Security team approval
- [ ] Product team approval
- [ ] No blockers or critical issues

### Production Deployment
- [ ] Deployment initiated
- [ ] Deployment successful
- [ ] Smoke tests passed
- [ ] Monitoring shows healthy status
- [ ] Demo URL accessible to public

### Post-Deployment
- [ ] Demo URL tested by 3+ team members
- [ ] Security scan results documented
- [ ] Any issues logged in issue tracker
- [ ] Deployment notes added to changelog
- [ ] Team celebration! 🎉

---

## Rollback Plan

**If deployment fails or critical issues discovered:**

### Vercel Rollback
1. Go to Vercel dashboard
2. Navigate to Deployments
3. Find previous working deployment
4. Click "Promote to Production"
5. Verify rollback successful

### Netlify Rollback
1. Go to Netlify dashboard
2. Navigate to Deploys
3. Find previous published deploy
4. Click "Publish deploy"
5. Verify rollback successful

### Emergency Contact
- **DevOps Lead:** devops@securebase.io
- **Security Lead:** security@securebase.io
- **On-Call:** [on-call phone number]

---

## Review & Updates

**Checklist Owner:** DevSecOps Team  
**Last Updated:** February 2, 2026  
**Next Review:** Quarterly (May 2026)  
**Version:** 1.0

---

## Notes

Use this space to document deployment-specific notes, issues encountered, or deviations from the checklist:

```
Deployment Date: __________
Deployed By: __________
Platform: Vercel / Netlify (circle one)
URL: https://demo.securebase.io

Notes:
- 
- 
- 

Issues:
- 
- 

Sign-off:
Security: __________ Date: __________
DevOps:   __________ Date: __________
Product:  __________ Date: __________
```
