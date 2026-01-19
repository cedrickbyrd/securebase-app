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

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | API Gateway endpoint | `https://api.securebase.com/v1` |
| `VITE_WS_URL` | WebSocket endpoint | `wss://ws.securebase.com` |
| `VITE_ENV` | Environment | `development` or `production` |

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
