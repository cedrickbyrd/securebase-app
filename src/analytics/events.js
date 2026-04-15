/**
 * @file events.js
 * @description Canonical GA4 event tracking functions for the SecureBase analytics baseline.
 *
 * Provides the three core tracking functions from the Analytics Baseline document:
 *   - trackSignup(tier, method)         — sign_up with tier value for acquisition reporting
 *   - trackHIPAARoute(route, action)    — high-value HIPAA route interactions
 *   - trackPurchase(sessionId, plan, value) — full GA4 purchase event with items[]
 *
 * Uses window.gtag directly. GA4 consent mode is enforced upstream by
 * initializeAnalytics() in utils/analytics.js; events are silently dropped
 * when gtag is unavailable or consent is denied.
 *
 * HIPAA NOTE: No PII or PHI is ever sent in these events.
 * @see docs — SecureBase Analytics Baseline, GA4 Implementation Guide § Step 2
 */

// ---------------------------------------------------------------------------
// HIPAA route constants
// ---------------------------------------------------------------------------

/**
 * Routes that signal high-value healthcare interest.
 * Page views and interactions on these routes fire `hipaa_interaction` and
 * should trigger an immediate alert to the sales team.
 */
export const HIPAA_ROUTES = [
  '/compliance/hipaa',
  '/signup',                    // paired with tier=healthcare query param
  '/portal/hipaa/audit',
  '/portal/hipaa/evidence',
  '/portal/hipaa/baa',
  '/api/hipaa/validate',
  '/docs/hipaa',
];

// ---------------------------------------------------------------------------
// Tier value table (monthly USD)
// ---------------------------------------------------------------------------

const TIER_VALUES = {
  standard:   2000,
  fintech:    8000,
  healthcare: 15000,
  government: 25000,
};

/**
 * Returns the monthly USD value for a compliance tier.
 * Used by trackSignup to weight sign_up conversions by revenue in GA4 reports.
 *
 * @param {string} tier - e.g. 'standard', 'fintech', 'healthcare', 'government'
 * @returns {number}
 */
export function getTierValue(tier) {
  return TIER_VALUES[tier] ?? 0;
}

/**
 * Infers a compliance tier from a Stripe plan identifier.
 *
 * @param {string} plan - e.g. 'healthcare_annual', 'fintech_monthly'
 * @returns {'healthcare'|'fintech'|'government'|'standard'}
 */
export function getPlanTier(plan) {
  if (typeof plan !== 'string') return 'standard';
  if (plan.includes('healthcare')) return 'healthcare';
  if (plan.includes('fintech'))    return 'fintech';
  if (plan.includes('government')) return 'government';
  return 'standard';
}

// ---------------------------------------------------------------------------
// Core tracking functions
// ---------------------------------------------------------------------------

/**
 * Track a successful signup with tier context and revenue value.
 *
 * Fires the standard GA4 `sign_up` event. Including `value` and `currency`
 * lets GA4 weight conversions by revenue tier in Acquisition reports.
 * Also fires the custom `signup_healthcare_tier` event for healthcare signups,
 * which is the primary HIPAA lead alert trigger.
 *
 * HIPAA note: only the tier identifier and method are sent — never email,
 * name, or any PII.
 *
 * @param {string} tier   - Compliance tier: 'standard'|'fintech'|'healthcare'|'government'
 * @param {string} method - Sign-up method: 'email'|'google'|'github'
 */
export function trackSignup(tier, method) {
  if (typeof window.gtag !== 'function') return;

  const effectiveTier = tier ?? 'standard';

  window.gtag('event', 'sign_up', {
    method:   method ?? 'email',
    tier:     effectiveTier,
    value:    getTierValue(effectiveTier),
    currency: 'USD',
  });

  // Fire an additional custom event for healthcare tier so GA4 alerts and
  // the sales team's Slack integration can filter on it independently.
  if (tier === 'healthcare') {
    window.gtag('event', 'signup_healthcare_tier', {
      method:     method ?? 'email',
      deal_value: TIER_VALUES.healthcare,
      currency:   'USD',
      high_value: true,
    });
  }
}

/**
 * Track an interaction with a HIPAA-specific route.
 *
 * Healthcare interactions are the highest-value lead signal ($15,000/mo).
 * Fires the custom `hipaa_interaction` event that should trigger an immediate
 * sales-team alert via GA4 → Slack/email integration.
 *
 * HIPAA note: `route` must be a path only — never include customer identifiers
 * or query parameters. `action` describes the interaction type.
 *
 * @param {string} route  - Path of the HIPAA route, e.g. '/compliance/hipaa'
 * @param {string} action - Interaction type: 'view'|'download'|'generate'|'sign'|'signup'
 */
export function trackHIPAARoute(route, action) {
  if (typeof window.gtag !== 'function') return;

  // Strip query parameters to prevent accidental PII leakage via URL params.
  const safePath = typeof route === 'string' ? route.split('?')[0] : 'unknown';

  window.gtag('event', 'hipaa_interaction', {
    route:      safePath,
    action:     action ?? 'view',
    tier:       'healthcare',
    high_value: true,
    deal_value: TIER_VALUES.healthcare,
  });
}

/**
 * Track a completed purchase with full GA4 e-commerce parameters.
 *
 * GA4 Monetization reports require `transaction_id`, `value`, `currency`, and
 * a populated `items[]` array to show non-zero revenue. Missing any of these
 * causes the "Purchases show but revenue = $0" symptom.
 *
 * HIPAA note: only the Stripe session ID (non-PHI), plan name, and a numeric
 * revenue value are sent — never payment card details, user PII, or org data.
 *
 * @param {string} sessionId - Stripe checkout session ID (e.g. 'cs_live_abc123')
 * @param {string} plan      - Plan identifier (e.g. 'fintech', 'healthcare_annual')
 * @param {number} value     - Transaction amount in USD
 */
export function trackPurchase(sessionId, plan, value) {
  if (typeof window.gtag !== 'function') return;

  const safeId    = typeof sessionId === 'string' ? sessionId.substring(0, 64) : 'unknown';
  const safeValue = typeof value === 'number' && value > 0 ? value : 0;
  const tier      = getPlanTier(plan);

  window.gtag('event', 'purchase', {
    transaction_id: safeId,
    value:          safeValue,
    currency:       'USD',
    items: [{
      item_id:       plan ?? 'unknown',
      item_name:     `SecureBase ${plan ?? 'Plan'}`,
      price:         safeValue,
      quantity:      1,
      item_category: tier,
    }],
  });
}
