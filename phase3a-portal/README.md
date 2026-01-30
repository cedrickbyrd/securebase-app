# SecureBase Customer Portal (Phase 3A)

Production-ready React customer portal for SecureBase multi-tenant PaaS platform.

## Features

- 📊 **Dashboard** - Real-time metrics, usage trends, quick actions
- 💳 **Invoices** - View, search, download invoices as PDF
- 🔑 **API Keys** - Create, manage, revoke API keys with scopes
- 🛡️ **Compliance** - Framework status, findings, reports
- 🎫 **Support** - Create tickets, track status, add comments
- 📈 **Cost Forecasting** - 12-month predictions with ML
- 🔔 **Notifications** - Real-time updates via WebSocket

## Tech Stack

- React 19 + React Router 6
- Vite (build tool)
- Tailwind CSS v4
- Chart.js (data visualization)
- Axios (API client)
- Lucide React (icons)

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API endpoint

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
phase3a-portal/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx       # Main dashboard
│   │   ├── Invoices.jsx        # Invoice management
│   │   ├── ApiKeys.jsx         # API key management
│   │   ├── Compliance.jsx      # Compliance reporting
│   │   ├── SupportTickets.jsx  # Support system
│   │   ├── Forecasting.jsx     # Cost forecasting
│   │   ├── Notifications.jsx   # Notification bell
│   │   └── Login.jsx           # Authentication
│   ├── services/
│   │   ├── api.js              # API client
│   │   └── websocket.js        # WebSocket service
│   ├── utils/
│   │   └── formatters.js       # Utility functions
│   ├── App.jsx                 # Main app + routing
│   ├── main.jsx                # Entry point
│   └── index.css               # Global styles
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `VITE_API_BASE_URL` | API Gateway endpoint | `https://api.securebase.com/v1` | Yes |
| `VITE_WS_URL` | WebSocket endpoint | `wss://ws.securebase.com` | Yes |
| `VITE_ENV` | Environment identifier | `development`, `staging`, or `production` | Yes |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key | `pk_test_...` or `pk_live_...` | Yes |
| `VITE_PILOT_PROGRAM_ENABLED` | Enable pilot program features | `true` or `false` | No |
| `VITE_ANALYTICS_ENABLED` | Enable analytics tracking | `true` or `false` | No |
| `VITE_HEALTHCARE_PRICE_ID` | Healthcare tier price ID | `price_...` | Yes |
| `VITE_FINTECH_PRICE_ID` | Fintech tier price ID | `price_...` | Yes |
| `VITE_GOVERNMENT_PRICE_ID` | Government tier price ID | `price_...` | Yes |
| `VITE_STANDARD_PRICE_ID` | Standard tier price ID | `price_...` | Yes |

### Environment Files

- `.env.example` - Template with all available variables
- `.env.staging` - Staging environment configuration (tracked in Git)
- `.env.production` - Production environment configuration (tracked in Git)
- `.env` - Local environment (gitignored, created from .env.staging or .env.production)

## Deployment

### Option 1: AWS S3 + CloudFront

```bash
# Build production bundle
npm run build

# Deploy to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Option 2: Vercel

```bash
npm install -g vercel
vercel --prod
```

### Option 3: Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

## API Integration

The portal connects to Phase 2 backend APIs:

- `POST /auth/login` - Authenticate with API key
- `GET /dashboard/metrics` - Dashboard data
- `GET /invoices` - List invoices
- `GET /invoices/{id}` - Invoice details
- `POST /api-keys` - Create API key
- `DELETE /api-keys/{id}` - Revoke API key
- `GET /compliance/status` - Compliance data
- `POST /support/tickets` - Create ticket
- `GET /forecast` - Cost predictions

## Development

```bash
# Install dependencies
npm install

# Run dev server (http://localhost:3000)
npm run dev

# Lint code
npm run lint

# Build for production
npm run build
```

## Testing

```bash
# Test authentication flow
# 1. Go to http://localhost:3000
# 2. Enter API key: test_xxxxx
# 3. Should redirect to dashboard

# Test API integration
# Make sure VITE_API_BASE_URL points to running backend
```

## Production Checklist

- [ ] Update `VITE_API_BASE_URL` in `.env`
- [ ] Update `VITE_WS_URL` for WebSocket
- [ ] Run `npm run build`
- [ ] Test production build with `npm run preview`
- [ ] Deploy to S3/CloudFront or hosting platform
- [ ] Configure custom domain (e.g., portal.securebase.com)
- [ ] Set up SSL certificate
- [ ] Configure CORS on API Gateway
- [ ] Test end-to-end flows
- [ ] Monitor performance and errors

## License

Proprietary - SecureBase 2026

---

## 🌍 Staging Deployment

### Quick Deploy to Staging

```bash
# Automated deployment script
./deploy-staging.sh
```

### Build for Staging

```bash
# Build with staging environment variables
npm run build:staging

# Output will be in dist/ directory
```

### Manual Staging Deployment

```bash
# 1. Build
npm run build:staging

# 2. Create S3 bucket (if not exists)
aws s3 mb s3://securebase-phase3a-staging --region us-east-1

# 3. Enable static website hosting
aws s3 website s3://securebase-phase3a-staging \
  --index-document index.html \
  --error-document index.html

# 4. Upload files
aws s3 sync dist/ s3://securebase-phase3a-staging/ --delete

# 5. Access staging site
# http://securebase-phase3a-staging.s3-website-us-east-1.amazonaws.com
```

### Staging Environment

- **URL:** http://securebase-phase3a-staging.s3-website-us-east-1.amazonaws.com
- **API:** https://staging-api.securebase.com/v1
- **WebSocket:** wss://staging-ws.securebase.com
- **Stripe:** Test mode

For detailed staging deployment instructions, see [STAGING_DEPLOYMENT.md](STAGING_DEPLOYMENT.md).

---

**Last Updated:** January 26, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready with Staging Support
