import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Shield, Loader, CheckCircle, ArrowLeft } from 'lucide-react';
import { PRICING_TIERS } from '../config/live-config';
import { isDemoMode } from '../utils/demoData';
import { validatePriceConsistency } from '../utils/stripeValidation';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Prefer location.state (set by Pricing.jsx navigate) then fall back to query params
  const locationState = location.state || {};
  const plan = locationState.tier || searchParams.get('plan') || 'standard';
  const priceId = locationState.priceId || searchParams.get('priceId') || '';

  const tierConfig = PRICING_TIERS[plan] || {};
  const planName = tierConfig.name || plan;
  const displayPrice = tierConfig.pilotPrice ?? tierConfig.price ?? null;

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect demo environment away from live checkout
  useEffect(() => {
    if (isDemoMode()) {
      navigate('/contact-sales', { replace: true });
    }
  }, [navigate]);

  // Validate price consistency on mount
  useEffect(() => {
    if (!isDemoMode() && plan) {
      const validation = validatePriceConsistency(plan, priceId, undefined);
      if (!validation.valid) {
        setError(validation.error);
      }
    }
  }, [plan, priceId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const origin = window.location.origin;

      // ✅ FIXED: Use /api/checkout (routes to AWS Lambda via netlify.toml)
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ✅ FIXED: AWS Lambda expects 'email' and 'name' (not customer_email, price_id)
          email: email,
          name: name || email.split('@')[0], // Use name if provided, otherwise extract from email
          priceId: priceId, // ✅ FIXED: camelCase for AWS Lambda
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-xs uppercase tracking-widest font-bold mb-1">Selected Plan</p>
                <p className="text-xl font-bold">{planName}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">
                  {displayPrice != null ? `$${displayPrice.toLocaleString()}` : '—'}
                </p>
                <p className="text-purple-200 text-xs">/month</p>
                {tierConfig.pilotPrice && tierConfig.price && (
                  <p className="text-purple-300 text-xs line-through">${tierConfig.price.toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>

          {/* Checkout form */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Start your subscription</h1>
            <p className="text-slate-500 text-sm mb-6">
              Enter your details. You will be redirected to Stripe to complete payment securely.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name field - NEW */}
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
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#667eea] outline-none transition-all text-slate-900"
                />
              </div>

              {/* Email field */}
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
                {[
                  'Secured by Stripe — PCI DSS Level 1',
                  '14-day free trial, cancel anytime',
                  'SOC 2 Type II certified infrastructure',
                ].map((line) => (
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
