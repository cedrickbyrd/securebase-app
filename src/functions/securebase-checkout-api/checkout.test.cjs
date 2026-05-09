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
let stripeCreateImpl = null;

const mockStripe = () => ({
  checkout: {
    sessions: {
      create: async (params) => {
        if (stripeCreateImpl) {
          return stripeCreateImpl(params);
        }
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
    stripeCreateImpl = null;
    // Set env vars for the known tiers
    process.env.STRIPE_PRICE_STANDARD         = 'price_test_standard';
    process.env.STRIPE_PRICE_FINTECH          = 'price_test_fintech';
    process.env.STRIPE_PRICE_HEALTHCARE       = 'price_test_healthcare';
    process.env.STRIPE_PRICE_GOVERNMENT       = 'price_test_government';
    process.env.STRIPE_PRICE_PILOT            = 'price_test_pilot';
    process.env.STRIPE_PRICE_PILOT_COMPLIANCE = 'price_test_pilot_compliance';
    process.env.STRIPE_PRICE_HIPAA_ASSESSMENT = 'price_test_hipaa_assessment';
    process.env.STRIPE_PILOT_COUPON_ID        = 'pilot_50_off';
    process.env.STRIPE_SECRET_KEY             = 'sk_test_dummy';
    process.env.URL                           = 'https://securebase.tximhotep.com';
  });

  afterEach(() => {
    delete process.env.STRIPE_PRICE_STANDARD;
    delete process.env.STRIPE_PRICE_FINTECH;
    delete process.env.STRIPE_PRICE_HEALTHCARE;
    delete process.env.STRIPE_PRICE_GOVERNMENT;
    delete process.env.STRIPE_PRICE_PILOT;
    delete process.env.STRIPE_PRICE_PILOT_COMPLIANCE;
    delete process.env.STRIPE_PRICE_HIPAA_ASSESSMENT;
    delete process.env.STRIPE_PILOT_COUPON_ID;
    delete process.env.STRIPE_PILOT_COUPON;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.URL;
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

  test('invalid JSON body returns 400', async () => {
    const response = await handler({ httpMethod: 'POST', body: '{', headers: {} });
    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.match(body.error, /invalid json body/i);
  });

  test('GET returns 405', async () => {
    const response = await handler({ httpMethod: 'GET', body: '', headers: {} });
    assert.equal(response.statusCode, 405);
  });

  test('healthcare tier uses STRIPE_PRICE_HEALTHCARE env var', async () => {
    const response = await handler(makeEvent({
      tier: 'healthcare',
      email: 'test@hospitalcorp.com',
      company_name: 'Hospital Corp',
      hipaa_baa_acknowledged: true,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.line_items[0].price, 'price_test_healthcare');
    assert.equal(capturedSessionParams.mode, 'subscription');
  });

  test('government tier uses STRIPE_PRICE_GOVERNMENT env var', async () => {
    const response = await handler(makeEvent({
      tier: 'government',
      email: 'test@example.com',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.line_items[0].price, 'price_test_government');
    assert.equal(capturedSessionParams.mode, 'subscription');
  });

  test('use_pilot_coupon:true adds discounts and does NOT set trial_period_days', async () => {
    const response = await handler(makeEvent({
      tier: 'standard',
      email: 'test@example.com',
      use_pilot_coupon: true,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      capturedSessionParams.discounts,
      [{ coupon: 'pilot_50_off' }],
      'use_pilot_coupon:true should add pilot_50_off coupon',
    );
    assert.equal(
      capturedSessionParams.subscription_data,
      undefined,
      'use_pilot_coupon:true must not set trial_period_days (Stripe restriction)',
    );
  });

  test('use_pilot_coupon:false does NOT add discounts and DOES set trial_period_days', async () => {
    const response = await handler(makeEvent({
      tier: 'standard',
      email: 'test@example.com',
      use_pilot_coupon: false,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.discounts, undefined, 'No coupon when use_pilot_coupon is false');
    assert.equal(
      capturedSessionParams.subscription_data?.trial_period_days,
      14,
      'use_pilot_coupon:false should set 14-day trial',
    );
  });

  test('absent use_pilot_coupon defaults to no coupon and 14-day trial', async () => {
    const response = await handler(makeEvent({
      tier: 'fintech',
      email: 'test@example.com',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.discounts, undefined, 'No coupon by default');
    assert.equal(capturedSessionParams.subscription_data?.trial_period_days, 14);
  });

  test('use_pilot_coupon:true on pilot_compliance (payment mode) does NOT apply coupon', async () => {
    const response = await handler(makeEvent({
      tier: 'pilot_compliance',
      email: 'test@example.com',
      use_pilot_coupon: true,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.mode, 'payment');
    assert.equal(
      capturedSessionParams.discounts,
      undefined,
      'Coupon must not be applied in payment mode (pilot_compliance)',
    );
  });

  test('hipaa_assessment tier uses payment mode and sets assessment-upgrade metadata', async () => {
    const response = await handler(makeEvent({
      tier: 'hipaa_assessment',
      email: 'hipaa@hospitalcorp.com',
      name: 'HIPAA Assessment',
      company_name: 'Hospital Corp',
      hipaa_baa_acknowledged: true,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.mode, 'payment');
    assert.equal(capturedSessionParams.line_items[0].price, 'price_test_hipaa_assessment');
    assert.equal(capturedSessionParams.customer_creation, 'always');
    assert.equal(capturedSessionParams.metadata.upgrade_to, 'healthcare');
    assert.equal(capturedSessionParams.metadata.assessment_credit, '1995');
  });

  test('pilot_compliance tier sets customer_creation:always and fintech upgrade metadata', async () => {
    const response = await handler(makeEvent({
      tier: 'pilot_compliance',
      email: 'pilot@example.com',
      name: 'Pilot Compliance',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.customer_creation, 'always');
    assert.equal(capturedSessionParams.metadata.upgrade_to, 'fintech');
    assert.equal(capturedSessionParams.metadata.assessment_credit, '495');
  });

  test('supports snake_case request fields', async () => {
    const response = await handler(makeEvent({
      tier: 'standard',
      customer_email: 'snake@example.com',
      plan_name: 'Snake Case Plan',
      success_url: 'https://example.com/success-snake',
      cancel_url: 'https://example.com/cancel-snake',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(capturedSessionParams.customer_email, 'snake@example.com');
    assert.equal(capturedSessionParams.metadata.company_email, 'snake@example.com');
    assert.equal(capturedSessionParams.metadata.plan, 'Snake Case Plan');
    assert.equal(capturedSessionParams.success_url, 'https://example.com/success-snake');
    assert.equal(capturedSessionParams.cancel_url, 'https://example.com/cancel-snake');
  });

  test('uses STRIPE_PILOT_COUPON env var when STRIPE_PILOT_COUPON_ID is unset', async () => {
    delete process.env.STRIPE_PILOT_COUPON_ID;
    process.env.STRIPE_PILOT_COUPON = 'pilot_coupon_from_primary_env';

    const response = await handler(makeEvent({
      tier: 'standard',
      email: 'coupon@example.com',
      use_pilot_coupon: true,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200);
    assert.deepEqual(capturedSessionParams.discounts, [{ coupon: 'pilot_coupon_from_primary_env' }]);
  });

  test('returns Stripe error status code when stripe session creation fails', async () => {
    stripeCreateImpl = async () => {
      const err = new Error('Invalid price');
      err.statusCode = 402;
      throw err;
    };

    const response = await handler(makeEvent({
      tier: 'standard',
      email: 'stripe-error@example.com',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 402);
    const body = JSON.parse(response.body);
    assert.match(body.error, /invalid price/i);
  });

  // ─── HIPAA-tier tests ────────────────────────────────────────────────────────

  test('hipaa_assessment rejects personal email domains', async () => {
    const response = await handler(makeEvent({
      tier: 'hipaa_assessment',
      email: 'user@gmail.com',
      hipaa_baa_acknowledged: true,
      company_name: 'Acme Health',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.match(body.error, /work email/i);
  });

  test('hipaa_assessment rejects missing company_name', async () => {
    const response = await handler(makeEvent({
      tier: 'hipaa_assessment',
      email: 'user@acmehealth.com',
      hipaa_baa_acknowledged: true,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.match(body.error, /company_name is required/i);
  });

  test('hipaa_assessment rejects missing BAA acknowledgment', async () => {
    const response = await handler(makeEvent({
      tier: 'hipaa_assessment',
      email: 'user@acmehealth.com',
      company_name: 'Acme Health',
      hipaa_baa_acknowledged: false,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.match(body.error, /BAA acknowledgment/i);
  });

  test('hipaa_assessment with valid work email, company, and BAA succeeds and sets hipaa metadata', async () => {
    const response = await handler(makeEvent({
      tier: 'hipaa_assessment',
      email: 'ciso@acmehealth.com',
      company_name: 'Acme Health LLC',
      hipaa_baa_acknowledged: true,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200, `Expected 200 but got ${response.statusCode}: ${response.body}`);
    assert.equal(capturedSessionParams.metadata.hipaa_baa_acknowledged, 'true');
    assert.equal(capturedSessionParams.metadata.baa_required, 'true');
    assert.equal(capturedSessionParams.metadata.phi_handling, 'true');
  });

  test('healthcare rejects personal email domains', async () => {
    const response = await handler(makeEvent({
      tier: 'healthcare',
      email: 'user@outlook.com',
      hipaa_baa_acknowledged: true,
      company_name: 'Acme Health',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.match(body.error, /work email/i);
  });

  test('healthcare with valid inputs succeeds', async () => {
    const response = await handler(makeEvent({
      tier: 'healthcare',
      email: 'ciso@hospitalcorp.com',
      company_name: 'Hospital Corp',
      hipaa_baa_acknowledged: true,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200, `Expected 200 but got ${response.statusCode}: ${response.body}`);
    assert.equal(capturedSessionParams.metadata.hipaa_baa_acknowledged, 'true');
  });

  test('standard tier does NOT require company_name or BAA', async () => {
    const response = await handler(makeEvent({
      tier: 'standard',
      email: 'user@gmail.com',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200, `Standard tier should not require BAA or company: ${response.body}`);
  });

  // ─── Backwards-compatibility / alias tier tests ───────────────────────────

  test('pilot tier (standalone backwards-compat) uses STRIPE_PRICE_PILOT and subscription mode', async () => {
    const response = await handler(makeEvent({
      tier: 'pilot',
      email: 'test@example.com',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200, `Standalone pilot tier should succeed: ${response.body}`);
    assert.equal(capturedSessionParams.line_items[0].price, 'price_test_pilot',
      'Standalone pilot tier must use STRIPE_PRICE_PILOT, not the pilot_compliance price');
    assert.equal(capturedSessionParams.mode, 'subscription',
      'Standalone pilot tier uses subscription billing');
  });

  test('hipaa_assessment tier is accepted by the backend', async () => {
    const response = await handler(makeEvent({
      tier: 'hipaa_assessment',
      email: 'doctor@hospital.com',
      company_name: 'General Hospital',
      hipaa_baa_acknowledged: true,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }));

    assert.equal(response.statusCode, 200, `hipaa_assessment tier should succeed: ${response.body}`);
    assert.equal(capturedSessionParams.line_items[0].price, 'price_test_hipaa_assessment');
    assert.equal(capturedSessionParams.mode, 'payment',
      'hipaa_assessment uses one-time payment mode');
  });
});
