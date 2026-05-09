/**
 * Checkout page — renders the Stripe checkout form directly in the portal.
 *
 * Previously this was a redirect shim that forwarded to securebase.tximhotep.com/checkout,
 * but that created an infinite redirect loop because both the demo site and the
 * production portal site run the same phase3a-portal code.  The shim has been
 * replaced with an inline form so the loop can never recur.
 *
 * Demo mode: user is redirected to /contact-sales to keep demo traffic off the
 * live Stripe checkout.  Demo mode is enabled by VITE_DEMO_MODE=true (set in
 * the demo build via deploy-demo.yml) or by ?demo=true in the URL.
 *
 * POSTs to /api/checkout → AWS API Gateway 4f0i48ueak (securebase-checkout-api, prod stage) →
 * src/functions/securebase-checkout-api/index.cjs (consolidated checkout Lambda from PR #1) → Stripe.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Shield, Loader, CheckCircle, ArrowLeft, AlertTriangle } from 'lucide-react';
import { PRICING_TIERS } from '../config/live-config';
import { isDemoMode } from '../utils/demoData';
import { trackCheckoutStarted } from '../utils/analytics';

const KNOWN_PLANS = Object.keys(PRICING_TIERS);

const HIPAA_TIERS = new Set(['healthcare', 'hipaa_assessment']);

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com',
  'outlook.com', 'live.com', 'icloud.com', 'me.com', 'aol.com',
  'protonmail.com', 'proton.me', 'mail.com', 'zoho.com',
]);

const isPersonalEmail = (addr) =>
  FREE_EMAIL_DOMAINS.has((addr || '').split('@')[1]?.toLowerCase() || '');

// Map known URL aliases → canonical tier keys accepted by /api/checkout.
// Handles stale marketing links, legacy plan names, and third-party integrations.
const TIER_ALIASES = {
  pilot: 'pilot_compliance',  // legacy "Pilot Program" links → Compliance Jumpstart
  hipaa: 'hipaa_assessment',  // shorthand alias
};

export default function Checkout() {
  // All hooks must be declared unconditionally before any early returns.
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [hipaaConsent, setHipaaConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Prefer location.state (set by Pricing.jsx navigate) then fall back to query params.
  // Apply alias normalization so stale links reach a canonical tier key.
  const locationState = location.state || {};
  const planSource = locationState.tier || searchParams.get('plan') || searchParams.get('tier');
  if (!planSource) {
    console.warn('[Checkout] No plan/tier provided; defaulting to "standard".');
  }
  const requestedPlan = planSource || 'standard';
  const rawPlan = TIER_ALIASES[requestedPlan] ?? requestedPlan;

  // Compute once at render time; isDemoMode reads env/localStorage/URL which are
  // stable for the lifetime of the page, so this value won't change after mount.
  const isDemo = isDemoMode();

  useEffect(() => {
    if (isDemo) {
      // Demo environment — stay within the portal and avoid live Stripe
      navigate('/contact-sales', { replace: true });
    }
  }, [isDemo, navigate]);

  // Fail-loud: unknown plan must surface as a visible error instead of silently
  // falling back to 'standard'.  This prevents "wrong plan billed" bugs.
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
  const tierConfig = PRICING_TIERS[plan] || {};
  const planName = searchParams.get('planName') || tierConfig.name || plan;
  const planPrice = tierConfig.price ?? null;
  const billingType = tierConfig.billingType || 'payment';
  const isPilot = billingType === 'subscription' && !!tierConfig.pilotPrice;
  const displayPrice = isPilot ? tierConfig.pilotPrice : planPrice;
  const fullPrice = planPrice;

  const isHipaa = HIPAA_TIERS.has(plan);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isHipaa) {
      if (!company.trim()) { setError('Organization name is required.'); setLoading(false); return; }
      if (isPersonalEmail(email)) { setError('A work email is required for HIPAA enrollment.'); setLoading(false); return; }
      if (!hipaaConsent) { setError('You must acknowledge the HIPAA BAA.'); setLoading(false); return; }
    }

    trackCheckoutStarted({ tier: plan, ...(planPrice !== null && { value: planPrice }), method: 'form' });

    try {
      const origin = window.location.origin;

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          ...(isHipaa && { company_name: company, hipaa_baa_acknowledged: hipaaConsent }),
          tier: plan,
          // Apply the pilot coupon for subscription tiers that have a pilotPrice.
          // Without this, the Lambda defaults to a 14-day trial with no discount,
          // causing Stripe to show the full price.
          use_pilot_coupon: isPilot,
          successUrl: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan)}&value=${planPrice || 0}`,
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-xs uppercase tracking-widest font-bold mb-1">Selected Plan</p>
                <p className="text-xl font-bold">{planName}</p>
              </div>
              {displayPrice !== null && (
                <div className="text-right">
                  <p className="text-3xl font-black">${displayPrice.toLocaleString()}</p>
                  {isPilot && (
                    <p className="text-purple-200 text-xs line-through">${fullPrice.toLocaleString()}</p>
                  )}
                  <p className="text-purple-200 text-xs">{billingType === 'payment' ? 'one-time' : '/month'}</p>
                  {isPilot && (
                    <p className="text-yellow-300 text-xs font-bold">
                      {Math.round((1 - tierConfig.pilotPrice / tierConfig.price) * 100)}% pilot discount
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Checkout form */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
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

              {isHipaa && (
                <div>
                  <label htmlFor="checkout-company" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 ml-1">
                    Company / Organization Name
                  </label>
                  <input id="checkout-company" type="text" placeholder="Acme Health LLC"
                    value={company} onChange={(e) => setCompany(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#667eea] outline-none transition-all text-slate-900"
                  />
                </div>
              )}

              {isHipaa && (
                <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                  <input id="checkout-hipaa-baa" type="checkbox" checked={hipaaConsent}
                    onChange={(e) => setHipaaConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-teal-600"
                  />
                  <label htmlFor="checkout-hipaa-baa" className="text-xs text-teal-800 leading-relaxed">
                    I acknowledge that by proceeding I am entering into SecureBase's Business Associate Agreement (BAA)
                    and confirm that my organization handles Protected Health Information (PHI) subject to HIPAA.
                  </label>
                </div>
              )}

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
                {(billingType === 'payment'
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
