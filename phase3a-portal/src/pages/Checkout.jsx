import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PRICING_TIERS } from '../config/live-config';

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tier, priceId } = location.state || {};

  const [formData, setFormData] = useState({
    email: '',
    company: '',
    usePilot: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redirect to pricing if no tier selected
    if (!tier || !priceId) {
      navigate('/pricing');
    }
  }, [tier, priceId, navigate]);

  const selectedTier = PRICING_TIERS[tier];
  if (!selectedTier) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: tier,
          email: formData.email,
          name: formData.company,
          use_pilot_coupon: formData.usePilot,
          successUrl: `${window.location.origin}/thank-you`,
          cancelUrl: `${window.location.origin}/pricing`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const nextDate = data.next_signup_date;
          const errorMsg = nextDate 
            ? `This email was recently used. You can sign up again on ${nextDate}.`
            : data.error || 'Rate limit exceeded. Please try again later.';
          throw new Error(errorMsg);
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.checkout_url;
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const displayPrice = formData.usePilot ? selectedTier.pilotPrice : selectedTier.price;
  const savings = selectedTier.price - selectedTier.pilotPrice;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 py-12">
      <div className="max-w-3xl mx-auto px-6">
        {/* Back to Pricing */}
        <button
          onClick={() => navigate('/pricing')}
          className="text-blue-300 hover:text-blue-200 mb-6 flex items-center gap-2"
        >
          ← Back to Pricing
        </button>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Complete Your Order</h1>
            <p className="text-gray-300">You're one step away from enterprise-grade security</p>
          </div>

          {/* Selected Plan Summary */}
          <div className="bg-blue-900/30 rounded-lg p-6 mb-8 border border-blue-500/30">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedTier.name}</h3>
                <p className="text-gray-300 text-sm mt-1">{selectedTier.description}</p>
              </div>
              {formData.usePilot && (
                <span className="bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-bold">
                  🎉 Pilot Pricing
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">
                ${displayPrice.toLocaleString()}
              </span>
              <span className="text-gray-400">/month</span>
            </div>
            {formData.usePilot && (
              <p className="text-yellow-400 text-sm mt-2">
                Save ${savings.toLocaleString()}/month with pilot program pricing
              </p>
            )}
          </div>

          {/* Checkout Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-white font-semibold mb-2">
                Work Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-white font-semibold mb-2">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Corporation"
              />
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.usePilot}
                  onChange={(e) => setFormData({ ...formData, usePilot: e.target.checked })}
                  className="mt-1"
                />
                <div>
                  <span className="text-white font-semibold">Apply Pilot Program Discount (50% off)</span>
                  <p className="text-gray-300 text-sm mt-1">
                    Early adopters save ${savings.toLocaleString()}/month
                  </p>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                `Continue to Payment →`
              )}
            </button>

            <p className="text-gray-400 text-sm text-center">
              You'll be redirected to Stripe for secure payment processing
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
