import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, CheckCircle } from 'lucide-react';
import { PRICING_TIERS } from '../config/live-config';
import { trackContactSalesIntent, trackCheckoutStarted, trackCTAClick } from '../utils/analytics';

const COMPARISON_ROWS = [
  { label: 'AWS Landing Zone',       standard: true,   fintech: true,   healthcare: true,   government: true  },
  { label: 'Evidence Vaults',        standard: true,   fintech: true,   healthcare: true,   government: true  },
  { label: 'SOC 2 Controls',         standard: false,  fintech: true,   healthcare: true,   government: true  },
  { label: 'HIPAA / BAA',            standard: false,  fintech: false,  healthcare: true,   government: true  },
  { label: 'FedRAMP Alignment',      standard: false,  fintech: false,  healthcare: false,  government: true  },
  { label: 'Dedicated CSM',          standard: false,  fintech: false,  healthcare: true,   government: true  },
  { label: 'Custom SLAs',            standard: false,  fintech: false,  healthcare: false,  government: true  },
  { label: 'Purchase Type',          standard: 'Self-Service', fintech: 'Self-Service', healthcare: 'Contact Sales', government: 'Contact Sales' },
];

const FAQS = [
  {
    q: 'Can I start with Standard and upgrade later?',
    a: 'Yes! You can upgrade to any tier at any time. We\'ll prorate the difference.',
  },
  {
    q: 'Why do Healthcare and Government require a sales conversation?',
    a: 'These tiers include legal agreements — a Business Associate Agreement (BAA) for HIPAA and ATO support for FedRAMP — that require custom contracts tailored to your organization.',
  },
  {
    q: 'What\'s included in the free trial?',
    a: 'Standard and Fintech plans include full feature access for 14 days. No credit card required to start.',
  },
  {
    q: 'How quickly can I be audit-ready?',
    a: 'Most self-service customers are audit-ready in under 48 hours. Enterprise customers get a dedicated onboarding engineer.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'All plans are month-to-month with no lock-in. Cancel from the portal at any time.',
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState(null);
  const [errorTier, setErrorTier] = useState(null);

  const plans = [
    { key: 'pilot_compliance', ...PRICING_TIERS.pilot_compliance, mostPopular: false, isEnterprise: false, isPilotOneTime: true },
    { key: 'standard',   ...PRICING_TIERS.standard,   mostPopular: false, isEnterprise: false },
    { key: 'fintech',    ...PRICING_TIERS.fintech,    mostPopular: true,  isEnterprise: false },
    { key: 'healthcare', ...PRICING_TIERS.healthcare, mostPopular: false, isEnterprise: true  },
    { key: 'government', ...PRICING_TIERS.government, mostPopular: false, isEnterprise: true  },
  ];

  const handleGetStarted = async (plan) => {
    // One-time pilot → navigate directly to checkout form (no coupon/subscription logic)
    if (plan.isPilotOneTime) {
      trackCTAClick('pricing', plan.key);
      navigate('/checkout', { state: { tier: plan.key } });
      return;
    }

    // Enterprise tiers → Contact Sales
    if (plan.isEnterprise) {
      trackCTAClick('pricing', plan.key);
      trackContactSalesIntent({ tier: plan.key, value: plan.pilotPrice || plan.price, source: 'pricing' });
      navigate(`/contact-sales?tier=${plan.key}&source=pricing`);
      return;
    }

    // Self-service tiers → Stripe Checkout
    trackCTAClick('pricing', plan.key);
    setLoadingTier(plan.key);
    setErrorTier(null);

    try {
      const origin = window.location.origin;

      trackCheckoutStarted({ tier: plan.key, value: plan.pilotPrice || plan.price, pilot: !!plan.pilotPrice, method: 'one_click' });
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: plan.key,
          billingType: plan.billingType || 'payment',
          use_pilot_coupon: true,
          successUrl: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan.key)}&value=${plan.pilotPrice || plan.price || 0}`,
          cancelUrl: `${origin}/pricing`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const { checkout_url } = await response.json();

      if (!checkout_url) {
        throw new Error('No checkout URL returned.');
      }

      window.location.href = checkout_url;
    } catch (err) {
      console.error('One-click checkout error:', err.message);
      setErrorTier(plan.key);
      setLoadingTier(null);
      // Graceful fallback to the full checkout form
      navigate('/checkout', { state: { tier: plan.key } });
    }
  };

  const getCtaLabel = (plan) => {
    if (loadingTier === plan.key) return null; // handled inline
    if (plan.isEnterprise) return 'Contact Sales →';
    if (plan.isPilotOneTime) return 'Buy Now — $495 →';
    if (plan.key === 'fintech') return 'Start Free Trial →';
    return 'Get Started →';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Hero */}
        <div className="text-center mb-16">
          <h2 className="text-yellow-400 font-semibold mb-2">Pricing</h2>
          <h1 className="text-5xl font-bold text-white mb-4">Enterprise Cloud Security</h1>
          <p className="text-gray-300 text-lg">SOC 2 controls and AWS best practices included</p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <span className="text-yellow-400 font-semibold">🎉 Pilot: 50% off</span>
          </div>
          {/* Purchase type legend */}
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-300">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              Self-Service: instant activation, 14-day trial
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 border border-purple-400/30 rounded-full text-purple-300">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
              Enterprise Sales: custom contract, BAA / ATO included
            </span>
          </div>
        </div>

        {/* Compliance Jumpstart Pilot Banner */}
        {(() => {
          const pilotPlan = plans.find((p) => p.isPilotOneTime);
          if (!pilotPlan) return null;
          return (
            <div className="mb-8 bg-gradient-to-r from-emerald-900/60 to-teal-900/60 border border-emerald-400/40 rounded-2xl p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold px-3 py-0.5 rounded-full">
                      🚀 Pilot — Limited Spots
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{pilotPlan.name}</h3>
                  <p className="text-gray-300 text-sm mb-3">{pilotPlan.description}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
                    {pilotPlan.features.map((f, i) => (
                      <li key={i} className="flex gap-2 text-gray-300">
                        <span className="text-emerald-400 shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col items-center lg:items-end gap-3 shrink-0">
                  <div className="text-center lg:text-right">
                    <span className="text-5xl font-bold text-white">${pilotPlan.price.toLocaleString()}</span>
                    <span className="text-emerald-300 text-sm ml-1">one-time</span>
                  </div>
                  {errorTier === pilotPlan.key && (
                    <p className="text-red-400 text-xs text-center">Connection error — redirecting…</p>
                  )}
                  <button
                    onClick={() => handleGetStarted(pilotPlan)}
                    disabled={loadingTier === pilotPlan.key}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3 px-8 rounded-xl hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingTier === pilotPlan.key ? (
                      <><Loader className="animate-spin w-4 h-4 inline mr-2" />Connecting…</>
                    ) : (
                      getCtaLabel(pilotPlan)
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-20">
          {plans.filter((p) => !p.isPilotOneTime).map((plan) => (
            <div
              key={plan.key}
              className={`rounded-2xl p-8 flex flex-col bg-white/5 border ${
                plan.mostPopular
                  ? 'border-yellow-400 ring-2 ring-yellow-400 lg:scale-110'
                  : plan.isEnterprise
                  ? 'border-purple-400/50'
                  : 'border-white/10'
              }`}
            >
              {plan.mostPopular && (
                <div className="text-center mb-4">
                  <span className="bg-yellow-400 text-black px-4 py-1 rounded-full text-sm font-bold">⭐ Most Popular</span>
                </div>
              )}
              {plan.isEnterprise && !plan.mostPopular && (
                <div className="text-center mb-4">
                  <span className="bg-purple-500/30 border border-purple-400/50 text-purple-300 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Enterprise Sales</span>
                </div>
              )}

              <h3 className={`text-2xl font-bold ${plan.mostPopular ? 'text-yellow-400' : plan.isEnterprise ? 'text-purple-300' : 'text-white'}`}>
                {plan.name}
              </h3>
              <p className="mt-4 text-gray-300 text-sm">{plan.description}</p>

              <div className="mt-6">
                <span className="text-5xl font-bold text-white">${(plan.pilotPrice || plan.price).toLocaleString()}</span>
                <span className="text-gray-400">/mo</span>
                {plan.pilotPrice && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-400 line-through">${plan.price.toLocaleString()}</span>{' '}
                    <span className="text-yellow-400">Save ${(plan.price - plan.pilotPrice).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <ul className="mt-8 space-y-3 text-sm flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex gap-2 text-gray-300">
                    <span className="text-green-400 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {errorTier === plan.key && (
                <p className="mt-3 text-red-400 text-xs text-center">Connection error — redirecting to checkout form…</p>
              )}

              <button
                onClick={() => handleGetStarted(plan)}
                disabled={loadingTier === plan.key}
                className={`mt-8 w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.mostPopular
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black'
                    : plan.isEnterprise
                    ? 'bg-gradient-to-r from-purple-600 to-purple-800 text-white'
                    : 'bg-blue-600 text-white'
                }`}
              >
                {loadingTier === plan.key ? (
                  <>
                    <Loader className="animate-spin w-4 h-4" />
                    Connecting…
                  </>
                ) : (
                  getCtaLabel(plan)
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-center text-white mb-8">Feature Comparison</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left py-3 px-4 font-semibold text-gray-400 w-1/4" />
                  {plans.filter((p) => !p.isPilotOneTime).map((plan) => (
                    <th
                      key={plan.key}
                      className={`py-3 px-4 text-center font-bold ${
                        plan.mostPopular ? 'text-yellow-400' : plan.isEnterprise ? 'text-purple-300' : 'text-white'
                      }`}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={row.label} className={idx % 2 === 0 ? 'bg-white/5' : 'bg-white/[0.02]'}>
                    <td className="py-3 px-4 font-medium text-gray-300 border-t border-white/5">{row.label}</td>
                    {plans.filter((p) => !p.isPilotOneTime).map((plan) => {
                      const val = row[plan.key];
                      return (
                        <td key={plan.key} className="py-3 px-4 text-center border-t border-white/5">
                          {typeof val === 'boolean' ? (
                            val ? (
                              <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                            ) : (
                              <span className="text-gray-600 font-bold">—</span>
                            )
                          ) : (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              val === 'Self-Service'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-purple-500/20 text-purple-300'
                            }`}>{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mb-20">
          <h2 className="text-2xl font-bold text-center text-white mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQS.map((item) => (
              <div key={item.q} className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">{item.q}</h3>
                <p className="text-sm text-gray-300">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">Trusted compliance frameworks</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['CIS Benchmark', 'SOC 2 Type II', 'HIPAA', 'NIST 800-53', 'FedRAMP Moderate', 'Texas 7 TAC §33'].map(
              (badge) => (
                <span
                  key={badge}
                  className="px-4 py-1.5 bg-white/5 border border-white/10 text-gray-400 text-xs font-semibold rounded-full"
                >
                  {badge}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
