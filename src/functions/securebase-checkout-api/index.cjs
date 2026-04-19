const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// One-time payment tiers — these must use mode:'payment', not mode:'subscription'.
const ONE_TIME_TIERS = new Set(['pilot_compliance']);

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://securebase.tximhotep.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  console.log('handler_version=2026-04-19');

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
    const price_id       = body.price_id       || body.priceId;
    const plan_name      = body.plan_name      || body.name;
    const tier           = body.tier           || body.plan_tier || '';
    const billing_type   = body.billingType    || body.billing_type || 'payment';
    const success_url    = body.successUrl     || body.success_url || `${process.env.URL}/?session_id={CHECKOUT_SESSION_ID}&tab=success`;
    const cancel_url     = body.cancelUrl      || body.cancel_url  || `${process.env.URL}/?tab=pricing`;

    // Warn if tier is missing — use billingType as the authoritative fallback signal.
    if (!tier) {
      console.warn('No tier provided in request; using billingType as authoritative signal:', billing_type);
    }

    // Validate required field before calling Stripe to avoid a cryptic API error.
    if (!price_id) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'priceId is required' }),
      };
    }

    // Determine Stripe checkout mode using both signals:
    //   - tier in ONE_TIME_TIERS (e.g. pilot_compliance) → payment
    //   - billingType === 'payment' → payment
    //   - anything else (fintech/healthcare/government subscription tiers) → subscription
    const VALID_BILLING_TYPES = ['payment', 'subscription'];
    if (billing_type && !VALID_BILLING_TYPES.includes(billing_type)) {
      console.warn(`Unexpected billing_type value: "${billing_type}". Defaulting to "payment".`);
    }
    const is_one_time = ONE_TIME_TIERS.has(tier) || billing_type === 'payment';
    const mode = is_one_time ? 'payment' : 'subscription';
    console.log('mode:', mode, '| tier:', tier, '| billing_type:', billing_type);

    // Validate that the Stripe Price's recurrence matches the intended mode.
    // This catches "recurring price sent as one-time payment" mismatches before
    // they reach Stripe and return a confusing error.
    const price = await stripe.prices.retrieve(price_id);
    if (price.recurring && mode === 'payment') {
      console.error(`Price/mode mismatch: price ${price_id} is recurring but mode is payment. tier=${tier} billing_type=${billing_type}`);
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: `Price ${price_id} is configured for recurring billing in Stripe, but tier "${tier}" is configured as one-time payment. Verify PLAN_BILLING_TYPE configuration.`,
        }),
      };
    }
    if (!price.recurring && mode === 'subscription') {
      console.error(`Price/mode mismatch: price ${price_id} is one-time but mode is subscription. tier=${tier} billing_type=${billing_type}`);
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: `Price ${price_id} is configured for one-time payment in Stripe, but tier "${tier}" is configured for subscription billing. Verify PLAN_BILLING_TYPE configuration.`,
        }),
      };
    }

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
