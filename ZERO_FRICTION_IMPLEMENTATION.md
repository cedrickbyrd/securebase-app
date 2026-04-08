# Zero-Friction Signup Flow — Implementation Guide

This document describes the zero-friction signup system that converts LinkedIn ad traffic into paying pilot customers.

---

## Overview

When a visitor arrives from a LinkedIn ad (`?utm_source=linkedin`), they see:

1. A **"Welcome LinkedIn Member! Your 50% Pilot Discount is Active"** banner.
2. A **scarcity counter** showing remaining pilot spots.
3. Two frictionless sign-in options: **LinkedIn OAuth** (one click) or **Magic Link** (email only, no password).
4. After auth, they land on the **Checkout page** with the pilot price ($2,000/month) pre-applied and a "LinkedIn Discount Applied!" badge.

Total time from ad click to checkout: **under 60 seconds**.

---

## Files Added / Modified

| File | Type | Description |
|---|---|---|
| `src/utils/trackingUtils.js` | New | UTM capture, 30-day localStorage persistence, LinkedIn detection, pilot pricing helpers |
| `src/components/Signup.jsx` | New | Signup page with magic link + LinkedIn OAuth, pilot banner, scarcity counter |
| `src/pages/AuthCallback.jsx` | New | Supabase auth callback — exchanges tokens, attaches attribution metadata, redirects to checkout |
| `src/components/Checkout.jsx` | Modified | Auto-applies pilot pricing from attribution; shows discount banner for LinkedIn visitors |
| `src/App.jsx` | Modified | Adds `/signup` and `/auth/callback` routes |

---

## Quick Start (15 minutes)

### 1. Configure environment variables

Add to your `.env.local` (never commit):

```env
# Supabase (already required by the app)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Stripe pilot price ID
VITE_STRIPE_PILOT_PRICE_ID=price_YOUR_REAL_PILOT_PRICE_ID

# Optional: override total pilot spots (default: 10)
VITE_PILOT_MAX_SPOTS=10
```

### 2. Create the Stripe pilot price

In the [Stripe Dashboard](https://dashboard.stripe.com/prices):

1. Go to **Products → Add product**.
2. Name: `SecureBase Pilot Program`.
3. Price: **$2,000 / month** (recurring).
4. Copy the `price_…` ID and set it as `VITE_STRIPE_PILOT_PRICE_ID`.

### 3. Enable LinkedIn OAuth in Supabase

1. Open your [Supabase project](https://app.supabase.com) → **Authentication → Providers**.
2. Enable **LinkedIn (OIDC)**.
3. Create a LinkedIn app at [developer.linkedin.com](https://developer.linkedin.com/apps):
   - Products: **Sign In with LinkedIn using OpenID Connect**
   - Authorized redirect URLs: `https://your-project.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client Secret** into Supabase.

### 4. Enable Magic Links in Supabase

1. Supabase → **Authentication → Providers → Email**.
2. Ensure **Enable Email Provider** is on.
3. Set **Confirm email** to *disabled* (magic links don't require separate confirmation).
4. Under **URL Configuration**, add your site URL and the callback:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/auth/callback`

### 5. Point your LinkedIn ads at the signup page

Use this URL as your ad destination:

```
https://your-domain.com/signup?utm_source=linkedin&utm_medium=paid&utm_campaign=pilot-2024
```

### 6. Deploy

```bash
npm run build
# Upload dist/ to your hosting (Netlify, etc.)
```

---

## Testing

### Test the full LinkedIn flow

```
1. Open in a new private window:
   https://your-domain.com/signup?utm_source=linkedin&utm_campaign=pilot

2. Verify:
   - Blue LinkedIn banner ("Welcome LinkedIn Member! Your 50% Pilot Discount is Active")
   - Scarcity counter shown (e.g. "Only 8 of 10 pilot spots remaining")

3a. Magic link path:
   - Enter your email → click "Send Magic Link"
   - Check inbox → click link
   - Should land on /checkout showing $2,000 and "LinkedIn Discount Applied!"

3b. LinkedIn OAuth path:
   - Click "Continue with LinkedIn"
   - Authorize the app
   - Should land on /checkout showing $2,000 and "LinkedIn Discount Applied!"
```

### Test organic (non-LinkedIn) flow

```
Open: https://your-domain.com/signup  (no UTM params)

Verify:
- No LinkedIn banner shown
- Default heading: "Get started for free"
- After auth → /checkout shows standard pricing (no pilot discount)
```

---

## Attribution Persistence

UTM parameters are stored in `localStorage` under the key `sb_attribution` with a **30-day TTL**. This ensures:

- A visitor who clicks an ad but doesn't sign up immediately still gets the discount on a return visit within 30 days.
- Attribution metadata is attached to the Supabase user profile (`user.user_metadata`) for CRM reporting.

To inspect stored attribution in the browser console:

```js
JSON.parse(localStorage.getItem('sb_attribution'))
```

---

## Tracking Pilot Spot Count

The scarcity counter reads `localStorage.getItem('sb_pilot_spots_taken')`. You can update this from your backend (e.g. via a Netlify function called after a successful Stripe webhook) to reflect the real number of conversions:

```js
// In your stripe-webhook handler, after a successful pilot subscription:
// (This runs server-side — set the value via a public API endpoint your frontend reads)
localStorage.setItem('sb_pilot_spots_taken', '3'); // 3 pilots signed up so far
```

For now the counter defaults to 0 taken (all 10 spots available). Update `VITE_PILOT_MAX_SPOTS` to change the total.

---

## GA4 Events

The following events are fired automatically:

| Event | Category | Action | Label |
|---|---|---|---|
| Signup page loaded | `Signup` | `PageView` | `linkedin` or `organic` |
| Magic link sent | `Signup` | `MagicLinkSent` | `linkedin` or `organic` |
| LinkedIn OAuth started | `Signup` | `LinkedInOAuthStarted` | `oauth` |
| Auth completed | `Signup` | `AuthComplete` | `linkedin` or `organic` |
| Checkout page loaded | `Checkout` | `Started` | plan id |

Monitor these in **GA4 → Reports → Realtime** after deploy.

---

## Compliance Notes

- **No PII in analytics events** — email addresses and user IDs are never sent to GA4.
- **UTM data only** — `trackingUtils.js` stores only UTM parameters and the landing path, never personal data.
- **First-party storage** — all attribution is stored in `localStorage` (no third-party cookies or beacons).
- **HIPAA BAA** — standard GA4 does not provide a BAA. For HIPAA-covered environments, use GA4 360 or a privacy-first alternative (Plausible/Fathom).
