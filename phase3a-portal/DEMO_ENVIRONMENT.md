# SecureBase Demo Environment

## Overview

The SecureBase demo environment provides a fully functional, pre-populated version of the Phase 3a Customer Portal that prospects can explore without signing up. This is a read-only environment with realistic sample data that showcases the platform's capabilities.

**Demo URL:** [http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com](http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com)

**Custom Domain (when configured):** [https://demo.securebase.io](https://demo.securebase.io)

---

## Features

### ✅ What's Included

- **Auto-Login**: No signup required - visitors are automatically logged in
- **Read-Only Mode**: All write operations are disabled with friendly toast notifications
- **Sample Data**: 
  - 5 mock customers across all tiers (Healthcare, Fintech, Government, Standard)
  - 30+ invoices with various statuses (paid, issued, overdue, draft)
  - Compliance metrics and findings
  - API keys, webhooks, support tickets
  - Cost forecasting data
- **Demo Banner**: Prominent banner at top indicating demo mode with CTAs
- **CTAs**: Strategic placement of "Start Free Trial" and "Book Demo" buttons
- **Auto-Reset**: Data automatically resets every 24 hours

### 🚫 Limitations

- **No Write Operations**: Users cannot create, edit, or delete anything
- **No Real Data**: All data is fictional and for demonstration purposes only
- **No Email/Notifications**: Email and webhook integrations are disabled
- **Session Expiration**: Demo sessions expire after 7 days
- **No Payment Processing**: Stripe integration is in test mode only

---

## Sample Data Overview

### Mock Customers

1. **HealthCorp Medical Systems**
   - Tier: Healthcare ($15,000/month)
   - Framework: HIPAA
   - Accounts: 45
   - Status: Active since Nov 2025

2. **FinTechAI Analytics**
   - Tier: Fintech ($8,000/month)
   - Framework: SOC 2 Type II
   - Accounts: 28
   - Status: Active since Dec 2025

3. **StartupMVP Inc**
   - Tier: Standard ($2,000/month)
   - Framework: CIS Foundations
   - Accounts: 5
   - Status: Active since Jan 2026

4. **GovContractor Defense Solutions**
   - Tier: Government ($25,000/month)
   - Framework: FedRAMP Low
   - Accounts: 120
   - Status: Active since Oct 2025

5. **SaaSPlatform Cloud Services**
   - Tier: Fintech ($8,000/month)
   - Framework: SOC 2 Type II
   - Accounts: 35
   - Status: Active since Nov 2025

### Dashboard Metrics

- **Total Customers**: 5
- **Monthly Revenue**: $58,240
- **Compliance Score**: 92%
- **Active Alerts**: 3
- **API Requests**: 3.45M this month
- **Uptime**: 99.87%

### Invoices

- 30 total invoices spanning 6+ months
- Mix of statuses: paid, issued, overdue, draft
- Various line items: base pricing, add-ons, prorated charges
- Total revenue tracked: ~$400K+

---

## Deployment

### Prerequisites

- Node.js 18+
- AWS CLI configured with credentials
- S3 bucket access (us-east-1 region)

### Quick Deploy

```bash
cd phase3a-portal
./deploy-demo.sh
```

### Manual Deployment

```bash
# 1. Install dependencies
npm install

# 2. Build for demo
cp .env.demo .env
npm run build -- --mode demo

# 3. Copy demo data
cp demo-data.json dist/demo-data.json

# 4. Deploy to S3
aws s3 sync dist/ s3://securebase-phase3a-demo/ \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "*.html" --exclude "*.json"

aws s3 sync dist/ s3://securebase-phase3a-demo/ \
  --exclude "*" --include "*.html" --include "*.json" \
  --cache-control "no-cache,no-store,must-revalidate"
```

### GitHub Actions Deployment

The demo environment automatically deploys on pushes to `main` or `feature/sales-enablement` branches:

**Workflow:** `.github/workflows/deploy-phase3a-demo.yml`

**Trigger manually:**
```bash
gh workflow run deploy-phase3a-demo.yml
```

---

## Configuration

### Environment Variables (.env.demo)

```env
# Demo mode settings
VITE_DEMO_MODE=true
VITE_READ_ONLY_MODE=true
VITE_SHOW_DEMO_BANNER=true

# Auto-reset configuration
VITE_AUTO_RESET_ENABLED=true
VITE_RESET_INTERVAL_HOURS=24
VITE_DEMO_SESSION_DURATION_DAYS=7

# CTAs
VITE_DEMO_CTA_TRIAL_URL=https://portal.securebase.io/signup
VITE_DEMO_CTA_BOOK_DEMO_URL=https://calendly.com/securebase/demo
VITE_DEMO_CTA_CONTACT_SALES=mailto:sales@securebase.io
```

### Customizing Demo Data

Edit `phase3a-portal/demo-data.json` to update:
- Customer profiles
- Invoice history
- Compliance metrics
- API keys
- Support tickets
- Webhooks
- Cost forecasts

After editing, redeploy:
```bash
./deploy-demo.sh
```

---

## Testing the Demo

### Validation Checklist

- [ ] Demo URL is accessible (HTTP 200)
- [ ] Demo banner is visible at top
- [ ] Auto-login works (no login page shown)
- [ ] Dashboard loads with sample metrics
- [ ] All 5 customers appear in data
- [ ] Invoices page shows 30+ invoices
- [ ] Compliance page shows framework scores
- [ ] Read-only mode prevents edits
- [ ] "Create" buttons show toast notification
- [ ] "Start Free Trial" CTA works
- [ ] "Book Demo" CTA works
- [ ] Mobile responsive design
- [ ] No console errors

### Manual Testing

```bash
# Check HTTP status
curl -I http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com

# Verify demo data is accessible
curl http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com/demo-data.json

# Test read-only mode
# 1. Open demo URL in browser
# 2. Try clicking "Create API Key" button
# 3. Should show toast: "This is a demo - changes are not saved"
```

---

## Usage Guidelines

### For Sales Team

**When to share the demo:**
- Prospect asks "Can I see it first?"
- Early-stage leads not ready for full demo call
- Technical evaluators want hands-on experience
- Conference booth visitors

**How to share:**
```
Hi [Name],

Want to explore SecureBase without signing up? 

🖥️ Try our live demo: [demo URL]

Features:
• Pre-populated with 5 sample customers
• Full portal functionality (read-only)
• No credit card required
• Explore at your own pace

Ready to deploy your own? Book a demo: [calendly link]

Best,
[Your Name]
```

**Follow-up after demo visit:**
- Track time spent in demo (if analytics enabled)
- Ask: "What did you think of the demo?"
- Offer: "Want to see how it works with your use case?"
- CTA: "Ready to start your free trial?"

### For Marketing

**Use cases:**
- Link in email campaigns
- Social media posts
- Blog post CTAs
- Conference presentations
- Webinar follow-ups
- Product Hunt launch

**Sample copy:**
```
🚀 See SecureBase in action - no signup required!

Try our live demo with:
✅ 5 pre-populated customers
✅ Full AWS compliance portal
✅ Real-time dashboards
✅ Invoice management
✅ API key controls

[Try Demo] [Start Free Trial]
```

---

## Troubleshooting

### Demo Not Loading

**Check:**
1. S3 bucket exists: `aws s3 ls s3://securebase-phase3a-demo`
2. Bucket policy allows public read
3. Static website hosting enabled
4. demo-data.json exists in bucket

**Fix:**
```bash
cd phase3a-portal
./deploy-demo.sh
```

### Demo Banner Not Showing

**Cause:** Environment variables not set correctly

**Fix:**
1. Verify `.env.demo` has `VITE_SHOW_DEMO_BANNER=true`
2. Rebuild: `npm run build -- --mode demo`
3. Redeploy

### Read-Only Mode Not Working

**Cause:** Components not using `ReadOnlyWrapper`

**Fix:**
1. Check component imports `ReadOnlyButton` or `useReadOnly`
2. Verify `VITE_READ_ONLY_MODE=true` in `.env.demo`
3. Rebuild and redeploy

### Demo Data Not Loading

**Cause:** demo-data.json not in build output

**Fix:**
```bash
cp demo-data.json dist/demo-data.json
aws s3 cp dist/demo-data.json s3://securebase-phase3a-demo/demo-data.json \
  --cache-control "no-cache,no-store,must-revalidate"
```

---

## Maintenance

### Weekly Tasks

- [ ] Verify demo is accessible
- [ ] Check for console errors
- [ ] Test major user flows
- [ ] Review CTA click rates (if analytics enabled)

### Monthly Tasks

- [ ] Update demo data to reflect current product features
- [ ] Refresh sample invoices to recent dates
- [ ] Review and update customer profiles
- [ ] Test on latest browsers/devices

### Quarterly Tasks

- [ ] Review demo conversion metrics
- [ ] Gather feedback from sales team
- [ ] Consider adding new features/data
- [ ] Update demo screenshots/videos

---

## Metrics & Analytics

### Key Metrics to Track

1. **Traffic**
   - Unique visitors to demo
   - Pages viewed per session
   - Time spent in demo
   - Bounce rate

2. **Conversion**
   - Demo → Trial signup
   - Demo → Book demo
   - Demo → Contact sales

3. **Engagement**
   - Most viewed pages
   - Features explored
   - CTA click-through rates

### Setting Up Analytics

**Option 1: Google Analytics** (if enabled)
```javascript
// Add to index.html
gtag('config', 'GA-DEMO-ID', {
  'page_title': 'SecureBase Demo'
});
```

**Option 2: CloudWatch Logs**
```bash
# Enable S3 access logging
aws s3api put-bucket-logging \
  --bucket securebase-phase3a-demo \
  --logging-configuration file://logging.json
```

---

## Security Considerations

### What's Safe

- ✅ Demo data is entirely fictional
- ✅ No real customer information
- ✅ No sensitive credentials
- ✅ Read-only mode enforced
- ✅ No database writes
- ✅ Sessions expire automatically

### What to Monitor

- ⚠️  Unusual traffic patterns
- ⚠️  Attempted write operations
- ⚠️  Error rates
- ⚠️  Bot traffic

### Access Control

- Demo is publicly accessible (no authentication)
- AWS credentials stored in GitHub Secrets
- S3 bucket policy allows public read only
- No API backend connections (demo data only)

---

## Roadmap

### Planned Enhancements

- [ ] **Guided Tour**: Interactive walkthrough of features
- [ ] **Use Case Switcher**: Toggle between healthcare/fintech/government views
- [ ] **Live Chat**: Embedded support chat for questions
- [ ] **Video Tutorials**: Context-aware help videos
- [ ] **Comparison Mode**: Side-by-side tier comparison
- [ ] **Custom Domain**: demo.securebase.io with SSL

### Nice-to-Have

- Analytics dashboard for demo usage
- A/B testing for CTA placement
- Personalized demo data based on query params
- Demo session recording/heatmaps

---

## Support

**Questions about the demo?**
- Technical issues: dev-team@securebase.io
- Sales/marketing: sales@securebase.io
- Documentation: [PHASE3A_DEPLOYMENT_GUIDE.md](./PHASE3A_DEPLOYMENT_GUIDE.md)

**Want to contribute?**
- Submit PRs to improve demo data
- Suggest new features to showcase
- Report bugs or UX issues
