# 🚀 SecureBase Demo - Quick Start Guide

**Goal:** Get a live demo deployed as fast as possible  
**Time Required:** 15 minutes (marketing site) or 2-4 hours (full demo)  
**Skill Level:** Beginner to Intermediate

---

## ⚡ Option 1: Marketing Site Only (15 Minutes)

**What you get:** Professional landing page at https://securebase-demo.netlify.app

### Steps

```bash
# 1. Navigate to repository
cd /path/to/securebase-app

# 2. Install dependencies (5 min)
npm install

# 3. Build the application (2 min)
npm run build

# 4. Deploy to Vercel (5 min)
npx vercel --prod

# 5. Follow Vercel prompts:
#    - Login/signup to Vercel
#    - Link to repository
#    - Confirm deployment settings
#    - Wait for deployment to complete

# 6. Done! Your demo is live at:
#    https://securebase-demo.vercel.app
```

### What's Already Configured

✅ `netlify.toml` with:
- Security headers (CSP, HSTS, X-Frame-Options)
- SPA routing
- Asset caching
- Demo environment variables

✅ Marketing site code ready:
- React components
- Vite build system
- Tailwind CSS styling
- No backend dependencies

---

## 🎯 Option 2: Full Interactive Demo (2-4 Hours)

**What you get:** Complete customer portal with mock data at https://securebase-portal-demo.netlify.app

### Prerequisites

- Option 1 completed (marketing site deployed)
- 2-4 hours available
- Basic JavaScript/React knowledge

### Phase 1: Implement Mock API (2 hours)

#### Step 1: Create Mock Data (30 min)

Create `phase3a-portal/src/mocks/mockData.js`:

```javascript
export const mockCustomer = {
  id: "demo-customer-001",
  name: "Demo Healthcare Corp",
  email: "demo@securebase.io",
  tier: "healthcare",
  framework: "hipaa",
  status: "trial",
  trial_ends: "2026-03-15",
  created_at: "2026-01-01"
};

export const mockInvoices = [
  {
    id: "inv_2026_02",
    month: "February 2026",
    total: 15000,
    status: "paid",
    due_date: "2026-03-01",
    paid_date: "2026-02-28",
    line_items: [
      { service: "HIPAA Compliance Platform", amount: 12000, quantity: 1 },
      { service: "Priority Support", amount: 3000, quantity: 1 }
    ],
    pdf_url: "#"
  },
  {
    id: "inv_2026_01",
    month: "January 2026",
    total: 15000,
    status: "paid",
    due_date: "2026-02-01",
    paid_date: "2026-01-30",
    line_items: [
      { service: "HIPAA Compliance Platform", amount: 12000, quantity: 1 },
      { service: "Priority Support", amount: 3000, quantity: 1 }
    ],
    pdf_url: "#"
  }
];

export const mockMetrics = {
  monthly_cost: 15234,
  cost_trend: "+2.3%",
  cost_change: 342,
  compliance_score: 98,
  compliance_trend: "+1",
  active_alerts: 2,
  alerts_trend: "-3",
  uptime_percentage: 99.97,
  uptime_trend: "+0.02%",
  api_calls_month: 1245678,
  api_calls_trend: "+15.2%",
  cost_breakdown: {
    compliance: 12000,
    support: 3000,
    infrastructure: 234
  },
  cost_history: [
    { month: "Jan", cost: 14892 },
    { month: "Feb", cost: 15234 }
  ]
};

export const mockApiKeys = [
  {
    id: "sk_demo_prod_abc123",
    name: "Production API Key",
    created: "2026-01-15",
    last_used: "2026-02-03",
    status: "active",
    masked_key: "sk_demo_***...***abc123",
    permissions: ["read", "write"],
    usage_count: 45678
  },
  {
    id: "sk_demo_test_xyz789",
    name: "Testing API Key",
    created: "2026-01-20",
    last_used: "2026-02-01",
    status: "active",
    masked_key: "sk_demo_***...***xyz789",
    permissions: ["read"],
    usage_count: 12345
  }
];

export const mockCompliance = {
  score: 98,
  framework: "HIPAA",
  last_scan: "2026-02-03T10:30:00Z",
  findings: {
    critical: 0,
    high: 0,
    medium: 2,
    low: 5
  },
  alerts: [
    {
      severity: "medium",
      title: "S3 Bucket Encryption Review",
      description: "2 buckets require encryption validation",
      date: "2026-01-28",
      resource: "s3://demo-bucket-1",
      recommendation: "Enable AES-256 encryption"
    },
    {
      severity: "low",
      title: "IAM Policy Update Available",
      description: "New CIS benchmark version released",
      date: "2026-01-25",
      resource: "IAM Policy: AdminAccess",
      recommendation: "Review and update to CIS 1.5.0"
    }
  ],
  controls: [
    { name: "Data Encryption", status: "passing", coverage: "100%" },
    { name: "Access Control", status: "passing", coverage: "98%" },
    { name: "Audit Logging", status: "warning", coverage: "95%" },
    { name: "Network Security", status: "passing", coverage: "100%" }
  ]
};
```

#### Step 2: Create Mock API Service (1 hour)

Create `phase3a-portal/src/mocks/MockApiService.js`:

```javascript
import {
  mockCustomer,
  mockInvoices,
  mockMetrics,
  mockApiKeys,
  mockCompliance
} from './mockData';

export class MockApiService {
  constructor() {
    // Simulate network delay
    this.delay = 300; // ms
  }

  // Helper to simulate API calls
  async simulateCall(data) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(data), this.delay);
    });
  }

  // Dashboard Metrics
  async getMetrics(customerId) {
    return this.simulateCall(mockMetrics);
  }

  // Invoices
  async getInvoices(customerId) {
    return this.simulateCall(mockInvoices);
  }

  async getInvoice(customerId, invoiceId) {
    const invoice = mockInvoices.find(inv => inv.id === invoiceId);
    return this.simulateCall(invoice || null);
  }

  async downloadInvoice(customerId, invoiceId) {
    // Simulate PDF download (return mock URL)
    return this.simulateCall({
      url: '#',
      message: 'Demo mode: PDF download not available'
    });
  }

  // API Keys
  async getApiKeys(customerId) {
    return this.simulateCall(mockApiKeys);
  }

  async createApiKey(customerId, name, permissions) {
    // Simulate key creation (return mock key)
    return this.simulateCall({
      error: 'Demo mode: Cannot create real API keys',
      message: 'This is a demo environment. Sign up for a trial to create real API keys.'
    });
  }

  async revokeApiKey(customerId, keyId) {
    return this.simulateCall({
      error: 'Demo mode: Cannot revoke API keys',
      message: 'This is a demo environment.'
    });
  }

  // Compliance
  async getComplianceStatus(customerId) {
    return this.simulateCall(mockCompliance);
  }

  async getComplianceAlerts(customerId) {
    return this.simulateCall(mockCompliance.alerts);
  }

  // Customer
  async getCustomer(customerId) {
    return this.simulateCall(mockCustomer);
  }

  // Authentication (for demo mode)
  async login(username, password) {
    // Demo credentials: demo/demo
    if (username === 'demo' && password === 'demo') {
      return this.simulateCall({
        success: true,
        customer: mockCustomer,
        token: 'demo_token_' + Date.now()
      });
    }
    throw new Error('Invalid credentials. Use demo/demo');
  }

  async logout() {
    return this.simulateCall({ success: true });
  }
}
```

#### Step 3: Update API Service (30 min)

Update `phase3a-portal/src/services/apiService.js`:

```javascript
import { MockApiService } from '../mocks/MockApiService';
import { RealApiService } from './RealApiService'; // Your existing API service

// Check if we're in demo mode
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

// Export the appropriate service
const apiService = USE_MOCK_API ? new MockApiService() : new RealApiService();

export default apiService;
```

### Phase 2: Configure Demo Mode (30 min)

#### Step 1: Create Netlify Configuration

Create `phase3a-portal/netlify.toml`:

```toml
[build]
  base = "phase3a-portal"
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"
  NPM_VERSION = "9"

# SPA routing - redirect all routes to index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Security headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.securebase.io;"

# Cache static assets
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Environment-specific settings
[context.production.environment]
  VITE_ENV = "demo"
  VITE_USE_MOCK_API = "true"
  VITE_API_BASE_URL = "https://demo.securebase.io/api"
  VITE_STRIPE_PUBLIC_KEY = "pk_test_demo_not_functional"
  VITE_ANALYTICS_ENABLED = "true"
  VITE_PILOT_PROGRAM_ENABLED = "false"
```

#### Step 2: Add Demo Banner

Update `phase3a-portal/src/App.jsx` to add a demo banner:

```jsx
function App() {
  const isDemoMode = import.meta.env.VITE_USE_MOCK_API === 'true';

  return (
    <>
      {isDemoMode && (
        <div className="bg-yellow-50 border-b-2 border-yellow-400 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-yellow-800">
                <strong>Demo Mode:</strong> Displaying sample data only. No real infrastructure or billing.
              </span>
            </div>
            <a 
              href="https://securebase.io/signup" 
              className="text-sm font-semibold text-yellow-900 hover:text-yellow-700 underline"
            >
              Start Free Trial →
            </a>
          </div>
        </div>
      )}
      
      {/* Rest of your app */}
    </>
  );
}
```

### Phase 3: Deploy Portal (30 min)

```bash
# 1. Navigate to portal directory
cd phase3a-portal

# 2. Install dependencies (5 min)
npm install

# 3. Build the application (2 min)
npm run build

# 4. Deploy to Netlify (5 min)
npx netlify-cli deploy --prod

# 5. Follow Netlify prompts:
#    - Login/signup to Netlify
#    - Create new site or link existing
#    - Confirm build directory (dist)
#    - Wait for deployment

# 6. Done! Your interactive demo is live at:
#    https://securebase-portal-demo.netlify.app
```

---

## ✅ Verification Checklist

### Marketing Site (Option 1)
- [ ] Site loads at Netlify URL
- [ ] Navigation works (Home, Features, Pricing, etc.)
- [ ] Responsive on mobile and desktop
- [ ] All images and assets load
- [ ] Security headers present (check with curl -I)
- [ ] HTTPS enabled automatically

### Portal Demo (Option 2)
- [ ] Site loads at Netlify URL
- [ ] Demo banner visible at top
- [ ] Login with demo/demo works
- [ ] Dashboard shows mock metrics
- [ ] Invoices page shows mock data
- [ ] API Keys page shows mock keys
- [ ] Compliance page shows mock status
- [ ] Navigation works between pages
- [ ] Mobile responsive
- [ ] Try to create API key shows "demo mode" error
- [ ] Logout works

---

## 🐛 Troubleshooting

### Build Fails

**Issue:** `vite: not found` or similar errors

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Deployment Fails

**Issue:** Netlify deployment errors

**Solutions:**
1. Check build output directory is set to `dist`
2. Verify Node.js version (should be 18+)
3. Check environment variables are set correctly
4. Review deployment logs for specific errors

### Mock API Not Working

**Issue:** Portal shows errors or no data

**Solutions:**
1. Verify `VITE_USE_MOCK_API=true` is set
2. Check browser console for errors
3. Verify mock files are imported correctly
4. Check network tab - should see instant responses (300ms delay)

### Security Headers Missing

**Issue:** Security headers not appearing

**Solutions:**
1. Check `netlify.toml` exists
2. Verify headers configuration syntax
3. Redeploy to refresh configuration
4. Test with: `curl -I https://your-demo-url.com`

---

## 📚 Additional Resources

### Documentation
- [LIVE_DEMO_STATUS.md](./LIVE_DEMO_STATUS.md) - Complete status report
- [DEMO_HOSTING_READINESS.md](./DEMO_HOSTING_READINESS.md) - Detailed deployment guide
- [DEMO_README.md](./DEMO_README.md) - Demo user guide
- [DEMO_SECURITY_CONFIG.md](./DEMO_SECURITY_CONFIG.md) - Security implementation

### Platform Guides
- Netlify: https://docs.netlify.com
- Vite: https://vitejs.dev/guide

### Support
- Demo Issues: See DEMO_README.md
- Deployment Help: See DEMO_HOSTING_READINESS.md Section 8
- Code Issues: Check GitHub Issues

---

## 🎯 Success Metrics

After deployment, verify:

### Performance
- [ ] Lighthouse score >90 (Performance)
- [ ] First Contentful Paint <2s
- [ ] Time to Interactive <3s

### Security
- [ ] All security headers present
- [ ] HTTPS enabled
- [ ] CSP properly configured
- [ ] No mixed content warnings

### Functionality
- [ ] All pages load correctly
- [ ] Navigation works smoothly
- [ ] Mock data displays properly
- [ ] Demo mode indicators visible
- [ ] CTAs point to real signup

---

## 💡 Pro Tips

1. **Test Locally First**
   ```bash
   npm run dev  # Test before deploying
   ```

2. **Use Preview Deployments**
   - Netlify offers preview deployments
   - Test changes before going to production

3. **Monitor Performance**
   - Use Lighthouse CI
   - Set up Uptime Robot for monitoring
   - Track with Google Analytics

4. **Iterate Based on Feedback**
   - Watch for user behavior patterns
   - Track conversion rates
   - Gather feedback from demo users

5. **Keep It Updated**
   - Refresh mock data periodically
   - Update pricing and features
   - Keep dependencies current

---

## ⏱️ Time Breakdown

| Task | Time | Complexity |
|------|------|-----------|
| **Option 1: Marketing Site** | | |
| Install dependencies | 5 min | Easy |
| Build application | 2 min | Easy |
| Deploy to Netlify | 5 min | Easy |
| Verify deployment | 3 min | Easy |
| **Total Option 1** | **15 min** | **Easy** |
| | | |
| **Option 2: Full Demo** | | |
| Create mock data | 30 min | Medium |
| Create mock API service | 60 min | Medium |
| Update API service | 30 min | Medium |
| Create Netlify config | 15 min | Easy |
| Add demo banner | 15 min | Easy |
| Install dependencies | 5 min | Easy |
| Build application | 2 min | Easy |
| Deploy to Netlify | 5 min | Easy |
| Testing and verification | 15 min | Easy |
| **Total Option 2** | **2-3 hours** | **Medium** |

---

**Quick Start Guide Version:** 1.0  
**Last Updated:** February 3, 2026  
**Maintained By:** SecureBase Team
