# 🚀 Deploy Live Demo - Quick Start Guide

**Status:** ✅ 100% Ready to Deploy  
**Time Required:** 5-15 minutes  
**Prerequisites:** GitHub account + (Netlify account OR AWS credentials)

---

## 🎯 Overview

The SecureBase demo is **completely ready** for deployment with:
- ✅ Mock API implemented (721 lines, 37 endpoints)
- ✅ Demo mode configurations complete
- ✅ Security headers configured
- ✅ All documentation ready

Choose your deployment method below based on what credentials you have available.

---

## Option 1: Netlify Deployment (Recommended - Easiest)

**Best for:** Quick deployment without AWS setup  
**Time:** 5-10 minutes  
**Cost:** $0 (Free tier)

### Prerequisites
- GitHub account with access to cedrickbyrd/securebase-app
- Netlify account (free - create at https://netlify.com)

### Deployment Steps

#### A. Customer Portal (Interactive Demo)

1. **Go to Netlify Dashboard**
   - Visit https://app.netlify.com
   - Click "Add new site" → "Import an existing project"

2. **Connect to GitHub**
   - Select "GitHub" as provider
   - Authorize Netlify (if first time)
   - Choose `cedrickbyrd/securebase-app` repository

3. **Configure Build Settings**
   ```
   Base directory: phase3a-portal
   Build command: npm run build
   Publish directory: phase3a-portal/dist
   ```

4. **Set Environment Variables**
   - Click "Show advanced"
   - Add these variables:
     ```
     VITE_USE_MOCK_API=true
     VITE_ENV=demo
     VITE_ANALYTICS_ENABLED=false
     ```

5. **Deploy**
   - Click "Deploy site"
   - Wait 2-3 minutes for build to complete
   - You'll get a URL like: `https://securebase-demo-abc123.netlify.app`

6. **Test the Demo**
   - Visit the URL
   - Should see demo banner at top
   - Try logging in (mock auth auto-works)
   - Verify dashboard shows demo data

#### B. Marketing Site (Optional)

1. **Repeat steps above but use:**
   ```
   Base directory: (leave empty or use /)
   Build command: npm run build
   Publish directory: dist
   ```

2. **Environment Variables:**
   ```
   VITE_ENV=demo
   ```

### Custom Domain (Optional)

If you own a domain:
1. Go to Site Settings → Domain management
2. Add custom domain: `demo.securebase.io`
3. Follow DNS configuration instructions
4. Enable HTTPS (automatic with Netlify)

**Result:** `https://demo.securebase.io`

---

## Option 2: AWS S3 + GitHub Actions (Automated)

**Best for:** Organizations with AWS infrastructure  
**Time:** 10-15 minutes (one-time setup)  
**Cost:** ~$0-1/month

### Prerequisites
- AWS account with S3 access
- AWS Access Key ID and Secret Access Key
- GitHub repository admin access

### Setup Steps

1. **Configure AWS Credentials in GitHub**
   - Go to https://github.com/cedrickbyrd/securebase-app/settings/secrets/actions
   - Click "New repository secret"
   - Add two secrets:
     - Name: `AWS_ACCESS_KEY_ID`, Value: (your AWS key)
     - Name: `AWS_SECRET_ACCESS_KEY`, Value: (your AWS secret)

2. **Trigger Deployment**
   
   **Option A: Push to Branch**
   ```bash
   # Any push to main or feature/sales-enablement triggers deployment
   git checkout main
   git commit --allow-empty -m "Trigger demo deployment"
   git push
   ```

   **Option B: Manual Trigger**
   - Go to https://github.com/cedrickbyrd/securebase-app/actions
   - Select "Deploy Phase 3a Demo Environment"
   - Click "Run workflow"
   - Select branch: `main`
   - Click "Run workflow"

3. **Monitor Deployment**
   - Watch the workflow run in GitHub Actions
   - Should complete in 3-5 minutes
   - Workflow creates S3 bucket, builds app, syncs files

4. **Access Demo**
   - Demo URL will be shown in workflow output
   - Format: `http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com`

### AWS S3 Bucket Details

The workflow automatically:
- Creates bucket: `securebase-phase3a-demo`
- Enables static website hosting
- Sets public read policy
- Configures cache headers
- Syncs built files

**Manual Setup (if workflow fails):**
```bash
cd phase3a-portal

# Install dependencies
npm ci

# Build for demo
cp .env.demo .env
npm run build -- --mode demo

# Deploy to S3 (requires AWS CLI)
aws s3 mb s3://securebase-phase3a-demo --region us-east-1
aws s3 website s3://securebase-phase3a-demo \
  --index-document index.html \
  --error-document index.html
aws s3 sync dist/ s3://securebase-phase3a-demo/ --delete
```

---

## Option 3: Vercel Deployment (Alternative)

**Best for:** Teams already using Vercel  
**Time:** 5 minutes  
**Cost:** $0 (Free tier)

### Steps

1. **Install Vercel CLI** (optional - can use web UI)
   ```bash
   npm install -g vercel
   ```

2. **Deploy Portal**
   ```bash
   cd phase3a-portal
   vercel --prod
   
   # Follow prompts:
   # - Set up and deploy? Yes
   # - Scope: (your Vercel team)
   # - Link to existing project? No
   # - Project name: securebase-demo
   # - Directory: phase3a-portal
   ```

3. **Configure Environment Variables** (in Vercel Dashboard)
   - Go to project settings
   - Add environment variables:
     ```
     VITE_USE_MOCK_API=true
     VITE_ENV=demo
     VITE_ANALYTICS_ENABLED=false
     ```
   - Redeploy for changes to take effect

4. **Access Demo**
   - URL: `https://securebase-demo.vercel.app`
   - Or custom domain via Vercel settings

---

## ✅ Post-Deployment Checklist

After deploying, verify these work:

### Basic Functionality
- [ ] Site loads (HTTP 200)
- [ ] Demo banner visible at top
- [ ] Can navigate to dashboard
- [ ] Demo data displays (customers, invoices, metrics)
- [ ] Mobile responsive layout
- [ ] No console errors

### Demo Features
- [ ] Mock authentication works (auto-login or demo/demo)
- [ ] Read-only mode prevents edits
- [ ] "Start Free Trial" CTA present
- [ ] "Book Demo" CTA present
- [ ] All navigation links work
- [ ] Demo resets message visible

### Security
- [ ] HTTPS enabled (if custom domain)
- [ ] Security headers present (check with `curl -I`)
- [ ] No production secrets exposed
- [ ] No real API connections

### Testing Commands

```bash
# Check HTTP status
curl -I https://your-demo-url.com
# Should return: HTTP/2 200

# Check for demo banner
curl -s https://your-demo-url.com | grep -i "demo"
# Should find demo text

# Check demo data
curl https://your-demo-url.com/demo-data.json
# Should return JSON data

# Check security headers
curl -I https://your-demo-url.com | grep -i "content-security-policy"
# Should find CSP header
```

---

## 🎓 Demo Credentials

**Portal Demo:**
- URL: (your deployed URL)
- Login: Auto-login enabled (no credentials needed)
- OR: Username `demo` / Password `demo` (if login page shows)

**Demo Data Includes:**
- 5 mock customers (Healthcare, Fintech, Government, Standard)
- 30+ invoices ($363K total)
- 3 API keys
- 3 support tickets
- Compliance metrics (98% score)
- Cost forecasting
- Usage analytics

---

## 🐛 Troubleshooting

### Build Fails on Netlify/Vercel

**Error:** `vite: not found`

**Solution:**
- Verify Node version is 18+ in build settings
- Check `package.json` exists in base directory
- Try: Clear cache and redeploy

### Site Shows 404

**Issue:** All routes return 404 except root

**Solution:**
- For Netlify: Verify `netlify.toml` redirect rules present
- For Vercel: Verify `vercel.json` rewrites configured
- For S3: Error document should be `index.html`

### Demo Data Not Loading

**Issue:** Dashboard empty or shows errors

**Solution:**
- Check environment variable: `VITE_USE_MOCK_API=true`
- Verify `demo-data.json` copied to build output
- Check browser console for errors
- Verify mock API files are included in build

### Security Headers Missing

**Issue:** Headers not in response

**Solution:**
- For Netlify: Check `netlify.toml` headers section
- For Vercel: Check `vercel.json` headers configuration
- For S3: Add CloudFront distribution for custom headers
- Test with: `curl -I https://your-url.com`

### GitHub Actions Workflow Fails

**Issue:** AWS deployment fails

**Solution:**
- Verify AWS credentials are set in GitHub secrets
- Check IAM permissions include S3 full access
- Review workflow logs for specific error
- Try manual deployment first to debug

---

## 📊 Monitoring & Maintenance

### Uptime Monitoring
- **UptimeRobot** (free): https://uptimerobot.com
  - Add URL: `https://your-demo-url.com`
  - Check interval: Every 5 minutes
  - Alert email: your-email@domain.com

### Analytics (Optional)
- **Plausible** (privacy-friendly): https://plausible.io
- **Google Analytics**: Add tracking ID to `.env`

### Demo Data Refresh
Demo data is static. To update:
1. Edit `phase3a-portal/demo-data.json`
2. Commit and push
3. Redeploy (automatic with GitHub Actions)

---

## 🔗 Related Documentation

- [LIVE_DEMO_STATUS.md](./LIVE_DEMO_STATUS.md) - Complete readiness report
- [DEMO_QUICK_START.md](./DEMO_QUICK_START.md) - Detailed implementation guide
- [DEMO_README.md](./DEMO_README.md) - Demo user guide
- [DEMO_SECURITY_CONFIG.md](./DEMO_SECURITY_CONFIG.md) - Security details
- [phase3a-portal/README.md](./phase3a-portal/README.md) - Portal documentation

---

## 💬 Support

### Deployment Issues
- **Email:** dev-team@securebase.io
- **GitHub Issues:** https://github.com/cedrickbyrd/securebase-app/issues

### Demo Questions
- **Sales Team:** sales@securebase.io
- **Documentation:** See above links

---

## 🎉 Success!

Once deployed, share with your team:

**Email Template:**
```
Subject: 🚀 SecureBase Live Demo Now Available

Hi Team,

Our interactive demo is now live at:
https://your-demo-url.com

Features:
✅ Auto-login (no signup required)
✅ Full portal functionality (read-only)
✅ 5 realistic customer scenarios
✅ Professional, production-ready UI
✅ Mobile responsive

Use this for:
• Early-stage prospect demos
• Conference booth presentations
• "Show me" requests during sales calls
• Technical evaluations

Built-in CTAs:
• Start Free Trial → portal.securebase.io/signup
• Book Live Demo → calendly.com/securebase/demo

Questions? Reply to this email.

Cheers!
```

---

**Guide Version:** 1.0  
**Last Updated:** February 4, 2026  
**Maintained By:** SecureBase Team
