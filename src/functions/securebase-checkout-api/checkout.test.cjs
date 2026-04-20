/**
 * Unit tests for securebase-checkout-api/index.cjs
 *
 * These tests verify that:
 *  1. Price IDs are resolved server-side from env vars (STRIPE_PRICE_*) rather
 *     than from client-supplied priceId — preventing price-substitution attacks.
 *  2. Client-supplied priceId is silently ignored when a tier is provided.
 *  3. Unknown tiers return 400.
 *  4. Missing env vars return 500 with a clear error message.
 *  5. pilot_compliance uses mode:'payment'; subscription tiers use mode:'subscription'.
 *
 * Run: node --test src/functions/securebase-checkout-api/checkout.test.cjs
 * (Node 18+ built-in test runner)
 */

'use strict';

const assert = require('assert/strict');
const { test, describe, beforeEach, afterEach } = require('node:test');

// ─── Stripe mock ─────────────────────────────────────────────────────────────
// We mock 'stripe' before requiring the handler so we can inspect what session
// params were passed without making real Stripe API calls.
let capturedSessionParams = null;

const mockStripe = () => ({
  checkout: {
    sessions: {
      create: async (params) => {
        capturedSessionParams = params;
        return { url: 'https://checkout.stripe.com/mock-session', id: 'cs_mock_123' };
      },
    },
  },
});

// Patch require('stripe') before loading the handler
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'stripe') {
    return mockStripe;
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Now we can safely require the handler
const handler = require('./index.cjs').handler;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeEvent(body) {
  return {
    httpMethod: 'POST',
    body: JSON.stringify(body),
    headers: {},
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('securebase-checkout-api price-ID server-side resolution', () => {
  beforeEach(() => {
    capturedSessionParams = null;
    // Set env vars for the known tiers
    process.env.STRIPE_PRICE_STANDARD         = 'price_test_standard';
    process.env.STRIPE_PRICE_FINTECH          = 'price_test_fintech';
    process.env.STRIPE_PRICE_HEALTHCARE       = 'price_test_healthcare';
    process.env.STRIPE_PRICE_GOVERNMENT       = 'price_test_government';
    process.env.STRIPE_PRICE_PILOT_COMPLIANCE = 'price_test_pilot_compliance';
    process.env.STRIPE_SECRET_KEY             = 'sk_test_dummy';
  });

  afterEach(() => {
    delete process.env.STRIPE_PRICE_STANDARD;
    delete process.env.STRIPE_PRICE_FINTECH;
    delete process.env.STRIPE_PRICE_HEALTHCARE;
    delete process.env.STRIPE_PRICE_GOVERNMENT;
    delete process.env.STRIPE_PRICE_PILOT_COMPLIANCE;
    delete process.env.STRIPE_SECRET_KEY;
  });

  test('standard tier uses STRIPE_PRICE_STANDARD env var, not client priceId', async () => {
    const response = await handler(makeEvent({
      tier: 'standard',
      email: 'test@example.com',
      name: 'Test User',
      priceId: 'price_attacker_fake',   // <── should be ignored
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200, `Expected 200 but got ${response.statusCode}: ${response.body}`);
    assert.ok(capturedSessionParams, 'Stripe sessions.create should have been called');
    assert.equal(
      capturedSessionParams.line_items[0].price,
      'price_test_standard',
      'Price ID should come from STRIPE_PRICE_STANDARD env var, not client-supplied priceId',
    );
    assert.equal(capturedSessionParams.mode, 'subscription', 'Standard tier should use subscription mode');
  });

  test('fintech tier uses STRIPE_PRICE_FINTECH env var', async () => {
    const response = await handler(makeEvent({
      tier: 'fintech',
      email: 'test@example.com',
      priceId: 'price_should_be_ignored',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.line_items[0].price, 'price_test_fintech');
    assert.equal(capturedSessionParams.mode, 'subscription');
  });

  test('pilot_compliance tier uses STRIPE_PRICE_PILOT_COMPLIANCE env var and payment mode', async () => {
    const response = await handler(makeEvent({
      tier: 'pilot_compliance',
      email: 'test@example.com',
      priceId: 'price_should_be_ignored',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.line_items[0].price, 'price_test_pilot_compliance');
    assert.equal(capturedSessionParams.mode, 'payment', 'pilot_compliance should use payment mode');
  });

  test('unknown tier returns 400', async () => {
    const response = await handler(makeEvent({
      tier: 'unknown_tier',
      email: 'test@example.com',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.match(body.error, /tier is required/i);
  });

  test('missing tier returns 400', async () => {
    const response = await handler(makeEvent({
      email: 'test@example.com',
      priceId: 'price_attacker_direct',  // <── should not be accepted without tier
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 400);
  });

  test('missing STRIPE_PRICE_STANDARD env var returns 500', async () => {
    delete process.env.STRIPE_PRICE_STANDARD;

    const response = await handler(makeEvent({
      tier: 'standard',
      email: 'test@example.com',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 500);
    const body = JSON.parse(response.body);
    assert.match(body.error, /Pricing not configured/i);
  });

  test('billingType:payment from client does not downgrade subscription tier to one-time payment', async () => {
    // Even if a caller sends billingType:'payment' for a subscription tier,
    // the mode must remain 'subscription' (determined by tier, not billingType).
    const response = await handler(makeEvent({
      tier: 'fintech',
      billingType: 'payment',   // <── malicious/misconfigured override attempt
      email: 'test@example.com',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.mode, 'subscription',
      'Subscription tier mode must not be overridden by client billingType');
  });

  test('OPTIONS preflight returns 200 with CORS headers', async () => {
    const response = await handler({ httpMethod: 'OPTIONS', body: '', headers: {} });
    assert.equal(response.statusCode, 200);
  });

  test('GET returns 405', async () => {
    const response = await handler({ httpMethod: 'GET', body: '', headers: {} });
    assert.equal(response.statusCode, 405);
  });
});
