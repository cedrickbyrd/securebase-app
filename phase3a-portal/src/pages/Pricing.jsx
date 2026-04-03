import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PRICING_TIERS } from '../config/live-config';

const Pricing = () => {
  const navigate = useNavigate();

  const plans = [
    { key: 'standard', ...PRICING_TIERS.standard, mostPopular: false },
    { key: 'fintech', ...PRICING_TIERS.fintech, mostPopular: true },
    { key: 'healthcare', ...PRICING_TIERS.healthcare, mostPopular: false },
    { key: 'government', ...PRICING_TIERS.government, mostPopular: false },
  ];

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
              <button onClick={() => navigate('/checkout', { state: { tier: plan.key, priceId: plan.priceId }})} className={`mt-8 w-full py-3 rounded-lg font-semibold ${plan.mostPopular ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black' : 'bg-blue-600 text-white'}`}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
