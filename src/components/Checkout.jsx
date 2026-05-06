/**
 * Checkout form for the marketing/root site.
 *
 * Both the marketing site and the customer portal (phase3a-portal) serve this
 * same checkout flow.  The portal's Checkout.jsx (phase3a-portal/src/pages/Checkout.jsx)
 * is an identical inline form — NOT a redirect shim — to prevent the infinite
 * redirect loop that previously occurred when the shim pointed back at this domain.
 *
 * POSTs to /api/checkout → AWS API Gateway 4f0i48ueak (securebase-checkout-api, prod stage) →
 * src/functions/securebase-checkout-api/index.cjs (consolidated checkout Lambda from PR #1) → Stripe.
 * The archived Netlify function (archived/netlify-functions/securebase-checkout-api.js)
 * is no longer used.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Loader, CheckCircle, ArrowLeft, Zap, AlertTriangle } from 'lucide-react';
import { trackCheckoutStarted, trackViewItem } from '../utils/analytics';
import { getPilotPricing, PILOT_PRICING } from '../utils/trackingUtils';

const PLAN_LABELS = {
  standard: 'Standard',
  fintech: 'Fintech',
  healthcare: 'Healthcare',
  government: 'Government',
  enterprise: 'Enterprise / FedRAMP',
  pilot: 'Pilot Program',
  pilot_compliance: 'Compliance Jumpstart',
  hipaa_assessment: 'HIPAA Readiness Assessment',
};

const KNOWN_PLANS = Object.keys(PLAN_LABELS);

// List prices (before any pilot discount) used when isPilot is false.
// healthcare and government are enterprise tiers sold via portal/sales.
const PLAN_PRICES = {
  standard: 499,
  fintech: 1499,
  healthcare: 15000,
  government: 25000,
  enterprise: 3999,
  pilot: 2000,
  pilot_compliance: 495,
  hipaa_assessment: 1995,
};

const PLAN_BILLING_TYPE = {
  standard: 'subscription',
  fintech: 'subscription',
  healthcare: 'subscription',
  government: 'subscription',
  enterprise: 'subscription',
  pilot: 'subscription',
  pilot_compliance: 'payment',
  hipaa_assessment: 'payment',
};

// The pilot 50% discount applies to any of these plans.
// Attribution (LinkedIn UTM) gates *discovery* on the pricing page — not checkout display.
const PILOT_DISCOUNT_TIERS = new Set(['standard', 'fintech', 'healthcare', 'government']);

export default function Checkout() {
  // All hooks must be declared unconditionally before any early returns.
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Resolve plan — prefer URL params, fall back to attribution-based pilot pricing.
  const pilotPricing = getPilotPricing();
  const rawPlan = searchParams.get('plan') || (pilotPricing ? 'pilot' : 'standard');

  // Fail-loud: unknown plan must surface as a visible error instead of silently
  // rendering with undefined price/label data.
  if (!KNOWN_PLANS.includes(rawPlan)) {
    console.error(`Unknown plan: "${rawPlan}". Known plans: ${KNOWN_PLANS.join(', ')}`);
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Plan not found</h1>
          <p className="text-slate-500 text-sm mb-6">
            The plan <strong>{rawPlan}</strong> does not exist. Please return to the pricing page and choose a valid plan.
          </p>
          <button
            onClick={() => navigate('/pricing')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-bold hover:shadow-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pricing
          </button>
        </div>
      </div>
    );
  }

  const plan = rawPlan;
  const planName =
    searchParams.get('planName') || PLAN_LABELS[plan] || plan;

  // isPilot: true for any plan that has a pilot price defined.
  // Attribution (LinkedIn UTM) gates *discovery* on the pricing page — not the checkout display.
  const isPilot = PILOT_DISCOUNT_TIERS.has(plan);

  // Resolve pricing: use attribution-based pricing when available (LinkedIn UTM present);
  // fall back to the static PILOT_PRICING table for direct-link visitors.
  // resolvedPilotPricing is always non-null when isPilot is true: PILOT_PRICING has
  // an entry for every tier in PILOT_DISCOUNT_TIERS, so PILOT_PRICING[plan] is
  // guaranteed to be defined whenever isPilot is true.
  const resolvedPilotPricing = pilotPricing ?? (isPilot ? PILOT_PRICING[plan] : null);

  const billingType = PLAN_BILLING_TYPE[plan] || 'subscription';

  // Fire GA4 view_item once when the checkout page loads for a specific plan.
  // Intentionally fires only on mount: the plan is resolved from URL params at
  // render time and never changes mid-session on this page.
  // This powers Step 2 ("View product") of the GA4 Purchase Journey funnel.
  useEffect(() => {
    const displayPrice = isPilot ? resolvedPilotPricing.monthlyPrice : (PLAN_PRICES[plan] || 0);
    trackViewItem(plan, PLAN_LABELS[plan] || planName, displayPrice);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Fire GA4 begin_checkout right before the POST — not on page load.
    const displayPrice = isPilot ? resolvedPilotPricing.monthlyPrice : (PLAN_PRICES[plan] || 0);
    trackCheckoutStarted(plan, 'monthly', 'form', displayPrice);

    try {
      // Use window.location.origin so the redirect URLs work correctly
      // in every environment (localhost, staging, production, Netlify preview).
      const origin = window.location.origin;

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          tier: plan,
          use_pilot_coupon: isPilot,
          successUrl: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan)}&value=${PLAN_PRICES[plan] || 0}`,
          cancelUrl: `${origin}/pricing`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const { checkout_url } = await response.json();

      if (!checkout_url) {
        throw new Error('No checkout URL returned from server.');
      }

      // Redirect to Stripe Checkout
      window.location.href = checkout_url;
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3"
          >
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
              <Shield className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">TxImhotep LLC</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#667eea] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pricing
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Plan summary */}
          <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-2xl p-6 mb-6 text-white">
            {isPilot && (
              <div className="flex items-center gap-2 mb-3 bg-white/20 rounded-lg px-3 py-2">
                <Zap className="w-4 h-4 text-yellow-300 shrink-0" />
                <span className="text-sm font-bold">Pilot Discount Applied! — 50% savings</span>
              </div>
            )}
            {plan === 'hipaa_assessment' && (
              <div className="flex items-center gap-2 mb-3 bg-white/20 rounded-lg px-3 py-2">
                <CheckCircle className="w-4 h-4 text-green-300 shrink-0" />
                <span className="text-sm font-bold">Auto-enrolled in Healthcare tier — $1,995 credited to first invoice</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-xs uppercase tracking-widest font-bold mb-1">Selected Plan</p>
                <p className="text-xl font-bold">{PLAN_LABELS[plan] || planName}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">
                  ${(isPilot ? resolvedPilotPricing.monthlyPrice : PLAN_PRICES[plan])?.toLocaleString() ?? '—'}
                </p>
                {isPilot && (
                  <p className="text-purple-200 text-xs line-through">
                    ${resolvedPilotPricing.fullPrice.toLocaleString()}
                  </p>
                )}
                <p className="text-purple-200 text-xs">{billingType === 'payment' ? 'one-time' : '/month'}</p>
              </div>
            </div>
          </div>

          {/* Checkout form */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            {/* Healthcare → HIPAA assessment upsell */}
            {plan === 'healthcare' && (
              <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                <p className="text-xs font-bold text-teal-800 mb-1">Recommended: Start with the HIPAA Readiness Assessment</p>
                <p className="text-xs text-teal-700 mb-2">
                  Get a scored gap analysis of HIPAA technical safeguards first ($1,995 one-time).
                  You'll be automatically enrolled in the Healthcare tier with a 30-day trial and the fee credited to your first invoice.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/checkout?plan=hipaa_assessment')}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 underline"
                >
                  Start with HIPAA Assessment instead ($1,995) →
                </button>
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {billingType === 'payment' ? 'Complete your purchase' : 'Start your subscription'}
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              Enter your details. You will be redirected to Stripe to complete payment securely.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="checkout-name"
                  className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 ml-1"
                >
                  Full Name
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#667eea] outline-none transition-all text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="checkout-email"
                  className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 ml-1"
                >
                  Work Email
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#667eea] outline-none transition-all text-slate-900"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm font-semibold bg-red-50 border border-red-100 p-3 rounded-lg">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin w-5 h-5" />
                    Redirecting to Stripe…
                  </>
                ) : (
                  <>
                    Continue to Payment
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>
            </form>

            {/* Trust signals */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex flex-col gap-2">
                {(plan === 'hipaa_assessment'
                  ? [
                      'Secured by Stripe — PCI DSS Level 1',
                      'Auto-enrolled in Healthcare tier — 30-day trial, $1,995 credited',
                      'SOC 2 Type II certified infrastructure',
                    ]
                  : billingType === 'payment'
                  ? [
                      'Secured by Stripe — PCI DSS Level 1',
                      'One-time payment — no recurring charges',
                      'SOC 2 Type II certified infrastructure',
                    ]
                  : [
                      'Secured by Stripe — PCI DSS Level 1',
                      '14-day free trial, cancel anytime',
                      'SOC 2 Type II certified infrastructure',
                    ]
                ).map((line) => (
                  <div key={line} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-slate-500">{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
