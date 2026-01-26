# Phase 3A Customer Portal - Staging Deployment Instructions

**Environment:** Staging  
**Date:** January 26, 2026  
**Status:** Ready for Deployment  

---

## 📋 Overview

This guide provides step-by-step instructions for deploying the Phase 3A Customer Portal to the staging environment using AWS S3 + CloudFront.

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Staging Environment                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │   S3 Bucket: securebase-phase3a-staging         │  │
│  │   - Static hosting enabled                       │  │
│  │   - Public read access                           │  │
│  │   - Cache-Control headers configured             │  │
│  └──────────────────────────────────────────────────┘  │
│                        │                                │
│                        ▼                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │   CloudFront Distribution (Optional)             │  │
│  │   - HTTPS enabled                                │  │
│  │   - Custom domain: staging-portal.securebase.com │  │
│  │   - Cache invalidation on deploy                 │  │
│  └──────────────────────────────────────────────────┘  │
│                        │                                │
│                        ▼                                │
│              Users (Staging Testers)                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Backend Integration

The staging portal connects to:
- **API Endpoint:** `https://staging-api.securebase.com/v1`
- **WebSocket:** `wss://staging-ws.securebase.com`
- **Stripe:** Test mode keys

---

## 🚀 Quick Start

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Node.js 18+** and npm installed
4. **Git** repository access

### One-Command Deployment

```bash
cd phase3a-portal
./deploy-staging.sh
```

**Estimated Time:** 5-10 minutes

---

## 📝 Detailed Deployment Steps

### Step 1: Environment Setup

1. **Navigate to portal directory:**
   ```bash
   cd /home/runner/work/securebase-app/securebase-app/phase3a-portal
   ```

2. **Verify .env.staging exists:**
   ```bash
   cat .env.staging
   ```
   
   Should contain:
   ```env
   VITE_API_BASE_URL=https://staging-api.securebase.com/v1
   VITE_WS_URL=wss://staging-ws.securebase.com
   VITE_ENV=staging
   ```

3. **Update API endpoints** (if different):
   ```bash
   nano .env.staging
   # Update VITE_API_BASE_URL with your staging API endpoint
   ```

### Step 2: Install Dependencies

```bash
npm install
```

Expected output: Dependencies installed without errors

### Step 3: Build for Staging

```bash
# Copy staging env variables
cp .env.staging .env

# Build the application
npm run build
```

**Expected output:**
```
✓ 1234 modules transformed
dist/index.html                    12.5 kB
dist/assets/index-XXXXX.js        450.3 kB
dist/assets/index-XXXXX.css        125.8 kB
```

**Build verification:**
```bash
ls -lh dist/
# Should show index.html and assets/ directory
```

### Step 4: Configure AWS

1. **Check AWS credentials:**
   ```bash
   aws sts get-caller-identity
   ```

2. **Create S3 bucket** (if not exists):
   ```bash
   aws s3 mb s3://securebase-phase3a-staging --region us-east-1
   ```

3. **Enable static website hosting:**
   ```bash
   aws s3 website s3://securebase-phase3a-staging \
     --index-document index.html \
     --error-document index.html
   ```

4. **Set bucket policy for public access:**
   ```bash
   cat > /tmp/bucket-policy.json <<EOF
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::securebase-phase3a-staging/*"
       }
     ]
   }
   EOF
   
   aws s3api put-bucket-policy \
     --bucket securebase-phase3a-staging \
     --policy file:///tmp/bucket-policy.json
   ```

### Step 5: Deploy to S3

```bash
# Sync files to S3
aws s3 sync dist/ s3://securebase-phase3a-staging/ \
  --delete \
  --cache-control "max-age=31536000" \
  --exclude "*.html" \
  --exclude "*.json"

# Upload HTML with no-cache
aws s3 sync dist/ s3://securebase-phase3a-staging/ \
  --exclude "*" \
  --include "*.html" \
  --include "*.json" \
  --cache-control "no-cache, no-store, must-revalidate"
```

### Step 6: CloudFront Setup (Optional but Recommended)

1. **Create CloudFront distribution:**
   ```bash
   # Via AWS Console:
   # 1. Go to CloudFront
   # 2. Create Distribution
   # 3. Origin Domain: securebase-phase3a-staging.s3-website-us-east-1.amazonaws.com
   # 4. Enable HTTPS
   # 5. Add custom domain: staging-portal.securebase.com
   ```

2. **Invalidate CloudFront cache after deployment:**
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id YOUR_DISTRIBUTION_ID \
     --paths "/*"
   ```

---

## ✅ Post-Deployment Validation

### 1. Access the Staging Portal

**S3 Website URL:**
```
http://securebase-phase3a-staging.s3-website-us-east-1.amazonaws.com
```

**CloudFront URL (if configured):**
```
https://staging-portal.securebase.com
```

### 2. Smoke Tests

Run these basic tests to verify deployment:

#### Login Test
```
1. Navigate to staging URL
2. Enter test API key: sb_test_staging_key
3. Verify login successful
4. Check redirect to Dashboard
```

#### Dashboard Test
```
1. Verify Dashboard loads
2. Check all metric cards display
3. Verify recent invoices list
4. Test quick action buttons
```

#### Navigation Test
```
1. Click through all menu items:
   - Dashboard ✓
   - Invoices ✓
   - API Keys ✓
   - Compliance ✓
2. Verify each page loads without errors
```

#### API Integration Test
```
1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to Invoices page
4. Verify API call to staging-api.securebase.com
5. Check response status: 200 OK
```

#### Mobile Responsiveness Test
```
1. Open DevTools responsive mode
2. Test on iPhone SE (375px)
3. Test on iPad (768px)
4. Verify navigation works
5. Check layout is readable
```

### 3. Performance Validation

```bash
# Check bundle sizes
ls -lh dist/assets/

# Target sizes:
# JS: < 500 KB (gzipped)
# CSS: < 50 KB (gzipped)
```

**Lighthouse Audit:**
1. Open Chrome DevTools
2. Run Lighthouse audit
3. Verify scores:
   - Performance: > 90
   - Accessibility: > 95
   - Best Practices: > 90

### 4. Console Error Check

```
1. Open browser console (F12 → Console tab)
2. Navigate through all pages
3. Verify: 0 errors (warnings are OK)
```

---

## 🔧 Configuration Management

### Environment Variables

All environment-specific configuration is in `.env.staging`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_BASE_URL` | `https://staging-api.securebase.com/v1` | API endpoint |
| `VITE_WS_URL` | `wss://staging-ws.securebase.com` | WebSocket endpoint |
| `VITE_ENV` | `staging` | Environment identifier |
| `VITE_STRIPE_PUBLIC_KEY` | `pk_test_...` | Stripe test key |

### Updating Configuration

1. **Edit .env.staging:**
   ```bash
   nano phase3a-portal/.env.staging
   ```

2. **Rebuild and redeploy:**
   ```bash
   npm run build
   ./deploy-staging.sh
   ```

---

## 🐛 Troubleshooting

### Build Fails

**Issue:** `npm run build` fails with errors

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### CORS Errors

**Issue:** API calls blocked by CORS

**Solution:**
```bash
# Verify Phase 2 backend has CORS configured:
# Access-Control-Allow-Origin: https://staging-portal.securebase.com
# Contact backend team to add staging domain
```

### 404 Errors on Page Refresh

**Issue:** Refreshing page shows 404

**Solution:**
```bash
# Ensure error document points to index.html
aws s3 website s3://securebase-phase3a-staging \
  --index-document index.html \
  --error-document index.html
```

### CloudFront Shows Old Version

**Issue:** Changes not visible after deployment

**Solution:**
```bash
# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"

# Wait 5-10 minutes for invalidation
```

### Environment Variables Not Loading

**Issue:** App uses wrong API endpoint

**Solution:**
```bash
# Verify .env was created from .env.staging
cat .env
# Should match .env.staging content

# Rebuild if needed
cp .env.staging .env
npm run build
```

---

## 📊 Monitoring

### CloudWatch Metrics

Monitor these metrics in AWS CloudWatch:

1. **S3 Bucket:**
   - GetRequests (request count)
   - BytesDownloaded (bandwidth usage)
   - 4xxErrors (client errors)
   - 5xxErrors (server errors)

2. **CloudFront (if configured):**
   - Requests (total requests)
   - BytesDownloaded (bandwidth)
   - ErrorRate (error percentage)
   - CacheHitRate (cache efficiency)

### Setting Up Alarms

```bash
# Create CloudWatch alarm for high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name phase3a-staging-high-errors \
  --metric-name 4xxErrorRate \
  --namespace AWS/S3 \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5.0 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:alerts
```

---

## 🔄 Update Workflow

### Making Changes to Staging

1. **Update code locally:**
   ```bash
   cd phase3a-portal/src
   # Make changes to components
   ```

2. **Test locally:**
   ```bash
   npm run dev
   # Test changes at http://localhost:3000
   ```

3. **Deploy to staging:**
   ```bash
   ./deploy-staging.sh
   ```

4. **Validate changes:**
   - Check staging URL
   - Run smoke tests
   - Verify no errors

---

## 📋 Deployment Checklist

Use this checklist for each staging deployment:

### Pre-Deployment
- [ ] Code changes reviewed
- [ ] Local testing complete
- [ ] .env.staging updated (if needed)
- [ ] Dependencies up to date (`npm install`)
- [ ] Linter passes (`npm run lint`)
- [ ] Build succeeds locally (`npm run build`)

### Deployment
- [ ] AWS credentials configured
- [ ] Deployment script executed (`./deploy-staging.sh`)
- [ ] Build completed without errors
- [ ] Files uploaded to S3
- [ ] CloudFront invalidated (if applicable)

### Post-Deployment
- [ ] Staging URL accessible
- [ ] Login functionality works
- [ ] All pages load correctly
- [ ] API calls successful
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Performance acceptable (< 2s load)

### Testing
- [ ] Smoke tests passed
- [ ] Dashboard metrics load
- [ ] Invoice list displays
- [ ] API keys management works
- [ ] Compliance page functional
- [ ] PDF downloads work
- [ ] Logout works

---

## 🎯 Success Criteria

Staging deployment is successful when:

1. ✅ **Portal accessible** at staging URL
2. ✅ **All pages load** without errors
3. ✅ **API integration** working
4. ✅ **Authentication** functional
5. ✅ **Mobile responsive** on 2+ devices
6. ✅ **Performance** meets targets (< 2s load)
7. ✅ **No critical console errors**

---

## 📞 Support

**Issues or Questions:**
- Documentation: See PHASE3A_DEPLOYMENT_GUIDE.md
- Backend API: Contact Phase 2 team
- Infrastructure: DevOps team

---

## 🔗 Related Documentation

- [PHASE3A_DEPLOYMENT_GUIDE.md](../PHASE3A_DEPLOYMENT_GUIDE.md) - Full deployment guide
- [PHASE3A_STATUS.md](../PHASE3A_STATUS.md) - Feature status and metrics
- [PHASE3A_QUICK_REFERENCE.md](../PHASE3A_QUICK_REFERENCE.md) - Quick commands
- [README.md](README.md) - Portal overview

---

**Last Updated:** January 26, 2026  
**Environment:** Staging  
**Status:** ✅ Ready for Deployment
