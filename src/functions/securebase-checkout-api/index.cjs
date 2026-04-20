const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// One-time payment tiers — these must use mode:'payment', not mode:'subscription'.
const ONE_TIME_TIERS = new Set(['pilot_compliance']);

// Server-side tier → Stripe Price ID env var mapping.
// Price IDs are resolved exclusively from environment variables; any client-supplied
// priceId is IGNORED for these tiers. This prevents an attacker (or stale frontend
// code) from substituting an arbitrary Stripe price (e.g. a $0 "guest" price).
const TIER_PRICE_ENV = {
  standard:         'STRIPE_PRICE_STANDARD',
  fintech:          'STRIPE_PRICE_FINTECH',
  healthcare:       'STRIPE_PRICE_HEALTHCARE',
  government:       'STRIPE_PRICE_GOVERNMENT',
  pilot_compliance: 'STRIPE_PRICE_PILOT_COMPLIANCE',
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
      },
      success_url,
      cancel_url,
    };

    // Subscription sessions get a 14-day free trial
    if (mode === 'subscription') {
      sessionParams.subscription_data = { trial_period_days: 14 };
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
