# 🎭 SecureBase Demo Environment

**Live Demo:** [https://demo.securebase.io](https://demo.securebase.io)  
**Demo Credentials:** `demo / demo`  
**Status:** ✅ Production Demo

---

## 🎯 Quick Start

### Try the Demo Now

1. **Visit:** [https://demo.securebase.io](https://demo.securebase.io)
2. **Login with:**
   - Username: `demo`
   - Password: `demo`
3. **Explore:** Dashboard, invoices, compliance metrics, API keys

**Note:** This is a fully functional demo with mock data. No credit card required. No signup needed.

---

## 📋 What's in the Demo

### Features Available

✅ **Customer Dashboard**
- Real-time compliance score
- Monthly cost trends
- Usage metrics
- Alert notifications

✅ **Billing & Invoices**
- Historical invoice data
- Cost breakdown by service
- Payment status tracking
- PDF invoice downloads (mock)

✅ **Compliance Reports**
- HIPAA/SOC2/FedRAMP status
- Security Hub findings
- Config rule compliance
- Audit log access

✅ **API Key Management**
- View existing API keys (read-only in demo)
- Key creation UI (simulated, no real keys created)
- Usage statistics per key

✅ **User Interface**
- Full portal navigation
- Responsive design (mobile-friendly)
- Dark/light mode toggle
- Real-time notifications (simulated)

### Features Not Available in Demo

❌ **Read-Only Operations:**
- Cannot create real API keys
- Cannot process real payments
- Cannot modify AWS infrastructure
- Cannot access real customer data

❌ **Backend Integration:**
- Not connected to real AWS Organizations
- No actual compliance scans
- No real billing/invoicing
- No production database access

**Why?** The demo is intentionally isolated to protect production systems and demonstrate UI/UX only.

---

## 🔒 Security

### Demo Environment Safety

**This demo environment is SAFE to use publicly because:**

1. ✅ **No Real Data:** All data is synthetic/mock
2. ✅ **No Production Access:** Completely isolated from production infrastructure
3. ✅ **Public Credentials:** `demo/demo` is intentionally public
4. ✅ **Rate Limited:** Prevents brute force attacks (5 attempts, 1 min lockout)
5. ✅ **Session Timeout:** Auto-logout after 1 hour
6. ✅ **HTTPS Only:** All traffic encrypted via TLS 1.2+
7. ✅ **Security Headers:** CSP, HSTS, X-Frame-Options, etc.

### Security Features Implemented

- **Content Security Policy (CSP)** - Prevents XSS attacks
- **X-Frame-Options: DENY** - Prevents clickjacking
- **HSTS** - Forces HTTPS for 1 year
- **Rate Limiting** - Max 5 login attempts per session
- **Session Management** - Tokens in sessionStorage (auto-clear on tab close)
- **Input Validation** - All user input sanitized
- **Security Headers** - Full suite of modern HTTP security headers

**For details, see:** [DEMO_SECURITY_CONFIG.md](./DEMO_SECURITY_CONFIG.md)

---

## 🏗️ Architecture

### Demo vs. Production

```
┌─────────────────────────────────────────────────────────────┐
│                     DEMO ENVIRONMENT                         │
│  https://demo.securebase.io                                  │
├─────────────────────────────────────────────────────────────┤
│  React Portal (phase3a-portal)                               │
│  ├─ Mock Authentication (demo/demo)                          │
│  ├─ Mock API (static JSON fixtures)                          │
│  ├─ Session Storage (auto-expires)                           │
│  └─ Netlify Hosting (CDN + HTTPS)                            │
└─────────────────────────────────────────────────────────────┘
                            ↕ NO CONNECTION
┌─────────────────────────────────────────────────────────────┐
│                   PRODUCTION ENVIRONMENT                     │
│  https://portal.securebase.io                                │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: AWS Organizations (Terraform)                      │
│  Phase 2: Serverless Backend (Lambda + Aurora)               │
│  Phase 3: Customer Portal (React + Real API)                 │
│  ├─ Real Authentication (API keys)                           │
│  ├─ PostgreSQL Database (RLS)                                │
│  ├─ AWS API Integration                                      │
│  └─ CloudFront + S3 Hosting                                  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack (Demo)

- **Frontend:** React 18, Vite 7.2, Tailwind CSS 4.1
- **Hosting:** Netlify (Free tier)
- **CDN:** Netlify Edge Network (global)
- **SSL:** Let's Encrypt (automatic)
- **Authentication:** Mock service (no backend)
- **Data:** Static JSON fixtures

---

## 🚀 Deployment

### Platforms

The demo environment can be deployed to:

1. **Marketing Site (Root):** Netlify or Vercel ([demo.securebase.io](https://demo.securebase.io))
   - Netlify: `netlify.toml` in repository root
   - Vercel: `vercel.json` in repository root
2. **Customer Portal:** Netlify ([portal-demo.securebase.io](https://portal-demo.securebase.io))
   - Configuration: `phase3a-portal/netlify.toml`

### Environment Variables

```bash
# Demo mode enabled
VITE_USE_MOCK_API=true

# Environment identifier
VITE_ENV=demo

# Analytics disabled
VITE_ANALYTICS_ENABLED=false

# Mock Stripe (non-functional)
VITE_STRIPE_PUBLIC_KEY=pk_test_demo_not_functional
```

### Build Process

```bash
cd phase3a-portal
npm install
npm run build  # Creates production bundle in dist/
```

**Output:**
- `dist/` directory with optimized React bundle
- Code splitting for faster load times
- Assets content-hashed for caching
- Source maps excluded for security

---

## 📊 Monitoring

### Uptime & Performance

- **Uptime Monitoring:** Configured via UptimeRobot (recommended)
- **Check Interval:** Every 5 minutes
- **Alert Email:** demo-support@securebase.io
- **Expected Uptime:** 99.9% (Netlify SLA)

### Security Scanning

**Regular scans recommended:**

- **Mozilla Observatory:** https://observatory.mozilla.org/analyze/demo.securebase.io
  - Target: A+ grade

- **Security Headers:** https://securityheaders.com/?q=demo.securebase.io
  - Target: A grade

- **SSL Labs:** https://www.ssllabs.com/ssltest/analyze.html?d=demo.securebase.io
  - Target: A+ grade

### Performance Metrics

**Lighthouse Targets:**
- Performance: >90
- Best Practices: 100
- SEO: 100 (or N/A if noindex)
- Accessibility: 100

**Load Times:**
- First Contentful Paint: <2s
- Time to Interactive: <3s
- Largest Contentful Paint: <2.5s

---

## 🧪 Testing

### Manual Testing

```bash
# Test demo authentication
1. Visit https://demo.securebase.io
2. Login with demo/demo
3. Should redirect to dashboard
4. Verify demo data displays
5. Test navigation (invoices, compliance, API keys)
6. Logout and verify session cleared

# Test rate limiting
1. Try login with wrong password 6 times
2. Should see "Too many attempts" error on 6th try
3. Wait 60 seconds
4. Should be able to try again
```

### Security Testing

```bash
# Check security headers
curl -I https://demo.securebase.io

# Expected headers:
# - Content-Security-Policy
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - Strict-Transport-Security
# - X-Environment: demo
# - X-Robots-Tag: noindex, nofollow

# Check security.txt
curl https://demo.securebase.io/.well-known/security.txt
```

### Automated Testing

```bash
cd phase3a-portal

# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- DemoAuth.test.jsx
```

---

## 📚 Documentation

### Related Documents

- [DEMO_SECURITY_CONFIG.md](./DEMO_SECURITY_CONFIG.md) - Security implementation details
- [DEMO_DEPLOYMENT_SECURITY_CHECKLIST.md](./DEMO_DEPLOYMENT_SECURITY_CHECKLIST.md) - Pre-deployment verification
- [DEMO_HOSTING_READINESS.md](./DEMO_HOSTING_READINESS.md) - Platform deployment guide
- [phase3a-portal/DEMO_AUTH_README.md](./phase3a-portal/DEMO_AUTH_README.md) - Authentication implementation
- [SECURITY.md](./SECURITY.md) - General security policy

### API Documentation

Mock API endpoints (simulated, no actual backend):

```
GET /api/dashboard/metrics      # Dashboard metrics
GET /api/invoices              # Invoice history
GET /api/compliance/status     # Compliance score
GET /api/keys                  # API keys list
POST /api/auth/login           # Demo authentication
POST /api/auth/logout          # Session cleanup
```

---

## 🆘 Support

### Demo Issues

**Email:** demo-support@securebase.io  
**Response Time:** <24 hours

**Common Issues:**

1. **Can't login with demo/demo**
   - Clear browser cache and cookies
   - Try incognito/private browsing mode
   - Check if rate limited (wait 1 minute)

2. **Rate limited after failed attempts**
   - Wait 60 seconds
   - Clear sessionStorage
   - Try in new browser tab

3. **Dashboard not loading**
   - Check browser console for errors
   - Verify internet connection
   - Try different browser

4. **Security headers not working**
   - Check deployment config (netlify.toml, vercel.json)
   - Verify environment variables set correctly
   - Re-deploy to refresh configuration

### Production Inquiries

**Sales:** sales@securebase.io  
**Security:** security@securebase.io  
**Support:** support@securebase.io

---

## 🎁 Start a Real Trial

**Impressed with the demo?** Get production-ready infrastructure in <10 minutes.

### How to Get Started

1. **Sign Up:** [securebase.io/signup](https://securebase.io/signup)
2. **Choose Tier:**
   - Standard: $2,000/mo (CIS Foundations)
   - Fintech: $8,000/mo (SOC 2 Type II)
   - Healthcare: $15,000/mo (HIPAA)
   - Government: $25,000/mo (FedRAMP)

3. **Deploy:** 7-10 minutes automated deployment
4. **Go Live:** Production-ready AWS infrastructure

### Trial Benefits

✅ **30 days free** - No credit card required  
✅ **50% off** for 6 months (Pilot Program)  
✅ **Full features** - All compliance tiers available  
✅ **Dedicated support** - Engineering team assistance  
✅ **No commitment** - Cancel anytime

**Book a demo call:** [securebase.io/contact](https://securebase.io/contact)

---

## 🔗 Links

### Live Environments
- **Demo:** https://demo.securebase.io
- **Production Signup:** https://securebase.io/signup
- **Marketing Site:** https://securebase.io
- **Documentation:** https://docs.securebase.io

### Resources
- **GitHub:** https://github.com/cedrickbyrd/securebase-app
- **Status Page:** https://status.securebase.io
- **Security Policy:** https://demo.securebase.io/.well-known/security.txt
- **Pricing:** https://securebase.io/pricing

### Social
- **LinkedIn:** [linkedin.com/company/securebase](https://linkedin.com/company/securebase)
- **Twitter:** [@securebase_io](https://twitter.com/securebase_io)
- **Blog:** https://securebase.io/blog

---

## 📝 License

This demo environment showcases SecureBase's commercial product.  
© 2026 SecureBase. All rights reserved.

**Demo Usage:**
- ✅ Product evaluation
- ✅ Sales demonstrations
- ✅ Educational purposes
- ❌ Commercial redistribution
- ❌ Reverse engineering
- ❌ Competitive analysis

---

**Last Updated:** February 2, 2026  
**Demo Version:** 3.0  
**Next Update:** May 1, 2026
