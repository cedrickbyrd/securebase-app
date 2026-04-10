import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { PRICING_TIERS } from '../config/live-config';
import { isDemoMode } from '../utils/demoData';
import { trackContactSalesIntent, trackCheckoutStarted } from '../utils/analytics';

const Pricing = () => {
  const navigate = useNavigate();
  const demoMode = isDemoMode();
  const [loadingTier, setLoadingTier] = useState(null);
  const [errorTier, setErrorTier] = useState(null);

  const plans = [
    { key: 'standard', ...PRICING_TIERS.standard, mostPopular: false },
    { key: 'fintech', ...PRICING_TIERS.fintech, mostPopular: true },
    { key: 'healthcare', ...PRICING_TIERS.healthcare, mostPopular: false },
    { key: 'government', ...PRICING_TIERS.government, mostPopular: false },
  ];

  const handleGetStarted = async (plan) => {
    if (demoMode) {
      trackContactSalesIntent({ tier: plan.key, value: plan.pilotPrice || plan.price });
      navigate('/contact-sales');
      return;
    }

    trackCheckoutStarted({ tier: plan.key, value: plan.pilotPrice || plan.price, pilot: !!plan.pilotPrice, method: 'one_click' });
    setLoadingTier(plan.key);
    setErrorTier(null);

    try {
      const origin = window.location.origin;
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          successUrl: `${origin}/?session_id={CHECKOUT_SESSION_ID}&tab=success`,
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
      navigate('/checkout', { state: { tier: plan.key, priceId: plan.priceId } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-yellow-400 font-semibold mb-2">Pricing</h2>
          <h1 className="text-5xl font-bold text-white mb-4">Enterprise Cloud Security</h1>
          <p className="text-gray-300 text-lg">SOC 2 controls and AWS best practices included</p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <span className="text-yellow-400 font-semibold">🎉 Pilot: 50% off</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {plans.map((plan) => (
            <div key={plan.key} className={`rounded-2xl p-8 bg-white/5 border ${plan.mostPopular ? 'border-yellow-400 ring-2 ring-yellow-400 lg:scale-110' : 'border-white/10'}`}>
              {plan.mostPopular && <div className="text-center mb-4"><span className="bg-yellow-400 text-black px-4 py-1 rounded-full text-sm font-bold">⭐ Most Popular</span></div>}
              <h3 className={`text-2xl font-bold ${plan.mostPopular ? 'text-yellow-400' : 'text-white'}`}>{plan.name}</h3>
              <p className="mt-4 text-gray-300 text-sm">{plan.description}</p>
              <div className="mt-6">
                <span className="text-5xl font-bold text-white">${(plan.pilotPrice || plan.price).toLocaleString()}</span>
                <span className="text-gray-400">/mo</span>
                {plan.pilotPrice && <div className="mt-2 text-sm"><span className="text-gray-400 line-through">${plan.price.toLocaleString()}</span> <span className="text-yellow-400">Save ${(plan.price - plan.pilotPrice).toLocaleString()}</span></div>}
              </div>
              <ul className="mt-8 space-y-3 text-sm">
                {plan.features.map((f, i) => <li key={i} className="flex gap-2 text-gray-300"><span className="text-green-400">✓</span>{f}</li>)}
              </ul>
              {errorTier === plan.key && (
                <p className="mt-3 text-red-400 text-xs text-center">Connection error — redirecting to checkout form…</p>
              )}
              <button
                onClick={() => handleGetStarted(plan)}
                disabled={loadingTier === plan.key}
                className={`mt-8 w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-opacity ${plan.mostPopular ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black' : 'bg-blue-600 text-white'} disabled:opacity-60 disabled:cursor-not-allowed`}>
                {loadingTier === plan.key ? (
                  <>
                    <Loader className="animate-spin w-4 h-4" />
                    Connecting…
                  </>
                ) : demoMode ? 'Contact Sales' : 'Get Started →'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
