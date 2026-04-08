# GA4 Implementation Checklist

Complete guide to implementing GA4 tracking for the SecureBase SaaS subscription funnel.

## 📋 Pre-Implementation

- [ ] Copy `.env.template` to `.env.local`
- [ ] Get GA4 Measurement ID from Google Analytics
- [ ] Update `VITE_GA4_MEASUREMENT_ID` in `.env.local`
- [ ] Ensure Stripe keys are configured in `.env.local`
- [ ] Review `phase3a-portal/src/config/live-config.js` and confirm price IDs

## 🔧 Code Integration

### Step 1: Install Dependencies

```bash
cd phase3a-portal
npm install react-ga4 --legacy-peer-deps
```

### Step 2: Initialize GA4 (`src/utils/analytics.js`)

```javascript
import ReactGA from 'react-ga4';

export const initializeAnalytics = () => {
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  if (!measurementId || !import.meta.env.PROD) return;

  ReactGA.initialize(measurementId, {
    gaOptions: {
      anonymize_ip: true,               // HIPAA: mask IPs
      allow_google_signals: false,      // disable ad signals
      allow_ad_personalization_signals: false,
    },
  });
};

// NEVER include PII/PHI in path or title
export const trackPageView = (path) => {
  const safe = path
    .replace(/\/org\/[^/]+/g,        '/org/:id')
    .replace(/\/user\/[^/]+/g,       '/user/:id')
    .replace(/\/client\/[^/]+/g,     '/client/:id')
    .replace(/[?&]email=[^&]*/g,     '')
    .replace(/[?&]name=[^&]*/g,      '');
  ReactGA.send({ hitType: 'pageview', page: safe });
};

export const trackEvent = (category, action, label, value) => {
  ReactGA.event({ category, action, label, value });
};
```

### Step 3: Wire into App (`src/App.jsx`)

```javascript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initializeAnalytics, trackPageView } from './utils/analytics';

export default function App() {
  const location = useLocation();

  useEffect(() => { initializeAnalytics(); }, []);
  useEffect(() => { trackPageView(location.pathname); }, [location]);

  // ...
}
```

### Step 4: Funnel Events

Track key steps in the subscription funnel — **no PII/PHI in any parameter**:

```javascript
// Pricing page loaded
trackEvent('Funnel', 'ViewPricing');

// Tier selected
trackEvent('Funnel', 'SelectTier', tier);   // e.g. 'fintech'

// Checkout initiated
trackEvent('Funnel', 'BeginCheckout', tier);

// Successful purchase (fire from webhook confirmation page)
trackEvent('Purchase', 'Completed', tier, amount);
```

## 🧪 Testing

### Step 5: Test Locally

1. Install the [GA4 Debugger Chrome extension](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna)
2. Open **GA4 → Admin → DebugView** in a separate tab
3. Run the app and walk through the funnel:
   - [ ] Visit pricing page → verify `page_view` fires
   - [ ] Click a tier → verify `SelectTier` event fires
   - [ ] Begin checkout → verify `BeginCheckout` event fires
4. Confirm `pricing_phase`, `currency`, and `value` parameters appear in DebugView

### Step 6: Test Stripe Webhook Locally

```bash
# Install Stripe CLI and forward to local dev server
stripe listen --forward-to localhost:5173/api/webhooks/stripe
stripe trigger checkout.session.completed
```

Check console for:
- ✅ Webhook received and signature verified
- ✅ `purchase` GA4 event fired with correct revenue value

## 📊 GA4 Configuration

### Step 7: Custom Dimensions (GA4 Admin → Custom definitions)

| Dimension | Scope | Values |
| :--- | :--- | :--- |
| `pricing_phase` | Event | `pilot`, `ga` |
| `user_tier` | User | `standard`, `fintech`, `healthcare`, `government` |
| `subscription_status` | User | `active`, `trialing`, `cancelled` |
| `compliance_framework` | Event | `CIS`, `SOC2`, `HIPAA`, `FedRAMP` |

### Step 8: Mark Conversions (GA4 Admin → Events)

Mark these events as conversions:
- `purchase`
- `pilot_signup`
- `subscription_upgraded`

### Step 9: Subscription Funnel Report (GA4 → Explore)

Configure a Funnel exploration with these steps:
1. `view_pricing`
2. `view_item` (tier hover)
3. `begin_checkout`
4. `add_payment_info`
5. `purchase`

Save as **"Subscription Funnel"**.

## 🚀 Production Checklist

### Pre-Launch

- [ ] `VITE_GA4_MEASUREMENT_ID` set in production environment
- [ ] GA4 script confirmed loading on production domain (Network tab)
- [ ] Stripe webhook endpoint reachable at production URL
- [ ] Webhook signature verification passes
- [ ] End-to-end test transaction completed (refund afterward)
- [ ] Events visible in GA4 (not just DebugView)

### Post-Launch Monitoring

**Day 1:** Verify real-time users visible, pricing page views tracked, no console errors  
**Week 1:** Review funnel conversion rates, confirm all 5 steps fire, check webhook reliability  
**Month 1:** Analyze first cohort retention, review traffic source performance

## ⚠️ HIPAA Compliance — NEVER Track

- User emails, names, or organization names
- Audit findings or compliance scores
- Any field marked PII/PHI in the data model
- URL parameters containing patient or customer identifiers

> **Note:** GA4 standard does **not** support HIPAA/BAA. For Healthcare tier customers,
> consider [Plausible](https://plausible.io) or [Fathom](https://usefathom.com) as
> privacy-first alternatives, or Google Analytics 360 with a signed BAA.

## 🐛 Troubleshooting

| Symptom | Check |
| :--- | :--- |
| Events not appearing | Confirm `VITE_GA4_MEASUREMENT_ID` is set; check Network tab for `gtag` requests |
| Purchase events missing | Verify webhook endpoint receives events; check signature verification |
| Wrong revenue values | Confirm price values in `live-config.js` are in dollars (not cents) |
| PII in event params | Audit all `trackEvent` call sites; ensure path sanitizer is applied |

## 📚 Resources

- [GA4 Documentation](https://support.google.com/analytics/answer/10089681)
- [react-ga4 Library](https://github.com/PriceRunner/react-ga4)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [HIPAA & Google Analytics](https://support.google.com/analytics/answer/12017362)
- [SecureBase Pricing Config](../phase3a-portal/src/config/live-config.js)
