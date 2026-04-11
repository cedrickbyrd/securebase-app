'use strict';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');

// Enterprise priceIds that must go through Contact Sales, not self-service checkout.
// Override at deploy time via the ENTERPRISE_PRICE_IDS env var (comma-separated).
const ENTERPRISE_PRICE_IDS = new Set(
  (process.env.ENTERPRISE_PRICE_IDS ||
    'price_1SrgoQ5bg6XXXrmNQvC2YnmT,price_1SrgoR5bg6XXXrmNUUveBMDw')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

const JWT_SECRET = process.env.JWT_SECRET;
const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || 'https://demo.securebase.tximhotep.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
};

/**
 * Attempt to verify the demo_jwt HttpOnly cookie from the incoming request.
 * Returns the decoded payload when valid, or null otherwise.
 * Used for audit logging; self-service checkout does not require a JWT.
 */
function verifyJWT(cookieHeader) {
  if (!JWT_SECRET || !cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)demo_jwt=([^;]+)/);
  if (!match) return null;
  try {
    return jwt.verify(match[1], JWT_SECRET, {
      issuer: 'securebase-demo',
      audience: 'securebase-portal',
    });
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid request body' }),
    };
  }

  const { priceId, successUrl, cancelUrl, customer_email } = body;

  if (!priceId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing priceId' }),
    };
  }

  // Block enterprise tiers from the self-service checkout flow.
  // Healthcare and Government require a custom contract (BAA / ATO) and must
  // come through Contact Sales.
  if (ENTERPRISE_PRICE_IDS.has(priceId)) {
    return {
      statusCode: 403,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error:
          'Enterprise plans require a sales consultation. Please use Contact Sales.',
      }),
    };
  }

  // Verify the JWT cookie when present — used only for audit logging.
  const cookieHeader =
    event.headers.cookie || event.headers.Cookie || '';
  const jwtPayload = verifyJWT(cookieHeader);
  if (jwtPayload) {
    console.log(
      JSON.stringify({
        event: 'checkout_with_preview_jwt',
        role: jwtPayload.role,
        timestamp: new Date().toISOString(),
      })
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(customer_email && { customer_email }),
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ checkout_url: session.url }),
    };
  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
