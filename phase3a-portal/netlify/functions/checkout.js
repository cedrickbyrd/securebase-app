const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Full (non-discounted) monthly prices per tier in USD.
// Mirrored from phase3a-portal/src/config/live-config.js PRICING_TIERS.
const FULL_PRICES = {
  standard:   2000,
  fintech:    8000,
  healthcare: 15000,
  government: 25000,
};

// Per-tier compliance metadata forwarded to Stripe session metadata.
// Keys must stay in sync with TIER_COMPLIANCE_METADATA in create_checkout_session.py.
const TIER_COMPLIANCE_METADATA = {
  standard:   { internal_audit_enabled: 'true' },
  fintech:    { compliance_framework: 'SOC2' },
  healthcare: { compliance_framework: 'HIPAA' },
  government: { audit_signature: 'required' },
};

exports.handler = async (event) => {
  // CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { priceId, tier, successUrl, cancelUrl, customer_email } = JSON.parse(event.body);
    
    if (!priceId) {
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ error: 'Missing priceId' }) 
      };
    }

    const pilotCoupon = process.env.STRIPE_PILOT_COUPON;
    const originalPrice = FULL_PRICES[tier] || 0;
    const tierCompliance = TIER_COMPLIANCE_METADATA[tier] || {};

    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(customer_email && { customer_email }),
      metadata: {
        tier: tier || '',
        original_price: String(originalPrice),
        discount_applied: pilotCoupon ? '50%' : 'none',
        pilot_tier: tier || '',
        ...tierCompliance,
      },
    };

    // Stripe does not allow combining `discounts` with `allow_promotion_codes`.
    // Apply the pilot coupon when configured; otherwise fall back to letting
    // the customer enter a promotion code manually.
    if (pilotCoupon) {
      sessionParams.discounts = [{ coupon: pilotCoupon }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ checkout_url: session.url }),
    };
  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
