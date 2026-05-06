const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// One-time payment tiers — these must use mode:'payment', not mode:'subscription'.
const ONE_TIME_TIERS = new Set(['pilot_compliance', 'hipaa_assessment']);

// Assessment SKUs that auto-enroll the customer in a subscription tier after payment.
// The webhook reads upgrade_to / assessment_credit from session metadata to apply
// the balance credit and create the deferred subscription.
//
// Structure:
//   key            — the one-time tier SKU (must also exist in TIER_PRICE_ENV)
//   upgrade_to     — target subscription tier key (must also exist in TIER_PRICE_ENV)
//   assessment_credit — fee amount in dollars (string); converted to cents by the webhook
//
// To add a new assessment-to-tier mapping, add an entry here and a matching entry
// in the webhook's UPGRADE_CONFIG table.
const ASSESSMENT_UPGRADES = {
  pilot_compliance: { upgrade_to: 'fintech',     assessment_credit: '495'  },
  hipaa_assessment: { upgrade_to: 'healthcare',  assessment_credit: '1995' },
};

// Server-side tier → Stripe Price ID env var mapping.
// Price IDs are resolved exclusively from environment variables; any client-supplied
// priceId is IGNORED for these tiers. This prevents an attacker (or stale frontend
// code) from substituting an arbitrary Stripe price (e.g. a $0 "guest" price).
const TIER_PRICE_ENV = {
  standard:         'STRIPE_PRICE_STANDARD',
  fintech:          'STRIPE_PRICE_FINTECH',
  healthcare:       'STRIPE_PRICE_HEALTHCARE',
  government:       'STRIPE_PRICE_GOVERNMENT',
  pilot:            'STRIPE_PRICE_PILOT',            // standalone pilot plan (backwards compat)
  pilot_compliance: 'STRIPE_PRICE_PILOT_COMPLIANCE',
  hipaa_assessment: 'STRIPE_PRICE_HIPAA_ASSESSMENT',
};

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://securebase.tximhotep.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  console.log('handler_version=2026-04-20');

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  // 1. Logic Guard
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);

    // Accept both camelCase (frontend) and snake_case (legacy) field names.
    const customer_email = body.customer_email || body.email;
    const plan_name      = body.plan_name      || body.name;
    const tier           = body.tier           || body.plan_tier || '';
    const success_url    = body.successUrl     || body.success_url || `${process.env.URL}/?session_id={CHECKOUT_SESSION_ID}&tab=success`;
    const cancel_url     = body.cancelUrl      || body.cancel_url  || `${process.env.URL}/?tab=pricing`;
    const use_pilot_coupon = !!body.use_pilot_coupon;
    const pilotCouponId    = process.env.STRIPE_PILOT_COUPON_ID || 'pilot_50_off';

    // Require a known tier — the price ID is always resolved server-side from env vars.
    if (!tier || !TIER_PRICE_ENV[tier]) {
      const valid = Object.keys(TIER_PRICE_ENV).join(', ');
      console.error(`Unknown or missing tier "${tier}". Valid tiers: ${valid}`);
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `tier is required. Valid tiers: ${valid}` }),
      };
    }

    // Resolve Stripe Price ID exclusively from server env vars.
    // Ignore any client-supplied priceId to prevent price-substitution attacks.
    const envVarName = TIER_PRICE_ENV[tier];
    const price_id   = process.env[envVarName];
    if (body.priceId || body.price_id) {
      console.warn(`Client-supplied priceId ignored for tier "${tier}"; using server env var ${envVarName}.`);
    }
    if (!price_id) {
      console.error(`Missing env var ${envVarName} for tier "${tier}"`);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Pricing not configured for tier "${tier}". Contact support.` }),
      };
    }

    // Determine Stripe checkout mode from tier alone — never trust client-supplied
    // billingType for this, as that would allow subscription tiers to be downgraded
    // to one-time payments by a malicious or misconfigured caller.
    const is_one_time = ONE_TIME_TIERS.has(tier);
    const mode = is_one_time ? 'payment' : 'subscription';
    console.log('mode:', mode, '| tier:', tier, '| envVar:', envVarName);

    // 2. Create Stripe Session
    const sessionParams = {
      customer_email: customer_email || undefined,
      payment_method_types: ['card'],
      line_items: [{
        price: price_id,
        quantity: 1,
      }],
      mode,
      // Metadata is key for "White-Glove" automation.
      // company_email and plan are read by the stripe-webhook handler for onboarding emails.
      metadata: {
        plan: plan_name,
        tier: tier,
        company_email: customer_email,
        provisioning_status: 'queued',
        // Assessment SKUs signal the webhook to auto-enroll in the target subscription
        // tier with deferred billing and apply the assessment fee as a balance credit.
        ...(ASSESSMENT_UPGRADES[tier] || {}),
      },
      success_url,
      cancel_url,
    };

    // Assessment SKUs are one-time payments, but the webhook needs a Stripe Customer
    // object to apply the balance credit and create the deferred subscription.
    // customer_creation:'always' guarantees one is created even though mode is 'payment'.
    if (ASSESSMENT_UPGRADES[tier]) {
      sessionParams.customer_creation = 'always';
    }

    // Subscription sessions either get a 14-day free trial OR a pilot coupon.
    // Stripe does not allow `discounts` and `subscription_data.trial_period_days`
    // on the same Checkout Session, so we skip the trial when a coupon is active.
    if (mode === 'subscription') {
      if (use_pilot_coupon) {
        sessionParams.discounts = [{ coupon: pilotCouponId }];
      } else {
        sessionParams.subscription_data = { trial_period_days: 14 };
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ checkout_url: session.url, url: session.url, sessionId: session.id }),
    };
  } catch (error) {
    console.error('Stripe Session Error:', error);
    // Use the Stripe error's own HTTP status code when available (e.g. 400 for invalid
    // price IDs, 402 for card declines). Fall back to 500 for unknown/server-side errors.
    const statusCode = error.statusCode || 500;
    return {
      statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
