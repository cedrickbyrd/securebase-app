const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // 1. Logic Guard
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);

    // Accept both camelCase (frontend) and snake_case (legacy) field names.
    const customer_email = body.customer_email || body.email;
    const price_id       = body.price_id       || body.priceId;
    const plan_name      = body.plan_name      || body.name;
    const billing_type   = body.billingType    || body.billing_type || 'payment';
    const success_url    = body.successUrl     || body.success_url || `${process.env.URL}/?session_id={CHECKOUT_SESSION_ID}&tab=success`;
    const cancel_url     = body.cancelUrl      || body.cancel_url  || `${process.env.URL}/?tab=pricing`;

    // Validate required field before calling Stripe to avoid a cryptic API error.
    if (!price_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'priceId is required' }),
      };
    }

    // Use the billing tier from the request to select the correct Stripe mode.
    // subscription tiers (fintech/healthcare/government) require mode:'subscription'
    // with a recurring price; all other tiers use mode:'payment'.
    const VALID_BILLING_TYPES = ['payment', 'subscription'];
    if (!VALID_BILLING_TYPES.includes(billing_type)) {
      console.warn(`Unexpected billing_type value: "${billing_type}". Defaulting to "payment".`);
    }
    const mode = billing_type === 'subscription' ? 'subscription' : 'payment';
    console.log('mode:', mode, '| billing_type received:', billing_type);

    // 2. Create Stripe Session
    const sessionParams = {
      customer_email: customer_email || undefined,
      payment_method_types: ['card'],
      line_items: [{
        price: price_id,
        quantity: 1,
      }],
      mode,
      // Metadata is key for your "White-Glove" automation
      metadata: {
        plan: plan_name,
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
      body: JSON.stringify({ checkout_url: session.url }),
    };
  } catch (error) {
    console.error('Stripe Session Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
